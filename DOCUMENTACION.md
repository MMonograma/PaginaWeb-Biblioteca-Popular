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
    catalogo.js          Títulos destacados que se muestran en Catálogo e Inicio
    libros-info.json     Tapas y sinopsis encontradas (lo genera npm run libros)
    lectura.js           Enlaces de "Lectura virtual 24/7"
  parciales/
    layout.html          Esqueleto común de todas las páginas
    header.html          Encabezado, menú y botón del catálogo
    footer.html          Pie de página
    loader.html          Pantalla de carga (el libro animado)
  paginas/               El contenido propio de cada página
api/
  catalogo.js            Función de Vercel: busca en DigiBepé (GET /api/catalogo)
  libro.js               Función de Vercel: tapa y sinopsis (GET /api/libro)
lib/
  koha.js                Lee las respuestas del catálogo Koha
build.js                 Arma las páginas combinando lo de arriba
servidor-dev.js          Servidor local (sirve public/)
scripts/
  sync-instagram.py      Baja las últimas publicaciones de Instagram
  buscar-libros.js       Busca tapas y sinopsis de los libros (npm run libros)
  fuentes-libros.js      Consultas a Google Books y Open Library
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

> Las páginas de `src/paginas/` empiezan con un comentario con `titulo` y
> `descripcion`.

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
| `activo` | `SI` para mostrar el taller. `PROXIMAMENTE` lo muestra como anticipo (tarjeta "Próximamente", sin horario ni WhatsApp). Cualquier otra cosa (`NO`, vacío, "pausado") lo oculta sin borrar la fila. |
| `titulo` | Nombre del taller. **Es el único imprescindible.** |
| `categoria` | Etiqueta arriba de la tarjeta: "Infancias", "Adultxs mayores"… |
| `dias_horarios` | Texto libre: "Martes 17 hs", "Último viernes de cada mes". |
| `tallerista` | Quién lo da. Se muestra como "A cargo de …". |
| `descripcion` | Texto breve de la tarjeta. |
| `foto_url` | Enlace a la foto (ver 3.3). Vacío = imagen por defecto. |
| `contacto_wsp` | WhatsApp de quien da el taller (ver 3.4). Vacío = el de la biblioteca. |

Si una celda está vacía, esa línea directamente no aparece en la tarjeta.

**Filas de ejemplo.** Las celdas que sólo traen el texto de plantilla
("TITULO", "CATEGORIAS", "Horarios", "Nombre de Tallerista", "Descripcion") se
toman como vacías, y un título con "En construcción" o "Próximamente" convierte
la fila en una tarjeta de "Próximamente". Así una fila de ejemplo nunca se
publica como si fuera un taller real. Los talleres confirmados van siempre
antes que los anticipos.

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

En la página de Catálogo hay un buscador que muestra los resultados **en la
misma página** (con tapa, autor, editorial y año), más los títulos destacados. Al tocar un libro
(en Catálogo o en Novedades de Inicio) se abre una **ficha en un modal** con
tapa, sinopsis, editorial, año, páginas e ISBN, un botón para consultar
disponibilidad por WhatsApp. El sitio no tiene enlaces a DigiBepé: todo se muestra dentro de la página.

### Estado actual: buscador conectado y activo

El catálogo está conectado a **http://4124.bepe.ar/cgi-bin/koha/opac-main.pl** con
`catalogoDisponible: true` en `src/datos/sitio.js`. El buscador permite realizar
consultas directas abriendo los resultados en Koha / DigiBepé en una pestaña nueva.
### Cómo funciona el buscador

El navegador no puede leer `http://4124.bepe.ar` desde un sitio HTTPS, así que
la búsqueda pasa por una **función de Vercel**:

```
navegador → /api/catalogo?q=...&idx=ti  →  (servidor) DigiBepé en formato RSS
          ← JSON con título, autor, ISBN, editorial, año
```

- `api/catalogo.js` recibe la búsqueda y `lib/koha.js` lee la respuesta de Koha
  (RSS; si no, la página HTML de resultados). Vercel guarda cada búsqueda 10
  minutos en caché.
- Si DigiBepé no responde (503, demora de más de 8 s), la página muestra un
  aviso con WhatsApp y correo en lugar de romperse.
- Las tapas de los resultados salen de Google Books **por ISBN**, sin API key ni
  cuota; si Google no la tiene, de Open Library. Si el resultado no tiene ISBN
  o ninguna sirvió, se pide a `/api/libro` por título y autor (Google, Open
  Library y Apple Books). Si tampoco hay, queda la tapa de diseño.
- La sinopsis se pide a `api/libro.js` recién cuando alguien abre la ficha (una
  consulta por libro, con un día de caché).
