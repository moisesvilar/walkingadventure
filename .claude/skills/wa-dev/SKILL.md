---
name: wa-dev
description: >
  Implementa código a partir de una spec cerrada de Walking Adventure. Stack real del proyecto:
  paquete de núcleo en JavaScript ESM puro que corre en Node y no importa nada de React Native,
  app en React Native con Expo y render con Skia, y un proxy ciego sin identificadores. Nada de
  Vite, React web, Tailwind, shadcn ni Supabase. Respeta el determinismo del generador
  (makeRng por fase, nunca Math.random ni Date.now), valida el build y commitea con
  Conventional Commits en la rama pipeline/SPEC-NNN. No escribe tests ni rediseña la spec.
  Actívala con: implementar, codear, "implementa SPEC-NNN", o cuando exista una spec cerrada
  que pasar a código.
---

# wa-dev — De la spec al código

## Quién eres

El implementador del pipeline. Recibes una spec cerrada y la conviertes en código. No escribes pruebas —eso es de `wa-qa-dev`— y no rediseñas la spec.

## Contexto obligatorio, en este orden

1. `references/01-role.md` — tu papel y la cadena del pipeline.
2. `references/03-stack-context.md` — **el stack real de este proyecto**. Si algo heredado menciona Vite, React web, Tailwind, shadcn o Supabase, está desactualizado y manda este fichero.
3. `references/05-implementation-instructions.md` — cómo se implementa aquí.
4. `.claude/rules/naming.md` — nombres de ramas, commits y ficheros.
5. La spec: `docs/specs/SPEC-NNN-<slug>.md`.

## Alcance: implementas la spec, no la rediseñas

La spec es el contrato. No reinterpretas requisitos, no cambias decisiones de interfaz porque te gusten más de otra manera, y **no añades dependencias que la spec no mencione**. Si la spec es ambigua en un detalle menor, tomas la decisión más razonable, sigues, y la declaras en tu resumen. Si es ambigua en algo que cambia el comportamiento, no adivines: devuelve el bloqueo.

Y una regla propia de este proyecto: **si la spec contradice un documento de `game-design/`, manda el documento.** Dilo en el resumen en lugar de elegir en silencio.

## Qué haces, en orden

1. **Lee la spec entera** antes de escribir nada, incluidos sus criterios de aceptación y su sección `data-testid`.
2. **Sitúa el trabajo**: qué va en `packages/nucleo/` y qué en `app/`. La frontera es dura y está en `03-stack-context.md`.
3. **Implementa**, siguiendo `05-implementation-instructions.md`.
4. **Valida**: `node --test test/nucleo/` si ya hay pruebas, `node test/headless.mjs` mientras exista, y que la app arranca.
5. **Commitea** en `pipeline/SPEC-NNN-<slug>` con `feat(SPEC-NNN): ...`.
6. **Resume**: qué has implementado, qué decisiones menores has tomado, y qué te ha bloqueado si algo lo ha hecho.

## Escalado

Si la validación falla **tres veces**, no commitees: devuelve el error literal y para. Quien orquesta el bucle registra el fallo y decide. Insistir una cuarta vez sin entender el fallo es cómo se hacen los desastres desatendidos.

## Lo que no haces nunca

- Tocar `test/**`. Ni para arreglar una prueba que falla, ni para añadir un `data-testid` "auxiliar".
- Tocar `docs/specs/**`. Si la spec está mal, se itera con `wa-spec`, no se edita aquí.
- Tocar la columna `Estado` de `docs/checklist.md` ni `pipeline/state.json`.
- Meter `Math.random()`, `Date.now()` o `new Date()` en `packages/nucleo/`.
- Importar nada de React Native desde `packages/nucleo/`.
