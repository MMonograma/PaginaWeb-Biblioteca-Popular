# Sitio de la Biblioteca Popular Edgar Morisoli

Documentación del proyecto: cómo está armado, cómo se actualiza el contenido y
qué falta.

---

## 1. Cómo trabajar con el proyecto

```bash
npm install          # una sola vez
npm run build        # genera el CSS y las páginas de public/
npm run demo         # servidor local en http://localhost:3000 con datos de ejemplo
npm run serve        # igual, pero leyendo las hojas de cálculo reales
npm run dev          # vigila los cambios de CSS (no regenera el HTML)
```

> **Importante:** los archivos de `public/*.html` **se generan**. No los edites a
> mano: se pisan en el próximo `npm run build`. El contenido de cada página se
> edita en `src/paginas/`.

### Estructura

```
src/
  input.css              Colores, tipografías y componentes (Tailwind v4)
  datos/
    sitio.js             ← DATOS INSTITUCIONALES: horarios, contacto, menú
    catalogo.js          Títulos destacados que se muestran en Catálogo
  parciales/
    layout.html          Esqueleto común de todas las páginas
    header.html          Encabezado y menú
    footer.html          Pie de página
  paginas/               El contenido propio de cada página
build.js                 Arma las páginas combinando lo de arriba
servidor-dev.js          Servidor local (sirve public/ y la API)
api/
  hoja.js                Lee las hojas de cálculo (corre en Vercel)
  _csv.js                Parseo de CSV
public/                  ← GENERADO. Lo que se publica.
  js/                    JavaScript del navegador
  assets/img/            Imágenes
```

### Por qué hay un generador

El encabezado y el pie estaban copiados en los ocho HTML. Esa duplicación hizo
que el sitio se desincronizara: el CSS se migró a una paleta nueva y los HTML
quedaron con la vieja, así que dejaron de aplicarse los colores. Ahora el menú
se edita en un solo lugar (`src/datos/sitio.js`) y el generador lo escribe en
todas las páginas.

---

## 2. Actualizar los datos de la biblioteca

Todo lo institucional está en **`src/datos/sitio.js`**: horarios, dirección,
teléfono, correo, redes, registro de CONABIP y el menú.

Ese archivo alimenta a la vez:

- el pie de página de todas las páginas,
- el acordeón de horarios del inicio,
- la sección de horarios de Quiénes Somos,
- el cartel de "abierto ahora / cerrado", que se calcula en el navegador,
- los enlaces de WhatsApp de los talleres.

**Si cambia un horario, se cambia ahí y en ningún otro lado.** Después,
`npm run build`.

### Cómo se escriben los horarios

```js
export const HORARIOS = {
  0: [],                                        // domingo
  1: [],                                        // lunes
  2: [[9, 0, 12, 30], [16, 30, 20, 0]],         // martes: 9:00-12:30 y 16:30-20:00
  ...
};
```

Cada tramo es `[horaDesde, minutoDesde, horaHasta, minutoHasta]`. El generador
agrupa solo los días seguidos con el mismo horario ("Martes a viernes").

---

## 3. Noticias y talleres desde Google Sheets

### 3.1 Publicar la hoja

La hoja de **talleres** ya existe y está cargada:
<https://docs.google.com/spreadsheets/d/1HArk3A14yExQUFeHPheYulK2y9PKui-xfs_GwBgvYg8/edit>

Para la de noticias hay que crear otra igual.

1. Crear una hoja de cálculo en Google Drive.
2. **Archivo → Compartir → Publicar en la web**.
3. Elegir la pestaña y el formato **CSV**.
4. Copiar la URL que aparece.

### 3.2 Configurar la URL en Vercel

En el panel de Vercel: **Settings → Environment Variables**.

| Variable | Contenido |
|---|---|
| `SHEET_NOTICIAS` | URL CSV de la hoja de noticias |
| `SHEET_TALLERES` | URL CSV de la hoja de talleres |

Después hay que volver a desplegar para que tome los valores.

Mientras no estén configuradas, el sitio no se rompe: los talleres muestran la
lista de respaldo y las noticias muestran un cartel que invita a seguir el
Instagram.

### 3.3 Columnas de la hoja de NOTICIAS

Ninguna columna es obligatoria salvo el título. Los nombres no distinguen
mayúsculas, tildes ni espacios: "URL Imagen" y "urlimagen" son lo mismo.

