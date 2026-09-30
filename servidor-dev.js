// ---------------------------------------------------------------------------
// SERVIDOR DE DESARROLLO
//
// Sirve public/ igual que Vercel, para probar el sitio en la computadora:
//
//   npm run serve   → http://localhost:3000
//
// Los talleres se leen de Google Sheets desde el navegador y las noticias de
// public/data/noticias.json, así que no hace falta ninguna API local.
// ---------------------------------------------------------------------------

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PUERTO = Number(process.env.PORT) || 3000;
const RAIZ = new URL("./public/", import.meta.url);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);

  // normalize + quitar ".." impide salir de public/ con una ruta armada a mano.
  const pedido = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const relativo = normalize(pedido).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");

  // Vercel sirve /quienes-somos como quienes-somos.html; acá se hace igual
  // para que lo que se prueba en la computadora coincida con lo publicado.
  const candidatos = extname(relativo) ? [relativo] : [relativo, `${relativo}.html`, join(relativo, "index.html")];

  for (const candidato of candidatos) {
    try {
      const contenido = await readFile(new URL(candidato, RAIZ));
      res.writeHead(200, { "Content-Type": TIPOS[extname(candidato).toLowerCase()] ?? "application/octet-stream" });
      res.end(contenido);
      return;
    } catch {
      // Se prueba el siguiente candidato.
    }
  }

  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<h1>404</h1><p>No se encontró esa página.</p>");
});

servidor.listen(PUERTO, () => {
  console.log(`Sitio en http://localhost:${PUERTO}`);
});
