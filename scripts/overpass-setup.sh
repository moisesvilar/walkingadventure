#!/usr/bin/env bash
# Deja el Overpass local listo y compartido por TODAS las sesiones y worktrees.
# Idempotente: si ya está importado y corriendo, no hace nada y sale.
#
#   scripts/overpass-setup.sh
#
# Una vez terminado no hay que volver a ejecutarlo nunca: la base de datos vive
# en el volumen Docker walkingadventure-overpass-db (independiente de rutas) y el
# contenedor arranca solo con Docker (restart: unless-stopped).

set -euo pipefail

WA_HOME="${WA_HOME:-$HOME/.walkingadventure}"
PBF="$WA_HOME/data/spain-latest.osm.pbf"
# Mirrors del extracto de España, en orden de preferencia. OSM France va primero
# por velocidad medida: Geofabrik limita por IP a ~100 KB/s (una segunda conexión
# baja a 750 B/s), OSM France sostiene ~280 KB/s. Sobre 1,4-1,6 GB son ~1h30 en
# vez de ~3h45. Ambos son el extracto completo del país.
# OJO: no se puede reanudar (`curl -C -`) cambiando de mirror — son ficheros
# distintos. Si cambias el orden, borra el .pbf a medias primero.
PBF_URLS=(
  "https://download.openstreetmap.fr/extracts/europe/spain-latest.osm.pbf"
  "https://download.geofabrik.de/europe/spain-latest.osm.pbf"
)
COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ¿Ya está sirviendo datos de verdad? Un contenedor "Up" no basta: si el volumen
# está vacío responde 200 con una página de error XML (precedente real).
#
# El criterio ya no vive aquí: es la sonda de SPEC-024, la misma que decide si el
# proxy encamina una generación al Overpass del proyecto. Un script y un servidor
# con criterios distintos de "está listo" es cómo uno de los dos se equivoca solo.
# Y la sonda exige un número mínimo de elementos: el `grep '"elements"'` de antes
# pasaba con la lista vacía, que es justo lo que devuelve una base de datos sin
# importar. Cuando falla, dice cuál de las dos causas conocidas es —importar horas,
# o chmod 755 /db— y ese diagnóstico se enseña tal cual.
SONDA="$COMPOSE_DIR/server/aguas-arriba/sonda-overpass.mjs"
VEREDICTO="$(node "$SONDA" http://localhost:12345/api/interpreter 2>/dev/null)" && LISTO=1 || LISTO=0

if [ "$LISTO" = 1 ]; then
  say "Overpass local ya está sirviendo en http://localhost:12345 — nada que hacer."
  echo "  $VEREDICTO"
  exit 0
fi
[ -n "$VEREDICTO" ] && printf '\n%s\n' "$VEREDICTO"

mkdir -p "$WA_HOME/data" "$WA_HOME/cache/overpass"

say "1/3 · Extracto de España (~1,6 GB, reanudable)"
# El mirror usado se recuerda: reanudar contra otro corrompería el fichero.
SRC_FILE="$WA_HOME/data/.pbf-source"
PREV_SRC="$(cat "$SRC_FILE" 2>/dev/null || true)"
if [ -s "$PBF" ] && [ -n "$PREV_SRC" ]; then
  URLS=("$PREV_SRC")
  echo "  reanudando desde $PREV_SRC"
else
  URLS=("${PBF_URLS[@]}")
  [ -e "$PBF" ] && rm -f "$PBF"
fi

ok=0
for url in "${URLS[@]}"; do
  echo "  → $url"
  printf '%s' "$url" > "$SRC_FILE"
  # -C - reanuda; si el fichero ya está completo, curl sale sin descargar nada.
  if curl -L -C - --retry 5 --retry-delay 10 -o "$PBF" "$url"; then ok=1; break; fi
  echo "    falló; probando el siguiente mirror"
  rm -f "$PBF"
done
[ "$ok" = 1 ] || { echo "  ✗ no se pudo descargar el extracto desde ningún mirror"; exit 1; }
echo "  $PBF ($(du -h "$PBF" | cut -f1))"

say "2/3 · Levantando Overpass (la importación tarda HORAS)"
docker compose --project-directory "$COMPOSE_DIR" up -d

# /db llega del image como 700 overpass:overpass. Con un bind mount en macOS daba
# igual (los permisos se ignoran), pero en un volumen con nombre son permisos
# Linux de verdad: nginx/fcgiwrap corren como uid 101 y no pueden ni atravesar
# /db para alcanzar el socket del dispatcher (/db/db/osm3s_osm_base, que sí es
# 666). Síntoma: 200 con página de error XML "Permission denied ... Unix_Socket",
# indistinguible a simple vista de "la importación aún no ha terminado".
docker exec overpass-spain chmod 755 /db 2>/dev/null || true

say "3/3 · Importando"
echo "  Sigue el progreso con:  docker compose logs -f"
echo "  Comprueba cuándo está listo con:  scripts/overpass-setup.sh"
echo
echo "  Mientras tanto no se bloquea nada: server.mjs cae a los mirrors públicos"
echo "  de Overpass, y la caché compartida (~/.walkingadventure/cache/overpass)"
echo "  ya evita repetir las consultas conocidas."
