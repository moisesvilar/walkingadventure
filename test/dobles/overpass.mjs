// El doble de Overpass, con los seis modos que SPEC-024 pide, y el cronómetro
// reproducible del tramo de datos.
//
// Los seis modos no son una lista de cortesía: son los seis finales distintos que un
// Overpass tiene delante del proxy, y cuatro de ellos responden **200**. De ahí que este
// doble sea el único sitio de la suite donde vive el texto literal de las dos páginas de
// error de `CLAUDE.md`, que es el dato —y el único— que separa «hay que importar horas»
// de «hay que cambiar un permiso». Un doble que devolviera «error XML» genérico dejaría
// verde una sonda incapaz de distinguirlas, que es justo el fallo de siete horas.
//
// Ni una conexión: `fetch` aquí es una función que devuelve un objeto con `text()`, igual
// que la frontera que `creaSonda` y `creaClienteDeOverpass` reciben inyectada. Y ni un
// temporizador real: lo que tarda una respuesta se declara en milisegundos y se cobra
// sobre el reloj inyectado, que es lo que hace que el cronómetro dé el mismo número dos
// veces.

import { consultaDeCelda } from '../../server/aguas-arriba/overpass.mjs';

import { mundoCongelado, mundosCongelados } from './mundo-congelado.mjs';

/**
 * La página de error de la primera causa: **no hay base de datos**.
 *
 * Literal de `CLAUDE.md`: el volumen vacío o la importación no hecha. Llega con código
 * **200**, que es lo que la hace peligrosa. `clasificaRespuesta` saca el mensaje del
 * primer `<p>`, así que el texto de dentro es el que acaba en el diagnóstico.
 */
export const XML_SIN_BASE_DE_DATOS = `<?xml version="1.0" encoding="UTF-8"?>
<html><head><title>OSM3S Response</title></head><body>
<p>Error: runtime error: open64: 2 No such file or directory /db/db/osm3s_osm_base Dispatcher_Client::1</p>
</body></html>`;

/**
 * La página de error de la segunda causa: **la base de datos está y el CGI no la
 * alcanza**. `/db` llega del image como `700 overpass:overpass` y nginx corre como uid
 * 101. Mismo síntoma que la anterior, mismo 200, y el arreglo opuesto.
 */
export const XML_PERMISO_DENEGADO = `<?xml version="1.0" encoding="UTF-8"?>
<html><head><title>OSM3S Response</title></head><body>
<p>Error: runtime error: open64: 13 Permission denied /db/db/osm3s_osm_base Dispatcher_Client::1</p>
</body></html>`;

/** Los seis modos. Lo que no esté aquí no es un final que Overpass sepa dar. */
export const MODOS = Object.freeze([
  'sirve',
  'sin-base-de-datos',
  'base-de-datos-inalcanzable',
  'cola',
  'plazo-agotado',
  'json-truncado',
]);

/** El motivo que la sonda tiene que sacar de cada modo. Es lo que se afirma contra ella. */
export const MOTIVO_ESPERADO = Object.freeze({
  'sirve': null,
  'sin-base-de-datos': 'sin-base-de-datos',
  'base-de-datos-inalcanzable': 'base-de-datos-inalcanzable',
  'cola': 'plazo-agotado',
  'plazo-agotado': 'plazo-agotado',
  'json-truncado': 'respuesta-ilegible',
});

/** Un error de aborto como el que lanza `fetch` cuando salta el `AbortController`. */
function errorDeAborto() {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}

/**
 * Un cuerpo de respuesta con `n` elementos, estable y sin nada vivo dentro.
 *
 * Los identificadores salen del índice y no de un azar: dos ejecuciones tienen que dar
 * el mismo cuerpo byte a byte o la caché y el determinismo dejan de ser afirmables.
 */
export function cuerpoConElementos(n, etiqueta = 'doble') {
  const elements = [];
  for (let i = 0; i < n; i++) {
    elements.push({ type: 'node', id: 1000 + i, lat: 40.4 + i / 1e4, lon: -3.7 - i / 1e4, tags: { name: `${etiqueta}-${i}` } });
  }
  return JSON.stringify({ version: 0.6, generator: 'Overpass API (doble)', elements });
}

