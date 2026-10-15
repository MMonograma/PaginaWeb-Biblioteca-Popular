// ---------------------------------------------------------------------------
// TÍTULOS DESTACADOS DEL CATÁLOGO Y NOVEDADES LITERARIAS
//
// Esta lista alimenta la vidriera de libros en catalogo.html e index.html.
// Al tocar un libro se abre una ficha (modal) con tapa, sinopsis y datos de
// la edición, más un botón para consultar disponibilidad por WhatsApp.
//
// Portadas y sinopsis: NO se cargan acá. Las busca `npm run libros` por
// título + autor en Google Books y Open Library, y quedan guardadas en
// src/datos/libros-info.json. Cuando agregues un libro nuevo:
//     1. Sumalo a la lista de abajo (titulo y autor alcanzan).
//     2. npm run libros
//     3. npm run build
//
// Si la búsqueda trae algo equivocado, se corrige acá, libro por libro:
//   portada:    "https://..."  URL de la tapa que querés mostrar.
//               false          no buscar tapa: usar siempre la de diseño.
//   sinopsis:   "Texto..."     reemplaza la sinopsis encontrada.
//   buscarComo: "Otro título"  título con el que buscar (p. ej. el original).
//   editorial, anio, paginas, isbn: reemplazan los datos encontrados.
//
// Los ISBN que había antes se quitaron: varios eran de otros libros (el de
// «Ladrilleros» mostraba una novela de Petros Márkaris y el de «El
// resplandor», la tapa de «It»).
// ---------------------------------------------------------------------------

export const CATALOGO_DESTACADO_PUBLICADO = true;

// Novedades para la página de inicio (Home)
export const NOVEDADES_LITERARIAS = [
  {
    titulo: "La Vegetariana",
    autor: "Han Kang",
    categoria: "Premio Nobel",
  },
  {
    titulo: "Ladrilleros",
    autor: "Selva Almada",
    categoria: "Literatura argentina",
  },
  {
    titulo: "El resplandor",
    autor: "Stephen King",
    categoria: "Terror",
  },
  {
    titulo: "Las malas",
    autor: "Camila Sosa Villada",
    categoria: "Narrativa contemporánea",
  },
];

export const CATALOGO_DESTACADO = [
  {
    seccion: "Literatura contemporánea",
    libros: [
      { titulo: "La Vegetariana", autor: "Han Kang" },
      { titulo: "Ladrilleros", autor: "Selva Almada" },
      { titulo: "Las malas", autor: "Camila Sosa Villada" },
      { titulo: "Los sorrentinos", autor: "Virginia Higa" },
      { titulo: "Temporada de Huracanes", autor: "Fernanda Melchor" },
      { titulo: "Galaxia", autor: "Juan Solá" },
      { titulo: "Soy toda oídos", autor: "Kim Hye Jin" },
      { titulo: "Piedra sobre Piedra", autor: "Nina Ferrari" },
      { titulo: "Las amigas", autor: "Aurora Venturini" },
      { titulo: "Cuentos Completos", autor: "Evelio Rosero" },
      { titulo: "La novia de Sandro", autor: "Camila Sosa Villada" },
      { titulo: "El marido de mi madrastra", autor: "Aurora Venturini" },
      { titulo: "Tracción a sangre", autor: "José Luis Pascuet" },
      { titulo: "Sustancia", autor: "Nina Ferrari" },
      { titulo: "Sobre mi hija", autor: "Kim Hye Jin" },
      { titulo: "Los jardines de Juana", autor: "Natalia Bericat" },
      { titulo: "Alarido", autor: "Nina Ferrari" },
      { titulo: "Los amores urgentes", autor: "Juan Solá" },
      { titulo: "El viaje inútil", autor: "Camila Sosa Villada" },
      { titulo: "Mariposas Negras", autor: "Nina Ferrari" },
      { titulo: "Épica Urbana", autor: "Juan Solá" },
      { titulo: "Soy una tonta por quererte", autor: "Camila Sosa Villada" },
      { titulo: "La traición de mi lengua", autor: "Camila Sosa Villada" },
      { titulo: "Malparidas", autor: "Natalia Bericat" },
      { titulo: "El buen mal", autor: "Samanta Schweblin" },
    ],
  },
  {
    seccion: "Terror y Suspenso",
    libros: [
      { titulo: "El resplandor", autor: "Stephen King" },
      { titulo: "It (Eso)", autor: "Stephen King" },
      { titulo: "Misery (Miseria)", autor: "Stephen King" },
      { titulo: "Cementerio de animales", autor: "Stephen King" },
      { titulo: "La asistenta", autor: "Freida McFadden" },
      { titulo: "La mujer de arriba", autor: "Freida McFadden" },
      { titulo: "El secreto de la asistenta", autor: "Freida McFadden" },
      { titulo: "La asistenta te vigila", autor: "Freida McFadden" },
    ],
  },
];