- La búsqueda queda en la dirección (`catalogo.html?q=almada&idx=au`), así que
  se puede compartir.
- Local: `npm run serve` atiende también `/api/...` con los mismos archivos.

### API key de Google Books (variable de entorno, nunca en el repositorio)

La key **no se escribe en ningún archivo**. Se carga una sola vez en Vercel:

1. Vercel → el proyecto → **Settings → Environment Variables**.
2. Nombre `GOOGLE_BOOKS_API_KEY`, valor la key, entornos Production y Preview.
3. Redeploy (Deployments → ⋯ → Redeploy).

Con eso la usan las dos partes: `api/libro.js` (tapas y sinopsis que faltan) y
`npm run build`, que antes de armar las páginas busca tapas y sinopsis de los
libros destacados que todavía no estén en `src/datos/libros-info.json` (tope
de 60 segundos; si falla, el deploy sigue igual). **Sin key también corre**:
usa Open Library y Apple Books, que no la piden.

En la key de Google Cloud conviene dejar **Restricciones de API → Books API**.
No hace falta restringirla por sitio web: nunca llega al navegador.

### Tapas y sinopsis de los libros

Las tarjetas ya no enlazan a DigiBepé (respondía 503 casi siempre): abren la
ficha del libro dentro del sitio.

Las tapas y sinopsis **no** se piden al abrir la página. Se buscan una vez, a
mano, y quedan guardadas en `src/datos/libros-info.json`:

```
npm run libros            # busca solo los libros que todavía no tienen datos
npm run libros -- --todos # vuelve a buscar todos
npm run build
```

- Busca por **título + autor** (no por ISBN) en Google Books y, si falta algo,
  en Open Library. Si después de las dos el libro sigue sin tapa, prueba en
  **Apple Books** (iTunes Search API: gratuita, sin key ni registro; tiendas de
  México y España, que tienen el catálogo en castellano). Un resultado solo se acepta si coincide el título completo y
  el apellido del autor; si no, el libro queda con la tapa de diseño.
- Los ISBN que estaban cargados se quitaron: varios eran de otros libros
  («Ladrilleros» mostraba una novela de Petros Márkaris y «El resplandor», la
  tapa de «It»).
- **Google Books sin API key** usa una cuota compartida que suele estar agotada
  (error 429). Con una key gratuita de Google Cloud (API "Books") hay sinopsis en
  castellano:
  `$env:GOOGLE_BOOKS_API_KEY="tu-key"; npm run libros` (PowerShell).
- Si una fuente está caída, el libro no se guarda y se reintenta en la próxima
  corrida.
- Correcciones a mano en `catalogo.js`, libro por libro: `portada` (URL https o
  `false`), `sinopsis`, `buscarComo` (otro título para buscar, p. ej. el
  original en inglés), `editorial`, `anio`, `paginas`, `isbn`. Siempre ganan
  sobre lo encontrado.
- **Respaldo en el navegador.** Cada tarjeta lleva varias tapas en orden: la
  guardada, la de Google por ISBN y la de Open Library por ISBN. Si una no
  carga o es una imagen vacía (1 px de Open Library, cartel de 128×170 de
  Google), se prueba la siguiente. Si se acaban, o el libro no tenía ninguna,
  se pide a `/api/libro` por título y autor (una vez por libro; Vercel guarda la
  respuesta un día). Recién ahí queda la tapa de diseño.
- Lo ideal es que `libros-info.json` esté completo en el repositorio: así las
  tapas salen directo del HTML y no hace falta consultar nada al abrir la
  página. Correr `npm run libros` y subir el JSON con el resto de los cambios.

### Catálogo de respaldo (hoja de Google)

DigiBepé se cae seguido (503). Para que igual se pueda buscar, hay una copia del
catálogo en la hoja **Catálogo de respaldo** (Drive → Recursos Web Biblioteca →
Catalogo), con un renglón por título: ID, título, autor, otros autores,
editorial, lugar, año, ISBN, materias, colección, signatura, tipo, cantidad de
ejemplares, disponibles, prestados, solo sala y la fecha de actualización.

- **La biblioteca** la usa directo en Google Sheets cuando el OPAC no anda
  (Ctrl+F, o Datos → Crear filtro para filtrar por autor o materia).
- **El sitio** la usa solo: si `/api/catalogo` no logra respuesta de DigiBepé,
  busca en la hoja (título, autor, materia, ISBN o todo, como Koha) y la página
  avisa que los resultados salen de la copia y que la disponibilidad se consulta
  por WhatsApp o en el mostrador. No se muestra "Disponible / Prestado": la
  copia es del día en que se exportó. Apenas DigiBepé vuelve, se usa otra vez
  DigiBepé (la respuesta de respaldo se guarda en caché solo 2 minutos).
