"""
Sincroniza las últimas publicaciones de Instagram de la biblioteca.

Lo corre la GitHub Action .github/workflows/instagram-sync.yml cada 3 horas,
de 9 a 21 hs. También se puede correr a mano (no necesita instalar nada,
sólo Python 3.9 o más nuevo):

    INSTAGRAM_ACCESS_TOKEN="IG..." python scripts/sync-instagram.py

Qué hace:
  1. Le pide a la API oficial de Instagram (la de "inicio de sesión de
     Instagram", sin página de Facebook) las últimas publicaciones de la
     cuenta dueña del token: @bibliotecaedgarmorisoli.
  2. Descarga la foto de cada una a public/noticias/{shortcode}.jpg.
     Se copian al sitio porque los enlaces del CDN de Instagram vencen a los
     pocos días: si usáramos el enlace original, la foto se rompería sola.
  3. Escribe public/data/noticias.json, que es lo que lee la página Noticias.

El token dura 60 días. Para que no venza, la misma Action lo renueva una vez
por semana con:

    python scripts/sync-instagram.py --renovar

que pide un token nuevo a Instagram y lo guarda en el secret
INSTAGRAM_ACCESS_TOKEN del repositorio (ver DOCUMENTACION.md, sección 5).

Si Instagram no responde por un problema pasajero, NO toca nada: el sitio
sigue mostrando lo último que se sincronizó bien y la Action deja un aviso.
Si el token falta, venció o fue revocado, la corrida termina en rojo, porque
eso no se arregla solo.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

PERFIL = "bibliotecaedgarmorisoli"
CANTIDAD = 12
LARGO_RESUMEN = 220
ARGENTINA = timezone(timedelta(hours=-3))  # sin horario de verano

# Sin número de versión a propósito: Instagram usa la versión vigente, y así
# el script no deja de andar cuando Meta da de baja una versión vieja.
API = "https://graph.instagram.com"
CAMPOS = (
    "id,caption,media_type,media_product_type,media_url,thumbnail_url,"
    "permalink,timestamp,children{media_type,media_url,thumbnail_url}"
)
SECRET_TOKEN = "INSTAGRAM_ACCESS_TOKEN"
ESPERA = 30  # segundos

RAIZ = Path(__file__).resolve().parent.parent
DIR_FOTOS = RAIZ / "public" / "noticias"
ARCHIVO_JSON = RAIZ / "public" / "data" / "noticias.json"


class ErrorDeToken(Exception):
    """Instagram rechazó el token: falta, venció, fue revocado o no tiene permiso."""


class ErrorPasajero(Exception):
    """Instagram no respondió o respondió mal: se reintenta en la próxima corrida."""


def avisar(mensaje: str) -> None:
    """Imprime un aviso que GitHub Actions muestra en amarillo en el resumen."""
    print(f"::warning::{mensaje}")


def fallar(mensaje: str) -> None:
    """Imprime un error que GitHub Actions muestra en rojo en el resumen."""
    print(f"::error::{mensaje}")


def resumir(texto: str | None) -> str:
    """Primer tramo del texto, cortado en una palabra entera."""
    limpio = " ".join((texto or "").split())
    if len(limpio) <= LARGO_RESUMEN:
        return limpio
    corte = limpio[:LARGO_RESUMEN].rsplit(" ", 1)[0].rstrip(".,;:-")
    return corte + "…"


def pedir(ruta: str, token: str, **parametros: str) -> dict:
    """Consulta la API de Instagram y devuelve el JSON de la respuesta.

    Los mensajes de error nunca incluyen la dirección consultada, porque el
    token viaja ahí y no tiene que quedar escrito en el registro de la Action.
    """
    consulta = urllib.parse.urlencode({**parametros, "access_token": token})
    try:
        with urllib.request.urlopen(f"{API}/{ruta}?{consulta}", timeout=ESPERA) as r:
            return json.load(r)
    except urllib.error.HTTPError as error:
        try:
            detalle = json.load(error).get("error", {})
        except (json.JSONDecodeError, AttributeError, UnicodeDecodeError):
            detalle = {}
        mensaje = f"{error.code} {detalle.get('message') or error.reason}"
        # Los errores 4xx son nuestros (token o permisos), salvo el 429, que
        # es "demasiadas consultas" y se pasa solo.
        if 400 <= error.code < 500 and error.code != 429:
            raise ErrorDeToken(mensaje) from None
        raise ErrorPasajero(mensaje) from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise ErrorPasajero(f"{type(error).__name__}: {getattr(error, 'reason', error)}") from None


def codigo_de(publicacion: dict) -> str:
    """El shortcode es el último tramo del enlace: instagram.com/p/{shortcode}/."""
    return publicacion.get("permalink", "").rstrip("/").rsplit("/", 1)[-1]


def url_de_foto(publicacion: dict) -> str:
    """La imagen que representa a la publicación.

    Fotos: la foto misma. Videos y reels: la miniatura. Carruseles: la
    primera imagen. Instagram no manda la imagen si la publicación tiene
    material con derechos de autor; en ese caso se devuelve "".
    """
    candidatas = [publicacion, *(publicacion.get("children") or {}).get("data", [])]
    for item in candidatas:
        if item.get("media_type") == "VIDEO":
            url = item.get("thumbnail_url")
        else:
            url = item.get("media_url") or item.get("thumbnail_url")
        if url:
            return url
    return ""


def descargar_foto(url: str, destino: Path) -> bool:
    """Baja la imagen. Se escribe en un .tmp y se renombra al final, para no
    dejar nunca un .jpg a medio descargar."""
    try:
        if not url.startswith("https://"):
            raise ValueError("el enlace no es https")
        with urllib.request.urlopen(url, timeout=ESPERA) as r:
            tipo = r.headers.get("Content-Type", "")
            if not tipo.startswith("image/"):
                raise ValueError(f"respuesta {r.status} {tipo}")
            contenido = r.read()
        temporal = destino.with_suffix(".tmp")
        temporal.write_bytes(contenido)
        temporal.replace(destino)
        return True
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        avisar(f"No se pudo bajar la foto de {destino.stem}: {type(error).__name__}: {getattr(error, 'reason', error)}")
        return False


def sincronizar(token: str) -> int:
    DIR_FOTOS.mkdir(parents=True, exist_ok=True)
    ARCHIVO_JSON.parent.mkdir(parents=True, exist_ok=True)

    try:
        try:
            respuesta = pedir("me/media", token, fields=f"{CAMPOS},alt_text", limit=str(CANTIDAD))
        except ErrorDeToken:
            # alt_text es un campo nuevo y pedir un campo que la API no conoce
            # hace fallar toda la consulta: se prueba de nuevo sin él. Si el
            # problema era el token, esta segunda consulta falla igual.
            respuesta = pedir("me/media", token, fields=CAMPOS, limit=str(CANTIDAD))
        publicaciones = respuesta.get("data") or []
    except ErrorDeToken as error:
        fallar(f"Instagram rechazó el token ({error}). Hay que generar uno nuevo en Meta for Developers y cargarlo en el secret {SECRET_TOKEN}.")
        return 1
    except ErrorPasajero as error:
        avisar(f"Instagram no respondió ({error}). Se conservan las noticias anteriores.")
        return 0

    publicaciones = [p for p in publicaciones if codigo_de(p) and p.get("timestamp")]
    if not publicaciones:
        avisar("Instagram no mandó publicaciones. Se conservan las noticias anteriores.")
        return 0

    # La API ya las manda de la más nueva a la más vieja; se ordena igual
    # para no depender de eso.
    for p in publicaciones:
        p["_fecha"] = datetime.strptime(p["timestamp"], "%Y-%m-%dT%H:%M:%S%z")
    publicaciones.sort(key=lambda p: p["_fecha"], reverse=True)
    publicaciones = publicaciones[:CANTIDAD]

    noticias = []
    for p in publicaciones:
        codigo = codigo_de(p)
        foto = DIR_FOTOS / f"{codigo}.jpg"
        url_foto = url_de_foto(p)
        # El código no cambia: si la foto ya está, no se vuelve a bajar.
        # Así no hay commits nuevos cuando no hubo publicaciones nuevas.
        tiene_foto = foto.exists() or (bool(url_foto) and descargar_foto(url_foto, foto))

        noticias.append({
            "id": codigo,
            "url": p["permalink"],
            "imagen": f"/noticias/{codigo}.jpg" if tiene_foto else "",
            # Texto alternativo que cargó quien publicó. Casi siempre viene
            # vacío; el texto de la publicación se muestra al lado igual.
            "alt": (p.get("alt_text") or "").strip(),
            "caption": resumir(p.get("caption")),
            "fecha": p["_fecha"].astimezone(ARGENTINA).date().isoformat(),
        })

    # Borra las fotos de publicaciones que ya salieron de las últimas 12,
    # para que el repositorio no crezca para siempre.
    vigentes = {f"{n['id']}.jpg" for n in noticias}
    for vieja in DIR_FOTOS.glob("*.jpg"):
        if vieja.name not in vigentes:
            vieja.unlink()

    # Sólo se reescribe el JSON si cambió el contenido. Si se escribiera
    # siempre (con una fecha de "actualizado" nueva), habría un commit y un
    # deploy en cada corrida aunque no hubiera nada nuevo.
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


def renovar(token: str) -> int:
    """Cambia el token por uno nuevo (60 días más) y lo guarda en el secret.

    Usa el programa `gh`, que ya viene en las máquinas de GitHub Actions, con
    el token personal de GitHub que la Action le pasa en GH_TOKEN (el secret
    GH_PAT_SECRETS). El GITHUB_TOKEN común de la Action no puede escribir
    secrets, por eso hace falta ese otro.
    """
    repositorio = os.environ.get("GITHUB_REPOSITORY", "")
    if not os.environ.get("GH_TOKEN") or not repositorio:
        fallar("Falta el secret GH_PAT_SECRETS: sin él no se puede guardar el token renovado y el actual va a vencer.")
        return 1

    try:
        respuesta = pedir("refresh_access_token", token, grant_type="ig_refresh_token")
    except ErrorDeToken as error:
        # También pasa si el token tiene menos de 24 horas: Instagram no deja
        # renovarlo tan pronto. En ese caso basta con esperar a la próxima.
        fallar(f"Instagram no quiso renovar el token ({error}). Si se generó hace menos de un día, es normal; si no, hay que generar uno nuevo en Meta for Developers.")
        return 1
    except ErrorPasajero as error:
        avisar(f"Instagram no respondió al renovar el token ({error}). Se reintenta la semana que viene.")
        return 0

    nuevo = respuesta.get("access_token")
    if not nuevo:
        fallar("Instagram respondió sin un token nuevo.")
        return 1
    # Desde acá GitHub tapa el token nuevo con *** si llegara a imprimirse.
    print(f"::add-mask::{nuevo}")

    # El valor va por la entrada estándar: no queda en la línea de comandos
    # ni en ningún archivo.
    guardado = subprocess.run(
        ["gh", "secret", "set", SECRET_TOKEN, "--repo", repositorio],
        input=nuevo, text=True, capture_output=True,
    )
    if guardado.returncode != 0:
        fallar(f"No se pudo guardar el token renovado ({guardado.stderr.strip()}). ¿Venció GH_PAT_SECRETS o le falta el permiso Secrets: Read and write?")
        return 1

    dias = int(respuesta.get("expires_in", 0)) // 86_400
    print(f"OK: token renovado y guardado en {SECRET_TOKEN}. Vence en {dias} días.")
    return 0


def main() -> int:
    # En Windows la consola no siempre usa UTF-8 y las tildes salen rotas.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    token = os.environ.get(SECRET_TOKEN, "").strip()
    if not token:
        fallar(f"Falta el secret {SECRET_TOKEN} (ver DOCUMENTACION.md, sección 5).")
        return 1

    if "--renovar" in sys.argv[1:]:
        return renovar(token)
    return sincronizar(token)


if __name__ == "__main__":
    sys.exit(main())
