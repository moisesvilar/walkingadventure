# Prompt para ejecutar la implementación

Para pegar en una sesión nueva sobre este repo. Escrito el 7-ago-2026, al cerrar el paso 3.

---

Vas a ejecutar el paso 4 de este proyecto: convertir `docs/checklist.md` en código, **de forma completamente desatendida**. Nadie va a estar mirando. Eso cambia dos cosas respecto a trabajar acompañado, y las dos son sobre honestidad más que sobre autonomía:

- **No preguntas nada.** Toda ambigüedad se resuelve con la opción más razonable y se **declara por escrito** en el sitio que corresponda.
- **No te das nada por bueno sin verificarlo.** Un verde que no has visto fallar no es evidencia. Si algo no se puede verificar, se dice; no se asume.

## Preflight: antes de tocar nada

Ejecuta estas comprobaciones y **para si alguna falla**, dejando escrito qué falta. Media hora perdida aquí es mejor que ocho horas construyendo sobre algo roto.

```bash
node --version                              # 20 o superior
ls .claude/skills/wa-{spec,dev,qa-dev,qa-tester}/SKILL.md
ls .claude/rules/naming.md
ls docs/prd.md docs/checklist.md docs/testing.md docs/flujo.md
node scripts/verifica-gherkin.mjs
node scripts/verifica-flujo.mjs
node test/headless.mjs
git status --porcelain                      # tiene que estar limpio
```

Comprueba además que **Maestro** está instalado (`maestro --version`). Si no lo está, **no pares**: las pruebas de nivel `@app` se registrarán como infraestructura ausente y las de `@nucleo` —que son el grueso— corren igual. Pero anótalo en el estado desde el principio, para que nadie lea después un verde que en realidad era un no-ejecutado.

## Las skills que usas

**Usa `wa-spec`, `wa-dev`, `wa-qa-dev` y `wa-qa-tester`, que están en `.claude/skills/` de este repo.** No uses las `somo-*-fable` de usuario: son las mismas por método pero asumen un stack web con Supabase, shadcn y Playwright que este proyecto no tiene. Las del repo están adaptadas a lo que hay: paquete de núcleo en JavaScript puro sobre Node, app en React Native con Expo, render con Skia, y un proxy sin identificadores.

Si en algún momento una instrucción heredada te habla de Vite, React web, Tailwind, Supabase o Playwright, está desactualizada: manda `.claude/skills/wa-dev/references/03-stack-context.md`.

## Tú eres el orquestador

Las cuatro skills están escritas dando por hecho que existe un orquestador que las llama y lleva la cuenta. **Ese orquestador eres tú**, y hay cuatro cosas que solo tú haces:

1. **`pipeline/state.json`** — el estado de la ejecución. Créalo si no existe.
2. **La columna `Estado` de `docs/checklist.md`** — nadie más la toca, ni a mano ni por descuido.
3. **El veredicto entre defecto de prueba y defecto de código** cuando algo sale rojo. Las skills no lo emiten a propósito.
4. **El registro de lo que ha pasado**, para que al terminar se pueda auditar sin releer todo.

### El estado

```json
{
  "spec_actual": "SPEC-003",
  "fase": "qa-tester",
  "iteracion": 2,
  "historial": [
    {"spec": "SPEC-001", "resultado": "verde", "iteraciones": 1, "report": "test/reports/SPEC-001-run-....md"}
  ],
  "bloqueos": []
}
```

Escríbelo **después de cada transición**, no al final. Si la sesión se corta, lo único que dice por dónde ibas es este fichero.

Los valores de `Estado` en el checklist: `pending` · `wip` · `done` · `blocked`.

## El bucle

Para cada fila de `docs/checklist.md` en `pending`, **en el orden en que están**, que es el orden de dependencias:

### 1 · La spec

Marca la fila como `wip`. Invoca **`wa-spec`** con el slug y `--new`.

Antes de eso, lee lo que la spec necesita y no está en el checklist: los `RF-`/`RNF-` que cita la columna Rationale, en `docs/prd.md`; los documentos de `game-design/` que esos RF anclan; las pantallas de `docs/pantallas/` que toque, situándolas en `docs/flujo.md`; y **los escenarios de `docs/testing.md` que le correspondan**.

Ese último punto es el que hace distinto a este proyecto: **la batería de aceptación se escribió antes que el código**. Una spec no inventa criterios de aceptación si ya existe el escenario; lo cita.

### 2 · El código

Invoca **`wa-dev`** con la spec. Crea la rama `pipeline/SPEC-NNN-<slug>` antes.

