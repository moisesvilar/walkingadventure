#!/usr/bin/env bash
#
# Ejecuta la batería y escribe un report. Es lo que envuelve la skill wa-qa-tester
# y lo único que lee quien orquesta el bucle.
#
#   scripts/qa-tester-run.sh <ETIQUETA> [--nucleo-only|--app-only]
#
# Por la salida estándar sale la ruta del report y nada más. Códigos de salida:
#
#   0  PASS      todo lo que se ejecutó, pasó
#   1  FAIL      algo falló
#   2  no se pudo ejecutar nada (etiqueta mal formada o ausente, Node insuficiente,
#                ninguna prueba que correr)
#
# El 2 existe porque wa-qa-tester solo distingue 0 de no-0, y confundir "falló"
# con "no se ejecutó" es el peor fallo posible en un bucle desatendido: da verde
# sin haber ejecutado nada.
#
# Sin credenciales, sin .env, sin red y sin dev server. Maestro ausente es
# infraestructura ausente: se registra aparte y nunca produce un verde.

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MINIMO=20

uso() {
  cat >&2 <<'FIN'
Uso: scripts/qa-tester-run.sh <ETIQUETA> [--nucleo-only|--app-only]

  ETIQUETA        SPEC-NNN, SPEC-NNN-iter-M o SUITE
  --nucleo-only   solo las pruebas de @nucleo (node --test)
  --app-only      solo los flujos de @app (Maestro)

Escribe test/reports/<ETIQUETA>-run-<sello>.md y devuelve su ruta.
FIN
}

# --- argumentos -------------------------------------------------------------

ETIQUETA=""
ALCANCE="todo"

for arg in "$@"; do
  case "$arg" in
    --nucleo-only) ALCANCE="nucleo" ;;
    --app-only)    ALCANCE="app" ;;
    -h|--help)     uso; exit 2 ;;
    -*)            echo "opción desconocida: $arg" >&2; uso; exit 2 ;;
    *)
      if [ -n "$ETIQUETA" ]; then
        echo "sobra el argumento: $arg (la etiqueta ya es $ETIQUETA)" >&2; uso; exit 2
      fi
      ETIQUETA="$arg"
      ;;
  esac
done

if [ -z "$ETIQUETA" ]; then
  echo "falta la etiqueta." >&2
  uso
  exit 2
fi

if ! printf '%s' "$ETIQUETA" | grep -Eq '^(SPEC-[0-9]{3}(-iter-[0-9]+)?|SUITE)$'; then
  echo "etiqueta mal formada: '$ETIQUETA'. Se espera SPEC-NNN, SPEC-NNN-iter-M o SUITE." >&2
  exit 2
fi

# --- Node -------------------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  echo "no hay Node en el PATH. Hace falta Node $NODE_MINIMO o superior." >&2
  exit 2
fi

NODE_VERSION="$(node -p 'process.versions.node' 2>/dev/null)"
NODE_MAYOR="${NODE_VERSION%%.*}"
if [ -z "$NODE_MAYOR" ] || [ "$NODE_MAYOR" -lt "$NODE_MINIMO" ]; then
  echo "Node $NODE_VERSION es insuficiente: hace falta Node $NODE_MINIMO o superior (node --test lo necesita)." >&2
  exit 2
fi

# --- preparación ------------------------------------------------------------

# El único sello de tiempo de toda la entrega vive aquí, en el shell, y nunca en
# el andamiaje que se ejecuta: dentro del núcleo leer el reloj está prohibido.
SELLO="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_REL="test/reports/${ETIQUETA}-run-${SELLO}.md"
REPORT="$RAIZ/$REPORT_REL"
mkdir -p "$RAIZ/test/reports"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$RAIZ" || { echo "no se puede entrar en $RAIZ" >&2; exit 2; }

# --- 2 · regresión de núcleo ------------------------------------------------

node scripts/comprueba-nucleo.mjs >"$TMP/nucleo.txt" 2>&1
NUCLEO_RC=$?

# --- inventario de lo que hay que ejecutar ----------------------------------

