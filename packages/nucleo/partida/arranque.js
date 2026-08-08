// El arranque: qué núcleos alcanza de verdad quien juega, cuál es el par de
// pueblos que cuentan el mismo suceso de dos maneras, la regla que hace que la
// primera aventura pase por los dos, y el estado que se cierra cuando lo que se
// cuenta en un sitio eres tú.
//
// Es capa sobre el mundo ya generado, como el motor de pasos y la propagación: aquí
// no se genera nada, no se cose nada y no se importa ninguna fase de la tubería.
//
// Y una frontera que conviene decir en voz alta: **esta fila entrega el estado y su
// marca única, y ni un texto**. La página del diario y la cartela del hito son de la
// fila 36; la lista del día 1, de la 28.

import { congelaHondo } from '../core/congelar.js';
import { medidorDeTrechos } from '../quests/casting.js';
import { repartoDeAventuras } from './aventuras.js';
import { PROTAGONISTAS } from './deformacion.js';
import { normalizaCriterios } from './filtro.js';
import { exigeMapaId } from './pasos.js';
import { rumoresDeMapa } from './rumores.js';
import { loQueSeCuentaEn } from './nucleos.js';
import { exigeTramoM } from './tramo.js';

/**
 * Por dónde puede cerrarse el arranque. Es un enumerado y no un booleano porque
 * `arranque.md` pendiente 1 propone una segunda vía —que cierre también cuando la
 * jugadora ya ha visto el truco— y esa propuesta **no está ratificada**: el estado
 * tiene que poder cerrarse por más de una vía sin cambiar de forma, y la segunda no
 * se implementa mientras el diseño no la ratifique.
 */
export const VIAS_DE_CIERRE = Object.freeze({ TE_CUENTAN: 'te-cuentan' });

/**
 * El estado del arranque de una partida: abierto de origen, con la regla de la
 * primera aventura vigente y sin par compuesto hasta que el prólogo lo componga.
 *
 * `marcado` existe aparte de `abierto` porque lo que hay que poder afirmar es que
 * **el hito se marca una sola vez y no vuelve**, y con un único booleano «cerrado»
 * y «ya se enseñó» serían el mismo dato.
 */
export function estadoDeArranque() {
  return { abierto: true, cerradoPor: null, cerradoEn: null, marcado: false, reglaDePaso: true, par: null };
}

// --- Alcanzable es por el grafo ---------------------------------------------

/**
 * Los núcleos a los que hay camino **por el grafo de calzadas** desde el punto de
 * partida, sobre el grafo que el filtro de accesibilidad deja transitable.
 *
 * Nunca distancia en línea recta, y el precedente está medido dos veces: SPEC-007
 * encontró 109 componentes conexas separadas por huecos de 9-50 m, y SPEC-010 midió
 * un pueblo a 1688 m de grafo que en recta son 126. Un núcleo al otro lado de una
 * ría está a cuatrocientos metros y no se llega.
 *
 * Se resuelve sobre el grafo **filtrado** porque componer el par en dos pueblos a
 * los que esa persona concreta no puede ir es exactamente lo que RF-MUNDO-017
 * existe para evitar.
 *
 * @returns los identificadores de núcleo alcanzables, en orden estable.
 */
export function nucleosAlcanzables({ mundo, partida, criterios = [], medidor = null }) {
  const desde = exigePuntoDePartida(partida);
  const grafo = exigeViario(mundo);
  const medida = medidor ?? medidorDeTrechos(grafo, normalizaCriterios(criterios));
  return congelaHondo(
    (mundo.settlements ?? [])
      .filter((s) => medida.metros(desde, { x: s.x, y: s.y }) !== null)
      .map((s) => s.name)
      .sort(),
  );
}

/** El punto de partida, exigido y no supuesto: suponer el centro del mapa es inventarse dónde vive alguien. */
export function exigePuntoDePartida(partida) {
  if (!partida || !Number.isFinite(partida.x) || !Number.isFinite(partida.y)) {
    throw new Error(
      'falta el punto de partida de la jugadora: el prólogo resuelve la alcanzabilidad desde él y no lo supone, ' +
      `porque suponer el centro del mapa cambiaría qué núcleos se dan por alcanzables. Llegó ${JSON.stringify(partida) ?? String(partida)}`,
    );
  }
  return { x: partida.x, y: partida.y };
}

