// ---------------------------------------------------------------------------
// INTERFAZ — menú, tema, acordeón y estado de apertura.
// Todo lo que toca el DOM directamente y no depende de datos externos.
// ---------------------------------------------------------------------------

import { HORARIOS, DIAS } from "./datos.js";

// --- Menú -------------------------------------------------------------------

export function iniciarMenu() {
  const toggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");
  if (!toggle || !menu) return;

  const submenuBtn = document.getElementById("proyectos-btn");
  const submenu = document.getElementById("proyectos-menu");

  const cerrarSubmenu = () => {
    if (!submenu) return;
    submenu.classList.add("hidden");
    submenuBtn.setAttribute("aria-expanded", "false");
    submenuBtn.querySelector("[data-chevron]")?.classList.remove("rotate-180");
  };

  const cerrarMenu = () => {
    menu.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
    cerrarSubmenu();
  };

  toggle.addEventListener("click", () => {
    const abierto = !menu.classList.toggle("hidden");
    toggle.setAttribute("aria-expanded", String(abierto));
    if (!abierto) cerrarSubmenu();
  });

  if (submenu) {
    submenuBtn.addEventListener("click", () => {
      const abierto = !submenu.classList.toggle("hidden");
      submenuBtn.setAttribute("aria-expanded", String(abierto));
      submenuBtn.querySelector("[data-chevron]")?.classList.toggle("rotate-180", abierto);
    });
  }

  // Al elegir un enlace se cierra todo; el clic en el botón del submenú no cuenta.
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) cerrarMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // Escape cierra primero el submenú y devuelve el foco a su botón.
    if (submenu && !submenu.classList.contains("hidden")) {
      cerrarSubmenu();
      submenuBtn.focus();
      return;
    }
    if (!menu.classList.contains("hidden")) {
      cerrarMenu();
      toggle.focus();
    }
  });

  // Un clic fuera del submenú lo cierra (comportamiento esperado en escritorio).
  document.addEventListener("click", (e) => {
    if (!submenu || submenu.classList.contains("hidden")) return;
    if (!e.target.closest("#proyectos-menu") && !e.target.closest("#proyectos-btn")) cerrarSubmenu();
  });
}

// --- Tema claro / oscuro ----------------------------------------------------
// theme.js ya aplicó el tema antes del primer pintado; acá solo se cambia.

export function iniciarTema() {
  const boton = document.getElementById("tema-toggle");
  if (!boton) return;

  const sincronizar = () => {
    const oscuro = document.documentElement.classList.contains("dark");
    boton.setAttribute("aria-pressed", String(oscuro));
    boton.setAttribute("aria-label", oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    document.getElementById("icono-sol")?.classList.toggle("hidden", !oscuro);
    document.getElementById("icono-luna")?.classList.toggle("hidden", oscuro);
  };

  boton.addEventListener("click", () => {
    const oscuro = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("tema", oscuro ? "oscuro" : "claro");
    } catch {
      // Sin localStorage el cambio vale solo para esta visita.
    }
    sincronizar();
  });

  sincronizar();
}

// --- Estado de apertura de hoy ---------------------------------------------

const hhmm = (h, m) => `${h}:${String(m).padStart(2, "0")}`;

export function estadoDeHoy(ahora = new Date()) {
  const tramos = HORARIOS[ahora.getDay()] ?? [];
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  for (const [hi, mi, hf, mf] of tramos) {
    const desde = hi * 60 + mi;
    const hasta = hf * 60 + mf;
    if (minutosAhora >= desde && minutosAhora < hasta) {
      return { abierto: true, texto: `Abierto ahora · hasta las ${hhmm(hf, mf)} hs` };
    }
    if (minutosAhora < desde) {
      return { abierto: false, texto: `Hoy abrimos de ${hhmm(hi, mi)} a ${hhmm(hf, mf)} hs` };
    }
  }

  // Ya cerró por hoy (o hoy no abre): se busca el próximo día con atención.
  for (let i = 1; i <= 7; i++) {
    const dia = (ahora.getDay() + i) % 7;
    const tramosSiguiente = HORARIOS[dia] ?? [];
    if (tramosSiguiente.length) {
      const [hi, mi, hf, mf] = tramosSiguiente[0];
      const cuando = i === 1 ? "mañana" : `el ${DIAS[dia]}`;
      return { abierto: false, texto: `Cerrado · Abrimos ${cuando} de ${hhmm(hi, mi)} a ${hhmm(hf, mf)} hs` };
    }
  }

  return { abierto: false, texto: "Consultá nuestros horarios" };
}

