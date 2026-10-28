// ---------------------------------------------------------------------------
// CATÁLOGO DE RESPALDO: de la exportación MARC de DigiBepé a una hoja
//
// Convierte la exportación del catálogo (archivo .mrc de Koha) en un CSV con
// un renglón por título, para importarlo en la hoja de Google
// "Catálogo de respaldo" (Drive → Recursos Web Biblioteca → Catalogo).
//
//     npm run catalogo:respaldo -- ruta/al/koha.mrc
//
// Deja catalogo-respaldo.csv en la raíz del proyecto (no se sube al
// repositorio: está en .gitignore). Ver DOCUMENTACION.md, "Catálogo de
// respaldo", para importarlo sin que Sheets convierta los ISBN en números.
//
// Para qué sirve:
//   - La biblioteca puede buscar en la hoja cuando el OPAC de DigiBepé no
//     responde (pasa seguido: 503).
//   - El buscador del sitio la usa sola en ese mismo caso (api/catalogo.js).
//
// Sincronizar = volver a exportar el MARC desde DigiBepé, correr este script
// e importar el CSV nuevo encima de la hoja. El enlace publicado no cambia.
//
// Sin dependencias: el formato MARC (ISO 2709) se lee a mano.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from "node:fs";

const SALIDA = "catalogo-respaldo.csv";
const FIN_CAMPO = 0x1e;
const SUBCAMPO = "\x1f";

// --- Lectura de MARC (ISO 2709) ---------------------------------------------
// Cada registro: cabecera de 24 bytes, un directorio de entradas de 12 bytes
// (etiqueta, largo, posición) y los datos. Los largos están en BYTES, así que
// se corta el buffer antes de pasar a texto (las tildes ocupan 2 bytes).

export function* leerMARC(buffer) {
  let pos = 0;
  while (pos + 24 <= buffer.length) {
    const largo = Number(buffer.toString("latin1", pos, pos + 5));
    if (!largo) break;
    const registro = buffer.subarray(pos, pos + largo);
    pos += largo;

    const base = Number(registro.toString("latin1", 12, 17));
    const campos = [];
    for (let d = 24; d + 12 <= base && registro[d] !== FIN_CAMPO; d += 12) {
      const etiqueta = registro.toString("latin1", d, d + 3);
      const lc = Number(registro.toString("latin1", d + 3, d + 7));
      const inicio = Number(registro.toString("latin1", d + 7, d + 12));
      let datos = registro.toString("utf8", base + inicio, base + inicio + lc);
      if (datos.endsWith("\x1e")) datos = datos.slice(0, -1);
      if (etiqueta < "010") {
        campos.push({ etiqueta, valor: datos });
      } else {
        const [, ...partes] = datos.split(SUBCAMPO);
        campos.push({ etiqueta, sub: partes.map((p) => [p[0], p.slice(1)]) });
      }
    }
    yield campos;
  }
}

// --- De registro MARC a renglón ----------------------------------------------

const limpiar = (s = "") =>
  String(s)
    .replace(/\s+/g, " ")
    .replace(/[\s/:;,=]+$/, "")
    .replace(/(?<![A-ZÁÉÍÓÚÑ])\.$/, "") // el punto final, pero no el de una inicial ("Borges, J. L.")
    .replace(/^[\s[(]+|[\s\])]+$/g, "")
    .trim();

const subcampos = (campos, etiqueta, codigos) =>
  campos
    .filter((c) => c.etiqueta === etiqueta && c.sub)
    .map((c) => c.sub.filter(([k]) => codigos.includes(k)).map(([, v]) => v));

const primero = (campos, etiqueta, codigo) => limpiar(subcampos(campos, etiqueta, codigo)[0]?.[0] ?? "");
const unir = (lista) => [...new Set(lista.map(limpiar).filter(Boolean))].join(" | ");

const normalizarSimple = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function isbnDe(texto = "") {
  const m = String(texto).replace(/-/g, "").match(/\b(97[89]\d{10}|\d{9}[\dXx])\b/);
  return m ? m[1].toUpperCase() : "";
}

// Estado de cada ejemplar según los campos de Koha en el 952.
function estadoEjemplar(sub) {
  const v = Object.fromEntries(sub);
  if (v["0"] && v["0"] !== "0") return "baja";
  if (v["1"] && v["1"] !== "0") return "perdido";
  if (v.q) return "prestado";
  if (v["7"] && v["7"] !== "0") return "sala"; // no se presta a domicilio
  return "disponible";
}

