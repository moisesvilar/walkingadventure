// El sitio que no pega: **quien camina puede decir que un sitio no vale**, con dos
// toques, sin dar motivo y sin que eso salga del móvil
// (`game-design/seguridad-privacidad.md` §3, RF-PRIV-004).
//
// Lo que decide la forma de todo este módulo es una regla que parece pequeña y no lo
// es: **anotar no es resembrar**. El sitio conserva su nombre y su posición, el mapa
// se sigue dibujando entero y el documento de la celda no cambia ni un byte. Lo único
// que cambia es que ese anclaje **deja de recibir casting**, y por eso el descarte
// entra en `quests/casting.js` y no en el pool ni en la generación: el `excluir` del
// pool actúa **mientras la celda se genera** y esto actúa **después de que esté
// congelada**. Son dos momentos y no se unifican, porque unificarlos obligaría a
// reabrir el pool de una celda ya cerrada.
//
// Tres cosas que este módulo no hace, y ninguna es un olvido:
//
//   · **No sale nada de aquí a ningún sitio.** No hay una llamada al proxy, ni al
//     almacén remoto, ni nada que salga del dispositivo: RF-PRIV-004 no prohíbe
//     guardarlos —viajan dentro de la copia de la partida, que es de quien juega—,
//     prohíbe reportarlos. Aquí no hay a quién.
//   · **Ningún motivo lleva texto libre, ni siquiera «Otra cosa».** Un campo libre
//     invita a escribir datos de personas reales del barrio dentro de la partida, y
//     ese texto acabaría en la copia exportable.
//   · **No se lee el reloj.** El día y el paso del hecho llegan inyectados, igual que
//     en el resto de la partida.
//
// Y entrega la contrapartida, que es lo que evita que la salvaguarda se convierta en
// una manera de vaciar el mundo: **la alarma de estirón**, que se comprueba contra el
// suelo de parajes **leído de la celda** y no contra «ninguna aventura cabe». Esa
// segunda condición no se cumple nunca en un mundo grande, así que no mediría nada
// (`pipeline/decisiones-orquestador.md` §6o); el suelo sí se cruza en un descarte
// concreto y se puede poner rojo por los dos lados.

import { congelaHondo } from '../core/congelar.js';
import { anexa, hecho } from './hechos.js';
import { exigeMapaId } from './pasos.js';
import { TRAMOS_DEL_ESTIRON } from './salida.js';
import { referenteReal, rotuloDeTipo, sitiosDelMundo } from './visor.js';

// --- El vocabulario cerrado de motivos ----------------------------------------------

/**
 * Los cinco motivos, **en el orden literal en que los dibuja el artefacto 4**, y ni uno
 * más.
 *
 * Cerrado por dos razones distintas: el artefacto los dibuja literales, y
 * `seguridad-privacidad.md` §1 impide guardar texto libre que pueda hablar de personas
 * reales. Se puede elegir **uno como mucho** y **ninguno es obligatorio**: los motivos
 * no alimentan ninguna mecánica —el efecto sobre el casting es el mismo con motivo y
 * sin él—, así que pedir más precisión sería pedirla para nada.
 */
export const MOTIVOS_DE_DESCARTE = congelaHondo([
  { id: 'casa-particular', texto: 'Es una casa particular' },
  { id: 'no-se-llega-a-pie', texto: 'No se puede llegar a pie' },
  { id: 'no-es-sitio-para-pararse', texto: 'No es sitio para pararse' },
  { id: 'ya-no-existe', texto: 'Ya no existe' },
  { id: 'otra-cosa', texto: 'Otra cosa' },
]);

/** Los identificadores de motivo, en el orden del catálogo. Lista cerrada. */
export const IDS_DE_MOTIVO = congelaHondo(MOTIVOS_DE_DESCARTE.map((m) => m.id));

/**
 * Los campos que un motivo **no lleva**, declarados para poder afirmar la ausencia.
 *
 * «Otra cosa» está en el catálogo y tampoco lleva ninguno: es el motivo que más
 * invitaría a abrir un campo de texto, y por eso se nombra aquí.
 */
export const LO_QUE_UN_MOTIVO_NO_LLEVA = congelaHondo(['texto', 'detalle', 'comentario', 'otro', 'porque']);

