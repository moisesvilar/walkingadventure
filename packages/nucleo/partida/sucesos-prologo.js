// El catálogo cerrado de lo que le pasó al mundo antes de que llegaras, y cómo se
// reparte por los núcleos: los sucesos del prólogo con sus hechos estructurados y
// su signo, y las entradas con las que se precalienta la cola de entregas.
//
// Dos propiedades lo gobiernan y las dos son de diseño, no de estilo. **Ninguno lo
// protagoniza la jugadora** (`game-design/arranque.md` §3): si lo hiciera, el hito
// de fin de arranque se dispararía el día 1 por accidente, que es el error más
// fácil de cometer en toda esta fila. Y **el catálogo es cerrado y apto para
// menores**, que es principio de la especificación y no un detalle: lo comprueba el
// propio módulo al cargarse, con el mismo patrón que `efectos.js`.

import { congelaHondo } from '../core/congelar.js';
import { shuffle } from '../core/rng.js';
import { PROTAGONISTAS, SIGNOS, hechosFieles } from './deformacion.js';

/**
 * Lo que pasó antes de que llegaras. Ocho sucesos, cada uno con su asunto en clave
 * —nunca prosa: la redacción es de la fila 18 y puede no existir todavía—, su signo
 * del enumerado cerrado y el detalle que la deformación puede trastocar.
 *
 * Hay ocho y no tres para que los `SUCESOS_PROLOGO` que se siembran cambien de una
 * resiembra a otra: con tres, los ocho intentos del tope repartirían siempre los
 * mismos y solo cambiaría dónde nacen.
 */
export const SUCESOS_DEL_MUNDO = congelaHondo([
  { id: 'burro-perdido', asunto: 'burro-perdido-y-devuelto', signo: SIGNOS.BUENO, veces: 1, con: 'la panadera', motivo: 'una cancela mal cerrada' },
  { id: 'campana-rajada', asunto: 'campana-rajada', signo: SIGNOS.FEO, veces: 1, con: 'el campanero', motivo: 'una helada de marzo' },
  { id: 'fuente-seca', asunto: 'fuente-que-se-secó', signo: SIGNOS.FEO, veces: 1, con: 'los del molino', motivo: 'un verano sin lluvia' },
  { id: 'lobo-en-la-nieve', asunto: 'lobo-visto-en-la-nieve', signo: SIGNOS.FEO, veces: 1, con: 'un pastor', motivo: 'el invierno largo' },
  { id: 'niebla-del-puente', asunto: 'niebla-que-no-levantó', signo: SIGNOS.FEO, veces: 1, con: 'los carreteros', motivo: 'tres días de calma' },
  { id: 'nido-en-la-torre', asunto: 'cigüeñas-que-volvieron', signo: SIGNOS.BUENO, veces: 1, con: 'los críos', motivo: 'la torre por fin arreglada' },
  { id: 'puente-caido', asunto: 'puente-que-se-vino-abajo', signo: SIGNOS.FEO, veces: 1, con: 'el barquero', motivo: 'una riada' },
  { id: 'romeria-buena', asunto: 'romería-que-salió-redonda', signo: SIGNOS.BUENO, veces: 1, con: 'media comarca', motivo: 'una promesa cumplida' },
]);

/** Los identificadores del catálogo, en orden declarado y estable. */
export const IDS_DE_SUCESO = congelaHondo(SUCESOS_DEL_MUNDO.map((s) => s.id).sort());

/**
 * Las dos clases de entrada de la cola de entregas de la fila 19: la oportunidad
 * que aparece por el camino y el encargo suelto que se puede coger o no.
 *
 * Se declaran aquí porque el prólogo tiene que sembrar de las dos, y **su ciclo de
 * vida no es de esta fila**: ni el coste cero de desvío, ni el cooldown, ni la
 * doble oferta, ni la sedimentación.
 */
export const CLASES_DE_ENTREGA = Object.freeze({ OPORTUNIDAD: 'oportunidad', ENCARGO: 'encargo' });

