"""
Sincroniza las últimas publicaciones de Instagram de la biblioteca.

Lo corre la GitHub Action .github/workflows/instagram-sync.yml dos veces por
día. También se puede correr a mano:

    pip install instaloader requests
    python scripts/sync-instagram.py

Qué hace:
  1. Lee las últimas publicaciones del perfil público @bibliotecaedgarmorisoli.
  2. Descarga la foto de cada una a public/noticias/{shortcode}.jpg.
     Se copian al sitio porque los enlaces del CDN de Instagram vencen a los
     pocos días: si usáramos el enlace original, la foto se rompería sola.
  3. Escribe public/data/noticias.json, que es lo que lee la página Noticias.

Si Instagram no responde (bloqueos, límite de pedidos), NO toca nada: el sitio
sigue mostrando lo último que se sincronizó bien.

Sesión (recomendado):
  Instagram suele rechazar las consultas anónimas con "401 Please wait a few
  minutes", sobre todo desde servidores como los de GitHub. Con una sesión
  iniciada el pedido pasa. El script la usa si existen estas dos variables
  de entorno (en GitHub: Settings > Secrets and variables > Actions):
    IG_USUARIO  el usuario con el que se creó la sesión
    IG_SESION   el archivo de sesión de instaloader, codificado en base64
  Cómo crearlas está en DOCUMENTACION.md. La contraseña nunca se guarda:
  sólo la sesión, que se puede revocar cerrando sesión en Instagram.
"""

from __future__ import annotations

import base64
import itertools
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import instaloader
import requests

PERFIL = "bibliotecaedgarmorisoli"
CANTIDAD = 6
# Las publicaciones fijadas aparecen primero aunque sean viejas (Instagram
# permite hasta 3). Se leen unas de más y después se ordena por fecha.
MARGEN_FIJADAS = 3
LARGO_RESUMEN = 220
ARGENTINA = timezone(timedelta(hours=-3))  # sin horario de verano

RAIZ = Path(__file__).resolve().parent.parent
DIR_FOTOS = RAIZ / "public" / "noticias"
ARCHIVO_JSON = RAIZ / "public" / "data" / "noticias.json"


def avisar(mensaje: str) -> None:
    """Imprime un aviso que GitHub Actions muestra en amarillo en el resumen."""
    print(f"::warning::{mensaje}")


def resumir(texto: str | None) -> str:
    """Primer tramo del texto, cortado en una palabra entera."""
    limpio = " ".join((texto or "").split())
    if len(limpio) <= LARGO_RESUMEN:
        return limpio
    corte = limpio[:LARGO_RESUMEN].rsplit(" ", 1)[0].rstrip(".,;:-")
    return corte + "…"


def descargar_foto(url: str, destino: Path) -> bool:
    """Baja la imagen. Se escribe en un .tmp y se renombra al final, para no
    dejar nunca un .jpg a medio descargar si el proceso se corta."""
    try:
        r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        if not r.headers.get("Content-Type", "").startswith("image/"):
            raise ValueError(f"no es una imagen ({r.headers.get('Content-Type')})")
        temporal = destino.with_suffix(".tmp")
        temporal.write_bytes(r.content)
        temporal.replace(destino)
        return True
    except (requests.RequestException, ValueError) as error:
        avisar(f"No se pudo bajar la foto de {destino.stem}: {error}")
        return False


def cargar_sesion(L: instaloader.Instaloader) -> None:
    """Carga la sesión de IG_SESION si está configurada. Si no, sigue anónimo."""
    usuario = os.environ.get("IG_USUARIO", "").strip()
    sesion = os.environ.get("IG_SESION", "").strip()
    if not (usuario and sesion):
        print("Sin IG_USUARIO / IG_SESION: se consulta de forma anónima.")
        return
    with tempfile.TemporaryDirectory() as carpeta:
        archivo = Path(carpeta) / "sesion"
        archivo.write_bytes(base64.b64decode(sesion))
        L.load_session_from_file(usuario, str(archivo))
    print(f"Sesión de {usuario} cargada.")


def leer_publicaciones() -> list[instaloader.Post]:
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
        max_connection_attempts=1,
    )
    cargar_sesion(L)
    perfil = instaloader.Profile.from_username(L.context, PERFIL)
    candidatas = list(itertools.islice(perfil.get_posts(), CANTIDAD + MARGEN_FIJADAS))
    candidatas.sort(key=lambda p: p.date_utc, reverse=True)
    return candidatas[:CANTIDAD]


def main() -> int:
    # En Windows la consola no siempre usa UTF-8 y las tildes salen rotas.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    try:
        publicaciones = leer_publicaciones()
    except Exception as error:  # instaloader lanza varias clases distintas
        avisar(f"Instagram no respondió ({type(error).__name__}: {error}). Se conservan las noticias anteriores.")
        return 0

    if not publicaciones:
        avisar("Instagram devolvió cero publicaciones. Se conservan las noticias anteriores.")
        return 0

    DIR_FOTOS.mkdir(parents=True, exist_ok=True)
    ARCHIVO_JSON.parent.mkdir(parents=True, exist_ok=True)

    noticias = []
    for post in publicaciones:
        foto = DIR_FOTOS / f"{post.shortcode}.jpg"
        # El shortcode no cambia: si la foto ya está, no se vuelve a bajar.
        # Así no hay commits nuevos cuando no hubo publicaciones nuevas.
        tiene_foto = foto.exists() or descargar_foto(post.url, foto)

        noticias.append({
            "id": post.shortcode,
            "url": f"https://www.instagram.com/p/{post.shortcode}/",
            "imagen": f"/noticias/{post.shortcode}.jpg" if tiene_foto else "",
            "alt": (post.accessibility_caption or "").strip(),
            "caption": resumir(post.caption),
            "fecha": post.date_utc.replace(tzinfo=timezone.utc).astimezone(ARGENTINA).date().isoformat(),
        })

    # Borra las fotos de publicaciones que ya salieron de las últimas 6,
    # para que el repositorio no crezca para siempre.
    vigentes = {f"{n['id']}.jpg" for n in noticias}
    for vieja in DIR_FOTOS.glob("*.jpg"):
        if vieja.name not in vigentes:
            vieja.unlink()

    # Sólo se reescribe el JSON si cambió el contenido. Si se escribiera
    # siempre (con una fecha de "actualizado" nueva), habría un commit y un
    # deploy dos veces por día aunque no hubiera nada nuevo.
    anterior = None
    if ARCHIVO_JSON.exists():
        try:
            anterior = json.loads(ARCHIVO_JSON.read_text(encoding="utf-8")).get("noticias")
        except (json.JSONDecodeError, AttributeError):
            anterior = None

    if anterior == noticias:
        print("Sin publicaciones nuevas.")
        return 0

    datos = {
        "actualizado": datetime.now(ARGENTINA).isoformat(timespec="minutes"),
        "perfil": f"https://www.instagram.com/{PERFIL}/",
        "noticias": noticias,
    }
    ARCHIVO_JSON.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {len(noticias)} publicaciones guardadas en {ARCHIVO_JSON.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
