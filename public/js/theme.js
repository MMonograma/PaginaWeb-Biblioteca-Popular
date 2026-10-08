// Se carga de forma bloqueante en <head>: aplica el tema antes del primer pintado
// para evitar el destello blanco. No puede ser inline porque la CSP del sitio
// prohíbe scripts inline (script-src 'self').
(() => {
  // Marca que hay JavaScript: el CSS sólo muestra los loaders de sección bajo
  // html.js, así que si el JS no corre nunca queda un libro girando para siempre.
  document.documentElement.classList.add("js");
  try {
    const guardado = localStorage.getItem("tema");
    const prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (guardado === "oscuro" || (guardado === null && prefiereOscuro)) {
      document.documentElement.classList.add("dark");
    }
  } catch {
    // localStorage bloqueado (modo privado, cookies deshabilitadas): queda el tema claro.
  }
})();
