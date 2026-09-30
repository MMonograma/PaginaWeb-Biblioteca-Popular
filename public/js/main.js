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

iniciarMenu();
iniciarTema();
iniciarAcordeones();
pintarEstado();
iniciarMapa();
iniciarBuscadorCatalogo();
iniciarRecorrido();
iniciarVarios();

// --- Datos de afuera + pantalla de carga -----------------------------------
// Cada carga devuelve su promesa, o null si la página no tiene esa sección.
const cargas = [
  // Inicio: vista breve de cuatro talleres.
  cargarTalleres({
    grilla: "talleres-destacados",
    plantilla: "tpl-taller-breve",
    skeleton: "talleres-destacados-skeleton",
    limite: 4,
  }),
  // Página de talleres: la programación completa.
  cargarTalleres({
    grilla: "talleres-grid",
    plantilla: "tpl-taller",
    skeleton: "talleres-skeleton",
  }),
  cargarNoticias(),
].filter(Boolean);

// El loader se va recién cuando TODAS las cargas terminaron y sus tarjetas ya
// están en el DOM. allSettled (y no all) porque una carga que falla también
// termina: muestra su respaldo o su aviso, y el loader tiene que irse igual.
mostrarLoader();
Promise.allSettled(cargas).finally(ocultarLoader);
