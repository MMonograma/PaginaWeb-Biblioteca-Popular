// ---------------------------------------------------------------------------
// CSV → OBJETOS
//
// Convierte el CSV que publica Google Sheets en una lista de objetos, uno por
// fila, con los encabezados de la fila 1 como claves.
// ---------------------------------------------------------------------------

// Parser propio en vez de una librería: el CSV de Google usa comillas dobles
// para escapar y esto son treinta líneas sin dependencias que auditar.
export function parsearCSV(texto) {
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

// "Días y Horarios", "dias_horarios" y "DIAS HORARIOS" terminan todos en
// "diashorarios": el nombre de la columna no depende de mayúsculas, tildes,
// espacios ni guiones bajos.
export const normalizarClave = (s) =>
  String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Aplica normalizarClave a las claves de un objeto que ya existe
// (por ejemplo, los talleres de respaldo escritos a mano).
export const normalizarFila = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [normalizarClave(k), String(v ?? "").trim()]));

export function filasAObjetos(texto) {
  const filas = parsearCSV(texto).filter((f) => f.some((c) => c.trim() !== ""));
  if (filas.length < 2) return [];

  const encabezados = filas[0].map(normalizarClave);
  return filas.slice(1).map((fila) => {
    const obj = {};
    encabezados.forEach((clave, i) => {
      if (clave) obj[clave] = (fila[i] ?? "").trim();
    });
    return obj;
  });
}
