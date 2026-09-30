# Sitio de la Biblioteca Popular Edgar Morisoli

Documentación del proyecto: cómo está armado, cómo se actualiza el contenido y
qué falta.

---

## 1. Cómo trabajar con el proyecto

```bash
npm install          # una sola vez
npm run build        # genera el CSS y las páginas de public/
npm run serve        # servidor local en http://localhost:3000
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
    sitio.js             ← DATOS INSTITUCIONALES: horarios, contacto, menú,
                           URL de la hoja de talleres
    catalogo.js          Títulos destacados que se muestran en Catálogo
    lectura.js           Enlaces de "Lectura virtual 24/7"
  parciales/
    layout.html          Esqueleto común de todas las páginas
    header.html          Encabezado, menú y botón del catálogo
    footer.html          Pie de página
    loader.html          Pantalla de carga (el libro animado)
  paginas/               El contenido propio de cada página
build.js                 Arma las páginas combinando lo de arriba
servidor-dev.js          Servidor local (sirve public/)
scripts/
  sync-instagram.py      Baja las últimas publicaciones de Instagram
.github/workflows/
  instagram-sync.yml     Corre el script de arriba 5 veces por día
public/                  ← Lo que se publica. Los .html son GENERADOS.
  js/                    JavaScript del navegador (se edita acá)
  assets/img/            Imágenes
  vendor/                Librerías de terceros copiadas (Pannellum)
  data/noticias.json     ← GENERADO por la Action de Instagram
  noticias/*.jpg         ← GENERADO por la Action de Instagram
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

> Las páginas de `src/paginas/` empiezan con un comentario con `titulo`,
> `descripcion` y, opcionalmente, `loader: si` (ver §5).

Ese archivo alimenta a la vez:

- el pie de página de todas las páginas,
- el acordeón de horarios del inicio,
- la sección de horarios de Quiénes Somos,
- el cartel de "abierto ahora / cerrado", que se calcula en el navegador,
- el WhatsApp de los talleres que no tienen número propio en la hoja.

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

## 3. Talleres desde Google Sheets

La planilla es **"Talleres en Pagina web"**, pestaña **Talleres**:
<https://docs.google.com/spreadsheets/d/1ecs1NkXN51SLfBm957ZRhZJ9f0ywrHgHSXLXI7mKbBQ/edit>

Está restringida (sólo la puede editar quien es dueño). Publicarla en la web no
cambia eso: publicar genera una copia de **sólo lectura** del CSV, sin dar
acceso al documento.

### 3.1 Columnas

La fila 1 tiene los nombres de las columnas. No distinguen mayúsculas, tildes,
espacios ni guiones bajos: `dias_horarios`, "Días horarios" y `DIASHORARIOS`
son lo mismo.

| Columna | Para qué sirve |
|---|---|
| `id` | Identificador propio. No se muestra. |
| `activo` | `SI` para mostrar el taller. Cualquier otra cosa (`NO`, vacío, "pausado") lo oculta sin borrar la fila. |
| `titulo` | Nombre del taller. **Es el único imprescindible.** |
| `categoria` | Etiqueta arriba de la tarjeta: "Infancias", "Adultxs mayores"… |
| `dias_horarios` | Texto libre: "Martes 17 hs", "Último viernes de cada mes". |
| `tallerista` | Quién lo da. Se muestra como "A cargo de …". |
| `descripcion` | Texto breve de la tarjeta. |
| `foto_url` | Enlace a la foto (ver 3.3). Vacío = imagen por defecto. |
| `contacto_wsp` | WhatsApp de quien da el taller (ver 3.4). Vacío = el de la biblioteca. |

Si una celda está vacía, esa línea directamente no aparece en la tarjeta.

### 3.2 Publicar la hoja y conectarla al sitio (una sola vez)

1. En la planilla: **Archivo → Compartir → Publicar en la web**.
2. En el primer desplegable elegir la pestaña **Talleres** (no "Todo el
   documento"); en el segundo, **Valores separados por comas (.csv)**.
3. **Publicar** y copiar la URL. Tiene la forma
   `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv`.
4. Pegarla en `src/datos/sitio.js`, en `HOJA_TALLERES_CSV`.
5. `npm run build`, commit y push.

**Ya está publicada** (desde el 2026-09-30) y la URL está cargada en `sitio.js`.
Si Google no responde, el sitio muestra `TALLERES_RESPALDO` (los talleres
escritos en `sitio.js`) y un aviso.

### 3.3 Fotos desde Google Drive

1. Subir la foto a una carpeta de Drive.
2. Compartirla como **"Cualquier persona con el enlace: Lector"**.
3. Copiar el enlace (`https://drive.google.com/file/d/…/view?usp=sharing`) y
   pegarlo tal cual en `foto_url`.

