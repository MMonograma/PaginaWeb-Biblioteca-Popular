// ---------------------------------------------------------------------------
// LOADERS DE SECCIÓN — el libro animado chico.
//
// El dibujo vive en src/parciales/loader.html y build.js lo pone dentro de los
// bloques grises de carga de cada sección que trae datos de afuera (talleres,
// noticias). No hay que encenderlo ni apagarlo: cuando talleres.js o
// noticias.js ocultan su bloque de carga, el libro se va con él.
//
// Antes era una pantalla completa que tapaba toda la página hasta que llegaban
// los datos; eso demoraba lo que la gente veía (y lo que mide Lighthouse).
// Ahora el resto de la página aparece al instante y sólo espera lo que falta.
//
// Lo único que hace este archivo: con "reducir movimiento" activado en el
// sistema, el libro queda quieto en el estante.
// ---------------------------------------------------------------------------

const menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");

function ajustar() {
  for (const svg of document.querySelectorAll(".loader-libro svg")) {
    if (menosMovimiento.matches) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }
}

export function iniciarLoaders() {
  ajustar();
  menosMovimiento.addEventListener("change", ajustar);
}