/**
 * Lo que devuelve cada modo: el código HTTP y el cuerpo, o el error del transporte.
 *
 * @returns {{http?: number, texto?: string, lanza?: Error}}
 */
export function respuestaDelModo(modo, { elementos = 8, http = 429, etiqueta = 'doble' } = {}) {
  switch (modo) {
    case 'sirve':
      return { http: 200, texto: cuerpoConElementos(elementos, etiqueta) };
    // Las dos de código 200 que no traen datos. Son la razón de existir de la sonda.
    case 'sin-base-de-datos':
      return { http: 200, texto: XML_SIN_BASE_DE_DATOS };
    case 'base-de-datos-inalcanzable':
      return { http: 200, texto: XML_PERMISO_DENEGADO };
    // «Ahora no»: 429, 503 o 504. Se pasa al siguiente sin reintentar contra el mismo.
    case 'cola':
      return { http, texto: 'Too Many Requests' };
    // El plazo se simula lanzando el aborto, no esperando: el reloj real no entra en
    // ninguna prueba de este repo, y esperar ocho segundos no prueba nada más.
    case 'plazo-agotado':
      return { lanza: errorDeAborto() };
    // Llegó a medias: JSON que se corta. Ni se sirve ni se cachea.
    case 'json-truncado':
      return { http: 200, texto: cuerpoConElementos(elementos, etiqueta).slice(0, 60) };
    default:
      throw new Error(`modo de Overpass no declarado: "${modo}". Los declarados son: ${MODOS.join(', ')}`);
  }
}

/**
 * Un destino de Overpass doblado: el propio, o uno de los mirrors.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.url]
 * @param {string} [opciones.modo='sirve']
 * @param {number} [opciones.elementos=8]  cuántos devuelve el modo «sirve». Bajarlo por
 *   debajo de `SONDA_MINIMO` es cómo se simula una importación a medias.
 * @param {number} [opciones.http=429]  el código del modo «cola»: 429, 503 o 504.
 * @param {number} [opciones.tarda=0]  lo que cuesta responder, en milisegundos, cobrados
 *   sobre el reloj inyectado. Sin reloj no se cobra nada y el doble responde al instante.
 * @param {object} [opciones.reloj]  el de `test/dobles/reloj.mjs`.
 */
export function creaOverpassDoblado({
  url = 'http://overpass-doblado.local/api/interpreter',
  modo = 'sirve',
  elementos = 8,
  http = 429,
  tarda = 0,
  reloj = null,
  etiqueta = 'doble',
} = {}) {
  if (!MODOS.includes(modo)) throw new Error(`modo de Overpass no declarado: "${modo}". Los declarados son: ${MODOS.join(', ')}`);
  const registro = [];
  let modoActual = modo;
  let tardaActual = tarda;

  const doble = {
    url,
    get modo() { return modoActual; },

    /** Cambia el final que da este destino, para el vaivén de una caída a mitad del día. */
    cambiaA(nuevo, opciones = {}) {
      if (!MODOS.includes(nuevo)) throw new Error(`modo de Overpass no declarado: "${nuevo}"`);
      modoActual = nuevo;
      if (opciones.elementos !== undefined) elementos = opciones.elementos;
      if (opciones.tarda !== undefined) tardaActual = opciones.tarda;
      return doble;
    },

    /** La frontera inyectable, con la firma de `fetch`. */
    async fetch(destino, opciones = {}) {
      registro.push({
        indice: registro.length,
        destino,
        metodo: opciones.method ?? 'GET',
        cuerpo: opciones.body,
        modo: modoActual,
      });
      // Lo que tarda se cobra antes de decidir qué se devuelve: un plazo agotado también
      // consume presupuesto, que es lo que deja sin turno a los eslabones siguientes.
      if (reloj && tardaActual) reloj.avanza(tardaActual);

      const r = respuestaDelModo(modoActual, { elementos, http, etiqueta });
      if (r.lanza) throw r.lanza;
      return {
        ok: r.http === 200,
        status: r.http,
        async text() { return r.texto; },
        async json() { return JSON.parse(r.texto); },
      };
    },

    /** Cuántas veces se llegó hasta aquí. Es con lo que se afirma «no salió a ningún mirror». */
    llamadas() { return registro.length; },
    /** Qué se pidió, en orden. El cuerpo lleva la consulta, que es lo que se inspecciona. */
    peticiones() { return registro.map((p) => ({ ...p })); },
    /** Las consultas recibidas, ya desenvueltas del `data=` del cuerpo. */
    consultas() { return registro.map((p) => decodeURIComponent(String(p.cuerpo ?? '').replace(/^data=/, ''))); },
    olvida() { registro.length = 0; },
  };
  return doble;
}

