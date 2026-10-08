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

// "proximamente" (o "en construccion") en la columna activo = el taller se
// muestra como anticipo: tarjeta de "Próximamente", sin horario ni WhatsApp.
const sinTildes = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const PALABRAS_PROXIMAMENTE = /proximamente|en construccion|en preparacion/;

const estaActivo = (fila) =>
  !("activo" in fila) || AFIRMATIVOS.has(fila.activo.toLowerCase()) || PALABRAS_PROXIMAMENTE.test(sinTildes(fila.activo));

// Textos de la fila de ejemplo de la planilla ("TITULO", "Nombre de
// Tallerista", "Descripcion"...). Si una celda trae sólo eso, se toma como
// vacía: así una fila de plantilla nunca se publica como si fuera un taller.
const TEXTOS_DE_EJEMPLO = new Set([
  "titulo", "categoria", "categorias", "horario", "horarios", "dias y horarios", "dias_horarios",
  "tallerista", "nombre de tallerista", "nombre del tallerista", "descripcion", "foto", "foto_url",
  "contacto", "contacto_wsp", "-", "x",
]);
const real = (valor) => {
  const v = String(valor ?? "").trim();
  return TEXTOS_DE_EJEMPLO.has(sinTildes(v)) ? "" : v;
};

// Saca del título las marcas de "en construcción" y la palabra de ejemplo
// "TITULO": "TITULO - En Construccion" queda vacío, "Ajedrez (próximamente)"
// queda "Ajedrez".
function limpiarTitulo(titulo) {
  return real(
    String(titulo ?? "")
      .replace(/[-–—(]*\s*(pr[oó]ximamente|en construcci[oó]n|en preparaci[oó]n)\s*\)?/gi, "")
      .replace(/^\s*t[ií]tulo\b\s*[-–—:]?\s*/i, "")
      .trim()
  );
}

// Las claves ya vienen normalizadas: "dias_horarios" → "diashorarios".
// Se aceptan también los nombres de la hoja anterior (nombre, horario,
// docente, imagen) para que una planilla vieja no deje de funcionar.
function aTaller(fila) {
  const tituloOriginal = fila.titulo || fila.nombre || "";
  const titulo = limpiarTitulo(tituloOriginal);
  // Es un anticipo si la hoja lo marca así, o si es la fila de ejemplo de la
  // planilla (título vacío después de limpiar "TITULO - En Construccion").
  const proximamente =
    PALABRAS_PROXIMAMENTE.test(sinTildes(fila.activo)) ||
    PALABRAS_PROXIMAMENTE.test(sinTildes(tituloOriginal)) ||
    (!titulo && Boolean(tituloOriginal.trim()));

  return {
    titulo,
    proximamente,
    categoria: real(fila.categoria),
    horario: real(fila.diashorarios || fila.horario),
    tallerista: real(fila.tallerista || fila.docente),
    descripcion: real(fila.descripcion),
    foto: urlDeImagen(real(fila.fotourl || fila.imagen)),
    whatsapp: numeroWhatsApp(fila.contactowsp),
  };
}

// Los talleres confirmados primero; los anticipos ("Próximamente") al final.
const prepararTalleres = (filas) =>
  filas
    .filter(estaActivo)
    .map(aTaller)
    .filter((t) => t.titulo || t.proximamente)
    .sort((a, b) => Number(a.proximamente) - Number(b.proximamente));

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
  if (taller.proximamente) return tarjetaProximamente(taller, nodo);

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

// Anticipo de un taller que todavía no arrancó (o fila de ejemplo de la hoja):
// misma tarjeta, pero con la etiqueta "Próximamente", sin horario, sin
// tallerista de ejemplo y sin botón de WhatsApp.
function tarjetaProximamente(taller, nodo) {
  const etiqueta = nodo.querySelector("[data-categoria]");
  if (etiqueta) {
    etiqueta.className = "badge-proximamente mb-3 self-start";
    etiqueta.textContent = "Próximamente";
  }
  texto(nodo, "[data-titulo]", taller.titulo || "Nuevo taller");
  texto(nodo, "[data-horario]", "");
  texto(nodo, "[data-tallerista]", taller.tallerista && `A cargo de ${taller.tallerista}`);
  texto(
    nodo,
    "[data-descripcion]",
    taller.descripcion || "Estamos preparando una nueva propuesta. Muy pronto vas a encontrar acá los días y horarios."
  );

  const foto = nodo.querySelector("[data-foto]");
  if (foto && taller.foto) {
    foto.addEventListener("error", () => { foto.src = FOTO_PREDETERMINADA; foto.alt = ""; }, { once: true });
    foto.src = taller.foto;
    foto.alt = `Foto del taller ${taller.titulo}`;
  }

  // El botón vive solo o dentro de un contenedor propio: se saca el que lo envuelve.
  const wa = nodo.querySelector("[data-wa]");
  (wa?.closest(".pt-6") ?? wa)?.remove();

  // Sin horario ni tallerista, la lista de datos queda vacía: se saca para
  // que no deje un hueco entre el título y la descripción.
  for (const dl of nodo.querySelectorAll("dl")) if (!dl.children.length) dl.remove();

  nodo.firstElementChild?.classList.add("border-dashed");
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
