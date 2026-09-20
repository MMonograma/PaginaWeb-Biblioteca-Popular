// ---------------------------------------------------------------------------
// LECTURA DE LAS HOJAS DE CÁLCULO
//
// El navegador pide /api/hoja?nombre=noticias y esta función va a buscar el CSV
// publicado de Google, lo convierte en JSON y lo devuelve.
//
// Se hace del lado del servidor por tres motivos:
//   1. La CSP del sitio sólo permite conexiones a 'self'. Así no hay que
//      abrirla a docs.google.com.
//   2. Evita depender de que Google mande las cabeceras CORS correctas.
//   3. La respuesta se cachea en Vercel: muchas visitas, pocas consultas a Google.
//
// Las URL de las hojas se configuran como variables de entorno en Vercel:
//   SHEET_NOTICIAS y SHEET_TALLERES
// (Archivo > Compartir > Publicar en la web > CSV, y se pega la URL.)
// ---------------------------------------------------------------------------

import { filasAObjetos, estaPublicada, ordenar } from "./_csv.js";

const HOJAS = {
  noticias: process.env.SHEET_NOTICIAS,
  talleres: process.env.SHEET_TALLERES,
};

export default async function handler(req, res) {
  const nombre = String(req.query?.nombre ?? "");

  if (!Object.hasOwn(HOJAS, nombre)) {
    res.status(400).json({ error: "Hoja desconocida" });
    return;
  }

  const url = HOJAS[nombre];
  if (!url) {
    // Todavía no se configuró la hoja: no es un error, es que no hay fuente.
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.status(200).json({ configurada: false, items: [] });
    return;
  }

  try {
    const respuesta = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) throw new Error(`La hoja respondió ${respuesta.status}`);

    const items = ordenar(filasAObjetos(await respuesta.text()).filter(estaPublicada));

    // Cinco minutos de caché, y hasta una hora sirviendo lo viejo mientras
    // se busca lo nuevo: si Google falla, el sitio sigue mostrando contenido.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json({ configurada: true, items });
  } catch (error) {
    console.error(`Error leyendo la hoja "${nombre}":`, error.message);
    res.status(502).json({ error: "No se pudo leer la hoja de cálculo" });
  }
}
