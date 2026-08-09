// El casting: resolver los roles abstractos de una plantilla contra el mundo
// concreto que hay debajo de quien juega (`game-design/quests.md` §7).
//
// Es el corazón jugable del proyecto: lo que convierte un catálogo de plantillas
// escritas a mano en las aventuras de este barrio, con estos sitios y a estas
// distancias. Y entrega la otra mitad, la que se olvida: **la plantilla que no
// castea no se ofrece, y el motivo queda explicado como dato** (`motivos.js`),
// porque ese motivo alimenta el informe de salud del generador.
//
// Dos reglas lo atraviesan y son fáciles de romper sin darse cuenta:
//
//   1. **El casting no mira lo descubierto.** Lo que el jugador ha pisado afecta a
//      lo que ve, jamás a lo que existe ni a lo que castea. Si una aventura solo
//      pudiera usar sitios ya visitados, los primeros días no habría juego — que
//      es justo cuando el mundo menos castea. Aquí no entra ni se consulta ningún
//      nivel de conocimiento: búscalo, no está.
//   2. **Fallar por no llegar es casi imposible.** No hay tiempos límite, las
//      franjas ambientan pero no cancelan, y no se escribe ni una fecha ni una hora
//      del reloj real. Se falla por decisiones, no por piernas.
//
// Y una tercera que se ve en las unidades: **aquí no hay ni un metro ni un ritmo
// escritos a mano**. Todos los topes se expresan en tramos de quien juega
// (`game-design/accesibilidad.md` §1) y solo se traducen a metros contra su tramo.
// Los metros que salen son el dato del trazado, nunca la unidad de la regla.

import { makeRng, shuffle } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';
import { congelaHondo } from '../core/congelar.js';
import { exigeGrafo, nodoMasCercano, SNAP_MAX } from '../world/grafo.js';
import { PESO_MINIMO_DE_ESCENA } from '../world/escenas.js';
import { namesFor } from '../names/index.js';
import { SIN_DESCARTES, exigeDescartes } from '../partida/descartes.js';
import { arbolDeCaminos, caminoDesdeArbol, normalizaCriterios, tramosDelCamino } from '../partida/filtro.js';
import { caraDeSitio } from '../partida/npcs.js';
import { SIN_OBJETOS, exigeTenencia } from '../partida/objetos.js';
import { dimensionaSalida, rangoDeBeats } from '../partida/salida.js';
import { exigeTramoM } from '../partida/tramo.js';
import { MOTIVOS_DE_CASTING, motivoDeCasting } from './motivos.js';
import { TIPOS_DE_ROL, FRANJA_DIURNA, beatCasteado, franjaCabeEn, franjaDe, validaPlantilla } from './aventura.js';
// El catálogo llega **ya comprobado**: importarlo desde aquí es lo que hace que
// cargar el casting compruebe el catálogo entero, en vez de dejar el error para el
// primer casteo que use la plantilla mal escrita (SPEC-017).
import { CATALOGO } from './catalogo.js';

/**
 * El tope de un trecho entre dos beats: **un tramo**, ni más ni menos.
 *
 * RF-QUEST-003 dice «ningún tramo supera media hora al ritmo del jugador», y un
 * tramo *es* media hora a su ritmo. El prototipo codificaba 2 400 m, que con el
 * tramo de referencia son 1,2 tramos: un margen que nadie decidió.
 */
export const TOPE_DE_TRECHO_EN_TRAMOS = 1;

/**
 * El trecho mínimo, para que dos beats no caigan pegados y el lazo no sea una
 * vuelta a la manzana. Son los 60 m del prototipo reexpresados con el tramo de
 * referencia; se declara aquí para poder corregirlo en un sitio.
 */
export const MINIMO_DE_TRECHO_EN_TRAMOS = 0.03;

/**
 * Qué es «cerca del punto de partida»: medio tramo.
 *
 * `quests.md` §3 no fija número. Medio y no uno entero porque un lazo que empieza
 * a media hora de casa ya ha gastado dos trechos antes del primer beat.
 */
export const CERCA_DE_LA_PARTIDA_EN_TRAMOS = 0.5;

/** El peso con el que una escena se da por cubierta cuando el rol no pide otro. */
export { PESO_MINIMO_DE_ESCENA };

