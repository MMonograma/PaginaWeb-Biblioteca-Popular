// ---------------------------------------------------------------------------
// FUENTE ÚNICA DE DATOS INSTITUCIONALES
//
// Todo lo de este archivo se usa en dos lugares a la vez:
//   1. El generador (build.js) lo escribe dentro del HTML: footer, acordeón de
//      horarios, sección Quiénes Somos.
//   2. Se copia a public/js/datos.js para que el navegador calcule el estado
//      "abierto / cerrado" de hoy.
//
// Si cambia un horario o un teléfono, se cambia ACÁ y en ningún otro lado.
// ---------------------------------------------------------------------------

export const BIBLIOTECA = {
  nombre: "Biblioteca Popular Edgar Morisoli",
  nombreCorto: "Edgar Morisoli",

  direccion: {
    calle: "Victor Lordi 73",
    ciudad: "Santa Rosa",
    provincia: "La Pampa",
    codigoPostal: "6300",
    pais: "Argentina",
    // Verificadas en OpenStreetMap el 2026-09-20 para "Víctor Lordi 73, Santa Rosa".
    lat: -36.6277361,
    lon: -64.3046025,
  },

  contacto: {
    telefono: "2954-610340",
    telefonoLink: "+542954610340",
    // Sin +, sin espacios ni guiones: formato que pide la API de wa.me.
    whatsapp: "5492954610340",
    email: "bibliotecapopularedgarmorisoli@gmail.com",
    instagram: "https://www.instagram.com/bibliotecaedgarmorisoli",
    instagramUsuario: "@bibliotecaedgarmorisoli",
    // Pendiente de confirmar con la biblioteca antes de publicarlo.
    facebook: "",
  },

  conabip: {
    registro: "4124",
    // El subdominio del OPAC es el número de registro CONABIP.
    // Solo HTTP: su certificado es de otro dominio, así que HTTPS da error.
    catalogo: "http://4124.bepe.ar",
    catalogoBusqueda: "http://4124.bepe.ar/cgi-bin/koha/opac-search.pl",
  },

  // El sitio afirma 2002; CONABIP y la prensa local apuntan a 2003.
  // Se mantiene lo que ya estaba cargado hasta que la biblioteca lo confirme.
  fundacion: "24 de agosto de 2002",
  anioFundacion: 2002,
};

// Tramos de atención por día. Índice = día de la semana (0 = domingo).
// Cada tramo es [horaDesde, minutoDesde, horaHasta, minutoHasta].
export const HORARIOS = {
  0: [],
  1: [],
  2: [[9, 0, 12, 30], [16, 30, 20, 0]],
  3: [[9, 0, 12, 30], [16, 30, 20, 0]],
  4: [[9, 0, 12, 30], [16, 30, 20, 0]],
  5: [[9, 0, 12, 30], [16, 30, 20, 0]],
  6: [],
};

export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Navegación principal. Un solo lugar para el orden y los nombres del menú.
export const MENU = [
  { texto: "Inicio", url: "index.html" },
  { texto: "Quiénes Somos", url: "quienes-somos.html" },
  { texto: "Noticias", url: "noticias.html" },
  { texto: "Talleres", url: "talleres.html" },
  { texto: "Catálogo", url: "catalogo.html" },
  {
    texto: "Proyectos",
    hijos: [
      { texto: "Biblio-Interactiva", url: "biblio-interactiva.html" },
      { texto: "Extensión Cultural", url: "extension-cultural.html" },
      { texto: "Flotilla Literaria", url: "flotilla-literaria.html" },
      { texto: "Sala de Pensamiento", url: "sala-pensamiento.html" },
    ],
  },
];