Ese enlace abre una página de vista previa, no la imagen, así que puesto en un
`<img>` no mostraría nada. `urlDeImagen()` (en `public/js/fuente-datos.js`)
saca el ID del archivo y lo convierte a `https://lh3.googleusercontent.com/d/ID`,
el servidor de imágenes de Google, que entrega el archivo directo. Si la foto es
privada o el enlace está roto, la tarjeta vuelve sola a la imagen por defecto.

### 3.4 WhatsApp

El botón "Consultar por WhatsApp" abre un chat con el mensaje ya escrito:
*«¡Hola! Quisiera consultar por el taller de {titulo} en la Biblioteca.»*

En `contacto_wsp` se puede escribir el número como salga: `2954610340`,
`+54 9 2954 61-0340`… El sitio se queda con los dígitos y, si son 10
(característica + número), le agrega el `549` de Argentina.

> La columna está en formato **Texto sin formato** (Formato → Número). Si se
> dejara en automático, Sheets podría convertir un número largo en `5,49E+12`
> y perder dígitos.

### 3.5 Cómo funciona la conexión (en vivo)

```
navegador ──fetch──▶ CSV publicado de Google ──▶ csv.js lo convierte en objetos
                                               ──▶ talleres.js arma las tarjetas
```

Cada visita pide el CSV en el momento, desde el navegador. **No hay que volver
a publicar el sitio para que se vean los cambios**: se edita la planilla y se
recarga la página.

Google tarda **unos minutos** (en general menos de 5) en actualizar la copia
publicada después de cada cambio: es la única demora, y no depende del sitio.

Para que el navegador pueda hacer ese pedido, la CSP de `vercel.json` permite
conexiones (`connect-src`) a `docs.google.com` y a `*.googleusercontent.com`
(Google redirige el CSV publicado a ese dominio). Es lo único que se abrió:
scripts y estilos siguen limitados al propio sitio.

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

### Lectura virtual 24/7

Al final de la página de Catálogo, la sección `#lectura-virtual` reúne lectura
para cuando la biblioteca está cerrada. Los enlaces están en
**`src/datos/lectura.js`**; se agregan ahí y se corre `npm run build`.

- **Rincón Pampeano / Edgar Morisoli**: empieza vacío, con un aviso de "en
  preparación". Morisoli es un autor contemporáneo y su obra sigue protegida
  (en Argentina, hasta 70 años después de la muerte del autor): sólo se pueden
  cargar textos con permiso de sus herederos o editoriales, o publicaciones ya
  difundidas oficialmente.
- **Bibliotecas digitales gratuitas**: Catálogo colectivo de CONABIP,
  Biblioteca del Congreso, Biblioteca Virtual Miguel de Cervantes y Project
  Gutenberg en español (verificados el 2026-09-30).
- **Visor en pantalla** (`#visor-lectura`): el contenedor está preparado para
  PDF.js o StPageFlip. Los PDF tendrían que estar en el propio sitio
  (`public/lecturas/`), porque la CSP no deja leer archivos de otros dominios.

---

## 5. Noticias de Instagram

