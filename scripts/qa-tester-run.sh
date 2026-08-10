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
# Sin credenciales, sin .env, sin red y sin dev server. Los flujos de @app tienen
# tres estados y no dos: Maestro ausente, Maestro sin runtime de Java y Maestro
# presente pero sin dispositivo son los tres infraestructura ausente —se registran
# en la sección 3 y nunca producen un verde—, y solo un flujo que llegó a ejecutarse
# y falló es rojo.
#
# Y desde §6w de `pipeline/decisiones-orquestador.md`, el verde de @app tampoco es
# uno solo: hay flujos que se declaran **de límite declarado** —llevan
# `# @limite-declarado` en cabecera— y lo único que ejecutan es una guarda que
# comprueba que su pantalla sigue sin existir. Lo que dicen es honesto; sumarlo en la
# misma casilla que un flujo que recorre la app no lo era. Por eso el recuento tiene
# cuatro casillas —ejecutados · pasan · fallan · solo comprueban su límite— y un
# marcado que sale verde no se suma a «pasan». Un marcado que sale rojo sigue siendo
# rojo: el marcador cambia cómo se lee su verde, no da permiso para fallar.
#
# Lo que Maestro necesita para arrancar (JVM y SDK de Android) lo cablea el propio
# runner más abajo, buscándolo y declarando en el report qué encontró. Se puede
# forzar con WA_JAVA_HOME y WA_ANDROID_HOME.

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

# --- lo que Maestro necesita: runtime de Java y SDK de Android --------------
#
# Sanear el entorno no es lo mismo que no dar lo necesario, y confundir las dos
# cosas tuvo un precio: Maestro corre sobre la JVM y habla con el dispositivo por
# `adb`, así que sin `JAVA_HOME` el binario ni arranca —«Unable to locate a Java
# Runtime»— y los flujos de `@app` se registraban como infraestructura ausente
# incluso con el emulador delante. Faltaba el cableado, no la máquina.
#
# Se resuelve aquí, de forma declarada y reproducible: una lista fija de candidatos,
# en orden, cada uno **validado antes de aceptarse** (que `bin/java -version`
# funcione de verdad; en macOS `/usr/bin/java` existe siempre y no sirve para nada).
# Ninguna ruta de una máquina concreta se da por supuesta ni se hereda a ciegas, y
# la elegida —con su origen— se escribe en el report. Si ninguna sirve, sigue siendo
# infraestructura ausente con el motivo dicho: nunca un rojo, nunca un verde.

TAB="$(printf '\t')"

java_sirve() {
  [ -n "${1:-}" ] && [ -x "$1/bin/java" ] && "$1/bin/java" -version >/dev/null 2>&1
}

# Cada línea es «origen<TAB>ruta». Los comodines se ordenan con LC_ALL=C para que dos
# máquinas con los mismos JDK instalados elijan el mismo, y no el que devuelva antes
# el sistema de ficheros.
candidatos_java() {
  [ -n "${WA_JAVA_HOME:-}" ] && printf 'WA_JAVA_HOME%s%s\n' "$TAB" "$WA_JAVA_HOME"
  [ -n "${JAVA_HOME:-}" ] && printf 'JAVA_HOME del entorno%s%s\n' "$TAB" "$JAVA_HOME"
  if [ -x /usr/libexec/java_home ]; then
    RUTA="$(/usr/libexec/java_home 2>/dev/null)"
    [ -n "$RUTA" ] && printf '/usr/libexec/java_home%s%s\n' "$TAB" "$RUTA"
  fi
  for PATRON in '/opt/homebrew/opt/openjdk' '/opt/homebrew/opt/openjdk@*' \
                '/usr/local/opt/openjdk' '/usr/local/opt/openjdk@*' \
                '/Library/Java/JavaVirtualMachines/*/Contents/Home' \
                '/usr/lib/jvm/*'; do
    while IFS= read -r RUTA; do
      [ -d "$RUTA" ] && printf 'ruta conocida%s%s\n' "$TAB" "$RUTA"
    done < <(eval "ls -d $PATRON" 2>/dev/null | LC_ALL=C sort)
  done
  [ -d "$HOME/.sdkman/candidates/java/current" ] && printf 'sdkman%s%s\n' "$TAB" "$HOME/.sdkman/candidates/java/current"
  if command -v java >/dev/null 2>&1; then
    BIN="$(command -v java)"
    DIR="$(cd "$(dirname "$BIN")" && pwd -P)"
    printf 'java del PATH%s%s\n' "$TAB" "$(dirname "$DIR")"
  fi
  return 0
}

