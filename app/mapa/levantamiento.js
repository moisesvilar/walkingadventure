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
// **Y nada degrada por falta de cableado** (§6h). Las seis piezas se comprueban al
// construir, no al usarlas: un levantamiento sin colocador pintaría rótulos
// superpuestos y sin traedor fallaría al primer mapa, que son dos maneras de que una
// pieza ausente no proteste. Es la forma de fallo que este repositorio ha pagado
// cinco veces.
//
// **El generador también entra por la puerta, no por un import** (SPEC-020). Este
// módulo orquesta y no genera nada, así que recibe el núcleo igual que recibe el
// traedor, el almacén o el colocador: como una pieza más. No es una preferencia de
// estilo — es lo que mantiene la orquestación alcanzable desde `node --test` **sin
// resolver ningún especificador que haya que instalar**. Citando
// `@walkingadventure/nucleo` desde aquí, cinco ficheros de `test/nucleo/` dejaban de
// cargar en cuanto faltaba `node_modules`, y la red de seguridad del determinismo
// pasaba a depender de una instalación sin que nada se pusiera rojo. Quien monta la
// app sí cita el paquete por su nombre, y lo hace en `app/nucleo/piezas.js`.

import { CLAVE_DE_CAMARA, encuadraCelda, leeCamara, normaliza, textoDeCamara, vistaDe } from './camara.js';
import { creaSeguimientoDeFases } from './fases.js';

/** Las seis piezas que hay que cablear. Sin una, esto no se construye. */
export const PIEZAS_DEL_LEVANTAMIENTO = Object.freeze(['consultaOsm', 'almacen', 'cronometro', 'colocador', 'medidor', 'nucleo']);

/**
 * Lo que la orquestación le pide al generador, enumerado. Va escrito y no
 * sobreentendido por lo mismo que las piezas: un núcleo al que le falta media
 * interfaz fallaría en la tercera pantalla y no al construir.
 */
export const DEL_NUCLEO = Object.freeze([
  'componeEscena', 'ESTILO_POR_DEFECTO', 'CLAVES', 'cargaCelda', 'cargaMapa', 'celdaAbierta',
  'celdasAbiertas', 'creaMapa', 'guardaMapa', 'listaMapas', 'pisa', 'claveDeCelda', 'creaRejilla',
]);

/**
 * Lo que hace falta **además** para andar por un mapa: el mapa activo, la apertura de
 * celdas vecinas y su guardado (SPEC-041).
 *
 * Va en una lista aparte y se comprueba **al usarse y no al construir**, y la razón es
 * que no todo el que monta esta orquestación anda: pintar una lámina ya levantada no
 * necesita ni resolver el mapa activo ni abrir una celda, y exigírselo dejaría sin
 * arrancar a quien solo quiere dibujar. Lo que no cambia es que la ausencia **se dice
 * nombrando la pieza** y no degrada en silencio, que es lo de §6h.
 *
 * Entran por el mismo objeto y por la misma puerta que el resto (§6u): quien orquesta
 * recibe el generador, quien lo monta lo importa.
 */
export const DEL_NUCLEO_PARA_ANDAR = Object.freeze([
  'completaCelda', 'guardaCelda', 'guardaIndice', 'resuelvePosicion',
  'resuelveMapaActivo', 'listaDeMapas', 'ESTADOS_DE_APERTURA', 'SIN_MAPA_ACTIVO',
]);

/** Los cuatro estados del momento, tal como los declara la spec. Vocabulario cerrado. */
export const ESTADOS = Object.freeze(['sin-mapa', 'levantando', 'pintado', 'no-se-pudo']);