/**
 * Un motivo del vocabulario, o `null`. Cualquier otra cosa **falla nombrando el motivo
 * y enumerando los válidos**.
 *
 * Un motivo que no sea una cadena falla igual, y ese caso es el que cierra la puerta al
 * texto libre: `{ id: 'otra-cosa', texto: '...' }` no entra por aquí.
 */
export function exigeMotivo(motivo, quien = 'el descarte de un anclaje') {
  if (motivo == null) return null;
  if (typeof motivo !== 'string' || !IDS_DE_MOTIVO.includes(motivo)) {
    throw new Error(
      `${quien} anota el motivo ${JSON.stringify(motivo) ?? String(motivo)}, que no está en el vocabulario cerrado: ` +
      `los cinco declarados son ${IDS_DE_MOTIVO.join(', ')}, y ninguno lleva texto libre asociado`,
    );
  }
  return motivo;
}

/** El motivo con su texto dibujado, o `null` si no se eligió ninguno. */
export function motivoDe(id) {
  return MOTIVOS_DE_DESCARTE.find((m) => m.id === exigeMotivo(id)) ?? null;
}

// --- Los textos de A4P8 y de la lista de ajustes -------------------------------------

/**
 * Todo lo que esta capa escribe.
 *
 * La línea que quita la obligación va **antes** de los motivos y no después: es lo que
 * convierte la lista en una ayuda en lugar de en un formulario. Y no hay ninguna línea
 * de gracias ni de confirmación detrás de «Marcarlo»: la capa se cierra y que la acción
 * ya no esté disponible es toda la confirmación que hace falta.
 */
export const TEXTOS_DE_DESCARTE = congelaHondo({
  pregunta: '¿Qué le pasa a este sitio?',
  sinObligacion: 'No hace falta que digas por qué. Con marcarlo, el juego deja de mandarte aquí.',
  reversibilidad: 'Se puede deshacer cuando quieras.',
  confirmar: 'Marcarlo',
  filaDeAjustes: 'Sitios que marcaste',
  deshacer: 'Que vuelva a contar',
  // Registro de aplicación, como todo lo de ajustes: aquí no habla el mundo.
  ninguno: 'Todavía no has marcado ninguno.',
});

// --- El estado del área `anclajes` ---------------------------------------------------
//
// Por mapa, la lista de identificadores descartados con su motivo, en orden estable. Es
// del mapa y no de la partida: dos mapas de la misma partida no comparten descartes,
// porque no comparten sitios.

/** El área de descartes de una partida recién creada: ningún mapa y ningún descarte. */
export function estadoDeDescartes() {
  return { mapas: {} };
}

function exigeArea(estado) {
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el área de descartes llega mal formada: se espera lo que devuelve estadoDeDescartes(), un objeto con "mapas"');
  }
  return estado;
}

// El orden es el del identificador y **nunca el de llegada**: dos partidas con los
// mismos descartes anotados en distinto orden tienen que escribirse igual.
const porAnclaje = (a, b) => (a.anclaje < b.anclaje ? -1 : a.anclaje > b.anclaje ? 1 : 0);

function exigeAnclaje(anclaje, quien = 'un descarte') {
  if (typeof anclaje !== 'string' || !anclaje) {
    throw new Error(
      `${quien} se anota por el identificador del sitio y llegó ${JSON.stringify(anclaje) ?? String(anclaje)}: ` +
      'nunca por su coordenada',
    );
  }
  return anclaje;
}

function listaDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'el área de descartes');
  exigeArea(estado);
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) estado.mapas[id] = [];
  return estado.mapas[id];
}

/** Los descartes de un mapa, en orden estable y sin poder tocarlos. */
export function descartesDeMapa(estado, mapaId) {
  return congelaHondo(listaDeMapa(estado, mapaId).slice().sort(porAnclaje).map((d) => ({ ...d })));
}

/** Si un anclaje está descartado en un mapa. */
export function estaDescartado(estado, { mapaId, anclaje }) {
  return listaDeMapa(estado, mapaId).some((d) => d.anclaje === anclaje);
}

/**
 * Anota un descarte. Descartar dos veces el mismo sitio **no cambia nada y no anota un
 * segundo hecho**: devuelve `{ anotado: false }` y quien llama no emite nada.
 */