| Columna | Para qué sirve |
|---|---|
| `ID` | Identificador propio. No se muestra. |
| `Título` | Título de la tarjeta. **Es el único imprescindible.** |
| `Descripción` | Texto breve debajo del título. |
| `Fecha` | `2026-09-15` o `15/09/2026`. Se muestra como "15 de septiembre de 2026". |
| `URL Imagen` | Dirección de la imagen. **Tiene que empezar con `https://`.** |
| `Video` | Enlace de YouTube o Vimeo. Se muestra un botón y el video carga al tocarlo. |
| `Enlace Instagram` | Enlace a la publicación. Agrega el botón "Ver en Instagram". |
| `Categoría` | Etiqueta de color arriba de la tarjeta. |
| `Publicado` | `no` para ocultar la fila. Vacío = se publica. |
| `Orden` | Número: las más chicas aparecen primero. Sin este dato, se ordena por fecha. |

Si hay video y también imagen, se muestra el video.

### 3.4 Columnas de la hoja de TALLERES

| Columna | Para qué sirve |
|---|---|
| `ID` | Identificador propio. No se muestra. |
| `Nombre` | Nombre del taller. |
| `Descripción` | Texto breve en la tarjeta. |
| `Categoría` | Etiqueta: "Infancias", "Adultxs mayores", etc. |
| `Día` | "Martes", "Martes y jueves"… Se muestra junto al horario, separado por un punto. |
| `Horario` | "17:00 a 19:00", "Consultar días y horarios"… texto libre. |
| `Fecha` | Opcional, para talleres con fecha puntual. |
| `Lugar` | Dónde se hace. |
| `Docente` | Quién lo da. Se muestra como "A cargo de …". |
| `Info` | Texto adicional; aparece al desplegar "Ver más". |
| `Inscripción` | Enlace de inscripción (tiene que empezar con `http`). |
| `Imagen` | Dirección de la imagen, con `https://`. |
| `Publicado` | `no` para ocultar la fila. |
| `Orden` | Número de orden. |

### 3.5 Cómo agregar una noticia

1. Abrir la hoja de noticias.
2. Agregar una fila con al menos el título.
3. Guardar. **No hay que tocar el código ni volver a desplegar.**

El sitio tarda hasta 5 minutos en mostrarla: es el tiempo de caché, que evita
consultar a Google en cada visita.

### 3.6 Por qué los datos pasan por `/api/hoja`

El navegador no consulta a Google directamente: le pide los datos a una función
del propio sitio (`api/hoja.js`), que los va a buscar y los devuelve ya
convertidos. Así:

- la política de seguridad del sitio (CSP) sigue permitiendo conexiones solo al
  propio dominio;
- no dependemos de cómo Google configure los permisos entre dominios (CORS);
- la respuesta queda cacheada 5 minutos, y si Google falla se sigue mostrando la
  última versión buena durante una hora;
- el día que haga falta una clave privada (por ejemplo la de Instagram), va en
  una variable de entorno y **nunca** queda a la vista en el navegador.

---

## 4. Catálogo

El acervo está catalogado en **DigiBepé**, el sistema de CONABIP. El catálogo
público de la biblioteca es **http://4124.bepe.ar** (el número es el registro de
CONABIP, 4124).

En la página de Catálogo hay un buscador que arma la consulta y abre los
resultados en una pestaña nueva, más los títulos destacados, que enlazan a la
búsqueda de ese libro.

### Limitación conocida: el catálogo no tiene HTTPS

El servidor de CONABIP responde por `http://`, y su certificado de HTTPS es de
otro dominio (`catalogo.colectivo.conabip.gob.ar`). Consecuencias comprobadas:

- **No se puede mostrar dentro del sitio** (ni en un iframe ni leyéndolo con
  JavaScript): el navegador bloquea contenido HTTP dentro de una página HTTPS.
- **Un formulario apuntando directo al catálogo tampoco funciona**: la cabecera
  `upgrade-insecure-requests` del sitio lo reescribe a HTTPS y falla.
- **Los enlaces y las pestañas nuevas sí funcionan**, y por eso el buscador abre
  el catálogo con `window.open` en lugar de enviar un formulario.

Al entrar, el navegador puede avisar que el sitio "no es seguro". Es del sistema
de CONABIP, no de este sitio; la página lo aclara.

**Qué se podría pedir:** que CONABIP habilite HTTPS en `4124.bepe.ar`. Si algún
día lo hacen, se podría integrar la búsqueda dentro del sitio.

---

## 5. Instagram

**No se puede traer el Instagram automáticamente sin complicar el mantenimiento.**

- La *Basic Display API*, que servía para esto, se apagó el 4/12/2024.
- Lo que queda (Graph API) exige cuenta Business o Creator, una aplicación
  registrada en Meta, revisión de la aplicación y un token que **vence cada 60
  días**. Si nadie lo renueva, la sección deja de andar.

**Lo que se hizo:** la hoja de noticias tiene una columna `Enlace Instagram`. Se
sube la foto, se pega el enlace de la publicación, y la tarjeta queda con el
diseño del sitio y un botón "Ver en Instagram". Sin claves, sin vencimientos y
sin cargar los rastreadores de Meta en cada visita.

