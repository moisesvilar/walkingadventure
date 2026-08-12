// El prólogo del mundo: la historia que ya había pasado antes de que llegaras.
//
// Ejecuta unos cuantos pasos del mundo **antes de que la partida empiece**, con
// siembra propia del mundo, de modo que el día 1 se entra en una aldea y ya están
// hablando de algo. No inventa maquinaria: es la propagación de SPEC-012 corriendo
// sobre el motor de SPEC-011 con un contador y una base de siembra que no son los
// de la jugadora. **De esas dos filas es consumidor, no autor.**
//
// Y no se deja al azar: el prólogo **se compone**. Se resiembra entero, con tope de
// intentos declarado, hasta que dos núcleos alcanzables hayan oído el mismo suceso
// en niveles distintos **y exista una aventura del reparto que pase por los dos**,
// que es la puesta en escena del mejor truco del juego. Sin esa última condición el
// par se componía siempre y no lo recorría nadie.
//
// La frontera que este módulo existe para no romper, dicha en voz alta:
// **resembrar el prólogo no es resembrar el mundo**. El prólogo es capa sobre el
// mundo ya generado, exactamente igual que el motor de pasos: puede correrse ocho
// veces seguidas y el documento congelado de cada celda sigue idéntico byte a byte.
// Por eso aquí no se importa `buildWorld` ni ninguna fase de la tubería, y por eso
// lo que el prólogo deja se escribe **solo en el estado de la partida**.

import { congelaHondo } from '../core/congelar.js';
import { makeRng } from '../core/rng.js';
import { exigeSemilla, semillaDePasoDePrologo, semillaDePrologo } from '../core/semilla.js';
import { medidorDeTrechos } from '../quests/casting.js';
import { TAMANO_DE_LA_PRIMERA_SALIDA, componeElPar, estadoDeArranque, exigePuntoDePartida, exigeViario, nucleosAlcanzables, nucleosConReparto, repartoDelMapa } from './arranque.js';
import { siembraLaCola } from './entregas.js';
import { normalizaCriterios } from './filtro.js';
import { estadoDeNucleos, loQueSeCuentaEn } from './nucleos.js';
import { creaMotorDePasos, estadoDePasos, exigeMapaId } from './pasos.js';
import { arbolDeCalzadas, creaPropagacionDeRumores, estadoDeRumores, rumoresDeMapa } from './rumores.js';
import { siembraEntregas, siembraSucesos } from './sucesos-prologo.js';
import { exigeTramoM } from './tramo.js';

/**
 * Cuántos pasos puede dar un intento del prólogo. **Es un techo, no un objetivo**:
 * `arranque.md` §1 dice que el prólogo «dura lo que tarde en haber algo que contar
 * en cada núcleo, y ni un paso más», así que el intento para en cuanto todos los
 * núcleos alcanzables han oído algo y el tope solo evita que un mapa raro lo alargue
 * sin fin.
 *
 * El número es **un supuesto de trabajo declarado y no una decisión de diseño
 * cerrada**: `arranque.md` pendiente 2 dice que hay criterio y no hay número, y que
 * el número sale midiendo. Es el mismo tratamiento que SPEC-003 le dio al lado de
 * celda: valor por defecto, justificación escrita y los criterios afirmando el
 * criterio y no la cifra.
 */
export const TOPE_PASOS_PROLOGO = 12;

/**
 * Cuántos sucesos siembra cada intento. Al menos dos para que la condición de
 * composición tenga margen, y pocos para que el día 1 no suene a que ha pasado de
 * todo. También supuesto de trabajo.
 */
export const SUCESOS_PROLOGO = 3;

/**
 * Cuántas veces se resiembra el prólogo antes de rendirse.
 *
 * **Existe por la garantía de terminación, no por el coste**: ocho intentos de doce
 * pasos sobre datos en memoria son milisegundos y caben de sobra en el minuto de
 * RNF-PER-001. Un bucle sin tope sería una app colgada en la pantalla más frágil de
 * todo el juego, que es la de la generación.
 */
export const INTENTOS_PROLOGO = 8;