/** El grafo viario del mundo, exigido y nombrado si falta. */
export function exigeViario(mundo) {
  if (!mundo?.viario) {
    throw new Error('el mapa no trae su grafo de calzadas (`mundo.viario`): sin él no se puede saber a qué núcleos se llega, y la línea recta miente');
  }
  return mundo.viario;
}

// --- El reparto del mapa, que es lo que decide si un par sirve ---------------

/**
 * El tamaño de salida **con el que se compone la primera lista de la partida**, y
 * por tanto con el que se valida el par.
 *
 * Se valida contra este y no contra «alguno de los tres declarados»: un par que
 * solo cabe en `jornada` no pone nada en escena para quien el día 1 sale a dar un
 * paseo, así que validar contra el tamaño que se va a usar es lo que convierte la
 * cuarta cláusula en una garantía en vez de en una probabilidad.
 */
export const TAMANO_DE_LA_PRIMERA_SALIDA = 'aventura';

/**
 * Las aventuras del reparto del mapa que **caben** en el tamaño de salida dado, en
 * orden estable por identificador de plantilla.
 *
 * Se lee del casting que ya viaja con el mundo —`repartoDeAventuras` no castea
 * nada, solo traza el lazo de lo ya casteado— y por eso la cuarta cláusula no
 * reabre ninguna decisión del casting ni castea una vez por par evaluado.
 *
 * **Sin filtro de oficio**, a propósito: el oficio no puede entrar en la condición
 * de composición, porque dos partidas con la misma semilla y distinto oficio tienen
 * que componer el mismo par (`arranque.md` §1, el prólogo es propiedad del lugar).
 */
export function repartoDelMapa({ mundo, criterios = [], tramoM, tamano = TAMANO_DE_LA_PRIMERA_SALIDA }) {
  const metrosPorTramo = exigeTramoM(tramoM, 'el reparto con el que se valida el par del prólogo');
  exigeViario(mundo);
  const reparto = repartoDeAventuras({ mundo, criterios: normalizaCriterios(criterios), tramo: metrosPorTramo, tamano });
  if (!reparto.hayReparto) return [];
  return reparto.aventuras
    .filter((a) => a.cabe)
    .sort((x, y) => (x.plantilla < y.plantilla ? -1 : x.plantilla > y.plantilla ? 1 : 0));
}

/**
 * Los núcleos del mapa donde **alguna aventura del reparto sitúa un beat**, en
 * orden estable.
 *
 * Es lo único que no miente sobre si un núcleo puede alojar la puesta en escena.
 * Contar servicios o mirar si el tipo del núcleo aparece en algún rol del catálogo
 * da falsos positivos medidos: hay **un solo rol de tipo granja**, así que dos
 * granjas pasarían un filtro por tipo y jamás podrían alojar beats de una misma
 * aventura.
 */
export function nucleosConReparto({ mundo, reparto = [] }) {
  return (mundo?.settlements ?? [])
    .map((s) => s.name)
    .filter((nombre) => reparto.some((aventura) => pasaPorNucleo(aventura, nombre)))
    .sort();
}

// --- El par compuesto -------------------------------------------------------

/**
 * El par compuesto de un intento, o `null` si ese intento no compone ninguno.
 *
 * Un intento cumple si existe un suceso `S` y dos núcleos `A ≠ B` tales que los dos
 * lo **oyeron** —sedimentado, no en vuelo hacia ellos—, en **niveles distintos**,
 * los dos son **alcanzables**, y existe **una aventura del reparto del mapa con al
 * menos un beat en cada uno de los dos**.
 *
 * La cuarta cláusula medía antes un recorrido sintético por el grafo, y eso lo
 * cumplía casi cualquier pareja de un mapa pequeño: descartaba pares imposibles de
 * andar, no pares imposibles de **usar**. Medido sobre los ocho extractos de
 * referencia, el par se componía siempre y ninguna aventura pasaba por los dos, así
 * que RF-QUEST-014 se cumplía de forma vacía. Ahora se pregunta contra el reparto
 * real y con el **mismo** predicado `pasaPorNucleo` que aplica el filtro de la
 * primera aventura: que sean el mismo es lo que hace que la condición garantice el
 * resultado en vez de aproximarlo.
 *
 * Con varios pares se elige **por regla estable declarada** —el suceso de identidad
 * menor y, dentro de él, la pareja de identificadores de núcleo menor— y nunca por
 * cuál tenga más aventuras que pasen por los dos ni por orden de recorrido, que es
 * la dependencia de orden que `CLAUDE.md` prohíbe.
 */
