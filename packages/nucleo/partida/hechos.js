// El registro de hechos de la partida: el catálogo cerrado de lo que deja rastro,
// declarado por área, la forma de un hecho, el anexado atómico y el orden estable
// dentro de un paso.
//
// Es la red de seguridad de `partida-guardada.md` §2 —«el estado es la verdad; el
// registro es auditoría y reconstrucción de emergencia»—, así que **solo crece**:
// aquí no hay ninguna operación que reescriba ni que borre un hecho ya anexado, y
// eso no es una convención sino la ausencia deliberada de la función que lo haría.
//
// Y el momento de un hecho es **el día de diario y el paso del mundo**, jamás una
// marca del reloj real: es lo único que hace la partida comparable byte a byte y
// reproducible en `node --test`, y una fecha real sería un dato sobre la vida de
// quien juega que el juego no necesita para nada.

import { congelaHondo } from '../core/congelar.js';
import {
  CLASES,
  VALOR_INERTE,
  VERSION_FORMATO,
  VERSION_GENERADOR,
  campos,
  declaraEsquema,
  escribe,
  lista,
  sinRastroDeUbicacion,
  uno,
} from './formato.js';
import { exigeMapaId } from './pasos.js';

/**
 * Los hechos estructurados de un rumor, tal como los deja SPEC-012.
 *
 * Vive aquí y no en `deformacion.js` porque es un esquema de documento y aquel
 * módulo no conoce el formato; se exporta porque lo citan tres áreas del estado y la
 * carga del hecho del diario, y copiarlo cuatro veces era garantizar que se
 * desincronizara.
 */
export const ESQUEMA_HECHOS_DE_RUMOR = campos({
  asunto: 'texto',
  escala: campos({ veces: 'entero' }),
  protagonista: campos({ tipo: 'texto', ref: VALOR_INERTE }),
  // Los tres detalles los declara la plantilla y este módulo no los interpreta: lo
  // que se exige es que sean inertes, no que sean texto.
  detalle: campos({ con: VALOR_INERTE, lugar: VALOR_INERTE, motivo: VALOR_INERTE }),
  trastocado: 'texto?',
  fundidoCon: 'texto?',
});

/**
 * La procedencia de un objeto persistente, tal como la deja la fila 15.
 *
 * Vive aquí por el mismo motivo que la de arriba —es esquema de documento y
 * `objetos.js` no conoce el formato— y se exporta porque la citan el área de objetos
 * del estado y la carga de `objeto-obtenido`, que son las dos caras del mismo dato:
 * declararla dos veces es cómo el registro y el estado dejarían de decir lo mismo.
 */
export const ESQUEMA_PROCEDENCIA_DE_OBJETO = uno(['nulo', campos({ desenlace: 'texto?', plantilla: 'texto?', lugar: 'texto?' })]);

// --- El catálogo, declarado por área ----------------------------------------
//
// La alternativa —enumerar aquí los campos de todos los hechos de todas las filas—
// haría que cada fila posterior tuviera que iterar esta spec para caber. Con el
// catálogo por área, la fila 19 añade sus dos tipos y no renegocia nada.

const CATALOGO = {};
const TIPOS_POR_AREA = {};

/**
 * Declara los tipos de hecho de un área, con el esquema de la carga de cada uno.
 *
 * Dos áreas no pueden declarar el mismo tipo, y **dos cargas no pueden tener el
 * mismo juego de campos**: el documento del registro escribe la carga por unión de
 * formas, así que dos formas indistinguibles se escribirían la una por la otra sin
 * que nada se pusiera rojo. Es barato comprobarlo al cargar el módulo y cierra la
 * puerta por la que el fallo entraría de verdad, que es un tipo añadido con prisa.
 */
export function declaraTiposDeHecho(area, tipos) {
  if (typeof area !== 'string' || !area) {
    throw new Error(`los tipos de hecho se declaran por área y el área llegó como ${JSON.stringify(area) ?? String(area)}`);
  }
  for (const [tipo, carga] of Object.entries(tipos)) {
    if (CATALOGO[tipo]) {
      throw new Error(`el tipo de hecho "${tipo}" ya está declarado por el área "${CATALOGO[tipo].area}": dos áreas que declaren el mismo tipo se pisarían al reproducir el registro`);
    }
    const firma = Object.keys(carga?.mapa ?? {}).slice().sort().join('|');
    for (const otro of Object.keys(CATALOGO)) {
      if (CATALOGO[otro].firma === firma) {
        throw new Error(
          `la carga del hecho "${tipo}" tiene los mismos campos que la de "${otro}" (${firma || '(ninguno)'}): ` +
          'el documento del registro las escribiría la una por la otra, así que un tipo nuevo necesita al menos un campo que lo distinga',
        );
      }
    }
    CATALOGO[tipo] = { area, carga, firma };
    if (!TIPOS_POR_AREA[area]) TIPOS_POR_AREA[area] = [];
    TIPOS_POR_AREA[area].push(tipo);
  }
  return tipos;
}

