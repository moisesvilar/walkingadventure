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
# De ahí la regla que gobierna todo lo de abajo: el PASS es por afirmación
# —ejecuté esto, reconocí el resumen, y salió bien—, nunca por ausencia de
# señales de fallo. Si no se entiende lo que llegó, el resultado es 2.
#
# Sin credenciales, sin .env, sin red y sin dev server. Maestro ausente es
# infraestructura ausente: se registra aparte y nunca produce un verde.

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MINIMO=20

# --- saneamiento del entorno ------------------------------------------------
#
# Va lo primero, antes de cualquier subproceso, para que todos reciban el mismo
# entorno: la comprobación de núcleo, la validación del mapa, `node --test` y
# Maestro. Con NODE_TEST_CONTEXT heredada —la situación normal cuando a este
# runner lo lanza otro `node --test`— Node cambia la forma de su salida, el
# resumen TAP que se busca más abajo deja de aparecer y el veredicto salía verde
# con casos en rojo. Se retiran solo las que cambian esa forma: un entorno en
# blanco se llevaría por delante PATH y HOME y haría el runner inejecutable.

SANEADAS=""
for VARIABLE in $(env | grep -E '^(NODE_TEST_[A-Za-z0-9_]*|NODE_OPTIONS)=' | cut -d= -f1 | LC_ALL=C sort -u); do
  SANEADAS="$SANEADAS $VARIABLE"
  unset "$VARIABLE"
done
SANEADAS="${SANEADAS# }"

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

# Sin línea de veredicto no hay comprobación que creerse, aunque el código sea 0:
# es justo el caso que se está corrigiendo (el guardián que no se disparaba).
if grep -q '^VEREDICTO: ' "$TMP/nucleo.txt"; then FRONTERA_VEREDICTO=1; else FRONTERA_VEREDICTO=0; fi

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
NO_EJECUTABLE=0
NUCLEO_ESTADO="no ejecutado (fuera del alcance pedido)"
NUCLEO_TOTAL=0; NUCLEO_PASA=0; NUCLEO_FALLA=0
NUCLEO_FALTA=""
DISCREPANCIA=""

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

    # Antes, un recuento que no aparecía caía a 0 y la ejecución seguía como si
    # todo estuviera bien. Ahora no reconocer el resumen es terminal: es lo único
    # que afirma que esto se ejecutó de verdad y que se entendió lo que salió.
    case "$NUCLEO_TOTAL" in ''|*[!0-9]*) NUCLEO_FALTA="$NUCLEO_FALTA '# tests <n>'" ;; esac
    case "$NUCLEO_PASA"  in ''|*[!0-9]*) NUCLEO_FALTA="$NUCLEO_FALTA '# pass <n>'" ;; esac
    case "$NUCLEO_FALLA" in ''|*[!0-9]*) NUCLEO_FALTA="$NUCLEO_FALTA '# fail <n>'" ;; esac

    if [ -n "$NUCLEO_FALTA" ]; then
      NO_EJECUTABLE=1
      NUCLEO_TOTAL="?"; NUCLEO_PASA="?"; NUCLEO_FALLA="?"
      NUCLEO_ESTADO="no se pudo ejecutar: la salida de \`node --test\` no trae el resumen TAP esperado (código del subproceso: $RC)"
    elif [ "$NUCLEO_TOTAL" -eq 0 ]; then
      # Había ficheros de prueba y el resumen declara cero casos: eso no es verde,
      # es que no se ejecutó ninguno.
      NO_EJECUTABLE=1
      NUCLEO_ESTADO="no se pudo ejecutar: había ${#PRUEBAS[@]} fichero(s) de prueba y el resumen declara 0 casos ejecutados (código del subproceso: $RC)"
    else
      # Código del subproceso y resumen tienen que decir lo mismo. Cuando no, se
      # toma el peor de los dos y la discrepancia queda escrita.
      if [ "$RC" -ne 0 ] && [ "$NUCLEO_FALLA" -eq 0 ]; then
        DISCREPANCIA="\`node --test\` salió con código $RC pero el resumen declara 0 fallos. Se toma el peor de los dos."
      elif [ "$RC" -eq 0 ] && [ "$NUCLEO_FALLA" -ne 0 ]; then
        DISCREPANCIA="\`node --test\` salió con código 0 pero el resumen declara $NUCLEO_FALLA fallo(s). Se toma el peor de los dos."
      fi
      if [ "$RC" -ne 0 ] || [ "$NUCLEO_FALLA" -ne 0 ]; then
        FALLO=1
        NUCLEO_ESTADO="FALLO (código $RC, $NUCLEO_FALLA caso(s) en rojo)"
      else
        NUCLEO_ESTADO="OK"
      fi
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