export function componeElPar({ rumores, nucleos, mapaId, alcanzables, mundo, tramoM, criterios = [], reparto = null, tamano = TAMANO_DE_LA_PRIMERA_SALIDA }) {
  const id = exigeMapaId(mapaId, 'la condición de composición del prólogo');
  const metrosPorTramo = exigeTramoM(tramoM, 'la condición de composición del prólogo');
  exigeViario(mundo);

  const sitios = alcanzables.slice().sort();
  if (sitios.length < 2) return null;

  // El reparto llega hecho cuando quien llama corre varios intentos —el mundo no
  // cambia entre intentos y trazar sus lazos ocho veces sería tirar tiempo—, y se
  // deriva aquí cuando esta función se usa suelta.
  const aventuras = reparto ?? repartoDelMapa({ mundo, criterios, tramoM: metrosPorTramo, tamano });

  // Qué nivel oyó cada núcleo alcanzable de cada suceso, leído de lo sedimentado y
  // no de los frentes: un rumor en vuelo hacia un sitio no es un sitio que lo oyó.
  const oidoPor = new Map();
  for (const nucleo of sitios) {
    for (const version of loQueSeCuentaEn(nucleos, { mapaId: id, nucleo })) {
      if (!oidoPor.has(version.rumor)) oidoPor.set(version.rumor, []);
      oidoPor.get(version.rumor).push({ nucleo, nivel: version.nivel });
    }
  }

  const sucesos = rumoresDeMapa(rumores, id).rumores
    .map((r) => r.id)
    .filter((r) => oidoPor.has(r))
    .sort();

  for (const suceso of sucesos) {
    const oyentes = oidoPor.get(suceso).slice().sort((a, b) => (a.nucleo < b.nucleo ? -1 : a.nucleo > b.nucleo ? 1 : 0));
    for (let i = 0; i < oyentes.length; i++) {
      for (let j = i + 1; j < oyentes.length; j++) {
        const a = oyentes[i];
        const b = oyentes[j];
        // Mismo nivel no compone: la gracia es que las dos versiones se contradigan.
        if (a.nivel === b.nivel) continue;
        // La cláusula es **de par y no de núcleo**: hace falta una sola aventura con
        // un beat en A y otro en B. Dos aventuras distintas, una por núcleo, no
        // componen, porque quien juega acepta una.
        const avala = aventuras.find((aventura) => pasaPorNucleo(aventura, a.nucleo) && pasaPorNucleo(aventura, b.nucleo));
        if (!avala) continue;
        return congelaHondo({
          suceso,
          nucleos: [a.nucleo, b.nucleo],
          niveles: { [a.nucleo]: a.nivel, [b.nucleo]: b.nivel },
          // Qué aventura avala el par: **diagnóstico y no estado**. Se anota, no se
          // elige —sale del primer elemento de un reparto ordenado por plantilla— y
          // `congelaArranque` no lo serializa, para no tener que decidir qué pasa
          // cuando esa plantilla deja de castear.
          avalada: avala.plantilla,
          tamano,
        });
      }
    }
  }
  return null;
}

/**
 * Un par recibido de fuera, comprobado contra el mapa activo.
 *
 * Un núcleo que no existe se nombra en lugar de aceptarse: el par viaja en el
 * estado de la partida y un mapa cargado de un respaldo tiene que poder decir que
 * su par ya no cuadra, en vez de filtrar la lista del día 1 contra un pueblo que no
 * está.
 */