JAVA_ELEGIDO=""; JAVA_ORIGEN=""; JAVA_VERSION=""; JAVA_PROBADAS=""
while IFS="$TAB" read -r ORIGEN RUTA; do
  [ -n "${RUTA:-}" ] || continue
  JAVA_PROBADAS="$JAVA_PROBADAS$RUTA ($ORIGEN)
"
  if [ -z "$JAVA_ELEGIDO" ] && java_sirve "$RUTA"; then
    JAVA_ELEGIDO="$RUTA"; JAVA_ORIGEN="$ORIGEN"
  fi
done <<FIN
$(candidatos_java)
FIN

if [ -n "$JAVA_ELEGIDO" ]; then
  export JAVA_HOME="$JAVA_ELEGIDO"
  export PATH="$JAVA_HOME/bin:$PATH"
  JAVA_VERSION="$("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
fi

# El SDK de Android es otra cosa: en una máquina que solo pruebe en iOS no hace
# falta, así que no encontrarlo no bloquea nada. Se declara lo que se encontró y, si
# no hay, Maestro dirá con sus palabras que le falta `adb` y eso ya cae en el patrón
# de infraestructura ausente de más abajo.
ANDROID_ELEGIDO=""; ANDROID_ORIGEN=""
candidatos_android() {
  [ -n "${WA_ANDROID_HOME:-}" ] && printf 'WA_ANDROID_HOME%s%s\n' "$TAB" "$WA_ANDROID_HOME"
  [ -n "${ANDROID_HOME:-}" ] && printf 'ANDROID_HOME del entorno%s%s\n' "$TAB" "$ANDROID_HOME"
  [ -n "${ANDROID_SDK_ROOT:-}" ] && printf 'ANDROID_SDK_ROOT del entorno%s%s\n' "$TAB" "$ANDROID_SDK_ROOT"
  printf 'ruta conocida%s%s\n' "$TAB" "$HOME/Library/Android/sdk"
  printf 'ruta conocida%s%s\n' "$TAB" "$HOME/Android/Sdk"
  printf 'ruta conocida%s%s\n' "$TAB" "/usr/local/share/android-sdk"
  if command -v adb >/dev/null 2>&1; then
    BIN="$(command -v adb)"
    DIR="$(cd "$(dirname "$BIN")" && pwd -P)"
    printf 'adb del PATH%s%s\n' "$TAB" "$(dirname "$DIR")"
  fi
  return 0
}

while IFS="$TAB" read -r ORIGEN RUTA; do
  [ -n "${RUTA:-}" ] || continue
  if [ -z "$ANDROID_ELEGIDO" ] && [ -x "$RUTA/platform-tools/adb" ]; then
    ANDROID_ELEGIDO="$RUTA"; ANDROID_ORIGEN="$ORIGEN"
  fi
done <<FIN
$(candidatos_android)
FIN

if [ -n "$ANDROID_ELEGIDO" ]; then
  export ANDROID_HOME="$ANDROID_ELEGIDO"
  export ANDROID_SDK_ROOT="$ANDROID_ELEGIDO"
  export PATH="$ANDROID_HOME/platform-tools:$PATH"
fi

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

