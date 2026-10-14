// ---------------------------------------------------------------------------
// TÍTULOS DESTACADOS DEL CATÁLOGO Y NOVEDADES LITERARIAS
//
// Esta lista alimenta la vidriera de libros en catalogo.html e index.html.
// Cada libro se enlaza a una búsqueda por título en el OPAC de DigiBepé.
// Las portadas se obtienen mediante Open Library Covers API por ISBN, con
// respaldo automático de diseño editorial en caso de no contar con imagen.
// ---------------------------------------------------------------------------

export const CATALOGO_DESTACADO_PUBLICADO = true;

// Novedades para la página de inicio (Home)
export const NOVEDADES_LITERARIAS = [
  {
    titulo: "La Vegetariana",
    autor: "Han Kang",
    isbn: "9788426404244",
    categoria: "Premio Nobel",
  },
  {
    titulo: "Ladrilleros",
    autor: "Selva Almada",
    isbn: "9789876701778",
    categoria: "Literatura argentina",
  },
  {
    titulo: "El resplandor",
    autor: "Stephen King",
    isbn: "9788497593793",
    categoria: "Terror",
  },
  {
    titulo: "Las malas",
    autor: "Camila Sosa Villada",
    isbn: "9788417617547",
    categoria: "Narrativa contemporánea",
  },
];

export const CATALOGO_DESTACADO = [
  {
    seccion: "Literatura contemporánea",
    libros: [
      { titulo: "La Vegetariana", autor: "Han Kang", isbn: "9788426404244" },
      { titulo: "Ladrilleros", autor: "Selva Almada", isbn: "9789876701778" },
      { titulo: "Las malas", autor: "Camila Sosa Villada", isbn: "9788417617547" },
      { titulo: "Los sorrentinos", autor: "Virginia Higa", isbn: "9789873752766" },
      { titulo: "Temporada de Huracanes", autor: "Fernanda Melchor", isbn: "9788439733478" },
      { titulo: "Galaxia", autor: "Juan Solá", isbn: "9789877186109" },
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
      { titulo: "El resplandor", autor: "Stephen King", isbn: "9788497593793" },
      { titulo: "It (Eso)", autor: "Stephen King", isbn: "9788466345347" },
      { titulo: "Misery (Miseria)", autor: "Stephen King", isbn: "9788497595469" },
      { titulo: "Cementerio de animales", autor: "Stephen King", isbn: "9788497594349" },
      { titulo: "La asistenta", autor: "Freida McFadden", isbn: "9788418045950" },
      { titulo: "La mujer de arriba", autor: "Freida McFadden" },
      { titulo: "El secreto de la asistenta", autor: "Freida McFadden" },
      { titulo: "La asistenta te vigila", autor: "Freida McFadden" },
    ],
  },
];
