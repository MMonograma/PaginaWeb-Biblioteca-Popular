// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA
// Arranca lo común de la interfaz y carga los módulos específicos solo si la
// página tiene sus contenedores en el DOM (carga bajo demanda).
// ---------------------------------------------------------------------------

import { iniciarMenu, iniciarTema, iniciarAcordeones, pintarEstado, iniciarVarios } from "./interfaz.js";

// Interfaz común para todas las páginas
iniciarMenu();
iniciarTema();
iniciarAcordeones();
pintarEstado();
iniciarVarios();

// Loader animado (solo si hay loader en la página)
if (document.querySelector(".loader-libro")) {
  import("./loader-libro.js").then((m) => m.iniciarLoaders());
}

// Mapa con carga diferida (solo si hay mapa)
if (document.getElementById("mapa")) {
  import("./mapa.js").then((m) => m.iniciarMapa());
}

// Buscador del catálogo (solo en página de catálogo)
if (document.getElementById("buscador-catalogo")) {
  import("./catalogo.js").then((m) => m.iniciarBuscadorCatalogo());
}

// Recorrido 360 (solo en biblio-interactiva)
if (document.getElementById("visor-360")) {
  import("./recorrido.js").then((m) => m.iniciarRecorrido());
}

// Talleres (Inicio y Talleres)
const tieneTalleresDestacados = document.getElementById("talleres-destacados");
const tieneTalleresGrid = document.getElementById("talleres-grid");

if (tieneTalleresDestacados || tieneTalleresGrid) {
  import("./talleres.js").then(({ cargarTalleres }) => {
    if (tieneTalleresDestacados) {
      cargarTalleres({
        grilla: "talleres-destacados",
        plantilla: "tpl-taller-breve",
        skeleton: "talleres-destacados-skeleton",
        limite: 4,
      });
    }
    if (tieneTalleresGrid) {
      cargarTalleres({
        grilla: "talleres-grid",
        plantilla: "tpl-taller",
        skeleton: "talleres-skeleton",
      });
    }
  });
}

// Noticias de Instagram (solo en página de noticias)
if (document.getElementById("noticias-grid")) {
  import("./noticias.js").then(({ cargarNoticias }) => cargarNoticias());
}

