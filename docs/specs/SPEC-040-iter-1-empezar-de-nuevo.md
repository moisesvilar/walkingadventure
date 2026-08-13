# SPEC-040-iter-1 — Guardar y borrar dejan de ser un solo gesto

## Descripción

Iteración de **cambio de comportamiento** sobre la implementación de SPEC-040, con el defecto que la obliga medido delante. La desencadena una decisión de producto del dueño del proyecto, tomada el **13-ago-2026**, sobre un rojo de `@app` que lleva reproducido desde el 10-ago: `test/app/empezar-de-nuevo-copia.yaml` cae en su paso 7, y lo que hay detrás no es lo que se creía.

**Lo medido, y es lo que decide.** Experimento **sin pulsar atrás jamás**: 25 s con la hoja de compartir en pantalla y `files/partida/partida/` **ya vacío**. `Share.share` en Android resuelve en cuanto lanza el chooser, así que `compartida` nunca vale `false` (`app/plataforma/copia-del-sistema.js:22-31`, que compara con `Share.dismissedAction`, una constante de iOS) y la guarda de `guardaCopiaYBorra` (`app/datos/empezar-de-nuevo.js:227-236`) no se dispara nunca. **La partida se borra mientras quien juega elige destino.** El `back` es un espectador: lo consume `ChooserActivityLauncher`, cierra solo esa actividad, y la app vuelve viva con el mismo pid y la misma tarea — así que **no es el mismo pendiente que el botón atrás**, y eso queda medido y separado.

**Qué cambia.** «Guardar una copia» **solo guarda**, y vuelve a la pantalla diciendo que la copia está hecha. **Borrar es un segundo toque explícito.** El principio que lo decide, y que vale más allá de esta pantalla: **lo destructivo no se ejecuta sobre una señal que el sistema no garantiza** — ni la promesa de la hoja de compartir, que resuelve antes de tiempo, ni la memoria de quien juega. La decisión no depende de que hoy `Share.share` mienta: dependería igual el día que dijera la verdad, porque una copia guardada no es una orden de borrar.

Y de paso, la limpieza que la propia spec base ya prometía: la copia de trabajo se queda en `cache/copias/<mapa>.partida` —1,78 MB medidos— aunque la partida ya se haya borrado, y eso contradice «no queda nada de la partida anterior bajo ningún prefijo». Se limpia dentro del borrado. **Los ficheros que quien juega guardó fuera con la hoja del sistema no se tocan**, que es la línea que separa una limpieza de una trampa.

**Qué NO cambia.** Los tres bloques de texto, la enumeración de lo que se pierde, el párrafo del mundo congelado y su desaparición cuando no hay mapa levantado, el registro de aplicación, la ausencia de segundo aviso, de casilla y de texto que teclear, la marca de borrado antes de borrar, y que borrar lleve al arranque. **La jerarquía tampoco**: guardar sigue arriba y sólida, borrar sigue hueca y con el color de lo destructivo, dejarlo como está sigue sin desaparecer nunca.

## Alcance de implementación

- Esta iteración define **únicamente el código de producción** del delta: separar el gesto de guardar del de borrar, el estado nuevo de la pantalla, los textos de las dos acciones y la limpieza de la copia de trabajo.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador entregue será descartado o reemplazado.
- **No hay cambio de la frontera de inyección del núcleo ni dependencias nuevas**: se siguen usando el almacén duradero, el empaquetador y la hoja del sistema que ya inyecta SPEC-039, con sus mismas operaciones.
- **Fuera de alcance del delta**: la exportación en sí, su formato y su versión (fila 39); la importación; la pantalla de ajustes de la que cuelga A6P7 (fila 38); las pantallas del arranque a las que se vuelve (fila 27); y **el botón atrás del sistema**, que es una decisión de diseño sin tomar y que esta iteración deja **medida y separada** de este defecto, no resuelta.

## Criterio de aceptación modificado

### ACs nuevos

