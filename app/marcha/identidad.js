// La identidad de una salida: **una sola función**, para las dos áreas que la escriben.
//
// Hasta esta fila había dos. `app/pantallas/antes-de-salir.jsx` componía `mapa/dN/sN` sobre
// el área `aventuras` y `app/App.js` componía `mapa/sN` sobre el área `salidas`, y
// `echaElTelon` compara la identidad que recibe con la que está abierta en `aventuras`: con
// dos, el cierre fallaba nombrando las dos cadenas y la salida no se podía cerrar nunca.
// Traducir una a la otra habría sido la misma trampa con un paso más
// (`pipeline/decisiones-orquestador.md` §6h), y con el agravante de que el fallo aparecería
// **al cerrar** la salida y no al abrirla.
//
// Dos reglas la gobiernan:
//
//   · **Ninguna marca de tiempo** (RF-PRIV-002). Una hora escrita en la partida sobrevive a
//     la copia exportada y es rastro de cuándo saliste a andar. Lo que distingue dos salidas
//     es el contador de hechos, que es un número que la partida ya lleva y que crece con lo
//     jugado.
//   · **La salida abierta manda sobre el cálculo.** La identidad se decide **una vez**, al
//     abrir el registro de la salida en el área `aventuras`, y todo lo demás la lee de ahí.
//     Sin esta regla, aceptar una aventura —que anexa un hecho— cambiaría el contador entre
//     el momento en que se abre el registro y el momento en que se echa a andar, y volverían
//     a ser dos identidades con otro disfraz.
//
// **Una partida congelada a mitad de salida por una compilación anterior** lleva las dos
// cadenas viejas, cada una en su área: `mapa/dN/sN` en `aventuras` y `mapa/sN` en `salidas`.
// No se normaliza ninguna y no se renombra nada —una partida que deja de abrir por un
// renombrado callado es justo lo que la fila 47 juró que no pasaría—: se respeta la que ya
// está escrita, que es lo que hace `identidadDeLaSalidaViva`, y el cierre pide la suya al
// área `aventuras`, que es contra la que `echaElTelon` compara. Las dos áreas siguen siendo
// coherentes cada una consigo misma, y desde esta fila las salidas nuevas nacen con una sola.

/**
 * La identidad de una salida que todavía no está abierta.
 *
 * @param {object} de  `mapaId` el mapa activo; `hechos` cuántos hechos lleva anexados la
 *   partida, que es el contador que hace que dos salidas no compartan identidad.
 */
export function identidadDeSalida({ mapaId, hechos }) {
  if (!Number.isInteger(hechos) || hechos < 0) {
    throw new Error(
      `la identidad de una salida se compone con el contador de hechos de la partida y llegó ${JSON.stringify(hechos) ?? String(hechos)}: ` +
      'es lo único que distingue dos salidas sin escribir ninguna marca de tiempo',
    );
  }
  return `${mapaId ?? 'sin-mapa'}/s${hechos + 1}`;
}

/**
 * La identidad de la salida **que vale ahora mismo**: la de la que está abierta si la hay, y
 * si no, la que le tocaría a la siguiente.
 *
 * @param {object} de  `aventuras` el área de la partida, de la que se lee el registro de la
 *   salida abierta de SPEC-028; `mapaId` y `hechos`, para cuando no hay ninguna.
 */
export function identidadDeLaSalidaViva({ aventuras, mapaId, hechos }) {
  const abierta = aventuras?.abierta ?? null;
  if (abierta && typeof abierta.salida === 'string' && abierta.salida) return abierta.salida;
  return identidadDeSalida({ mapaId, hechos });
}
