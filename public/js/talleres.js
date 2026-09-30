// ---------------------------------------------------------------------------
// TALLERES — leídos en vivo desde Google Sheets.
//
// Cada vez que alguien abre la página, el navegador pide el CSV publicado de
// la planilla, lo convierte en objetos y arma una tarjeta por fila.
// Si la planilla cambia, alcanza con recargar: no hay que volver a publicar
// el sitio.
//
// Columnas de la hoja (fila 1):
//   id | activo | titulo | categoria | dias_horarios | tallerista |
//   descripcion | foto_url | contacto_wsp
//
// El marcado de cada tarjeta vive en un <template> del HTML. Todo lo que
// llega de la hoja se inserta con textContent; las URL pasan antes por los
// validadores de fuente-datos.js.
// ---------------------------------------------------------------------------

import { BIBLIOTECA, HOJA_TALLERES_CSV, TALLERES_RESPALDO } from "./datos.js";
import { filasAObjetos, normalizarFila } from "./csv.js";
import { urlDeImagen } from "./fuente-datos.js";

const FOTO_PREDETERMINADA = "assets/img/taller-predeterminado.svg";
const ESPERA_MAXIMA_MS = 8000;

// Qué cuenta como "sí" en la columna activo. Cualquier otra cosa (NO, vacío,
// "pausado"...) oculta el taller sin tener que borrar la fila.
const AFIRMATIVOS = new Set(["si", "sí", "s", "x", "yes", "true", "1"]);

const mostrar = (id, visible) => document.getElementById(id)?.classList.toggle("hidden", !visible);

// --- De la fila de la hoja a un taller --------------------------------------

/**
 * Número de WhatsApp en el formato que pide wa.me: sólo dígitos, con código
 * de país. Acepta lo que alguien escribiría en una planilla:
 *   "+54 9 2954 61-0340"  → 5492954610340
 *   "2954610340"          → 5492954610340  (10 dígitos: se completa el 549)
 * Si la celda está vacía o no se entiende, se usa el WhatsApp general.
 */
function numeroWhatsApp(valor) {
  const texto = String(valor ?? "").trim();
  // Un número largo escrito en una celda con formato numérico puede llegar
  // como "5,49E+12": ya perdió dígitos y no se puede recuperar.
  if (/e\+/i.test(texto)) {
    console.warn(`contacto_wsp "${texto}" llegó en notación científica. Poné la columna en formato Texto sin formato.`);
    return BIBLIOTECA.contacto.whatsapp;
  }

  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "");
  if (digitos.startsWith("54") && digitos.length >= 12) return digitos;
  if (digitos.length === 10) return `549${digitos}`;
  return BIBLIOTECA.contacto.whatsapp;
}

