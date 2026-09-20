// ---------------------------------------------------------------------------
// BUSCADOR DEL CATÁLOGO (DigiBepé / Koha)
//
// El catálogo de la biblioteca vive en http://4124.bepe.ar, que todavía no
// tiene HTTPS propio. Eso trae dos límites comprobados:
//
//   1. No se puede leer con fetch ni mostrar en un iframe: el navegador
//      bloquea contenido HTTP dentro de una página HTTPS.
//   2. Un <form action="http://..."> tampoco sirve: la cabecera
//      upgrade-insecure-requests del sitio lo reescribe a HTTPS y falla,
//      porque el certificado de ese servidor es de otro dominio.
//
// Los enlaces y las ventanas nuevas sí funcionan. Por eso el formulario no
// envía nada por su cuenta: se arma la URL y se abre en una pestaña aparte,
// igual que si la persona hubiera hecho clic en un enlace. Así el sitio
// conserva su CSP estricta.
// ---------------------------------------------------------------------------

export function iniciarBuscadorCatalogo() {
  const form = document.getElementById("buscador-catalogo");
  if (!form) return;

  const base = form.dataset.catalogoUrl;
  if (!base) return;

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const termino = form.querySelector("#catalogo-q").value.trim();
    if (!termino) return;

    const indice = form.querySelector("#catalogo-idx").value;
    const url = new URL(base);
    if (indice) url.searchParams.set("idx", indice);
    url.searchParams.set("q", termino);

    window.open(url.toString(), "_blank", "noopener");
  });
}
