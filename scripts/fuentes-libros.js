// ---------------------------------------------------------------------------
// FUENTES DE DATOS DE LIBROS (portada, sinopsis, editorial, año, páginas)
//
// Lo usa scripts/buscar-libros.js. No depende de nada: solo fetch, que viene
// con Node 18 o más nuevo.
//
// Por qué se busca por TÍTULO + AUTOR y no por ISBN: los ISBN que estaban
// cargados apuntaban a otros libros (el de «Ladrilleros» traía una novela de
// Petros Márkaris y el de «El resplandor», la tapa de «It»). Ahora cada
// resultado tiene que coincidir en título y en apellido del autor; si no
// coincide, se descarta y el libro queda con la tapa de diseño.
//
// Orden de consulta:
//   1. Google Books — mejor cobertura de ediciones en castellano y sinopsis
//      en español. Sin API key usa una cuota compartida que suele estar
//      agotada; con GOOGLE_BOOKS_API_KEY funciona bien (es gratuita).
//   2. Open Library — siempre disponible; completa lo que falte.
// ---------------------------------------------------------------------------

export const normalizar = (s = "") =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // "It (Eso)" -> "it"
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Variantes del título para comparar: "It (Eso)" acepta "It" y "Eso".
function variantesTitulo(titulo) {
  const vars = new Set([normalizar(titulo)]);
  const entre = String(titulo).match(/\(([^)]+)\)/);
  if (entre) vars.add(normalizar(entre[1]));
  return [...vars].filter(Boolean);
}

// Tiene que coincidir el título completo, o el título sin subtítulo
// ("Ladrilleros / Brickmakers", "It: Eso"). No alcanza con que empiece igual:
// "La asistenta" no puede quedarse con la tapa de "La asistenta te vigila".
function coincideTitulo(buscado, encontrado) {
  if (!encontrado) return false;
  const opciones = new Set([normalizar(encontrado)]);
  for (const parte of String(encontrado).split(/\s*[:/]\s*|\s+[-–—]\s+/)) opciones.add(normalizar(parte));
  return variantesTitulo(buscado).some((v) => opciones.has(v));
}

function coincideAutor(buscado, autores = []) {
  const partes = normalizar(buscado).split(" ").filter((p) => p.length > 2);
  const apellido = partes[partes.length - 1];
  if (!apellido) return true;
  return autores.some((a) => normalizar(a).includes(apellido));
}

const limpiarTexto = (s = "") =>
  String(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const anioDe = (fecha) => {
  const m = String(fecha ?? "").match(/\d{4}/);
  return m ? Number(m[0]) : null;
};

async function pedirJSON(url) {
  // Open Library a veces tarda o se cae: sin límite de tiempo el script
  // quedaría colgado (y en Vercel, el deploy).
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) {
    // Google explica el problema en el cuerpo ("API key not valid", "Daily
    // limit exceeded", "unknownLocation"...). Se muestra ese texto, nunca la
    // URL: lleva la API key.
    let detalle = "";
    try {
      const cuerpo = await r.json();
      detalle = cuerpo?.error?.message ?? cuerpo?.error?.errors?.[0]?.reason ?? "";
    } catch {
      // El cuerpo no era JSON.
    }
    const error = new Error(`HTTP ${r.status} en ${new URL(url).host}${detalle ? `: ${detalle}` : ""}`);
    error.status = r.status;
    throw error;
  }
  return r.json();
}

// Google Books filtra resultados por país y, desde servidores en la nube
// (Vercel), a veces no puede deducirlo y responde vacío o con error
// "unknownLocation". Indicar el país lo evita.
function paramsGoogle(base, apiKey) {
  const params = new URLSearchParams({ ...base, country: "AR" });
  if (apiKey) params.set("key", apiKey);
  return params;
}

// --- Google Books -----------------------------------------------------------

export async function buscarEnGoogleBooks(libro, { apiKey } = {}) {
  const termino = libro.buscarComo ?? libro.titulo;
  const apellido = normalizar(libro.autor).split(" ").pop();
  const q = `intitle:${termino} inauthor:${apellido}`;
  const params = paramsGoogle({ q, maxResults: "20", printType: "books" }, apiKey);
  const datos = await pedirJSON(`https://www.googleapis.com/books/v1/volumes?${params}`);

  const candidatos = (datos.items ?? [])
    .map((item) => item.volumeInfo ?? {})
    .filter((v) => coincideTitulo(termino, v.title) && coincideAutor(libro.autor, v.authors));
  if (!candidatos.length) return null;

  // Puntaje: castellano, con tapa y con sinopsis primero.
  const puntaje = (v) =>
    (v.language === "es" ? 4 : 0) + (v.imageLinks?.thumbnail ? 3 : 0) + (v.description ? 2 : 0);
  candidatos.sort((a, b) => puntaje(b) - puntaje(a));

  const conTapa = candidatos.find((v) => v.imageLinks?.thumbnail);
  const conSinopsis =
    candidatos.find((v) => v.description && v.language === "es") ?? candidatos.find((v) => v.description);
  const mejor = conTapa ?? candidatos[0];

  const isbn = (mejor.industryIdentifiers ?? []).find((i) => i.type === "ISBN_13")?.identifier ?? null;
  const portada = conTapa
    ? conTapa.imageLinks.thumbnail.replace(/^http:/, "https:").replace(/&edge=curl/, "")
    : null;

  return {
    portada,
    sinopsis: conSinopsis ? limpiarTexto(conSinopsis.description) : null,
    editorial: mejor.publisher ?? null,
    anio: anioDe(mejor.publishedDate),
    paginas: mejor.pageCount || null,
    isbn,
    fuente: "Google Books",
  };
}

