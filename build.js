// ---------------------------------------------------------------------------
// GENERADOR DEL SITIO
//
// Arma los HTML de public/ combinando:
//   src/parciales/layout.html  — el esqueleto común
//   src/parciales/header.html  — encabezado y menú
//   src/parciales/footer.html  — pie con los datos de contacto
//   src/parciales/loader.html  — loader chico de sección (libro animado)
//   src/paginas/*.html         — el contenido propio de cada página
//   src/datos/sitio.js         — los datos institucionales
//
// Se ejecuta con: npm run build
// No usa ninguna dependencia: solo Node.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { BIBLIOTECA, HORARIOS, DIAS, MENU, ACCESO_CATALOGO } from "./src/datos/sitio.js";
import { CATALOGO_DESTACADO, CATALOGO_DESTACADO_PUBLICADO, NOVEDADES_LITERARIAS } from "./src/datos/catalogo.js";
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

// --- Recuadro de "Próximamente" ----------------------------------------------
// El mismo para todo lo que todavía no está listo para publicarse.
const proximamenteHTML = (texto) => `<div class="card-proximamente mt-10 flex flex-col gap-4 sm:flex-row sm:items-center" role="status">
        <svg class="h-10 w-10 shrink-0 text-biblio-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 2h12M6 22h12M7 2c0 5 5 6 5 10s-5 5-5 10M17 2c0 5-5 6-5 10s5 5 5 10"></path>
        </svg>
        <div>
          <p class="badge-proximamente">Próximamente</p>
          <p class="mt-3 max-w-2xl text-biblio-charcoal dark:text-biblio-pistachio">${texto}</p>
        </div>
      </div>`;

// --- Libros: portada, sinopsis y ficha (modal) ------------------------------
// Los datos de cada libro salen de dos lugares:
//   src/datos/libros-info.json — lo que encontró `npm run libros` en Google
//                                Books / Open Library (tapa, sinopsis, etc.)
//   src/datos/catalogo.js      — título, autor, categoría y las correcciones
//                                a mano, que siempre ganan.
// Las tarjetas ya no llevan a DigiBepé (que suele responder 503): abren una
// ficha dentro del sitio. Los datos de la ficha van en un bloque JSON de la
// misma página, así que no hay que pedir nada a ninguna API al abrirla.

const ARCHIVO_INFO_LIBROS = "src/datos/libros-info.json";
const infoLibros = existsSync(ARCHIVO_INFO_LIBROS) ? JSON.parse(leer(ARCHIVO_INFO_LIBROS)) : {};

const normalizarClave = (s = "") =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
// Misma clave que scripts/fuentes-libros.js.
const claveLibro = (libro) => `${normalizarClave(libro.titulo)}|${normalizarClave(libro.autor)}`;

// Solo se aceptan URLs https para las tapas: el sitio sirve todo por https.
const urlSegura = (u) => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);

function datosLibro(libro) {
  const info = infoLibros[claveLibro(libro)] ?? {};
  const elegir = (campo) => (libro[campo] !== undefined ? libro[campo] : info[campo] ?? null);
  const sinopsisPropia = typeof libro.sinopsis === "string";
  return {
    id: claveLibro(libro),
    titulo: libro.titulo,
    autor: libro.autor,
    categoria: libro.categoria ?? null,
    portada: libro.portada === false ? null : urlSegura(elegir("portada")),
    sinopsis: elegir("sinopsis"),
    editorial: elegir("editorial"),
    anio: elegir("anio"),
    paginas: elegir("paginas"),
    isbn: elegir("isbn"),
    // Para dar crédito a la fuente de la sinopsis cuando no la escribió la biblioteca.
    fuente: sinopsisPropia ? null : (info.fuentes ?? []).join(" / ") || null,
  };
}

const aclaracionPortadas = `<p class="muted mt-8 text-center text-xs">
  * Las portadas y sinopsis son de carácter ilustrativo y pueden diferir de la edición física disponible en la biblioteca.
</p>`;

