# Informe final de la ejecución desatendida

Del 7 al 10 de agosto de 2026. Ejecución de `docs/prompt-implementacion.md`: convertir `docs/checklist.md` en código, sin nadie mirando. Este informe está escrito para poder creerse — lo que no se verificó se dice, y lo que no cuadra se dice también.

## 1 · El recuento

| Estado | Filas |
| --- | --- |
| `done` | **42** |
| `blocked` | **0** |
| `pending` | **0** |

**Ninguna fila quedó bloqueada.** Las 42 specs escritas, más **10 iteraciones**. Suite final: **2597 casos, 2594 pasan, 0 fallan, 3 saltados**.

## 2 · Las iteraciones, que es donde se ve dónde flojeaba el diseño

Diez, sobre siete specs. Ninguna llegó al tope de tres.

| Spec | Por qué |
| --- | --- |
| SPEC-001 | dos defectos de la familia «verde que nunca se ejecutó» |
| SPEC-002 | un `@determinismo` bloqueante y la unicidad de nombres |
| SPEC-005 | los topes de diversidad estrangulaban pools sanos |
| SPEC-009 | el presupuesto de tamaño se incumplía un 44 % |
| SPEC-013 | un requisito **cumplido de forma vacía** |
| SPEC-017 | el catálogo no daba diez esqueletos por oficio |
| SPEC-020 | el criterio de arrancar sin `node_modules`, roto |

## 3 · El hallazgo que lo resume todo

Con las **42 filas en `done`** y **2583 casos en verde**, monté la partida completa de punta a punta. **Ninguna aventura se podía terminar.**

El último beat de un lazo cae **siempre** en un sitio ya visitado —el lazo cerrado es la mitad del juego— y la validación de llegada lo descartaba **en silencio**. Medido: **27/27, 12/12 y 28/28** aventuras de tres mundos. **El 100 %.** Toda aventura acababa a medias, con cierre en corto, cero oro, cero objetos, sin rumor y sin mote.

Con él, cuatro cableados que faltaban: nadie componía el desenlace; la lista de hoy repetía los mismos tres títulos el día 6; el propagador de rumores solo corría dentro del prólogo, así que **la noticia de la jugadora no salía del pueblo**; y dos beats dentro del mismo geofence **reventaban en mitad de la salida**.

Los cinco cerrados: **102 de 102 aventuras terminan**, y la prueba que faltaba **se pone roja con el defecto viejo**.

**La lección, y es la más cara de toda la ejecución:** una suite verde no demuestra que el producto funcione. Los defectos viven en las **costuras entre filas**, y cada fila probaba su lado con diligencia. El entregable por bloque del PRD no es ceremonia: es el único momento en que alguien recorre el camino entero. Ocurrió dos veces, al cerrar B2 y al cerrar todo, y las dos encontró lo que nadie más veía.

## 4 · La forma de fallo que salió siete veces

`decisiones-orquestador.md` §6h la bautizó: **una pieza que, al no estar, no protesta.**

1. El validador del mapa **salía 0 sin validar nada** cuando su ruta pasaba por un symlink.
2. El runner **daba PASS con una prueba en rojo** si heredaba `NODE_TEST_CONTEXT`.
3. `generateParajes` **asumía suelo cero** sin distinguirlo de un vocabulario vacío legítimo.
4. `buildRoutes` aceptaba **vías o grafo** indistintamente — causó el mismo bug **tres veces**.
5. El informe de salud del generador **no pedía el callejero**: llevaba semanas midiendo un mundo que nadie juega (113/132 en vez de 127/132).
6. Un requisito **cumplido de forma vacía**: el prólogo componía su par de núcleos y **ninguna aventura pasaba por él**.
7. El criterio duro de arrancar **sin `node_modules`**, roto sin que nadie se enterara: **67 casos no se descubrían**.

Todas cerradas **por contrato y no por vigilancia**. De ahí las dos reglas que gobernaron el resto: **un criterio que se cumple casi siempre no es un criterio**, y **lo que falta se exige y su ausencia es error de construcción**, nunca un valor por defecto.

## 5 · Los indicadores, y las tres veces que bajaron

La casteabilidad agregada sobre los extractos de referencia es la salud del generador. Con seis plantillas: **21/48 → 17/48 → 24/48 → 30/48 → 32/48 → 31/48 → 30/48**. Con treinta: **172/240 → 210/240**. Informe de casting contra mundos reales: **640/660**.

Los descensos fueron **precio pagado a conciencia**, y están razonados:

- **17/48** fue una regresión real, corregida por iteración.
- **31/48** lo paga la cuantización de coordenadas a un metro, sin la cual un mundo urbano no cabe en el presupuesto (2953 KB → 1959 KB).
- **30/48** lo paga medir las distancias **sobre el grafo** en vez de en línea recta. El lazo que desaparece tenía un trecho de **1688 m de caminata presentados como 126 m**. Antes se ofrecía porque la medida mentía.

Un indicador solo sirve si mide lo mismo que el juego.

## 6 · Escenarios añadidos a `docs/testing.md`

