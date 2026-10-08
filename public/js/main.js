// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA
// Arranca lo que corresponda según lo que tenga cada página: cada función
// revisa si su contenedor existe y, si no está, no hace nada.
// ---------------------------------------------------------------------------

import { iniciarMenu, iniciarTema, iniciarAcordeones, pintarEstado, iniciarVarios } from "./interfaz.js";
import { iniciarMapa } from "./mapa.js";
import { cargarTalleres } from "./talleres.js";
import { cargarNoticias } from "./noticias.js";
import { iniciarBuscadorCatalogo } from "./catalogo.js";
import { iniciarRecorrido } from "./recorrido.js";
import { iniciarLoaders } from "./loader-libro.js";

iniciarMenu();
iniciarTema();
iniciarAcordeones();
pintarEstado();
iniciarMapa();
iniciarBuscadorCatalogo();
iniciarRecorrido();
iniciarVarios();
iniciarLoaders();

// --- Datos de afuera ---------------------------------------------------------
// Cada sección muestra su propio libro animado mientras carga (está dentro de
// su bloque de carga) y lo saca cuando llegan sus datos. No se espera a nadie:
// talleres y noticias aparecen cada uno apenas está listo.

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
