# SPEC-054-iter-1 — Sincronización del selector nativo antes de cancelarlo

## Descripción

Iteración de **corrección de defecto** sobre la implementación de SPEC-054. La desencadena el cotejo independiente de su cierre sobre `005dcb5`: la tanda completa obtuvo `@app 22 · 12 · 1 · 9`, con fallo en `empezar-de-nuevo-copia.yaml`, aunque una tanda anterior sobre el mismo hash había pasado.

La captura del fallo muestra la hoja nativa de compartir abierta encima de Ajustes. El flujo envió `back` antes de que el selector del sistema terminara de aparecer; la app consumió ese gesto, retrocedió desde empezar-de-nuevo hasta Ajustes y el selector subió después. La espera de 20 segundos que sigue al `back` sincroniza, por tanto, el lado posterior de la carrera y no impide el fallo.

El delta consiste en no cancelar hasta que Maestro haya observado que la UI estable del selector nativo está realmente arriba. No cambia el cuaderno, la copia, el borrado, la navegación ni ninguna aserción funcional del flujo: solo elimina la carrera previa al gesto y exige demostrar su reproducibilidad antes del cierre.

## Alcance de implementación

- Esta spec define **únicamente el ajuste de sincronización necesario para que la verificación automatizada observe de forma reproducible el comportamiento de producción ya entregado**; no requiere cambios en la UI, los datos ni la lógica de negocio.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya
  commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- No hay cambios en la frontera de inyección del núcleo, las dependencias, el almacenamiento ni las capacidades de plataforma.
- **Fuera de alcance:** cambiar código de producción para acomodar el flujo, introducir demoras fijas, debilitar o retirar aserciones, alterar el gesto `back`, o modificar el comportamiento de la hoja nativa, empezar-de-nuevo o la copia.

## Defecto a corregir

### Síntoma

En un worktree limpio sobre `005dcb5`, con prebuild de ambas plataformas, doble `pm clear`, bucle de posición declarado y la SUITE leyendo su código desde fichero, el resultado fue `@nucleo 2975 · 2972 · 0 · 3` y `@app 22 · 12 · 1 · 9`, `EXIT=1`. El único fallo fue el caso de `test/app/empezar-de-nuevo-copia.yaml` que termina esperando que `id: empezar-de-nuevo` sea visible.

La captura `~/.maestro/tests/2026-08-14_105156/empezar-de-nuevo-copia/screenshots/step-106-assertCondition-empezar-de-nuevo.png` muestra el selector nativo abierto en primer plano y Ajustes debajo. Sobre el mismo hash existe también una tanda completa verde, de modo que el flujo es intermitente y no cumple el listón de reproducibilidad fijado por SPEC-053.

### Causa raíz

En `test/app/empezar-de-nuevo-copia.yaml`, el paso que toca `empezar-de-nuevo-guardar` va seguido inmediatamente de `back`. `Share.share` resuelve al lanzar el selector, pero que la llamada haya resuelto no garantiza que la UI del sistema ya esté visible e interactiva. Bajo carga, Maestro puede enviar `back` durante esa ventana: lo consume la app, que vuelve a Ajustes, y el selector termina de aparecer después.

El `extendedWaitUntil` actual se ejecuta después de `back` y espera `id: empezar-de-nuevo`. Esa espera solo observa el resultado una vez que el gesto potencialmente erróneo ya se envió; no cierra la carrera que ocurre antes.

### Cambio requerido

El flujo debe esperar, después de tocar `empezar-de-nuevo-guardar` y **antes** de enviar `back`, hasta que Maestro observe un elemento semántico y estable de la hoja nativa que acredite que la UI del sistema está en primer plano. `wa-qa-dev` debe elegir el localizador estable que exponga la hoja real en `wa-pixel`; la sincronización no puede basarse solo en una pausa de duración fija ni en un elemento de la app que queda debajo.