const QUE_HACE = Object.freeze({
  consultaOsm: 'es la única puerta por la que el mundo real entra en el móvil',
  almacen: 'sin él el documento congelado no se escribe, y lo que no se escribe hay que regenerarlo',
  cronometro: 'sin él el minuto de RNF-PER-001 es una intención y no un criterio',
  colocador: 'sin él la lámina se pinta con los rótulos pisándose unos a otros',
  medidor: 'sin él no hay cajas, y sin cajas no hay colocación posible',
  nucleo: 'es el generador entero: la rejilla, el registro de celdas y la composición de la escena',
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
 * @param {object} piezas.nucleo  el generador, con lo que enumera `DEL_NUCLEO`.
 * @param {Function} [piezas.compone]  el compositor de escenas; el del núcleo por defecto.
 */
export function creaLevantamiento({ consultaOsm, almacen, cronometro, colocador, medidor, nucleo, compone = null }) {
  const traidas = { consultaOsm, almacen, cronometro, colocador, medidor, nucleo };
  for (const pieza of PIEZAS_DEL_LEVANTAMIENTO) {
    const valor = traidas[pieza];
    const esObjeto = pieza === 'almacen' || pieza === 'cronometro' || pieza === 'nucleo';
    const bien = esObjeto ? valor && typeof valor === 'object' : typeof valor === 'function';
    if (!bien) {
      throw new Error(
        `el levantamiento del mapa se construye sin ${pieza} y no arranca sin él: ${QUE_HACE[pieza]}. ` +
        `Las seis piezas son ${PIEZAS_DEL_LEVANTAMIENTO.join(', ')}`,
      );
    }
  }
  for (const metodo of ['lee', 'escribe', 'lista', 'borra']) {
    if (typeof almacen[metodo] !== 'function') throw new Error(`al almacén inyectado le falta la operación "${metodo}"`);
  }
  for (const metodo of ['arranca', 'mide', 'para', 'medida']) {
    if (typeof cronometro[metodo] !== 'function') throw new Error(`al cronómetro inyectado le falta "${metodo}"`);
  }
  for (const nombre of DEL_NUCLEO) {
    if (nucleo[nombre] == null) throw new Error(`al núcleo inyectado le falta "${nombre}", que es de lo que se compone el levantamiento`);
  }

  const {
    CLAVES, cargaCelda, cargaMapa, celdaAbierta, celdasAbiertas,
    claveDeCelda, creaMapa, creaRejilla, guardaMapa, listaMapas, pisa,
  } = nucleo;

  /**
   * Las piezas de andar, comprobadas al usarse. Falla nombrando la que falta y para qué
   * es: un núcleo a medias que se descubre tres pantallas después es la forma de fallo
   * que este repositorio ha pagado siete veces.
   */
  const paraAndar = (quien) => {
    const faltan = DEL_NUCLEO_PARA_ANDAR.filter((n) => nucleo[n] == null);
    if (faltan.length) {
      throw new Error(
        `${quien} necesita del núcleo ${faltan.join(', ')}, que no llegaron: sin ellas no hay mapa activo que resolver ` +
        `ni celda vecina que abrir. Las de andar son ${DEL_NUCLEO_PARA_ANDAR.join(', ')}`,
      );
    }
    return nucleo;
  };
  const ESTILO_POR_DEFECTO = nucleo.ESTILO_POR_DEFECTO;
  const componeLaEscena = compone ?? nucleo.componeEscena;

  // Cuántas veces se ha llamado al generador y cuántas se ha pedido a OSM. Es
  // diagnóstico y es lo que permite afirmar «arrastrar no ha regenerado nada» sin
  // instrumentar la red por dentro.
  const cuenta = { generaciones: 0, consultas: 0, aperturas: 0, celdas: 0 };

  /**
   * Qué dijeron las consultas de este levantamiento sobre la caché del proxy.
   *
   * Se acumula y no se guarda la última porque un levantamiento puede consultar más
   * de una vez —el radio dinámico de la costa vuelve a pedir— y una sola respuesta
   * servida de caché ya deja de ser una medida en frío. `sinDecir` está aparte a
   * propósito: una consulta que no dice de dónde vino no se cuenta como fría.
   */
  const cache = { vistas: 0, deCache: 0, sinDecir: 0 };

  /**
   * Si la caché del proxy estaba fría, tal como lo dicen las consultas: `true` fría,
   * `false` caliente, `null` no se sabe. **No hay valor por defecto**: una medida que
   * no sabe si la caché estaba fría vale menos que ninguna, así que se declara
   * desconocida en vez de darla por fría.
   */
  function cacheFriaDeclarada() {
    if (cache.vistas === 0 || cache.sinDecir > 0) return null;
    return cache.deCache === 0;
  }

  /** El traedor, envuelto para que su tiempo se le cobre a la consulta y no a la generación. */
  const consultaMedida = async (peticion) => {
    cuenta.consultas += 1;
    const bloques = await cronometro.mide('consulta', () => consultaOsm(peticion));
    cache.vistas += 1;
    const dicho = bloques ? bloques.deCache : undefined;
    if (typeof dicho !== 'boolean') cache.sinDecir += 1;
    else if (dicho) cache.deCache += 1;
    return bloques;
  };

  /**
   * La escena del mundo congelado con una cámara dada.
   *
   * Aquí no se genera nada: recibe el documento que ya existe y lo compone. Cambiar
   * de estilo o mover la cámara vuelve por aquí y por ningún otro sitio.
   */
  function pinta({ documento, camara, tamano, estilo = ESTILO_POR_DEFECTO, factorTexto = 1 }) {
    return componeLaEscena({
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
  function entrega({ mapa, registro, camara, escena, medida, generada, cacheFria = null }) {
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
      // Lo que dijeron las consultas sobre la caché del proxy, para que quien cierra
      // la medida no tenga que suponerlo. Abrir un mapa ya levantado no consulta, así
      // que ahí es `null` y significa que no hay nada que declarar.
      cacheFria,
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

  /**
   * Abre una celda y la deja guardada: o hay documento completo o no hay documento.
   *
   * El estado que devuelve es el vocabulario cerrado de `celda-apertura`, y ese es todo
   * el contrato con la pantalla: en marcha no se enseña nada —la regla de que en marcha
   * no hay nada que tocar no tiene excepciones— y antes de salir se cuenta con las
   * mismas fases que ya usa la generación del arranque.
   */
  async function abreYGuarda(mapa, ejecuta, { onFases = null, onApertura = null, quien } = {}) {
    const { guardaCelda, guardaIndice } = paraAndar(quien);
    const avisa = (estado) => (onApertura ? onApertura(estado) : null);
    avisa('abriendo');
    const fases = creaSeguimientoDeFases(onFases);
    try {
      const resultado = await ejecuta(fases);
      if (resultado.generada && resultado.registro) {
        cuenta.celdas += 1;
        // Primero la celda y después el índice: si escribir falla, lo que queda es un
        // índice que no declara la celda, y no un índice que declara una que no está.
        await guardaCelda(mapa, resultado.registro.celda, { almacen });
        await guardaIndice(mapa, { almacen });
        fases.termina();
      }
      avisa(resultado.registro ? 'abierta' : 'inactiva');
      return { ...resultado, apertura: resultado.registro ? 'abierta' : 'inactiva' };
    } catch (e) {
      // Nada a medias: el registro del núcleo solo se toca cuando hay mundo entero, y
      // aquí no se escribe nada si la consulta falló.
      avisa('no-se-pudo');
      return { registro: null, generada: false, apertura: 'no-se-pudo', motivo: e.message };
    }
  }

  return {
    recuento: () => ({ ...cuenta }),

    /** El vocabulario del estado de apertura, tal cual lo declara el núcleo. */
    estadosDeApertura: () => [...paraAndar('el vocabulario del estado de apertura').ESTADOS_DE_APERTURA],

    /** Los mapas ya levantados que hay en el almacén. Ninguno todavía es un estado normal. */
    async mapasLevantados() {
      return listaMapas({ almacen });
    },

    /** Los mapas de la partida con lo que cada uno declara. Solo lo lee el diario. */
    async mapasDeLaPartida({ pasos = null, rangos = null } = {}) {
      const { listaDeMapas } = paraAndar('la lista de mapas de la partida');
      return listaDeMapas({ almacen, pasos, rangos });
    },

    /**
     * Qué mapa toca donde estás. **No hay ninguna manera de fijarlo a mano**: se
     * resuelve desde la posición cada vez, y por eso no puede quedarse pegado a un mapa
     * antiguo. Sin ninguno cerca devuelve `SIN_MAPA_ACTIVO`, que no es un error.
     *
     * Lee los índices y ninguna celda: saber dónde estás no cuesta un documento de
     * mundo por mapa.
     */
    async mapaActivo({ lat, lon, semilla, tramoM = null }) {
      const { resuelveMapaActivo } = paraAndar('la resolución del mapa activo');
      const ids = await listaMapas({ almacen });
      const mapas = [];
      for (const id of ids) mapas.push(await cargaMapa({ almacen, id, semilla }));
      return { ...resuelveMapaActivo(mapas, { lat, lon, tramoM }), mapas };
    },

    /**
     * El jugador pisa una posición de un mapa suyo.
     *
     * Si la celda ya estaba abierta **se lee del almacén y no se consulta OSM**; si no,
     * se abre por pisarla, porque el mundo tiene que existir donde estás, y eso cubre a
     * quien vive pegado a un borde. La celda propia no se toca: abrir la vecina la deja
     * idéntica byte a byte.
     */
    async anda({ mapa, lat, lon, tramoM = null, onFases = null, onApertura = null }) {
      const { resuelvePosicion } = paraAndar('andar por un mapa');
      const donde = resuelvePosicion(mapa, lat, lon);
      if (donde.estado === 'abierta') {
        if (onApertura) onApertura('inactiva');
        return { ...donde, registro: await cargaCelda(mapa, donde.celda, { almacen }), generada: false, apertura: 'inactiva' };
      }
      return abreYGuarda(mapa, (fases) => pisa(mapa, lat, lon, {
        consultaOsm: consultaMedida,
        onStatus: async (aviso) => { fases.avisa(aviso); },
        tramoM,
      }), { onFases, onApertura, quien: 'andar por un mapa' });
    },

    /**
     * Llega la señal de que una celda se ha completado y se abre una vecina como
     * acontecimiento. **La elige la semilla**, no quien juega: es acontecimiento y no
     * decisión, y tiene que salir igual en dos ejecuciones iguales.
     */
    async completa({ mapa, celda, tramoM = null, onFases = null, onApertura = null }) {
      const { completaCelda } = paraAndar('abrir una celda como acontecimiento');
      return abreYGuarda(mapa, (fases) => completaCelda(mapa, celda, {
        consultaOsm: consultaMedida,
        onStatus: async (aviso) => { fases.avisa(aviso); },
        tramoM,
      }), { onFases, onApertura, quien: 'abrir una celda como acontecimiento' });
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
      // Lo que dijeron las consultas del levantamiento anterior no es de este.
      cache.vistas = 0;
      cache.deCache = 0;
      cache.sinDecir = 0;
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
        cacheFria: cacheFriaDeclarada(),
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
