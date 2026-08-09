// El proxy ciego: rutas declaradas, esquema cerrado por ruta y un sobre común de
// respuesta. Es el único servidor del proyecto y no tiene interfaz: el jugador nunca lo
// ve. Lo que ve es que los textos llegan, o que no llegan y la aventura sigue igual con
// los de plantilla, que es exactamente lo que ya pasa sin cobertura.
//
// La mitad del valor de este módulo está en lo que **no** hace, así que conviene tener
// delante las tres cosas que lo ordenan:
//
// 1. **Dos planos que no se hablan.** Uno ve la evidencia de la plataforma y nunca la
//    ficción; los otros cuatro ven la ficción y se pagan con fichas anónimas que no se
//    pueden enlazar entre sí ni con la atestación que las produjo. No hay ni un valor
//    que atraviese los dos.
// 2. **«No hay» es una respuesta normal del sobre**, no un error de transporte. Sin
//    cobertura, aguas arriba caído, presupuesto agotado y sin atestación terminan los
//    cuatro en la misma forma, que es lo que evita que aparezca una pantalla explicando
//    la red (RNF-RED-001).
// 3. **La superficie de escritura se comprueba al arrancar.** Si un módulo declara que
//    escribe algo que la superficie no contempla, el proxy no arranca y el error nombra
//    la entrada. Es lo que convierte «no registramos nada» en algo que se puede poner
//    en rojo.
//
// Y lo que no queda escrito en ninguna parte: la dirección IP, ninguna cabecera del
// cliente, ningún identificador de instalación, de dispositivo o de sesión, ningún
// identificador de lote, y ninguna marca de tiempo más fina que el día natural.

import { createServer } from 'node:http';

import { COSTE_POR_RUTA, TIPOS_DE_LOTE } from './config.mjs';
import { ESCRITURAS as ESCRITURAS_CACHE, claveDeFoto, claveDeGeneracion, claveDeImagen, claveDeTexto, creaCache } from './cache.mjs';
import { ESCRITURAS as ESCRITURAS_FICHAS, creaEmisorDeFichas } from './fichas.mjs';
import { CAMPOS_DE_ATESTACION, ESCRITURAS as ESCRITURAS_ATESTACION, creaPlanoDeAtestacion } from './atestacion.mjs';
import { ESCRITURAS as ESCRITURAS_METRICA, creaMetrica } from './metrica.mjs';
import { ESCRITURAS as ESCRITURAS_LOTES, creaLotes } from './lotes.mjs';
import { SUPERFICIE, compruebaSuperficie, creaAlmacenEnMemoria, recorreSuperficie } from './superficie.mjs';
import { FalloDeAguasArriba } from './aguas-arriba/comun.mjs';

/** Las rutas declaradas, y ninguna más. Una ruta no declarada se rechaza sin escribir. */
export const RUTAS = Object.freeze(['/atestacion', '/texto', '/imagen', '/places', '/generacion']);

/** Las cuatro rutas de contenido: las que ven la ficción. */
export const RUTAS_DE_CONTENIDO = Object.freeze(['texto', 'imagen', 'places', 'generacion']);

/**
 * El esquema cerrado de cada ruta de contenido. Un campo que no esté aquí se rechaza
 * nombrándolo, y no se llama a aguas arriba.
 *
 * Es el mismo criterio con el que SPEC-009 cierra el esquema del documento de partida,
 * y por la misma razón: un esquema abierto es por donde se cuela un día un campo con el
 * nombre real del bar sin que nada se ponga rojo.
 */
export const ESQUEMAS = Object.freeze({
  texto: Object.freeze(['prompt', 'idioma', 'tono']),
  imagen: Object.freeze(['prompt', 'formato']),
  places: Object.freeze(['place_id']),
  generacion: Object.freeze(['consulta']),
});

/** El sobre de la petición. La ficha paga; el lote acota; la petición lleva la ficción. */
export const CAMPOS_DEL_SOBRE = Object.freeze(['ficha', 'lote', 'peticion']);
const CAMPOS_DE_FICHA = Object.freeze(['kid', 'nonce', 'firma']);
const CAMPOS_DE_LOTE = Object.freeze(['id', 'tipo']);
const CAMPOS_ANIDADOS = Object.freeze({
  formato: Object.freeze(['tipo', 'ancho', 'alto']),
  consulta: Object.freeze(['ql']),
});