const escenasDelRol = (req) => (Array.isArray(req.escena) ? req.escena : [req.escena]);

/**
 * El requisito de un rol como **dato**, para que el motivo del fallo lo lleve
 * dentro sin redactar ninguna frase.
 */
export function requisitoDeRol(req) {
  if (req.tipo === 'servicio') return { tipo: 'servicio', kind: req.kind };
  if (req.tipo === 'nucleo') return { tipo: 'nucleo', types: [...req.types] };
  if (req.tipo === 'paraje') return { tipo: 'paraje', escenas: escenasDelRol(req), pesoMinimo: req.minPeso ?? PESO_MINIMO_DE_ESCENA };
  if (req.tipo === 'humano') return { tipo: 'humano', en: req.en, puesto: req.puesto ?? null };
  throw new Error(`tipo de rol desconocido ${JSON.stringify(req.tipo)}: los declarados son ${TIPOS_DE_ROL.join(', ')}`);
}

/**
 * Los lugares del mundo que cumplen lo que pide un rol.
 *
 * No se consulta el conocimiento de nadie: un paraje sin pisar es candidato
 * exactamente igual que uno visitado, y por eso cada candidato viaja con su nombre
 * propio y su anclaje real —a un sitio al que te mandan te lo nombran aunque no
 * hayas ido—.
 *
 * **Aquí es donde entra el descarte** (SPEC-035), y en ningún otro sitio: un sitio que
 * quien juega marcó deja de ser candidato de cualquier rol, exactamente como los
 * criterios de caminos evitados entran al trazar el lazo. El mundo sigue entero —el
 * sitio se dibuja, conserva su nombre y su posición— y ninguna celda se resiembra.
 */
export function candidatosDeRol(mundo, req, { descartes = SIN_DESCARTES } = {}) {
  const marcados = exigeDescartes(descartes, `los candidatos del rol ${JSON.stringify(req?.tipo)}`);
  const vivo = (nombre) => !marcados.descartado(nombre);
  if (req.tipo === 'servicio') {
    return (mundo.settlements ?? []).flatMap((s) =>
      s.services
        .filter((v) => v.kind === req.kind && v.x != null && vivo(v.name))
        .map((v) => ({ tipo: 'servicio', kind: v.kind, nombre: v.name, x: v.x, y: v.y, en: s.name, real: v.real })),
    );
  }
  if (req.tipo === 'nucleo') {
    return (mundo.settlements ?? [])
      .filter((s) => req.types.includes(s.type) && vivo(s.name))
      .map((s) => ({ tipo: 'nucleo', kind: s.type, nombre: s.name, x: s.x, y: s.y, en: null, real: s.anchor }));
  }
  if (req.tipo === 'paraje') {
    const escenas = escenasDelRol(req);
    const pesoMinimo = req.minPeso ?? PESO_MINIMO_DE_ESCENA;
    return (mundo.parajes ?? [])
      .filter((p) => vivo(p.name) && escenas.some((e) => (p.scenes[e] ?? 0) >= pesoMinimo))
      .map((p) => ({
        tipo: 'paraje',
        kind: p.type,
        nombre: p.name,
        x: p.x,
        y: p.y,
        en: null,
        real: p.real,
        // Cuál de las escenas alternativas cubre este lugar: la aventura anota la
        // que se usó, porque de ella cuelga la variante de escena.
        escena: escenas.find((e) => (p.scenes[e] ?? 0) >= pesoMinimo),
      }));
  }
  throw new Error(`tipo de rol desconocido ${JSON.stringify(req.tipo)}: los declarados son ${TIPOS_DE_ROL.join(', ')}`);
}

/**
 * La resolución de un rol humano **sin estado de partida**: la identidad de la cara
 * que produce el sitio, que es función pura de `semilla + sitio + puesto`.
 *
 * Devuelve **siempre** una persona para un sitio dado, que es exactamente lo que
 * promete RF-NPC-002, y **hereda el anclaje del sitio**: un NPC no consume uno
 * propio (`game-design/npcs.md`). Por eso un rol humano no puede aportar nunca un
 * motivo de fallo, y por eso el catálogo de `motivos.js` no tiene ninguno que
 * hable de gente.
 *
 * Es la **por defecto** a propósito, y no despierta a nadie: castear una plantilla
 * que luego nadie acepta no puede poblar una partida. Quien juega inyecta la de su
 * capa (`creaCapaDeNpcs().resuelveRolHumano`), que sí apunta la cara como despierta.
 */
