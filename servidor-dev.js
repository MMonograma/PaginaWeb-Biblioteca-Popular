// ---------------------------------------------------------------------------
// SERVIDOR DE DESARROLLO
//
// Sirve public/ y además atiende /api/hoja con la misma función que corre en
// Vercel. Sin esto, `npx serve public` no tiene API y las noticias no se
// pueden probar en la computadora.
//
//   npm run serve                 → usa las hojas reales si están configuradas
//   npm run serve -- --demo       → usa datos de ejemplo, sin tocar Google
//
// Las URL de las hojas salen de las variables de entorno SHEET_NOTICIAS y
// SHEET_TALLERES, las mismas que se configuran en Vercel.
// ---------------------------------------------------------------------------

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PUERTO = Number(process.env.PORT) || 3000;
const DEMO = process.argv.includes("--demo");
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

// Datos de ejemplo para --demo: sirven para ver cómo queda la sección con
// contenido, incluidas varias páginas de paginación.
const DEMO_NOTICIAS = Array.from({ length: 14 }, (_, i) => ({
  id: String(i + 1),
  titulo: `Noticia de ejemplo ${i + 1}`,
  descripcion: "Texto de ejemplo para ver cómo queda la tarjeta con una descripción de un par de renglones.",
  fecha: `2026-09-${String(28 - i).padStart(2, "0")}`,
  categoria: ["Talleres", "Actividades", "Novedades"][i % 3],
  enlaceinstagram: "https://www.instagram.com/bibliotecaedgarmorisoli",
}));

const DEMO_TALLERES = [
  { nombre: "Taller de ejemplo", categoria: "Infancias", horario: "Martes 17:00", lugar: "Sala de lectura", docente: "Equipo de la biblioteca", descripcion: "Descripción breve del taller.", info: "Información adicional que aparece al desplegar el detalle." },
];

async function responderAPI(req, res, url) {
  const nombre = url.searchParams.get("nombre") ?? "";

  if (DEMO) {
    const items = nombre === "noticias" ? DEMO_NOTICIAS : nombre === "talleres" ? DEMO_TALLERES : null;
    if (!items) {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Hoja desconocida" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ configurada: true, items }));
    return;
  }

  // Se usa el handler real, con un req/res con la forma que espera Vercel.
  const { default: handler } = await import("./api/hoja.js");
  const respuesta = {
    cabeceras: {},
    setHeader(k, v) { this.cabeceras[k] = v; },
    status(c) { this.codigo = c; return this; },
    json(cuerpo) {
      res.writeHead(this.codigo, { ...this.cabeceras, "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(cuerpo));
      return this;
    },
  };
  await handler({ query: { nombre } }, respuesta);
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);

  if (url.pathname === "/api/hoja") {
    try {
      await responderAPI(req, res, url);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error.message }));
    }
    return;
  }

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
  console.log(`Sitio en http://localhost:${PUERTO}${DEMO ? "  (datos de ejemplo)" : ""}`);
});
