// Levantar el mapa dentro del móvil: la orquestación que encadena coordenada →
// Overpass → generación → congelación → colocación de rótulos → escena.
//
// Vive en `app/` y no en el paquete a propósito: RF-INFRA-001 dice que el paquete no
// habla con la red, y encadenar consulta, generación, escritura y pintado es
// precisamente la frontera. Meterlo dentro obligaría a inyectarle media plataforma.
//
// **El invariante que manda sobre todos los demás**: lo que se pinta es el mundo
// congelado, no uno regenerado. Levantar ocurre una vez; a partir de ahí, abrir la
// app, arrastrar, acercar, cambiar de estilo o girar el móvil leen el documento y
// jamás vuelven a llamar al generador ni a OpenStreetMap. Por eso `abre` no recibe
// el traedor —no puede pedirle nada aunque quisiera— y por eso `recuento()` publica
// cuántas veces se ha generado: es la forma de afirmarlo desde fuera.
//
// **Y nada degrada por falta de cableado** (§6h). Las cinco piezas se comprueban al
// construir, no al usarlas: un levantamiento sin colocador pintaría rótulos
// superpuestos y sin traedor fallaría al primer mapa, que son dos maneras de que una
// pieza ausente no proteste. Es la forma de fallo que este repositorio ha pagado
// cinco veces.