export function rolHumanoDelSitio({ sitio, rol, mundo, semilla = mundo?.seed }) {
  return caraDeSitio({ mundo, semilla, sitio, rol, idioma: namesFor(mundo?.locale) });
}

/**
 * El medidor de trechos: distancias **sobre el grafo cosido**, nunca en línea
 * recta con un factor de rodeo.
 *
 * Un trecho que no existe en el grafo es un trecho que nadie ha comprobado que se
 * pueda andar (`accesibilidad.md` §2, lo que nos inventamos no se promete), así que
 * devuelve `null` y la pareja no casa. Nada de respaldo por la recta.
 *
 * Los árboles de Dijkstra se memorizan por nodo de origen: los mundos son pequeños
 * en lugares pero el grafo tiene decenas de miles de aristas, y el backtracking
 * pregunta por la misma pareja muchas veces.
 */
export function medidorDeTrechos(grafo, criterios = []) {
  const viario = exigeGrafo(grafo);
  const activos = normalizaCriterios(criterios);
  const nodos = new Map();
  const arboles = new Map();

  const nodoDe = (p) => {
    const clave = `${p.x},${p.y}`;
    if (!nodos.has(clave)) nodos.set(clave, nodoMasCercano(viario, p, SNAP_MAX));
    return nodos.get(clave);
  };
  const arbolDe = (nodo) => {
    if (!arboles.has(nodo)) arboles.set(nodo, arbolDeCaminos(viario, nodo, activos));
    return arboles.get(nodo);
  };

  /** Los metros de grafo entre dos puntos, o `null` si no hay camino. */
  const metros = (a, b) => {
    const na = nodoDe(a), nb = nodoDe(b);
    if (na == null || nb == null) return null;
    if (na === nb) return 0;
    const coste = arbolDe(na).coste.get(nb);
    return coste === undefined ? null : coste[2];
  };

  /** Los tramos recorridos entre dos puntos, para el guiado. Solo se pide de lo ya aceptado. */
  const tramos = (a, b) => {
    const na = nodoDe(a), nb = nodoDe(b);
    if (na == null || nb == null || na === nb) return [];
    const camino = caminoDesdeArbol(arbolDe(na), nb);
    return camino ? tramosDelCamino(viario, camino) : [];
  };

  return { metros, tramos, criterios: activos };
}

/** El punto de partida, exigido y no supuesto. */
function exigePartida(partida) {
  if (!partida || !Number.isFinite(partida.x) || !Number.isFinite(partida.y)) {
    throw new Error(
      'falta el punto de partida de la salida: el casting no sabe dónde vive nadie ni consulta el GPS, lo recibe. ' +
      `Llegó ${JSON.stringify(partida)}`,
    );
  }
  return { x: partida.x, y: partida.y };
}

/**
 * Castea una plantilla contra un mundo.
 *
 * @param {object} peticion
 *   `mundo` el mundo ya generado, al que no se le toca ni un dato ni se le
 *   resiembra nada; `plantilla` la que se castea; `tramoM` el tramo de quien juega,
 *   del que cuelgan todos los topes; `partida` el punto de partida de la salida;
 *   `grafo` el viario cosido —por defecto el del mundo—; `criterios` los caminos
 *   que se evitan, que llegan inyectados; `franjaPermitida` el horario diurno, que
 *   llega **como franja** y viene activado de origen; `resuelveRolHumano` la capa
 *   de NPCs, doblada mientras no exista; `tenencia` la vista de solo lectura de los
 *   objetos de la partida (SPEC-015), que **solo decide por qué vía se atraviesa un
 *   beat `con_objeto`** y no toca ni el reparto ni el lazo: es la frontera de
 *   inyección entera de `progresion.md` —«que `castTemplate` reciba también el
 *   estado de la partida, sin que eso cambie los beats»—; `descartes` la vista de los
 *   sitios que quien juega marcó (SPEC-035), que sacan candidatos del reparto **sin
 *   resembrar nada**; `semilla` la del mundo si no se da otra.
 * @returns `{ ok: true, tpl, aventura, beats, ... }` o `{ ok: false, tpl, motivo }`
 *   con el motivo estructurado del catálogo cerrado.
 */