- **Dado** la pantalla, **cuando** se enumeran sus acciones, **entonces** son tres: **guardar una copia**, **borrar la partida** y **dejarlo como está**; la primera solo guarda y la segunda solo borra.
- **Dado** quien elige guardar una copia, **cuando** la hoja del sistema se resuelve de la manera que sea, **entonces** **la partida no se borra**.
- **Dado** quien elige guardar una copia y cancela la hoja del sistema, **incluido con el botón atrás**, **cuando** vuelve a la pantalla, **entonces** la partida sigue entera y las tres acciones están.
- **Dado** quien elige guardar una copia y la copia se hace, **cuando** vuelve a la pantalla, **entonces** una línea dice que la copia está hecha y las tres acciones vuelven.
- **Dado** la copia ya hecha, **cuando** se lee el texto de la acción destructiva, **entonces** dice lo que hace y **no** afirma que no se ha guardado nada.
- **Dado** la partida borrada, **cuando** se busca cómo ocurrió, **entonces** ocurrió tras el gesto explícito de borrar y **nunca** al resolverse la hoja del sistema.
- **Dado** el estado de la pantalla, **cuando** se lee su vocabulario cerrado, **entonces** es `preguntando` · `guardando-copia` · `copia-guardada` · `borrando` · `no-se-pudo`.
- **Dado** un borrado terminado, **cuando** se comprueba lo que queda, **entonces** no queda la copia de trabajo de la caché.
- **Dado** ese mismo borrado, **cuando** se comprueban los ficheros que quien juega guardó fuera con la hoja del sistema, **entonces** siguen intactos.
- **Dado** los textos nuevos de las dos acciones y de la línea de copia hecha, **cuando** se leen en voz alta, **entonces** son voz de aplicación, se leen sin tropezar y no llevan ninguna cifra de distancia, tiempo, ritmo ni progreso.

### ACs de la base que se mantienen, y son los confundibles

> «**Dado** esas tres acciones, **cuando** se lee su orden y su peso, **entonces** guardar una copia va primero y es la única con forma de acción principal.»

Sigue entero. El desacople **no** asciende lo destructivo: guardar sigue arriba y sólida.

> «**Dado** la acción de borrar sin guardar nada, **cuando** se toca, **entonces** borra: no hay un segundo aviso encima del aviso.»

Sigue entero en su fondo, y hay que leerlo con cuidado: el segundo toque de este delta **no es un segundo aviso**. Es otra acción, con su propio texto y su propio botón, no una confirmación del gesto anterior. Un segundo aviso enseña a confirmar sin leer; dos acciones distintas enseñan qué hace cada una.

> «**Dado** un jugador que elige guardar una copia primero, **cuando** la exportación falla, **entonces** el borrado **no** ocurre y la partida sigue entera.»
>
> «**Dado** un jugador que elige guardar una copia primero, **cuando** cancela la hoja del sistema sin guardar, **entonces** el borrado **no** ocurre y la partida sigue entera.»

Los dos siguen enteros, y este delta es lo que los **hace verdad**. El segundo llevaba prometido desde la spec base y roto desde el primer día: se cumple ahora por construcción, porque ya no hay ningún camino en el que resolverse la hoja lleve a borrar. **No se ablandan ni se recortan**: el rojo de `empezar-de-nuevo-copia.yaml` se apaga afirmando lo nuevo.

> «**Dado** ese mismo jugador, **cuando** se lista el almacén, **entonces** no queda nada de la partida anterior bajo ningún prefijo.»

Sigue entero, y la limpieza de la copia de trabajo es lo que lo termina de cumplir.

### ACs derogados

El criterio «**Dado** la pantalla, **cuando** se enumeran sus acciones, **entonces** son tres: guardar una copia primero, borrar sin guardar nada, y dejarlo como está» **queda obsoleto y debe entenderse derogado** por esta iteración. El comportamiento esperado del implementador y de la suite QA es el del primer criterio nuevo de arriba: las acciones siguen siendo tres, pero «guardar una copia **primero**» y «borrar **sin guardar nada**» dejan de nombrar lo que hacen —la primera ya no es el primer paso de nada y la segunda puede tocarse con una copia recién guardada—, así que sus textos cambian.

El criterio «**Dado** un jugador que elige guardar una copia primero, **cuando** la exportación termina bien, **entonces** el borrado continúa» **queda obsoleto y debe entenderse derogado** por esta iteración. El comportamiento esperado es: la exportación que termina bien **no borra nada**; deja la pantalla con la línea de copia hecha y las tres acciones, y borrar exige el gesto explícito.

## UX Design — ajuste puntual