# Un mapa que no se pudo validar sigue sin teñir de rojo, pero tampoco cuenta como
# validación correcta: se dice con esas palabras en el report.
if grep -q '^VEREDICTO: ' "$TMP/mapa.txt" && [ "$MAPA_RC" -ne 2 ]; then MAPA_VALIDADO=1; else MAPA_VALIDADO=0; fi

# --- veredicto --------------------------------------------------------------
#
# La frontera del núcleo es bloqueante, y desde esta iteración lo es también su
# silencio: sin línea de veredicto no se comprobó nada, y eso no puede acabar en
# PASS. El 2 va por delante del 1 a propósito —«no se pudo ejecutar» le dice a
# quien orquesta que arregle la máquina, no el código—, y los dos son no-cero, que
# es lo único que distingue el contrato de wa-qa-tester.

if [ "$FRONTERA_VEREDICTO" -eq 0 ]; then
  NO_EJECUTABLE=1
elif [ "$NUCLEO_RC" -eq 1 ]; then
  FALLO=1
elif [ "$NUCLEO_RC" -ne 0 ]; then
  NO_EJECUTABLE=1
fi

if [ "$NO_EJECUTABLE" -ne 0 ]; then
  CODIGO=2; VEREDICTO=FAIL
elif [ "$FALLO" -ne 0 ]; then
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
  if [ "$FRONTERA_VEREDICTO" -eq 0 ]; then
    echo "**No se pudo comprobar la frontera de \`packages/nucleo/\`:** \`scripts/comprueba-nucleo.mjs\` terminó con código \`$NUCLEO_RC\` y sin línea \`VEREDICTO:\`. No es «está intacta»: es que no se comprobó, y por eso esta ejecución no puede terminar en PASS."
  elif [ "$NUCLEO_RC" -eq 1 ]; then
    echo "**Hay regresión en la frontera de \`packages/nucleo/\`.** Va antes que cualquier otro resultado: si el núcleo deja de importar en Node, las pruebas de determinismo dejan de existir."
  elif [ "$NUCLEO_RC" -ne 0 ]; then
    echo "**La comprobación de la frontera declaró que no llegó a comprobarla** (código \`$NUCLEO_RC\`)."
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
  if [ -n "$SANEADAS" ]; then
    echo "- **Variables heredadas retiradas del entorno de los subprocesos:** $SANEADAS. Cambian la forma de la salida de \`node --test\` y con ellas el veredicto dependería de quién lanza el runner."
  else
    echo "- Entorno de partida limpio: no había ninguna variable que retirar (se vigilan \`NODE_TEST_*\` y \`NODE_OPTIONS\`)."
  fi
  if [ "$MAPA_VALIDADO" -eq 0 ]; then
    echo "- Mapa de cobertura (\`test/spec-test-map.json\`), código \`$MAPA_RC\`: **no se pudo validar** (sin línea \`VEREDICTO:\` reconocible, o el validador declaró que no llegó a validar). Sigue sin ser rojo, pero tampoco cuenta como validación correcta."
  else
    echo "- Mapa de cobertura (\`test/spec-test-map.json\`), código \`$MAPA_RC\`:"
  fi
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
    if [ -n "$NUCLEO_FALTA" ]; then
      echo "- Resumen TAP: **no reconocido**. Se esperaban en la salida de \`node --test --test-reporter=tap\` las líneas$NUCLEO_FALTA y no aparecen, así que no se puede afirmar nada de esta ejecución."
    fi
    if [ -n "$DISCREPANCIA" ]; then
      echo "- **Discrepancia:** $DISCREPANCIA"
    fi
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
