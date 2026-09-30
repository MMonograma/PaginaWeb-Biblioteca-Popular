// ---------------------------------------------------------------------------
// RECORRIDO VIRTUAL 360°
//
// Usa Pannellum (https://pannellum.org, licencia MIT), guardado en
// public/vendor/pannellum-2.5.7/. Va copiado en el sitio y no enlazado a un
// CDN porque la CSP sólo permite scripts propios ('self'): abrir script-src a
// un CDN habilitaría cualquier paquete publicado ahí, no sólo este.
//
// Mientras el contenedor #visor-360 no tenga data-panorama, este archivo no
// hace nada y la librería ni se descarga: quien visita la página no paga el
// peso de un visor que todavía no tiene foto.
//
// PARA ACTIVARLO (cuando esté la foto equirectangular):
//   1. Guardar la foto en public/assets/img/recorrido-360.jpg
//      (formato 2:1, por ejemplo 6000 × 3000; conviene que pese menos de 4 MB).
//   2. En src/paginas/biblio-interactiva.html, descomentar data-panorama en
//      el <div id="visor-360">.
//   3. npm run build
//
// Si el recorrido se arma con Lumi / H5P (Virtual Tour), el resultado es otra
// página HTML y se inserta con un <iframe>. En ese caso hay que sumar 'self'
// (o el dominio donde quede) a frame-src en vercel.json.
// ---------------------------------------------------------------------------

const VERSION = "pannellum-2.5.7";

function cargarArchivo(etiqueta, atributos) {
  return new Promise((resolver, rechazar) => {
    const el = document.createElement(etiqueta);
    Object.assign(el, atributos);
    el.onload = resolver;
    el.onerror = () => rechazar(new Error(`No se pudo cargar ${atributos.src ?? atributos.href}`));
    document.head.appendChild(el);
  });
}

async function montarVisor(contenedor) {
  await Promise.all([
    cargarArchivo("link", { rel: "stylesheet", href: `vendor/${VERSION}/pannellum.css` }),
    cargarArchivo("script", { src: `vendor/${VERSION}/pannellum.js` }),
  ]);

  contenedor.replaceChildren(); // saca el cartel de "Próximamente"
  window.pannellum.viewer(contenedor, {
    type: "equirectangular",
    panorama: contenedor.dataset.panorama,
    // autoLoad: false muestra un botón "Cargar" en vez de bajar la foto
    // entera apenas se abre la página: en celular con datos móviles importa.
    autoLoad: false,
    showZoomCtrl: true,
    compass: false,
    strings: {
      loadButtonLabel: "Tocá para empezar<br>el recorrido",
      loadingLabel: "Cargando…",
      bylineLabel: "por %s",
      noPanoramaError: "No se encontró la imagen del recorrido.",
      fileAccessError: "No se pudo abrir la imagen %s.",
      malformedURLError: "La dirección de la imagen no es válida.",
      iOS8WebGLError: "Tu navegador no puede mostrar el recorrido.",
      genericWebGLError: "Tu navegador no puede mostrar el recorrido (WebGL).",
      textureSizeError: "La imagen es demasiado grande para este dispositivo (máximo %s px de ancho).",
      unknownError: "Ocurrió un error al abrir el recorrido.",
    },
  });
}

export function iniciarRecorrido() {
  const contenedor = document.getElementById("visor-360");
  if (!contenedor?.dataset.panorama) return;

  // La librería recién se pide cuando el visor está por entrar en pantalla.
  const observador = new IntersectionObserver(
    (entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      observador.disconnect();
      montarVisor(contenedor).catch((error) => console.warn("Recorrido 360:", error.message));
    },
    { rootMargin: "200px" }
  );
  observador.observe(contenedor);
}