export function anotaDescarte(estado, { mapaId, anclaje, rol = null, porque = null }) {
  const id = exigeAnclaje(anclaje, 'un descarte');
  const lista = listaDeMapa(estado, mapaId);
  if (lista.some((d) => d.anclaje === id)) return congelaHondo({ anotado: false, yaEstaba: true });
  lista.push({ anclaje: id, rol: rol ?? null, porque: exigeMotivo(porque) });
  lista.sort(porAnclaje);
  return congelaHondo({ anotado: true, yaEstaba: false });
}

/** Deshace un descarte. Deshacer lo que no estaba devuelve `{ deshecho: false }`. */
export function quitaDescarte(estado, { mapaId, anclaje }) {
  const id = exigeAnclaje(anclaje, 'el deshacer de un descarte');
  const lista = listaDeMapa(estado, mapaId);
  const i = lista.findIndex((d) => d.anclaje === id);
  if (i < 0) return congelaHondo({ deshecho: false, estaba: false });
  const [fuera] = lista.splice(i, 1);
  return congelaHondo({ deshecho: true, estaba: true, rol: fuera.rol ?? null, porque: fuera.porque ?? null });
}

/** El área en forma serializable, por mapa y por identificador. */
export function congelaDescartes(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(exigeArea(estado).mapas).sort()) {
    mapas[mapaId] = estado.mapas[mapaId]
      .slice()
      .sort(porAnclaje)
      .map((d) => ({ anclaje: d.anclaje, rol: d.rol ?? null, porque: d.porque ?? null }));
  }
  return { mapas };
}

/**
 * El área de vuelta de su documento.
 *
 * Un motivo guardado que ya no está en el vocabulario **falla nombrándolo** en lugar de
 * volver como `null`: el vocabulario es cerrado, y un motivo que desaparece es un cambio
 * de reglas que hay que ver, no un campo que se pierde por el camino.
 */
export function levantaDescartes(doc) {
  const estado = estadoDeDescartes();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const guardados = doc.mapas[mapaId] ?? [];
    estado.mapas[mapaId] = guardados
      .map((d) => ({
        anclaje: exigeAnclaje(d?.anclaje, `un descarte guardado del mapa ${mapaId}`),
        rol: d?.rol ?? null,
        porque: exigeMotivo(d?.porque ?? null, `el descarte guardado de "${d?.anclaje}"`),
      }))
      .sort(porAnclaje);
  }
  return estado;
}

// --- La vista que consume el casting -------------------------------------------------

/**
 * La vista de «no hay ninguno», explícita.
 *
 * Se declara igual que `SIN_OBJETOS`: el casting de un mundo sin partida detrás —el
 * informe de salud del generador, las pruebas de generación— no tiene descartes que
 * consultar, y eso es un caso normal. Lo que no es normal es llegar con `null`, que es
 * lo que `exigeDescartes` corta.
 */
export const SIN_DESCARTES = congelaHondo({ descartado: () => false, cuantos: () => 0, lista: () => [] });

/** La vista de descartes, exigida. Una mal formada falla nombrando lo que llegó. */
export function exigeDescartes(descartes, quien = 'el casting de aventuras') {
  if (!descartes || typeof descartes.descartado !== 'function') {
    throw new Error(
      `${quien} necesita la vista de descartes del mapa (vistaDeDescartes(estado, mapaId)) o SIN_DESCARTES: ` +
      `llegó ${JSON.stringify(descartes) ?? String(descartes)}. Sin ella devolvería candidatos que quien juega ya marcó`,
    );
  }
  return descartes;
}

/**
 * La vista de solo lectura de los descartes de un mapa.
 *
 * Es una **instantánea**: se toma al montarla, así que castear el catálogo entero ve el
 * mismo conjunto de descartes de la primera plantilla a la última.
 */
export function vistaDeDescartes(estado, mapaId) {
  const lista = descartesDeMapa(estado, mapaId);
  const marcados = new Set(lista.map((d) => d.anclaje));
  return congelaHondo({
    descartado: (anclaje) => typeof anclaje === 'string' && marcados.has(anclaje),
    cuantos: () => marcados.size,
    lista: () => lista,
  });
}

/** Si una vista de descartes tiene alguno. Lo usa quien decide si hace falta recastear. */
export function hayDescartes(descartes) {
  return exigeDescartes(descartes, 'la comprobación de si hay descartes').cuantos() > 0;
}

// --- La alarma de estirón ------------------------------------------------------------

