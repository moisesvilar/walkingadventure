# Cuando la ejecución no va

Esta skill no interpreta fallos de test: señala, como mucho, patrones de infraestructura. El veredicto entre defecto de prueba y defecto de código es de quien orquesta el bucle.

## Patrones de infraestructura que sí conviene señalar

**`maestro: command not found`.** No es un fallo de las pruebas. El report lo registra como aviso y `@nucleo` se ejecuta igual.

**No hay simulador arrancado.** Mismo caso: aviso, no rojo.

**`node --test` no encuentra nada.** Si `test/nucleo/` está vacío pero la spec dice tener criterios de aceptación de nivel `@nucleo`, el problema es anterior: `wa-qa-dev` no generó las pruebas. Señálalo.

**Un import que falla dentro de `packages/nucleo/`.** Si el mensaje menciona React Native, Expo o cualquier módulo de plataforma, has encontrado la regresión más grave que este proyecto puede tener: **el núcleo ha dejado de correr en Node**. Ponlo el primero en el report, con el módulo culpable.

**Una prueba que tarda mucho más de lo normal.** Casi siempre es una prueba que está esperando a un reloj real en lugar de avanzar el reloj del mundo a mano. Señálalo como patrón; el arreglo es de `wa-qa-dev`.

## Lo que no se hace nunca

- **No parchear una prueba para que pase.** Ni una línea de `test/**` sale de esta skill.
- **No tocar el código.** Nunca, por ningún motivo.
- **No reintentar hasta que salga verde.** Un test que pasa a la tercera es un test que no vale, y ocultarlo es peor que el fallo.
- **No preguntar.** Esta skill es desatendida: lo que no se pueda resolver va al report.
