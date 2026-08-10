# SPEC-043-iter-1 — El zurrón sale de la fila: no es navegación

## Motivo

Al implementar la spec base se comprobó que **A2P2 no se puede cablear honestamente aquí**. La spec lo daba por un caso de pasar una función, como las tres puertas de la portada, y no lo es: el zurrón necesita tres piezas que la app no monta y que ninguna de ellas es un camino entre pantallas.

Lo medido, con sus sitios:

1. **No hay fuente nativa de salud.** `app/plataforma/salud.js` declara la capacidad como no montada, con su motivo escrito: «el enlace con la app de salud del sistema es un módulo nativo, y traerlo es traer una dependencia que la spec de la fila 42 no nombra». Sin ella el modo no se puede encender, así que **nunca hay reserva** y A2P2 nunca aparece.
2. **No hay motor de pasos montado.** `zurron.confirma({ motor, ... })` pide el motor del mapa activo (`creaMotorDePasos`) y `App.js` no construye ninguno.
3. **No hay registro de hechos de la partida.** `vaciaElZurron` anexa el hecho `reserva-vaciada` a un registro, y **ninguna de las veintitrés áreas del estado guarda hechos**: `registroInicial()` es una estructura viva que hoy no tiene dueño en la app.

Cablear solo la apertura y dejar la confirmación fuera daría un zurrón que aparece, se lee, se cierra y **vuelve a aparecer la próxima vez**, sin que nada proteste. Es §6h con el nombre puesto, y es peor que no cablearlo.

## Alcance de implementación

- Esta iteración es **una reducción de alcance**: retira de la spec base el flujo del zurrón y no añade comportamiento nuevo.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya
  commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- **No hay cambios de la frontera de inyección del núcleo ni de las dependencias.** Al contrario: esta iteración existe precisamente para no introducir la dependencia nativa de salud por la puerta de atrás.
- **Fuera de alcance**: montar la fuente de salud, el motor de pasos o el registro de hechos. Los tres van a una fila nueva del checklist con su propia spec.

## Criterios de aceptación derogados

Los cinco criterios del sub-flujo **«El zurrón, entre la portada y la lista»** de la spec base quedan obsoletos y deben entenderse derogados, con una excepción que se conserva y se reformula abajo.

Derogados:

- «GIVEN pasos de fondo activos y reserva sin vaciar WHEN se pulsa "Ver qué se cuenta hoy" THEN se abre el zurrón y no la lista del día».
- «GIVEN el zurrón a la vista WHEN se pulsa "Seguir" THEN se abre la lista de lo que hay hoy».
- «GIVEN el zurrón ya visto y su reserva vaciada WHEN se vuelve a la portada y se pulsa "Ver qué se cuenta hoy" THEN se abre la lista del día y el zurrón no aparece por segunda vez».

Se conservan, porque son ausencias que esta fila sí sostiene y que **se verifican sin fuente de salud**:

- GIVEN sin reserva que vaciar WHEN se pulsa «Ver qué se cuenta hoy» THEN se abre la lista del día directamente, sin pasar por el zurrón.
- GIVEN el diario, la repisa o los ajustes abiertos WHEN se busca cómo llegar al zurrón THEN no hay ninguna puerta que lleve a él.

Y se añade uno, que es lo que sustituye al cableado retirado:

- GIVEN una instalación nueva WHEN se abren los ajustes THEN la fila de contar los pasos del día a día está a la vista y vale «no», sin línea de aviso debajo.

## UX Design

Sin cambios. La spec base no dibujaba ninguna pantalla nueva y esta retira una de las que encadenaba: A2P2 sale de la lista de aristas cableadas (`A2P1 → A2P2` y `A2P2 → A2P3`), y `A2P1 → A2P3` se queda como el único camino de la portada a la lista.

### data-testid

Sin cambios respecto a la base.

## Notas técnicas

- `app/pantallas/antes-de-salir.jsx` tiene un parámetro `alZurron` que **no lo pasa nadie** y que esta fila no va a pasar. Se deja donde está y no se retira: quitarlo sería tocar el contrato de la fila 42 desde aquí, y quien monte el zurrón de verdad lo usará o lo sustituirá con la medida delante. Queda anotado como punto de extensión sin dueño.
- La fila nueva que recoge lo retirado tiene que traer las tres piezas juntas —fuente de salud, motor de pasos, registro de hechos— porque **ninguna de las tres sirve sola**: con la fuente pero sin motor no hay dónde acreditar los pasos, y con las dos pero sin registro no se puede anexar el hecho del vaciado.

## Decisiones asumidas

- **Qué hacer con los criterios derogados** → asumido moverlos enteros a la fila nueva en lugar de reescribirlos aquí en versión debilitada. Alternativa: dejarlos y aceptar que la fila los incumple. Regla: un criterio que se cumple casi siempre no es un criterio (`decisiones-orquestador.md`, cierre de §4).
- **Si el interruptor de A6P6 se pinta o se esconde sin fuente de salud** → asumido que se pinta y vale «no», que es su valor de origen y su valor efectivo. Alternativa: esconderlo. Regla: `partida/ajustes.js` declara el catálogo cerrado y una fila que desaparece según la plataforma haría el catálogo variable.
