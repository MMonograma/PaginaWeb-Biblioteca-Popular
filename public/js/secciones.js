// ---------------------------------------------------------------------------
// SECCIONES CON DATOS EXTERNOS — talleres y noticias.
//
// El marcado de cada tarjeta vive en un <template> dentro del HTML, no en
// cadenas de texto acá: así el diseño se edita junto al resto de la página.
//
// Todo lo que llega de la hoja se inserta con textContent. Las únicas
// excepciones son enlaces e imágenes, que pasan por los validadores de
// fuente-datos.js antes de tocar el DOM.
// ---------------------------------------------------------------------------

import { BIBLIOTECA, TALLERES_RESPALDO } from "./datos.js";
import { traerHoja, esEnlaceSeguro, esImagenSegura, urlDeVideo, formatearFecha, fechaISO } from "./fuente-datos.js";

const NOTICIAS_POR_PAGINA = 6;

const mostrar = (id, visible) => document.getElementById(id)?.classList.toggle("hidden", !visible);

// Pone el texto si hay dato; si no, saca el elemento para no dejar huecos.
function texto(nodo, selector, valor) {
  const el = nodo.querySelector(selector);
  if (!el) return null;
  const limpio = String(valor ?? "").trim();
  if (!limpio) {
    el.remove();
    return null;
  }
  el.textContent = limpio;
  return el;
}

