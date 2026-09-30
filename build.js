// ---------------------------------------------------------------------------
// GENERADOR DEL SITIO
//
// Arma los HTML de public/ combinando:
//   src/parciales/layout.html  — el esqueleto común
//   src/parciales/header.html  — encabezado y menú
//   src/parciales/footer.html  — pie con los datos de contacto
//   src/parciales/loader.html  — pantalla de carga (libro animado)
//   src/paginas/*.html         — el contenido propio de cada página
//   src/datos/sitio.js         — los datos institucionales
//
// Se ejecuta con: npm run build
// No usa ninguna dependencia: solo Node.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { BIBLIOTECA, HORARIOS, DIAS, MENU, ACCESO_CATALOGO } from "./src/datos/sitio.js";
import { CATALOGO_DESTACADO } from "./src/datos/catalogo.js";
import { RINCON_PAMPEANO, BIBLIOTECAS_DIGITALES } from "./src/datos/lectura.js";

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

  // En escritorio el catálogo es un botón aparte (header.html); en celular ese
  // botón no entra junto al logo, así que se suma como último ítem del menú.
  const catalogo = `            <li class="lg:hidden"><a class="nav-link" href="${ACCESO_CATALOGO.url}"${activo(ACCESO_CATALOGO.url)}>${esc(ACCESO_CATALOGO.texto)}</a></li>`;

  return `          <ul class="flex flex-col gap-1 lg:flex-row lg:items-center">
${items}
${catalogo}
          </ul>`;
}

function headerHTML(paginaActual) {
  return aplicar(header.replace("{{NAV}}", navHTML(paginaActual)), {
    CATALOGO_URL_NAV: ACCESO_CATALOGO.url,
    CATALOGO_TEXTO_NAV: esc(ACCESO_CATALOGO.texto),
    CATALOGO_ACTUAL: paginaActual === ACCESO_CATALOGO.url ? ' aria-current="page"' : "",
  });
}

// --- Composición de cada página ---------------------------------------------

const layout = leer("src/parciales/layout.html");
const header = leer("src/parciales/header.html");
const footer = leer("src/parciales/footer.html");
const loader = leer("src/parciales/loader.html");

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

// --- Lectura virtual 24/7 ---------------------------------------------------

const flecha = `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg>`;

const tarjetaLectura = ({ titulo, subtitulo, descripcion, url }) => `          <li>
            <a href="${esc(url)}" target="_blank" rel="noopener"
               class="card card-hover flex h-full flex-col border-biblio-pistachio/40 dark:border-biblio-moss">
              <h4 class="font-display text-lg font-semibold text-biblio-moss dark:text-biblio-paper">${esc(titulo)}</h4>
              ${subtitulo ? `<p class="mt-1 text-sm font-medium text-biblio-charcoal dark:text-biblio-pistachio">${esc(subtitulo)}</p>` : ""}
              <p class="mt-2 flex-1 text-sm text-biblio-charcoal dark:text-biblio-pistachio">${esc(descripcion)}</p>
              <span class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-biblio-moss dark:text-biblio-pistachio">
                Abrir ${flecha}<span class="sr-only"> (se abre en una pestaña nueva)</span>
              </span>
            </a>
          </li>`;

const lecturaPampeanaHTML = RINCON_PAMPEANO.length
  ? `<ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
${RINCON_PAMPEANO.map((o) => tarjetaLectura({ titulo: o.titulo, subtitulo: o.autor, descripcion: o.descripcion, url: o.url })).join("\n")}
        </ul>`
  : `<div class="card mt-6 border-dashed border-biblio-pistachio/40 dark:border-biblio-moss" role="status">
          <p class="section-kicker">En preparación</p>
          <p class="mt-2 max-w-2xl text-sm text-biblio-charcoal dark:text-biblio-pistachio">
            Estamos reuniendo poemas y textos de Edgar Morisoli y de otros autores pampeanos que se puedan
            compartir libremente. Mientras tanto, sus libros están en nuestros estantes: buscalos en el catálogo.
          </p>
        </div>`;

const bibliotecasDigitalesHTML = `<ul class="mt-6 grid gap-4 sm:grid-cols-2">
${BIBLIOTECAS_DIGITALES.map((b) => tarjetaLectura({ titulo: b.nombre, descripcion: b.descripcion, url: b.url })).join("\n")}
        </ul>`;

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
  LECTURA_PAMPEANA: lecturaPampeanaHTML,
  LECTURA_BIBLIOTECAS: bibliotecasDigitalesHTML,
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
  // \r?\n y no "\n": en Windows los archivos pueden venir con CRLF, y el \r
  // que quedaba al final de cada línea hacía fallar la lectura del título.
  for (const linea of m[1].split(/\r?\n/)) {
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
      // "loader: si" en la cabecera de la página = el loader se ve desde el
      // primer pintado, porque esa página trae datos de afuera al cargar.
      .replace("{{LOADER}}", loader.replace("{{LOADER_VISIBLE}}", meta.loader === "si" ? " data-visible" : ""))
      .replace("{{HEADER}}", headerHTML(archivo))
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