/**
 * El suelo de parajes **de la celda**, exigido y no recalculado.
 *
 * Lo derivó SPEC-006 del vocabulario de escenas y lo congeló en el cupo de la celda; si
 * algún día el vocabulario crece, un mundo viejo sigue comparándose contra el suelo con
 * el que se generó. Recalcularlo haría que un mapa antiguo cruzara la alarma sin que
 * nadie hubiera descartado nada.
 *
 * Sin el cupo cableado **falla nombrándolo** en vez de dar el suelo por cero, que es la
 * degradación silenciosa de §6h: con suelo cero la alarma no saltaría jamás.
 */
export function exigeSueloDeParajes(cupos, quien = 'la alarma de estirón') {
  const suelo = cupos?.parajes?.suelo;
  if (!Number.isInteger(suelo) || suelo < 0) {
    throw new Error(
      `${quien} necesita el cupo que la celda congeló al generarse (cupos.parajes.suelo) y llegó ` +
      `${JSON.stringify(suelo) ?? String(suelo)}: el suelo se lee de la celda y no se vuelve a calcular, ` +
      'y darlo por cero dejaría la alarma sin poder saltar nunca',
    );
  }
  return suelo;
}

/**
 * La alarma: **salta exactamente al cruzar el suelo**, ni antes ni después.
 *
 * Es un dato y no una acción. Nada se amplía por devolverlo, el alcance de la salida
 * sigue siendo el mismo si nadie acepta, y quien decide es quien juega
 * (`bucle-jugable.md` §7). Y lo que se ofrece es **el estirón que ya existe**, con su
 * mismo número de tramos: aquí no nace un mecanismo nuevo, nace una causa nueva.
 */
export function alarmaDeEstiron({ mundo, cupos, descartes, alcanceEnTramos = null }) {
  const suelo = exigeSueloDeParajes(cupos);
  const vista = exigeDescartes(descartes, 'la alarma de estirón');
  if (!mundo || !Array.isArray(mundo.parajes)) {
    throw new Error(
      `la alarma de estirón cuenta los parajes vivos del mundo congelado y llegó ${JSON.stringify(mundo?.parajes) ?? String(mundo)}: ` +
      'sin ellos no hay nada que comparar contra el suelo',
    );
  }
  const vivos = mundo.parajes.filter((p) => !vista.descartado(p.name)).length;
  const salta = vivos < suelo;
  return congelaHondo({
    salta,
    parajesVivos: vivos,
    parajes: mundo.parajes.length,
    suelo,
    // El texto **no menciona los descartes** ni insinúa que nadie se haya pasado
    // marcando sitios: es la misma oferta que cuando el mundo no da para un lazo, y
    // decir «has marcado demasiados» sería un reproche con datos.
    estiron: salta
      ? {
        tramosMas: TRAMOS_DEL_ESTIRON,
        alcanceEnTramos: Number.isFinite(alcanceEnTramos) ? alcanceEnTramos + TRAMOS_DEL_ESTIRON : null,
        aceptado: false,
        impuesto: false,
      }
      : null,
  });
}

// --- Los hechos ----------------------------------------------------------------------
//
// SPEC-016 declaró `anclaje-descartado` esperando esta fila. El deshacer es **una
// transición más y no un borrado del registro**: el hecho del descarte se queda y se le
// anota el deshacer detrás, porque el registro es la bitácora de lo que pasó y no el
// estado —y borrar hechos, además, es la única operación que el registro no tiene.

/** El hecho de un descarte: el sitio, el rol que ocupaba, el motivo si lo hubo, y ninguna coordenada. */
export function hechoDeDescarte({ mapaId, anclaje, rol = null, porque = null, dia, paso }) {
  return hecho({ tipo: 'anclaje-descartado', mapa: mapaId, dia, paso, carga: { anclaje, rol, porque } });
}

/** El hecho del deshacer, que va detrás del descarte y no en su lugar. */
export function hechoDeDevolucion({ mapaId, anclaje, rol = null, dia, paso }) {
  return hecho({ tipo: 'anclaje-devuelto', mapa: mapaId, dia, paso, carga: { anclaje, rol } });
}

// --- La capa -------------------------------------------------------------------------

