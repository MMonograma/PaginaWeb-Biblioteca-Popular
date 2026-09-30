/*
  loader-libro.js
  Pantalla de carga: un libro sale del estante, se abre y pasa las hojas.

  El dibujo vive en src/parciales/loader.html (dentro de <div id="app-loader">).
  Este archivo sólo lo prende y lo apaga.

  Se carga en el <head> y SIN type="module", a propósito:
    1. Marca <html> con la clase "js" antes del primer pintado. El CSS sólo
       muestra el loader bajo html.js, así que si el JavaScript no corre
       (bloqueado, navegador viejo) el loader nunca tapa la página.
    2. Deja mostrarLoader() y ocultarLoader() como funciones globales antes
       de que arranque main.js.

  Uso:
    mostrarLoader();  ...  ocultarLoader();
    await loaderLibro.durante(fetch("/data/noticias.json"));

  Funciona con un contador: si hay dos cargas en paralelo, el loader recién se
  va cuando terminan las dos. Así no se esconde a mitad de camino.
*/
(function () {
  document.documentElement.classList.add("js");

  var pendientes = 0;
  var menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");

  function capa() {
    return document.getElementById("app-loader");
  }

  // Con "reducir movimiento" activado, el libro queda quieto en el estante.
  function ajustarAnimacion(svg) {
    if (!svg) return;
    if (menosMovimiento.matches) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }

  function mostrarLoader() {
    pendientes++;
    var el = capa();
    if (!el || pendientes > 1) return;
    var svg = el.querySelector("svg");
    if (!el.hasAttribute("data-visible")) {
      el.setAttribute("data-visible", "");
      if (svg) svg.setCurrentTime(0); // arranca desde el estante
    }
    ajustarAnimacion(svg);
  }

  function ocultarLoader() {
    pendientes = Math.max(0, pendientes - 1);
    if (pendientes === 0) capa()?.removeAttribute("data-visible");
  }

  function durante(promesa) {
    mostrarLoader();
    return Promise.resolve(promesa).finally(ocultarLoader);
  }

  window.mostrarLoader = mostrarLoader;
  window.ocultarLoader = ocultarLoader;
  window.loaderLibro = { mostrar: mostrarLoader, ocultar: ocultarLoader, durante: durante };

  document.addEventListener("DOMContentLoaded", function () {
    ajustarAnimacion(capa()?.querySelector("svg"));
  });
})();
