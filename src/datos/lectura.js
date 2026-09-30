// ---------------------------------------------------------------------------
// LECTURA VIRTUAL 24/7
//
// Enlaces para leer cuando la biblioteca está cerrada. build.js los convierte
// en tarjetas dentro de la sección #lectura-virtual de catalogo.html.
//
// Para sumar un enlace, se agrega un objeto a la lista que corresponda y se
// corre `npm run build`.
// ---------------------------------------------------------------------------

// Rincón Pampeano / Edgar Morisoli.
//
// Está vacío a propósito: Morisoli es un autor contemporáneo y su obra sigue
// protegida por derechos de autor (en Argentina, hasta 70 años después de la
// muerte del autor). Sólo se pueden cargar textos con permiso de sus herederos
// o de la editorial, o publicaciones que ya estén difundidas oficialmente en
// internet (por ejemplo, por el Fondo Editorial Pampeano o por la prensa).
//
// Cada entrada: { titulo, autor, descripcion, url }
//   url puede ser externa (https://...) o un PDF propio en public/lecturas/.
// Mientras la lista esté vacía, la sección muestra un aviso de "en preparación".
export const RINCON_PAMPEANO = [];

// Bibliotecas digitales gratuitas. Enlaces verificados el 2026-09-30.
export const BIBLIOTECAS_DIGITALES = [
  {
    nombre: "Catálogo colectivo de CONABIP",
    descripcion: "Buscá un libro en las bibliotecas populares de todo el país y enterate en cuál está.",
    url: "https://www.conabip.gob.ar/catalogo_colectivo",
  },
  {
    nombre: "Biblioteca del Congreso de la Nación",
    descripcion: "Publicaciones digitales de la BCN, de consulta libre y gratuita.",
    url: "https://bcn.gob.ar/biblioteca-digital",
  },
  {
    nombre: "Biblioteca Virtual Miguel de Cervantes",
    descripcion: "Clásicos de la literatura en español para leer en línea.",
    url: "https://www.cervantesvirtual.com/",
  },
  {
    nombre: "Project Gutenberg en español",
    descripcion: "Libros de dominio público para leer en el navegador o descargar en EPUB.",
    url: "https://www.gutenberg.org/browse/languages/es",
  },
];