function exigeMundo(mundo) {
  if (!mundo || typeof mundo !== 'object') {
    throw new Error(`la capa de descartes se monta sobre el mundo congelado del mapa y llegó ${JSON.stringify(mundo) ?? String(mundo)}`);
  }
  return mundo;
}

// El punto de partida llega como el encuadre del mundo lo declara —un punto en metros—
// o como el nombre de un sitio. Se admiten los dos porque la salida se abre desde una
// coordenada y la pantalla habla de sitios.
function esElPuntoDePartida(sitio, punto, posicion) {
  if (punto == null) return false;
  if (typeof punto === 'string') return punto === sitio.nombre;
  if (!Number.isFinite(punto.x) || !Number.isFinite(punto.y) || !posicion) return false;
  return Math.round(punto.x) === Math.round(posicion.x) && Math.round(punto.y) === Math.round(posicion.y);
}

function posicionDe(mundo, nombre) {
  for (const s of mundo.settlements ?? []) {
    if (s.name === nombre) return { x: s.x, y: s.y };
    for (const v of s.services ?? []) if (v.name === nombre) return { x: v.x, y: v.y };
  }
  for (const p of mundo.parajes ?? []) if (p.name === nombre) return { x: p.x, y: p.y };
  return null;
}

/**
 * Monta la capa del descarte sobre un mundo congelado y el área de la partida.
 *
 * @param {object} piezas
 *   `mundo` el mundo congelado del mapa activo; `cupos` los de su celda, de donde se lee
 *   el suelo de parajes; `estado` el área `anclajes` de la partida; `mapaId` el mapa —el
 *   descarte es del mapa y no de la partida—; `registro` el de hechos, donde se anexan
 *   el descarte y su deshacer; `puntoDePartida` el sitio o el punto desde el que se sale,
 *   que **no se puede descartar** y que por defecto es el que el mundo declara en su
 *   encuadre.
 */
