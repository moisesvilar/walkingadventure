// La aventura en curso, cableada en la app: **resolver el beat que toca y componer sus dos
// pantallas**, y nada más.
//
// Es lo que hasta esta fila no existía. Medido con grep antes de escribirlo, nadie desde
// `app/` llamaba a ninguna de las tres transiciones de `packages/nucleo/partida/aventura-en-curso.js`
// ni a `componeEscena`/`componeLoQueTeLlevas` de `quests/escena.js`: sus únicos consumidores
// estaban en `test/nucleo/`. Consecuencia medida: `estado.aventuras.enCurso` era siempre
// `null`, `resuelveBeat` era inalcanzable y el telón componía siempre el de un paseo sin
// aventura, con o sin aventura aceptada.
//
// **Aquí no se decide nada del juego y no se redacta ni una línea.** Qué variante de escena
// se lee, por qué vía se atraviesa un beat, cuál es el titular y cuál el verbo de su única
// acción están en `quests/escena.js` desde SPEC-034, y qué avanza y qué falla en
// `partida/aventura-en-curso.js`. Lo de aquí es el orden en que se tocan, que es el guion que
// `test/nucleo/bucle-completo.test.mjs` ya recorre de punta a punta.
//
// **El núcleo entra por la puerta** (SPEC-020, §6u): se enumera en `DEL_NUCLEO` y llega
// inyectado desde `app/nucleo/piezas.js`.
//
// Va aparte de `app/marcha/llegadas.js` y no dentro por una razón de contrato: aquella capa
// es de la llegada —geofence, permanencia, secuencia, visor, ficha— y la aventura es de la
// cadena. Que la llegada solo sepa pedirle «resuelve este beat» es lo que impide que el motor
// se mueva por un micro-encuentro de la cola, que produce paso de beat igual y no pertenece a
// ninguna cadena.

/** Lo que esto le pide al generador, enumerado. Ni una función más. */
export const DEL_NUCLEO = Object.freeze([
  'aventuraEnCurso',
  'resuelveBeat',
  'componeEscena',
  'componeLoQueTeLlevas',
  'identidadDeCara',
  'namesFor',
  'vistaDeTenencia',
]);

/**
 * Contra qué sitios marcados se casteó la aventura en curso, leído del área.
 *
 * Es un campo del área `aventuras` y se lee tal cual, como `identidadDeLaSalidaViva` lee la
 * salida abierta: sin aventura en curso la lista está vacía, que es la respuesta correcta y no
 * un valor por defecto. De aquí sale el mundo con el que se recupera su cadena.
 */
export function descartesDeLaAventura(aventuras) {
  return (aventuras?.descartesDelCasting ?? []).slice();
}

/**
 * Monta el motor de la aventura en curso de una salida.
 *
 * @param {object} piezas
 *   `nucleo` el generador con lo que enumera `DEL_NUCLEO`; `mundo` el documento congelado del
 *   mapa activo, del que salen las caras del reparto; `estado` el estado de la partida —de él
 *   se muta el área `aventuras` y se lee la tenencia—; `reparto` la cadena casteada con sus
 *   beats; `reloj` el de pared, del que sale qué variante de escena se lee en un beat de
 *   franja. **El reloj se exige**: sin él el núcleo falla nombrándolo, que es lo que impide
 *   resolver todas las llegadas como si fueran dentro de la franja (§6h).
 */