export function casteaPlantilla({
  mundo,
  plantilla,
  tramoM,
  partida,
  grafo = mundo?.viario,
  criterios = [],
  franjaPermitida = FRANJA_DIURNA,
  resuelveRolHumano = rolHumanoDelSitio,
  medidor = null,
  tenencia = SIN_OBJETOS,
  descartes = SIN_DESCARTES,
  semilla = mundo?.seed,
}) {
  const metrosPorTramo = exigeTramoM(tramoM, 'el casting de aventuras');
  const laTenencia = exigeTenencia(tenencia, 'el casting de aventuras');
  const losDescartes = exigeDescartes(descartes, 'el casting de aventuras');
  const desde = exigePartida(partida);
  const orden = validaPlantilla(plantilla);
  const medida = medidor ?? medidorDeTrechos(grafo, criterios);

  const enTramos = (metros) => metros / metrosPorTramo;
  const salida = dimensionaSalida(plantilla.tamano, metrosPorTramo);
  const rango = rangoDeBeats(plantilla.tamano);
  const roles = plantilla.roles;
  const beats = plantilla.beats;

  // El número de beats se comprueba antes que nada: no depende del mundo, así que
  // gastar un solo camino del grafo en una plantilla que no cabe sería trabajo
  // tirado, y el motivo sería el mismo en todos los mundos.
  if (beats.length < rango.minimo || beats.length > rango.maximo) {
    return fallo(plantilla, motivoDeCasting({
      clave: MOTIVOS_DE_CASTING.BEATS_FUERA_DEL_TAMANO,
      requisito: { tamano: plantilla.tamano, beats: beats.length, minimo: rango.minimo, maximo: rango.maximo },
    }));
  }

  // Las franjas tampoco dependen del mundo. Con el horario diurno activo, una
  // franja que cae fuera no se recorta —«al anochecer» a las cinco de la tarde no
  // es la misma escena— ni se ignora: la plantilla no se ofrece.
  for (const beat of beats) {
    if (beat.disparador.tipo !== 'franja') continue;
    const franja = franjaDe(beat.disparador.franja);
    if (franjaCabeEn(franja, franjaPermitida)) continue;
    return fallo(plantilla, motivoDeCasting({
      clave: MOTIVOS_DE_CASTING.FRANJA_INCOMPATIBLE,
      roles: [beat.rol],
      requisito: { franja: franja.id, desdeMin: franja.desdeMin, hastaMin: franja.hastaMin, permitida: { ...franjaPermitida } },
    }));
  }

  // El azar es **por plantilla**: añadir una al catálogo no puede cambiar el
  // reparto de las demás, que es lo que permitirá crecer a treinta sin resembrar
  // nada. El sufijo de fase es el de siempre.
  const rng = makeRng(semilla + SUFIJOS_DE_FASE.casting + ':' + plantilla.id);

  // Los roles humanos se resuelven **después** de los lugares y no consumen pool:
  // heredan el anclaje del sitio donde trabajan, así que nunca estrechan nada.
  const ordenDeLugares = orden.filter((rid) => roles[rid].tipo !== 'humano');
  const pools = {};
  for (const rid of ordenDeLugares) {
    const pool = candidatosDeRol(mundo, roles[rid], { descartes: losDescartes });
    if (!pool.length) {
      return fallo(plantilla, motivoDeCasting({
        clave: MOTIVOS_DE_CASTING.SIN_CANDIDATOS,
        roles: [rid],
        requisito: requisitoDeRol(roles[rid]),
      }));
    }
    pools[rid] = shuffle(rng, pool);
  }

  const topeTrecho = TOPE_DE_TRECHO_EN_TRAMOS * metrosPorTramo;
  const minimoTrecho = MINIMO_DE_TRECHO_EN_TRAMOS * metrosPorTramo;
  const cerca = CERCA_DE_LA_PARTIDA_EN_TRAMOS * metrosPorTramo;

  const asignacion = {};
  const lugaresTomados = new Set();
  const claveDeLugar = (c) => `${Math.round(c.x)},${Math.round(c.y)}`;

  // El motivo que se entrega si la búsqueda se agota: el del rechazo más profundo,
  // que es el que más cerca estuvo de casar. Es determinista porque el recorrido lo
  // es, y distingue «no hay candidatos» de «hay candidatos y no casan».
  let masProfundo = null;
  let profundidad = -1;
  const anota = (motivo, nivel) => {
    if (nivel > profundidad) { profundidad = nivel; masProfundo = motivo; }
    return motivo;
  };

  /**
   * Qué impide que este reparto —quizá parcial— sea un lazo andable. Devuelve el
   * motivo o null. Con el reparto incompleto solo comprueba lo que ya se puede
   * comprobar: los trechos entre beats cuyos dos roles están asignados.
   */
  const estorbo = (completo) => {
    const lugarDe = (i) => asignacion[beats[i].rol];

    // El lazo: empieza y termina cerca del punto de partida. Se comprueba en cuanto
    // el beat implicado tiene lugar, que es lo que poda antes.
    for (const i of [0, beats.length - 1]) {
      const lugar = lugarDe(i);
      if (!lugar) continue;
      const m = i === 0 ? medida.metros(desde, lugar) : medida.metros(lugar, desde);
      if (m == null) {
        return motivoDeCasting({
          clave: MOTIVOS_DE_CASTING.SIN_RUTA_EN_EL_GRAFO,
          roles: [beats[i].rol],
          requisito: { entre: 'punto-de-partida', rol: beats[i].rol },
        });
      }
      if (m > cerca) {
        return motivoDeCasting({
          clave: MOTIVOS_DE_CASTING.LAZO_QUE_NO_CIERRA,
          roles: [beats[i].rol],
          requisito: { extremo: i === 0 ? 'primer-beat' : 'ultimo-beat', topeEnTramos: CERCA_DE_LA_PARTIDA_EN_TRAMOS, enTramos: enTramos(m) },
        });
      }
    }

    for (let i = 0; i < beats.length - 1; i++) {
      const a = lugarDe(i), b = lugarDe(i + 1);
      if (!a || !b) continue;
      // Dos beats sobre el mismo rol son el mismo sitio: el trecho es cero y no hay
      // nada que medir. Es lo que hace que un lazo pueda volver a la taberna.
      if (beats[i].rol === beats[i + 1].rol) continue;
      const m = medida.metros(a, b);
      const par = [beats[i].rol, beats[i + 1].rol];
      if (m == null) {
        return motivoDeCasting({ clave: MOTIVOS_DE_CASTING.SIN_RUTA_EN_EL_GRAFO, roles: par, requisito: { entre: par } });
      }
      if (m > topeTrecho) {
        return motivoDeCasting({
          clave: MOTIVOS_DE_CASTING.TRECHO_FUERA_DEL_TOPE,
          roles: par,
          requisito: { topeEnTramos: TOPE_DE_TRECHO_EN_TRAMOS, enTramos: enTramos(m) },
        });
      }
      if (m < minimoTrecho) {
        return motivoDeCasting({
          clave: MOTIVOS_DE_CASTING.TRECHO_POR_DEBAJO_DEL_MINIMO,
          roles: par,
          requisito: { minimoEnTramos: MINIMO_DE_TRECHO_EN_TRAMOS, enTramos: enTramos(m) },
        });
      }
    }

    if (!completo) return null;

    const recorrido = recorridoDe(beats, asignacion, desde, medida);
    if (recorrido.metros > salida.metros) {
      return motivoDeCasting({
        clave: MOTIVOS_DE_CASTING.RECORRIDO_FUERA_DEL_TAMANO,
        roles: [beats[0].rol, beats[beats.length - 1].rol],
        requisito: { tamano: plantilla.tamano, alcanceEnTramos: salida.tramos, enTramos: enTramos(recorrido.metros) },
      });
    }
    return null;
  };

  const resuelve = (k) => {
    if (k === ordenDeLugares.length) {
      const motivo = estorbo(true);
      if (motivo == null) return true;
      anota(motivo, k);
      return false;
    }
    const rid = ordenDeLugares[k];
    for (const candidato of pools[rid]) {
      // Dos roles distintos nunca caen en el mismo lugar: un anclaje real alimenta
      // un elemento del mundo y un elemento del mundo alimenta un rol.
      const clave = claveDeLugar(candidato);
      if (lugaresTomados.has(clave)) continue;
      asignacion[rid] = candidato;
      lugaresTomados.add(clave);
      const motivo = estorbo(false);
      if (motivo) anota(motivo, k);
      else if (resuelve(k + 1)) return true;
      delete asignacion[rid];
      lugaresTomados.delete(clave);
    }
    return false;
  };

  if (!resuelve(0)) {
    return fallo(plantilla, masProfundo ?? motivoDeCasting({
      clave: MOTIVOS_DE_CASTING.SIN_CANDIDATOS,
      roles: [ordenDeLugares[0]],
      requisito: requisitoDeRol(roles[ordenDeLugares[0]]),
    }));
  }

  // Los roles humanos, ya con los sitios repartidos. Nunca fallan: si una plantilla
  // pide quien atiende la forja, la forja lo produce.
  for (const rid of orden) {
    if (roles[rid].tipo !== 'humano') continue;
    const sitio = asignacion[roles[rid].en];
    if (!sitio) throw new Error(`el rol humano "${rid}" de "${plantilla.id}" dice trabajar en "${roles[rid].en}", que no es un rol de sitio de esta plantilla`);
    asignacion[rid] = resuelveRolHumano({ sitio, rol: roles[rid], plantilla, mundo, semilla });
  }

  return exito({ plantilla, asignacion, beats, desde, medida, metrosPorTramo, salida, semilla, tenencia: laTenencia });
}