**Dos de los quince huecos ⚠ cerrados**, que es la única escritura que el encargo autoriza sobre la documentación de diseño:

- **RF-MUNDO-002** — «La semilla es un dato de la partida, no una coordenada», tres escenarios. Al implementarlos se vio que **ninguna de las tres afirmaciones estaba cubierta del todo**.
- **RF-MAPA-003** — «Ningún rótulo del mapa pisa a otro», ocho escenarios `@nucleo`.

La batería pasa de **174 a 191 casos ejecutables**. **Trece huecos siguen abiertos**: prólogo, hito de arranque, franjas, relación de NPCs, respaldo, migración, Overpass, degradación por módulo, primera aventura, recado, modo compañía, suelo en ficha y paridad visual.

**Y uno que el PRD no había contado**: RF-INFRA-007 no tenía ninguna `Característica`. El andamiaje que sostiene las 2597 pruebas era la única pieza sin criterios escritos antes que su código. Ahora son dos características y diez escenarios.

## 7 · Decisiones tomadas por ambigüedad

En `pipeline/decisiones-orquestador.md`, veintidós entradas, más las `## Decisiones asumidas` de cada spec (entre 8 y 25 por spec). Las que más pesan:

- Las specs van a `docs/specs/` y el número es el de la fila del checklist (§1, §2).
- Sin sección de responsive: el `SKILL.md` la prohíbe y manda sobre las instrucciones heredadas del pipeline web (§3).
- Cada rol corre en su propio contexto, para que las fronteras entre skills sean reales (§5).
- Se aceptan los recuentos nuevos de `costero#2`: un extracto de referencia **no puede vetar un arreglo de determinismo** (§6b).
- **Un lazo contra 367 KB**: se acepta 31/48 porque el presupuesto de tamaño no se negocia contra un lazo del mundo sintético más pobre (§6k).
- **Manda el criterio duro** de arrancar sin `node_modules`: *el día que la red de seguridad del determinismo dependa de un `node_modules`, deja de ser una red* (§6u).
- Un AC de SPEC-014 chocaba con RF-NPC-002 y **manda el requisito** (§6p).

## 8 · Lo que NO se ha verificado

**Ni un flujo `@app` se ha ejecutado. Ninguno.** Hay **13 escritos** en `test/app/` y **cero corridos**: Maestro 2.8.0 está instalado —lo instalé la primera mañana— pero **no hay simulador**: `xcode-select -p` da solo Command Line Tools, `xcrun simctl` no existe, y no hay SDK de Android. El runner lo registra como infraestructura ausente y **nunca como verde**, que era el punto; pero conviene decirlo sin rodeos: **de los 2597 casos, ninguno ha tocado un dispositivo.**

Con eso queda sin revisar todo lo que solo se ve en pantalla: **la paridad visual de los cinco estilos**, la fluidez del render en gama media, el háptico desde el bolsillo, los gestos, el diálogo nativo de permisos, y **el minuto medido en el dispositivo de referencia** — que la spec exige declarar y **el repo no declara en ningún sitio**. El minuto que sí está medido (3222 ms) es en Node contra el Overpass del proyecto.

**Otras cosas declaradas y no resueltas:**

- **Los bordillos no están verificados sobre dato real**: los fixtures se capturaron pidiendo solo ways. Probados con datos sintéticos, y con un caso que se pondrá rojo el día que alguien los recapture.
- **`expo-file-system` está declarada por veredicto mío**, no por su spec: SPEC-039 no la nombra y hace falta iterarla.
- **Dos partes de SPEC-027 no entregadas**: no hay módulo nativo de ubicación ni capa de teselas, porque ninguna spec nombra su dependencia.
- **B5 no tiene orquestación en `app/`**: existen todas las piezas del bucle y no hay máquina de estados que las encadene. El bucle de puerta a puerta que se jugó en la verificación se cosió desde el núcleo.
- **Los nombres construidos se encadenan mucho** («Casal do Muíño Roto do Solpor de Arriba de Abaixo») desde el reparto de repertorio por celda. No hay criterio de longitud de rótulo y puede ser un problema de lámina.

## 9 · Lo primero que haría mañana

1. **Montar un simulador** —Xcode completo o SDK de Android— y correr los 13 flujos. Es el único agujero grande que queda, y crece con cada fila de pantalla.
2. **Cablear la orquestación de B5 en `app/`**: la máquina de estados de una salida. Las piezas están todas.
3. **Declarar el dispositivo de referencia** y medir el minuto en él.
4. **Recapturar los fixtures** con la consulta nueva, para que los bordillos se verifiquen sobre dato real.
5. **Cerrar los trece huecos ⚠** que quedan en `docs/testing.md`.

---

Y lo último, que es lo que más vale cuando alguien lea esto: **cada vez que hubo que elegir entre parecer que todo iba bien y decir que algo no cuadraba, está dicho que no cuadraba.** El checklist entero en verde y la partida que no se podía terminar convivieron durante unas horas, y lo segundo está escrito con la misma tinta que lo primero.