export function creaLaAventuraEnCurso({ nucleo, mundo, estado, reparto, reloj }) {
  if (!nucleo) throw new Error('el motor de la aventura en curso necesita el núcleo inyectado: es quien decide qué beat toca y qué se lee en su escena');
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] == null);
  if (faltan.length) {
    throw new Error(`al núcleo inyectado le faltan ${faltan.length} pieza(s) del motor de la aventura en curso: ${faltan.join(', ')}`);
  }
  if (!mundo || typeof mundo !== 'object') {
    throw new Error('el motor de la aventura en curso se monta sobre el mundo congelado del mapa activo: de él salen las caras del reparto, y no se inventan');
  }
  if (!estado || typeof estado !== 'object' || !estado.aventuras) {
    throw new Error('el motor de la aventura en curso se monta sobre el estado de la partida: el área de aventuras es lo que se mueve al resolver un beat');
  }
  const beats = reparto?.beats ?? [];

  // La vista de tenencia sale del propio estado. Calcularla aquí no es una degradación —es de
  // solo lectura—; lo que sí lo sería es caer a «no lleva nada» cuando no llega, porque eso
  // elegiría la vía alternativa de un beat de objeto sin saberlo. Por eso el núcleo la exige.
  const tenencia = nucleo.vistaDeTenencia(estado.objetos);

  // Los beats del lazo, por identidad de objeto. Es lo que separa el beat de la aventura del
  // que manda la cola de entregas: un micro-encuentro produce paso de beat igual, pero no
  // pertenece a ninguna cadena y resolverlo movería la aventura sin haberla andado.
  const delLazo = new Set(beats);

  /** El beat siguiente de la cadena, que es lo que nombra el sitio de «lo que te llevas». */
  const siguienteDe = (beat) => beats.find((b) => b.n === (beat?.resultado?.siguienteBeat ?? null)) ?? null;

  /**
   * Quien habla en la escena, con su nombre y su puesto, o `null` cuando no hay nadie.
   *
   * Se resuelve con la misma función pura con la que el casting resolvió el rol humano
   * —`identidadDeCara`, sobre la misma semilla y el mismo mundo—, así que es **la misma cara**
   * y no una parecida. No escribe nada en la partida: despertar y conocer a alguien son otras
   * transiciones y no son de esta fila.
   */
  const caraDe = (beat) => {
    const suya = beat?.lugar?.tipo === 'humano' ? beat.lugar.cara : null;
    if (!suya) return null;
    const identidad = nucleo.identidadDeCara({
      mundo,
      semilla: mundo.seed,
      idioma: nucleo.namesFor(mundo.locale),
      sitio: suya.sitio,
      puesto: suya.puesto,
    });
    if (typeof identidad?.nombre !== 'string' || !identidad.nombre) return null;
    return { nombre: identidad.nombre, puesto: identidad.puesto };
  };

  return {
    /** La aventura en curso tal como la declara el motor, o `null`. */
    enCurso: () => nucleo.aventuraEnCurso(estado.aventuras),

    /** Si este beat es de la cadena de la aventura y no de la cola de entregas. */
    esDelLazo: (beat) => delLazo.has(beat),

    /**
     * Resuelve un beat **solo si es el que toca**.
     *
     * Es el guion de `test/nucleo/bucle-completo.test.mjs` y no otro: se mira lo que la llegada
     * ofrece, se compara con el beat en curso y, si no coinciden, **se sigue**. Un beat que
     * todavía no le toca a esta llegada se queda esperando a la que sí —el mecanismo es de
     * `partida/llegadas.js` y aquí no se reimplementa— y la app no falla.
     *
     * Resolverlo dos veces por cerrarse y abrirse la app es inocuo y lo declara el motor: no
     * avanza, no anota otra vez y no emite ningún hecho.
     */
    resuelve(beat) {
      if (!beat || !delLazo.has(beat)) return null;
      const enCurso = nucleo.aventuraEnCurso(estado.aventuras);
      if (!enCurso || beat.n !== enCurso.beatEnCurso) return null;
      return nucleo.resuelveBeat(estado.aventuras, { beat, reloj, tenencia });
    },

    /**
     * Las dos pantallas de un beat, compuestas. **A4P3 y A4P4 salen del paquete**: la app las
     * pinta y no escribe ni un texto.
     *
     * @param {object} beat  el beat casteado entero.
     * @param {object} opciones  `tamanoDeTexto` el escalón vigente del ajuste, que vive lo que
     *   dura la sesión y por eso llega desde quien la pinta.
     */
    escenaDe(beat, { tamanoDeTexto = null } = {}) {
      return {
        escena: nucleo.componeEscena({
          beat,
          cara: caraDe(beat),
          reloj,
          tenencia,
          ...(tamanoDeTexto ? { tamanoDeTexto } : {}),
        }),
        loQueTeLlevas: nucleo.componeLoQueTeLlevas({ beat, siguiente: siguienteDe(beat) }),
      };
    },
  };
}