PRUEBAS=()
if [ -d test/nucleo ]; then
  while IFS= read -r f; do PRUEBAS+=("$f"); done < <(find test/nucleo -type f \( -name '*.test.mjs' -o -name '*.test.js' \) | LC_ALL=C sort)
fi

FLUJOS=()
if [ -d test/app ]; then
  while IFS= read -r f; do FLUJOS+=("$f"); done < <(find test/app -type f \( -name '*.yaml' -o -name '*.yml' \) | LC_ALL=C sort)
fi

if command -v maestro >/dev/null 2>&1; then HAY_MAESTRO=1; else HAY_MAESTRO=0; fi

# --- 4 · pruebas de @nucleo -------------------------------------------------

EJECUTADO=0
FALLO=0
NUCLEO_ESTADO="no ejecutado (fuera del alcance pedido)"
NUCLEO_TOTAL=0; NUCLEO_PASA=0; NUCLEO_FALLA=0

if [ "$ALCANCE" != "app" ]; then
  if [ "${#PRUEBAS[@]}" -eq 0 ]; then
    NUCLEO_ESTADO="no había pruebas que ejecutar: test/nucleo/ no contiene ningún *.test.mjs"
  else
    # Concurrencia 1 y reporter TAP: sin esto la salida cambia de orden entre
    # ejecuciones y dos reports del mismo árbol dejarían de ser comparables.
    CONC=()
    if node --help 2>/dev/null | grep -q -- '--test-concurrency'; then CONC=(--test-concurrency=1); fi
    # El idioma ${a[@]+"${a[@]}"} es por bash 3.2, que es el de macOS: ahí un
    # array vacío con `set -u` revienta al expandirse.
    node --test --test-reporter=tap ${CONC[@]+"${CONC[@]}"} ${PRUEBAS[@]+"${PRUEBAS[@]}"} >"$TMP/nucleo-run.txt" 2>&1
    RC=$?
    EJECUTADO=1
    NUCLEO_TOTAL="$(grep '^# tests ' "$TMP/nucleo-run.txt" | tail -1 | awk '{print $3}')"
    NUCLEO_PASA="$(grep '^# pass ' "$TMP/nucleo-run.txt" | tail -1 | awk '{print $3}')"
    NUCLEO_FALLA="$(grep '^# fail ' "$TMP/nucleo-run.txt" | tail -1 | awk '{print $3}')"
    NUCLEO_TOTAL="${NUCLEO_TOTAL:-0}"; NUCLEO_PASA="${NUCLEO_PASA:-0}"; NUCLEO_FALLA="${NUCLEO_FALLA:-0}"
    if [ "$RC" -ne 0 ]; then
      FALLO=1
      NUCLEO_ESTADO="FALLO (código $RC)"
    else
      NUCLEO_ESTADO="OK"
    fi
  fi
fi

# --- 5 · flujos de @app -----------------------------------------------------

APP_ESTADO="no ejecutado (fuera del alcance pedido)"
if [ "$ALCANCE" != "nucleo" ]; then
  if [ "$HAY_MAESTRO" -eq 0 ]; then
    APP_ESTADO="no ejecutado: Maestro no está instalado (infraestructura ausente, no un fallo de pruebas)"
  elif [ "${#FLUJOS[@]}" -eq 0 ]; then
    APP_ESTADO="no había flujos que ejecutar: test/app/ no contiene ningún .yaml"
  else
    maestro test test/app/ >"$TMP/app-run.txt" 2>&1
    RC=$?
    EJECUTADO=1
    if [ "$RC" -ne 0 ]; then FALLO=1; APP_ESTADO="FALLO (código $RC)"; else APP_ESTADO="OK"; fi
  fi
fi

# --- 3 · mapa de cobertura --------------------------------------------------
#
# Su resultado va en infraestructura, nunca como prueba en rojo: un mapa
# incompleto no es una regresión del juego.

node scripts/valida-spec-test-map.mjs >"$TMP/mapa.txt" 2>&1
MAPA_RC=$?

# --- veredicto --------------------------------------------------------------

