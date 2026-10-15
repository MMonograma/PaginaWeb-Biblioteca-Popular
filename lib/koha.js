// ---------------------------------------------------------------------------
// LECTURA DEL CATÁLOGO DIGIBEPÉ (KOHA) DESDE EL SERVIDOR
//
// El navegador no puede consultar http://4124.bepe.ar: el sitio es HTTPS y el
// catálogo solo HTTP (y su certificado es de otro dominio). Por eso la
// búsqueda la hace una función de Vercel (api/catalogo.js), que sí puede
// pedir HTTP, y le devuelve al navegador un JSON limpio.
//
// Se pide el resultado en formato RSS (format=rss), que Koha arma siempre
// igual en todas las versiones y es mucho más estable que el HTML. Si el RSS
// no trae nada reconocible, se intenta leer la página HTML de resultados.
// Sin dependencias: solo fetch y expresiones regulares tolerantes.
// ---------------------------------------------------------------------------

const TIEMPO_MAXIMO_MS = 8000;
export const POR_PAGINA = 20;
export const INDICES_VALIDOS = new Set(["", "ti", "au", "su", "nb"]);

// --- Utilidades de texto ----------------------------------------------------

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodificar(s = "") {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);
}

const sinEtiquetas = (s = "") => decodificar(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// MARC deja puntuación al final de cada campo ("Ladrilleros /", "Buenos Aires :").
const limpiarPuntuacion = (s = "") => s.replace(/[\s/:;,.=]+$/, "").replace(/^\s*[[(]?\s*/, "").trim();

// "Almada, Selva, 1973-" -> "Selva Almada"
export function nombreNatural(autor = "") {
  const limpio = limpiarPuntuacion(autor.replace(/,?\s*\d{4}-?(\d{4})?\.?$/, ""));
  const partes = limpio.split(/\s*,\s*/);
  return partes.length === 2 && partes[1] ? `${partes[1]} ${partes[0]}` : limpio;
}

const etiqueta = (bloque, nombre) => {
  const m = bloque.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, "i"));
  return m ? m[1] : "";
};

// ISBN-10 o ISBN-13 válido en cualquier parte del texto.
export function extraerISBN(texto = "") {
  const m = String(texto).replace(/-/g, "").match(/\b(97[89]\d{10}|\d{9}[\dXx])\b/);
  return m ? m[1].toUpperCase() : null;
}

// --- RSS ----------------------------------------------------------------------

export function leerRSS(xml) {
  const total = Number(decodificar(etiqueta(xml, "opensearch:totalResults")).trim()) || null;
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([, it]) => {
    const enlace = decodificar(etiqueta(it, "link")).trim() || decodificar(etiqueta(it, "guid")).trim();
    const biblio = enlace.match(/biblionumber=(\d+)/)?.[1] ?? null;
    const descripcionHTML = decodificar(etiqueta(it, "description"));
    const descripcion = sinEtiquetas(descripcionHTML);

    // Koha escribe "Por Almada, Selva." (o "By ...") al comienzo de la descripción.
    const autorTexto =
      sinEtiquetas(etiqueta(it, "dc:creator")) ||
      sinEtiquetas(etiqueta(it, "author")) ||
      (descripcion.match(/^(?:Por|By|De)\s+(.+?)(?:\.\s|$)/i)?.[1] ?? "");

    const paginas = descripcion.match(/(\d+)\s*(?:p\.|páginas|pages|h\.)/i)?.[1] ?? null;
    // Pie de imprenta MARC: "Buenos Aires : Random House, 2013".
    // El año sale de ahí y no del primer número de 4 cifras: el autor puede
    // traer su año de nacimiento ("Almada, Selva, 1973-").
    const imprenta = descripcion.match(/:\s*([^:;,]+?),\s*(?:c|©)?\s*(1[5-9]\d{2}|20\d{2})/);
    const editorial = imprenta?.[1] ?? null;
    const anio = imprenta?.[2] ?? [...descripcion.matchAll(/\b(1[5-9]\d{2}|20\d{2})\b(?!-)/g)].pop()?.[1] ?? null;

    return {
      id: biblio ? `koha-${biblio}` : null,
      biblionumber: biblio,
      titulo: limpiarPuntuacion(sinEtiquetas(etiqueta(it, "title"))),
      autor: autorTexto ? nombreNatural(autorTexto) : "",
      isbn: extraerISBN(sinEtiquetas(etiqueta(it, "dc:identifier"))) ?? extraerISBN(descripcion),
      anio: anio ? Number(anio) : null,
      paginas: paginas ? Number(paginas) : null,
      editorial: editorial ? limpiarPuntuacion(editorial) : null,
      disponibilidad: leerDisponibilidad(descripcion),
    };
  });
  return { total, items: items.filter((i) => i.titulo) };
}

// --- HTML (respaldo) --------------------------------------------------------
// Resultados de opac-search.pl: cada título es un <a class="title"> que apunta
// a opac-detail.pl?biblionumber=N. El resto se busca cerca de ese enlace.