export function exigeParDelMapa(par, mundo) {
  if (par == null) return null;
  const nombres = (mundo?.settlements ?? []).map((s) => s.name);
  if (!Array.isArray(par.nucleos) || par.nucleos.length !== 2) {
    throw new Error(`el par compuesto llega con ${JSON.stringify(par.nucleos) ?? String(par.nucleos)} y son siempre dos núcleos distintos`);
  }
  if (par.nucleos[0] === par.nucleos[1]) {
    throw new Error(`el par compuesto repite el núcleo "${par.nucleos[0]}": son dos núcleos distintos que oyeron el mismo suceso en niveles distintos`);
  }
  for (const nucleo of par.nucleos) {
    if (!nombres.includes(nucleo)) {
      throw new Error(`el par compuesto cita el núcleo "${nucleo}", que no existe en el mapa activo: los que hay son ${nombres.slice().sort().join(', ') || '(ninguno)'}`);
    }
  }
  return par;
}

// --- La primera aventura se elige por dónde pasa -----------------------------

/**
 * Si una aventura **pasa por** un núcleo, que es tener al menos un beat allí.
 *
 * No vale que el trazado lo cruce, y la razón es mecánica: lo que se cuenta en un
 * núcleo aflora al llegar y pararse dentro del geofence (RF-BUCLE-006), así que
 * cruzar un pueblo de largo no dispara nada y la puesta en escena se perdería justo
 * donde tenía que ocurrir.
 *
 * Un beat está en un núcleo de dos maneras: porque su lugar **es** el núcleo, o
 * porque es un servicio o una persona **de** ese núcleo. Un paraje no está en
 * ninguno.
 */
export function pasaPorNucleo(aventura, nucleo) {
  return (aventura?.beats ?? []).some((b) => beatEnNucleo(b, nucleo));
}

function beatEnNucleo(beat, nucleo) {
  const lugar = beat?.lugar;
  if (!lugar) return false;
  if (lugar.tipo === 'nucleo' && lugar.nombre === nucleo) return true;
  return lugar.en === nucleo;
}

/**
 * La lista de candidatas de una salida, con la regla del arranque aplicada encima.
 *
 * Tres cosas que no son negociables y son fáciles de romper. Se aplica **encima**
 * del casting y del filtro de oficio, nunca en lugar de ellos: una aventura que no
 * castea no se ofrece por mucho que pase por los dos núcleos, así que lo que entra
 * aquí ya está casteado y aquí solo se quita. **Degrada abriendo**: si ninguna pasa
 * por los dos, se devuelve la lista normal, porque un día vacío por una puesta en
 * escena sería peor que la puesta en escena que se pierde. Y **no se aplica en
 * absoluto** sin par compuesto, sin regla vigente o fuera del primer mapa.
 */
export function filtraPrimeraAventura({ aventuras, arranque, mundo = null }) {
  const lista = aventuras ?? [];
  const par = arranque?.reglaDePaso ? arranque?.par ?? null : null;
  if (!par) return lista;
  if (mundo) exigeParDelMapa(par, mundo);

  const candidatas = lista.filter((a) => {
    validaLoQueDicePasar(a);
    return par.nucleos.every((nucleo) => pasaPorNucleo(a, nucleo));
  });
  return candidatas.length ? candidatas : lista;
}

// Una aventura puede declarar por dónde dice pasar. Si lo declara, tiene que ser
// verdad: aceptar «paso por Vilanova» sin un beat en Vilanova metería en la lista
// del día 1 exactamente la aventura que la puesta en escena necesita que no entre,
// y el fallo aparecería como una puesta en escena que no ocurre, sin nada rojo.
function validaLoQueDicePasar(aventura) {
  for (const nucleo of aventura?.pasaPor ?? []) {
    if (!pasaPorNucleo(aventura, nucleo)) {
      throw new Error(
        `la aventura "${aventura.plantilla ?? aventura.id ?? '(sin id)'}" dice pasar por "${nucleo}" y no tiene ningún beat allí: ` +
        'pasar por un núcleo es tener un beat en él, no cruzarlo de largo',
      );
    }
  }
}

/**
 * Aceptar la primera aventura **consume la regla**, y solo aceptarla.
 *
 * No la consume salir a andar sin coger nada —no ha habido primera aventura
 * todavía— y no se reimpone al abandonarla a mitad: `arranque.md` §2 es categórico,
 * «esto es del arranque y solo del arranque», y reimponerla repetiría el guion.
 */