El **Wireframe textual** del UX Design de SPEC-040 se ajusta en su bloque de acciones y en su párrafo de «Estado de espera», y **mantiene todos los demás**: los tres bloques de texto, el titular, el rótulo de vuelta, el estado de la partida sin mundo y el estado de error quedan exactamente como están.

### Wireframe textual (parte afectada)

Al pie, empujadas abajo, las tres acciones en este orden y con estos pesos:

```
[  Guardar una copia          ]   ← acción principal, sólida. Solo guarda.
[  Borrar la partida          ]   ← hueca, con el borde y el texto en el color de lo destructivo
   Dejarlo como está              ← texto, sin caja; nunca desaparece
```

**Estado de espera.** Al elegir guardar una copia, las tres acciones se sustituyen por una línea de espera, sin barra y sin porcentaje, mientras el fichero se empaqueta. Al volver de la hoja del sistema **las tres acciones vuelven siempre y no se borra nada**: si se guardó, encima aparece una línea diciendo que la copia está hecha; si no se guardó, la línea es la de siempre —que no se ha guardado nada y que la partida sigue como estaba—.

```
  La copia está guardada.          ← línea de estado, solo tras guardar
  [  Guardar una copia          ]
  [  Borrar la partida          ]
     Dejarlo como está
```

Las dos ramas terminan en el mismo sitio, y esa es la decisión: **la pantalla deja de distinguir lo que Android no le dice.**

### data-testid

Los seis de la base no cambian de nombre. El único que cambia es su contenido:

- `empezar-de-nuevo-estado` — vocabulario cerrado ampliado a `preguntando` · `guardando-copia` · **`copia-guardada`** · `borrando` · `no-se-pudo`. Es lo que hace afirmable desde el aparato que guardar terminó **y que no borró**.

Sigue sin haber ningún `data-testid` de confirmación secundaria, y su ausencia sigue siendo una afirmación.

### Patrón de interacción

- **Lo destructivo no se ejecuta sobre una señal que el sistema no garantiza.** Decisión no cubierta por el design system, y es la que ordena todo el delta. Android no distingue compartir de cancelar, así que cualquier lectura que la app haga de esa hoja es una suposición; encadenar un borrado irreversible a una suposición es la peor degradación posible de este proyecto, y ya costó una partida medida.
- **El segundo toque no es una confirmación.** Regla: `partida-guardada.md` §4 pone el peso en escribir el aviso para que se lea, y prohíbe el segundo aviso. Dos acciones con dos textos distintos no son un aviso repetido: son dos cosas que se pueden querer por separado, y quien guarda una copia puede perfectamente no querer borrar después.
- **La copia se ofrece y no se hace sola** sigue rigiendo, y ahora también al revés: **el borrado no se hace de paso**.
- **Aquí se habla como aplicación sin disfraz**, y los textos nuevos pasan por `game-design/lenguaje.md`: se leen en voz alta antes de darlos por buenos y son aptos para menores, como todo el juego.

## Notas técnicas

### Ficheros afectados

- `app/datos/empezar-de-nuevo.js` — `guardaCopiaYBorra` (`:227-236`) se parte: `guardaCopia` guarda y devuelve el estado `copia-guardada` o el aviso de que no se guardó nada; `borra` queda como está. Ninguna de las dos llama a la otra.
- `packages/nucleo/partida/borrado.js` — el vocabulario de estados gana `copia-guardada`, y los textos de las dos acciones y de la línea de copia hecha se componen aquí, como el resto.
- `app/pantallas/empezar-de-nuevo.jsx` — las etiquetas nuevas, la línea de copia hecha y que guardar deje de encadenar. La jerarquía visual —sólida, hueca, texto— no se toca.
- La limpieza de la copia de trabajo de `cache/copias/` entra **dentro del borrado**, no al salir de la pantalla: quien guarda y se va sin borrar deja su copia de trabajo donde el sistema puede llevársela, que es para lo que está la caché.

**Composición que se mantiene explícitamente**: la marca de borrado antes de borrar y el remate del borrado interrumpido al abrir; que una partida marcada como en borrado no se abra por ninguna ruta; la enumeración compuesta en tiempo de ejecución; y que borrar lleve al arranque sin conservar semilla.

**Impacto en el estado de partida**: ninguno. **Impacto en la frontera del núcleo**: ninguno. **Retrocompatibilidad**: la pantalla no persiste su estado, así que no hay nada que migrar; una partida a medio borrar guardada por la versión anterior se sigue rematando igual al abrir.

