// El origen de los datos de OSM: el Overpass del proyecto primero, los mirrors públicos
// como respaldo declarado, y ni un mundo levantado a medias cuando no hay ninguno.
//
// Cuatro decisiones que este fichero implementa y que conviene tener delante:
//
// 1. **Los tres bloques de una celda —terreno, POIs y callejero— viajan como un solo
//    lote.** Tres esperas de 8 s encadenadas se comen el presupuesto de datos entero y
//    dejan el minuto de RNF-PER-001 en manos del azar.
// 2. **La cobertura se comprueba antes de consultar.** Fuera del extracto no se pregunta
//    al propio: respondería 200 con cero elementos, que es mentir con un código de éxito.
// 3. **Aquí no aplica la degradación silenciosa de RNF-RED-001.** Cuando el LLM o las
//    fotos no están, la aventura sigue con textos de plantilla y nadie menciona la red.
//    Cuando no hay datos de OSM **no hay mapa que levantar**: el fallo es honesto y
//    reintentable, y no se congela nada.
// 4. **La clave de caché es el texto literal de la consulta y nada más.** Cambiar una
//    letra invalida la caché entera y la siguiente ejecución paga minutos contra los
//    mirrors. No es un cuelgue: es el precio, y por eso el texto lleva versión declarada.

import { createHash } from 'node:crypto';

import { FalloDeAguasArriba } from './comun.mjs';
import { clasificaRespuesta } from './sonda-overpass.mjs';

/**
 * La versión del texto de la consulta de celda.
 *
 * Es el artefacto que hace visible el coste de tocarla: la clave de caché es el hash del
 * texto, así que cualquier cambio —una letra— invalida la caché entera. Subir esta
 * versión es el acto deliberado que lo declara, y `CONSULTA_VERSION` del despliegue tiene
 * que coincidir o el proxy no arranca. Cruzable con la consulta literal que cada fixture
 * de SPEC-001 guarda en su manifiesto.
 */
export const VERSION_CONSULTA = '1';

/**
 * La consulta de una celda, **entera y en un solo lote**.
 *
 * Sale de las tres del prototipo (`prototipo/js/data/overpass.js`) unidas sin cambiar ni
 * un filtro: costa sin límite —si se trunca, la máscara tierra/mar clasifica mal—,
 * terreno, anclajes aptos para menores, callejero y bordillos. `amenity=drinking_water`
 * sigue fuera a propósito: es mobiliario urbano sin nombre y su volumen monopoliza el
 * sesgo de tipo `fuente` (game-design/parajes.md).
 *
 * @param {{lat: number, lon: number, radio_m: number}} celda
 */
export function consultaDeCelda({ lat, lon, radio_m: radio }) {
  const a = `(around:${radio},${lat},${lon})`;
  return `
[out:json][timeout:180];
way["natural"="coastline"]${a};
out geom;
(
  way["natural"="water"]${a};
  way["waterway"~"^(river|stream|canal)$"]${a};
  way["landuse"="forest"]${a};
  way["natural"="wood"]${a};
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track)$"]${a};
  node["natural"="peak"]${a};
);
out geom 8000;
(
  nwr["amenity"="place_of_worship"]${a};
  nwr["amenity"="monastery"]${a};
  nwr["historic"~"^(monument|memorial|castle|ruins|city_gate|archaeological_site|wayside_cross|wayside_shrine|monastery)$"]${a};
  nwr["tourism"="viewpoint"]${a};
  nwr["man_made"~"^(tower|lighthouse)$"]${a};
  nwr["natural"="spring"]${a};
  nwr["amenity"="fountain"]${a};
  nwr["leisure"="park"]${a};
  nwr["shop"="mall"]${a};
  nwr["amenity"~"^(cafe|restaurant|ice_cream|fast_food|library)$"]${a};
);
out center 6000;
way["highway"~"^(residential|living_street|pedestrian|service|unclassified|track|path|footway|cycleway|steps)$"]${a};
out geom 3000;
(
  node["kerb"]${a};
  node["barrier"="kerb"]${a};
);
out geom 3000;`;
}

