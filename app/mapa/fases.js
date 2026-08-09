// Las fases que la jugadora ve mientras se levanta el mapa, y de qué fase del
// generador sale cada una.
//
// Son seis líneas en voz de mundo, sin barra, sin porcentaje y sin estimación de
// segundos: `design-system.md` no admite ninguna cifra de progreso, y
// `docs/pantallas.md` cierra que «por debajo del minuto, una lista de fases basta y
// no hace falta entretener a nadie». Que baste es lo que sostiene el presupuesto de
// RNF-PER-001: si el minuto se rompe, esta decisión de UX se cae con él.
//
// La composición definitiva de la pantalla es A1P5 y es de la fila 27. Lo que esta
// fila entrega es que **el generador declare en qué fase va**, que es lo que hace
// que esa lista pueda existir sin inventarse nada: las claves de la izquierda son
// las que `buildWorld` emite por `onStatus`, y no se eligen aquí.

/** Las seis fases, en el orden en el que ocurren y con el texto que se lee. */
export const FASES = Object.freeze([
  Object.freeze({ id: 'datos', texto: 'Mirando qué hay por ahí' }),
  Object.freeze({ id: 'tierra-y-agua', texto: 'Separando la tierra del agua' }),
  Object.freeze({ id: 'gente', texto: 'Repartiendo la gente' }),
  Object.freeze({ id: 'calzadas', texto: 'Trazando las calzadas' }),
  Object.freeze({ id: 'sitios', texto: 'Buscando los sitios con historia' }),
  Object.freeze({ id: 'nombres', texto: 'Poniéndole nombre a todo' }),
]);

/** Los identificadores, en orden. Es lo que se compara para afirmar que están todas. */
export const IDS_DE_FASE = Object.freeze(FASES.map((f) => f.id));

/**
 * De qué fase visible es cada aviso del generador.
 *
 * `coast` cae en «Mirando qué hay por ahí» y no en la siguiente a propósito: es la
 * segunda vuelta a OSM que pide la costa, o sea más espera de datos, y enseñar que
 * se retrocede una fase confundiría a quien la está mirando.
 */
export const FASE_DE_AVISO = Object.freeze({
  fetch: 'datos',
  coast: 'datos',
  terrain: 'tierra-y-agua',
  mask: 'tierra-y-agua',
  settlements: 'gente',
  routes: 'calzadas',
  parajes: 'sitios',
});

/**
 * La fase visible de un aviso del generador, o un error que lo nombra.
 *
 * Falla en vez de ignorar: una fase nueva en `buildWorld` que aquí no esté dejaría
 * la lista quieta mientras el generador avanza, y una lista quieta se lee como
 * «esto se ha colgado». Es más barato romper aquí que descubrirlo en un dispositivo.
 */
export function faseDeAviso(aviso) {
  const id = FASE_DE_AVISO[aviso];
  if (!id) {
    throw new Error(
      `el generador avisó de la fase "${aviso}" y la lista de fases de la pantalla no la reconoce: ` +
      `las declaradas son ${Object.keys(FASE_DE_AVISO).join(', ')}`,
    );
  }
  return id;
}

/**
 * El seguimiento de las fases: qué está en curso y cuáles quedaron completadas.
 *
 * Las fases nunca retroceden. `buildWorld` avisa dos veces de la misma fase visible
 * —`fetch` y `coast`, `terrain` y `mask`— y en un mundo costero eso ocurre después
 * de haber pasado por la máscara; sin este cuidado, la lista daría un salto atrás.
 */
export function creaSeguimientoDeFases(alCambiar = null) {
  let indice = -1;
  const completadas = [];

  const estado = () => Object.freeze({
    enCurso: indice >= 0 ? IDS_DE_FASE[indice] : null,
    completadas: Object.freeze([...completadas]),
    fases: FASES,
  });

  return {
    /** Entra en una fase visible por su identificador. Devuelve el estado resultante. */
    entra(id) {
      const siguiente = IDS_DE_FASE.indexOf(id);
      if (siguiente < 0) throw new Error(`fase de pantalla desconocida "${id}": las seis son ${IDS_DE_FASE.join(', ')}`);
      if (siguiente <= indice) return estado();
      for (let k = Math.max(0, indice); k < siguiente; k++) {
        if (indice >= 0 && !completadas.includes(IDS_DE_FASE[k])) completadas.push(IDS_DE_FASE[k]);
      }
      indice = siguiente;
      const ahora = estado();
      if (alCambiar) alCambiar(ahora);
      return ahora;
    },

    /** El aviso del generador, traducido y aplicado. */
    avisa(aviso) {
      return this.entra(faseDeAviso(aviso));
    },

    /** Se acabó: la última fase también queda completada. */
    termina() {
      for (const id of IDS_DE_FASE) if (!completadas.includes(id)) completadas.push(id);
      indice = IDS_DE_FASE.length - 1;
      const ahora = Object.freeze({ enCurso: null, completadas: Object.freeze([...completadas]), fases: FASES });
      if (alCambiar) alCambiar(ahora);
      return ahora;
    },

    estado,
  };
}
