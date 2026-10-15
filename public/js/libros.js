// ---------------------------------------------------------------------------
// FICHA DEL LIBRO (modal) Y TAPAS
//
// Al tocar una tarjeta de libro se abre un <dialog> con la tapa, la sinopsis
// y los datos de la edición. Los libros salen de dos lugares:
//   - Destacados y novedades: el bloque JSON #datos-libros que deja build.js.
//   - Resultados del buscador: los registra catalogo.js con registrarLibros().
//     Si a uno le falta la sinopsis, se pide a /api/libro al abrir la ficha.
//
// El <dialog> nativo ya resuelve Escape, el foco dentro del modal y el fondo
// inerte. Acá se completa el contenido, se cierra al tocar afuera y se
// devuelve el foco a la tarjeta.
// ---------------------------------------------------------------------------

const SIN_SINOPSIS =
  "Todavía no tenemos la sinopsis de este libro. Acercate a la biblioteca o escribinos y te contamos de qué se trata.";
const BUSCANDO_SINOPSIS = "Buscando la sinopsis…";

const libros = new Map();
let abrirFicha = null;

export function registrarLibros(lista) {
  for (const libro of lista) if (libro?.id) libros.set(libro.id, libro);
}

// --- Tapas --------------------------------------------------------------------
// Google Books da la tapa por ISBN sin API key ni cuota. Cuando no la tiene
// devuelve un cartel "image not available" de 128×170: se trata como faltante.
// Después se prueba Open Library; si tampoco hay, queda la tapa de diseño.

const PLACEHOLDER_GOOGLE = [128, 170];

export function urlsTapaPorISBN(isbn) {
  if (!isbn) return [];
  return [
    `https://books.google.com/books/content?vid=ISBN${encodeURIComponent(isbn)}&printsec=frontcover&img=1&zoom=1`,
    `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`,
  ];
}

const esImagenVacia = (img) =>
  img.naturalWidth < 10 ||
  (img.naturalWidth === PLACEHOLDER_GOOGLE[0] && img.naturalHeight === PLACEHOLDER_GOOGLE[1] && img.src.includes("books.google"));

// Prueba las URLs en orden y muestra la primera que sea una tapa de verdad.
// Se oculta con visibility (clase "invisible") y no con display:none: una
// imagen loading="lazy" con display:none nunca se llega a descargar.
export function cargarTapa(img, urls) {
  const pendientes = urls.filter(Boolean);
  img.classList.add("invisible");
  const siguiente = () => {
    const url = pendientes.shift();
    if (!url) {
      img.classList.add("invisible");
      img.removeAttribute("src");
      return;
    }
    img.src = url;
  };
  img.onerror = siguiente;
  img.onload = () => (esImagenVacia(img) ? siguiente() : img.classList.remove("invisible"));
  siguiente();
}

// --- Ficha --------------------------------------------------------------------

