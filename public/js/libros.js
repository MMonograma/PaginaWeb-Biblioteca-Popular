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
// Orden de prueba, de la más barata a la más cara:
//   1. La tapa guardada en el build (libros-info.json) o la del buscador.
//   2. Por ISBN, directo y sin cuota: Google Books y Open Library. Cuando
//      Google no la tiene devuelve un cartel de 128×170: se trata como faltante.
//   3. Si nada funcionó (o no hay ISBN): /api/libro busca por título y autor
//      en Google, Open Library y Apple Books. Una sola vez por libro, y Vercel
//      guarda la respuesta un día.
//   4. Si tampoco hay, queda la tapa de diseño.

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
// alAgotar se llama si ninguna sirvió.
export function cargarTapa(img, urls, { alAgotar } = {}) {
  const pendientes = [...new Set(urls.filter(Boolean))];
  img.classList.add("invisible");
  const siguiente = () => {
    const url = pendientes.shift();
    if (!url) {
      img.onerror = img.onload = null;
      img.removeAttribute("src");
      alAgotar?.();
      return;
    }
    img.src = url;
  };
  img.onerror = siguiente;
  img.onload = () => (esImagenVacia(img) ? siguiente() : img.classList.remove("invisible"));
  siguiente();
}

// Datos que faltan (tapa, sinopsis, editorial…), pedidos a /api/libro.
// Se guarda la promesa: si la tarjeta y la ficha lo piden a la vez, sale una
// sola consulta.
const detalles = new Map();

export function pedirDetalle(libro) {
  if (detalles.has(libro.id)) return detalles.get(libro.id);
  const params = new URLSearchParams();
  if (libro.isbn) params.set("isbn", libro.isbn);
  params.set("titulo", libro.titulo);
  if (libro.autor) params.set("autor", libro.autor);
  const promesa = fetch(`/api/libro?${params}`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({})) // Sin conexión con la API: queda lo que había.
    .then((d) => {
      const portadaPrevia = libro.portada;
      for (const campo of ["portada", "sinopsis", "editorial", "anio", "paginas", "isbn"]) {
        if (libro[campo] == null && d[campo] != null) libro[campo] = d[campo];
      }
      if (d.sinopsis && d.fuentes?.length && !libro.fuente) libro.fuente = d.fuentes.join(" / ");
      libro.pedirDetalle = false;
      return { portadaNueva: libro.portada && libro.portada !== portadaPrevia ? libro.portada : null };
    });
  detalles.set(libro.id, promesa);
  return promesa;
}

// Último intento para una imagen que se quedó sin tapa.
async function tapaPorTitulo(libro, img) {
  if (!libro || !/^https?:/.test(location.protocol)) return; // file:// no tiene /api
  const { portadaNueva } = await pedirDetalle(libro);
  if (portadaNueva) cargarTapa(img, [portadaNueva]);
}

// Tarjetas que arma build.js (Inicio y destacados del Catálogo). interfaz.js
// ya recorre su lista de respaldos apenas carga la página; acá se toma la
// posta cuando se agotan. Las que ni siquiera tienen URL (libro sin tapa
// guardada ni ISBN) se buscan cuando están por entrar en pantalla.
function iniciarTapasDeTarjetas() {
  const libroDe = (img) => libros.get(img.closest("article")?.querySelector("[data-libro]")?.dataset.libro);

  document.addEventListener("tapa-agotada", (e) => tapaPorTitulo(libroDe(e.target), e.target));
  for (const img of document.querySelectorAll("img[data-portada][data-sin-tapa]")) tapaPorTitulo(libroDe(img), img);

  const sinURL = [...document.querySelectorAll("img[data-portada]:not([src])")];
  if (!sinURL.length) return;
  const mirar = (img) => tapaPorTitulo(libroDe(img), img);
  if (!("IntersectionObserver" in window)) return sinURL.forEach(mirar);
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const { isIntersecting, target } of entradas) {
        if (!isIntersecting) continue;
        observador.unobserve(target);
        mirar(target);
      }
    },
    { rootMargin: "300px" }
  );
  sinURL.forEach((img) => observador.observe(img));
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
  iniciarTapasDeTarjetas();

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
    cargarTapa(portada, [libro.portada, ...urlsTapaPorISBN(libro.isbn)], {
      alAgotar: () => {
        if (abierto === libro.id) tapaPorTitulo(libro, portada);
      },
    });

    pintarDatos(libro);
    pintarSinopsis(libro, libro.pedirDetalle);
    $("[data-ficha-sinopsis]").scrollTop = 0;

    const wa = $("[data-ficha-whatsapp]");
    const mensaje = `¡Hola! Quería consultar si está disponible «${libro.titulo}»${libro.autor ? ` de ${libro.autor}` : ""}.`;
    wa.href = `${dialogo.dataset.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  }

  // Sinopsis de un resultado del buscador: una consulta por libro, una sola vez.
  async function traerDetalle(libro) {
    const { portadaNueva } = await pedirDetalle(libro);
    if (abierto === libro.id) {
      pintarDatos(libro);
      pintarSinopsis(libro);
      if (portadaNueva && portada.classList.contains("invisible")) cargarTapa(portada, [portadaNueva]);
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