function enlaceWhatsApp(asunto) {
  const mensaje = `¡Hola! Quiero consultar por ${asunto}`;
  return `https://wa.me/${BIBLIOTECA.contacto.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

// --- Talleres ---------------------------------------------------------------

function tarjetaTaller(taller, plantilla, indice) {
  const nodo = plantilla.content.cloneNode(true);
  const nombre = String(taller.nombre ?? taller.titulo ?? "").trim();

  texto(nodo, "[data-categoria]", taller.categoria);
  texto(nodo, "[data-nombre]", nombre);
  texto(nodo, "[data-horario]", [taller.dia, taller.horario].filter(Boolean).join(" · "));
  texto(nodo, "[data-lugar]", taller.lugar);
  texto(nodo, "[data-fecha]", formatearFecha(taller.fecha));

  const docente = String(taller.docente ?? taller.tallerista ?? "").trim();
  texto(nodo, "[data-docente]", docente && `A cargo de ${docente}`);
  texto(nodo, "[data-descripcion]", taller.descripcion);
  texto(nodo, "[data-info]", taller.info ?? taller.informacionadicional);

  // Imagen: sólo https, con medidas fijas para que no salte el diseño al cargar.
  const imagen = nodo.querySelector("[data-imagen]");
  const marco = nodo.querySelector("[data-imagen-marco]");
  const urlImagen = taller.urlimagen ?? taller.imagen;
  if (imagen && esImagenSegura(urlImagen)) {
    imagen.src = urlImagen;
    imagen.alt = nombre ? `Imagen del taller ${nombre}` : "";
    imagen.loading = "lazy";
    imagen.decoding = "async";
  } else {
    marco?.remove();
    imagen?.remove();
  }

  // Panel de detalle: se eligió acordeón y no ventana modal porque no hay que
  // atrapar el foco ni tapar la página, y ya se usa el mismo patrón en Inicio.
  const detalle = nodo.querySelector("[data-detalle]");
  const boton = nodo.querySelector("[data-detalle-btn]");
  if (detalle && boton) {
    const tieneDetalle = detalle.textContent.trim() !== "";
    if (tieneDetalle) {
      const id = `taller-detalle-${indice}`;
      detalle.id = id;
      boton.setAttribute("aria-controls", id);
      boton.setAttribute("aria-expanded", "false");
      detalle.setAttribute("aria-hidden", "true");
      boton.addEventListener("click", () => {
        const abierto = boton.getAttribute("aria-expanded") !== "true";
        boton.setAttribute("aria-expanded", String(abierto));
        detalle.classList.toggle("grid-rows-abierto", abierto);
        detalle.classList.toggle("grid-rows-cerrado", !abierto);
        detalle.setAttribute("aria-hidden", String(!abierto));
        const etiqueta = boton.querySelector("[data-detalle-texto]");
        if (etiqueta) etiqueta.textContent = abierto ? "Ver menos" : "Ver más";
      });
    } else {
      boton.remove();
      detalle.remove();
    }
  }

  const inscripcion = nodo.querySelector("[data-inscripcion]");
  if (inscripcion) {
    const url = taller.inscripcion ?? taller.enlaceinscripcion;
    if (esEnlaceSeguro(url)) {
      inscripcion.href = url;
      inscripcion.setAttribute("aria-label", `Inscribirse al taller ${nombre}`);
    } else {
      inscripcion.remove();
    }
  }

  const wa = nodo.querySelector("[data-wa]");
  if (wa) {
    wa.href = enlaceWhatsApp(`el taller de ${nombre}`);
    wa.setAttribute("aria-label", `Consultar por WhatsApp sobre el taller ${nombre}`);
  }

  return nodo;
}

function renderTalleres(talleres, idGrilla, idPlantilla) {
  const grilla = document.getElementById(idGrilla);
  const plantilla = document.getElementById(idPlantilla);
  if (!grilla || !plantilla) return;

  grilla.replaceChildren();
  talleres.forEach((taller, i) => grilla.appendChild(tarjetaTaller(taller, plantilla, i)));
}

export async function cargarTalleres({ grilla, plantilla, skeleton, limite = 0 } = {}) {
  if (!document.getElementById(grilla)) return;

  try {
    const { configurada, items } = await traerHoja("talleres");
    const talleres = configurada && items.length ? items : TALLERES_RESPALDO;
    renderTalleres(limite ? talleres.slice(0, limite) : talleres, grilla, plantilla);
  } catch (error) {
    console.warn("No se pudieron cargar los talleres:", error.message);
    renderTalleres(limite ? TALLERES_RESPALDO.slice(0, limite) : TALLERES_RESPALDO, grilla, plantilla);
    mostrar("talleres-aviso", true);
  } finally {
    if (skeleton) mostrar(skeleton, false);
  }
}

// --- Noticias ---------------------------------------------------------------

function tarjetaNoticia(noticia, plantilla) {
  const nodo = plantilla.content.cloneNode(true);
  const titulo = String(noticia.titulo ?? "").trim();

  texto(nodo, "[data-categoria]", noticia.categoria);
  texto(nodo, "[data-titulo]", titulo);
  texto(nodo, "[data-descripcion]", noticia.descripcion ?? noticia.contenido ?? noticia.resumen);

  const fecha = nodo.querySelector("[data-fecha]");
  if (fecha) {
    const legible = formatearFecha(noticia.fecha);
    if (legible) {
      fecha.textContent = legible;
      const iso = fechaISO(noticia.fecha);
      if (iso) fecha.setAttribute("datetime", iso);
    } else {
      fecha.remove();
    }
  }

  const marco = nodo.querySelector("[data-medio]");
  const imagen = nodo.querySelector("[data-imagen]");
  const video = urlDeVideo(noticia.video ?? noticia.videoembebido);
  const urlImagen = noticia.urlimagen ?? noticia.imagen;

  if (video && marco) {
    // El video tampoco se carga solo: un botón lo inserta cuando se pide.
    imagen?.remove();
    marco.replaceChildren(botonDeVideo(video, titulo, marco));
  } else if (imagen && esImagenSegura(urlImagen)) {
    imagen.src = urlImagen;
    imagen.alt = titulo ? `Imagen de: ${titulo}` : "";
    imagen.loading = "lazy";
    imagen.decoding = "async";
  } else {
    marco?.remove();
  }

  const enlace = nodo.querySelector("[data-enlace]");
  if (enlace) {
    const url = noticia.enlaceinstagram ?? noticia.instagram ?? noticia.enlace;
    if (esEnlaceSeguro(url)) {
      enlace.href = url;
      enlace.setAttribute("aria-label", `Ver la publicación completa: ${titulo}`);
      const etiqueta = enlace.querySelector("[data-enlace-texto]");
      if (etiqueta && /instagram\.com/i.test(url)) etiqueta.textContent = "Ver en Instagram";
    } else {
      enlace.remove();
    }
  }

  return nodo;
}

// Miniatura con botón: el iframe del video recién se inserta al pulsarlo.
function botonDeVideo(url, titulo, marco) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center";
  boton.setAttribute("aria-label", titulo ? `Reproducir el video de ${titulo}` : "Reproducir el video");

  const icono = document.createElement("span");
  icono.className = "grid h-14 w-14 place-items-center rounded-full bg-biblio-moss text-xl text-biblio-paper";
  icono.textContent = "▶";
  icono.setAttribute("aria-hidden", "true");

  const etiqueta = document.createElement("span");
  etiqueta.className = "muted text-sm";
  etiqueta.textContent = "Ver el video";

  boton.append(icono, etiqueta);
  boton.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = titulo || "Video";
    iframe.loading = "lazy";
    iframe.className = "h-full w-full border-0";
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("allow", "accelerometer; encrypted-media; picture-in-picture");
    marco.replaceChildren(iframe);
  });

  return boton;
}

function renderPaginacion(total, pagina, alCambiar) {
  const nav = document.getElementById("noticias-paginacion");
  if (!nav) return;

  const paginas = Math.ceil(total / NOTICIAS_POR_PAGINA);
  nav.replaceChildren();
  if (paginas <= 1) return;

  const boton = (etiquetaTexto, destino, { actual = false, desactivado = false, etiqueta } = {}) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = etiquetaTexto;
    b.disabled = desactivado;
    b.className = actual
      ? "min-h-11 min-w-11 rounded-lg bg-biblio-moss px-3 text-sm font-semibold text-biblio-paper dark:bg-biblio-pistachio dark:text-biblio-charcoal"
      : "min-h-11 min-w-11 rounded-lg border border-biblio-pistachio px-3 text-sm font-medium text-biblio-moss transition hover:bg-biblio-pistachio/60 disabled:cursor-not-allowed disabled:opacity-40 dark:border-biblio-moss dark:text-biblio-pistachio";
    if (etiqueta) b.setAttribute("aria-label", etiqueta);
    if (actual) b.setAttribute("aria-current", "page");
    if (!desactivado && !actual) b.addEventListener("click", () => alCambiar(destino));
    return b;
  };

  nav.appendChild(boton("‹", pagina - 1, { desactivado: pagina === 1, etiqueta: "Página anterior" }));
  for (let p = 1; p <= paginas; p++) {
    nav.appendChild(boton(String(p), p, { actual: p === pagina, etiqueta: `Ir a la página ${p}` }));
  }
  nav.appendChild(boton("›", pagina + 1, { desactivado: pagina === paginas, etiqueta: "Página siguiente" }));
}

export async function cargarNoticias() {
  const grilla = document.getElementById("noticias-grid");
  const plantilla = document.getElementById("tpl-noticia");
  if (!grilla || !plantilla) return;

  let noticias = [];

  // La página vive en la URL: así se puede compartir y el botón "atrás"
  // del navegador funciona como se espera.
  const paginaDeURL = () => {
    const n = Number(new URLSearchParams(location.search).get("pagina"));
    return Number.isInteger(n) && n > 0 ? n : 1;
  };

  const pintar = (pagina, moverFoco = false) => {
    const paginas = Math.max(1, Math.ceil(noticias.length / NOTICIAS_POR_PAGINA));
    const actual = Math.min(pagina, paginas);
    const desde = (actual - 1) * NOTICIAS_POR_PAGINA;

    grilla.replaceChildren();
    for (const noticia of noticias.slice(desde, desde + NOTICIAS_POR_PAGINA)) {
      grilla.appendChild(tarjetaNoticia(noticia, plantilla));
    }

    const contador = document.getElementById("noticias-contador");
    if (contador) {
      const hasta = Math.min(desde + NOTICIAS_POR_PAGINA, noticias.length);
      contador.textContent = `Mostrando ${desde + 1}–${hasta} de ${noticias.length}`;
    }

    renderPaginacion(noticias.length, actual, (destino) => {
      const url = new URL(location.href);
      if (destino === 1) url.searchParams.delete("pagina");
      else url.searchParams.set("pagina", String(destino));
      history.pushState({ pagina: destino }, "", url);
      pintar(destino, true);
    });

    // Al cambiar de página el foco va al título de la lista, para que quien
    // navega con teclado o lector de pantalla no quede perdido al final.
    if (moverFoco) {
      const titulo = document.getElementById("noticias-titulo");
      titulo?.focus();
      titulo?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  try {
    const { configurada, items } = await traerHoja("noticias");
    noticias = items;

    if (!configurada) {
      mostrar("noticias-sin-configurar", true);
    } else if (!noticias.length) {
      mostrar("noticias-vacio", true);
    } else {
      pintar(paginaDeURL());
      mostrar("noticias-lista", true);
    }
  } catch (error) {
    console.warn("No se pudieron cargar las noticias:", error.message);
    mostrar("noticias-error", true);
  } finally {
    mostrar("noticias-skeleton", false);
  }

  window.addEventListener("popstate", () => {
    if (noticias.length) pintar(paginaDeURL());
  });
}
