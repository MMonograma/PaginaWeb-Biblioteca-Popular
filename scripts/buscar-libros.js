// ---------------------------------------------------------------------------
// BUSCAR PORTADAS Y SINOPSIS DE LOS LIBROS
//
// Se ejecuta a mano, cuando se agregan libros a src/datos/catalogo.js:
//
//     npm run libros                      (solo busca los libros nuevos)
//     npm run libros -- --todos           (vuelve a buscar todos)
//
// En Vercel corre solo dentro de `npm run build` (con --build) si el proyecto
// tiene la variable de entorno GOOGLE_BOOKS_API_KEY. Ver DOCUMENTACION.md.
//
// Guarda lo que encuentra en src/datos/libros-info.json. build.js lee ese
// archivo; el sitio publicado NO consulta ninguna API al abrirse, así que no
// depende de que Google u Open Library estén andando ese día.
//
// Opcional pero recomendado: una API key de Google Books (gratuita) para
// tener sinopsis en castellano. Sin key, Google comparte una cuota que casi
// siempre está agotada y se usa solo Open Library.
//
//     PowerShell:  $env:GOOGLE_BOOKS_API_KEY="tu-key"; npm run libros
//
// Si un libro sale con la tapa o la sinopsis equivocada, no se toca el JSON:
// se corrige en catalogo.js con los campos portada / sinopsis / buscarComo.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CATALOGO_DESTACADO, NOVEDADES_LITERARIAS } from "../src/datos/catalogo.js";
import { buscarLibro, claveLibro } from "./fuentes-libros.js";

const ARCHIVO = "src/datos/libros-info.json";
const todos = process.argv.includes("--todos");
const apiKey = process.env.GOOGLE_BOOKS_API_KEY || "";

// Modo build (npm run build en Vercel): solo corre si hay API key, usa solo
// Google (rápido), tiene un tope de tiempo y nunca hace fallar el deploy.
const modoBuild = process.argv.includes("--build");
if (modoBuild && !apiKey) {
  console.log("Libros: sin GOOGLE_BOOKS_API_KEY, se usa src/datos/libros-info.json tal como está.");
  process.exit(0);
}
const limite = modoBuild ? Date.now() + 60_000 : Infinity;

const cache = existsSync(ARCHIVO) ? JSON.parse(readFileSync(ARCHIVO, "utf8")) : {};

// Todos los libros del sitio, sin repetir.
const libros = new Map();
for (const libro of [...NOVEDADES_LITERARIAS, ...CATALOGO_DESTACADO.flatMap((s) => s.libros)]) {
  libros.set(claveLibro(libro), libro);
}

const pendientes = [...libros].filter(([clave]) => todos || !cache[clave]);
console.log(`${libros.size} libros en el catálogo · ${pendientes.length} para buscar${apiKey ? " · con API key de Google" : ""}`);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let sinTapa = 0;
let fallidos = 0;

for (const [clave, libro] of pendientes) {
  if (Date.now() > limite) {
    console.log("Libros: se alcanzó el tope de tiempo del build; el resto queda para el próximo deploy.");
    break;
  }
  let r;
  try {
    r = await buscarLibro(libro, { apiKey, soloGoogle: modoBuild });
  } catch (e) {
    console.log(`✖ ${libro.titulo}: ${e.message}`);
    continue;
  }
  const { avisos, ...datos } = r;
  for (const a of avisos) console.log(`    aviso: ${a}`);

  // Si una fuente falló (caída, cuota agotada) y no se consiguió nada, no se
  // guarda: así la próxima vez que se corra el script se vuelve a intentar.
  const vacio = !r.portada && !r.sinopsis && !r.editorial;
  if (vacio && avisos.length) {
    fallidos++;
    console.log(`✖ ${libro.titulo} — ${libro.autor}  [no se pudo consultar, queda para la próxima]`);
    continue;
  }

  cache[clave] = { titulo: libro.titulo, autor: libro.autor, ...datos, actualizado: new Date().toISOString().slice(0, 10) };
  if (!r.portada) sinTapa++;
  const marca = r.portada ? "✔" : "·";
  console.log(`${marca} ${libro.titulo} — ${libro.autor}  [tapa: ${r.portada ? "sí" : "no"} · sinopsis: ${r.sinopsis ? "sí" : "no"}]`);
  await espera(modoBuild ? 150 : 600); // De a uno y con pausa: Open Library bloquea a quien consulta en ráfaga.
}

// Se ordena por clave para que los cambios en git sean fáciles de leer.
const ordenado = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(ARCHIVO, JSON.stringify(ordenado, null, 2) + "\n", "utf8");

console.log(`\nOK: ${ARCHIVO} actualizado.${sinTapa ? ` ${sinTapa} libro(s) sin tapa: se verá la tapa de diseño.` : ""}`);
if (fallidos) console.log(`${fallidos} libro(s) no se pudieron consultar (¿Open Library caído?). Volvé a correr npm run libros más tarde.`);
console.log("Ahora: npm run build");