Una vez acreditada la hoja, el flujo conserva el mismo `back` y todas sus aserciones actuales: vuelve a empezar-de-nuevo, comprueba sus tres acciones, verifica que no aparece el arranque y mata y relanza la app para demostrar que la partida sigue entera. Ninguna aserción se elimina, suaviza o sustituye por una comprobación menos fuerte.

El arreglo no se considerará reproducible hasta que `empezar-de-nuevo-copia.yaml` pase **18 ejecuciones consecutivas de 18** bajo la receta de aparato declarada por QA. Después debe pasar una tanda SUITE completa sobre el HEAD final, con cero fallos, y `test/reports/manifiesto-generado.estado.json` debe declarar `mirado: true` para Android e iOS y `completo: true`.

La entrada de cierre de SPEC-054 en `docs/starting.md` debe declarar el hash del HEAD final e inmóvil y citar tanto la tanda 18/18 como la tanda SUITE completa ejecutadas sobre ese mismo HEAD. Una tanda sobre un ancestro, aunque sea verde, no satisface este cierre.

## UX Design — ajuste puntual

### Wireframe textual

La interfaz de SPEC-054 y la pantalla empezar-de-nuevo no cambian. El punto observado por el flujo conserva esta secuencia visible:

```text
Empezar de nuevo
  [ Guardar una copia ]
          ↓
Hoja nativa de compartir completamente visible
          ↓ atrás
Empezar de nuevo, con la partida intacta
```

### Pantallas y elementos utilizados

- Pantalla de la app observada: empezar-de-nuevo, sin cambios.
- UI externa observada: hoja nativa de compartir de Android, usada solo como barrera observable antes de cancelarla.
- Elementos y textos de producto: se mantienen todos los definidos por SPEC-040, SPEC-040-iter-1 y SPEC-054.

### data-testid

No se añade ni cambia ningún `data-testid`. La barrera nueva pertenece a la UI del sistema y debe localizarse semánticamente en el árbol que Maestro observa; no se modifica producción para darle un identificador de la app.

### Patrón de interacción

Se conserva el patrón actual: tocar «Guardar una copia» abre la hoja nativa y `back` la cancela sin borrar la partida. El ajuste solo obliga a observar que la hoja terminó de subir antes de cancelarla. La espera posterior puede mantenerse para observar el regreso, pero no sustituye la barrera previa.

## Notas técnicas

- Fichero afectado en la fase QA: `test/app/empezar-de-nuevo-copia.yaml`; el implementador de producción no debe modificarlo ni necesita cambiar código de la app.
- Antes: `tapOn` de compartir → `back` inmediato → espera de empezar-de-nuevo. Después: `tapOn` de compartir → espera explícita de un elemento estable del selector nativo → `back` → las mismas esperas y aserciones existentes.
- Se mantienen la composición `Share.share({ url })`, el carácter no destructivo de guardar copia y las tres acciones de empezar-de-nuevo.
- No hay impacto en el estado de partida, su formato, el almacenamiento del cuaderno ni la frontera determinista del núcleo.
- No hay cambios de i18n ni tracking. El localizador de sistema se elige entre la semántica estable realmente expuesta por el selector de `wa-pixel`, sin introducir texto nuevo en la app.
- **Retrocompatibilidad:** total; el comportamiento de producción y los contratos de SPEC-040, SPEC-040-iter-1, SPEC-053 y SPEC-054 permanecen intactos.
- Dependencias: SPEC-054 como spec base; SPEC-040 y SPEC-040-iter-1 para la promesa de copia no destructiva; SPEC-053 para el listón de 18/18.
- Verificación sugerida: limpiar e instalar según la receta QA; observar una ejecución con la hoja estable antes de `back`; ejecutar el flujo 18 veces consecutivas sin fallo; ejecutar finalmente SUITE sobre el HEAD inmóvil y comprobar el estado generado de ambos manifiestos.