/** El sobre de la respuesta, igual en las cuatro rutas y en el doble del andamiaje. */
function sobre(tipo, { hay = false, deCache = false, contenido = null, error = null } = {}) {
  const s = { tipo, hay, deCache, contenido };
  if (error) s.error = error;
  return s;
}

/**
 * Comprueba un objeto contra una lista blanca cerrada. Devuelve el primer campo de más.
 *
 * Se exporta porque no es solo del proxy: el conseguidor de recursos criba con este mismo
 * mecanismo lo que **vuelve**, y una segunda implementación sería la manera conocida de
 * que una de las dos se quede sin cerrar.
 */
export function campoDeMas(objeto, permitidos) {
  if (objeto === null || objeto === undefined) return null;
  if (typeof objeto !== 'object' || Array.isArray(objeto)) return '(no es un objeto)';
  return Object.keys(objeto).find((c) => !permitidos.includes(c)) ?? null;
}

/**
 * Monta el proxy.
 *
 * Todo lo que lo hace comprobable sin red y sin claves reales entra por aquí: los cuatro
 * clientes de aguas arriba, el verificador de atestación, los almacenes, y un reloj que
 * se usa para dos cosas y nada más —decidir a qué día natural suma un contador y caducar
 * fichas, retos e identificadores de lote—.
 *
 * @param {object} deps
 * @param {object} deps.config  el de `cargaConfig`. Sin `TOPE_DIARIO_GASTO` ya habrá
 *   lanzado antes de llegar aquí: el proxy no arranca sin él.
 * @param {{ahora: () => number}} [deps.reloj]
 * @param {object} deps.verificador
 * @param {{texto, imagen, places, generacion}} deps.aguasArriba
 * @param {Record<string, object>} [deps.almacenes]  por entrada declarada. Lo que falte
 *   se abre en memoria, que es como corre en `node --test`.
 * @param {Array<{modulo: string, entradas: string[]}>} [deps.escriturasExtra]
 */
