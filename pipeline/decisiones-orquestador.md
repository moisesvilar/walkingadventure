# Decisiones del orquestador

Ejecución desatendida del paso 4 (`docs/prompt-implementacion.md`), noche del 7 al 8 de agosto de 2026. El encargo prohíbe preguntar, así que toda ambigüedad se resuelve aquí con la opción más razonable y queda declarada. Este fichero es del orquestador; las decisiones de producto de cada spec van en su propia sección `## Decisiones asumidas`.

## 1 · Dónde viven las specs

`.claude/rules/naming.md` dice `docs/specs/SPEC-NNN-<slug>.md` y se declara fuente única. El `SKILL.md` de `wa-spec` dice `specs/SPEC-NNN-<slug>.md`; el de `wa-dev` dice `docs/specs/`. Dos contra uno, y el que discrepa es precisamente el que la regla canónica dice que no debe redefinir patrones.

**Decisión:** `docs/specs/`. Alternativa descartada: `specs/` en la raíz.

## 2 · El número de spec

`wa-spec` lo calcula como «el mayor existente + 1», que sirve para una invocación pero no para un bucle que puede reordenar filas al saltarse una bloqueada. `naming.md` dice que lo asigna quien orquesta, por orden del checklist.

**Decisión:** `SPEC-NNN` = número de fila del checklist, con tres dígitos. La fila 3 es `SPEC-003` pase lo que pase con la 2. Así el checklist y `docs/specs/` se leen en paralelo sin traducir nada.

## 3 · La sección de responsive

`references/spec-instructions.md` exige `### Comportamiento responsive` en tres breakpoints. El `SKILL.md` de `wa-spec` lo prohíbe explícitamente: «Nada de comportamiento responsive: esto es una app de móvil y la pantalla es la que es». Las instrucciones vienen del pipeline web original; el SKILL está adaptado a este proyecto.

**Decisión:** manda el SKILL. Las specs con interfaz llevan `### Wireframe textual`, `### Pantallas y elementos utilizados`, `### data-testid` y `### Patrón de interacción`, sin responsive.

## 4 · Maestro no está instalado

`maestro --version` → `command not found`. Las pruebas de nivel `@app` no se pueden ejecutar en esta máquina.

**Decisión:** no se para el bucle (lo dice el encargo). Las pruebas `@app` se **escriben** igual, se registran en el mapa y el report las marca como infraestructura ausente, nunca como verde. Toda spec cuya verificación dependa solo de `@app` se cierra declarando explícitamente que su verificación quedó pendiente.

## 5 · Quién ejecuta cada rol

Las cuatro skills tienen fronteras duras entre sí (`wa-dev` no toca `test/**`, `wa-qa-dev` no toca el código). Esa separación solo es real si cada rol corre en un contexto propio.

**Decisión:** cada invocación de `wa-spec`, `wa-dev`, `wa-qa-dev` y `wa-qa-tester` se ejecuta como subagente con su propio contexto, cargando la skill del repo. El orquestador no escribe código ni pruebas: lee, juzga, mergea y registra.

## 6 · El script que la skill de QA da por hecho

`wa-qa-tester` ejecuta `scripts/qa-tester-run.sh`, que no existe en el repo. No es un olvido: es exactamente lo que pide la fila 1 del checklist (`andamiaje-pruebas`, RF-INFRA-007).

**Decisión:** el script lo entrega SPEC-001 como código de producción. Hasta que exista, no hay nada que ejecutar.