// Tapa de diseño: se ve cuando no hay portada o mientras no cargó.
const tapaDeDiseno = (titulo, autor, { tituloAttr = "", autorAttr = "" } = {}) => `<div class="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-br from-biblio-pistachio/40 via-biblio-paper/70 to-biblio-pistachio/60 dark:from-biblio-card-dark dark:via-biblio-charcoal dark:to-biblio-card-dark text-left" aria-hidden="true">
                  <div class="flex items-center justify-between opacity-70">
                    <svg class="h-5 w-5 text-biblio-moss dark:text-biblio-pistachio" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
                      <path d="M6 2v20"></path>
                    </svg>
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-biblio-moss dark:text-biblio-pistachio">Libro</span>
                  </div>
                  <div>
                    <span${tituloAttr} class="font-display text-sm sm:text-base font-bold leading-snug text-biblio-moss dark:text-biblio-paper line-clamp-3 block">${esc(titulo)}</span>
                    <span${autorAttr} class="mt-1 text-xs text-biblio-charcoal dark:text-biblio-pistachio line-clamp-2 block">${esc(autor)}</span>
                  </div>
                  <div class="border-t border-biblio-sage/30 pt-1 text-[9px] uppercase tracking-wider text-biblio-sage-oscuro dark:text-biblio-moss-claro">
                    Biblioteca Edgar Morisoli
                  </div>
                </div>`;

// Tarjeta: el botón está en el título y su ::after cubre toda la tarjeta,
// así se puede tocar en cualquier parte y el lector de pantalla anuncia
// un solo control con el nombre del libro.
// Tapas por ISBN directas (Google Books y Open Library): sin API key y sin
// gastar cuota. Cuando no la tienen, Google devuelve un cartel de 128×170 y
// Open Library un error (por ?default=false); interfaz.js descarta los dos y
// pasa a la siguiente.
const tapasPorISBN = (isbn) =>
  isbn
    ? [
        `https://books.google.com/books/content?vid=ISBN${encodeURIComponent(isbn)}&printsec=frontcover&img=1&zoom=1`,
        `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`,
      ]
    : [];

function tarjetaLibro(libro) {
  const d = datosLibro(libro);
  // La primera URL va en src y el resto queda de respaldo. Sin ninguna, la
  // imagen va sin src: libros.js la busca por título y autor cuando está por
  // verse. Con portada: false no hay imagen y se ve siempre la de diseño.
  const tapas = [...new Set([d.portada, ...tapasPorISBN(d.isbn)].filter(Boolean))];
  const [principal, ...respaldos] = tapas;
  const claseImg = "absolute inset-0 z-10 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105";
  const portadaImg =
    libro.portada === false
      ? ""
      : `<img data-portada${principal ? ` src="${esc(principal)}"` : ""}${respaldos.length ? ` data-respaldo="${esc(respaldos.join(" "))}"` : ""} alt="" width="300" height="450" loading="lazy" decoding="async" referrerpolicy="no-referrer"
                     class="${claseImg}${principal ? "" : " invisible"}">`;

  return `          <li class="h-full">
            <article class="card card-hover group relative flex h-full flex-col overflow-hidden p-0 border-biblio-pistachio/50 dark:border-biblio-moss focus-within:ring-2 focus-within:ring-biblio-moss dark:focus-within:ring-biblio-pistachio">
              <div class="relative aspect-[2/3] w-full overflow-hidden bg-biblio-pistachio/25 dark:bg-biblio-card-dark border-b border-biblio-pistachio/40 dark:border-biblio-moss">
                ${portadaImg}
                ${tapaDeDiseno(d.titulo, d.autor)}
              </div>
              <div class="flex flex-1 flex-col justify-between p-4">
                <div>
                  ${d.categoria ? `<span class="badge mb-2 text-[10px]">${esc(d.categoria)}</span>` : ""}
                  <h3 class="font-display font-semibold text-biblio-charcoal dark:text-biblio-paper text-sm sm:text-base leading-tight">
                    <button type="button" data-libro="${esc(d.id)}" aria-haspopup="dialog"
                            class="text-left after:absolute after:inset-0 after:z-20 after:content-[''] focus-visible:outline-none">${esc(d.titulo)}</button>
                  </h3>
                  <p class="muted mt-1 text-xs">${esc(d.autor)}</p>
                </div>
                <span class="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-biblio-moss group-hover:underline underline-offset-4 dark:text-biblio-pistachio" aria-hidden="true">
                  Ver ficha del libro &rarr;
                </span>
              </div>
            </article>
          </li>`;
}