export function creaProxy({
  config,
  reloj = { ahora: () => Date.now() },
  verificador,
  aguasArriba,
  almacenes = {},
  escriturasExtra = [],
  generaClave,
  aleatorio,
}) {
  // --- la comprobación de arranque -----------------------------------------
  //
  // Va lo primero: si algo escribe fuera de la superficie declarada, no se monta nada.
  const escrituras = [
    { modulo: 'server/cache.mjs', entradas: ESCRITURAS_CACHE },
    { modulo: 'server/fichas.mjs', entradas: ESCRITURAS_FICHAS },
    { modulo: 'server/atestacion.mjs', entradas: ESCRITURAS_ATESTACION },
    { modulo: 'server/metrica.mjs', entradas: ESCRITURAS_METRICA },
    { modulo: 'server/lotes.mjs', entradas: ESCRITURAS_LOTES },
    ...Object.entries(almacenes).map(([id, a]) => ({
      modulo: `almacén inyectado "${id}"`,
      entradas: [a && a.entrada ? a.entrada : id],
    })),
    ...escriturasExtra,
  ];
  compruebaSuperficie(escrituras);

  const abre = (entrada) => almacenes[entrada] ?? creaAlmacenEnMemoria(entrada);
  const almacenesAbiertos = {
    'cache-imagenes': abre('cache-imagenes'),
    'cache-fotos': abre('cache-fotos'),
    'cache-generacion': abre('cache-generacion'),
    'retos-vivos': abre('retos-vivos'),
    'fichas-gastadas': abre('fichas-gastadas'),
    'metrica-del-dia': abre('metrica-del-dia'),
  };

  const metrica = creaMetrica({ config, reloj, almacen: almacenesAbiertos['metrica-del-dia'] });
  const emisor = creaEmisorDeFichas({ config, reloj, gastadas: almacenesAbiertos['fichas-gastadas'], generaClave });
  const atestacion = creaPlanoDeAtestacion({
    config, reloj, verificador, emisor, retos: almacenesAbiertos['retos-vivos'], aleatorio,
  });
  const lotes = creaLotes({ config, reloj, alCerrar: (cierre) => metrica.cierraLote(cierre) });

  const caches = {
    texto: creaCache({ almacen: null, activa: false }),
    imagen: creaCache({ almacen: almacenesAbiertos['cache-imagenes'] }),
    places: creaCache({ almacen: almacenesAbiertos['cache-fotos'] }),
    generacion: creaCache({ almacen: almacenesAbiertos['cache-generacion'], activa: config.CACHE_GENERACION === 'on' }),
  };

  const claves = {
    texto: claveDeTexto,
    imagen: claveDeImagen,
    places: claveDeFoto,
    generacion: claveDeGeneracion,
  };

  // --- el plano de contenido ------------------------------------------------

  /** Valida el sobre y el esquema de la ruta. Devuelve el primer campo de más, o null. */
  function valida(tipo, cuerpo) {
    const sobra = campoDeMas(cuerpo ?? {}, CAMPOS_DEL_SOBRE);
    if (sobra) return sobra;
    const { ficha, lote, peticion } = cuerpo ?? {};
    const enFicha = campoDeMas(ficha, CAMPOS_DE_FICHA);
    if (enFicha) return `ficha.${enFicha}`;
    const enLote = campoDeMas(lote, CAMPOS_DE_LOTE);
    if (enLote) return `lote.${enLote}`;
    if (lote && !TIPOS_DE_LOTE.includes(lote.tipo)) return 'lote.tipo';
    const enPeticion = campoDeMas(peticion ?? {}, ESQUEMAS[tipo]);
    if (enPeticion) return `peticion.${enPeticion}`;
    for (const [campo, permitidos] of Object.entries(CAMPOS_ANIDADOS)) {
      if (peticion && peticion[campo] !== undefined) {
        const dentro = campoDeMas(peticion[campo], permitidos);
        if (dentro) return `peticion.${campo}.${dentro}`;
      }
    }
    return null;
  }

  /**
   * Cuánta vía degradada cabe hoy.
   *
   * La cuota es una fracción de las peticiones del día, y leída al pie de la letra en un
   * día recién empezado da cero: quien no atesta no recibiría ni un acierto de caché, que
   * es lo contrario de lo que la política declara. El suelo es `FICHAS_POR_TANDA`, y no
   * un número nuevo: por debajo de una tanda, la cuota estaría cortando menos de lo que
   * consume una instalación legítima en un día, y no mediría nada.
   */
  const cabenDegradadas = (peticiones) =>
    Math.max(config.FICHAS_POR_TANDA, Math.floor(config.CUOTA_VIA_DEGRADADA * peticiones));

  async function atiendeContenido(tipo, cuerpo) {
    const deMas = valida(tipo, cuerpo);
    if (deMas) {
      await metrica.cuenta({ ruta: tipo, resultado: 'rechazo' });
      return { estado: 400, sobre: sobre(tipo, { error: `campo no declarado en la ruta ${tipo}: ${deMas}` }) };
    }

    const { ficha = null, lote = null, peticion = {} } = cuerpo ?? {};
    // La clave de caché la deriva el proxy del contenido. No hay ningún camino por el
    // que una clave elegida por el cliente llegue hasta aquí: el esquema cerrado la
    // rechazaría antes, y esta función solo recibe los campos declarados.
    const clave = claves[tipo](peticion);

    const veredicto = emisor.comprueba(ficha);
    if (!veredicto.valida && veredicto.motivo !== 'ausente') {
      // Una ficha presentada y mala es un error de protocolo que el cliente arregla
      // volviendo a atestar. No llega a aguas arriba y no deja escrito de quién era,
      // porque el proxy no lo sabe.
      await metrica.cuenta({ ruta: tipo, resultado: 'rechazo' });
      return { estado: 401, sobre: sobre(tipo, { error: 'hay que volver a atestar' }) };
    }
    const atestado = veredicto.valida;

    if (!atestado) {
      // Vía sin atestación: se sirve lo que ya está pagado y no se hace ni una llamada
      // de pago. Quien no atesta juega entero con textos de plantilla, y ninguna
      // pantalla se lo dice, porque el cliente no distingue esto de estar sin cobertura.
      const { peticiones, degradadas } = await metrica.volumenDelDia();
      if (degradadas >= cabenDegradadas(peticiones)) {
        await metrica.cuenta({ ruta: tipo, resultado: 'rechazo', degradada: true });
        return { estado: 200, sobre: sobre(tipo) };
      }
      const cacheado = await caches[tipo].lee(clave);
      if (cacheado) {
        await metrica.cuenta({ ruta: tipo, resultado: 'acierto-cache', degradada: true });
        return { estado: 200, sobre: sobre(tipo, { hay: true, deCache: true, contenido: cacheado }) };
      }
      await metrica.cuenta({ ruta: tipo, resultado: 'rechazo', degradada: true });
      return { estado: 200, sobre: sobre(tipo) };
    }

    // Con ficha válida, el acierto de caché se sirve **sin gastarla**: lo cacheado ya
    // está pagado y cobrar por servirlo sería cobrar dos veces.
    const cacheado = await caches[tipo].lee(clave);
    if (cacheado) {
      await metrica.cuenta({ ruta: tipo, resultado: 'acierto-cache' });
      return { estado: 200, sobre: sobre(tipo, { hay: true, deCache: true, contenido: cacheado }) };
    }

    const coste = COSTE_POR_RUTA[tipo];

    // El tope diario global: al agotarse, todas las rutas responden «no hay», los
    // aciertos de caché siguen sirviéndose —ya han pasado, más arriba— y no se hace
    // ninguna llamada de pago más ese día.
    if ((await metrica.gastoDelDia()) + coste > config.TOPE_DIARIO_GASTO) {
      await metrica.cuenta({ ruta: tipo, resultado: 'rechazo' });
      return { estado: 200, sobre: sobre(tipo) };
    }

    // El tope por lote: es lo que corta un bucle del cliente antes de que llegue a
    // aguas arriba mil veces. Un identificador de lote que no existe se trata como un
    // lote nuevo con su tope entero, y el intento no se registra.
    const enCurso = lote ? await lotes.usa({ id: lote.id, tipo: lote.tipo }) : null;
    if (enCurso && !enCurso.cabeOtroPago()) {
      await metrica.cuenta({ ruta: tipo, resultado: 'rechazo' });
      return { estado: 200, sobre: sobre(tipo) };
    }

    const gasto = await emisor.gasta(ficha);
    if (!gasto.valida) {
      await metrica.cuenta({ ruta: tipo, resultado: 'rechazo' });
      return { estado: 401, sobre: sobre(tipo, { error: 'hay que volver a atestar' }) };
    }

    try {
      const { contenido, deCache } = await caches[tipo].sirveOPide(clave, () => aguasArriba[tipo].pide(peticion));
      if (contenido === null) throw new FalloDeAguasArriba(tipo, 'respuesta-invalida');
      if (!deCache) {
        if (enCurso) enCurso.anotaPago(coste);
        await metrica.cuenta({ ruta: tipo, resultado: 'llamada-de-pago', coste });
      } else {
        await metrica.cuenta({ ruta: tipo, resultado: 'acierto-cache' });
      }
      return { estado: 200, sobre: sobre(tipo, { hay: true, deCache, contenido }) };
    } catch (e) {
      // Lo que queda escrito de un fallo de aguas arriba es un contador agregado del día
      // y nada más. El diagnóstico viaja **fuera del sobre**, con la ruta y el tipo de
      // fallo del catálogo cerrado de `aguas-arriba/comun.mjs`: ni el cuerpo, ni la clave
      // del proveedor, ni el prompt. No se persiste en ninguna entrada.
      const tipoDeFallo = e instanceof FalloDeAguasArriba ? e.tipo : 'desconocido';
      await metrica.cuenta({ ruta: tipo, resultado: 'fallo-aguas-arriba' });
      return { estado: 200, sobre: sobre(tipo), diagnostico: { ruta: tipo, fallo: tipoDeFallo } };
    }
  }

  // --- el plano de identidad ------------------------------------------------

  async function atiendeAtestacion(cuerpo) {
    const sobra = campoDeMas(cuerpo ?? {}, CAMPOS_DE_ATESTACION);
    if (sobra) {
      return { estado: 400, sobre: { tipo: 'atestacion', ok: false, error: `campo no declarado en la ruta de atestación: ${sobra}` } };
    }
    // Sin evidencia y sin cegadas, lo que se pide es un reto. Es la misma ruta: el
    // plano de identidad es una sola, y no ve ni un prompt, ni un place_id, ni una
    // coordenada — su esquema cerrado no los admite.
    if (cuerpo && cuerpo.evidencia === undefined && cuerpo.cegadas === undefined) {
      const { reto, clave, vigencia } = await atestacion.nuevoReto();
      return { estado: 200, sobre: { tipo: 'atestacion', ok: true, reto, clave, vigencia } };
    }
    const r = await atestacion.emiteTanda(cuerpo);
    if (!r.ok) return { estado: 401, sobre: { tipo: 'atestacion', ok: false, error: r.motivo } };
    return { estado: 200, sobre: { tipo: 'atestacion', ok: true, clave: r.clave, firmas: r.firmas, vigencia: r.vigencia } };
  }

  // --- la superficie pública del proxy --------------------------------------

  return {
    RUTAS,
    config,

    /**
     * Atiende una petición ya parseada. Es la entrada que usan las pruebas: el proxy
     * funciona entero en memoria y sin red.
     */
    async atiende({ ruta, cuerpo }) {
      // Una ruta no declarada se rechaza **sin escribir nada**. No hay ningún endpoint
      // que reciba sucesos del jugador —anclajes descartados, ajustes, progreso,
      // errores del cliente— y por eso tampoco hay dónde registrar el intento.
      if (!RUTAS.includes(ruta)) return { estado: 404, sobre: { tipo: null, error: 'ruta no declarada' } };
      await lotes.barreCaducados();
      if (ruta === '/atestacion') return atiendeAtestacion(cuerpo);
      return atiendeContenido(ruta.slice(1), cuerpo);
    },

    /** Qué escribe el proxy, entrada por entrada, sin que haga falta leer su código. */
    declaracionDeSuperficie() { return SUPERFICIE; },

    /** Lo que hay escrito de verdad. Vacío en un proxy recién desplegado, y no falla. */
    async recorreSuperficie() { return recorreSuperficie(almacenesAbiertos); },

    /** La métrica agregada. No es una ruta: es una operación de quien opera el servidor. */
    metrica,

    /** Cierra los lotes vivos y barre lo caducado. Lo que hace un apagado ordenado. */
    async cierra() { await lotes.cierraTodos(); await emisor.barre(); },

    /**
     * Arranca el servidor HTTP.
     *
     * **El registro de conexiones está apagado a propósito y aquí se declara**: no se
     * escribe la dirección remota, ni el `User-Agent`, ni ninguna cabecera del cliente,
     * ni una línea por petición. Lo único que se lee de la petición es el método, la
     * ruta y el cuerpo; el resto no se toca. Quien despliegue esto detrás de un
     * terminador de TLS tiene que apagar su `access_log` también, y está escrito en
     * server/DESPLIEGUE.md.
     */
    arranca(puerto) {
      const servidor = createServer((req, res) => {
        const trozos = [];
        req.on('data', (c) => trozos.push(c));
        req.on('end', async () => {
          let cuerpo = {};
          try {
            const bruto = Buffer.concat(trozos).toString('utf8');
            cuerpo = bruto ? JSON.parse(bruto) : {};
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'el cuerpo no es JSON' }));
            return;
          }
          const ruta = (req.url || '').split('?')[0];
          const { estado, sobre: s } = await this.atiende({ ruta, cuerpo });
          res.writeHead(estado, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(s));
        });
      });
      servidor.listen(puerto);
      return servidor;
    },
  };
}