---

## 6. Mapa

El mapa de Google **no se carga solo**: se ve un panel con la dirección y un
botón "Ver el mapa". El iframe aparece recién al tocarlo. Así la página no le
pide nada a Google en una visita normal, carga más rápido y no expone a quien
visita al rastreo de Google sin que lo elija.

La dirección y las coordenadas (`-36.6277361, -64.3046025`) están en
`src/datos/sitio.js`, verificadas contra OpenStreetMap.

---

## 7. Colores y accesibilidad

La paleta oficial se mantiene, con dos variantes agregadas porque los colores
originales no alcanzaban el contraste mínimo en algunos usos.

| Token | Color | Uso |
|---|---|---|
| `biblio-paper` | `#f5f3e6` | Fondo en modo claro |
| `biblio-pistachio` | `#c8d0b7` | Bordes, fondos suaves; texto en modo oscuro |
| `biblio-sage` | `#6f7f64` | **Solo íconos y bordes** |
| `biblio-moss` | `#3d4b3e` | Color de marca, botones, títulos en claro |
| `biblio-charcoal` | `#1e2320` | Texto en claro, fondo en oscuro |
| `biblio-card-dark` | `#242b27` | Tarjetas en modo oscuro |
| `biblio-moss-claro` | `#90978a` | Verde de marca legible en oscuro (5,30:1) |
| `biblio-sage-oscuro` | `#5f6d56` | Sage legible como texto en claro (4,95:1) |

### Dos reglas que conviene no romper

1. **`sage` no sirve como color de texto.** Sobre `paper` da 3,85:1 y sobre
   `charcoal` 3,72:1; el mínimo para texto es 4,5:1. Sirve para íconos y bordes,
   donde alcanza con 3:1.
2. **`moss` no se puede usar en modo oscuro.** Sobre `charcoal` da 1,73:1. En
   oscuro, el color de marca es `pistachio` o `moss-claro`.

### Qué se verificó

Se midió el contraste real de cada texto contra su fondo, en las nueve páginas y
en los dos modos: **sin ningún incumplimiento** sobre unos 600 elementos.

También: navegación completa con teclado, `Escape` que cierra el submenú y luego
el menú devolviendo el foco, botones de 44×44 px mínimo, y sin desbordes
horizontales en 375 px.

---

## 8. Seguridad

- La CSP no permite scripts en línea. Por eso el tema se aplica desde
  `public/js/theme.js` y no con un `<script>` dentro del HTML.
- Todo lo que llega de la hoja de cálculo se inserta con `textContent`, nunca con
  `innerHTML`: si alguien escribiera HTML en una celda, se vería como texto.
- Los enlaces se validan (solo `http://` y `https://`) y las imágenes exigen
  `https://`, así un `javascript:` en una celda no puede ejecutarse.
- Los videos solo se aceptan de YouTube y Vimeo; cualquier otra dirección se
  ignora en lugar de insertar un iframe desconocido.
- No hay ninguna clave ni token en el código del navegador.

---

## 9. Pendientes y cosas para confirmar

### Datos a confirmar con la biblioteca

| Dato | En el sitio | En otras fuentes |
|---|---|---|
| Año de fundación | 24 de agosto de **2002** | CONABIP y el diario La Arena apuntan a **2003** (festejó 20 años el 1/12/2023) |
| Teléfono | 2954-610340 | CONABIP lista 2954-412627 |
| Facebook | sin enlace | existe `facebook.com/bibliotecapopularedgarmorisoli`, falta confirmar que sea el oficial |
| WhatsApp | 5492954610340 | sin verificar |

Ninguno se cambió: hace falta que la biblioteca confirme cuál es el correcto.

### Faltan fotos

El sitio tiene recuadros punteados que indican qué foto va en cada lugar y con
qué proporción. Hoy la única imagen real es el logo. Hacen falta:

- una foto para el fondo del inicio (`public/assets/img/hero-estanterias.jpg`),
- fachada o salón de lectura,
- fotos de talleres y actividades,
- el isologo de CONABIP.

### Secciones en preparación

`Flotilla Literaria` y `Sala de Pensamiento` siguen como estaban, con su texto de
"en preparación". `Biblio-Interactiva` menciona un recorrido con H5P: cuando se
sume, hay que habilitar su dominio en `frame-src` dentro de `vercel.json`.

### Ideas para más adelante

- Convertir las imágenes a WebP cuando lleguen las fotos reales.
- Alojar las tipografías en el propio sitio, para no depender de Google Fonts.
- Datos estructurados (schema.org `Library`) para que Google muestre horarios y
  dirección en los resultados de búsqueda.