// Datos de las fichas en JSON. Va como <script type="application/json">: el
// navegador no lo ejecuta, así que la CSP (script-src 'self') no lo bloquea.
// Se escapa "<" para que ningún texto pueda cerrar el bloque.
function datosFichasJSON(libros) {
  const vistos = new Map();
  for (const libro of libros) {
    const d = datosLibro(libro);
    if (!vistos.has(d.id)) vistos.set(d.id, d);
  }
  const json = JSON.stringify(Object.fromEntries(vistos)).replace(/</g, "\\u003c");
  return `<script type="application/json" id="datos-libros">${json}</script>`;
}

const enlaceWhatsApp = `https://wa.me/${contacto.whatsapp}`;

// Ficha del libro: un <dialog> nativo (Escape, foco atrapado y fondo inerte
// vienen del navegador). public/js/libros.js lo completa al abrirlo.
const fichaLibroHTML = `<dialog id="ficha-libro" class="ficha-libro" aria-labelledby="ficha-titulo"
        data-whatsapp="${esc(enlaceWhatsApp)}">
  <div class="relative grid gap-6 p-5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-8 sm:p-8">
    <button type="button" data-cerrar-ficha class="icon-btn absolute top-2 right-2 z-30" aria-label="Cerrar ficha">
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
    </button>

    <div class="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-biblio-pistachio/60 shadow-md sm:mx-0 sm:w-full dark:border-biblio-moss">
      <img data-ficha-portada alt="" width="300" height="450" decoding="async" referrerpolicy="no-referrer"
           class="invisible absolute inset-0 z-10 h-full w-full object-cover">
      ${tapaDeDiseno("", "", { tituloAttr: " data-ficha-tapa-titulo", autorAttr: " data-ficha-tapa-autor" })}
    </div>

    <div class="flex min-w-0 flex-col">
      <p data-ficha-categoria class="badge mb-3 self-start text-[10px]"></p>
      <h2 id="ficha-titulo" class="pr-10 outline-none font-display text-2xl font-bold leading-tight text-biblio-moss sm:text-3xl dark:text-biblio-paper"></h2>
      <p data-ficha-autor class="mt-1 text-base font-medium text-biblio-charcoal dark:text-biblio-pistachio"></p>

      <dl data-ficha-datos class="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm"></dl>

      <h3 class="mt-6 text-xs font-semibold tracking-[0.2em] text-biblio-moss uppercase dark:text-biblio-pistachio">Sinopsis</h3>
      <div data-ficha-sinopsis class="ficha-sinopsis mt-2 text-sm leading-relaxed text-biblio-charcoal dark:text-biblio-paper/90"></div>
      <p data-ficha-fuente class="muted mt-2 text-xs"></p>

      <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-biblio-pistachio/60 pt-5 dark:border-biblio-moss">
        <a data-ficha-whatsapp href="${esc(enlaceWhatsApp)}" target="_blank" rel="noopener" class="btn btn-primary">
          Consultar por WhatsApp
          <span class="sr-only"> si está disponible (se abre en una pestaña nueva)</span>
        </a>
      </div>
    </div>
  </div>
</dialog>`;

// Novedades para el inicio
const novedadesHTML = `<div class="mt-10">
  <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
${NOVEDADES_LITERARIAS.map(tarjetaLibro).join("\n")}
  </ul>
  ${aclaracionPortadas}
</div>
${datosFichasJSON(NOVEDADES_LITERARIAS)}`;