/** La huella del texto de la consulta con una celda de referencia fija. */
export function huellaDeConsulta() {
  return resumen(consultaDeCelda({ lat: 40.4168, lon: -3.7038, radio_m: 1200 }));
}

/**
 * Las huellas de cada versión publicada del texto.
 *
 * Cambiar el texto sin subir la versión deja de casar aquí y el despliegue no arranca. Es
 * el mismo mecanismo que la superficie de escritura: dos sitios que tienen que coincidir,
 * en vez de una promesa.
 */
export const HUELLAS_DE_VERSION = Object.freeze({
  1: '3565685df52186d83d0429dbb1f74da99dbfb545d3089db53deece97bd0044b3',
});

const COSTE_DE_CAMBIARLA =
  'La clave de caché es el hash del texto: cambiarlo invalida la caché entera y la ' +
  'siguiente ejecución paga minutos contra los mirrors públicos. No es un cuelgue, es el ' +
  'precio — anótalo en el propio cambio, y cruza el texto nuevo con la consulta literal ' +
  'que cada fixture de SPEC-001 guarda en su manifiesto.';

/**
 * Comprueba que la versión declarada en el despliegue describe el texto que hay.
 *
 * Dos comprobaciones, y la segunda es la que muerde: que el despliegue declare la misma
 * versión que el código, y que el **texto** siga siendo el de esa versión. Tocar la
 * consulta sin subir la versión deja de casar aquí y el proxy no arranca, que es lo que
 * convierte «la caché se pierde entera» en un aviso en lugar de un lunes raro.
 *
 * @throws nombrando la versión y el coste que su cambio tiene: repoblar la caché entera.
 */
export function compruebaVersionDeConsulta(config) {
  const declarada = String(config.CONSULTA_VERSION);
  if (declarada !== VERSION_CONSULTA) {
    throw new Error(
      `el proxy no arranca: CONSULTA_VERSION declara "${declarada}" y el texto de la consulta de celda ` +
      `que hay en server/aguas-arriba/overpass.mjs es la "${VERSION_CONSULTA}". ${COSTE_DE_CAMBIARLA}`,
    );
  }
  const huella = huellaDeConsulta();
  if (HUELLAS_DE_VERSION[VERSION_CONSULTA] !== huella) {
    throw new Error(
      `el proxy no arranca: el texto de la consulta de celda cambió sin subir su versión. La versión ` +
      `"${VERSION_CONSULTA}" describe la huella ${HUELLAS_DE_VERSION[VERSION_CONSULTA]} y el texto que hay ` +
      `da ${huella}. ${COSTE_DE_CAMBIARLA}`,
    );
  }
  return true;
}

/** El resumen de un texto. La clave de caché sale de aquí y de nada más. */
const resumen = (texto) => createHash('sha256').update(texto).digest('hex');

/** La clave de caché de una consulta: el texto literal, sin normalizar y sin añadir nada. */
export function claveDeConsulta(ql) {
  return resumen(String(ql));
}

/**
 * La celda de una consulta, leída del propio texto.
 *
 * No viaja aparte a propósito: el esquema de la ruta de generación está cerrado en
 * `{consulta: {ql}}` (SPEC-023) y añadirle un campo sería añadir un dato a la superficie
 * para saber algo que el texto ya dice. Devuelve `null` si el texto no trae `around`, y
 * entonces la cobertura no se puede comprobar y la consulta va al respaldo, que tiene el
 * planeta: ante la duda, nunca al extracto.
 */
