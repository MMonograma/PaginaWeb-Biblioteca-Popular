// ---------------------------------------------------------------------------
// MAPA CON CARGA DIFERIDA
//
// El iframe de Google Maps trae sus propias cookies y scripts, así que no se
// carga con la página: aparece un panel con la dirección y un botón. Recién al
// pulsarlo se inserta el iframe. Beneficios: la página inicial no pide nada a
// Google y pesa menos.
//
// Requiere que la CSP permita https://www.google.com en frame-src.
// ---------------------------------------------------------------------------

export function iniciarMapa() {
  const boton = document.querySelector("[data-cargar-mapa]");
  const contenedor = document.getElementById("mapa");
  if (!boton || !contenedor) return;

  boton.addEventListener("click", () => {
    const lat = contenedor.dataset.mapaLat;
    const lon = contenedor.dataset.mapaLon;
    const titulo = contenedor.dataset.mapaTitulo || "Mapa de ubicación";

    const iframe = document.createElement("iframe");
    // Formato de inserción de Google Maps que no necesita clave de API.
    iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}&z=17&hl=es&output=embed`;
    iframe.title = titulo;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.className = "h-full w-full border-0";
    iframe.setAttribute("allowfullscreen", "");

    contenedor.replaceChildren(iframe);
  });
}
