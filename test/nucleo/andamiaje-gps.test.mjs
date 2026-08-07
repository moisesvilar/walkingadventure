// SPEC-001 · El GPS simulado.
//
// Es la fuente de recorridos de todo el proyecto, y lo que se afirma aquí es lo
// que hace que un recorrido se pueda usar como prueba: cadencia fija sin saltos,
// dos simulaciones idénticas, paradas que paran de verdad, y los tres modos de
// velocidad que el diseño necesita distinguir (andar, ambiguo, vehículo). Sin la
// distinción de modos no se pueden escribir «En la duda, cuenta» ni «Un viaje en
// tren no hace avanzar el mundo».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { simulaRecorrido, pasosMaestro } from '../dobles/gps-simulado.mjs';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

// Una calle de Sanxenxo, cuatro vértices: sirve para uno, dos o tres tramos.
const CALLE = [
  { lat: 42.4020, lon: -8.8090 },
  { lat: 42.4025, lon: -8.8080 },
  { lat: 42.4031, lon: -8.8072 },
  { lat: 42.4038, lon: -8.8060 },
];

// La cinta métrica de la prueba, aparte de la del doble: si midiéramos con la
// misma función, un error de proyección se cancelaría consigo mismo.
function metros(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat = ((a.lat + b.lat) / 2) * rad;
  const x = dLon * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * 6371000;
}

// Margen de la comprobación de saltos, RELATIVO al paso y no absoluto.
//
// Medir con una cinta distinta de la del productor es lo que da valor a la
// prueba, y es también lo que garantiza que las dos cifras no coincidan al
// último dígito: el productor reparte la longitud del tramo con el coseno de la
// latitud del tramo entero y la prueba vuelve a medir con el coseno de la
// latitud de cada par de puntos. Medido sobre este mismo recorrido:
//
//   n = 437 · pasoM = 1.3888888888888888 · saltoMax = 1.3889092091376078
//   exceso = 2.03e-5 m → 0.0015 % del paso
//
// Veinte micrómetros sobre 1,39 m es desajuste de proyección, no un salto. La
// tolerancia absoluta de 1e-6 m que había antes no era afirmable: exigía que dos
// proyecciones distintas coincidiesen en el micrómetro, y ponía en rojo un
// criterio que se cumple. Un salto de verdad —un vértice que se traga, una
// cadencia que se rompe— es del orden del propio paso, no de una milésima suya,
// así que un 0,1 % deja pasar el desajuste con 67 veces de holgura sobre lo
// medido y sigue cazando cualquier salto real con tres órdenes de magnitud de
// margen.
const MARGEN_RELATIVO = 1e-3;