export function celdaDeConsulta(ql) {
  const m = String(ql ?? '').match(/around:\s*(\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { radio_m: Number(m[1]), lat: Number(m[2]), lon: Number(m[3]) };
}

/** Las etiquetas de eslabón que la métrica del día admite. Cerradas, como todo lo suyo. */
export const ETIQUETAS_DE_ESLABON = Object.freeze(['propio', 'respaldo-1', 'respaldo-2', 'respaldo-3', 'ninguno']);

/** Un almacén en memoria: es como corre sin inyectar nada, y no escribe en ningún disco. */
export function creaAlmacenDeConsultasEnMemoria() {
  const datos = new Map();
  return {
    async lee(clave) { return datos.has(clave) ? datos.get(clave) : null; },
    async escribe(clave, valor) { datos.set(clave, valor); },
    /** Cuántas consultas distintas hay guardadas. Ni una zona, ni un cuándo, ni quién. */
    tamano() { return datos.size; },
  };
}

/**
 * El cliente de generación con la cadena entera.
 *
 * Tiene la firma de los otros clientes de aguas arriba —`{ruta, seCachea, pide}`— porque
 * el proxy lo recibe inyectado y no se entera de nada de esto.
 *
 * @param {object} deps
 * @param {Function} deps.fetch  el transporte, inyectado para poder doblarlo por eslabón.
 * @param {object} deps.config  el de `cargaConfigDeOrigen`.
 * @param {object} deps.sonda  la de `creaSonda`: decide si el propio recibe tráfico.
 * @param {object} deps.cobertura  la de `creaCobertura`.
 * @param {{ahora: () => number}} [deps.reloj]  solo para plazos. No entra en ninguna clave.
 * @param {object} [deps.almacen]  la caché por texto de consulta. Sin inyectar, en memoria.
 * @param {(etiqueta: string) => any} [deps.anota]  el recuento por eslabón de la métrica
 *   del día. Se conecta después de montar el proxy, que es quien tiene la métrica.
 */
export function creaClienteDeOverpass({
  fetch,
  config,
  sonda,
  cobertura,
  reloj = { ahora: () => Date.now() },
  almacen = creaAlmacenDeConsultasEnMemoria(),
  anota = () => {},
}) {
  compruebaVersionDeConsulta(config);

  const respaldo = config.RESPALDO.map((url, i) => ({
    etiqueta: `respaldo-${Math.min(i + 1, 3)}`, url, propio: false,
  }));
  const enVuelo = new Map();
  let anotador = anota;

  // El número de consultas en vuelo que el servicio admite, declarado en vez de
  // descubierto: sin él, dos generaciones simultáneas se estorban y la culpa parece del
  // presupuesto. Las que no caben esperan turno; ninguna se rechaza.
  let dentro = 0;
  const cola = [];
  async function conCupo(fn) {
    if (dentro >= config.CONSULTAS_EN_VUELO) await new Promise((sigue) => cola.push(sigue));
    dentro += 1;
    try { return await fn(); } finally {
      dentro -= 1;
      const siguiente = cola.shift();
      if (siguiente) siguiente();
    }
  }

  /** Una consulta a un eslabón, con su plazo propio. Ni reintenta ni encadena. */
  async function pideAlEslabon(eslabon, ql, restante) {
    const plazo = Math.min(config.PLAZO_ESLABON, restante);
    if (plazo <= 0) return { sirve: false, motivo: 'plazo-agotado', mensaje: 'el presupuesto de datos se agotó antes de llegar a este eslabón' };
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), plazo);
    if (corte.unref) corte.unref();
    try {
      const res = await fetch(eslabon.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Etiqueta de OSM, que algunos mirrors exigen (406 sin ella). No identifica a
          // nadie: es el nombre del proyecto, igual para todas las instalaciones.
          'User-Agent': 'walking-adventure/0.1 (+https://github.com/walkingadventure)',
        },
        body: 'data=' + encodeURIComponent(ql),
        signal: control.signal,
      });
      if (!res) return clasificaRespuesta({ error: new Error('sin respuesta') });
      const texto = await res.text();
      // El mínimo es cero: una celda de campo abierto sin un solo POI es un dato
      // legítimo. Lo que separa «vacío legítimo» de «fuera del extracto» no es este
      // umbral sino la confirmación contra el respaldo, más abajo.
      return clasificaRespuesta({ texto, http: res.status ?? (res.ok ? 200 : 500), minimo: 0 });
    } catch (e) {
      return clasificaRespuesta({ error: e });
    } finally {
      clearTimeout(corte);
    }
  }

  /** Recorre la cadena. Devuelve el primer eslabón que sirve datos, o el fallo entero. */
  async function recorreLaCadena(ql) {
    const celda = celdaDeConsulta(ql);
    const cubierta = celda ? cobertura.cubre(celda) : false;
    const listo = sonda.estaListo();

    const cadena = [];
    // El propio va delante **solo** si sirve y si el extracto cubre la celda. Fuera de la
    // cobertura se va directo al respaldo, que sí tiene el planeta.
    if (listo && cubierta) cadena.push({ etiqueta: 'propio', url: config.OVERPASS_PROPIO, propio: true });
    cadena.push(...respaldo);

    const arranque = reloj.ahora();
    const fallos = [];
    for (const eslabon of cadena) {
      const restante = config.PRESUPUESTO_DATOS - (reloj.ahora() - arranque);
      const r = await pideAlEslabon(eslabon, ql, restante);
      if (!r.sirve) {
        // 429, 503, 504 y la página de error XML se descartan igual: se pasa al siguiente
        // **sin reintentar contra el mismo**, y el jugador no ve nada distinto de una espera.
        fallos.push({ eslabon: eslabon.etiqueta, motivo: r.motivo });
        continue;
      }
      // Una celda vacía servida por el propio no se da por buena sin confirmarla: la
      // cobertura es un recorte grueso y cerca del borde «vacío» y «fuera del extracto»
      // se parecen demasiado. Vacío confirmado por el respaldo sí es dato legítimo.
      if (eslabon.propio && r.datos.elements.length === 0 && respaldo.length) {
        fallos.push({ eslabon: eslabon.etiqueta, motivo: 'vacio-sin-confirmar' });
        continue;
      }
      return { eslabon: eslabon.etiqueta, elements: r.datos.elements, fallos };
    }
    return { eslabon: 'ninguno', fallos };
  }

  return {
    ruta: 'generacion',
    // La caché del proxy sobre la generación sigue apagada (SPEC-023); la de esta pieza
    // es la de por texto de consulta, y vive aquí.
    seCachea: true,
    VERSION_CONSULTA,

    /**
     * @param {{consulta: {ql: string}}} peticion
     * @throws {FalloDeAguasArriba} con la cadena agotada. No devuelve un mundo a medias:
     *   sin datos no hay mapa, y el fallo es honesto y reintentable.
     */
    async pide({ consulta }) {
      const ql = (consulta && consulta.ql) || '';
      const clave = claveDeConsulta(ql);

      const cacheado = await almacen.lee(clave);
      if (cacheado) return cacheado;

      // Dos generaciones simultáneas de la misma celda sin acierto de caché hacen **una
      // sola** consulta aguas arriba y reciben lo mismo.
      if (enVuelo.has(clave)) return enVuelo.get(clave);

      const promesa = conCupo(async () => {
        const r = await recorreLaCadena(ql);
        anotador(r.eslabon);
        if (r.eslabon === 'ninguno') {
          const agotadoPorPlazo = r.fallos.length && r.fallos.every((f) => f.motivo === 'plazo-agotado');
          throw new FalloDeAguasArriba('generacion', agotadoPorPlazo ? 'plazo-agotado' : 'caido');
        }
        const contenido = { elements: r.elements };
        // Lo que no es JSON completo no llega hasta aquí: `clasificaRespuesta` lo
        // descarta antes. Lo que se cachea es permanente y nada caduca por el tiempo.
        await almacen.escribe(clave, contenido);
        return contenido;
      });
      enVuelo.set(clave, promesa);
      try { return await promesa; } finally { enVuelo.delete(clave); }
    },

    /** Cablea el recuento por eslabón cuando ya existe la métrica. */
    conectaMetrica(fn) { anotador = fn; },

    /** La cadena declarada, para el runbook y para la métrica de operación. */
    declaraCadena() {
      return {
        propio: config.OVERPASS_PROPIO,
        respaldo: respaldo.map((e) => e.url),
        presupuestoDatos: config.PRESUPUESTO_DATOS,
        plazoEslabon: config.PLAZO_ESLABON,
        consultasEnVuelo: config.CONSULTAS_EN_VUELO,
        consultaVersion: VERSION_CONSULTA,
        ...cobertura.declara(),
      };
    },
  };
}

export { FalloDeAguasArriba };
