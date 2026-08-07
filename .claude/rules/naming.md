# Convención canónica de nombres del pipeline

Fuente única. Las skills `wa-spec`, `wa-dev`, `wa-qa-dev` y `wa-qa-tester` la citan; ninguna redefine patrones por su cuenta.

## Specs

| Cosa | Patrón | Ejemplo |
| --- | --- | --- |
| Identificador | `SPEC-NNN`, tres dígitos, correlativo desde 001 | `SPEC-003` |
| Slug | kebab-case, el del checklist, **estable para siempre** | `rejilla-celdas-semilla` |
| Fichero | `docs/specs/SPEC-NNN-<slug>.md` | `docs/specs/SPEC-003-rejilla-celdas-semilla.md` |
| Iteración | `SPEC-NNN-iter-M`, M desde 1 | `SPEC-003-iter-2` |

El número lo asigna quien orquesta, por orden del checklist. El slug sale del checklist y no se cambia después: es parte del nombre del fichero y de la rama.

## Git

| Cosa | Patrón | Ejemplo |
| --- | --- | --- |
| Rama | `pipeline/SPEC-NNN-<slug>` | `pipeline/SPEC-003-rejilla-celdas-semilla` |
| Commit | Conventional Commits con el ID en el ámbito | `feat(SPEC-003): rejilla de celdas anclada a coordenada redondeada` |
| Commit de tests | `test(SPEC-003): ...` | |
| Commit de arreglo dentro de una iteración | `fix(SPEC-003): ...` | |

El estado del pipeline **nunca** vive en el subject del commit: vive en `pipeline/state.json` y en la columna `Estado` del checklist.

## Tests

Los niveles son los de `docs/testing.md` y se respetan aquí, porque son los que deciden dónde puede correr cada cosa.

| Nivel | Dónde vive | Runner |
| --- | --- | --- |
| `@nucleo` | `test/nucleo/<area>.test.mjs` | `node --test`, sin dependencias |
| `@app` | `test/app/<flujo>.yaml` | Maestro sobre simulador |
| `@red` | `test/nucleo/<area>.test.mjs` con el doble del proxy | `node --test` |
| `@manual` | `docs/testing.md`, lista de revisión | una persona |

- **Nombre del caso** = el nombre del escenario de `docs/testing.md`, literal. Es lo que permite cruzar batería e implementación con un grep, y lo que consume el análisis de fallos.
- **Mapa** en `test/spec-test-map.json`, validado contra `test/spec-test-map.schema.json`.
- **Reports** en `test/reports/<SPEC-NNN|SPEC-NNN-iter-M|SUITE>-run-<YYYYMMDDTHHMMSSZ>.md`.

## Código

Lo de siempre en este repo, que no cambia por tener pipeline: español en comentarios, nombres de dominio y textos (`nucleos`, `parajes`, `tramo`, `beats`); inglés solo en identificadores técnicos genéricos (`rng`, `seed`, `mask`). Dos espacios, comillas simples, punto y coma, ESM con extensión `.js`/`.mjs` explícita en los imports, funciones exportadas nombradas.

## Ficheros de estado del pipeline

| Fichero | Quién escribe |
| --- | --- |
| `pipeline/state.json` | solo quien orquesta el bucle |
| `docs/checklist.md`, columna `Estado` | solo quien orquesta el bucle |
| `docs/checklist.md`, resto de columnas | el humano, o `/somo-plan-fable` al regenerar |
| `docs/specs/*.md` | solo `wa-spec` |
| `test/**` | solo `wa-qa-dev` |
| el código de la app y del paquete | solo `wa-dev` |
