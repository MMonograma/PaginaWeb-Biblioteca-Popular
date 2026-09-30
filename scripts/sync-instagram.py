"""
Sincroniza las últimas publicaciones de Instagram de la biblioteca.

Lo corre la GitHub Action .github/workflows/instagram-sync.yml dos veces por
día. También se puede correr a mano:

    pip install playwright
    python -m playwright install chromium
    python scripts/sync-instagram.py

Qué hace:
  1. Abre el perfil público @bibliotecaedgarmorisoli en un Chromium sin
     ventana (Playwright), igual que una persona que entra sin iniciar sesión.
  2. Lee las publicaciones que Instagram manda dentro de la propia página.
  3. Descarga la foto de cada una a public/noticias/{shortcode}.jpg.
     Se copian al sitio porque los enlaces del CDN de Instagram vencen a los
     pocos días: si usáramos el enlace original, la foto se rompería sola.
  4. Escribe public/data/noticias.json, que es lo que lee la página Noticias.

Por qué un navegador y no instaloader: desde 2026 Instagram rechaza las
consultas "sueltas" a su API sin sesión (401 require_login), pero sigue
mostrando el perfil público a quien lo abre en un navegador. Así no hace falta
guardar ninguna contraseña ni sesión.

Si Instagram no responde o cambia la página, NO toca nada: el sitio sigue
mostrando lo último que se sincronizó bien, y la Action deja un aviso.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

PERFIL = "bibliotecaedgarmorisoli"
CANTIDAD = 6
LARGO_RESUMEN = 220
ARGENTINA = timezone(timedelta(hours=-3))  # sin horario de verano

# El ID numérico de cada publicación (pk) guarda adentro el momento en que se
# publicó: los bits de arriba son milisegundos desde el 24/8/2011, la "época"
# propia de Instagram. La página no trae la fecha por separado, así que se
# saca de ahí.
EPOCA_INSTAGRAM_MS = 1314220021721

RAIZ = Path(__file__).resolve().parent.parent
DIR_FOTOS = RAIZ / "public" / "noticias"
ARCHIVO_JSON = RAIZ / "public" / "data" / "noticias.json"

NAVEGADOR = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)


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


def fecha_de_pk(pk: str) -> datetime:
    ms = (int(pk) >> 23) + EPOCA_INSTAGRAM_MS
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def buscar_clave(dato, clave: str):
    """Recorre el JSON anidado de la página hasta encontrar `clave`."""
    if isinstance(dato, dict):
        if clave in dato:
            return dato[clave]
        valores = dato.values()
    elif isinstance(dato, list):
        valores = dato
    else:
        return None
    for v in valores:
        encontrado = buscar_clave(v, clave)
        if encontrado is not None:
            return encontrado
    return None


def leer_publicaciones(pagina) -> list[dict]:
    """Abre el perfil y devuelve las publicaciones que vienen en la página."""
    pagina.goto(f"https://www.instagram.com/{PERFIL}/", wait_until="domcontentloaded", timeout=45_000)
    pagina.wait_for_timeout(5_000)

    bloques = pagina.eval_on_selector_all(
        'script[type="application/json"]', "els => els.map(e => e.textContent)"
    )
    for bloque in bloques:
        if "polaris_ordered_timeline_connection" not in bloque:
            continue
        conexion = buscar_clave(json.loads(bloque), "polaris_ordered_timeline_connection")
        if conexion and conexion.get("edges"):
            return [borde["node"] for borde in conexion["edges"] if borde.get("node")]
    return []


def descargar_foto(contexto, url: str, destino: Path) -> bool:
    """Baja la imagen con el mismo navegador. Se escribe en un .tmp y se
    renombra al final, para no dejar nunca un .jpg a medio descargar."""
    try:
        r = contexto.request.get(url, timeout=30_000)
        tipo = r.headers.get("content-type", "")
        if not r.ok or not tipo.startswith("image/"):
            raise ValueError(f"respuesta {r.status} {tipo}")
        temporal = destino.with_suffix(".tmp")
        temporal.write_bytes(r.body())
        temporal.replace(destino)
        return True
    except (PlaywrightError, ValueError) as error:
        avisar(f"No se pudo bajar la foto de {destino.stem}: {error}")
        return False


def main() -> int:
    # En Windows la consola no siempre usa UTF-8 y las tildes salen rotas.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    DIR_FOTOS.mkdir(parents=True, exist_ok=True)
    ARCHIVO_JSON.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        contexto = navegador.new_context(locale="es-AR", user_agent=NAVEGADOR, viewport={"width": 1280, "height": 900})
        pagina = contexto.new_page()

        try:
            nodos = leer_publicaciones(pagina)
        except (PlaywrightError, json.JSONDecodeError) as error:
            avisar(f"No se pudo abrir Instagram ({type(error).__name__}: {error}). Se conservan las noticias anteriores.")
            navegador.close()
            return 0

        if not nodos:
            avisar("Instagram no mandó publicaciones (¿pidió iniciar sesión o cambió la página?). Se conservan las noticias anteriores.")
            navegador.close()
            return 0

        # Las fijadas aparecen primero aunque sean viejas: se ordena por fecha.
        nodos = [n for n in nodos if n.get("code") and n.get("pk")]
        nodos.sort(key=lambda n: int(n["pk"]), reverse=True)
        nodos = nodos[:CANTIDAD]

        noticias = []
        for nodo in nodos:
            codigo = nodo["code"]
            foto = DIR_FOTOS / f"{codigo}.jpg"
            url_foto = nodo.get("display_uri") or ""
            # El código no cambia: si la foto ya está, no se vuelve a bajar.
            # Así no hay commits nuevos cuando no hubo publicaciones nuevas.
            tiene_foto = foto.exists() or (bool(url_foto) and descargar_foto(contexto, url_foto, foto))
            es_reel = nodo.get("product_type") == "clips" or nodo.get("media_type") == 2

            noticias.append({
                "id": codigo,
                "url": f"https://www.instagram.com/{'reel' if es_reel else 'p'}/{codigo}/",
                "imagen": f"/noticias/{codigo}.jpg" if tiene_foto else "",
                "alt": (nodo.get("accessibility_caption") or "").strip(),
                "caption": resumir((nodo.get("caption") or {}).get("text")),
                "fecha": fecha_de_pk(nodo["pk"]).astimezone(ARGENTINA).date().isoformat(),
            })

        navegador.close()

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
