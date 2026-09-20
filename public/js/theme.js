// Se carga de forma bloqueante en <head>: aplica el tema antes del primer pintado
// para evitar el destello blanco. No puede ser inline porque la CSP del sitio
// prohíbe scripts inline (script-src 'self').
(() => {
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