function recorridoDe(beats, asignacion, desde, medida) {
  const lugares = beats.map((b) => asignacion[b.rol]);
  const ida = medida.metros(desde, lugares[0]) ?? Infinity;
  const vuelta = medida.metros(lugares[lugares.length - 1], desde) ?? Infinity;
  const trechos = [];
  for (let i = 0; i < lugares.length - 1; i++) {
    trechos.push(beats[i].rol === beats[i + 1].rol ? 0 : (medida.metros(lugares[i], lugares[i + 1]) ?? Infinity));
  }
  // El recorrido incluye la ida y la vuelta: un lazo que se mide solo entre beats
  // esconde justo los dos trechos que decide el punto de partida.
  const metros = ida + vuelta + trechos.reduce((a, b) => a + b, 0);
  return { ida, vuelta, trechos, metros, masLargo: Math.max(ida, vuelta, ...trechos) };
}

function fallo(plantilla, motivo) {
  return congelaHondo({ ok: false, tpl: plantilla, plantilla: plantilla.id, motivo });
}

function exito({ plantilla, asignacion, beats, desde, medida, metrosPorTramo, salida, semilla, tenencia = SIN_OBJETOS }) {
  const recorrido = recorridoDe(beats, asignacion, desde, medida);
  const lugares = beats.map((b) => asignacion[b.rol]);

  const casteados = beats.map((beat, i) => {
    const anterior = i === 0 ? desde : lugares[i - 1];
    return beatCasteado({
      n: i + 1,
      plantillaBeat: beat,
      lugar: lugares[i],
      escenaDelLugar: lugares[i].escena ?? null,
      // El último no empuja a ninguno: eso es lo que cierra la cadena.
      siguiente: i === beats.length - 1 ? null : i + 2,
      tramos: anterior === lugares[i] ? [] : medida.tramos(anterior, lugares[i]),
      tenencia,
    });
  });

  const enTramos = (m) => m / metrosPorTramo;
  const presupuesto = {
    // El tamaño es el que **declaró** la plantilla, no uno deducido de lo que salió
    // al medir: deducirlo a posteriori es decidirlo con una fórmula.
    tamano: plantilla.tamano,
    enTramos: {
      recorrido: enTramos(recorrido.metros),
      trechoMasLargo: enTramos(recorrido.masLargo),
      ida: enTramos(recorrido.ida),
      vuelta: enTramos(recorrido.vuelta),
      alcance: salida.tramos,
      topeDeTrecho: TOPE_DE_TRECHO_EN_TRAMOS,
    },
    // Los metros van al lado como **dato del trazado**, no como unidad de la regla,
    // y no salen nunca a pantalla: esa frontera la guarda quien pinta.
    metros: { recorrido: recorrido.metros, trechoMasLargo: recorrido.masLargo, ida: recorrido.ida, vuelta: recorrido.vuelta },
    // La estimación es informativa y **ninguna regla bifurca por ella**: va en
    // tramos, que son medias horas al ritmo de quien juega, y no en minutos de un
    // ritmo inventado.
    estimacionEnTramos: enTramos(recorrido.metros),
  };

  const aventura = {
    id: `${plantilla.id}@${semilla}`,
    plantilla: plantilla.id,
    semilla,
    tamano: plantilla.tamano,
    titulo: plantilla.titulo,
    gancho: plantilla.gancho,
    // Quién la encarga y dónde: el primer beat, que es donde se recoge el encargo.
    dador: { rol: beats[0].rol, lugar: lugares[0] },
    beats: casteados,
    presupuesto,
  };

  return congelaHondo({
    ok: true,
    tpl: plantilla,
    plantilla: plantilla.id,
    aventura,
    // La cadena y el reparto también sueltos: es lo que ya consumían la lista de
    // aventuras y el trazado del lazo, y moverlos de sitio no aporta nada.
    beats: casteados,
    asignacion,
    presupuesto,
  });
}