export function leerHTML(html) {
  const total = Number(html.match(/(\d[\d.]*)\s+resultados?/i)?.[1]?.replace(/\./g, "")) || null;
  const filas = html.split(/<td[^>]*class="[^"]*bibliocol[^"]*"/i).slice(1);
  const bloques = filas.length ? filas : html.split(/(?=<a[^>]+opac-detail\.pl\?biblionumber=\d+[^>]*class="[^"]*title)/i).slice(1);

  const items = bloques.map((b) => {
    const enlace = b.match(/<a[^>]+href="[^"]*opac-detail\.pl\?biblionumber=(\d+)[^"]*"[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      ?? b.match(/<a[^>]+class="[^"]*title[^"]*"[^>]*href="[^"]*opac-detail\.pl\?biblionumber=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!enlace) return null;
    const autor = sinEtiquetas(b.match(/class="[^"]*author[^"]*"[^>]*>([\s\S]*?)<\/(?:ul|span|li|a)>/i)?.[1] ?? "")
      .replace(/^(Por|By|de):?\s*/i, "");
    const editorial = sinEtiquetas(b.match(/class="[^"]*publisher[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>|class="[^"]*publisher[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.slice(1).find(Boolean) ?? "")
      .replace(/^(Editor|Detalles de publicación|Publication details):?\s*/i, "");
    const disp = sinEtiquetas(b.match(/class="[^"]*availability[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>|class="[^"]*availability[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.slice(1).find(Boolean) ?? "");
    const anio = editorial.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1] ?? null;
    return {
      id: `koha-${enlace[1]}`,
      biblionumber: enlace[1],
      titulo: limpiarPuntuacion(sinEtiquetas(enlace[2])),
      autor: autor ? nombreNatural(autor) : "",
      isbn: extraerISBN(b.match(/isbn[^0-9]{0,20}([\d-]{10,17}[\dXx]?)/i)?.[1] ?? ""),
      anio: anio ? Number(anio) : null,
      paginas: null,
      editorial: editorial ? limpiarPuntuacion(editorial.replace(/\b(1[5-9]\d{2}|20\d{2})\b.*$/, "")) || null : null,
      disponibilidad: leerDisponibilidad(disp),
    };
  });
  return { total, items: items.filter(Boolean).filter((i) => i.titulo) };
}

// Si hay un único resultado, Koha a veces salta directo a la ficha del libro.
export function leerFicha(html, biblionumber) {
  const titulo = limpiarPuntuacion(sinEtiquetas(html.match(/<h[12][^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ?? ""));
  if (!titulo) return { total: 0, items: [] };
  const autor = sinEtiquetas(html.match(/class="[^"]*author[^"]*"[^>]*>([\s\S]*?)<\/(?:h5|ul|span|li)>/i)?.[1] ?? "").replace(/^(Por|By|de):?\s*/i, "");
  return {
    total: 1,
    items: [{
      id: `koha-${biblionumber}`, biblionumber, titulo,
      autor: autor ? nombreNatural(autor) : "",
      isbn: extraerISBN(html.match(/isbn[\s\S]{0,80}?([\d-]{10,17}[\dXx]?)/i)?.[1] ?? ""),
      anio: null, paginas: null, editorial: null,
      disponibilidad: leerDisponibilidad(sinEtiquetas(html.match(/<table[^>]*id="holdingst"[\s\S]*?<\/table>/i)?.[0] ?? "")),
    }],
  };
}

// "Ejemplares disponibles para préstamo: Biblioteca (2)" -> "disponible"
// "No hay ejemplares disponibles" / "Prestado" -> "prestado". Si no se sabe, null.
export function leerDisponibilidad(texto = "") {
  const t = texto.toLowerCase();
  if (!t) return null;
  if (/no hay ejemplares disponibles|no items available|no disponible/.test(t)) return "prestado";
  if (/disponibles? para pr[eé]stamo|items available|disponible/.test(t)) return "disponible";
  if (/prestado|checked out|en pr[eé]stamo/.test(t)) return "prestado";
  return null;
}

// --- Consulta ---------------------------------------------------------------

export async function buscarEnKoha({ base, q, idx = "", offset = 0 }) {
  const url = new URL(base);
  url.searchParams.set("q", q);
  if (idx) url.searchParams.set("idx", idx);
  if (offset) url.searchParams.set("offset", String(offset));
  url.searchParams.set("format", "rss");

  const respuesta = await fetch(url, {
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    headers: { "User-Agent": "BibliotecaEdgarMorisoli-Web/1.0 (+https://bibliotecapopularedgarmorisoli.com.ar)" },
    redirect: "follow",
  });
  if (!respuesta.ok) {
    const error = new Error(`El catálogo respondió ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  const texto = await respuesta.text();

  const biblioFicha = respuesta.url.match(/opac-detail\.pl\?biblionumber=(\d+)/)?.[1];
  if (biblioFicha) return leerFicha(texto, biblioFicha);

  let resultado = /<rss|<channel/i.test(texto) ? leerRSS(texto) : { total: null, items: [] };
  if (!resultado.items.length && /<html/i.test(texto)) resultado = leerHTML(texto);
  return resultado;
}