// La lista de `partida-guardada.md` §2 al completo, más uno que aquel documento no
// nombra: **la versión oída en un sitio**. Sin él, «el registro basta para
// reconstruir» sería falso justo para «lo oído», que es una de las cuatro cosas que
// el escenario exige recuperar, y reconstruirlo reproduciendo la propagación lo
// haría depender de que las reglas de deformación no hubieran cambiado — que es
// exactamente lo que una reconstrucción no puede prometer.

declaraTiposDeHecho('pasos', {
  'paso-ejecutado': campos({ n: 'entero', restoM: 'numero', restoFondoM: 'numero' }),
});

declaraTiposDeHecho('sitios', {
  // El identificador de un sitio del mundo congelado y el momento, **nunca una
  // coordenada y nunca el camino entre dos sitios**. Lo que RF-PRIV-002 prohíbe es
  // el histórico de posiciones; esto es un pueblo por su nombre y un día.
  'sitio-pisado': campos({ sitio: 'texto' }),
});

declaraTiposDeHecho('npcs', {
  'cara-conocida': campos({ sitio: 'texto', puesto: 'texto' }),
});

declaraTiposDeHecho('objetos', {
  // `diaDeRepisa` es el día con el que la fila 15 enseña un objeto. Es del mismo
  // calendario que el `dia` del hecho —día de partida, entero no negativo, nunca una
  // marca del reloj— y se sigue nombrando distinto a propósito: son dos datos que
  // pueden no coincidir, y compartir nombre invitaría a derivar uno del otro.
  'objeto-obtenido': campos({ id: 'texto', clase: 'texto', procedencia: ESQUEMA_PROCEDENCIA_DE_OBJETO, diaDeRepisa: 'entero' }),
});

declaraTiposDeHecho('diario', {
  'version-oida': campos({
    suceso: 'texto',
    fuenteTipo: 'texto',
    fuenteSitio: 'texto',
    fuentePuesto: 'texto?',
    lugar: 'texto',
    nivel: 'entero',
    signo: 'texto',
    plantilla: 'texto?',
    origen: 'texto?',
    texto: 'texto?',
    hechos: ESQUEMA_HECHOS_DE_RUMOR,
  }),
});

declaraTiposDeHecho('aventuras', {
  'aventura-aceptada': campos({ aventura: 'texto', plantilla: 'texto?' }),
  'aventura-cerrada': campos({ aventura: 'texto', desenlace: 'texto?' }),
  'aventura-abandonada': campos({ aventura: 'texto', motivo: 'texto?' }),
  'decision-en-aventura': campos({ aventura: 'texto', beat: 'texto', opcion: 'texto' }),
});

declaraTiposDeHecho('entregas', {
  'entrega-atendida': campos({ entrega: 'texto', quien: 'texto?' }),
  'entrega-ignorada': campos({ entrega: 'texto', porque: 'texto?' }),
});

declaraTiposDeHecho('anclajes', {
  // El identificador del sitio, el rol que ocupaba y el motivo si lo hubo, y **ninguna
  // coordenada**: lo que el descarte guarda es un sitio del mundo congelado por su
  // nombre, igual que `sitio-pisado`.
  'anclaje-descartado': campos({ anclaje: 'texto', rol: 'texto?', porque: 'texto?' }),
  // Deshacer es **una transición más y no un borrado del registro**: el hecho del
  // descarte se queda donde está y este se anota detrás. Borrar hechos rompería la
  // reconstrucción y además es la única operación que el registro no tiene. Lleva el rol
  // para que la línea se lea sola, sin ir a buscar el descarte que deshace.
  'anclaje-devuelto': campos({ anclaje: 'texto', rol: 'texto?' }),
});

/** Los tipos de hecho declarados, en orden estable. */
export const TIPOS_DE_HECHO = congelaHondo(Object.keys(CATALOGO).sort());

