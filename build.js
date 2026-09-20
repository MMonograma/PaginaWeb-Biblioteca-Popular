// ---------------------------------------------------------------------------
// GENERADOR DEL SITIO
//
// Arma los HTML de public/ combinando:
//   src/parciales/layout.html  — el esqueleto común
//   src/parciales/header.html  — encabezado y menú
//   src/parciales/footer.html  — pie con los datos de contacto
//   src/paginas/*.html         — el contenido propio de cada página
//   src/datos/sitio.js         — los datos institucionales
//
// Se ejecuta con: npm run build
// No usa ninguna dependencia: solo Node.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { BIBLIOTECA, HORARIOS, DIAS, MENU } from "./src/datos/sitio.js";
import { CATALOGO_DESTACADO } from "./src/datos/catalogo.js";

const leer = (ruta) => readFileSync(ruta, "utf8");

// Escapa lo que se inserta en el HTML, por si un dato trae < o &.
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// --- Horarios en texto, derivados de HORARIOS -------------------------------
// Agrupa los días seguidos que comparten los mismos tramos, para que salga
// "Martes a viernes" en vez de repetir cuatro líneas iguales.

const hhmm = (h, m) => `${h}:${String(m).padStart(2, "0")}`;
const tramosATexto = (tramos) => tramos.map(([hi, mi, hf, mf]) => `${hhmm(hi, mi)} a ${hhmm(hf, mf)} hs`).join(" y ");
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function agruparHorarios() {
  const grupos = [];
  // Arranca en lunes (1) y termina en domingo (0) para leerlo como un calendario.
  for (const dia of [1, 2, 3, 4, 5, 6, 0]) {
    const tramos = HORARIOS[dia];
    if (!tramos.length) continue;
    const firma = JSON.stringify(tramos);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.firma === firma && ultimo.hasta === dia - 1) {
      ultimo.hasta = dia;
    } else {
      grupos.push({ firma, desde: dia, hasta: dia, tramos });
    }
  }
  return grupos.map((g) => ({
    dias: g.desde === g.hasta ? capitalizar(DIAS[g.desde]) : `${capitalizar(DIAS[g.desde])} a ${DIAS[g.hasta]}`,
    horas: tramosATexto(g.tramos),
  }));
}

const GRUPOS_HORARIOS = agruparHorarios();

const horariosHTML = GRUPOS_HORARIOS.map(
  (g) => `<p><span class="font-semibold">${esc(g.dias)}</span><br>${esc(g.horas)}</p>`
).join("\n            ");

// Lista con más aire, para el acordeón del inicio y la sección Quiénes Somos.
const horariosLista = GRUPOS_HORARIOS.map(
  (g) => `<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-biblio-pistachio py-3 last:border-0 dark:border-biblio-moss">
              <dt class="font-semibold text-biblio-charcoal dark:text-biblio-paper">${esc(g.dias)}</dt>
              <dd class="muted">${esc(g.horas)}</dd>
            </div>`
).join("\n            ");

// --- Menú -------------------------------------------------------------------

function navHTML(paginaActual) {
  const activo = (url) => (url === paginaActual ? ' aria-current="page"' : "");

  const items = MENU.map((item) => {
    if (!item.hijos) {
      return `            <li><a class="nav-link" href="${item.url}"${activo(item.url)}>${esc(item.texto)}</a></li>`;
    }

    const hijoActivo = item.hijos.some((h) => h.url === paginaActual);
    const hijos = item.hijos
      .map((h) => `                <li><a class="nav-link" href="${h.url}"${activo(h.url)}>${esc(h.texto)}</a></li>`)
      .join("\n");

    // En móvil el submenú se despliega debajo; en escritorio flota sobre la página.
    return `            <li class="lg:relative">
              <button id="proyectos-btn" type="button" aria-expanded="false" aria-controls="proyectos-menu"
                      class="nav-link w-full justify-between gap-1 lg:w-auto${hijoActivo ? " font-semibold" : ""}">
                ${esc(item.texto)}
                <svg class="h-4 w-4 transition-transform" data-chevron viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </button>
              <ul id="proyectos-menu" class="hidden pl-4 lg:absolute lg:top-full lg:left-0 lg:z-50 lg:mt-1 lg:min-w-60 lg:rounded-xl lg:border lg:border-biblio-pistachio lg:bg-biblio-paper lg:p-2 lg:pl-2 lg:shadow-lg lg:dark:border-biblio-moss lg:dark:bg-biblio-card-dark">
${hijos}
              </ul>
            </li>`;
  }).join("\n");

  return `          <ul class="flex flex-col gap-1 lg:flex-row lg:items-center">
${items}
          </ul>`;
}

// --- Composición de cada página ---------------------------------------------

const layout = leer("src/parciales/layout.html");
const header = leer("src/parciales/header.html");
const footer = leer("src/parciales/footer.html");