/**
 * Cuántas entradas se dejan sembradas en la cola de entregas. `personaje.md` §3: que
 * un día sin aventura del oficio no sea un día vacío; una oportunidad y un encargo
 * suelto bastan.
 */
export const ENTREGAS_PROLOGO = 2;

function exigeEnteroPositivo(valor, quien) {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)}: tiene que ser un entero positivo, porque correr sin tope es colgar la app en la pantalla de la generación`);
  }
  return valor;
}

/** Si todos los núcleos alcanzables tienen ya algo que contar. Es el criterio de parada. */
function todosTienenAlgoQueContar(nucleos, mapaId, alcanzables) {
  return alcanzables.every((nucleo) => loQueSeCuentaEn(nucleos, { mapaId, nucleo }).length > 0);
}

/**
 * Un intento del prólogo, entero y **sobre estado de usar y tirar**.
 *
 * Corre sobre sus propios `estadoDeRumores`, `estadoDeNucleos` y `estadoDePasos`, y
 * quien llama decide si lo asienta. Es lo que hace que la resiembra pueda descartar
 * el intento entero sin conservar nada —ni los sucesos, ni lo sedimentado, ni los
 * frentes, ni la cola— y lo que hace que un intento que falla a mitad no deje un
 * prólogo asentado a medias.
 *
 * El motor y la propagación reciben la **misma base de siembra**, que cuelga de la
 * semilla del mapa con el sufijo del prólogo y el número de intento. El contador que
 * avanza es el de este estado de usar y tirar: el de la partida para este mapa sigue
 * en cero cuando el prólogo termina.
 */
export function intentoDePrologo({
  semilla,
  mapaId,
  arbol,
  alcanzables,
  tramoM,
  intento,
  sucesos = SUCESOS_PROLOGO,
  entregas = ENTREGAS_PROLOGO,
  topePasos = TOPE_PASOS_PROLOGO,
}) {
  const rumores = estadoDeRumores();
  const nucleos = estadoDeNucleos();
  const pasos = estadoDePasos();
  const baseDePaso = (n) => semillaDePasoDePrologo(semilla, mapaId, intento, n);

  const propagacion = creaPropagacionDeRumores({ semilla, mapaId, arbol, estado: rumores, nucleos, tramo: tramoM, baseDePaso });
  const motor = creaMotorDePasos({ semilla, mapaId, estado: pasos, productores: [propagacion], baseDePaso });

  // Un solo generador para las dos siembras del intento, derivado de la semilla del
  // intento: el reparto de la cola no puede desplazar el de los sucesos si mañana
  // cambia el número de entradas, así que va después y no antes.
  const azar = makeRng(`${semillaDePrologo(semilla, mapaId, intento)}:siembra`);
  // Los sucesos nacen en núcleos alcanzables cuando los hay: sembrar donde nadie
  // puede llegar deja el mundo con pasado y a la jugadora sin poder oírlo. Un mapa
  // sin ninguno alcanzable siembra igual, y no falla.
  const donde = alcanzables.length ? alcanzables : arbol.nucleos;
  const sembrados = siembraSucesos({ nucleos: donde, cuantos: sucesos, rng: azar });
  for (const s of sembrados) {
    propagacion.siembra({ id: s.id, origen: s.origen, signo: s.signo, hechos: s.hechos }, 0);
  }
  const cola = siembraEntregas({ nucleos: donde, cuantos: entregas, rng: azar });

  let dados = 0;
  while (dados < topePasos && !todosTienenAlgoQueContar(nucleos, mapaId, alcanzables)) {
    motor.paso(dados + 1);
    dados += 1;
  }

  return { rumores, nucleos, entregas: cola, pasos: dados };
}

/**
 * Corre el prólogo de un mapa recién generado y deja su resultado asentado.
 *
 * @param {object} opciones
 *   `semilla` la de la partida; `mapaId` el mapa; `mundo` el mundo congelado con sus
 *   núcleos y su grafo; `tramoM` **el tramo con el que se dimensionó el mapa**, no el
 *   tramo vivo de la jugadora —el prólogo es propiedad del mapa, y con el tramo vivo
 *   corregirlo más tarde reescribiría un pasado ya asentado—; `partida` el punto de
 *   partida; `criterios` los caminos que se evitan, que deciden qué es alcanzable;
 *   `primerMapa` si este es el primero de la partida, que es lo único que activa la
 *   composición y la regla de la primera aventura; `tamano` el tamaño de salida con
 *   el que se compondrá la primera lista, que es contra el que se valida el par;
 *   `sinContenidoJugable` la marca de
 *   la celda; `arranque`, `rumores` y `nucleos` el estado de la partida donde se
 *   asienta.
 *
 * @returns el estado asentado, el par compuesto o su ausencia, la cola sembrada y el
 *   arranque con su regla. **Ni un texto destinado a mostrarse.**
 */
export function correPrologo({
  semilla,
  mapaId,
  mundo,
  tramoM,
  partida,
  criterios = [],
  primerMapa = true,
  sinContenidoJugable = false,
  arranque = estadoDeArranque(),
  rumores = estadoDeRumores(),
  nucleos = estadoDeNucleos(),
  sucesos = SUCESOS_PROLOGO,
  entregas = ENTREGAS_PROLOGO,
  topePasos = TOPE_PASOS_PROLOGO,
  intentos = INTENTOS_PROLOGO,
  tamano = TAMANO_DE_LA_PRIMERA_SALIDA,
} = {}) {
  const semillaPartida = exigeSemilla(semilla);
  const id = exigeMapaId(mapaId, 'el prólogo del mundo');
  // Los cuatro topes se validan antes de tocar nada: uno que no sea entero positivo
  // es un error de construcción de quien llama, y correr sin tope es la única salida
  // que este módulo no puede tomar.
  exigeEnteroPositivo(intentos, 'el tope de intentos del prólogo');
  exigeEnteroPositivo(topePasos, 'el tope de pasos del prólogo');
  exigeEnteroPositivo(sucesos, 'el número de sucesos del prólogo');
  exigeEnteroPositivo(entregas, 'el número de entradas sembradas en la cola');
  const metrosPorTramo = exigeTramoM(tramoM, 'el prólogo del mundo');
  const desde = exigePuntoDePartida(partida);
  const grafo = exigeViario(mundo);
  const activos = normalizaCriterios(criterios);

  // Un mapa sin contenido jugable no siembra nada y no falla: no hay dónde hacer
  // nacer una noticia ni quién la recuente, y eso es una respuesta y no una avería.
  if (sinContenidoJugable) {
    return congelaResultado({ mapaId: id, arranque, rumores, nucleos, entregas: [], par: null, diagnostico: { intentos: 0, pasos: [], compuesto: false, sinContenidoJugable: true } });
  }

  const arbol = arbolDeCalzadas(mundo);
  // El medidor se comparte entre intentos porque **el mundo no cambia entre
  // intentos**: sus árboles de caminos son del grafo, no del prólogo. Es además la
  // afirmación de la frontera hecha código.
  const medidor = medidorDeTrechos(grafo, activos);
  const alcanzables = nucleosAlcanzables({ mundo, partida: desde, criterios: activos, medidor });

  // El reparto se traza **una sola vez y se comparte entre intentos**, por la misma
  // razón por la que ya se comparte el medidor: el mundo no cambia entre intentos, y
  // lo que la cuarta cláusula pregunta es del mundo y no del prólogo. Fuera del
  // primer mapa no se compone nada, así que no se traza nada.
  const reparto = primerMapa ? repartoDelMapa({ mundo, criterios: activos, tramoM: metrosPorTramo, tamano }) : [];
  const conReparto = primerMapa ? nucleosConReparto({ mundo, reparto }) : [];
  // Con menos de dos núcleos donde alguna aventura del reparto sitúe un beat, la
  // condición es **inalcanzable por construcción**: ninguna resiembra la va a
  // alcanzar, porque lo que falta está en el mundo y el mundo no se resiembra. Se
  // corre un intento, se asienta y se termina sin par, con la misma degradación
  // silenciosa que al agotar el tope. Gastar los ocho sería tiempo tirado en la
  // pantalla más frágil del juego.
  const puedeComponer = primerMapa && conReparto.length >= 2;
  const tope = primerMapa && !puedeComponer ? 1 : intentos;

  const pasosPorIntento = [];
  let ultimo = null;
  let par = null;
  let gastados = 0;

  // El número de intentos está acotado **por construcción**: es un `for` con tope, no
  // un bucle que dependa de que la condición acabe cumpliéndose.
  for (let intento = 1; intento <= tope; intento++) {
    gastados = intento;
    ultimo = intentoDePrologo({ semilla: semillaPartida, mapaId: id, arbol, alcanzables, tramoM: metrosPorTramo, intento, sucesos, entregas, topePasos });
    pasosPorIntento.push(ultimo.pasos);
    // La composición y la resiembra son **solo del primer mapa de la partida**: un
    // mapa nuevo por los bordes y un mundo efímero corren su prólogo igual, pero la
    // puesta en escena es del arranque y solo del arranque (`arranque.md` §2).
    if (!puedeComponer) break;
    par = componeElPar({ rumores: ultimo.rumores, nucleos: ultimo.nucleos, mapaId: id, alcanzables, mundo, tramoM: metrosPorTramo, criterios: activos, reparto, tamano });
    if (par) break;
  }

  // Al agotar el tope se **conserva el prólogo del último intento, sin par compuesto
  // y en silencio**: el mundo tiene pasado igualmente y la lista del día 1 se compone
  // con la regla normal del casting. Fallar abriendo es la única salida que no rompe
  // ni RNF-PER-001 ni el «el juego no dice nada» de `arranque.md` §2.
  asienta({ destino: rumores, origen: ultimo.rumores, mapaId: id, que: 'los rumores', vacio: () => ({ rumores: [] }) });
  asienta({ destino: nucleos, origen: ultimo.nucleos, mapaId: id, que: 'lo que se cuenta en los núcleos', vacio: () => ({}) });
  if (primerMapa) arranque.par = par;

  return congelaResultado({
    mapaId: id,
    arranque,
    rumores,
    nucleos,
    entregas: ultimo.entregas,
    par,
    diagnostico: {
      intentos: gastados,
      pasos: pasosPorIntento,
      compuesto: !!par,
      alcanzables: alcanzables.length,
      // Las dos cifras que dicen si la puesta en escena era posible siquiera, para
      // poder distinguir «no compuso» de «no podía componer». Diagnóstico: no se
      // serializa y no llega a ninguna pantalla.
      reparto: reparto.length,
      conReparto: conReparto.length,
    },
  });
}

/**
 * Traslada el intento ganador al estado de la partida.
 *
 * Un mapa que ya tiene prólogo se niega a correr otro en vez de pisarlo: una partida
 * cargada de un respaldo no vuelve a ejecutar su prólogo, y sin esta comprobación
 * «se cargó» y «se volvió a correr» serían indistinguibles desde fuera.
 */
function asienta({ destino, origen, mapaId, que, vacio }) {
  const yaHabia = destino.mapas?.[mapaId];
  if (cuenta(yaHabia) > 0) {
    throw new Error(`el mapa ${mapaId} ya tiene ${que} de un prólogo anterior: el prólogo de un mapa se corre una sola vez y una partida cargada no lo vuelve a ejecutar`);
  }
  destino.mapas[mapaId] = origen.mapas[mapaId] ?? vacio();
}

// Cuánto hay en el registro de un mapa, sirva de rumores o de lo sedimentado: las
// dos formas son un objeto con listas dentro y solo hace falta saber si está vacío.
function cuenta(registro) {
  if (!registro) return 0;
  return Array.isArray(registro.rumores) ? registro.rumores.length : Object.keys(registro).length;
}

function congelaResultado({ mapaId, arranque, rumores, nucleos, entregas, par, diagnostico }) {
  return {
    mapaId,
    corrido: true,
    par,
    // Las entradas sembradas, con la forma de un efecto `oportunidad` del catálogo
    // cerrado de SPEC-011, que es la que la cola de la fila 19 consumirá.
    entregas: congelaHondo(entregas),
    // Los estados vivos de la partida, ya asentados. Se devuelven para que quien
    // levanta el mapa los siga usando, no como copia.
    arranque,
    rumores,
    nucleos,
    // Y lo único que cuenta cifras: **no es estado de la partida, no se serializa y
    // no llega a ninguna pantalla**. Existe para poder medir el pendiente 2 de
    // `arranque.md` sobre mundos reales, que es como se cierra. El design system
    // prohíbe enseñar cifras de progreso, y lo que no se guarda no se puede pintar.
    diagnostico: congelaHondo(diagnostico),
  };
}

/**
 * Traslada el prólogo de un mapa **al estado de la partida**, y siembra su cola.
 *
 * Existe porque el prólogo corre antes de que la partida exista: en el arranque se
 * compone la lista del día uno mientras la partida todavía no ha nacido, así que
 * `correPrologo` asienta en áreas frescas y **alguien tiene que llevárselas**. Hasta
 * SPEC-050 ese alguien no existía: `app/App.js` recibía el resultado entero y no lo
 * usaba en ninguna línea, así que el mundo nacía sin pasado —ni rumores sedimentados,
 * ni nada que contar en los núcleos, ni cola— y `siembraLaCola` no tenía llamador de
 * producción. Es §6h en su variante de cableado, y su síntoma era que en un teléfono
 * no podía saltar ni un micro-encuentro.
 *
 * Se copia **por mapa y no el área entera**, que es lo que permite que valga igual
 * para el primer mapa de la partida y para uno levantado después: un segundo mapa no
 * puede llevarse por delante lo que el de casa tenga sedimentado.
 *
 * El par **solo se guarda si el prólogo lo compuso**, y eso basta para que un mapa que
 * no es el primero no lo pise nunca: `correPrologo` solo compone par con `primerMapa`,
 * porque la puesta en escena es del arranque y solo del arranque (`arranque.md` §2).
 *
 * @param {object} estado el de la partida, vivo.
 * @param {object} prologo lo que devolvió `correPrologo`.
 * @returns las entradas que quedaron encoladas, para que quien llama pueda afirmarlo.
 */
export function guardaElPrologo(estado, prologo) {
  if (!estado || typeof estado !== 'object' || !estado.rumores || !estado.nucleos || !estado.arranque || !estado.entregas) {
    throw new Error('guardar el prólogo necesita el estado vivo de la partida con sus áreas: llegó algo que no las trae');
  }
  if (!prologo || prologo.corrido !== true) {
    throw new Error(`guardar el prólogo necesita lo que devuelve correPrologo y llegó ${JSON.stringify(prologo) ?? String(prologo)}`);
  }
  const id = exigeMapaId(prologo.mapaId, 'guardar el prólogo en la partida');

  // Un mapa que ya tiene pasado no lo vuelve a recibir. Es la misma negativa que
  // `asienta` hace dentro del prólogo, y por la misma razón: una partida cargada de un
  // respaldo no vuelve a ejecutar su prólogo, y sin esto «se cargó» y «se volvió a
  // correr» serían indistinguibles desde fuera.
  if (tienePrologo({ rumores: estado.rumores, mapaId: id })) {
    throw new Error(`el mapa ${id} ya tiene su prólogo guardado en la partida: se guarda una sola vez`);
  }

  estado.rumores.mapas[id] = prologo.rumores.mapas[id] ?? { rumores: [] };
  estado.nucleos.mapas[id] = prologo.nucleos.mapas[id] ?? {};
  if (prologo.par) estado.arranque.par = prologo.par;

  return siembraLaCola(estado, { mapaId: id, entradas: prologo.entregas });
}

/** Si un mapa ya tiene prólogo corrido, leído de lo que hay en la partida y no de una marca aparte. */
export function tienePrologo({ rumores, mapaId }) {
  return rumoresDeMapa(rumores, exigeMapaId(mapaId, 'la consulta de si un mapa ya tiene prólogo')).rumores.length > 0;
}

/** Si a un núcleo del mapa le ha llegado algo. Lo consume el criterio de parada y nada más. */
export function tieneAlgoQueContar({ nucleos, mapaId, nucleo }) {
  return loQueSeCuentaEn(nucleos, { mapaId, nucleo }).length > 0;
}

// Lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no hay
// ninguna consulta de cuántos pasos dio el prólogo, cuántos intentos gastó ni cuántos
// sucesos sembró. Esas cifras viven en `diagnostico`, que no viaja con la partida.