/** El área que posee un tipo de hecho, o un error que **nombra el tipo**. */
export function areaDeTipo(tipo) {
  const declarado = CATALOGO[tipo];
  if (!declarado) {
    throw new Error(
      `el hecho es del tipo ${JSON.stringify(tipo) ?? String(tipo)}, que ninguna área declara: el catálogo es cerrado y los declarados son ` +
      `${TIPOS_DE_HECHO.join(', ')}`,
    );
  }
  return declarado.area;
}

/** Los tipos que declara un área, en orden estable. Un área sin ninguno da lista vacía. */
export function tiposDelArea(area) {
  return congelaHondo((TIPOS_POR_AREA[area] ?? []).slice().sort());
}

/** El esquema de la carga de un tipo, o un error que nombra el tipo. */
export function esquemaDeCarga(tipo) {
  areaDeTipo(tipo);
  return CATALOGO[tipo].carga;
}

// --- La forma de un hecho ---------------------------------------------------

/**
 * El documento de un hecho: su tipo, su mapa, su momento —día y paso— y su carga.
 *
 * La carga es **inerte**: se guarda y se recupera verbatim, y nada de lo que hay
 * dentro se recalcula al reproducir. La frontera es la que explica por qué una
 * reconstrucción puede diferir — lo que es dato no cambia entre versiones y lo que
 * es regla sí, así que la regla no se guarda.
 */
export const ESQUEMA_HECHO = campos({
  tipo: 'texto',
  mapa: 'texto',
  dia: 'entero',
  paso: 'entero',
  carga: uno(Object.keys(CATALOGO).sort().map((t) => CATALOGO[t].carga)),
});

/** El documento del registro de hechos: la cabecera y la lista, y nada más. */
export const ESQUEMA_REGISTRO = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  hechos: lista(ESQUEMA_HECHO),
});

declaraEsquema(CLASES.REGISTRO, ESQUEMA_REGISTRO);

function exigeMomento(valor, campo, tipo) {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(
      `el hecho "${tipo}" no declara su momento: falta el campo "${campo}" o llega como ${JSON.stringify(valor) ?? String(valor)}. ` +
      'El momento es el día de diario y el paso del mundo, los dos enteros no negativos, y nunca una marca del reloj real',
    );
  }
  return valor;
}

/**
 * Un hecho bien formado, o un error que dice qué le falta.
 *
 * La carga se valida contra el esquema **de su propio tipo** y no contra la unión:
 * es lo que hace que un campo que ese tipo no declara falle nombrándolo, en vez de
 * colarse por la forma de otro tipo.
 */
export function hecho({ tipo, mapa, dia, paso, carga = {} }) {
  areaDeTipo(tipo);
  const id = exigeMapaId(mapa, `el hecho "${tipo}"`);
  const elDia = exigeMomento(dia, 'dia', tipo);
  const elPaso = exigeMomento(paso, 'paso', tipo);
  // Validar es escribir: si pasa por aquí, la carga es además su propia forma
  // canónica, y por ahí no se cuela un campo que nadie declaró.
  escribe(carga, esquemaDeCarga(tipo), `la carga del hecho "${tipo}"`);
  return congelaHondo({ tipo, mapa: id, dia: elDia, paso: elPaso, carga });
}

/** El texto canónico de un hecho, que es también su medida. */
export function textoDeHecho(h) {
  return escribe(h, ESQUEMA_HECHO, `el hecho "${h?.tipo ?? '(sin tipo)'}"`);
}

/** Cuánto ocupa un hecho en su forma canónica. El presupuesto son 300 bytes. */
export function bytesDeHecho(h) {
  return textoDeHecho(h).length;
}

/**
 * El orden **declarado** de dos hechos: por día, por paso, por tipo y, dentro de
 * todo eso, por el texto canónico de su carga.
 *
 * Nunca el orden de inserción, que es lo que `CLAUDE.md` prohíbe: dos hechos
 * producidos en el mismo paso tienen que quedar en el mismo orden vengan en el orden
 * en que vengan.
 */