export function pintarEstado() {
  const texto = document.getElementById("estado-texto");
  if (!texto) return;

  const { abierto, texto: mensaje } = estadoDeHoy();
  texto.textContent = mensaje;

  const punto = document.getElementById("estado-punto");
  if (punto) {
    // El color no va solo: el texto ya dice "Abierto" o "Cerrado".
    punto.classList.toggle("bg-green-600", abierto);
    punto.classList.toggle("bg-biblio-sage", !abierto);
  }
  document.getElementById("estado-pulso")?.classList.toggle("hidden", !abierto);
}

// --- Acordeón ---------------------------------------------------------------
// Sirve para cualquier bloque desplegable: el botón declara a qué panel
// controla con aria-controls y el panel anima su altura con grid.

export function iniciarAcordeones() {
  for (const boton of document.querySelectorAll("[data-acordeon]")) {
    const panel = document.getElementById(boton.getAttribute("aria-controls"));
    if (!panel) continue;

    boton.addEventListener("click", () => {
      const abierto = boton.getAttribute("aria-expanded") !== "true";
      boton.setAttribute("aria-expanded", String(abierto));
      panel.classList.toggle("grid-rows-abierto", abierto);
      panel.classList.toggle("grid-rows-cerrado", !abierto);
      boton.querySelector("[data-chevron]")?.classList.toggle("rotate-180", abierto);
      // El panel cerrado queda fuera del recorrido con Tab y de los lectores.
      panel.setAttribute("aria-hidden", String(!abierto));
    });
  }
}

// --- Varios -----------------------------------------------------------------

export function iniciarVarios() {
  // Las imágenes marcadas como opcionales desaparecen si todavía no se cargaron.
  for (const img of document.querySelectorAll("img[data-optional]")) {
    img.addEventListener("error", () => img.remove());
  }

  // Tapas de los libros destacados. build.js deja la primera URL en src y el
  // resto en data-respaldo (separadas por espacios). Si una no carga, o el
  // servidor devuelve una imagen vacía (1 px de Open Library, cartel "image
  // not available" de 128×170 de Google), se prueba la siguiente. Si se
  // acaban, se avisa con el evento "tapa-agotada": libros.js lo toma y busca
  // por título y autor. Mientras tanto se ve la tapa de diseño de abajo.
  const vacia = (img) =>
    img.naturalWidth < 10 ||
    (img.src.includes("books.google") && img.naturalWidth === 128 && img.naturalHeight === 170);

  for (const img of document.querySelectorAll("img[data-portada][src]")) {
    const fallar = () => {
      const [siguiente, ...resto] = (img.dataset.respaldo ?? "").split(" ").filter(Boolean);
      if (siguiente) {
        img.dataset.respaldo = resto.join(" ");
        img.src = siguiente;
        return;
      }
      img.removeEventListener("error", fallar);
      img.removeEventListener("load", cargo);
      img.classList.add("invisible");
      img.removeAttribute("src");
      img.dataset.sinTapa = "";
      img.dispatchEvent(new CustomEvent("tapa-agotada", { bubbles: true }));
    };
    const cargo = () => (vacia(img) ? fallar() : img.classList.remove("invisible"));
    img.addEventListener("error", fallar);
    img.addEventListener("load", cargo);
    // Por si la imagen ya cargó o ya falló antes de que corriera este script
    // (pasa con una URL rota: el error llega antes que el JS y se perdía).
    // complete es false en una imagen lazy que todavía no se pidió, así que
    // ahí no se confunde "sin pedir" con "rota".
    if (img.complete) img.naturalWidth > 0 ? cargo() : fallar();
  }
}