const catalogoHTML = CATALOGO_DESTACADO_PUBLICADO
  ? (() => {
      const catalogoListaHTML = CATALOGO_DESTACADO.map((seccion) => {
        const libros = seccion.libros.map(tarjetaLibro).join("\n");
        return `      <div class="mt-12 first:mt-0">
          <h3 class="font-display text-2xl font-bold text-biblio-moss dark:text-biblio-paper">${esc(seccion.seccion)}</h3>
          <ul class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
${libros}
          </ul>
        </div>`;
      }).join("\n");

      return `<p class="section-lead">
          Una selección de lo que vas a encontrar. Tocá cualquier libro para ver su tapa, la sinopsis y consultar si está disponible.
        </p>
        <div class="mt-10">
${catalogoListaHTML}
        </div>
        ${aclaracionPortadas}
        ${datosFichasJSON(CATALOGO_DESTACADO.flatMap((s) => s.libros))}`;
    })()
  : proximamenteHTML(
      "Estamos armando una selección de libros recomendados por la biblioteca. Mientras tanto, acercate a la biblioteca o escribinos para consultar por un libro."
    );

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
  : `<div class="card-proximamente mt-6" role="status">
          <p class="badge-proximamente">Próximamente</p>
          <p class="mt-2 max-w-2xl text-sm text-biblio-charcoal dark:text-biblio-pistachio">
            Estamos reuniendo poemas y textos de Edgar Morisoli y de otros autores pampeanos que se puedan
            compartir libremente. Mientras tanto, sus libros están en nuestros estantes: consultá por ellos en la biblioteca.
          </p>
        </div>`;

const bibliotecasDigitalesHTML = `<ul class="mt-6 grid gap-4 sm:grid-cols-2">
${BIBLIOTECAS_DIGITALES.map((b) => tarjetaLectura({ titulo: b.nombre, descripcion: b.descripcion, url: b.url })).join("\n")}
        </ul>`;

// --- Buscador del catálogo ---------------------------------------------------
// Mientras CONABIP no confirme la dirección del catálogo, el buscador se ve
// desenfocado e inutilizable (inert: no recibe clics, foco ni teclado) con un
// cartel encima, y no queda ningún enlace a DigiBepé en la página.
const catalogoListo = conabip.catalogoDisponible === true;

const catalogoBuscador = catalogoListo
  ? {
      CATALOGO_URL: conabip.catalogo,
      // El formulario busca en la API propia; la dirección de DigiBepé no se publica.
      CATALOGO_BUSQUEDA: "/api/catalogo",
      CATALOGO_ALTO: "",
      CATALOGO_BLOQUEO: "",
      CATALOGO_AVISO: "",
    }
  : {
      CATALOGO_URL: "",
      CATALOGO_BUSQUEDA: "",
      // Alto mínimo para que el cartel no se salga del bloque en escritorio.
      CATALOGO_ALTO: " min-h-52",
      CATALOGO_BLOQUEO: ' class="pointer-events-none select-none blur-[3px] opacity-70" inert aria-hidden="true"',
      CATALOGO_AVISO: `<div class="absolute inset-0 grid place-items-center p-4">
            <div class="card-proximamente max-w-md bg-biblio-paper/95 text-center shadow-lg dark:bg-biblio-charcoal/95" role="status">
              <p class="badge-proximamente">Próximamente</p>
              <p class="mt-3 text-sm text-biblio-charcoal dark:text-biblio-pistachio">
                Muy pronto vas a poder buscar libros en nuestro catálogo desde acá.
                Mientras tanto, consultanos por correo o acercate a la biblioteca.
              </p>
            </div>
          </div>`,
    };

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
  WHATSAPP: contacto.whatsapp,
  ...catalogoBuscador,
  FUNDACION: BIBLIOTECA.fundacion,
  ANIO_FUNDACION: BIBLIOTECA.anioFundacion,
  CATALOGO_DESTACADO: catalogoHTML,
  NOVEDADES_LITERARIAS: novedadesHTML,
  // La ficha (modal) va suelta: la usan tanto los destacados como los
  // resultados del buscador, aunque los destacados no estén publicados.
  FICHA_LIBRO: fichaLibroHTML,
  LECTURA_PAMPEANA: lecturaPampeanaHTML,
  LECTURA_BIBLIOTECAS: bibliotecasDigitalesHTML,
  // El libro animado chico, para poner dentro de los bloques de carga.
  LOADER_LIBRO: loader.trim(),
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
