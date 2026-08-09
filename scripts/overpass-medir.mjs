// El cronómetro del tramo de datos: lo que convierte RNF-PER-001 en un número comparable
// entre dos ejecuciones en lugar de una impresión.
//
//   OVERPASS_PROPIO=http://localhost:12345/api/interpreter CONSULTA_VERSION=1 \
//     node scripts/overpass-medir.mjs [--pasadas N] [--celda urbano-denso]
//
// Tres cosas que hacen que la medida signifique algo:
//
// - **Caché fría siempre.** La caliente da un tramo despreciable y mediría el disco. Cada
//   pasada añade un comentario distinto al final del texto de la consulta: cambia el
//   hash —que es la clave— sin cambiar ni un filtro de lo que se pide.
// - **p95 sobre veinte pasadas**, no la media: la media esconde exactamente la cola que
//   estropea un onboarding.
// - **La gobierna la celda urbana densa**, que es la que más datos pide. Si esa cabe,
//   caben las cuatro; si no cabe, da igual la media de las otras tres.
//
// Y se publica con máquina, extracto y fecha, porque un número sin esas tres cosas no se
// puede comparar con el siguiente.

import { hostname, arch, platform, cpus, totalmem } from 'node:os';

import { cargaConfigDeOrigen } from '../server/config.mjs';
import { consultaDeCelda, VERSION_CONSULTA } from '../server/aguas-arriba/overpass.mjs';
import { creaSonda } from '../server/aguas-arriba/sonda-overpass.mjs';
import { creaCobertura } from '../server/aguas-arriba/cobertura.mjs';

/**
 * Las cuatro celdas arquetipo del andamiaje, con las coordenadas y los radios de los
 * fixtures de SPEC-001 (los manifiestos de `test/fixtures/osm/`). Van copiadas y no leídas
 * para que medir no dependa de que los fixtures estén capturados.
 */
export const CELDAS = Object.freeze([
  Object.freeze({ nombre: 'urbano-denso', lat: 40.4168, lon: -3.7038, radio_m: 1200, gobierna: true }),
  Object.freeze({ nombre: 'costero', lat: 42.402, lon: -8.809, radio_m: 700 }),
  Object.freeze({ nombre: 'barrio-tres-calles', lat: 42.18, lon: -7.82, radio_m: 500 }),
  Object.freeze({ nombre: 'suelo-250m', lat: 42.402, lon: -8.809, radio_m: 250 }),
]);

/** El reparto del minuto de RNF-PER-001. Solo el primero lo cumple esta pieza. */
export const REPARTO_DEL_MINUTO = Object.freeze([
  Object.freeze({ tramo: 'datos', presupuesto_ms: 20000, dueño: 'SPEC-024 (esta pieza)' }),
  Object.freeze({ tramo: 'generación en el dispositivo', presupuesto_ms: 25000, dueño: 'fila 26 sobre el paquete de la fila 2' }),
  Object.freeze({ tramo: 'primer pintado', presupuesto_ms: 10000, dueño: 'fila 21' }),
  Object.freeze({ tramo: 'margen', presupuesto_ms: 5000, dueño: '—' }),
]);

/** El percentil de una lista de milisegundos, por el método del más cercano. */
export function percentil(valores, p) {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[i];
}

async function unaPasada(url, ql, plazo) {
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), plazo);
  const arranque = process.hrtime.bigint();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'walking-adventure/0.1 (+https://github.com/walkingadventure)',
      },
      body: 'data=' + encodeURIComponent(ql),
      signal: control.signal,
    });
    const texto = await res.text();
    const ms = Number(process.hrtime.bigint() - arranque) / 1e6;
    if (texto.trim().startsWith('<')) return { ms, ok: false, motivo: 'página de error' };
    const datos = JSON.parse(texto);
    return { ms, ok: true, elementos: datos.elements.length };
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - arranque) / 1e6;
    return { ms, ok: false, motivo: e.name === 'AbortError' ? 'plazo agotado' : String(e.message).slice(0, 80) };
  } finally {
    clearTimeout(corte);
  }
}

