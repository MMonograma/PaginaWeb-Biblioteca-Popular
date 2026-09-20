// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA
// Arranca lo que corresponda según lo que tenga cada página: cada función
// revisa si su contenedor existe y, si no está, no hace nada.
// ---------------------------------------------------------------------------

import { iniciarMenu, iniciarTema, iniciarAcordeones, pintarEstado, iniciarVarios } from "./interfaz.js";
import { iniciarMapa } from "./mapa.js";
import { cargarTalleres, cargarNoticias } from "./secciones.js";
import { iniciarBuscadorCatalogo } from "./catalogo.js";

iniciarMenu();
iniciarTema();
iniciarAcordeones();
pintarEstado();
iniciarMapa();
iniciarBuscadorCatalogo();
iniciarVarios();

// Inicio: vista breve de cuatro talleres.
cargarTalleres({
  grilla: "talleres-destacados",
  plantilla: "tpl-taller-breve",
  skeleton: "talleres-destacados-skeleton",
  limite: 4,
});

// Página de talleres: la programación completa.
cargarTalleres({
  grilla: "talleres-grid",
  plantilla: "tpl-taller",
  skeleton: "talleres-skeleton",
});

cargarNoticias();