import { componeEscena } from '@walkingadventure/nucleo/render/escena.js';
import { ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';
import {
  CLAVES,
  cargaCelda,
  cargaMapa,
  celdaAbierta,
  celdasAbiertas,
  creaMapa,
  guardaMapa,
  listaMapas,
  pisa,
} from '@walkingadventure/nucleo/partida/mapa.js';
import { claveDeCelda, creaRejilla } from '@walkingadventure/nucleo/world/rejilla.js';

import { CLAVE_DE_CAMARA, encuadraCelda, leeCamara, normaliza, textoDeCamara, vistaDe } from './camara.js';
import { creaSeguimientoDeFases } from './fases.js';

/** Las cinco piezas que hay que cablear. Sin una, esto no se construye. */
export const PIEZAS_DEL_LEVANTAMIENTO = Object.freeze(['consultaOsm', 'almacen', 'cronometro', 'colocador', 'medidor']);

/** Los cuatro estados del momento, tal como los declara la spec. Vocabulario cerrado. */
export const ESTADOS = Object.freeze(['sin-mapa', 'levantando', 'pintado', 'no-se-pudo']);

const QUE_HACE = Object.freeze({
  consultaOsm: 'es la única puerta por la que el mundo real entra en el móvil',
  almacen: 'sin él el documento congelado no se escribe, y lo que no se escribe hay que regenerarlo',
  cronometro: 'sin él el minuto de RNF-PER-001 es una intención y no un criterio',
  colocador: 'sin él la lámina se pinta con los rótulos pisándose unos a otros',
  medidor: 'sin él no hay cajas, y sin cajas no hay colocación posible',
});

/**
 * Las carencias declaradas de un mundo. Se dicen en vez de disimularse: una celda
 * que devuelve un documento válido y vacío es exactamente la pieza que, al no estar,
 * no protesta.
 */
export function carenciasDe(registro) {
  const mundo = registro.mundo;
  const carencias = [];
  if (registro.sinContenidoJugable) carencias.push('sin-mundo-jugable');
  // Los anclajes se cuentan por el recuento del pool y no por la lista: la lista
  // entera no se congela —lleva dentro los libres que nadie consumió—, así que un
  // mundo leído del almacén no la tiene y contarla ahí daría cero. Un recuento que
  // solo es cierto en los mundos recién generados no es un recuento.
  if ((mundo.pool && mundo.pool.admitidos) === 0) carencias.push('sin-anclajes');
  if (mundo.settlements.length === 0) carencias.push('sin-nucleos');
  if (mundo.parajes.length === 0) carencias.push('sin-parajes');
  if (mundo.geo.roads.length === 0 && mundo.geo.callejero.length === 0) carencias.push('sin-viario');
  return Object.freeze(carencias);
}

/**
 * Monta la orquestación del levantamiento.
 *
 * @param {object} piezas
 * @param {(peticion: object) => Promise<object>} piezas.consultaOsm  el traedor de datos.
 * @param {object} piezas.almacen  el de la partida, con sus cuatro operaciones.
 * @param {object} piezas.cronometro  el que mide el minuto.
 * @param {Function} piezas.colocador  el colocador de rótulos.
 * @param {Function} piezas.medidor  el medidor de texto.
 * @param {Function} [piezas.compone]  el compositor de escenas; el del paquete por defecto.
 */
export function creaLevantamiento({ consultaOsm, almacen, cronometro, colocador, medidor, compone = componeEscena }) {
  const traidas = { consultaOsm, almacen, cronometro, colocador, medidor };
  for (const pieza of PIEZAS_DEL_LEVANTAMIENTO) {
    const valor = traidas[pieza];
    const bien = pieza === 'almacen' || pieza === 'cronometro' ? valor && typeof valor === 'object' : typeof valor === 'function';
    if (!bien) {
      throw new Error(
        `el levantamiento del mapa se construye sin ${pieza} y no arranca sin él: ${QUE_HACE[pieza]}. ` +
        `Las cinco piezas son ${PIEZAS_DEL_LEVANTAMIENTO.join(', ')}`,
      );
    }
  }
  for (const metodo of ['lee', 'escribe', 'lista', 'borra']) {
    if (typeof almacen[metodo] !== 'function') throw new Error(`al almacén inyectado le falta la operación "${metodo}"`);
  }
  for (const metodo of ['arranca', 'mide', 'para', 'medida']) {
    if (typeof cronometro[metodo] !== 'function') throw new Error(`al cronómetro inyectado le falta "${metodo}"`);
  }

  // Cuántas veces se ha llamado al generador y cuántas se ha pedido a OSM. Es
  // diagnóstico y es lo que permite afirmar «arrastrar no ha regenerado nada» sin
  // instrumentar la red por dentro.
  const cuenta = { generaciones: 0, consultas: 0, aperturas: 0 };

  /** El traedor, envuelto para que su tiempo se le cobre a la consulta y no a la generación. */
  const consultaMedida = async (peticion) => {
    cuenta.consultas += 1;
    return cronometro.mide('consulta', () => consultaOsm(peticion));
  };

  /**
   * La escena del mundo congelado con una cámara dada.
   *
   * Aquí no se genera nada: recibe el documento que ya existe y lo compone. Cambiar
   * de estilo o mover la cámara vuelve por aquí y por ningún otro sitio.
   */
  function pinta({ documento, camara, tamano, estilo = ESTILO_POR_DEFECTO, factorTexto = 1 }) {
    return compone({
      documento,
      estilo,
      vista: vistaDe(normaliza(camara, documento)),
      tamano,
      medidor,
      colocador,
      factorTexto,
    });
  }

  /** El resultado que se le entrega a la pantalla, con la misma forma venga de donde venga. */
  function entrega({ mapa, registro, camara, escena, medida, generada }) {
    return {
      estado: 'pintado',
      mapa,
      mapaId: mapa.id,
      clave: registro.clave,
      registro,
      documento: registro.mundo,
      titulo: mapa.titulo,
      idioma: mapa.idioma,
      camara,
      escena,
      medida,
      generada,
      jugable: !registro.sinContenidoJugable,
      carencias: carenciasDe(registro),
    };
  }

  /**
   * Abre un mapa ya levantado. **No usa el traedor**: por aquí no hay ningún camino
   * hasta la red, que es más fuerte que prometer que no se toma.
   */
  async function abre({ id, semilla, tamano, estilo = ESTILO_POR_DEFECTO, factorTexto = 1 }) {
    cuenta.aperturas += 1;
    const mapa = await cargaMapa({ almacen, id, semilla });
    const abiertas = celdasAbiertas(mapa);
    if (!abiertas.length) throw new Error(`el mapa ${id} está levantado y no tiene ninguna celda abierta`);
    // La primera por su clave: es la misma que fija el título y el idioma del mapa,
    // así que lo que se pinta al abrir no depende del orden en que se abrieron.
    const registro = await cargaCelda(mapa, abiertas[0].celda, { almacen });

    const guardada = await almacen.lee(CLAVE_DE_CAMARA(id, registro.clave));
    const camara = leeCamara(guardada, registro.mundo);
    const escena = pinta({ documento: registro.mundo, camara, tamano, estilo, factorTexto });
    return entrega({ mapa, registro, camara, escena, medida: null, generada: false });
  }

  return {
    recuento: () => ({ ...cuenta }),

    /** Los mapas ya levantados que hay en el almacén. Ninguno todavía es un estado normal. */
    async mapasLevantados() {
      return listaMapas({ almacen });
    },

    /**
     * El identificador que le tocaría a un mapa levantado en una coordenada: su
     * anclaje redondeado. Se calcula sin generar nada, que es lo que permite saber
     * si ese mapa ya existe antes de tocar la red.
     */
    identificadorDe({ lat, lon, tramoM }) {
      return creaRejilla({ lat, lon, tramoM }).id;
    },

    pinta,

    /**
     * Levanta el mapa en una coordenada.
     *
     * Si ya hay un mapa en esa coordenada **no se resiembra**: se abre el que existe.
     * Levantar es irreversible y no hay ninguna acción de regenerar en ninguna
     * pantalla; que su ausencia sea deliberada es lo que esto implementa.
     */
    async levanta({ lat, lon, semilla, tramoM, tamano, estilo = ESTILO_POR_DEFECTO, factorTexto = 1, onFases = null }) {
      const rejilla = creaRejilla({ lat, lon, tramoM });
      const yaEstaba = await almacen.lee(CLAVES.indice(rejilla.id));
      if (yaEstaba !== null) return abre({ id: rejilla.id, semilla, tamano, estilo, factorTexto });

      cronometro.arranca();
      const fases = creaSeguimientoDeFases(onFases);
      // El coste de la coordenada exacta acaba aquí: la rejilla se queda con el
      // anclaje redondeado y lo que entró no se guarda en ninguna parte.
      const mapa = creaMapa({ semilla, lat, lon, tramoM });
      cuenta.generaciones += 1;

      const pisada = await cronometro.mide('generacion', () => pisa(mapa, lat, lon, {
        consultaOsm: consultaMedida,
        onStatus: async (aviso) => { fases.avisa(aviso); },
        tramoM,
      }));
      if (!pisada.registro) {
        throw new Error(`la coordenada que se acaba de levantar no cae en su propio mapa: ${pisada.mensaje ?? pisada.estado}`);
      }
      // La última fase visible —«Poniéndole nombre a todo»— cubre el casting y la
      // congelación, que es lo que ocurre entre que el generador calla y el
      // documento existe.
      fases.entra('nombres');

      // O hay documento completo o no hay documento: si escribir falla, el error se
      // propaga y no queda ninguna celda a medias registrada en el almacén.
      await cronometro.mide('congelacion', () => guardaMapa(mapa, { almacen }));

      const camara = encuadraCelda(pisada.registro.mundo);
      const escena = await cronometro.mide('colocacion', async () => pinta({
        documento: pisada.registro.mundo, camara, tamano, estilo, factorTexto,
      }));
      fases.termina();

      return entrega({
        mapa,
        registro: pisada.registro,
        camara,
        escena,
        // La medida se cierra cuando la lámina está pintada, y eso ocurre en la
        // pantalla: aquí se entrega el cronómetro corriendo y quien pinta lo para.
        medida: null,
        generada: true,
      });
    },

    abre,

    /**
     * Guarda el encuadre. La cámara es estado de pantalla y no del mundo, así que
     * vive **fuera** de los documentos del mapa: guardarla no puede tocar ni un byte
     * del documento congelado, y esa separación es lo que lo hace afirmable.
     */
    async guardaCamara({ mapaId, clave, camara }) {
      return almacen.escribe(CLAVE_DE_CAMARA(mapaId, clave), textoDeCamara(camara, { mapaId, clave }));
    },

    /** La celda de un mapa cargado, por si la pantalla necesita volver a ella. */
    celdaDe(mapa, celda) {
      return celdaAbierta(mapa, celda) ?? null;
    },

    claveDeCelda,
  };
}
