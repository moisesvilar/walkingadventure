#!/usr/bin/env bash
# Ejecuta las pruebas de Walking Adventure y escribe un report markdown.
# Determinista y desatendido: no pregunta nada, no interpreta fallos y no toca
# el estado del pipeline. Sustituye al runner web del pipeline original — aquí
# no hay dev server que levantar ni credenciales que cargar.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$RAIZ"

ETIQUETA="${1:-SUITE}"
ALCANCE="${2:-todo}"   # todo | --nucleo-only | --app-only
SELLO="$(date -u +%Y%m%dT%H%M%SZ)"
DIR_REPORTS="test/reports"
REPORT="$DIR_REPORTS/${ETIQUETA}-run-${SELLO}.md"
mkdir -p "$DIR_REPORTS"

SALIDA_NUCLEO=""; SALIDA_APP=""
COD_NUCLEO=0; COD_APP=0
CORRIO_NUCLEO="no"; CORRIO_APP="no"

# --- @nucleo: node --test, sin dependencias ni dispositivo -------------------
if [[ "$ALCANCE" != "--app-only" ]]; then
  if [[ -d test/nucleo ]] && compgen -G "test/nucleo/*.test.mjs" > /dev/null; then
    CORRIO_NUCLEO="si"
    # Ojo: `node --test <directorio>` trata el directorio como un fichero de
    # test y falla con MODULE_NOT_FOUND. Hay que pasarle los ficheros.
    # Bucle while en vez de mapfile: macOS trae bash 3.2 y mapfile es de la 4.
    FICHEROS_NUCLEO=()
    while IFS= read -r f; do FICHEROS_NUCLEO+=("$f"); done < <(find test/nucleo -name '*.test.mjs' | sort)
    SALIDA_NUCLEO="$(node --test "${FICHEROS_NUCLEO[@]}" 2>&1)"
    COD_NUCLEO=$?
  fi
fi

# --- @app: Maestro sobre el simulador ---------------------------------------
# Ausencia de Maestro no es un fallo de las pruebas: es infraestructura que no
# está, y se registra como tal para que quien orquesta no lo lea como rojo.
MAESTRO_AUSENTE="no"
if [[ "$ALCANCE" != "--nucleo-only" ]]; then
  if [[ -d test/app ]] && compgen -G "test/app/*.yaml" > /dev/null; then
    if command -v maestro > /dev/null 2>&1; then
      CORRIO_APP="si"
      SALIDA_APP="$(maestro test test/app/ 2>&1)"
      COD_APP=$?
    else
      MAESTRO_AUSENTE="si"
    fi
  fi
fi

# Verde y no verificado no son lo mismo. Si no se ejecutó ni una prueba, el
# resultado es VACIO y no PASS: en un bucle desatendido, un PASS sin pruebas
# es cómo una spec sin verificar se da por buena.
if [[ "$CORRIO_NUCLEO" == "no" && "$CORRIO_APP" == "no" ]]; then
  RESULTADO="VACIO"
elif [[ $COD_NUCLEO -eq 0 && $COD_APP -eq 0 ]]; then
  RESULTADO="PASS"
else
  RESULTADO="FAIL"
fi

# El estado de git es un aviso en el report, nunca una pregunta que bloquee:
# con el implementador commiteando en local, el working tree ES la fuente.
RAMA="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo desconocida)"
SUCIO="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

{
  echo "# Ejecución de pruebas · $ETIQUETA"
  echo
  echo "- **Resultado**: $RESULTADO"
  [[ "$RESULTADO" == "VACIO" ]] && echo "- **Atención**: no se ejecutó ninguna prueba. Esto NO es un verde: es una spec sin verificar."
  echo "- **Sello**: $SELLO"
  echo "- **Rama**: \`$RAMA\`"
  [[ "$SUCIO" != "0" ]] && echo "- **Aviso**: el working tree tiene $SUCIO ficheros sin commitear"
  [[ "$MAESTRO_AUSENTE" == "si" ]] && echo "- **Aviso de infraestructura**: hay flujos en \`test/app/\` y Maestro no está instalado; no se han ejecutado"
  echo
  echo "## @nucleo"
  if [[ "$CORRIO_NUCLEO" == "si" ]]; then
    echo "Código de salida: $COD_NUCLEO"
    echo
    echo '```'
    echo "$SALIDA_NUCLEO"
    echo '```'
  else
    echo "No se ejecutó: no hay pruebas en \`test/nucleo/\` o el alcance las excluía."
  fi
  echo
  echo "## @app"
  if [[ "$CORRIO_APP" == "si" ]]; then
    echo "Código de salida: $COD_APP"
    echo
    echo '```'
    echo "$SALIDA_APP"
    echo '```'
  else
    echo "No se ejecutó: no hay flujos en \`test/app/\`, el alcance las excluía, o Maestro no está instalado."
  fi
  echo
  echo "---"
  echo
  echo "Este report no interpreta los fallos. El veredicto entre defecto de prueba y defecto de código"
  echo "es de quien orquesta el bucle, que lee este fichero."
} > "$REPORT"

echo "$REPORT"
# 0 = PASS · 1 = FAIL · 2 = VACIO, que quien orquesta no debe leer como verde.
case "$RESULTADO" in
  PASS)  exit 0 ;;
  FAIL)  exit 1 ;;
  VACIO) exit 2 ;;
esac
