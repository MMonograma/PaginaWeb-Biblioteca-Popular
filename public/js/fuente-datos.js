// ---------------------------------------------------------------------------
// VALIDACIÓN DE LO QUE LLEGA DE AFUERA
//
// Todo lo que viene de la planilla o de Instagram se inserta con textContent,
// que nunca interpreta HTML. Lo único que se usa como URL son enlaces e
// imágenes, y pasan por acá antes de tocar el DOM.
// ---------------------------------------------------------------------------

export const esEnlaceSeguro = (url) => /^https?:\/\//i.test(String(url ?? "").trim());

export const esImagenSegura = (url) => /^https:\/\//i.test(String(url ?? "").trim());

/**
 * Enlace de Google Drive → dirección directa de la imagen.
 *
 * El enlace que da Drive al compartir (drive.google.com/file/d/ID/view) abre
 * una página de vista previa, no la imagen: puesto en un <img> no muestra nada.
 * lh3.googleusercontent.com/d/ID es el servidor de imágenes de Google y
 * devuelve el archivo directo, ya optimizado.
 *
 * Reconoce las formas habituales:
 *   https://drive.google.com/file/d/ID/view?usp=sharing
 *   https://drive.google.com/open?id=ID
 *   https://drive.google.com/uc?id=ID&export=view
 * Cualquier otra URL https se usa tal cual. Si no hay nada usable, devuelve "".
 *
 * Ojo: la foto tiene que estar compartida como "Cualquier persona con el
 * enlace puede ver". Si es privada, Google no la entrega y se ve la imagen
 * por defecto.
 */
export function urlDeImagen(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";

  const drive = texto.match(/^https?:\/\/(?:drive|docs)\.google\.com\/.*?(?:\/d\/|[?&]id=)([\w-]{20,})/i);
  if (drive) return `https://lh3.googleusercontent.com/d/${drive[1]}`;

  return esImagenSegura(texto) ? texto : "";
}

/**
 * Fechas a texto legible.
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