export function aceptaPrimeraAventura(arranque) {
  if (!arranque || typeof arranque !== 'object') {
    throw new Error('aceptar la primera aventura necesita el estado del arranque de la partida, que es donde vive la regla de paso');
  }
  arranque.reglaDePaso = false;
  return arranque;
}

// --- El hito de fin de arranque ----------------------------------------------

/**
 * La jugadora llega a un núcleo: se mira si lo que allí se cuenta es ella, contado
 * por otros.
 *
 * Dos condiciones y las dos hacen falta. **Que el suceso lo protagonice ella**, que
 * se lee del rumor y no de la versión: el nivel 3 atribuye lo que no hiciste a otro,
 * y si se leyera de la versión el hito dejaría de cumplirse justo donde más se nota.
 * Y **que no sea la versión fiel**: la que ella misma vio ocurrir no la cuenta
 * nadie, y `arranque.md` §3 pide «contado por otros y no exactamente como fue».
 *
 * Se marca **una sola vez y no se puede reabrir**: volver a ese núcleo o llegar a
 * otro donde también se cuente algo suyo no lo vuelve a cumplir.
 */
export function llegaANucleo({ arranque, rumores, nucleos, mapaId, nucleo, n = null }) {
  if (!arranque || typeof arranque !== 'object') {
    throw new Error('la condición de fin de arranque necesita el estado del arranque de la partida');
  }
  if (!arranque.abierto) return congelaHondo({ cumplida: false, marca: false, cerradoPor: arranque.cerradoPor });

  const id = exigeMapaId(mapaId, 'la condición de fin de arranque');
  const registro = rumoresDeMapa(rumores, id).rumores;
  const cuentaAlgoSuyo = loQueSeCuentaEn(nucleos, { mapaId: id, nucleo }).some((version) => {
    if (version.nivel === 0) return false;
    const rumor = registro.find((r) => r.id === version.rumor);
    return rumor?.hechos?.protagonista?.tipo === PROTAGONISTAS.JUGADORA;
  });
  if (!cuentaAlgoSuyo) return congelaHondo({ cumplida: false, marca: false, cerradoPor: null });

  arranque.abierto = false;
  arranque.cerradoPor = VIAS_DE_CIERRE.TE_CUENTAN;
  arranque.cerradoEn = n;
  arranque.marcado = true;
  return congelaHondo({ cumplida: true, marca: true, cerradoPor: arranque.cerradoPor });
}

// --- Serialización -----------------------------------------------------------

/** El estado del arranque en forma serializable, con el par en orden declarado. */
export function congelaArranque(arranque) {
  const par = arranque?.par ?? null;
  return {
    abierto: arranque?.abierto !== false,
    cerradoPor: arranque?.cerradoPor ?? null,
    cerradoEn: arranque?.cerradoEn ?? null,
    marcado: arranque?.marcado === true,
    reglaDePaso: arranque?.reglaDePaso !== false,
    par: par
      ? {
        suceso: par.suceso,
        nucleos: par.nucleos.slice().sort(),
        niveles: Object.keys(par.niveles ?? {}).sort().reduce((o, k) => { o[k] = par.niveles[k]; return o; }, {}),
      }
      : null,
  };
}

/**
 * El estado del arranque de vuelta de su documento.
 *
 * Un arranque cerrado vuelve cerrado y **el hito no se vuelve a marcar**: `marcado`
 * viaja con él a propósito, porque sin ese dato una partida cargada volvería a
 * enseñar la cartela la primera vez que se llegara a un pueblo.
 */
export function levantaArranque(doc) {
  const estado = estadoDeArranque();
  if (!doc) return estado;
  estado.abierto = doc.abierto !== false;
  estado.cerradoPor = doc.cerradoPor ?? null;
  estado.cerradoEn = doc.cerradoEn ?? null;
  estado.marcado = doc.marcado === true;
  estado.reglaDePaso = doc.reglaDePaso !== false;
  estado.par = doc.par
    ? { suceso: doc.par.suceso, nucleos: doc.par.nucleos.slice(), niveles: { ...(doc.par.niveles ?? {}) } }
    : null;
  return estado;
}