const { direccion: dir, contacto, conabip } = BIBLIOTECA;
const mapaURL = `https://www.google.com/maps/search/?api=1&query=${dir.lat},${dir.lon}`;
const conabipCatalogoBusqueda = conabip.catalogoBusqueda;

const reemplazosFooter = {
  DIRECCION_CALLE: dir.calle,
  DIRECCION_CIUDAD: dir.ciudad,
  DIRECCION_PROVINCIA: dir.provincia,
  MAPA_URL: mapaURL,
  HORARIOS_TEXTO: horariosHTML,
  TELEFONO: contacto.telefono,
  TELEFONO_LINK: contacto.telefonoLink,
  EMAIL: contacto.email,
  INSTAGRAM: contacto.instagram,
  NOMBRE: BIBLIOTECA.nombre,
  REGISTRO: conabip.registro,
  ANIO: new Date().getFullYear(),
};

// --- Títulos destacados del catálogo ----------------------------------------
// Cada libro se convierte en un enlace a la búsqueda por título en el OPAC.

const busquedaEnOPAC = (indice, termino) =>
  `${conabipCatalogoBusqueda}?idx=${indice}&q=${encodeURIComponent(termino)}`;

const catalogoHTML = CATALOGO_DESTACADO.map((seccion) => {
  const libros = seccion.libros
    .map(
      (libro) => `          <li>
            <a href="${busquedaEnOPAC("ti", libro.titulo)}" target="_blank" rel="noopener"
               class="card card-hover flex h-full flex-col justify-between">
              <h3 class="font-semibold text-biblio-charcoal dark:text-biblio-paper">${esc(libro.titulo)}</h3>
              <p class="muted mt-1 text-sm">${esc(libro.autor)}</p>
              <span class="muted mt-3 text-xs font-semibold uppercase">Buscar en el catálogo &rarr;</span>
            </a>
          </li>`
    )
    .join("\n");

  return `      <div class="mt-12 first:mt-0">
        <h3 class="font-display text-2xl font-bold text-biblio-moss dark:text-biblio-paper">${esc(seccion.seccion)}</h3>
        <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
${libros}
        </ul>
      </div>`;
}).join("\n");

// Marcadores disponibles dentro del contenido de cada página.
const reemplazosContenido = {
  ...reemplazosFooter,
  HORARIOS_LISTA: horariosLista,
  DIRECCION_COMPLETA: `${dir.calle}, ${dir.ciudad}, ${dir.provincia}`,
  DIRECCION_CP: dir.codigoPostal,
  DIRECCION_PAIS: dir.pais,
  LAT: dir.lat,
  LON: dir.lon,
  INSTAGRAM_USUARIO: contacto.instagramUsuario,
  CATALOGO_URL: conabip.catalogo,
  CATALOGO_BUSQUEDA: conabip.catalogoBusqueda,
  FUNDACION: BIBLIOTECA.fundacion,
  ANIO_FUNDACION: BIBLIOTECA.anioFundacion,
  CATALOGO_DESTACADO: catalogoHTML,
};


const aplicar = (texto, mapa) =>
  texto.replace(/\{\{([A-Z_]+)\}\}/g, (coincidencia, clave) =>
    clave in mapa ? String(mapa[clave]) : coincidencia
  );

// El encabezado de cada página va en un comentario HTML al principio del archivo.
function leerCabecera(texto) {
  const m = texto.match(/^<!--\s*([\s\S]*?)-->\s*/);
  if (!m) return [{}, texto];
  const datos = {};
  for (const linea of m[1].split("\n")) {
    const par = linea.match(/^\s*(\w+):\s*(.*)$/);
    if (par) datos[par[1]] = par[2].trim();
  }
  return [datos, texto.slice(m[0].length)];
}

const paginas = readdirSync("src/paginas").filter((f) => f.endsWith(".html"));
let generadas = 0;

for (const archivo of paginas) {
  const [meta, cuerpo] = leerCabecera(leer(join("src/paginas", archivo)));

  const html = aplicar(
    layout
      .replace("{{HEADER}}", header.replace("{{NAV}}", navHTML(archivo)))
      .replace("{{FOOTER}}", aplicar(footer, reemplazosFooter))
      .replace("{{CONTENIDO}}", cuerpo.trimEnd())
      .replace("{{TITULO}}", esc(meta.titulo ?? BIBLIOTECA.nombre))
      .replace("{{DESCRIPCION}}", esc(meta.descripcion ?? "")),
    reemplazosContenido
  );

  const aviso = `<!-- ARCHIVO GENERADO por build.js — no editar a mano.\n     El contenido de esta página se edita en src/paginas/${archivo} -->\n`;
  writeFileSync(join("public", archivo), aviso + html, "utf8");
  generadas++;
}

// Los mismos datos institucionales, para que el navegador calcule el estado de hoy.
copyFileSync("src/datos/sitio.js", "public/js/datos.js");

console.log(`OK: ${generadas} paginas generadas en public/`);
console.log("OK: public/js/datos.js actualizado desde src/datos/sitio.js");