/**
 * Lo que se siembra en la cola. `personaje.md` §3 pide que un día sin aventura del
 * oficio no sea un día vacío, y para eso hacen falta las dos clases.
 */
export const ENTREGAS_DEL_MUNDO = congelaHondo([
  { id: 'aceite-a-la-botica', clase: CLASES_DE_ENTREGA.ENCARGO, asunto: 'aceite-para-la-botica' },
  { id: 'carta-sin-echar', clase: CLASES_DE_ENTREGA.ENCARGO, asunto: 'carta-que-nadie-echó' },
  { id: 'gato-en-el-tejado', clase: CLASES_DE_ENTREGA.OPORTUNIDAD, asunto: 'gato-en-el-tejado' },
  { id: 'herramienta-prestada', clase: CLASES_DE_ENTREGA.ENCARGO, asunto: 'herramienta-por-devolver' },
  { id: 'setas-de-temporada', clase: CLASES_DE_ENTREGA.OPORTUNIDAD, asunto: 'setas-de-temporada' },
  { id: 'tejas-por-recoger', clase: CLASES_DE_ENTREGA.OPORTUNIDAD, asunto: 'tejas-que-tiró-el-viento' },
]);

// Los dos catálogos se comprueban a sí mismos al cargarse. Es barato y cierra las
// dos puertas por las que esto se rompería de verdad: un identificador repetido,
// que haría que dos sucesos se pisaran al sedimentar, y una palabra que no es apta
// para menores metida el día que alguien amplíe la lista sin releer la
// especificación.
// Va con fronteras de palabra a propósito: sin ellas «el barquero» se rechazaba por
// llevar «bar» dentro, que es la clase de guarda que acaba desactivada por molesta.
const VOCABULARIO_NO_APTO = /\b(alcohol|arma|armas|bar|bares|borracho|borracha|cerveza|copas|discoteca|droga|drogas|matanza|muerte|muerto|muerta|prostituta|pub|sangre|sexo|suicidio|tabaco|whisky)\b/i;

for (const catalogo of [SUCESOS_DEL_MUNDO, ENTREGAS_DEL_MUNDO]) {
  const vistos = [];
  for (const entrada of catalogo) {
    if (vistos.includes(entrada.id)) {
      throw new Error(`el catálogo del prólogo repite el identificador "${entrada.id}": dos sucesos con la misma identidad se pisarían al sedimentar`);
    }
    vistos.push(entrada.id);
    for (const campo of ['id', 'asunto', 'con', 'motivo']) {
      const valor = entrada[campo];
      if (typeof valor === 'string' && VOCABULARIO_NO_APTO.test(valor)) {
        throw new Error(`el catálogo del prólogo declara "${valor}" en "${entrada.id}": el contenido apto para menores es principio de la especificación y no un detalle`);
      }
    }
  }
}

/**
 * Los hechos estructurados de un suceso, en su versión fiel y anclados al núcleo
 * donde ocurrió.
 *
 * Entran por la misma puerta que los de una aventura —`hechosFieles`, con sus ejes
 * cerrados— y **lo único que cambia es el protagonista**: aquí no hay jugadora.
 */
export function hechosDelSuceso(entrada, nucleo) {
  if (!entrada || typeof entrada.asunto !== 'string') {
    throw new Error(`la entrada del catálogo de sucesos llega como ${JSON.stringify(entrada) ?? String(entrada)}: se espera una del catálogo cerrado`);
  }
  return hechosFieles(
    {
      asunto: entrada.asunto,
      escala: { veces: entrada.veces ?? 1 },
      detalle: { con: entrada.con ?? null, lugar: nucleo, motivo: entrada.motivo ?? null },
    },
    { lugar: nucleo, protagonista: PROTAGONISTAS.VECINDARIO, quien: `el suceso del prólogo "${entrada.id}"` },
  );
}