// --- Open Library -----------------------------------------------------------

export async function buscarEnOpenLibrary(libro) {
  const termino = libro.buscarComo ?? libro.titulo;
  const campos = "key,title,author_name,cover_i,first_publish_year,number_of_pages_median,publisher,isbn,language";
  const consultas = [
    new URLSearchParams({ title: termino, author: libro.autor, lang: "es", limit: "10", fields: campos }),
    new URLSearchParams({ q: `${termino} ${libro.autor}`, lang: "es", limit: "10", fields: campos }),
  ];

  let docs = [];
  for (const params of consultas) {
    const datos = await pedirJSON(`https://openlibrary.org/search.json?${params}`);
    docs = (datos.docs ?? []).filter(
      (d) => coincideTitulo(termino, d.title) && coincideAutor(libro.autor, d.author_name)
    );
    if (docs.length) break;
  }
  if (!docs.length) return null;

  const puntaje = (d) => (d.cover_i ? 3 : 0) + ((d.language ?? []).includes("spa") ? 2 : 0);
  docs.sort((a, b) => puntaje(b) - puntaje(a));
  const doc = docs[0];

  // La sinopsis vive en la ficha de la obra, no en la búsqueda.
  let sinopsis = null;
  try {
    const obra = await pedirJSON(`https://openlibrary.org${doc.key}.json`);
    const desc = typeof obra.description === "string" ? obra.description : obra.description?.value;
    if (desc) sinopsis = limpiarTexto(desc.split(/\n-{3,}|\(\[source\]/)[0]);
  } catch {
    // Sin sinopsis: no es grave.
  }

  return {
    portada: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    sinopsis,
    editorial: doc.publisher?.[0] ?? null,
    anio: doc.first_publish_year ?? null,
    paginas: doc.number_of_pages_median ?? null,
    isbn: (doc.isbn ?? []).find((i) => i.length === 13) ?? null,
    fuente: "Open Library",
  };
}

// --- Búsqueda por ISBN -------------------------------------------------------
// Para libros que vienen del catálogo de la biblioteca: el ISBN es el de su
// propio registro, así que la tapa corresponde a la edición que tienen.

export async function buscarPorISBN(isbn, { apiKey, avisos = [] } = {}) {
  const params = paramsGoogle({ q: `isbn:${isbn}`, maxResults: "3" }, apiKey);
  let v = null;
  try {
    const datos = await pedirJSON(`https://www.googleapis.com/books/v1/volumes?${params}`);
    v = datos.items?.[0]?.volumeInfo ?? null;
  } catch (e) {
    avisos.push(`Google Books: ${e.message}`);
  }
  if (v) {
    return {
      portada: v.imageLinks?.thumbnail?.replace(/^http:/, "https:").replace(/&edge=curl/, "") ?? null,
      sinopsis: v.description ? limpiarTexto(v.description) : null,
      editorial: v.publisher ?? null,
      anio: anioDe(v.publishedDate),
      paginas: v.pageCount || null,
      isbn,
      fuentes: v.description ? ["Google Books"] : null,
    };
  }
  try {
    const d = await pedirJSON(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const libro = d[`ISBN:${isbn}`];
    if (!libro) return null;
    return {
      portada: libro.cover?.large ?? libro.cover?.medium ?? null,
      sinopsis: null,
      editorial: libro.publishers?.[0]?.name ?? null,
      anio: anioDe(libro.publish_date),
      paginas: libro.number_of_pages ?? null,
      isbn,
      fuentes: null,
    };
  } catch {
    return null;
  }
}

// --- Combinación ------------------------------------------------------------
// Google manda; Open Library rellena los huecos. Cada campo sabe de dónde vino.

export async function buscarLibro(libro, opciones = {}) {
  const resultados = [];
  const avisos = [];
  const consultas = [
    ["Google Books", buscarEnGoogleBooks],
    ["Open Library", buscarEnOpenLibrary],
  ].filter(([nombre]) => !opciones.soloGoogle || nombre === "Google Books");
  for (const [nombre, fn] of consultas) {
    try {
      const r = await fn(libro, opciones);
      if (r) resultados.push(r);
    } catch (e) {
      avisos.push(`${nombre}: ${e.message}`);
    }
  }

  const final = { portada: null, sinopsis: null, editorial: null, anio: null, paginas: null, isbn: null };
  const fuentes = new Set();
  for (const r of resultados) {
    for (const campo of Object.keys(final)) {
      if (final[campo] == null && r[campo] != null) {
        final[campo] = r[campo];
        if (campo === "portada" || campo === "sinopsis") fuentes.add(r.fuente);
      }
    }
  }
  return { ...final, fuentes: [...fuentes], avisos };
}

export const claveLibro = (libro) => `${normalizar(libro.titulo)}|${normalizar(libro.autor)}`;
