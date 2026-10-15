// ---------------------------------------------------------------------------
// GET /api/libro?isbn=...&titulo=...&autor=...
//
// Tapa y sinopsis de un libro que salió en una búsqueda del catálogo. Se pide
// recién cuando alguien abre la ficha, así se gasta una consulta por libro
// visto y no una por resultado.
//
// La API key de Google Books vive en una variable de entorno de Vercel
// (GOOGLE_BOOKS_API_KEY): nunca llega al navegador ni al repositorio.
// ---------------------------------------------------------------------------

import { buscarPorISBN, buscarLibro } from "../scripts/fuentes-libros.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const isbn = (url.searchParams.get("isbn") ?? "").replace(/[^0-9Xx]/g, "").slice(0, 13);
  const titulo = (url.searchParams.get("titulo") ?? "").trim().slice(0, 200);
  const autor = (url.searchParams.get("autor") ?? "").trim().slice(0, 120);
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || "";

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!isbn && !titulo) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Falta el ISBN o el título." }));
    return;
  }

  let datos = null;
  const avisos = [];
  try {
    if (isbn) datos = await buscarPorISBN(isbn, { apiKey, avisos });
    // Sin ISBN, o sin sinopsis para ese ISBN: se completa buscando por título y autor.
    if ((!datos || !datos.sinopsis) && titulo && autor) {
      const porTitulo = await buscarLibro({ titulo, autor }, { apiKey });
      avisos.push(...(porTitulo.avisos ?? []));
      datos = datos ?? {};
      for (const [campo, valor] of Object.entries(porTitulo)) {
        if (datos[campo] == null && valor != null) datos[campo] = valor;
      }
    }
  } catch {
    // Si Google y Open Library fallan, la ficha se muestra igual sin sinopsis.
  }

  const { avisos: _, ...limpio } = datos ?? {};
  // Un día en la caché de Vercel: cada libro se consulta, como mucho, una vez
  // por día. Si alguna fuente falló, no se guarda en caché para reintentar.
  const completo = datos && !avisos.length;
  res.setHeader("Cache-Control", completo ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store");
  // Los avisos (p. ej. "Google Books: HTTP 403 ...") sirven para diagnosticar
  // desde el navegador; no incluyen la API key.
  res.end(JSON.stringify({ ...limpio, ...(avisos.length ? { avisos } : {}) }));
}
