// Parseo de CSV y normalización de filas.
// Vive en api/ con guion bajo para que Vercel no lo publique como una ruta.

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

// "Días y Horarios" -> "diasyhorarios", para que el nombre de la columna
// en la hoja no dependa de mayúsculas, tildes ni espacios.
export const normalizarClave = (s) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

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

// Una fila se publica salvo que diga explícitamente que no.
const NEGATIVOS = new Set(["no", "false", "0", "oculto", "borrador", "n"]);
export const estaPublicada = (fila) => {
  const v = (fila.publicado ?? fila.estado ?? "").toLowerCase().trim();
  return v === "" || !NEGATIVOS.has(v);
};

// Ordena por la columna "orden" si existe; si no, por fecha descendente.
export function ordenar(filas) {
  return [...filas].sort((a, b) => {
    const oa = Number(a.orden);
    const ob = Number(b.orden);
    if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob;
    return String(b.fecha ?? "").localeCompare(String(a.fecha ?? ""));
  });
}
