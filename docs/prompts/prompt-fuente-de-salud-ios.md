# Encargo: la fila 56, la fuente de salud de iOS

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació. **No se lanza hasta que la fila 55 (`rotulo-vivo-ios`) esté cerrada y fusionada**: comparten aparato, manifiesto y guarda de plugins, y el pipeline es serial a propósito.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida, con el proyecto entero en verde — los números vigentes los declara la bitácora del cierre de la 55; tu fila no puede ser la que lo pierda). Antes de tocar nada lee `CLAUDE.md` entero, `.claude/rules/naming.md`, `docs/iphone.md`, `docs/feedback-testing-14-ago.md`, `app/plataforma/salud.ios.js`, `app/plataforma/salud.android.js`, `app/plataforma/lector-de-salud.js` y `game-design/lenguaje.md`. El bucle son las cuatro skills **del repo** —`wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario. **Cada fase se lanza como subagente** (herramienta Agent); tu ventana principal solo orquesta. Las preguntas al dueño, en tu ventana, con bloque ask, de una en una.

Tu fila es la **56, `fuente-de-salud-ios`** (SPEC-056, rama `pipeline/SPEC-056-fuente-de-salud-ios`), del bloque B8. Rationale: la mitad iOS de RF-RUMOR-002, RF-RUMOR-006 y RF-PRIV-003 (los de la fila 46, que dejó la pareja iOS como doble declarado con su motivo). Ratificada por el dueño el 14-ago-2026.

## Por qué existe esta fila

En el estreno de la app en el iPhone del dueño (14-ago, `docs/feedback-testing-14-ago.md`), la pantalla de capacidades dijo lo que la 46 dejó escrito: **«Salud — no montada… en iOS no hay de dónde leer los pasos del día a día. Lo cerrará la fila que nombre el módulo de HealthKit.»** El dueño lo dictó: se resuelve antes de su primer paseo real. Esta es esa fila.

## La dependencia, ratificada

**Módulo nativo propio, en el repo** — decisión del dueño del 14-ago-2026 (librería externa y mixto, descartados): un módulo Expo local en Swift que hable con HealthKit, con superficie mínima. Si necesita config plugin (entitlement de HealthKit), es plugin propio en `app/plugins/` y la guarda de lista cerrada + huella se amplía en la misma fila.

## El contrato ya está escrito — se cumple, no se reinventa

- `salud.ios.js` es el doble declarado que la 46 dejó (`disponible: false` con su motivo): esta fila lo convierte en pareja de verdad de `salud.android.js`, **con las mismas exportaciones** — la bifurcación vive solo en el sufijo de fichero, como todo `app/plataforma/`.
- **Las restricciones del lector no cambian de plataforma** (`lector-de-salud.js` y la doctrina de la 46): metros o pasos **en ventana**, nada con recorrido, zancada constante. HealthKit ofrece mucho más; el módulo propio expone solo eso, y que no haya más superficie es afirmable leyendo su código.
- **`NSHealthShareUsageDescription` vuelve, y pasa por las reglas de lenguaje** (`game-design/lenguaje.md`): la que se retiró en la 46 era anterior a que esas reglas cubrieran los textos del sistema. **`NSHealthUpdateUsageDescription` —escritura— no se declara jamás**: este juego lee, nunca escribe salud.
- La razón de permisos vive en **A6P6** (la fila del interruptor con su línea de aviso, decisión de la 46): el flujo de pedir el permiso en iOS aterriza ahí, no en una pantalla nueva.

## Trampas que te tocan (medidas el 14-ago o antes)

- Las de la 55 sobre iOS valen enteras: prebuild explícito tras tocar un config plugin, `aps-environment` y el equipo personal (la 55 lo deja resuelto declaradamente — no lo deshagas), el aparato del dueño como recurso con dueño, la receta de Metro + `EXPO_PUBLIC_PROXY=http://192.168.1.137:8138`, y el cuaderno de a bordo como instrumento.
- **Los permisos de salud en el aparato del dueño son estado real**: concedidos una vez, no se revocan desde la app (la lección de `ajustes.yaml` en Android aplica de forma). Coordina con el dueño qué estado quiere que quede en su iPhone al terminar.
- La guarda del manifiesto iOS mira el `Info.plist` del prebuild: la cadena de uso nueva tiene que salir de ahí, y la guarda tiene que verla — un falso positivo consentido en la plataforma que estrena mirada sería socavarla (la razón exacta por la que la 46 la retiró).

## Cómo se trabaja aquí

Las de siempre: nunca se edita una prueba para que pase; nada se da por bueno sin verificar; todo se declara; no estires la fila (el rótulo es la 55, las teselas y el diseño de «Tu mapa» tienen su cuaderno de feedback, el bundle horneado no es tuyo); `state.json` y la columna `Estado` no se tocan; el código solo `wa-dev`, los tests solo `wa-qa-dev`.

## Cuándo está hecho

1. **Los pasos del día a día se leen en el iPhone del dueño**: el permiso se pide por el flujo de A6P6 con su razón delante, y con él concedido la portada enseña el dato real del aparato — verificado con el dueño delante.
2. **La superficie del módulo es la del lector y nada más**: ventana de metros o pasos, sin recorrido, y `NSHealthUpdateUsageDescription` ausente — las dos cosas afirmadas por guarda o prueba, no por costumbre.
3. **La cadena de uso pasa las reglas de lenguaje** y sale del prebuild, mirada por la guarda del manifiesto.
4. **El PASS se mantiene** (los números de referencia, los del cierre de la 55), con `mirado: true` ambas y `completo: true`, y ninguna guarda peor sin motivo medido.
5. **`docs/iphone.md` al día** (la decisión 1 del salto queda cerrada), **checklist y bitácora al día**, y el **hash final declarado e inmóvil** (convención de la 54: hash ejecutable probado literal + como mucho un commit documental encima).

Y lo último: si hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