export function renglon(campos) {
  const control = (t) => campos.find((c) => c.etiqueta === t)?.valor ?? "";
  const id = subcampos(campos, "999", "c")[0]?.[0] || control("001");

  // Algunos registros ya traen el subtítulo dentro del $a: no se repite.
  const tituloA = primero(campos, "245", "a").replace(/\s+:\s*/g, ": ");
  const subtitulo = primero(campos, "245", "b");
  const titulo = subtitulo && !normalizarSimple(tituloA).includes(normalizarSimple(subtitulo)) ? `${tituloA}: ${subtitulo}` : tituloA;
  const autor = primero(campos, "100", "a") || primero(campos, "110", "a");
  const otros = unir(subcampos(campos, "700", "a").flat().concat(subcampos(campos, "710", "a").flat()));
  const imprenta = subcampos(campos, "260", "abc")[0] ?? subcampos(campos, "264", "abc")[0] ?? [];
  const lugar = limpiar(imprenta[0] ?? "");
  const editorial = limpiar(imprenta[1] ?? "");
  const anio = String(imprenta.join(" ")).match(/1[5-9]\d\d|20\d\d/)?.[0] ?? "";
  const isbn = subcampos(campos, "020", "a").flat().map(isbnDe).find(Boolean) ?? "";
  const materias = unir(subcampos(campos, "650", "a").flat().concat(subcampos(campos, "600", "a").flat(), subcampos(campos, "653", "a").flat()));

  const ejemplares = campos.filter((c) => c.etiqueta === "952" && c.sub).map((c) => c.sub);
  const estados = ejemplares.map(estadoEjemplar);
  const activos = estados.filter((e) => e !== "baja" && e !== "perdido");
  const cuenta = (e) => activos.filter((x) => x === e).length;
  const signatura = unir(ejemplares.map((s) => Object.fromEntries(s).o ?? ""));
  const coleccion = unir(ejemplares.map((s) => Object.fromEntries(s).c ?? ""));
  const tipo = unir(ejemplares.map((s) => Object.fromEntries(s).y ?? ""));

  return {
    ID: id,
    Título: titulo,
    Autor: autor,
    "Otros autores": otros,
    Editorial: editorial,
    Lugar: lugar,
    Año: anio,
    ISBN: isbn,
    Materias: materias,
    Colección: coleccion,
    Signatura: signatura,
    Tipo: tipo,
    Ejemplares: activos.length,
    Disponibles: cuenta("disponible"),
    Prestados: cuenta("prestado"),
    "Solo sala": cuenta("sala"),
  };
}

// --- CSV ----------------------------------------------------------------------

// Comillas si hace falta, y un apóstrofo delante de lo que Sheets tomaría por
// fórmula (=, +, -, @): un título no tiene que poder ejecutar nada en la hoja.
function celda(valor) {
  let s = String(valor ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// --- Programa -------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("catalogo-respaldo.js")) {
  const archivo = process.argv[2];
  if (!archivo) {
    console.log("Uso: npm run catalogo:respaldo -- ruta/al/koha.mrc");
    process.exit(1);
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const filas = [];
  let sinTitulo = 0;
  for (const campos of leerMARC(readFileSync(archivo))) {
    const r = renglon(campos);
    if (!r.Título) {
      sinTitulo++;
      continue;
    }
    filas.push({ ...r, Actualizado: hoy });
  }
  filas.sort((a, b) => a.Título.localeCompare(b.Título, "es", { sensitivity: "base" }));

  const columnas = Object.keys(filas[0]);
  const csv = [columnas.map(celda).join(","), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(","))].join("\r\n");
  // Con BOM: así Excel también lo abre con las tildes bien.
  writeFileSync(SALIDA, "﻿" + csv + "\r\n", "utf8");

  const ejemplares = filas.reduce((n, f) => n + f.Ejemplares, 0);
  console.log(`OK: ${SALIDA} — ${filas.length} títulos, ${ejemplares} ejemplares activos${sinTitulo ? ` (${sinTitulo} registros sin título, salteados)` : ""}.`);
  console.log("Ahora: importalo en la hoja «Catálogo de respaldo» (ver DOCUMENTACION.md).");
}
