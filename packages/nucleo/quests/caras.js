// La regla del sitio, en un solo módulo: **un beat sobre un rol humano ocurre en el
// sitio donde esa persona trabaja, y la cara añade quién habla, no dónde**
// (`game-design/npcs.md` pendiente 1, ratificado el 13-ago-2026).
//
// Vive aparte porque la piden los dos lados de la misma frase y ninguno es dueño del
// otro: la plantilla escrita —qué beats se dicen en voz de alguien, y de qué rol de sitio
// cuelga cada rol humano— y la aventura ya casteada —de qué sitio es el lugar de un beat
// cuando ese lugar es una persona—. Escribir la regla en cada consumidor daría cinco
// versiones de la misma frase, y la que se olvidara sería la que no protesta.
//
// Dos decisiones la gobiernan:
//
//   · **Los beats con cara salen de reglas, no de una lista.** Elegir a mano una cara por
//     plantilla habría sido el anti-patrón de la casa: una lista sin regla es la pieza que
//     al no estar no protesta, y una plantilla futura con acto de relación sobre una cara
//     no entraría sola en el alcance. Las dos cláusulas están abajo.
//   · **El recorrido es siempre el declarado.** Los roles humanos se recorren en el orden
//     de `plantilla.orden` y los beats en el orden en que la plantilla los escribe: «el
//     último beat de su sitio» es el último de esa lista y nunca el último que devuelva
//     una iteración de orden libre. Es justo la clase de azar desplazado que el
//     determinismo caza tarde.

/**
 * El rol de **sitio** en el que ocurre un beat de este rol: el propio rol si ya es de
 * sitio, y el sitio donde trabaja esa persona si el rol es humano.
 *
 * Es la forma de la regla del lado de la plantilla, y de ella cuelgan el lazo que el
 * catálogo comprueba al cargarse y los trechos que el casting mide durante el reparto.
 */
export function sitioDelRol(plantilla, rid) {
  const rol = plantilla?.roles?.[rid];
  if (!rol) {
    throw new Error(`la plantilla "${plantilla?.id ?? '(sin id)'}" no declara el rol ${JSON.stringify(rid) ?? String(rid)}, así que no se sabe en qué sitio ocurriría su beat`);
  }
  return rol.tipo === 'humano' ? rol.en : rid;
}

/**
 * El sitio donde ocurre un beat ya casteado: su lugar, y el sitio donde trabaja esa
 * persona cuando el lugar es una cara.
 *
 * Es la misma regla del lado de la aventura. `quests/desenlace.js` la aplicaba a mano
 * desde SPEC-017 y lo que faltaba era aplicarla en los demás sitios que leen un lugar:
 * la clave de ilustración, el núcleo por el que pasa una aventura y la marca del guiado.
 */
export function sitioDelLugar(lugar) {
  if (!lugar || lugar.tipo !== 'humano') return lugar ?? null;
  return lugar.trabajaEn ?? null;
}

/**
 * Qué beats de una plantilla se dicen en voz de alguien, con **las dos cláusulas**, y
 * cada uno con el rol humano que lo toma. En orden de beat.
 *
 * · **Cláusula 1** — un rol humano toma el beat que la `relacion` de su propia plantilla
 *   ya le nombra, cuando ese beat cae sobre el sitio donde esa persona trabaja. Quien
 *   escribió la plantilla ya dijo en qué momento esa persona está delante; esto se limita
 *   a hacerlo cierto en la cadena. Si hay varios, el de número de beat más bajo.
 * · **Cláusula 2** — un rol humano con acto de relación declarado que la cláusula 1 haya
 *   dejado sin beat toma el último beat que cae sobre el sitio donde trabaja. Es lo que
 *   cierra que ninguna cara con acto declarado se quede sin poder recibirlo — y sin ella
 *   el desenlace revienta al aplicar un acto cuyo rol no puso cara en la cadena.
 *
 * Un beat ya tomado por una cara no lo toma otra: la primera cláusula que llega se lo
 * queda y la segunda busca el siguiente que cumpla. Y un rol humano **sin** ningún acto
 * declarado no toma beat: la regla no se estira para llegar al cero.
 *
 * Es **idempotente**: aplicarla sobre una plantilla que ya tiene sus caras puestas elige
 * exactamente los mismos beats, porque lo que mira es el sitio donde ocurre cada uno y no
 * el rol que lo firma.
 */
export function beatsConCara(plantilla) {
  const roles = plantilla?.roles ?? {};
  const beats = plantilla?.beats ?? [];
  const orden = plantilla?.orden ?? [];
  const humanos = orden.filter((rid) => roles[rid]?.tipo === 'humano');
  if (!humanos.length) return [];

  const conActo = new Set((plantilla.relacion ?? []).map((e) => e?.rol));
  const dondeOcurre = beats.map((b) => sitioDelRol(plantilla, b.rol));
  const tomados = new Set();
  const elegidos = [];
  const toma = (n, rid) => {
    tomados.add(n);
    elegidos.push({ beat: n, rol: rid, sitio: roles[rid].en });
  };

  for (const rid of humanos) {
    // Los beats que la plantilla ya nombra para esta cara, de número más bajo a más alto.
    const nombrados = (plantilla.relacion ?? []).filter((e) => e?.rol === rid).map((e) => e.beat).sort((a, b) => a - b);
    for (const n of nombrados) {
      if (!Number.isInteger(n) || n < 1 || n > beats.length) continue;
      if (tomados.has(n) || dondeOcurre[n - 1] !== roles[rid].en) continue;
      toma(n, rid);
      break;
    }
  }
  for (const rid of humanos) {
    if (!conActo.has(rid) || elegidos.some((e) => e.rol === rid)) continue;
    for (let i = beats.length - 1; i >= 0; i--) {
      if (tomados.has(i + 1) || dondeOcurre[i] !== roles[rid].en) continue;
      toma(i + 1, rid);
      break;
    }
  }
  return elegidos.sort((a, b) => a.beat - b.beat);
}

/**
 * La plantilla con sus caras puestas: los beats que eligen las dos cláusulas pasan a caer
 * sobre el rol humano que los toma, y **nada más cambia** — ni la escena, ni el
 * disparador, ni el resultado, ni el orden.
 *
 * Se aplica al declarar el catálogo, de forma que ningún consumidor pueda ver una versión
 * de las plantillas sin caras: dos catálogos con los mismos identificadores y beats
 * distintos son la clase de diferencia que se descubre tarde.
 */
export function conCaras(plantilla) {
  const elegidos = beatsConCara(plantilla);
  if (!elegidos.length) return plantilla;
  const porBeat = new Map(elegidos.map((e) => [e.beat, e.rol]));
  return {
    ...plantilla,
    beats: plantilla.beats.map((b, i) => (porBeat.has(i + 1) ? { ...b, rol: porBeat.get(i + 1) } : b)),
  };
}