/**
 * Reparte `cuantos` sucesos por los núcleos que se le den.
 *
 * **Nacen en núcleos distintos mientras haya núcleos donde repartirlos**, y con
 * menos núcleos que sucesos se siembran los que caben en lugar de fallar: un mapa
 * de un solo pueblo tiene pasado igualmente, solo que uno.
 *
 * Los dos sorteos van sobre listas **ya ordenadas** y con azar sembrado: el orden de
 * llegada no decide nada.
 *
 * @returns la lista de sucesos listos para nacer, cada uno con la forma que pide
 *   `naceSuceso` de SPEC-012.
 */
export function siembraSucesos({ nucleos, cuantos, rng, catalogo = SUCESOS_DEL_MUNDO }) {
  if (!Number.isInteger(cuantos) || cuantos < 0) {
    throw new Error(`el número de sucesos del prólogo llega como ${JSON.stringify(cuantos) ?? String(cuantos)}: se espera un entero no negativo`);
  }
  if (typeof rng !== 'function') {
    throw new Error('la siembra de sucesos del prólogo necesita el azar de su intento: sin generador no se puede repartir de forma reproducible');
  }
  const sitios = (nucleos ?? []).slice().sort();
  if (!sitios.length) return congelaHondo([]);

  const barajados = shuffle(rng, catalogo.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  const donde = shuffle(rng, sitios);
  const cuantosCaben = Math.min(cuantos, barajados.length, donde.length);

  const sembrados = [];
  for (let i = 0; i < cuantosCaben; i++) {
    const entrada = barajados[i];
    const nucleo = donde[i];
    sembrados.push({
      // La identidad no lleva el número de intento dentro: la resiembra descarta el
      // intento entero, así que no hay con qué colisionar, y meterlo dentro haría
      // que un dato de la partida contase cuántas veces se resembró.
      id: `prologo:${entrada.id}@${nucleo}`,
      origen: nucleo,
      signo: entrada.signo,
      hechos: hechosDelSuceso(entrada, nucleo),
      suceso: entrada.id,
    });
  }
  return congelaHondo(sembrados);
}

/**
 * Las entradas con las que se precalienta la cola de entregas.
 *
 * Tienen la forma de un efecto `oportunidad` del catálogo cerrado de SPEC-011 —que
 * es la forma con la que la cola las recibirá durante la partida— y **ningún campo
 * propio del prólogo**: una entrada distinguible acabaría tratada distinto y el
 * arranque volvería a parecer un guion.
 *
 * El reparto empieza por un encargo suelto y va alternando, que es lo que garantiza
 * «al menos un encargo» sin sortear hasta que salga.
 */
export function siembraEntregas({ nucleos, cuantos, rng, catalogo = ENTREGAS_DEL_MUNDO }) {
  if (!Number.isInteger(cuantos) || cuantos < 0) {
    throw new Error(`el número de entradas sembradas en la cola llega como ${JSON.stringify(cuantos) ?? String(cuantos)}: se espera un entero no negativo`);
  }
  if (typeof rng !== 'function') {
    throw new Error('la siembra de la cola de entregas necesita el azar de su intento: sin generador no se puede repartir de forma reproducible');
  }
  const sitios = (nucleos ?? []).slice().sort();
  if (!sitios.length || cuantos === 0) return congelaHondo([]);

  const porClase = (clase) => shuffle(rng, catalogo.filter((e) => e.clase === clase).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  const encargos = porClase(CLASES_DE_ENTREGA.ENCARGO);
  const oportunidades = porClase(CLASES_DE_ENTREGA.OPORTUNIDAD);
  const donde = shuffle(rng, sitios);

  const elegidas = [];
  for (let i = 0; elegidas.length < cuantos && (encargos.length || oportunidades.length); i++) {
    const cola = i % 2 === 0 ? encargos : oportunidades;
    const otra = i % 2 === 0 ? oportunidades : encargos;
    const entrada = cola.shift() ?? otra.shift();
    if (entrada) elegidas.push(entrada);
  }

  return congelaHondo(elegidas.map((entrada, i) => ({
    tipo: 'oportunidad',
    asunto: entrada.asunto,
    clase: entrada.clase,
    lugar: donde[i % donde.length],
  })));
}