export function creaCapaDeDescartes({ mundo, cupos, estado, mapaId, registro = null, puntoDePartida = undefined }) {
  exigeMundo(mundo);
  exigeSueloDeParajes(cupos, 'la capa de descartes');
  const id = exigeMapaId(mapaId, 'la capa de descartes');
  exigeArea(estado);
  const sitios = sitiosDelMundo(mundo);
  const partida = puntoDePartida === undefined ? mundo?.casteo?.partida ?? null : puntoDePartida;

  const sitioDe = (anclaje) => {
    const nombre = exigeAnclaje(anclaje, 'el descarte de un anclaje');
    const sitio = sitios.get(nombre);
    if (!sitio) {
      throw new Error(
        `"${nombre}" no es ningún sitio de este mundo, así que no hay nada que marcar: ` +
        'anotar un descarte que no afecta a nada dejaría a quien juega creyendo que ha marcado algo',
      );
    }
    return sitio;
  };

  const anexaSiHay = (h) => {
    if (!registro) return null;
    anexa(registro, [h]);
    return h;
  };

  const capa = {
    /** El sitio del mundo por su identificador, con su rol y su lado real. */
    sitio: sitioDe,

    /** La vista de solo lectura que consumen el casting y el reparto. */
    vista() {
      return vistaDeDescartes(estado, id);
    },

    /** Los descartes de este mapa, en orden estable. */
    lista() {
      return descartesDeMapa(estado, id);
    },

    /** La alarma tal como está ahora mismo. */
    alarma(alcanceEnTramos = null) {
      return alarmaDeEstiron({ mundo, cupos, descartes: capa.vista(), alcanceEnTramos });
    },

    /**
     * La capa de A4P8 sobre un sitio: **lo que se enseña antes del segundo toque**.
     *
     * Ninguna opción viene marcada y no hay campo de texto en ninguna. Cerrarla sin
     * pulsar «Marcarlo» descarta la elección y no marca nada: el que escribe es el
     * segundo toque, y guardar la intención a medias sería marcar sin haberlo dicho.
     */
    capaDe(anclaje) {
      const sitio = sitioDe(anclaje);
      return congelaHondo({
        sitio: sitio.nombre,
        nombre: sitio.nombre,
        pregunta: TEXTOS_DE_DESCARTE.pregunta,
        sinObligacion: TEXTOS_DE_DESCARTE.sinObligacion,
        motivos: MOTIVOS_DE_DESCARTE.map((m) => ({ id: m.id, texto: m.texto, marcado: false })),
        reversibilidad: TEXTOS_DE_DESCARTE.reversibilidad,
        confirmar: TEXTOS_DE_DESCARTE.confirmar,
        // Ni diálogo de confirmación detrás ni línea de gracias delante: el gesto son
        // dos toques y ninguno más.
        confirmacion: null,
        yaMarcado: estaDescartado(estado, { mapaId: id, anclaje: sitio.nombre }),
      });
    },

    /**
     * La lista de «Sitios que marcaste» de A6P6: una fila por sitio, con su nombre de
     * fantasía y, debajo, qué es en realidad. Sin motivo, sin fecha, sin agrupación y
     * sin buscador — y con cero marcados, el número cero y una línea que lo dice.
     */
    sitiosMarcados() {
      const filas = capa.lista().map((d) => {
        const sitio = sitios.get(d.anclaje) ?? null;
        const referente = sitio ? referenteReal(sitio) : null;
        return {
          anclaje: d.anclaje,
          nombre: sitio?.nombre ?? d.anclaje,
          tipo: sitio ? rotuloDeTipo(sitio) : null,
          enRealidad: referente ? referente.deQue : null,
          deshacer: TEXTOS_DE_DESCARTE.deshacer,
        };
      });
      return congelaHondo({
        etiqueta: TEXTOS_DE_DESCARTE.filaDeAjustes,
        cuantos: filas.length,
        filas,
        ninguno: filas.length ? null : TEXTOS_DE_DESCARTE.ninguno,
      });
    },

    /**
     * Marcar un sitio: el segundo toque del gesto.
     *
     * El punto de partida **no se puede descartar**: la salida se cierra al volver a él
     * (`bucle-jugable.md` §8), y descartarlo dejaría el telón sin condición de cierre.
     * Marcarlo dos veces no cambia nada y no anota un segundo hecho.
     */
    descarta({ anclaje, porque = null, dia, paso }) {
      const sitio = sitioDe(anclaje);
      const motivo = exigeMotivo(porque, `el descarte de "${sitio.nombre}"`);
      if (esElPuntoDePartida(sitio, partida, posicionDe(mundo, sitio.nombre))) {
        throw new Error(
          `"${sitio.nombre}" es el punto de partida de este mapa y no se puede marcar: ` +
          'la salida se cierra al volver a él, y descartarlo dejaría la partida sin sitio desde el que salir',
        );
      }
      const antes = capa.alarma();
      const anotado = anotaDescarte(estado, { mapaId: id, anclaje: sitio.nombre, rol: sitio.rol, porque: motivo });
      if (!anotado.anotado) {
        return congelaHondo({ anotado: false, yaEstaba: true, sitio: sitio.nombre, rol: sitio.rol, porque: motivo, hecho: null, alarma: antes, cruzaElSuelo: false });
      }
      const h = anexaSiHay(hechoDeDescarte({ mapaId: id, anclaje: sitio.nombre, rol: sitio.rol, porque: motivo, dia, paso }));
      const despues = capa.alarma();
      return congelaHondo({
        anotado: true,
        yaEstaba: false,
        sitio: sitio.nombre,
        rol: sitio.rol,
        porque: motivo,
        hecho: h,
        alarma: despues,
        // Que la alarma haya saltado **en este descarte** y no en el anterior.
        cruzaElSuelo: despues.salta && !antes.salta,
      });
    },

    /**
     * Deshacer, que vive en ajustes y no en el sitio: deshacerlo desde el sitio
     * obligaría a volver a andar hasta allí, y ese es el único coste que este juego no
     * puede cobrar por un cambio de opinión. No se pide motivo para deshacer.
     */
    deshaz({ anclaje, dia, paso }) {
      const nombre = exigeAnclaje(anclaje, 'el deshacer de un descarte');
      const quitado = quitaDescarte(estado, { mapaId: id, anclaje: nombre });
      if (!quitado.deshecho) {
        return congelaHondo({ deshecho: false, estaba: false, sitio: nombre, hecho: null, alarma: capa.alarma() });
      }
      const h = anexaSiHay(hechoDeDevolucion({ mapaId: id, anclaje: nombre, rol: quitado.rol, dia, paso }));
      return congelaHondo({ deshecho: true, estaba: true, sitio: nombre, hecho: h, alarma: capa.alarma() });
    },
  };

  return capa;
}
