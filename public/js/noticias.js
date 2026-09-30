// ---------------------------------------------------------------------------
// NOTICIAS — últimas publicaciones de Instagram.
//
// No se habla con Instagram desde el navegador. Dos veces por día, una GitHub
// Action corre scripts/sync-instagram.py, que baja las últimas publicaciones
// y deja en el repositorio:
//   public/data/noticias.json    la lista de publicaciones
//   public/noticias/{id}.jpg     la foto de cada una, copiada acá porque los
//                                enlaces del CDN de Instagram vencen en días
// Ese commit dispara un deploy en Vercel, y esta página sólo lee el JSON.
// ---------------------------------------------------------------------------

import { esEnlaceSeguro, formatearFecha, fechaISO } from "./fuente-datos.js";

const ARCHIVO = "/data/noticias.json";
const ESPERA_MAXIMA_MS = 8000;

const mostrar = (id, visible) => document.getElementById(id)?.classList.toggle("hidden", !visible);

// Las fotos tienen que ser nuestras: sólo se aceptan rutas de /noticias/.
const esFotoLocal = (ruta) => /^\/noticias\/[\w-]+\.jpg$/.test(String(ruta ?? ""));

function tarjetaNoticia(noticia, plantilla) {
  const nodo = plantilla.content.cloneNode(true);
  const legible = formatearFecha(noticia.fecha);

  // Instagram no tiene títulos: el encabezado va oculto a la vista pero
  // presente para los lectores de pantalla, que navegan de título en título.
  const titulo = nodo.querySelector("[data-titulo]");
  if (titulo) titulo.textContent = legible ? `Publicación del ${legible}` : "Publicación";

  const fecha = nodo.querySelector("[data-fecha]");
  if (fecha) {
    if (legible) {
      fecha.textContent = legible;
      const iso = fechaISO(noticia.fecha);
      if (iso) fecha.setAttribute("datetime", iso);
    } else {
      fecha.remove();
    }
  }

  const texto = nodo.querySelector("[data-caption]");
  const caption = String(noticia.caption ?? "").trim();
  if (texto) {
    if (caption) texto.textContent = caption;
    else texto.remove();
  }

  const marco = nodo.querySelector("[data-medio]");
  const imagen = nodo.querySelector("[data-imagen]");
  if (imagen && esFotoLocal(noticia.imagen)) {
    imagen.src = noticia.imagen;
    // "alt" viene del texto alternativo que genera Instagram, si lo hay.
    imagen.alt = String(noticia.alt ?? "").trim();
  } else {
    marco?.remove();
  }

  const enlace = nodo.querySelector("[data-enlace]");
  if (enlace) {
    if (esEnlaceSeguro(noticia.url) && /^https:\/\/www\.instagram\.com\//.test(noticia.url)) {
      enlace.href = noticia.url;
      enlace.setAttribute("aria-label", `Ver en Instagram la publicación${legible ? ` del ${legible}` : ""} (se abre en una pestaña nueva)`);
    } else {
      enlace.remove();
    }
  }

  return nodo;
}

async function traerNoticias() {
  const respuesta = await fetch(ARCHIVO, {
    headers: { Accept: "application/json" },
    cache: "no-cache",
    signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
  });
  // 404 = la sincronización todavía no corrió nunca. No es un error.
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`Respondió ${respuesta.status}`);

  const datos = await respuesta.json();
  // Se acepta la lista sola o el objeto { actualizado, noticias }.
  const lista = Array.isArray(datos) ? datos : datos?.noticias;
  return Array.isArray(lista) ? lista : [];
}

/**
 * Pinta la grilla de noticias. Devuelve la promesa de la carga, o null si la
 * página no tiene grilla (así main.js sabe si hace falta el loader).
 */
export function cargarNoticias() {
  const grilla = document.getElementById("noticias-grid");
  const plantilla = document.getElementById("tpl-noticia");
  if (!grilla || !plantilla) return null;

  return (async () => {
    try {
      const noticias = await traerNoticias();
      if (!noticias?.length) {
        // Sin archivo o sin publicaciones: se invita a ir a Instagram.
        mostrar("noticias-sin-configurar", true);
        return;
      }
      grilla.replaceChildren(...noticias.map((n) => tarjetaNoticia(n, plantilla)));
      mostrar("noticias-lista", true);
    } catch (error) {
      console.warn("No se pudieron cargar las noticias:", error.message);
      mostrar("noticias-error", true);
    } finally {
      mostrar("noticias-skeleton", false);
    }
  })();
}
