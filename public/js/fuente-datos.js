// ---------------------------------------------------------------------------
// OBTENCIÓN DE DATOS
//
// Único lugar que habla con la red. Las secciones piden datos acá y reciben
// siempre la misma forma: { configurada, items }.
// ---------------------------------------------------------------------------

/**
 * Pide una hoja a /api/hoja.
 * Si la función no existe (por ejemplo sirviendo public/ con `npx serve`),
 * se responde como "sin configurar" para que la página muestre el respaldo
 * en vez de un error que no le dice nada a quien visita.
 */
export async function traerHoja(nombre) {
  let respuesta;
  try {
    respuesta = await fetch(`/api/hoja?nombre=${encodeURIComponent(nombre)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new Error(`No se pudo conectar: ${error.message}`);
  }

  if (respuesta.status === 404) {
    console.info(`/api/hoja no está disponible (¿estás sirviendo sólo public/?). Se usa el contenido de respaldo.`);
    return { configurada: false, items: [] };
  }
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status}`);

  const datos = await respuesta.json();
  return { configurada: Boolean(datos.configurada), items: Array.isArray(datos.items) ? datos.items : [] };
}

// --- Validación de lo que llega de afuera ----------------------------------
// Todo lo que viene de la hoja se inserta con textContent. Lo único que se
// usa como URL son enlaces e imágenes, y se filtran acá.

export const esEnlaceSeguro = (url) => /^https?:\/\//i.test(String(url ?? "").trim());

export const esImagenSegura = (url) => /^https:\/\//i.test(String(url ?? "").trim());

/**
 * Convierte la URL de un video en su dirección para insertar.
 * Sólo se aceptan YouTube y Vimeo: si la hoja trae cualquier otra cosa,
 * no se inserta ningún iframe.
 */
export function urlDeVideo(url) {
  const texto = String(url ?? "").trim();
  if (!texto) return null;

  const youtube = texto.match(
    /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i
  );
  // youtube-nocookie: no deja cookies de seguimiento hasta que se reproduce.
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;

  const vimeo = texto.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}

/**
 * Fechas de la hoja a texto legible.
 * Acepta 2026-09-15 y 15/09/2026; si no entiende el formato, devuelve el
 * texto tal cual, porque puede ser algo como "Todos los martes".
 */
export function formatearFecha(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  let fecha = null;
  if (iso) fecha = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  else if (local) fecha = new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));

  if (!fecha || Number.isNaN(fecha.getTime())) return texto;

  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

/** La fecha en formato ISO para el atributo datetime de <time>. */
export function fechaISO(valor) {
  const texto = String(valor ?? "").trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return texto;
  const local = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return "";
}
