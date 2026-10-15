// ---------------------------------------------------------------------------
// BUSCADOR DEL CATÁLOGO (DigiBepé / Koha)
//
// El catálogo vive en http://4124.bepe.ar: solo HTTP, con un certificado de
// otro dominio y caídas frecuentes (503). El navegador no puede leerlo desde
// una página HTTPS, así que la búsqueda pasa por /api/catalogo, una función
// de Vercel que consulta DigiBepé del lado del servidor y devuelve JSON.
//
// Los resultados se muestran en esta misma página, con el mismo aspecto que
// los títulos destacados, y cada uno abre la ficha del libro (libros.js).
// La búsqueda queda en la dirección (?q=...) para poder compartirla.
// ---------------------------------------------------------------------------

import { registrarLibros, cargarTapa, urlsTapaPorISBN } from "./libros.js";

export function iniciarBuscadorCatalogo() {
  const form = document.getElementById("buscador-catalogo");
  if (!form) return;

  // Sin catálogo habilitado (catalogoDisponible: false en sitio.js) el
  // formulario no hace nada.
  if (!form.dataset.catalogoUrl) {
    form.addEventListener("submit", (evento) => evento.preventDefault());
    return;
  }

  const seccion = document.getElementById("resultados-catalogo");
  const lista = document.getElementById("resultados-lista");
  const estado = document.getElementById("resultados-estado");
  const cargando = document.getElementById("resultados-cargando");
  const error = document.getElementById("resultados-error");
  const botonMas = document.getElementById("resultados-mas");
  const molde = document.getElementById("tpl-resultado-libro");
  const campoQ = form.querySelector("#catalogo-q");
  const campoIdx = form.querySelector("#catalogo-idx");
  const botonBuscar = form.querySelector('button[type="submit"]');

  let consulta = null; // { q, idx, offset, total }
  let pedidoActual = 0;

  function tarjeta(libro) {
    const nodo = molde.content.firstElementChild.cloneNode(true);
    const boton = nodo.querySelector("[data-libro]");
    boton.dataset.libro = libro.id;
    boton.textContent = libro.titulo;
    nodo.querySelector("[data-tapa-titulo]").textContent = libro.titulo;
    nodo.querySelector("[data-tapa-autor]").textContent = libro.autor;
    nodo.querySelector("[data-autor]").textContent = libro.autor;
    nodo.querySelector("[data-edicion]").textContent = [libro.editorial, libro.anio].filter(Boolean).join(" · ");

    if (libro.disponibilidad) {
      const badge = nodo.querySelector("[data-disponibilidad]");
      badge.textContent = libro.disponibilidad === "disponible" ? "Disponible" : "Prestado";
      badge.classList.remove("hidden");
    }

    cargarTapa(nodo.querySelector("[data-tapa]"), urlsTapaPorISBN(libro.isbn));
    return nodo;
  }

  function mostrarError(mensaje) {
    error.querySelector("[data-mensaje]").textContent = mensaje;
    error.classList.remove("hidden");
  }

  async function buscar({ q, idx, offset = 0 }) {
    const pedido = ++pedidoActual;
    const nueva = offset === 0;

    seccion.classList.remove("hidden");
    error.classList.add("hidden");
    botonMas.classList.add("hidden");
    botonBuscar.disabled = true;
    if (nueva) {
      lista.replaceChildren();
      cargando.classList.remove("hidden");
      estado.textContent = "Buscando en el catálogo…";
      seccion.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      botonMas.disabled = true;
      botonMas.textContent = "Cargando…";
    }

    try {
      const params = new URLSearchParams({ q });
      if (idx) params.set("idx", idx);
      if (offset) params.set("offset", String(offset));
      const respuesta = await fetch(`/api/catalogo?${params}`);
      const datos = await respuesta.json().catch(() => ({}));
      if (pedido !== pedidoActual) return; // Llegó tarde: ya hay otra búsqueda.
      if (!respuesta.ok) throw new Error(datos.error || "No pudimos completar la búsqueda.");

      // Cada resultado pide su sinopsis recién cuando se abre la ficha.
      const libros = datos.items.map((l) => ({ ...l, pedirDetalle: true }));
      registrarLibros(libros);
      lista.append(...libros.map(tarjeta));

      const mostrados = lista.children.length;
      const total = Math.max(datos.total ?? 0, mostrados);
      consulta = { q, idx, offset: offset + datos.items.length, total };

      if (!mostrados) {
        estado.textContent = "";
        mostrarError(`No encontramos libros para «${q}». Probá con otra palabra, solo el apellido del autor o buscando en todo el catálogo.`);
      } else {
        estado.textContent = total > mostrados ? `Mostrando ${mostrados} de ${total} resultados` : `${mostrados} ${mostrados === 1 ? "resultado" : "resultados"}`;
        botonMas.classList.toggle("hidden", !(datos.items.length && mostrados < total));
      }
    } catch (e) {
      if (pedido !== pedidoActual) return;
      estado.textContent = "";
      mostrarError(e.message === "Failed to fetch" ? "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo." : e.message);
    } finally {
      if (pedido === pedidoActual) {
        cargando.classList.add("hidden");
        botonBuscar.disabled = false;
        botonMas.disabled = false;
        botonMas.textContent = "Ver más resultados";
      }
    }
  }

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const q = campoQ.value.trim();
    if (q.length < 2) {
      campoQ.reportValidity();
      return;
    }
    const idx = campoIdx.value;

    const url = new URL(location.href);
    url.searchParams.set("q", q);
    if (idx) url.searchParams.set("idx", idx);
    else url.searchParams.delete("idx");
    history.replaceState(null, "", url);

    buscar({ q, idx });
  });

  botonMas.addEventListener("click", () => {
    if (consulta) buscar({ q: consulta.q, idx: consulta.idx, offset: consulta.offset });
  });

  // Si se llegó con ?q=... (búsqueda compartida o recarga), se busca de una.
  const inicial = new URLSearchParams(location.search);
  if (inicial.get("q")) {
    campoQ.value = inicial.get("q");
    if ([...campoIdx.options].some((o) => o.value === inicial.get("idx"))) campoIdx.value = inicial.get("idx");
    buscar({ q: campoQ.value.trim(), idx: campoIdx.value });
  }
}