/**
 * La cadena entera doblada: el propio y sus mirrors, cada uno con su modo, detrás de un
 * solo `fetch` que despacha por URL.
 *
 * Es lo que permite afirmar las dos mitades de la cadena de respaldo con el mismo
 * instrumento: que con el propio sirviendo **no sale nada hacia ningún mirror**, y que
 * con el propio caído la consulta los recorre en el orden declarado.
 *
 * @param {object} opciones
 * @param {string} opciones.propio  la URL del Overpass del proyecto.
 * @param {string[]} [opciones.respaldo]  las URLs de los mirrors, en orden.
 * @param {string|object} [opciones.modoPropio]  modo, o `{modo, elementos, tarda, http}`.
 * @param {Array<string|object>} [opciones.modosRespaldo]  uno por mirror; lo que falte
 *   toma `modoPorDefecto`.
 */
export function creaCadenaDoblada({
  propio,
  respaldo = [],
  modoPropio = 'sirve',
  modosRespaldo = [],
  modoPorDefecto = 'cola',
  reloj = null,
} = {}) {
  const normaliza = (v) => (typeof v === 'string' ? { modo: v } : { ...v });
  const destinos = new Map();
  const orden = [];

  const añade = (url, spec, etiqueta) => {
    const doble = creaOverpassDoblado({ url, reloj, etiqueta, ...normaliza(spec) });
    destinos.set(url, doble);
    orden.push(doble);
    return doble;
  };

  const elPropio = añade(propio, modoPropio, 'propio');
  const losMirrors = respaldo.map((url, i) => añade(url, modosRespaldo[i] ?? modoPorDefecto, `respaldo-${i + 1}`));

  return {
    propio: elPropio,
    respaldo: losMirrors,
    destinos,

    /** El transporte único que reciben la sonda y el cliente. */
    async fetch(url, opciones) {
      const doble = destinos.get(url);
      // Un destino que nadie declaró es tráfico que la prueba no esperaba: se corta en vez
      // de responder algo plausible, que es como una fuga pasa desapercibida.
      if (!doble) throw new Error(`el doble no conoce el destino "${url}": nadie lo declaró en la cadena`);
      return doble.fetch(url, opciones);
    },

    /** Las llamadas de cada destino, en el orden de la cadena: `{url: n}`. */
    llamadasPorDestino() {
      const salida = {};
      for (const d of orden) salida[d.url] = d.llamadas();
      return salida;
    },
    olvida() { for (const d of orden) d.olvida(); },
  };
}

/**
 * Una sonda de mentira, para poner el propio en listo o en no listo sin importar nada.
 *
 * `creaClienteDeOverpass` solo le pide `estaListo()`, así que doblarla es esto y no un
 * mecanismo: es la frontera que la spec declara inyectable precisamente para poder
 * ejercitar el vaivén de prontitud en `node --test`.
 */
export function creaSondaDoblada(listo = true) {
  let estado = listo;
  return {
    estaListo() { return estado; },
    pon(nuevo) { estado = nuevo; return estado; },
  };
}

/**
 * Las cuatro celdas arquetipo, leídas de los manifiestos de los fixtures de SPEC-001.
 *
 * Se leen y no se copian a propósito: el cronómetro tiene que medir **las mismas celdas**
 * que los fixtures congelaron, o la medida y los mundos de referencia dejan de hablar de
 * lo mismo sin que nada lo delate.
 */
export const CELDA_QUE_GOBIERNA = 'urbano-denso';

/**
 * Las cuatro celdas arquetipo: nombre, coordenada y radio, en orden estable con la que
 * gobierna la primera.
 */