Si `wa-dev` devuelve un bloqueo, no insistas: marca la fila `blocked`, anota el bloqueo con el error literal, y **pasa a la siguiente fila** cuyas dependencias estén satisfechas. Un bucle desatendido que se atasca en la fila 3 desperdicia el resto de la noche.

### 3 · Las pruebas

Invoca **`wa-qa-dev`** con la spec.

### 4 · Ejecutar

Invoca **`wa-qa-tester`**. Devuelve tres códigos y los tres significan cosas distintas:

| Código | Significa | Qué haces |
| --- | --- | --- |
| `0` | PASS | vas al paso 7 |
| `1` | FAIL | vas al paso 5 |
| `2` | **VACÍO: no se ejecutó ninguna prueba** | **no es verde.** Vuelves al paso 3 |

El `2` importa más de lo que parece: es cómo una spec sin verificar se cuela como buena en un bucle que nadie mira.

### 5 · El veredicto, cuando hay rojo

Lee el report y decide. Este juicio es tuyo y nadie más lo hace:

**Es defecto de prueba** —vuelves al paso 3 con las correcciones— cuando la prueba afirma algo que la spec no pide, usa un localizador que no existe, espera al reloj real, o su expectativa contradice un documento de `game-design/`.

**Es defecto de código** —vuelves al paso 1 con `wa-spec --iter` y de ahí al paso 2— cuando el comportamiento observado contradice un criterio de aceptación, o cuando la prueba implementa fielmente un escenario de `docs/testing.md` y falla.

**Y hay un tercer caso que no es ninguno de los dos**: cuando el report señala infraestructura —Maestro ausente, simulador sin arrancar— o cuando el fallo es un import de React Native dentro de `packages/nucleo/`. Ese último no se arregla iterando la spec: es la regresión más grave que este proyecto puede tener y va anotada como tal.

**Tope de tres iteraciones por spec.** A la cuarta, `blocked`, con el report y el diagnóstico, y sigues con la siguiente. Insistir sin entender es cómo se hacen los desastres desatendidos.

### 6 · Cerrar la spec

Con todo en verde: mergea la rama a `main` (merge commit, no rebase), marca la fila `done`, y registra en `pipeline/state.json` la spec, el número de iteraciones y la ruta del report.

### 7 · Siguiente

Si quedan filas en `pending`, vuelves al paso 1. Si no quedan, has terminado.

## Lo que no haces nunca

- **Preguntar.** Ni una sola vez. Lo que no puedas decidir, lo declaras y sigues.
- **Editar una prueba para que pase.** Cambiar una prueba solo se hace con el veredicto de defecto de prueba, y con la razón escrita.
- **Reintentar hasta que salga verde.** Un test que pasa a la tercera es un test que no vale.
- **Saltarte el orden del checklist**, salvo por una fila `blocked`.
- **Tocar `docs/prd.md`, `docs/checklist.md` (salvo la columna Estado), `game-design/`, `docs/testing.md` ni `docs/flujo.md`.** Si algo de ahí está mal, se anota como bloqueo. La única excepción está abajo.
- **Dar por buena una spec con resultado VACÍO.**

## La única cosa que sí puedes añadir a la documentación

El PRD dejó marcados **quince huecos de cobertura** en `docs/testing.md`: requisitos con ⚠ que no tienen escenario. Cuando trabajes una spec que toque uno de esos:

1. Escribe el escenario que falta **en `docs/testing.md`**, con el formato y las etiquetas de los demás.
2. Ejecuta `node scripts/verifica-gherkin.mjs` — tiene que quedar en verde.
3. Impleméntalo como cualquier otro.

Es la única escritura permitida sobre la documentación de diseño, y es porque el propio PRD la pidió.

## Al terminar

Escribe un informe final y para. En él:

- **Cuántas specs quedan `done`, `blocked` y `pending`**, con la lista de las bloqueadas y por qué.
- **Cuántas iteraciones hicieron falta**, y en qué specs se fueron a tres. Es la señal más útil de dónde el diseño estaba flojo.
- **Qué escenarios has añadido a `docs/testing.md`** y qué huecos siguen abiertos.
- **Qué decisiones has tomado por ambigüedad**, con dónde las declaraste.
- **Qué no se ha podido verificar** — pruebas `@app` que no corrieron por falta de Maestro, lo que sea. Esto va explícito y no enterrado: es la diferencia entre un informe útil y uno que dice que todo fue bien.
- **Una entrada al final de `docs/starting.md`**, con la convención del proyecto: fecha, qué se hizo y con qué se verificó.

Y una última cosa, que es la que más va a valer cuando alguien lea esto mañana: **si en algún momento has tenido que elegir entre parecer que todo iba bien y decir que algo no cuadraba, di que no cuadraba.** Un bucle desatendido solo sirve si su informe se puede creer.