# --- quién se declara de límite ---------------------------------------------
#
# El marcador es un contrato entre el flujo y este runner, y la lista exacta de los
# que lo llevan la fija `test/nucleo/limite-declarado.test.mjs`. Aquí no se decide
# nada: se lee. La línea se compara recortada y entera, igual que allí, para que no
# haya dos maneras distintas de estar marcado.
#
# La clasificación va antes de ejecutar nada y **no depende de que haya Maestro**,
# porque lo que aporta es saber cómo se leerá cada verde, y eso hay que saberlo
# aunque después no se pueda ejecutar. Un fichero que no se deja leer no se da por no
# marcado: eso sería el patrón de §6h otra vez —la pieza que, al no estar, no
# protesta— y aquí valdría un verde de límite contado como verde de verdad. No poder
# saberlo es un fallo declarado, y ese flujo no se lanza a ciegas.
MARCADOR_LIMITE='# @limite-declarado'

# 0 marcado · 1 sin marcar · 2 no se ha podido saber.
lleva_marcador() {
  [ -r "$1" ] || return 2
  LC_ALL=C grep -Eq "^[[:space:]]*${MARCADOR_LIMITE}[[:space:]]*$" "$1" 2>/dev/null
  case $? in
    0) return 0 ;;
    1) return 1 ;;
    *) return 2 ;;
  esac
}

MARCAS=()
APP_MARCADOS=0
APP_SIN_CLASIFICAR=""
for FLUJO in ${FLUJOS[@]+"${FLUJOS[@]}"}; do
  lleva_marcador "$FLUJO"; MARCA=$?
  MARCAS+=("$MARCA")
  case "$MARCA" in
    0) APP_MARCADOS=$((APP_MARCADOS + 1)) ;;
    2) APP_SIN_CLASIFICAR="$APP_SIN_CLASIFICAR $FLUJO" ;;
  esac
done

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
#
# Aquí se decide entre los tres estados. El criterio es el mismo que rige @nucleo:
# el verde es por afirmación. Por eso se le pide a Maestro un informe JUnit en vez
# de leerle la prosa de la consola —el recuento de flujos y de fallos vive en el
# informe, es estable entre versiones y se puede afirmar—; sin informe reconocible
# no se concluye nada bueno.
#
# Y sin informe hay dos motivos posibles, que no se pueden confundir: o la máquina
# no tiene lo que hace falta (Java, dispositivo) y eso es infraestructura ausente,
# o no se entiende lo que devolvió, y eso es «no se pudo ejecutar». Nunca PASS.

# Lo que esta máquina no puede aportar, dicho por Maestro con sus palabras. La
# lista es corta a propósito: cada patrón nombra algo que falta en el entorno, no
# algo que haya salido mal en un flujo. Un patrón de más aquí convertiría un fallo
# real en un «no pasa nada», que es justo el defecto que esto viene a corregir.
MAESTRO_SIN_DISPOSITIVO='devices connected, which is not enough|Not enough devices connected|No running devices found|No connected devices|No devices found|No Android device found with id'
MAESTRO_SIN_ENTORNO='Unable to locate a Java Runtime|No Java runtime present|adb not found at the SDK location or on PATH|unable to find utility "simctl"'

APP_ESTADO="no ejecutado (fuera del alcance pedido)"
APP_INFRA=""          # motivo, cuando Maestro está pero la máquina no da para ejecutarlo
APP_INFRA_LINEA=""    # la línea literal de Maestro que lo dice
APP_DISCREPANCIA=""
APP_RECONOCIDO=0      # 1 solo si el informe JUnit se entendió, que es lo que permite contar
APP_TOTAL=0; APP_FALLA=0
# Las dos casillas verdes, separadas: `APP_PASAN` son casos que recorrieron la app y
# salieron bien, `APP_LIMITE` son casos de un flujo marcado, cuyo verde solo dice que
# su pantalla sigue sin existir. Se mantienen de forma que
# APP_TOTAL = APP_PASAN + APP_FALLA + APP_LIMITE, sin excepciones: un recuento que no
# cuadra es la manera fácil de colar un verde donde no lo hay.
APP_PASAN=0; APP_LIMITE=0
APP_LIMITE_FLUJOS=0   # cuántos flujos marcados salieron enteros en verde