export function celdasArquetipo() {
  const celdas = mundosCongelados().map((nombre) => {
    const { coordenada, radio_m: radio } = mundoCongelado(nombre).manifiesto;
    return { nombre, lat: coordenada.lat, lon: coordenada.lon, radio_m: radio };
  });
  return celdas.sort((a, b) => {
    if (a.nombre === CELDA_QUE_GOBIERNA) return -1;
    if (b.nombre === CELDA_QUE_GOBIERNA) return 1;
    return a.nombre < b.nombre ? -1 : 1;
  });
}

/**
 * El cronómetro reproducible del tramo de datos.
 *
 * Tres decisiones, y las tres vienen de un número medido:
 *
 * - **La caché fría se consigue desplazando la celda un metro por pasada.** Cambiar un
 *   comentario del texto cambia *nuestra* clave —el hash del texto— pero no la consulta
 *   que ve Overpass, que rechaza la repetida con `duplicate_query` y devuelve una página
 *   de error en 300 ms: se mediría el rechazo, no el trabajo. Un metro (1e-5 grados) sobre
 *   celdas de 250 a 1200 m no cambia lo que se pide y sí cambia la consulta.
 * - **p95 y no la media.** La media esconde la cola, y la cola es lo que hace abandonar un
 *   onboarding.
 * - **Gobierna la urbana densa.** Si esa cabe, caben las cuatro.
 *
 * El reloj es inyectado: contra el doble da el mismo número dos veces, y contra un
 * Overpass real se le pasa `{ahora: () => Number(process.hrtime.bigint() / 1000000n)}`.
 *
 * @param {object} deps
 * @param {Function} deps.fetch
 * @param {{ahora: () => number}} deps.reloj
 * @param {Array<{nombre: string, lat: number, lon: number, radio_m: number}>} deps.celdas
 * @param {string} deps.url
 * @param {number} [deps.pasadas=20]
 * @param {number} [deps.percentil=95]
 * @param {number} [deps.presupuesto=20000]
 */
export function creaCronometroDeDatos({ fetch, reloj, celdas, url, pasadas = 20, percentil: p = 95, presupuesto = 20000 }) {
  return {
    /** El texto de la pasada `i` de una celda: la misma celda desplazada `i` metros. */
    consultaDePasada(celda, i) {
      return consultaDeCelda({
        lat: Number((celda.lat + i * 1e-5).toFixed(6)),
        lon: celda.lon,
        radio_m: celda.radio_m,
      });
    },

    async mide() {
      const medidas = [];
      for (const celda of celdas) {
        const tiempos = [];
        const fallos = [];
        const consultas = [];
        for (let i = 0; i < pasadas; i++) {
          const ql = this.consultaDePasada(celda, i);
          consultas.push(ql);
          const arranque = reloj.ahora();
          let ok = false;
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'data=' + encodeURIComponent(ql),
            });
            const texto = await res.text();
            // Una página de error tarda poquísimo y no es una medida: si contara, un
            // Overpass roto daría el mejor p95 de la historia.
            ok = !texto.trim().startsWith('<') && JSON.parse(texto).elements !== undefined;
            if (!ok) fallos.push('respuesta que no son datos');
          } catch (e) {
            fallos.push(e.name === 'AbortError' ? 'plazo agotado' : 'transporte');
          }
          const ms = reloj.ahora() - arranque;
          if (ok) tiempos.push(ms);
        }
        medidas.push({
          celda: celda.nombre,
          gobierna: celda.nombre === CELDA_QUE_GOBIERNA,
          pasadas,
          completadas: tiempos.length,
          fallos,
          consultasDistintas: new Set(consultas).size,
          p50: percentilDe(tiempos, 50),
          p95: percentilDe(tiempos, p),
          max: tiempos.length ? Math.max(...tiempos) : null,
        });
      }
      const gobierna = medidas.find((m) => m.gobierna) ?? medidas[0];
      return {
        percentil: p,
        pasadasPorCelda: pasadas,
        cache: 'fría en todas las pasadas',
        presupuestoDatos_ms: presupuesto,
        celdas: medidas,
        gobierna: gobierna ? gobierna.celda : null,
        veredicto: gobierna && gobierna.p95 !== null && gobierna.p95 <= presupuesto ? 'cabe' : 'no cabe',
      };
    },
  };
}

/** El percentil de una lista de milisegundos, por el método del más cercano. */
export function percentilDe(valores, p) {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[i];
}