### Los documentos que este delta obliga a tocar, y van en el mismo commit

- **`docs/flujo.md`**: la arista `A6P7 → A1P1` deja de estar etiquetada «Guardar una copia primero, o Borrar sin guardar nada» — al arranque se llega **solo** por borrar —, y aparece el bucle de guardar, que vuelve a A6P7. `node scripts/verifica-flujo.mjs` tiene que seguir en verde.
- **`docs/pantallas/pantallas-6-de-consulta.html`** y su entrada en **`docs/pantallas.md`**: A6P7 con las dos acciones desacopladas y la línea de copia hecha. **Tocar la pantalla obliga a tocar el diseño en el mismo commit.**
- **`docs/testing.md`**: el escenario «La copia se ofrece pero no se hace sola» necesita su mitad nueva —guardar no borra— y hace falta uno para los dos gestos, citando `partida-guardada.md` §4. Lo escribe `wa-qa-dev`, no esta spec.

### Y la decisión que deja de ser la más discutible

La spec base declaró como «la decisión más discutible de esta spec» que una exportación fallida o cancelada no borrara, «porque deja al jugador en la pantalla cuando ya se había despedido». Con los dos gestos separados **deja de serlo**: quien toca «guardar una copia» no se ha despedido de nada, ha guardado un fichero. La despedida es el segundo toque, y ese sí borra siempre que se toca. El desacople no debilita la decisión: le quita el único argumento que tenía en contra.

### Verificación manual tras la entrega

1. `adb shell pm clear com.walkingadventure.app`, reinstalar, jugar lo mínimo para tener partida, entrar en Ajustes → Empezar de nuevo.
2. Tocar «Guardar una copia», dejar la hoja del sistema abierta 25 s y cancelarla con atrás: la partida sigue entera y las tres acciones están.
3. Tocar «Guardar una copia» y guardar de verdad: vuelve la pantalla con la línea de copia hecha, y `adb shell run-as com.walkingadventure.app ls files/partida/partida/` sigue enseñando la partida.
4. Tocar «Borrar la partida»: se llega al arranque, no queda nada bajo ningún prefijo y `cache/copias/` está limpio.

### Dependencias

La spec base **SPEC-040**; **SPEC-039**, cuya exportación y hoja del sistema se consumen sin reimplementar; **SPEC-038**, la pantalla de ajustes de la que cuelga; y **SPEC-053**, la fila que entrega este delta con la medida que lo decide.

## Decisiones asumidas

- **Los textos exactos de las dos acciones y de la línea de copia hecha los escribe quien implementa** → asumido, con `game-design/lenguaje.md` como regla y la lectura en voz alta como prueba (alternativa: fijarlos aquí palabra por palabra). Regla: la redacción es voz y se decide donde se escribe; lo que esta iteración fija es **lo que no pueden decir** —que no se ha guardado nada cuando sí— y su registro.
- **Guardar deja la pantalla donde está** → asumido (alternativa: volver a los ajustes tras guardar). Regla: `partida-guardada.md` §4 exige que salir sin hacer nada siempre esté, y quien guardó puede querer borrar justo después, que es el caso que motiva la pantalla entera.
- **Las dos ramas de la hoja del sistema terminan igual** → asumido (alternativa: seguir intentando distinguir compartido de cancelado con otra señal). Regla: Android no lo dice, y una app que deduce lo que el sistema no garantiza acaba borrando por una suposición. La línea que se enseña es la única diferencia, y no gobierna nada destructivo.
- **La copia de trabajo se limpia dentro del borrado y no al salir de la pantalla** → asumido (alternativa: borrarla en cuanto la hoja se resuelve, o dejarla siempre). Regla: borrarla al resolverse la hoja podría tirar el fichero que el sistema todavía está leyendo por su URI; dejarla contradice «no queda nada de la partida anterior bajo ningún prefijo».
- **El rojo de `empezar-de-nuevo-copia.yaml` se apaga afirmando lo nuevo** → asumido (alternativa: relajar su aserción). Regla: nunca se edita una prueba para que pase; el flujo pasa a abrir la hoja, cancelarla con atrás y **encontrar la partida entera**, que es lo que la spec base prometía desde el principio.
