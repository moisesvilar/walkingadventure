// El instrumento que mide el minuto de RNF-PER-001, fase a fase.
//
// Existe porque un presupuesto que no se mide es una intención. Y está **inyectado**
// por dos razones, las dos de §6o: porque `packages/nucleo/` no lee el reloj del
// sistema y la orquestación vive en la frontera; y porque un criterio que solo se
// puede comprobar a mano y en un despacho no se pone rojo nunca, y por tanto no mide
// nada. Con el reloj inyectado, la comprobación del minuto se puede ejecutar con un
// cronómetro doblado que devuelva tiempos por encima del presupuesto, y entonces el
// criterio falla — que es lo que lo convierte en criterio.
//
// Las fases se anidan: mientras corre `consulta`, `generacion` está parada. Así los
// cinco tramos son disjuntos y suman el total, y el reparto no puede contar dos
// veces los mismos milisegundos. Sin eso, «la consulta tarda 12 s y la generación
// 40 s» sobre un total de 40 s sería una frase que no significa nada.

/**
 * El presupuesto, en milisegundos. Sale de RNF-PER-001 y se mide sobre el dispositivo
 * de referencia con la caché del proxy **fría**: en el onboarding la caché de esa
 * celda está fría por definición, así que medir en caliente mediría otra cosa.
 */
export const PRESUPUESTO_MS = 60000;

/**
 * Las cinco fases medidas y de qué fila es el tiempo de cada una.
 *
 * El dueño no es decoración: es la única forma honesta de repartir el presupuesto
 * entre filas. Si el minuto se rompe, se rompe en una fase con dueño, y el fallo
 * nombra a su culpable en vez de decir «va lento».
 */
export const FASES_MEDIDAS = Object.freeze([
  Object.freeze({ id: 'consulta', dueña: 'fila 24 · el Overpass del proyecto y el proxy' }),
  Object.freeze({ id: 'generacion', dueña: 'B1 y B2 · la tubería del generador' }),
  Object.freeze({ id: 'congelacion', dueña: 'SPEC-009 · el documento congelado' }),
  Object.freeze({ id: 'colocacion', dueña: 'fila 22 · la colocación de rótulos' }),
  Object.freeze({ id: 'pintado', dueña: 'fila 21 · la lámina en Skia' }),
]);

export const IDS_MEDIDOS = Object.freeze(FASES_MEDIDAS.map((f) => f.id));

const DUEÑA = Object.freeze(Object.fromEntries(FASES_MEDIDAS.map((f) => [f.id, f.dueña])));

/**
 * Monta el cronómetro.
 *
 * @param {object} deps
 * @param {() => number} deps.ahora  el reloj, en milisegundos y monótono creciente.
 *   Inyectado siempre: sin él, la comprobación del minuto no se puede poner roja.
 */