- Todo es gratis: la hoja se lee como CSV publicado, igual que la de talleres,
  y la búsqueda se hace en la propia función de Vercel.

**Sincronizar (cada vez que se cargan libros nuevos, por ejemplo una vez por mes):**

1. En DigiBepé (intranet de Koha): Herramientas → Exportar datos →
   Exportar registros bibliográficos, con los ejemplares incluidos y formato
   **MARC binario (.mrc)**.
2. En la carpeta del proyecto:
   `npm run catalogo:respaldo -- ruta\al\koha.mrc`
   Deja `catalogo-respaldo.csv` en la raíz (no se sube al repositorio: está en
   `.gitignore`, igual que los `.mrc`).
3. En la hoja: **Archivo → Importar → Subir** el CSV, y elegir
   - Ubicación: **Reemplazar hoja actual**
   - Tipo de separador: **Coma**
   - **Destildar "Convertir texto en números, fechas y fórmulas"**. Si queda
     tildado, Sheets convierte los ISBN en números (pierden la X final y pueden
     salir en notación científica) y el buscador por ISBN deja de encontrarlos.
4. La primera vez, publicarla: **Archivo → Compartir → Publicar en la web** →
   la pestaña del catálogo → **Valores separados por comas (.csv)** → Publicar.
   Copiar la dirección en `catalogoRespaldo` de `src/datos/sitio.js`, hacer
   build y subir. Las siguientes veces no hace falta: el enlace publicado sigue
   igual y Google lo actualiza solo (puede tardar unos minutos).

Si la hoja no está publicada (Google devuelve una página de inicio de sesión)
o está vacía, el buscador muestra el aviso de error de siempre.

### Limitación conocida: el catálogo no tiene HTTPS

(Resuelto para el buscador con `/api/catalogo`; lo de abajo explica por qué.)

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
  └─ scripts/sync-instagram.py  (consulta la API oficial de Instagram)
       ├─ public/noticias/{shortcode}.jpg   la foto de cada publicación
       └─ public/data/noticias.json         texto resumido, fecha y enlace
  └─ si hubo cambios: commit + push  ──▶  Vercel publica solo
  └─ los lunes: renueva el token de Instagram y lo guarda en el secret
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

### 5.1 La API oficial y sus dos secrets

El script usa la **API de Instagram con inicio de sesión de Instagram** (la que
no necesita una página de Facebook). Pide `graph.instagram.com/me/media` con
un token de la cuenta de la biblioteca. Sólo usa lo que trae Python: no hay
que instalar nada.

Antes se leía el perfil público con un navegador sin ventana (Playwright),
sin token. Se reemplazó porque Instagram no permite oficialmente esa lectura
y puede cortarla en cualquier momento.

La Action necesita dos secrets (**Settings → Secrets and variables → Actions**
en GitHub):

| Secret | Qué es | Vence |
|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Token de Instagram de `@bibliotecaedgarmorisoli` (empieza con `IG`) | A los 60 días, pero **se renueva solo** |
| `GH_PAT_SECRETS` | Token personal de GitHub que deja guardar el token renovado | Una vez por año: **hay que recrearlo a mano** |

**Cómo se renueva el token de Instagram.** Todos los lunes (y cuando se corre
a mano tildando *Renovar también el token de Instagram*) la Action ejecuta
`python scripts/sync-instagram.py --renovar`: le pide a Instagram un token
nuevo por 60 días más y lo guarda en `INSTAGRAM_ACCESS_TOKEN`. El permiso
normal de una Action no alcanza para escribir secrets; por eso existe
`GH_PAT_SECRETS`. Instagram no deja renovar un token con menos de 24 horas.

**Cómo conseguir `INSTAGRAM_ACCESS_TOKEN`** (sólo la primera vez, o si venció):