async function mide({ url, celdas, pasadas, plazo }) {
  const salida = [];
  for (const celda of celdas) {
    const tiempos = [];
    const fallos = [];
    for (let i = 0; i < pasadas; i++) {
      // Cada pasada desplaza la celda un metro (1e-5 grados). Es lo que garantiza la
      // caché fría de verdad: un comentario distinto cambiaba nuestra clave —el hash del
      // texto— pero **no** la consulta que ve Overpass, que rechaza la repetida con
      // `duplicate_query` y devuelve una página de error en 300 ms. Un metro sobre celdas
      // de 250 a 1200 m no cambia lo que se mide, y sí cambia la consulta.
      const ql = consultaDeCelda({ ...celda, lat: Number((celda.lat + i * 1e-5).toFixed(6)) });
      const r = await unaPasada(url, ql, plazo);
      if (r.ok) tiempos.push(r.ms); else fallos.push(r.motivo);
      process.stdout.write(r.ok ? '.' : '!');
    }
    process.stdout.write('\n');
    salida.push({
      celda: celda.nombre,
      gobierna: Boolean(celda.gobierna),
      pasadas,
      completadas: tiempos.length,
      fallos,
      p50: percentil(tiempos, 50),
      p95: percentil(tiempos, 95),
      max: tiempos.length ? Math.max(...tiempos) : null,
    });
  }
  return salida;
}

const args = process.argv.slice(2);
const opcion = (nombre, defecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : defecto;
};

const config = cargaConfigDeOrigen({ CONSULTA_VERSION: VERSION_CONSULTA, ...process.env });
const cobertura = creaCobertura({
  cobertura: config.COBERTURA, extracto: config.EXTRACTO, mirror: config.EXTRACTO_MIRROR, fecha: config.EXTRACTO_FECHA,
});
const url = config.OVERPASS_PROPIO;
const pasadas = Number(opcion('pasadas', config.PASADAS_MEDIDA));
const soloUna = opcion('celda', null);
const celdas = soloUna ? CELDAS.filter((c) => c.nombre === soloUna) : CELDAS;

// Sin sonda no se mide: medir contra un Overpass que devuelve una página de error da
// tiempos magníficos y ningún dato.
const sonda = creaSonda({ fetch, url, config });
const veredicto = await sonda.pasa();
if (!veredicto.sirve) {
  process.stdout.write(`el Overpass del proyecto no sirve datos (${veredicto.motivo}): ${veredicto.mensaje}\n  → ${veredicto.arreglo}\n`);
  process.exit(1);
}

const medidas = await mide({ url, celdas, pasadas, plazo: config.PRESUPUESTO_DATOS });
const presupuesto = REPARTO_DEL_MINUTO[0].presupuesto_ms;
const gobierna = medidas.find((m) => m.gobierna) ?? medidas[0];

const informe = {
  medido: {
    // La fecha del día, no la hora: es una medición de operación, no una traza.
    dia: new Date().toISOString().slice(0, 10),
    maquina: `${hostname()} · ${platform()}/${arch()} · ${cpus().length} núcleos · ${Math.round(totalmem() / 2 ** 30)} GB`,
    origen: url,
    ...cobertura.declara(),
    consultaVersion: VERSION_CONSULTA,
    percentil: config.PERCENTIL_MEDIDA,
    pasadasPorCelda: pasadas,
    cache: 'fría en todas las pasadas',
  },
  repartoDelMinuto: REPARTO_DEL_MINUTO,
  presupuestoDatos_ms: presupuesto,
  celdas: medidas,
  gobierna: gobierna.celda,
  veredicto: gobierna.p95 !== null && gobierna.p95 <= presupuesto ? 'cabe' : 'no cabe',
};

process.stdout.write(JSON.stringify(informe, null, 2) + '\n');
process.exit(informe.veredicto === 'cabe' ? 0 : 1);