function enlaceWhatsApp(numero, titulo) {
  const mensaje = `¡Hola! Quisiera consultar por el taller de ${titulo} en la Biblioteca.`;
  // encodeURIComponent: los espacios, tildes y signos del mensaje tienen que
  // viajar codificados dentro de la URL o el enlace se corta.
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

const estaActivo = (fila) => !("activo" in fila) || AFIRMATIVOS.has(fila.activo.toLowerCase());

// Las claves ya vienen normalizadas: "dias_horarios" → "diashorarios".
// Se aceptan también los nombres de la hoja anterior (nombre, horario,
// docente, imagen) para que una planilla vieja no deje de funcionar.
function aTaller(fila) {
  return {
    titulo: fila.titulo || fila.nombre || "",
    categoria: fila.categoria || "",
    horario: fila.diashorarios || fila.horario || "",
    tallerista: fila.tallerista || fila.docente || "",
    descripcion: fila.descripcion || "",
    foto: urlDeImagen(fila.fotourl || fila.imagen),
    whatsapp: numeroWhatsApp(fila.contactowsp),
  };
}

const prepararTalleres = (filas) => filas.filter(estaActivo).map(aTaller).filter((t) => t.titulo);

// --- Lectura de la planilla -------------------------------------------------

async function traerTalleres() {
  if (!HOJA_TALLERES_CSV) {
    console.info("HOJA_TALLERES_CSV está vacía en src/datos/sitio.js: se muestran los talleres de respaldo.");
    return { talleres: prepararTalleres(TALLERES_RESPALDO.map(normalizarFila)), respaldo: true };
  }

  // cache: "no-cache" = el navegador pregunta siempre si hay versión nueva,
  // en vez de mostrar una copia guardada de la visita anterior.
  const respuesta = await fetch(HOJA_TALLERES_CSV, {
    cache: "no-cache",
    signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
  });
  if (!respuesta.ok) throw new Error(`Google respondió ${respuesta.status}`);

  const texto = await respuesta.text();
  // Si la hoja se despublica, Google devuelve una página HTML en vez del CSV.
  if (/^\s*</.test(texto)) throw new Error("La hoja no devolvió un CSV (¿se dejó de publicar?)");

  return { talleres: prepararTalleres(filasAObjetos(texto)), respaldo: false };
}

// --- Tarjetas ---------------------------------------------------------------

// Pone el texto si hay dato; si no, saca el elemento (o su fila completa)
// para no dejar huecos.
function texto(nodo, selector, valor) {
  const el = nodo.querySelector(selector);
  if (!el) return;
  const limpio = String(valor ?? "").trim();
  if (!limpio) {
    (el.closest("[data-fila]") ?? el).remove();
    return;
  }
  el.textContent = limpio;
}

function tarjetaTaller(taller, plantilla) {
  const nodo = plantilla.content.cloneNode(true);

  texto(nodo, "[data-categoria]", taller.categoria);
  texto(nodo, "[data-titulo]", taller.titulo);
  texto(nodo, "[data-horario]", taller.horario);
  texto(nodo, "[data-tallerista]", taller.tallerista && `A cargo de ${taller.tallerista}`);
  texto(nodo, "[data-descripcion]", taller.descripcion);

  const foto = nodo.querySelector("[data-foto]");
  if (foto) {
    // La imagen por defecto ya está en el HTML: sólo se cambia si hay foto.
    // Si la foto falla (enlace roto, archivo privado), vuelve a la de defecto.
    if (taller.foto) {
      foto.addEventListener("error", () => { foto.src = FOTO_PREDETERMINADA; foto.alt = ""; }, { once: true });
      foto.src = taller.foto;
      foto.alt = `Foto del taller ${taller.titulo}`;
    }
  }

  const wa = nodo.querySelector("[data-wa]");
  if (wa) {
    wa.href = enlaceWhatsApp(taller.whatsapp, taller.titulo);
    wa.setAttribute("aria-label", `Consultar por WhatsApp sobre el taller ${taller.titulo} (se abre en una pestaña nueva)`);
  }

  return nodo;
}

function renderTalleres(talleres, grilla, plantilla) {
  grilla.replaceChildren(...talleres.map((t) => tarjetaTaller(t, plantilla)));
}

// --- Punto de entrada -------------------------------------------------------

/**
 * Carga los talleres en una grilla. Devuelve la promesa de la carga, o null si
 * la página no tiene esa grilla (así main.js sabe si hace falta el loader).
 */
export function cargarTalleres({ grilla, plantilla, skeleton, limite = 0 } = {}) {
  const contenedor = document.getElementById(grilla);
  const molde = document.getElementById(plantilla);
  if (!contenedor || !molde) return null;

  const recortar = (lista) => (limite ? lista.slice(0, limite) : lista);

  return (async () => {
    try {
      const { talleres } = await traerTalleres();
      // Una hoja sin filas activas se trata como "sin datos": mejor mostrar
      // el respaldo que una sección vacía.
      const lista = talleres.length ? talleres : prepararTalleres(TALLERES_RESPALDO.map(normalizarFila));
      renderTalleres(recortar(lista), contenedor, molde);
    } catch (error) {
      console.warn("No se pudieron cargar los talleres:", error.message);
      renderTalleres(recortar(prepararTalleres(TALLERES_RESPALDO.map(normalizarFila))), contenedor, molde);
      mostrar("talleres-aviso", true);
    } finally {
      if (skeleton) mostrar(skeleton, false);
    }
  })();
}