1. La cuenta de Instagram tiene que ser profesional (Creador o Empresa).
2. En [developers.facebook.com](https://developers.facebook.com/apps/), en la
   app de la biblioteca: **Roles de la aplicación → Roles → Agregar personas →
   Evaluador de Instagram** → `bibliotecaedgarmorisoli`.
3. Con esa cuenta, aceptar la invitación en
   `instagram.com/accounts/manage_access/` → **Invitaciones de tester**.
4. En la app: **Instagram → Configuración de la API con inicio de sesión de
   Instagram → Generar tokens de acceso → Agregar cuenta**, y después
   **Generar token**. El permiso que hace falta es `instagram_business_basic`.
5. Copiar el token y pegarlo en el secret `INSTAGRAM_ACCESS_TOKEN`.

**Cómo conseguir `GH_PAT_SECRETS`** (una vez por año):

1. En GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. *Repository access*: **Only select repositories** → este repositorio.
3. *Repository permissions*: **Secrets: Read and write**. No hace falta nada más.
4. Vencimiento: el máximo (1 año). Anotar la fecha para recrearlo antes.
5. Copiar el token y pegarlo en el secret `GH_PAT_SECRETS`.

**Qué puede fallar:**

| Qué se ve en la pestaña Actions | Qué pasó | Qué hacer |
|---|---|---|
| Aviso amarillo "Instagram no respondió" | Problema pasajero de Instagram | Nada: el sitio muestra lo último bueno y se reintenta solo |
| Rojo "Instagram rechazó el token" | El token venció o se revocó | Generar uno nuevo (pasos de arriba) |
| Rojo "Falta el secret…" | No está cargado alguno de los dos secrets | Cargarlo |
| Rojo "No se pudo guardar el token renovado" | Venció `GH_PAT_SECRETS` | Recrearlo. Hay tiempo: el token de Instagram sigue sirviendo hasta 60 días desde la última renovación |

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
      "alt": "texto alternativo, si quien publicó cargó uno",
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

## 6. Loaders de sección (el libro animado)

El libro animado vive en `src/parciales/loader.html`. `build.js` lo inserta
donde una página pone el marcador `{{LOADER_LIBRO}}`: hoy está dentro de los
bloques grises de carga de talleres (Inicio y Talleres) y de noticias.

- **No tapa la página.** Antes era una pantalla completa que esperaba a que
  llegaran los datos de Google Sheets; eso demoraba todo lo que se ve (y bajaba
  el puntaje de Lighthouse). Ahora la página aparece al instante y el libro sólo
  ocupa el lugar de lo que falta cargar.
- **No hay que encenderlo ni apagarlo**: cuando `talleres.js` o `noticias.js`
  ocultan su bloque de carga, el libro se va con él.
- **Sin JavaScript no aparece**: el CSS sólo lo muestra bajo `html.js`, una
  clase que pone `theme.js` en el `<head>`.
- Con "reducir movimiento" activado en el sistema, el libro queda quieto
  (`public/js/loader-libro.js`).

Para sumar un loader a otra sección que cargue datos: poner `{{LOADER_LIBRO}}`
dentro de su contenedor de carga y darle `relative` a ese contenedor.

---

## 6.1 Contenido "Próximamente"

Todo lo que todavía no está listo para publicarse se muestra con el mismo
estilo: la etiqueta `.badge-proximamente` y el recuadro `.card-proximamente`
(en `src/input.css`). Hoy lo tienen:

| Dónde | Cómo se publica |
|---|---|
| Inicio → Novedades literarias | Reemplazar el recuadro por la lista con tapas reales (hay un ejemplo comentado en `src/paginas/index.html`). |
| Catálogo → Algunos títulos | Poner `CATALOGO_DESTACADO_PUBLICADO = true` en `src/datos/catalogo.js` cuando la biblioteca confirme la selección. |
| Extensión Cultural → Proyectos y Visitas de escuelas | Reemplazar los recuadros por las tarjetas con fotos. |
| Flotilla Literaria, Sala de Pensamiento | Páginas enteras en preparación. |
| Biblio-Interactiva, Rincón Pampeano, visor de lectura | Ver §4 y §7. |
| Talleres | Desde la planilla: `activo = PROXIMAMENTE` (ver §3.1). |

---

## 6.2 Imágenes

Las fotos se sirven en **WebP** con dos tamaños (`srcset`): el celular baja la
chica y la computadora la grande. El fondo del inicio pasó de 1,8 MB (PNG) a
37 KB / 86 KB, y lleva `fetchpriority="high"` porque es lo primero que mide
Lighthouse (LCP).

Para sumar una foto nueva, convertirla a WebP (por ejemplo en
<https://squoosh.app>, calidad 70-75) en dos anchos y usar el mismo patrón que
`hero-bg-800.webp` / `hero-bg-1600.webp` en `src/paginas/index.html`.

Los PNG originales (`hero-bg.png`, `fachada.png`, `fachada-2.png`) y
`logo-biblioteca.png` (4,8 MB) ya no se usan y fueron eliminados del repositorio.

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
- No hay ninguna clave ni token en el código. Los dos que usa la
  sincronización de Instagram están guardados como secrets de GitHub
  (sección 5.1): sólo los ve la Action, y el script nunca los imprime.

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

- Alojar las tipografías en el propio sitio, para no depender de Google Fonts.
- Datos estructurados (schema.org `Library`) para que Google muestre horarios y
  dirección en los resultados de búsqueda.
