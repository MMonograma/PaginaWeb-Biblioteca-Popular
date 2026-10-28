// ---------------------------------------------------------------------------
// GET /api/catalogo?q=...&idx=ti|au|su|nb&offset=0
//
// Busca en DigiBepé (Koha de CONABIP) desde el servidor y devuelve JSON.
// La página de Catálogo muestra los resultados ahí mismo, sin mandar a la
// gente a 4124.bepe.ar (que es HTTP, con certificado inválido y suele dar 503).
//
// Si DigiBepé no responde, busca en el catálogo de respaldo (la hoja de
// Google publicada como CSV, ver lib/catalogo-respaldo.js) y lo avisa con
// "respaldo" en la respuesta, para que la página lo diga.
// ---------------------------------------------------------------------------

import { BIBLIOTECA } from "../src/datos/sitio.js";
import { buscarEnKoha, INDICES_VALIDOS, POR_PAGINA } from "../lib/koha.js";
import { buscarEnRespaldo } from "../lib/catalogo-respaldo.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const idx = url.searchParams.get("idx") ?? "";
  const offset = Math.max(0, Math.min(2000, Number(url.searchParams.get("offset")) || 0));

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (q.length < 2 || !INDICES_VALIDOS.has(idx)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Escribí al menos dos letras para buscar." }));
    return;
  }

  const base = BIBLIOTECA.conabip.catalogoBusqueda;
  if (!BIBLIOTECA.conabip.catalogoDisponible || !base) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "El catálogo en línea todavía no está disponible." }));
    return;
  }

  try {
    const { total, items } = await buscarEnKoha({ base, q, idx, offset });
    // Vercel guarda la respuesta 10 minutos: la misma búsqueda no vuelve a
    // golpear el catálogo de CONABIP, y si se cae un rato se sigue sirviendo.
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    res.end(JSON.stringify({ q, idx, offset, porPagina: POR_PAGINA, total: total ?? items.length, items }));
  } catch (e) {
    const caido = e.name === "TimeoutError" || e.status >= 500 || e.cause;

    // DigiBepé no anda: se busca en la hoja de respaldo.
    const respaldo = BIBLIOTECA.conabip.catalogoRespaldo;
    if (respaldo) {
      try {
        const r = await buscarEnRespaldo({ url: respaldo, q, idx, offset });
        // Caché corta: apenas DigiBepé vuelva, la búsqueda tiene que ir allá.
        res.setHeader("Cache-Control", "public, s-maxage=120");
        res.end(JSON.stringify({
          q, idx, offset, porPagina: POR_PAGINA, total: r.total, items: r.items,
          respaldo: { actualizado: r.actualizado },
        }));
        return;
      } catch {
        // Tampoco anduvo la hoja: sigue el aviso de error de siempre.
      }
    }

    res.statusCode = 502;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
      error: caido
        ? "El catálogo de CONABIP no está respondiendo en este momento. Probá de nuevo en unos minutos."
        : "No pudimos completar la búsqueda.",
    }));
  }
}