export function ordenDeHechos(a, b) {
  if (a.dia !== b.dia) return a.dia - b.dia;
  if (a.paso !== b.paso) return a.paso - b.paso;
  if (a.mapa !== b.mapa) return a.mapa < b.mapa ? -1 : 1;
  if (a.tipo !== b.tipo) return a.tipo < b.tipo ? -1 : 1;
  const ca = escribe(a.carga, esquemaDeCarga(a.tipo));
  const cb = escribe(b.carga, esquemaDeCarga(b.tipo));
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

// --- El registro ------------------------------------------------------------

/**
 * El registro de una partida recién creada: vacío, con la versión de las reglas con
 * la que nació grabada dentro.
 *
 * Esa versión es la que hace posible el aviso de la reconstrucción: sin ella, «el
 * resultado puede diferir porque las reglas han cambiado» no se podría fundamentar.
 */
export function registroInicial() {
  return { reglas: VERSION_GENERADOR, hechos: [] };
}

function exigeRegistro(registro) {
  if (!registro || typeof registro !== 'object' || !Array.isArray(registro.hechos)) {
    throw new Error('el registro de hechos llega mal formado: se espera lo que devuelve registroInicial(), un objeto con "reglas" y "hechos"');
  }
  return registro;
}

/** Cuántos hechos hay anexados. */
export function cuantosHechos(registro) {
  return exigeRegistro(registro).hechos.length;
}

/** Los hechos anexados, sin poder tocarlos. */
export function hechosDe(registro) {
  return congelaHondo(exigeRegistro(registro).hechos.slice());
}

/**
 * Los hechos posteriores a una marca de aplicación: la cola pendiente.
 *
 * `-1` es «ninguno aplicado», que es la marca de un estado recién creado. Una marca
 * mayor que el registro es un error y no un cero: significa que el estado dice haber
 * aplicado hechos que el registro no tiene, y seguir como si nada sería exactamente
 * la degradación silenciosa que este repo ya ha pagado cinco veces.
 */
export function hechosDesde(registro, aplicadoHasta) {
  const todos = exigeRegistro(registro).hechos;
  if (!Number.isInteger(aplicadoHasta) || aplicadoHasta < -1) {
    throw new Error(`la marca de aplicación llega como ${JSON.stringify(aplicadoHasta) ?? String(aplicadoHasta)}: es el índice del último hecho aplicado, o -1 si no hay ninguno`);
  }
  if (aplicadoHasta >= todos.length) {
    throw new Error(
      `el estado dice estar aplicado hasta el hecho ${aplicadoHasta} y el registro solo tiene ${todos.length}: ` +
      'el registro se anexa antes que el estado, así que una marca por delante del registro significa que falta parte del registro',
    );
  }
  return congelaHondo(todos.slice(aplicadoHasta + 1));
}

/**
 * Anexa hechos al registro: **todos o ninguno**.
 *
 * Se validan todos primero y se escriben después, así que un cierre de salida cuya
 * escritura falle a mitad no deja hechos a medias. El lote entrante se ordena por el
 * criterio declarado antes de anexarse, que es donde vive «dos hechos del mismo paso
 * tienen un orden estable»; lo ya anexado no se toca ni se reordena nunca.
 */
export function anexa(registro, hechos) {
  exigeRegistro(registro);
  const entrantes = Array.isArray(hechos) ? hechos : [hechos];
  const validados = entrantes.map((h) => hecho(h ?? {}));
  validados.sort(ordenDeHechos);
  registro.hechos.push(...validados);
  return congelaHondo(validados);
}

/** El registro en documento, con su cabecera y sus hechos en el orden en que se anexaron. */
export function congelaRegistro(registro) {
  exigeRegistro(registro);
  const doc = {
    version: VERSION_FORMATO,
    generador: registro.reglas ?? VERSION_GENERADOR,
    clase: CLASES.REGISTRO,
    hechos: registro.hechos.map((h) => ({ tipo: h.tipo, mapa: h.mapa, dia: h.dia, paso: h.paso, carga: h.carga })),
  };
  escribe(doc, ESQUEMA_REGISTRO, 'documento registro-de-hechos');
  sinRastroDeUbicacion(doc, 'documento registro-de-hechos');
  return congelaHondo(doc);
}

/**
 * El registro de vuelta de su documento.
 *
 * Un hecho corrupto a la mitad falla **nombrando el hecho por su sitio en la lista**
 * y no devuelve medio registro: con el estado posiblemente ilegible, un registro a
 * medias es la peor cosa que se puede entregar.
 */
export function levantaRegistro(doc) {
  const registro = registroInicial();
  registro.reglas = typeof doc?.generador === 'string' && doc.generador ? doc.generador : VERSION_GENERADOR;
  const guardados = doc?.hechos ?? [];
  if (!Array.isArray(guardados)) {
    throw new Error(`el registro guardado no trae su lista de hechos: llegó ${JSON.stringify(guardados) ?? String(guardados)}`);
  }
  registro.hechos = guardados.map((h, i) => {
    try {
      return hecho(h ?? {});
    } catch (e) {
      throw new Error(`el hecho ${i + 1} de ${guardados.length} del registro está corrupto: ${e.message}`);
    }
  });
  return registro;
}