Las noticias son las últimas **12 publicaciones de
[@bibliotecaedgarmorisoli](https://www.instagram.com/bibliotecaedgarmorisoli)**,
copiadas al sitio automáticamente.

```
GitHub Action (cada 3 horas, de 9 a 21 hs de Argentina)
  └─ scripts/sync-instagram.py  (abre el perfil en un Chromium sin ventana)
       ├─ public/noticias/{shortcode}.jpg   la foto de cada publicación
       └─ public/data/noticias.json         texto resumido, fecha y enlace
  └─ si hubo cambios: commit + push  ──▶  Vercel publica solo
```

- Las fotos se **copian** al sitio porque los enlaces del CDN de Instagram
  vencen a los pocos días.
- Si no hay publicaciones nuevas, no hay commit (y no hay deploy).
- Las fotos de publicaciones que ya salieron de las últimas 12 se borran, para
  que el repositorio no crezca para siempre.
- La página (`public/js/noticias.js`) sólo lee el JSON. No carga nada de
  Instagram ni de Meta en cada visita.
- Para correrlo a mano: pestaña **Actions → Sincronizar Instagram → Run
  workflow**.

### 5.1 Por qué un navegador sin ventana (y no una API)

- La API simple de Instagram (Basic Display) la apagó Meta en diciembre de 2024.
  La que queda (Graph API) exige cuenta Business, una app registrada en Meta y
  un token que vence cada 60 días.
- Las consultas directas a la API interna (lo que hace instaloader) ahora
  responden `401 require_login` sin sesión. Probado el 2026-09-30.
- **Pero el perfil público se sigue viendo en un navegador sin iniciar sesión.**
  Instagram manda las últimas 12 publicaciones dentro de la propia página
  (en un bloque JSON). El script abre el perfil con Playwright, un Chromium sin
  ventana, y lee ese bloque. No hay contraseña, sesión ni token que mantener.
- La página no trae la fecha de cada publicación, pero el ID numérico (`pk`)
  la tiene adentro: `(pk >> 23) + 1314220021721` da los milisegundos del
  momento en que se publicó.

**Qué puede fallar:** si Instagram cambia cómo arma esa página, o empieza a
pedir inicio de sesión a los servidores de GitHub. En los dos casos el script
no toca nada, el sitio sigue mostrando lo último bueno y la Action deja un
aviso amarillo ("Instagram no mandó publicaciones…"). Si ese aviso se repite
varios días seguidos, hay que revisar el script.

> Instagram no permite oficialmente la lectura automatizada. Con dos visitas
> por día al perfil público de la propia biblioteca el riesgo es mínimo.

### 5.2 Formato de `noticias.json`

```json
{
  "actualizado": "2026-09-30T18:00-03:00",
  "perfil": "https://www.instagram.com/bibliotecaedgarmorisoli/",
  "noticias": [
    {
      "id": "shortcode",
      "url": "https://www.instagram.com/p/shortcode/",
      "imagen": "/noticias/shortcode.jpg",
      "alt": "texto alternativo que genera Instagram",
      "caption": "primeros 220 caracteres del texto…",
      "fecha": "2026-09-28"
    }
  ]
}
```

La fecha va en formato ISO y la página la muestra como "28 de septiembre de
2026". Por seguridad, la página sólo acepta fotos de `/noticias/` y enlaces a
`https://www.instagram.com/`.

---

## 6. Pantalla de carga

El libro animado vive en `src/parciales/loader.html` y lo maneja
`public/js/loader-libro.js`, con dos funciones globales:

```js
mostrarLoader();   // lo muestra (cuenta cuántas cargas hay en curso)
ocultarLoader();   // se va con un fundido cuando terminó la última
await loaderLibro.durante(fetch(...));   // atajo: muestra, espera y oculta
```

- Las páginas con `loader: si` en su cabecera (Inicio, Talleres, Noticias) lo
  muestran **desde el primer pintado**, y `main.js` lo oculta recién cuando las
  tarjetas de talleres y noticias ya están en el DOM.
- **Sin JavaScript no aparece nunca**: el CSS sólo lo muestra bajo `html.js`,
  una clase que pone `loader-libro.js` en el `<head>`.
- **Red de seguridad**: si algo falla y nadie llama a `ocultarLoader()`, a los
  8 segundos se va solo (animación CSS). Las cargas de datos cortan a los 8 s.
- Con "reducir movimiento" activado en el sistema, el libro queda quieto.

> Ojo con Inicio: el loader tapa toda la página, hero incluido, hasta que llegan
> los talleres, que están bastante más abajo. Si se nota lento, se saca
> `loader: si` de `src/paginas/index.html` y los talleres se siguen viendo con
> sus bloques grises de carga.

---

## 7. Recorrido virtual 360° (Biblio-Interactiva)

La sección `#recorrido-virtual` tiene el contenedor `#visor-360` con un cartel
de "Próximamente". El visor es **Pannellum 2.5.7** (licencia MIT), copiado en
`public/vendor/pannellum-2.5.7/`.

Se copió en lugar de enlazarlo a un CDN porque la CSP sólo permite scripts del
propio sitio: habilitar un CDN en `script-src` habilitaría **cualquier**
paquete publicado en ese CDN, no sólo este.

**Para activarlo**, con la foto equirectangular (proporción 2:1):

1. Guardarla en `public/assets/img/recorrido-360.jpg` (idealmente < 4 MB).
2. En `src/paginas/biblio-interactiva.html`, agregar al `<div id="visor-360">`
   el atributo `data-panorama="assets/img/recorrido-360.jpg"`.
3. `npm run build`.

Mientras no haya `data-panorama`, la librería ni se descarga. Cuando lo haya,
se baja recién al acercarse al visor, y la foto recién cuando alguien toca
"empezar el recorrido" (importante con datos móviles).

Si el recorrido se hace con **Lumi / H5P**, el resultado es otra página HTML que
va en un `<iframe>`: en ese caso hay que sumar su origen a `frame-src` en
`vercel.json`.

---

## 8. Mapa

El mapa de Google **no se carga solo**: se ve un panel con la dirección y un
botón "Ver el mapa". El iframe aparece recién al tocarlo. Así la página no le
pide nada a Google en una visita normal, carga más rápido y no expone a quien
visita al rastreo de Google sin que lo elija.

La dirección y las coordenadas (`-36.6277361, -64.3046025`) están en
`src/datos/sitio.js`, verificadas contra OpenStreetMap.

---

## 9. Colores y accesibilidad

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

## 10. Seguridad

- La CSP no permite scripts en línea. Por eso el tema se aplica desde
  `public/js/theme.js` y no con un `<script>` dentro del HTML.
- Todo lo que llega de la planilla o de Instagram se inserta con `textContent`,
  nunca con `innerHTML`: si alguien escribiera HTML en una celda, se vería como texto.
- Las fotos de la planilla exigen `https://`, así un `javascript:` en una celda
  no puede ejecutarse. Las de noticias sólo pueden ser archivos de `/noticias/`,
  y sus enlaces sólo pueden ir a `https://www.instagram.com/`.
- `connect-src` permite, además del propio sitio, sólo a Google (para leer la
  planilla). `script-src` sigue siendo sólo `'self'`: por eso Pannellum está
  copiado en `public/vendor/` y no enlazado a un CDN.
- No hay ninguna clave ni token: ni en el código del navegador ni en GitHub.
  La sincronización de Instagram lee el perfil público sin iniciar sesión.

---

## 11. Pendientes y cosas para confirmar

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
"en preparación". En `Biblio-Interactiva` falta la foto del recorrido 360° (§7)
y en Catálogo, los textos del Rincón Pampeano (§4).

### Ideas para más adelante

- Convertir las imágenes a WebP cuando lleguen las fotos reales.
- Alojar las tipografías en el propio sitio, para no depender de Google Fonts.
- Datos estructurados (schema.org `Library`) para que Google muestre horarios y
  dirección en los resultados de búsqueda.