export function iniciarFichasLibros() {
  const dialogo = document.getElementById("ficha-libro");
  if (!dialogo || typeof dialogo.showModal !== "function") return;

  const bloque = document.getElementById("datos-libros");
  if (bloque) {
    try {
      registrarLibros(Object.values(JSON.parse(bloque.textContent)));
    } catch {
      // Sin datos de destacados: el buscador puede seguir registrando libros.
    }
  }

  const $ = (sel) => dialogo.querySelector(sel);
  const portada = $("[data-ficha-portada]");
  let disparador = null;
  let abierto = null; // id del libro que se está mostrando

  function pintarSinopsis(libro, buscando = false) {
    const sinopsis = $("[data-ficha-sinopsis]");
    sinopsis.replaceChildren();
    const texto = libro.sinopsis || (buscando ? BUSCANDO_SINOPSIS : SIN_SINOPSIS);
    for (const parrafo of texto.split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
      const p = document.createElement("p");
      p.textContent = parrafo; // siempre como texto, nunca como HTML
      sinopsis.append(p);
    }
    sinopsis.classList.toggle("italic", !libro.sinopsis);
    sinopsis.setAttribute("aria-busy", String(buscando));

    const fuente = $("[data-ficha-fuente]");
    fuente.textContent = libro.sinopsis && libro.fuente ? `Fuente: ${libro.fuente}` : "";
    fuente.classList.toggle("hidden", !fuente.textContent);
  }

  function pintarDatos(libro) {
    const datos = $("[data-ficha-datos]");
    datos.replaceChildren();
    for (const [etiqueta, valor] of [
      ["Editorial", libro.editorial],
      ["Año", libro.anio],
      ["Páginas", libro.paginas],
      ["ISBN", libro.isbn],
    ]) {
      if (valor == null || valor === "") continue;
      const fila = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.className = "muted text-xs";
      dd.className = "font-medium tabular-nums";
      dt.textContent = etiqueta;
      dd.textContent = String(valor);
      fila.append(dt, dd);
      datos.append(fila);
    }
    datos.classList.toggle("hidden", !datos.children.length);
  }

  function completar(libro) {
    $("#ficha-titulo").textContent = libro.titulo;
    $("[data-ficha-autor]").textContent = libro.autor || "";
    $("[data-ficha-tapa-titulo]").textContent = libro.titulo;
    $("[data-ficha-tapa-autor]").textContent = libro.autor || "";

    // Categoría de los destacados, o disponibilidad si vino del catálogo.
    const etiqueta =
      libro.categoria ??
      (libro.disponibilidad === "disponible" ? "Disponible" : libro.disponibilidad === "prestado" ? "Prestado" : null);
    const categoria = $("[data-ficha-categoria]");
    categoria.textContent = etiqueta ?? "";
    categoria.classList.toggle("hidden", !etiqueta);

    portada.alt = `Portada de «${libro.titulo}»`;
    cargarTapa(portada, [libro.portada, ...urlsTapaPorISBN(libro.isbn)]);

    pintarDatos(libro);
    pintarSinopsis(libro, libro.pedirDetalle);
    $("[data-ficha-sinopsis]").scrollTop = 0;

    const wa = $("[data-ficha-whatsapp]");
    const mensaje = `¡Hola! Quería consultar si está disponible «${libro.titulo}»${libro.autor ? ` de ${libro.autor}` : ""}.`;
    wa.href = `${dialogo.dataset.whatsapp}?text=${encodeURIComponent(mensaje)}`;

    const opac = $("[data-ficha-opac]");
    if (dialogo.dataset.opac) {
      const url = new URL(dialogo.dataset.opac);
      url.searchParams.set("idx", "ti");
      url.searchParams.set("q", libro.titulo);
      opac.href = url.toString();
      opac.classList.remove("hidden");
    }
  }

  // Sinopsis de un resultado del buscador: una consulta por libro, una sola vez.
  async function traerDetalle(libro) {
    libro.pedirDetalle = false;
    const params = new URLSearchParams();
    if (libro.isbn) params.set("isbn", libro.isbn);
    params.set("titulo", libro.titulo);
    if (libro.autor) params.set("autor", libro.autor);
    try {
      const r = await fetch(`/api/libro?${params}`);
      if (r.ok) {
        const d = await r.json();
        for (const campo of ["portada", "sinopsis", "editorial", "anio", "paginas", "isbn"]) {
          if (libro[campo] == null && d[campo] != null) libro[campo] = d[campo];
        }
        if (d.sinopsis && d.fuentes?.length) libro.fuente = d.fuentes.join(" / ");
      }
    } catch {
      // Sin conexión con la API: queda el texto de "sin sinopsis".
    }
    if (abierto === libro.id) {
      pintarDatos(libro);
      pintarSinopsis(libro);
      if (libro.portada && portada.classList.contains("invisible")) cargarTapa(portada, [libro.portada]);
    }
  }

  abrirFicha = (libro, origen) => {
    disparador = origen ?? null;
    abierto = libro.id;
    completar(libro);
    if (!dialogo.open) dialogo.showModal();
    // El foco arranca en el título y no en el botón de cerrar, para que el
    // lector de pantalla lea la ficha desde el principio.
    $("#ficha-titulo").setAttribute("tabindex", "-1");
    $("#ficha-titulo").focus();
    if (libro.pedirDetalle) traerDetalle(libro);
  };

  document.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-libro]");
    if (!boton) return;
    const libro = libros.get(boton.dataset.libro);
    if (libro) abrirFicha(libro, boton);
  });

  $("[data-cerrar-ficha]").addEventListener("click", () => dialogo.close());

  // Clic en el fondo oscuro (fuera de la caja) cierra.
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });

  dialogo.addEventListener("close", () => {
    abierto = null;
    disparador?.focus();
    disparador = null;
  });
}