if [ "$NUCLEO_RC" -ne 0 ]; then FALLO=1; fi

if [ "$FALLO" -ne 0 ]; then
  CODIGO=1; VEREDICTO=FAIL
elif [ "$EJECUTADO" -eq 0 ]; then
  CODIGO=2; VEREDICTO=FAIL
else
  CODIGO=0; VEREDICTO=PASS
fi

# --- el report --------------------------------------------------------------
#
# Orden operativo, no estético: quien orquesta lee de arriba abajo y para en
# cuanto entiende.

{
  echo "# $VEREDICTO — $ETIQUETA — $SELLO"
  echo
  echo "## 1 · Veredicto"
  echo
  echo "- Resultado: **$VEREDICTO**"
  echo "- Etiqueta: \`$ETIQUETA\`"
  echo "- Sello: \`$SELLO\`"
  echo "- Código de salida: \`$CODIGO\`"
  echo "- Alcance pedido: \`$ALCANCE\`"
  echo "- Node: \`$NODE_VERSION\`"
  echo
  echo "## 2 · Regresión de núcleo"
  echo
  if [ "$NUCLEO_RC" -ne 0 ]; then
    echo "**Hay regresión en la frontera de \`packages/nucleo/\`.** Va antes que cualquier otro resultado: si el núcleo deja de importar en Node, las pruebas de determinismo dejan de existir."
  fi
  echo '```'
  cat "$TMP/nucleo.txt"
  echo '```'
  echo
  echo "## 3 · Infraestructura ausente"
  echo
  echo "Esto no es rojo: es lo que no se pudo montar en esta máquina."
  echo
  if [ "$HAY_MAESTRO" -eq 0 ]; then
    echo "- **Maestro no está instalado.** Los flujos de \`@app\` no se han ejecutado."
  else
    echo "- Maestro: presente."
  fi
  if [ "${#FLUJOS[@]}" -eq 0 ]; then
    echo "- \`test/app/\` no contiene ningún flujo."
  else
    echo "- \`test/app/\`: ${#FLUJOS[@]} flujo(s)."
  fi
  echo "- Mapa de cobertura (\`test/spec-test-map.json\`), código \`$MAPA_RC\`:"
  echo
  echo '```'
  cat "$TMP/mapa.txt"
  echo '```'
  echo
  echo "## 4 · Resultados de @nucleo"
  echo
  echo "- Estado: $NUCLEO_ESTADO"
  echo "- Ficheros: ${#PRUEBAS[@]}"
  if [ -f "$TMP/nucleo-run.txt" ]; then
    echo "- Casos: $NUCLEO_TOTAL · pasan: $NUCLEO_PASA · fallan: $NUCLEO_FALLA"
    if [ "$NUCLEO_FALLA" != "0" ] || [ "$NUCLEO_ESTADO" != "OK" ]; then
      echo
      echo "Salida literal:"
      echo
      echo '```'
      cat "$TMP/nucleo-run.txt"
      echo '```'
    fi
  fi
  echo
  echo "## 5 · Resultados de @app"
  echo
  echo "- Estado: $APP_ESTADO"
  if [ -f "$TMP/app-run.txt" ]; then
    echo
    echo "Salida literal:"
    echo
    echo '```'
    cat "$TMP/app-run.txt"
    echo '```'
  fi
  echo
  echo "## 6 · Estado de git (aviso)"
  echo
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "- Rama: \`$(git rev-parse --abbrev-ref HEAD 2>/dev/null)\`"
    echo "- Commit: \`$(git rev-parse --short HEAD 2>/dev/null)\`"
    SUCIO="$(git status --porcelain 2>/dev/null)"
    if [ -n "$SUCIO" ]; then
      echo "- **Hay ficheros sin commitear.** Es un aviso, no un fallo: la ejecución ha continuado."
      echo
      echo '```'
      printf '%s\n' "$SUCIO"
      echo '```'
    else
      echo "- Árbol de trabajo limpio."
    fi
  else
    echo "- No es un repositorio git."
  fi
} >"$REPORT"

echo "$REPORT_REL"
exit "$CODIGO"
