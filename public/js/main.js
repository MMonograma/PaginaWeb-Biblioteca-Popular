// ---------------------------------------------------------------------------
// CONFIGURACIÓN — los tres valores que hay que completar
// ---------------------------------------------------------------------------

const WHATSAPP = "5492954610340"; // sin +, sin espacios. VERIFICAR con la biblioteca.

// Publicá cada pestaña con Archivo > Compartir > Publicar en la web > CSV
// y pegá acá la URL. Con el valor vacío se muestran los datos de respaldo.
const SHEETS = {
  talleres: "",
  noticias: "",
};

// Martes a viernes: 9 a 12:30 y 16:30 a 20. Índice = día de la semana (0 = domingo).
const HORARIOS = {
  0: [],
  1: [],
  2: [[9, 0, 12, 30], [16, 30, 20, 0]],
  3: [[9, 0, 12, 30], [16, 30, 20, 0]],
  4: [[9, 0, 12, 30], [16, 30, 20, 0]],
  5: [[9, 0, 12, 30], [16, 30, 20, 0]],
  6: [],
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Se usan si la hoja de cálculo todavía no está publicada o si falla la conexión.
const TALLERES_RESPALDO = [
  { categoria: "Infancias", titulo: "Arte y Literatura", horario: "Consultar días y horarios", tallerista: "", descripcion: "Taller de arte y literatura para las infancias del barrio." },
  { categoria: "Anual", titulo: "Club del Crochet", horario: "Taller anual", tallerista: "", descripcion: "Encuentros para aprender y compartir crochet." },
  { categoria: "Adultxs mayores", titulo: "Poesía, Memoria y Expresión", horario: "Consultar días y horarios", tallerista: "", descripcion: "Un espacio de escritura y memoria para adultxs mayores." },
  { categoria: "Arte gráfico", titulo: "La Juglaría", horario: "Consultar días y horarios", tallerista: "", descripcion: "Taller de arte gráfico." },
  { categoria: "Historietas", titulo: "Viñetas en la biblio", horario: "Consultar días y horarios", tallerista: "", descripcion: "Taller de historietas." },
  { categoria: "Cine", titulo: "Ciclo de cine", horario: "Último viernes de cada mes", tallerista: "", descripcion: "Proyección y charla abierta a la comunidad." },
  { categoria: "Infancias", titulo: "Música y Literatura", horario: "Consultar días y horarios", tallerista: "", descripcion: "Taller de música y literatura para las infancias." },
  { categoria: "Cuerpo", titulo: "Yoga", horario: "Consultar días y horarios", tallerista: "", descripcion: "Clases de yoga abiertas a la comunidad." },
];

// ---------------------------------------------------------------------------
// Menú móvil
// ---------------------------------------------------------------------------

const menuToggle = document.getElementById("menu-toggle");
const menu = document.getElementById("menu");

const cerrarMenu = () => {
  menu.classList.add("hidden");
  menuToggle.setAttribute("aria-expanded", "false");
};

menuToggle.addEventListener("click", () => {
  const abierto = !menu.classList.toggle("hidden");
  menuToggle.setAttribute("aria-expanded", String(abierto));
});

menu.addEventListener("click", (e) => {
  if (e.target.closest("a")) cerrarMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarMenu();
});

// ---------------------------------------------------------------------------
// Modo claro / oscuro — theme.js ya aplicó el tema inicial antes del pintado
// ---------------------------------------------------------------------------

const temaToggle = document.getElementById("tema-toggle");

const sincronizarTema = () => {
  const oscuro = document.documentElement.classList.contains("dark");
  temaToggle.setAttribute("aria-pressed", String(oscuro));
  temaToggle.setAttribute("aria-label", oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  document.getElementById("icono-sol").classList.toggle("hidden", !oscuro);
  document.getElementById("icono-luna").classList.toggle("hidden", oscuro);
};

temaToggle.addEventListener("click", () => {
  const oscuro = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("tema", oscuro ? "oscuro" : "claro");
  } catch {
    // Sin localStorage el cambio vale solo para esta visita.
  }
  sincronizarTema();
});

sincronizarTema();

// ---------------------------------------------------------------------------
// Estado de apertura de hoy
// ---------------------------------------------------------------------------

const hhmm = (h, m) => `${h}:${String(m).padStart(2, "0")}`;

function estadoDeHoy(ahora = new Date()) {
  const tramos = HORARIOS[ahora.getDay()];
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  for (const [hi, mi, hf, mf] of tramos) {
    const desde = hi * 60 + mi;
    const hasta = hf * 60 + mf;
    if (minutosAhora >= desde && minutosAhora < hasta) {
      return { abierto: true, texto: `Hoy abierto hasta las ${hhmm(hf, mf)} hs` };
    }
    if (minutosAhora < desde) {
      return { abierto: false, texto: `Hoy abrimos de ${hhmm(hi, mi)} a ${hhmm(hf, mf)} hs` };
    }
  }

  for (let i = 1; i <= 7; i++) {
    const dia = (ahora.getDay() + i) % 7;
    const tramosSiguiente = HORARIOS[dia];
    if (tramosSiguiente.length) {
      const [hi, mi, hf, mf] = tramosSiguiente[0];
      const cuando = i === 1 ? "mañana" : `el ${DIAS[dia]}`;
      return { abierto: false, texto: `Cerrado · Abrimos ${cuando} de ${hhmm(hi, mi)} a ${hhmm(hf, mf)} hs` };
    }
  }

  return { abierto: false, texto: "Consultá nuestros horarios" };
}

function pintarEstado() {
  const { abierto, texto } = estadoDeHoy();
  document.getElementById("estado-texto").textContent = texto;
  const punto = document.getElementById("estado-punto");
  punto.classList.toggle("bg-green-500", abierto);
  punto.classList.toggle("bg-biblio-sage", !abierto);
  document.getElementById("estado-pulso").classList.toggle("hidden", !abierto);
}

pintarEstado();

// ---------------------------------------------------------------------------
// Google Sheets
// ---------------------------------------------------------------------------

function parsearCSV(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

// "Días y Horarios" -> "diasyhorarios", para que el nombre de la columna
// en la hoja no dependa de mayúsculas, tildes ni espacios.
const normalizar = (s) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

function filasAObjetos(texto) {
  const filas = parsearCSV(texto).filter((f) => f.some((c) => c.trim() !== ""));
  if (filas.length < 2) return [];

  const encabezados = filas[0].map(normalizar);
  return filas.slice(1).map((fila) => {
    const obj = {};
    encabezados.forEach((clave, i) => {
      obj[clave] = (fila[i] ?? "").trim();
    });
    return obj;
  });
}

async function traerHoja(url) {
  const respuesta = await fetch(url, { cache: "no-store" });
  if (!respuesta.ok) throw new Error(`La hoja respondió ${respuesta.status}`);
  return filasAObjetos(await respuesta.text());
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const mostrar = (id, visible) => document.getElementById(id).classList.toggle("hidden", !visible);

function enlaceWhatsApp(titulo) {
  const texto = `¡Hola! Quiero consultar por el taller de ${titulo}`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

function renderTalleres(talleres) {
  const contenedor = document.getElementById("talleres-grid");
  const plantilla = document.getElementById("tpl-taller");
  contenedor.replaceChildren();

  for (const taller of talleres) {
    const nodo = plantilla.content.cloneNode(true);
    const categoria = nodo.querySelector("[data-categoria]");

    // textContent (no innerHTML): el contenido viene de una hoja externa.
    if (taller.categoria) {
      categoria.textContent = taller.categoria;
    } else {
      categoria.remove();
    }
    nodo.querySelector("[data-titulo]").textContent = taller.titulo;
    nodo.querySelector("[data-horario]").textContent = taller.horario;

    const tallerista = nodo.querySelector("[data-tallerista]");
    if (taller.tallerista) tallerista.textContent = `A cargo de ${taller.tallerista}`;
    else tallerista.remove();

    const descripcion = nodo.querySelector("[data-descripcion]");
    if (taller.descripcion) descripcion.textContent = taller.descripcion;
    else descripcion.remove();

    const boton = nodo.querySelector("[data-wa]");
    boton.href = enlaceWhatsApp(taller.titulo);
    boton.setAttribute("aria-label", `Consultar por WhatsApp sobre el taller ${taller.titulo}`);

    contenedor.appendChild(nodo);
  }
}

function renderNoticias(noticias) {
  const contenedor = document.getElementById("noticias-grid");
  const plantilla = document.getElementById("tpl-noticia");
  contenedor.replaceChildren();

  for (const noticia of noticias) {
    const nodo = plantilla.content.cloneNode(true);

    const fecha = nodo.querySelector("[data-fecha]");
    if (noticia.fecha) fecha.textContent = noticia.fecha;
    else fecha.remove();

    nodo.querySelector("[data-titulo]").textContent = noticia.titulo;

    const resumen = nodo.querySelector("[data-resumen]");
    if (noticia.resumen) resumen.textContent = noticia.resumen;
    else resumen.remove();

    const enlace = nodo.querySelector("[data-enlace]");
    // Solo http(s): evita que un javascript: en la hoja se vuelva ejecutable.
    if (/^https?:\/\//i.test(noticia.enlace || "")) {
      enlace.href = noticia.enlace;
      enlace.setAttribute("aria-label", `Leer más sobre ${noticia.titulo}`);
    } else {
      enlace.remove();
    }

    contenedor.appendChild(nodo);
  }
}

async function cargarTalleres() {
  try {
    const talleres = SHEETS.talleres ? await traerHoja(SHEETS.talleres) : TALLERES_RESPALDO;
    renderTalleres(talleres.length ? talleres : TALLERES_RESPALDO);
  } catch (error) {
    console.warn("No se pudieron cargar los talleres desde la hoja:", error);
    renderTalleres(TALLERES_RESPALDO);
    mostrar("talleres-aviso", true);
  } finally {
    mostrar("talleres-skeleton", false);
  }
}

async function cargarNoticias() {
  try {
    const noticias = SHEETS.noticias ? await traerHoja(SHEETS.noticias) : [];
    if (noticias.length) renderNoticias(noticias);
    else mostrar("noticias-vacio", true);
  } catch (error) {
    console.warn("No se pudieron cargar las noticias desde la hoja:", error);
    mostrar("noticias-error", true);
  } finally {
    mostrar("noticias-skeleton", false);
  }
}

cargarTalleres();
cargarNoticias();

// ---------------------------------------------------------------------------

document.querySelectorAll("img[data-optional]").forEach((img) => {
  img.addEventListener("error", () => img.remove());
});

document.getElementById("year").textContent = new Date().getFullYear();