/**
 * Castea un catálogo entero. Devuelve **una entrada por plantilla**, castee o no:
 * la que no castea trae su motivo, y ninguna se omite de la lista, porque el
 * histograma de fallos es la mitad de lo que este módulo entrega.
 *
 * El medidor se comparte entre plantillas —los árboles de caminos son del grafo, no
 * de la plantilla—, y el azar no: cada una siembra el suyo, así que castear una
 * sola da el mismo reparto que castear el catálogo entero, y recibirlo en otro
 * orden no cambia nada.
 */
export function casteaCatalogo({ catalogo = CATALOGO, mundo, grafo = mundo?.viario, criterios = [], ...resto }) {
  const lista = catalogo ?? [];
  if (!lista.length) return [];
  const medidor = medidorDeTrechos(grafo, criterios);
  return lista.map((plantilla) => casteaPlantilla({ ...resto, mundo, grafo, criterios, medidor, plantilla }));
}

/**
 * El encuadre con el que se castea un mundo: el tramo y el punto de partida.
 *
 * Viaja **con el mundo** por la misma razón que `mundo.casting`: quien recompone el
 * casting sobre un mundo levantado tiene que poder hacerlo sin volver a decidir
 * desde dónde se mide. Y se exige: sin él, la llamada falla nombrando la
 * dependencia que falta en vez de suponer el centro de la celda.
 */
