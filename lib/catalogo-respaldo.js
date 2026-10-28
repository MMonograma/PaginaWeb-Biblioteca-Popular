// ---------------------------------------------------------------------------
// BÚSQUEDA EN EL CATÁLOGO DE RESPALDO (hoja de Google publicada como CSV)
//
// Lo usa api/catalogo.js solo cuando DigiBepé no responde. La hoja sale de
// scripts/catalogo-respaldo.js (un renglón por título) y se publica en la web
// como CSV; la dirección va en BIBLIOTECA.conabip.catalogoRespaldo.
//
// La hoja se baja entera (unos 1,4 MB, ~7.800 títulos) y se guarda en memoria
// 6 horas: mientras la función de Vercel siga activa, las búsquedas siguientes
// no vuelven a pedirla. Se busca acá mismo, sin ningún servicio pago.
//
// Devuelve los libros con la misma forma que lib/koha.js, así la página no
// tiene que saber de dónde vinieron. Lo único distinto: no se informa la
// disponibilidad, porque la de la hoja es la del día en que se exportó.
// ---------------------------------------------------------------------------

import { nombreNatural, POR_PAGINA } from "./koha.js";

const TIEMPO_MAXIMO_MS = 10000;
const VIGENCIA_MS = 6 * 60 * 60 * 1000;

let cache = null; // { url, hasta, libros, actualizado }

// --- CSV ----------------------------------------------------------------------
// RFC 4180: comillas dobles, comillas escapadas ("") y saltos de línea dentro
// de una celda.

export function leerCSV(texto) {
  const filas = [];
  let fila = [];
  let celda = "";
  let entreComillas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  const [encabezado = [], ...resto] = filas;
  return resto
    .filter((f) => f.some(Boolean))
    .map((f) => Object.fromEntries(encabezado.map((col, i) => [col.trim(), (f[i] ?? "").trim()])));
}

// --- Normalización para comparar ----------------------------------------------

export const normalizar = (s = "") =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

// El apóstrofo que el conversor pone delante de lo que parece fórmula.
const sinApostrofo = (s = "") => s.replace(/^'(?=[=+\-@])/, "");

// Si al importar quedó tildado "Convertir texto en números", Sheets le saca
// el cero inicial a los ISBN-10 ("0263773574" queda 263773574). Se recupera
// rellenando con ceros, solo si el dígito verificador da bien.
export function repararISBN(valor = "") {
  const isbn = String(valor).replace(/[^0-9Xx]/g, "").toUpperCase();
  if (!/^\d{8,9}[\dX]?$/.test(isbn) || isbn.length === 10) return isbn;
  const diez = isbn.padStart(10, "0");
  const suma = [...diez].reduce((t, c, i) => t + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
  return suma % 11 === 0 ? diez : isbn;
}

function prepararLibro(f) {
  const titulo = sinApostrofo(f["Título"] ?? f.Titulo ?? "");
  const autor = f.Autor ?? "";
  const otros = f["Otros autores"] ?? "";
  const materias = f.Materias ?? "";
  const isbn = repararISBN(f.ISBN);
  const anio = Number(f["Año"] ?? f.Anio) || null;
  return {
    libro: {
      id: `koha-${f.ID}`,
      biblionumber: f.ID || null,
      titulo,
      autor: autor ? nombreNatural(autor) : "",
      isbn: isbn || null,
      anio,
      paginas: null,
      editorial: f.Editorial || null,
      disponibilidad: null,
    },
    // Textos ya normalizados por índice, para no repetir el trabajo en cada búsqueda.
    ti: normalizar(titulo),
    au: normalizar(`${autor} ${otros}`),
    su: normalizar(materias),
    nb: isbn.toLowerCase(),
    actualizado: f.Actualizado || null,
  };
}

async function cargar(url) {
  if (cache && cache.url === url && Date.now() < cache.hasta) return cache;
  const r = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS), redirect: "follow" });
  if (!r.ok) {
    const error = new Error(`HTTP ${r.status} al leer la hoja de respaldo`);
    error.status = r.status;
    throw error;
  }
  const texto = await r.text();
  // Si la hoja no está publicada, Google responde 200 con una página de inicio
  // de sesión en HTML. Eso no es un catálogo.
  if (/^\s*</.test(texto)) throw new Error("La hoja de respaldo no está publicada como CSV.");
  const libros = leerCSV(texto).map(prepararLibro).filter((l) => l.libro.titulo);
  if (!libros.length) throw new Error("La hoja de respaldo está vacía.");
  const actualizado = libros.map((l) => l.actualizado).filter(Boolean).sort().pop() ?? null;
  cache = { url, hasta: Date.now() + VIGENCIA_MS, libros, actualizado };
  return cache;
}

// --- Búsqueda -------------------------------------------------------------------
// Todas las palabras tienen que aparecer (como en Koha). Orden: primero los
// títulos que empiezan con lo buscado, después los que lo contienen entero,
// después el resto, y dentro de cada grupo, alfabético.

export async function buscarEnRespaldo({ url, q, idx = "", offset = 0 }) {
  const { libros, actualizado } = await cargar(url);
  const consulta = normalizar(q);
  const palabras = consulta.split(" ").filter(Boolean);
  if (!palabras.length) return { total: 0, items: [], actualizado };

  const campos = idx ? [idx] : ["ti", "au", "su", "nb"];
  const textoDe = (l) => campos.map((c) => l[c]).join(" ");
  const enPalabras = (texto) => palabras.every((p) => ` ${texto}`.includes(` ${p}`) || (p.length >= 4 && texto.includes(p)));

  const encontrados = libros.filter((l) => enPalabras(textoDe(l)));
  const puntaje = (l) => (l.ti.startsWith(consulta) ? 0 : l.ti.includes(consulta) ? 1 : 2);
  encontrados.sort((a, b) => puntaje(a) - puntaje(b) || a.libro.titulo.localeCompare(b.libro.titulo, "es"));

  return {
    total: encontrados.length,
    items: encontrados.slice(offset, offset + POR_PAGINA).map((l) => l.libro),
    actualizado,
  };
}