describe('El GPS simulado', () => {
  test('Un recorrido emite posiciones a cadencia fija y sin saltos entre puntos consecutivos', () => {
    const cadenciaMs = 1000;
    const velocidadKmH = 5;
    const secuencia = simulaRecorrido({ polilinea: CALLE, cadenciaMs, velocidadKmH, origenTiempoMs: 0 });

    assert.ok(secuencia.length > 10, 'un recorrido de esta longitud tiene que dar bastantes posiciones');

    const pasoM = (velocidadKmH / 3.6) * (cadenciaMs / 1000);
    for (let i = 1; i < secuencia.length; i++) {
      assert.equal(
        secuencia[i].tMs - secuencia[i - 1].tMs,
        cadenciaMs,
        `la cadencia se rompe entre las posiciones ${i - 1} y ${i}`,
      );
      const salto = metros(secuencia[i - 1], secuencia[i]);
      const tope = pasoM * (1 + MARGEN_RELATIVO);
      assert.ok(
        salto <= tope,
        `salto de ${salto} m entre las posiciones ${i - 1} y ${i}: el paso es de ${pasoM} m y el tope, ` +
        `con el ${MARGEN_RELATIVO * 100} % de margen por desajuste de proyección, es de ${tope} m`,
      );
    }
  });

  test('El mismo recorrido con los mismos parámetros da dos secuencias idénticas', () => {
    const opciones = {
      polilinea: CALLE,
      cadenciaMs: 1000,
      origenTiempoMs: 0,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { parada: true, duracionS: 30 },
        { hastaVertice: 3, velocidadKmH: 45 },
      ],
    };
    assert.equal(
      JSON.stringify(simulaRecorrido(opciones)),
      JSON.stringify(simulaRecorrido(opciones)),
    );
  });

  test('Durante una parada declarada la posición no cambia y el tiempo sí avanza', () => {
    const secuencia = simulaRecorrido({
      polilinea: CALLE,
      cadenciaMs: 1000,
      origenTiempoMs: 0,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { parada: true, duracionS: 60 },
        { hastaVertice: 2, velocidadKmH: 4 },
      ],
    });

    const parado = secuencia.filter((p) => p.modo === 'parado');
    assert.ok(parado.length >= 2, 'una parada de 60 s a cadencia de 1 s tiene que dar varias posiciones');

    for (let i = 1; i < parado.length; i++) {
      assert.equal(parado[i].lat, parado[0].lat, 'la posición se movió durante la parada');
      assert.equal(parado[i].lon, parado[0].lon, 'la posición se movió durante la parada');
      assert.ok(parado[i].tMs > parado[i - 1].tMs, 'el tiempo no avanzó durante la parada');
    }
    // La parada ocurre donde se paró, no en el origen.
    assert.equal(parado[0].lat, CALLE[1].lat);
    assert.equal(parado[0].lon, CALLE[1].lon);
  });

  test('Un tramo declarado a velocidad de vehículo llega marcado como de vehículo', () => {
    const secuencia = simulaRecorrido({ polilinea: CALLE, cadenciaMs: 1000, velocidadKmH: 90 });
    const modos = new Set(secuencia.map((p) => p.modo));
    assert.deepEqual([...modos], ['vehiculo']);
  });

  test('Un tramo declarado a velocidad ambigua llega marcado como ambiguo, distinguible de andar y de vehículo', () => {
    const secuencia = simulaRecorrido({
      polilinea: CALLE,
      cadenciaMs: 1000,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { hastaVertice: 2, velocidadKmH: 10 },
        { hastaVertice: 3, velocidadKmH: 60 },
      ],
    });

    const porTramo = [0, 1, 2].map((i) => new Set(secuencia.filter((p) => p.tramo === i).map((p) => p.modo)));
    assert.deepEqual([...porTramo[0]], ['andando']);
    assert.deepEqual([...porTramo[1]], ['ambiguo']);
    assert.deepEqual([...porTramo[2]], ['vehiculo']);
  });

  test('La misma secuencia en formato de flujo de Maestro trae las mismas posiciones en el mismo orden', () => {
    const secuencia = simulaRecorrido({ polilinea: CALLE, cadenciaMs: 1000, velocidadKmH: 4 });
    const pasos = pasosMaestro(secuencia);

    assert.equal(pasos.length, secuencia.length);
    pasos.forEach((paso, i) => {
      assert.deepEqual(paso, { setLocation: { latitude: secuencia[i].lat, longitude: secuencia[i].lon } }, `paso ${i}`);
    });
  });

  test('Una polilínea de un solo punto falla con un error explícito en lugar de dar una secuencia vacía', () => {
    for (const polilinea of [[CALLE[0]], [], undefined]) {
      assert.throws(
        () => simulaRecorrido({ polilinea, velocidadKmH: 4 }),
        (e) => {
          assert.match(e.message, /polil[íi]nea/i);
          assert.match(e.message, /v[ée]rtice/i);
          return true;
        },
      );
    }
  });

  test('Una velocidad de cero o negativa falla nombrando el parámetro inválido', () => {
    for (const velocidadKmH of [0, -3]) {
      assert.throws(
        () => simulaRecorrido({ polilinea: CALLE, velocidadKmH }),
        (e) => {
          assert.match(e.message, /velocidadKmH/);
          return true;
        },
        `velocidad ${velocidadKmH}`,
      );
    }
  });

  test('El instante de cada posición sale del origen de tiempo recibido y no del reloj del sistema', () => {
    const base = { polilinea: CALLE, cadenciaMs: 1000, velocidadKmH: 4 };
    const desdeCero = simulaRecorrido({ ...base, origenTiempoMs: 0 });
    const desdeCuatroMil = simulaRecorrido({ ...base, origenTiempoMs: 4000 });

    assert.equal(desdeCero[0].tMs, 0);
    assert.equal(desdeCuatroMil[0].tMs, 4000);
    assert.equal(desdeCuatroMil.length, desdeCero.length);
    desdeCuatroMil.forEach((p, i) => {
      assert.equal(p.tMs - desdeCero[i].tMs, 4000, `la posición ${i} no está desplazada por el origen`);
      assert.equal(p.lat, desdeCero[i].lat);
      assert.equal(p.lon, desdeCero[i].lon);
    });

    // Y no hay ninguna manera de que el reloj del sistema se cuele.
    const fuente = readFileSync(join(RAIZ_REPO, 'test', 'dobles', 'gps-simulado.mjs'), 'utf8');
    for (const prohibido of [/Date\.now\s*\(/, /new\s+Date\b/, /performance\.now\s*\(/, /process\.hrtime\b/]) {
      assert.equal(prohibido.test(fuente), false, `gps-simulado.mjs lee el reloj del sistema: ${prohibido}`);
    }
  });
});