if [ "$ALCANCE" != "nucleo" ]; then
  if [ "$HAY_MAESTRO" -eq 0 ]; then
    APP_ESTADO="no ejecutado: Maestro no está instalado (infraestructura ausente, no un fallo de pruebas)"
  elif [ "${#FLUJOS[@]}" -eq 0 ]; then
    APP_ESTADO="no había flujos que ejecutar: test/app/ no contiene ningún .yaml"
  elif [ -z "$JAVA_ELEGIDO" ]; then
    # Se sabe antes de lanzarlo, así que se dice antes: arrancar Maestro para que
    # escupa «Unable to locate a Java Runtime» y luego reconocerle la frase sería el
    # mismo veredicto por el camino largo.
    APP_INFRA="no hay ningún runtime de Java que pueda usar"
    APP_INFRA_LINEA="Ninguna de las rutas candidatas trae un bin/java que arranque:
${JAVA_PROBADAS}Se puede indicar uno con WA_JAVA_HOME."
    APP_ESTADO="no ejecutado: Maestro está instalado pero $APP_INFRA (infraestructura ausente, no un fallo de pruebas)"
  else
    # Un flujo, una invocación. Pasarle el directorio entero salía más barato en
    # arranques de JVM, pero Maestro parsea los dieciséis antes de ejecutar el
    # primero: un solo YAML que no compila dejaba la tanda entera sin informe y sin
    # cifras, que es indistinguible de no tener dispositivo. Flujo a flujo, lo que no
    # compila se nombra y los demás siguen contando.
    N=0
    APP_INFRA_N=0        # flujos que no se ejecutaron por falta de máquina
    APP_ILEGIBLES=""     # flujos de los que no se entendió nada: terminal, nunca verde
    : >"$TMP/app-run.txt"
    : >"$TMP/app-tabla.txt"

    for FLUJO in "${FLUJOS[@]}"; do
      N=$((N + 1))
      MARCA="${MARCAS[$((N - 1))]}"
      INFORME="$TMP/app-junit-$N.xml"
      SALIDA="$TMP/app-run-$N.txt"

      # Un flujo cuyo marcador no se ha podido leer no se ejecuta: su resultado no se
      # sabría dónde contar, y contarlo mal es peor que no tenerlo.
      if [ "$MARCA" -eq 2 ]; then
        echo "- \`$FLUJO\`: **no se pudo ejecutar** — no se pudo leer para saber si se declara de límite (\`$MARCADOR_LIMITE\`), así que no se lanza a ciegas" >>"$TMP/app-tabla.txt"
        continue
      fi
      # `--no-ansi` para que los colores no rompan los patrones, y `</dev/null` para
      # que el menú interactivo de «elige un dispositivo» no deje el runner colgado
      # esperando una tecla que en desatendido no llega nunca.
      maestro test --format JUNIT --output "$INFORME" --no-ansi "$FLUJO" >"$SALIDA" 2>&1 </dev/null
      RC=$?
      { echo "── $FLUJO (código $RC)"; cat "$SALIDA"; echo; } >>"$TMP/app-run.txt"

      # Se afirma que hubo ejecución solo si el informe trae un `<testsuite` por cada
      # recuento y viceversa: un informe a medias no se interpreta a ojo.
      SUITES="$(LC_ALL=C grep -c '<testsuite ' "$INFORME" 2>/dev/null)"; [ -n "$SUITES" ] || SUITES=0
      ATRIB_TESTS="$(LC_ALL=C grep -o 'tests="[0-9][0-9]*"' "$INFORME" 2>/dev/null | wc -l | tr -d ' ')"
      ATRIB_FALLOS="$(LC_ALL=C grep -o 'failures="[0-9][0-9]*"' "$INFORME" 2>/dev/null | wc -l | tr -d ' ')"

      if [ "$SUITES" -ge 1 ] && [ "$ATRIB_TESTS" -eq "$SUITES" ] && [ "$ATRIB_FALLOS" -eq "$SUITES" ]; then
        T="$(LC_ALL=C grep -o 'tests="[0-9][0-9]*"' "$INFORME" | LC_ALL=C sed 's/[^0-9]//g' | awk '{s+=$1} END{print s+0}')"
        F="$(LC_ALL=C grep -o 'failures="[0-9][0-9]*"' "$INFORME" | LC_ALL=C sed 's/[^0-9]//g' | awk '{s+=$1} END{print s+0}')"
        if [ "$T" -eq 0 ]; then
          APP_ILEGIBLES="$APP_ILEGIBLES $FLUJO"
          echo "- \`$FLUJO\`: **no se ejecutó** — informe con 0 casos (código $RC)" >>"$TMP/app-tabla.txt"
        else
          APP_RECONOCIDO=1
          APP_TOTAL=$((APP_TOTAL + T))

          # Los fallos que se cuentan de verdad. Cuando el código y el informe se
          # contradicen se toma el peor de los dos, y se cuenta **un** fallo dentro de
          # los $T casos en vez de sumar uno suelto: así el reparto de abajo sigue
          # cuadrando con el total.
          FE="$F"
          if [ "$RC" -ne 0 ] && [ "$F" -eq 0 ]; then
            APP_DISCREPANCIA="$APP_DISCREPANCIA \`$FLUJO\` salió con código $RC y su informe declara 0 fallos; se toma el peor de los dos."
            FE=1
          fi
          APP_FALLA=$((APP_FALLA + FE))

          # Y el resto del flujo, a su casilla. Todo lo verde de un flujo marcado es
          # verde de límite, incluso si el flujo acabó en rojo: sigue sin haber
          # recorrido ninguna pantalla.
          VERDES=$((T - FE))
          if [ "$MARCA" -eq 0 ]; then
            APP_LIMITE=$((APP_LIMITE + VERDES))
          else
            APP_PASAN=$((APP_PASAN + VERDES))
          fi

          if [ "$FE" -ne 0 ]; then
            SUFIJO=""
            [ "$MARCA" -eq 0 ] && SUFIJO=" — flujo de límite declarado: ni su guarda pasa, y el marcador no lo salva"
            if [ "$F" -eq 0 ]; then
              echo "- \`$FLUJO\`: **FALLO** (código $RC, informe sin fallos — se toma el peor)$SUFIJO" >>"$TMP/app-tabla.txt"
            else
              echo "- \`$FLUJO\`: **FALLO** ($F de $T en rojo)$SUFIJO" >>"$TMP/app-tabla.txt"
            fi
          elif [ "$MARCA" -eq 0 ]; then
            APP_LIMITE_FLUJOS=$((APP_LIMITE_FLUJOS + 1))
            echo "- \`$FLUJO\`: límite declarado sigue en pie ($T caso(s)) — no verifica ninguna pantalla" >>"$TMP/app-tabla.txt"
          else
            echo "- \`$FLUJO\`: OK ($T caso(s))" >>"$TMP/app-tabla.txt"
          fi
        fi
      elif LC_ALL=C grep -Eq "$MAESTRO_SIN_DISPOSITIVO" "$SALIDA"; then
        APP_INFRA_N=$((APP_INFRA_N + 1))
        APP_INFRA="no hay ningún dispositivo conectado"
        [ -n "$APP_INFRA_LINEA" ] || APP_INFRA_LINEA="$(LC_ALL=C grep -Eh -m1 "$MAESTRO_SIN_DISPOSITIVO" "$SALIDA")"
        echo "- \`$FLUJO\`: no ejecutado — $APP_INFRA" >>"$TMP/app-tabla.txt"
      elif LC_ALL=C grep -Eq "$MAESTRO_SIN_ENTORNO" "$SALIDA"; then
        APP_INFRA_N=$((APP_INFRA_N + 1))
        APP_INFRA="a Maestro le falta algo del entorno para arrancar"
        [ -n "$APP_INFRA_LINEA" ] || APP_INFRA_LINEA="$(LC_ALL=C grep -Eh -m1 "$MAESTRO_SIN_ENTORNO" "$SALIDA")"
        echo "- \`$FLUJO\`: no ejecutado — $APP_INFRA" >>"$TMP/app-tabla.txt"
      else
        APP_ILEGIBLES="$APP_ILEGIBLES $FLUJO"
        echo "- \`$FLUJO\`: **no se pudo ejecutar** — código $RC, sin informe JUnit con recuento ni causa de infraestructura conocida" >>"$TMP/app-tabla.txt"
      fi
    done

    # El orden importa: lo ilegible manda sobre lo rojo —«arregla la máquina o el
    # flujo, no el juego»— y lo rojo manda sobre lo verde. La infraestructura ausente
    # solo se declara cuando ningún flujo llegó a ejecutarse por eso.
    #
    # Y lo que marca «se ejecutó algo» es `APP_PASAN`, no `APP_TOTAL`: un verde de
    # límite declarado no afirma nada de la app, así que dieciséis de ellos siguen
    # siendo cero verificación. Con esto, un `--app-only` en el que todo lo ejecutado
    # fuera de límite sale con código 2 —no se pudo verificar nada— en lugar de con un
    # PASS que no sostiene nadie.
    if [ "$APP_PASAN" -gt 0 ] || [ "$APP_FALLA" -gt 0 ]; then EJECUTADO=1; fi
    if [ -n "$APP_ILEGIBLES" ]; then
      NO_EJECUTABLE=1
      APP_ESTADO="no se pudo ejecutar entero: $APP_TOTAL flujo(s) contados ($APP_FALLA en rojo, $APP_LIMITE solo de límite) y estos no dejaron nada que se pueda afirmar:${APP_ILEGIBLES}"
    elif [ "$APP_FALLA" -ne 0 ]; then
      FALLO=1
      APP_ESTADO="FALLO ($APP_FALLA flujo(s) en rojo de $APP_TOTAL, $APP_LIMITE solo comprueban su límite declarado)"
    elif [ "$APP_TOTAL" -eq 0 ]; then
      APP_ESTADO="no ejecutado: Maestro está instalado pero $APP_INFRA (infraestructura ausente, no un fallo de pruebas) — $APP_INFRA_N de ${#FLUJOS[@]} flujo(s)"
    elif [ "$APP_PASAN" -eq 0 ]; then
      # Verde entero y ninguna pantalla verificada. No es OK y no puede leerse como
      # tal: es el estado que §6w vino a hacer visible.
      APP_ESTADO="nada verificado: los $APP_TOTAL flujo(s) ejecutados son todos de límite declarado, así que solo consta que sus pantallas siguen sin existir"
    else
      APP_ESTADO="OK ($APP_PASAN flujo(s) recorren la app y pasan, 0 en rojo; $APP_LIMITE solo comprueban su límite declarado)"
    fi
    APP_DISCREPANCIA="${APP_DISCREPANCIA# }"
  fi

  # Fuera de la cadena a propósito: valga lo que valga el resto, si de algún flujo no
  # se pudo leer si se declara de límite, esta ejecución no sabe cómo contar lo que
  # tiene. Vale también cuando no había Maestro, porque lo que falta no es la máquina.
  if [ -n "$APP_SIN_CLASIFICAR" ]; then
    NO_EJECUTABLE=1
    APP_ESTADO="no se pudo ejecutar entero: de estos flujos no se pudo leer si se declaran de límite, y no se lanzaron:${APP_SIN_CLASIFICAR} · lo demás: $APP_ESTADO"
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
  # El recuento de @app va arriba, en el veredicto, y con las cuatro casillas: quien
  # lee el report tiene que poder ver cuántos flujos recorrieron la app de verdad sin
  # bajar hasta la salida literal de Maestro.
  if [ "$ALCANCE" != "nucleo" ] && [ "$APP_RECONOCIDO" -eq 1 ]; then
    echo "- Flujos de \`@app\`: **$APP_TOTAL ejecutados · $APP_PASAN pasan · $APP_FALLA fallan · $APP_LIMITE solo comprueban su límite declarado**"
    if [ "$APP_PASAN" -eq 0 ]; then
      echo "- **De la app no se ha verificado nada.** Ninguno de los flujos que se ejecutaron recorre una pantalla: los verdes de límite declarado solo dicen que su pantalla sigue sin existir."
    fi
  fi
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
  elif [ -n "$APP_INFRA" ]; then
    echo "- **Maestro está instalado, pero $APP_INFRA.** Los flujos de \`@app\` no se han ejecutado: falta esta máquina, no falla el código. Dicho literalmente:"
    echo
    echo '```'
    printf '%s\n' "$APP_INFRA_LINEA"
    echo '```'
  else
    echo "- Maestro: presente."
  fi
  if [ "${#FLUJOS[@]}" -eq 0 ]; then
    echo "- \`test/app/\` no contiene ningún flujo."
  else
    echo "- \`test/app/\`: ${#FLUJOS[@]} flujo(s)."
  fi
  if [ -n "$JAVA_ELEGIDO" ]; then
    echo "- Runtime de Java para Maestro: \`$JAVA_ELEGIDO\` (origen: $JAVA_ORIGEN) — \`$JAVA_VERSION\`. Se resuelve y se exporta aquí a propósito: Maestro no arranca sin él, y heredarlo del entorno de quien lanza el runner haría que el veredicto dependiera de la terminal."
  else
    echo "- **No se encontró ningún runtime de Java.** Maestro no puede arrancar sin JVM, así que los flujos de \`@app\` no se han ejecutado. Rutas probadas:"
    echo
    echo '```'
    printf '%s' "$JAVA_PROBADAS"
    echo '```'
  fi
  if [ -n "$ANDROID_ELEGIDO" ]; then
    echo "- SDK de Android: \`$ANDROID_ELEGIDO\` (origen: $ANDROID_ORIGEN). Se exporta como \`ANDROID_HOME\`/\`ANDROID_SDK_ROOT\` y su \`platform-tools\` va al PATH, que es de donde Maestro saca \`adb\`."
  else
    echo "- SDK de Android: no encontrado. No bloquea por sí solo —una máquina que solo pruebe en iOS no lo necesita—; si hacía falta, Maestro lo dirá abajo con sus palabras. Se puede indicar con \`WA_ANDROID_HOME\`."
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
  if [ "${#FLUJOS[@]}" -gt 0 ]; then
    if [ "$APP_MARCADOS" -eq 0 ]; then
      echo "- Flujos: ${#FLUJOS[@]}, ninguno declarado de límite (\`$MARCADOR_LIMITE\`). No es un error: significa que todos dicen recorrer la app."
    else
      echo "- Flujos: ${#FLUJOS[@]}, de los cuales $APP_MARCADOS se declaran de límite con \`$MARCADOR_LIMITE\`. La lista exacta la fija \`test/nucleo/limite-declarado.test.mjs\`; este runner la lee, no la decide."
    fi
  else
    echo "- Flujos: 0"
  fi
  if [ -n "$APP_SIN_CLASIFICAR" ]; then
    echo "- **No se pudo leer si estos flujos se declaran de límite, y por eso no se ejecutaron:**${APP_SIN_CLASIFICAR}. Darlos por no marcados habría contado sus verdes como verdes de verdad; no saberlo se dice, no se supone."
  fi
  if [ -f "$TMP/app-run.txt" ]; then
    if [ "$APP_RECONOCIDO" -eq 1 ]; then
      echo "- Ejecutados: $APP_TOTAL · pasan: $APP_PASAN · fallan: $APP_FALLA · solo comprueban su límite: $APP_LIMITE"
      echo "  - «Pasan» son casos que recorrieron la app. «Solo comprueban su límite» son casos de un flujo marcado: su verde afirma que la pantalla **sigue sin existir**, y por eso no se suma con los demás. $APP_LIMITE_FLUJOS flujo(s) marcados salieron enteros en verde."
    else
      echo "- Ejecutados: ninguno. Maestro no llegó a dejar un informe JUnit con recuento, así que de esta ejecución no se afirma ninguna cifra."
    fi
    if [ -n "$APP_DISCREPANCIA" ]; then
      echo "- **Discrepancia:** $APP_DISCREPANCIA"
    fi
    if [ -s "$TMP/app-tabla.txt" ]; then
      echo
      echo "Flujo a flujo:"
      echo
      cat "$TMP/app-tabla.txt"
    fi
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