export function creaCronometro({ ahora } = {}) {
  if (typeof ahora !== 'function') {
    throw new Error(
      'el cronómetro del levantamiento necesita el reloj inyectado: ahora() → milisegundos. ' +
      'Leerlo del sistema dejaría el presupuesto del minuto sin manera de ponerse rojo en la suite',
    );
  }

  let acumulado = null;
  let pila = null;
  let inicio = null;
  let fin = null;

  const lee = () => {
    const t = ahora();
    if (!Number.isFinite(t)) throw new Error(`el reloj inyectado devolvió ${t}, que no es un instante en milisegundos`);
    return t;
  };

  function exigeArrancado() {
    if (acumulado === null) throw new Error('el cronómetro no se ha arrancado: llama a arranca() antes de medir una fase');
  }

  /** Para la fase que está arriba de la pila y le cobra lo corrido. */
  function cobra(t) {
    if (!pila.length) return;
    const arriba = pila[pila.length - 1];
    acumulado[arriba.id] += t - arriba.desde;
    arriba.desde = t;
  }

  return {
    /** Empieza la medida. El minuto se cuenta desde que se confirma la coordenada. */
    arranca() {
      acumulado = Object.fromEntries(IDS_MEDIDOS.map((id) => [id, 0]));
      pila = [];
      inicio = lee();
      fin = null;
      return inicio;
    },

    /**
     * Mide una fase. Lo que corra dentro de otra fase se le cobra a la de dentro y
     * no a la de fuera, que es lo que hace disjunto el reparto.
     */
    async mide(id, tarea) {
      exigeArrancado();
      if (!IDS_MEDIDOS.includes(id)) throw new Error(`fase medida desconocida "${id}": las cinco son ${IDS_MEDIDOS.join(', ')}`);
      const t0 = lee();
      cobra(t0);
      pila.push({ id, desde: t0 });
      try {
        return await tarea();
      } finally {
        const t1 = lee();
        const mia = pila.pop();
        acumulado[mia.id] += t1 - mia.desde;
        if (pila.length) pila[pila.length - 1].desde = t1;
      }
    },

    /**
     * La misma medida, para lo que no es asíncrono.
     *
     * Existe porque el pintado de verdad no lo es: grabar el cuadro de Skia es una
     * llamada sincrónica dentro del repintado, y envolverla en una promesa para
     * poder medirla la movería a otro turno del bucle de eventos y mediría otra cosa.
     */
    mideSincrono(id, tarea) {
      exigeArrancado();
      if (!IDS_MEDIDOS.includes(id)) throw new Error(`fase medida desconocida "${id}": las cinco son ${IDS_MEDIDOS.join(', ')}`);
      const t0 = lee();
      cobra(t0);
      pila.push({ id, desde: t0 });
      try {
        return tarea();
      } finally {
        const t1 = lee();
        const mia = pila.pop();
        acumulado[mia.id] += t1 - mia.desde;
        if (pila.length) pila[pila.length - 1].desde = t1;
      }
    },

    /**
     * Si hay una medida en curso.
     *
     * Existe porque el pintado ocurre también donde no hay ningún minuto que medir
     * —al abrir un mapa que ya estaba levantado— y ahí envolverlo tenía que ser un
     * no-hacer-nada y no una excepción. Preguntar es mejor que tragarse el error:
     * un cronómetro que mide sin haber arrancado devuelve un número inventado.
     */
    enMarcha() {
      return acumulado !== null && fin === null;
    },

    /** Cierra la medida. El minuto termina cuando la lámina está pintada. */
    para() {
      exigeArrancado();
      fin = lee();
      return fin;
    },

    /**
     * El reparto. `total` es de punta a punta y no la suma de las fases: entre una
     * fase y la siguiente hay costuras —esperas del hilo, un repintado— y sumarlas
     * en silencio a la última fase acusaría a quien no fue.
     */
    medida({ coordenada = null, cacheFria = null } = {}) {
      exigeArrancado();
      const cierre = fin ?? lee();
      const fases = IDS_MEDIDOS.map((id) => ({ id, ms: acumulado[id], dueña: DUEÑA[id] }));
      const total = cierre - inicio;
      return Object.freeze({
        total,
        fases: Object.freeze(fases.map(Object.freeze)),
        // La diferencia entre el total y lo repartido, declarada en vez de repartida.
        sinRepartir: total - fases.reduce((s, f) => s + f.ms, 0),
        coordenada,
        cacheFria,
        presupuestoMs: PRESUPUESTO_MS,
      });
    },
  };
}

/**
 * Comprueba una medida contra el presupuesto.
 *
 * Falla nombrando **la coordenada y la fase que se lo comió**, que es lo que pide el
 * criterio: un fallo que dice «tardó de más» no se puede arreglar, y uno que dice
 * «tardó de más en la consulta de la celda urbana» tiene dueño y sitio.
 */
export function compruebaPresupuesto(medida, { presupuestoMs = PRESUPUESTO_MS } = {}) {
  if (!medida || !Array.isArray(medida.fases)) throw new Error('compruebaPresupuesto necesita una medida del cronómetro');
  if (medida.total <= presupuestoMs) return medida;
  const peor = medida.fases.reduce((a, b) => (b.ms > a.ms ? b : a));
  const donde = medida.coordenada ? `en ${medida.coordenada}` : 'en la coordenada medida';
  throw new Error(
    `levantar el mapa ${donde} tardó ${medida.total} ms y el presupuesto es ${presupuestoMs} ms. ` +
    `La fase que se lo comió es "${peor.id}" con ${peor.ms} ms (${peor.dueña}). ` +
    `Reparto: ${medida.fases.map((f) => `${f.id} ${f.ms} ms`).join(', ')}; sin repartir ${medida.sinRepartir} ms`,
  );
}
