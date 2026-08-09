# Checklist de specs

> Backlog del pipeline, derivado de los RF de `docs/prd.md` (v1.0, 7-ago-2026). Las columnas Spec/Rationale/Prioridad las mantiene el humano (o `/somo-plan-fable` al regenerar); la columna Estado la escribe SOLO `/somo-pipeline`. El orden ES la prioridad de ejecución: dependencias primero. Los bloques B1-B6 son la vista de agrupación del roadmap del PRD (§9).

## B1 · El núcleo portado

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 1 | andamiaje-pruebas | RF-INFRA-007 | must | done |
| 2 | paquete-compartido | RF-INFRA-001, RNF-DET-001, RNF-DET-003 | must | done |
| 3 | rejilla-celdas-semilla | RF-MUNDO-001, RF-MUNDO-002, RF-MUNDO-003, RF-MUNDO-004, RF-MUNDO-005 | must | done |
| 4 | tramo-personal | RF-PJ-004, RF-MUNDO-007, RNF-ACC-001, RNF-ACC-003 | must | done |
| 5 | pool-anclajes-filtros | RF-MUNDO-006, RF-MUNDO-009, RF-MUNDO-010, RF-MUNDO-011 | must | done |
| 6 | parajes-cobertura-escenas | RF-MUNDO-007, RF-MUNDO-008 | must | done |
| 7 | grafo-cosido-ramales | RF-MUNDO-013, RF-MUNDO-014 | must | done |
| 8 | filtro-accesibilidad-grafo | RF-MUNDO-017 | must | done |

## B2 · El mundo vivo

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 9 | serializacion-mundo-congelado | RF-PERS-001, RF-PERS-002, RNF-RED-002 | must | done |
| 10 | casting-quests | RF-QUEST-001, RF-QUEST-002, RF-QUEST-003, RF-QUEST-004, RF-QUEST-005, RF-QUEST-015 | must | done |
| 11 | motor-pasos | RF-RUMOR-001, RF-RUMOR-002 | must | done |
| 12 | propagacion-rumores | RF-RUMOR-003, RF-RUMOR-004, RF-RUMOR-005 | must | done |
| 13 | prologo-mundo | RF-MUNDO-015, RF-QUEST-014 | must | done |
| 14 | npcs-capa | RF-NPC-001, RF-NPC-002, RF-NPC-003, RF-NPC-004, RF-NPC-005 | must | done |
| 15 | progresion-rango-oro-objetos | RF-PROG-001, RF-PROG-002, RF-PROG-004, RF-PROG-006, RF-PROG-008 | must | done |
| 16 | diario-estado-hechos | RF-DIARIO-001, RF-PERS-003 | must | done |

## B3 · La palabra

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 17 | catalogo-plantillas | RF-QUEST-009, RF-LANG-001, RF-LANG-003, RF-LANG-004 | must | done |
| 18 | contrato-llm | RF-QUEST-006, RF-QUEST-007, RF-QUEST-008, RF-LANG-005, RF-PRIV-001 | must | done |
| 19 | cola-entregas-microencuentros | RF-QUEST-010, RF-QUEST-016 | must | done |

## B4 · La app y el mapa

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 20 | app-scaffold-expo | RF-INFRA-001, RF-INFRA-006, RNF-COM-001 | must | done |
| 21 | render-skia-estilos | RF-MAPA-001, RF-MAPA-002 | must | done |
| 22 | declutter-rotulos | RF-MAPA-003 | must | done |
| 23 | proxy-ciego | RF-INFRA-002, RNF-PRIV-001, RNF-COST-001 | must | done |
| 24 | overpass-produccion | RF-INFRA-003, RNF-PER-001 | must | wip |
| 25 | imagenes-ficcion-fotos-places | RF-MUNDO-016, RF-BUCLE-003 | should | pending |
| 26 | mapa-en-movil | RF-MUNDO-001, RF-MUNDO-012, RNF-PER-001 | must | pending |

## B5 · El bucle en la calle

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 27 | onboarding-arranque | RF-PJ-001, RF-PJ-002, RF-PJ-003, RF-PJ-005, RF-PJ-006, RF-PJ-007, RF-PJ-008, RF-PRIV-005, RF-PRIV-006 | must | pending |
| 28 | portada-antes-de-salir | RF-BUCLE-002, RF-QUEST-011, RF-QUEST-012, RNF-RED-001 | must | pending |
| 29 | en-marcha-mapa-avisos | RF-BUCLE-001, RF-BUCLE-004, RF-BUCLE-009, RF-BUCLE-014, RF-BUCLE-016, RF-MAPA-005 | must | pending |
| 30 | rotulo-sistema | RF-INFRA-004, RF-BUCLE-010, RF-BUCLE-017 | must | pending |
| 31 | deteccion-vehiculo | RF-INFRA-005, RF-BUCLE-015 | must | pending |
| 32 | llegadas-geofence | RF-BUCLE-005, RF-BUCLE-006, RF-RUMOR-005 | must | pending |
| 33 | visor-anclaje | RF-BUCLE-007, RF-BUCLE-008 | must | pending |
| 34 | escena-beat | RF-QUEST-004, RF-PJ-009 | must | pending |
| 35 | descarte-anclaje | RF-PRIV-004 | must | pending |
| 36 | telon | RF-BUCLE-011, RF-BUCLE-012, RF-BUCLE-013, RF-MAPA-004, RF-QUEST-013, RF-DIARIO-005, RF-DIARIO-006, RF-PROG-005 | must | pending |

## B6 · Lo que queda en casa

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 37 | diario-consulta | RF-DIARIO-002, RF-DIARIO-003, RF-DIARIO-004 | must | pending |
| 38 | repisa-ajustes | RF-PROG-007, RF-PJ-010, RF-LANG-002 | must | pending |
| 39 | partida-respaldo-export | RF-PERS-004, RF-PERS-005, RF-PERS-008, RF-PRIV-002 | must | pending |
| 40 | empezar-de-nuevo | RF-PERS-006 | must | pending |
| 41 | mapas-multiples | RF-PERS-007, RF-MUNDO-004, RF-PROG-003 | must | pending |
| 42 | pasos-fondo-zurron | RF-RUMOR-002, RF-RUMOR-006, RF-PRIV-003 | should | pending |

## Notas de derivación

- **Una fila por spec implementable y testeable de una pasada**, no una por RF: los RF de una misma feature cohesionada comparten fila (la capa de NPCs son cinco RF y una spec), y los RF transversales (RNF-DET, RF-PRIV-001/002) aparecen en la spec donde se implementa su garantía y se verifican como bloqueantes en todas (`RNF-DET-003`).
- **El orden respeta dependencias**: nada de B2 sin el paquete y la rejilla de B1; nada de B5 sin el andamiaje `@app` de la fila 1 y el render de B4; el catálogo (17) puede avanzar en paralelo desde que existe el casting (10).
- Los slugs son estables: serán el nombre del fichero de spec y parte de la rama del pipeline. No se renombran.