export function exigeEncuadre(mundo) {
  const encuadre = mundo?.casteo;
  if (!encuadre || !Number.isFinite(encuadre.tramoM) || !encuadre.partida) {
    throw new Error(
      'el mundo no declara con qué encuadre se castea (`mundo.casteo`): hacen falta el tramo y el punto de partida, ' +
      `y llegó ${JSON.stringify(encuadre)}`,
    );
  }
  return encuadre;
}

/**
 * Castea una plantilla contra un mundo con el encuadre que el mundo declara.
 *
 * `tenencia` es lo único que el estado de la partida aporta aquí, y por eso entra
 * como opción y no como estado entero: con objetos y sin ninguno el reparto es el
 * mismo, y lo único que cambia es por qué vía se atraviesa un beat `con_objeto`.
 */
export function castTemplate(mundo, plantilla, semilla = mundo.seed, { tenencia = SIN_OBJETOS, descartes = SIN_DESCARTES } = {}) {
  return casteaPlantilla({ ...exigeEncuadre(mundo), mundo, plantilla, semilla, tenencia, descartes });
}

/**
 * Castea el catálogo contra un mundo, con su encuadre.
 *
 * Volver a llamarla con un descarte más es barato y **no toca nada del mundo**: SPEC-009
 * dejó el casting fuera del documento congelado, y por eso «anota sin resembrar» es
 * literal en lugar de aproximado.
 */
export function castAll(mundo, semilla = mundo.seed, { tenencia = SIN_OBJETOS, descartes = SIN_DESCARTES } = {}) {
  return casteaCatalogo({ ...exigeEncuadre(mundo), mundo, catalogo: CATALOGO, semilla, tenencia, descartes });
}
