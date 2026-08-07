// SPEC-001 · Los fixtures de OSM congelados.
//
// Los cuatro mundos son la entrada de toda prueba de generación, así que lo que
// se afirma aquí es lo que las demás dan por hecho: que no cambian entre
// llamadas, que quien los recibe no puede envenenarlos, que declaran en el
// manifiesto lo que la batería necesita distinguir, y que servirlos no toca la red.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mundoCongelado, mundosCongelados, fetchDataCongelado } from '../dobles/mundo-congelado.mjs';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

const LOS_CUATRO = ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso'];

function huella(nombre, parte) {
  return createHash('sha256')
    .update(readFileSync(join(RAIZ_REPO, 'test', 'fixtures', 'osm', nombre, `${parte}.json`)))
    .digest('hex');
}

describe('Los fixtures de OSM congelados', () => {
  test('Están los cuatro mundos: costero, urbano denso, barrio de tres calles y suelo de 250 m', () => {
    assert.deepEqual(mundosCongelados(), LOS_CUATRO);
  });

  test('Dos llamadas al mismo mundo congelado devuelven datos idénticos byte a byte', () => {
    for (const nombre of LOS_CUATRO) {
      // Serialización completa, no campo a campo: es lo único que afirma
      // «idéntico byte a byte» de verdad.
      assert.equal(JSON.stringify(mundoCongelado(nombre)), JSON.stringify(mundoCongelado(nombre)), nombre);
    }
  });

  test('Modificar un mundo congelado no toca lo que devuelve la llamada siguiente', () => {
    const antes = JSON.stringify(mundoCongelado('costero'));

    const mio = mundoCongelado('costero');
    mio.geo.elements.push({ type: 'node', id: -1, tags: { intruso: 'sí' } });
    mio.pois.elements.length = 0;
    mio.manifiesto.radio_m = 999999;
    mio.nombre = 'destrozado';

    assert.equal(JSON.stringify(mundoCongelado('costero')), antes);
  });

  test('Pedir un mundo que no existe falla nombrando lo pedido y enumerando los disponibles', () => {
    assert.throws(
      () => mundoCongelado('sanxenxo-de-noche'),
      (e) => {
        assert.match(e.message, /sanxenxo-de-noche/);
        for (const nombre of LOS_CUATRO) assert.match(e.message, new RegExp(nombre));
        return true;
      },
    );
  });

  test('El orden invertido devuelve exactamente los mismos elementos en otro orden de llegada', () => {
    const normal = mundoCongelado('costero');
    const invertido = mundoCongelado('costero', { ordenInvertido: true });

    for (const parte of ['geo', 'pois', 'callejero']) {
      const original = normal[parte].elements;
      assert.equal(Array.isArray(original), true, `${parte} tiene que traer elements`);
      assert.ok(original.length > 1, `${parte} necesita más de un elemento para que invertir signifique algo`);
      assert.deepEqual(invertido[parte].elements, [...original].reverse(), `${parte}: no son los mismos elementos`);
      assert.notDeepEqual(invertido[parte].elements[0], original[0], `${parte}: el orden no ha cambiado`);
    }
    // El manifiesto no se invierte: es metadato, no dato de llegada.
    assert.deepEqual(invertido.manifiesto, normal.manifiesto);
  });

  test('Cada manifiesto declara coordenada, radio, fecha de captura, la consulta literal y el inventario', () => {
    for (const nombre of LOS_CUATRO) {
      const m = mundoCongelado(nombre).manifiesto;

      assert.equal(typeof m.coordenada.lat, 'number', `${nombre}: falta la latitud`);
      assert.equal(typeof m.coordenada.lon, 'number', `${nombre}: falta la longitud`);
      assert.equal(typeof m.radio_m, 'number', `${nombre}: falta el radio`);
      assert.match(m.capturado, /^\d{4}-\d{2}-\d{2}$/, `${nombre}: falta la fecha de captura`);

      for (const consulta of ['geo', 'pois', 'callejero']) {
        const ql = m.consultas[consulta];
        assert.equal(typeof ql, 'string', `${nombre}: falta la consulta ${consulta}`);
        assert.match(ql, /\[out:json\]/, `${nombre}: la consulta ${consulta} no parece Overpass QL literal`);
        // La consulta literal solo sirve si dice contra qué se capturó: si el
        // radio o la coordenada no salen en ella, no se puede reproducir.
        const alrededor = `around:${m.radio_m},${m.coordenada.lat},${m.coordenada.lon}`.replace(/[.]/g, '\\.');
        assert.match(ql, new RegExp(alrededor), `${nombre}: la consulta ${consulta} no cita coordenada y radio`);
      }

      assert.equal(typeof m.inventario.geo.total, 'number', `${nombre}: falta el inventario de geo`);
      assert.equal(typeof m.inventario.pois.total, 'number', `${nombre}: falta el inventario de pois`);
      assert.equal(typeof m.inventario.callejero.total_vias, 'number', `${nombre}: falta el inventario de callejero`);
    }
  });

  test('El fixture del suelo de 250 m declara un radio de 250 m', () => {
    assert.equal(mundoCongelado('suelo-250m').manifiesto.radio_m, 250);
  });

  test('El fixture urbano denso trae locales de adultos y agua potable', () => {
    // Es lo que permite escribir «Los anclajes de adultos se excluyen del pool» y
    // «Un tag masivo no monopoliza un tipo de paraje» sin falsear el dato.
    const inv = mundoCongelado('urbano-denso').manifiesto.inventario.pois;
    assert.ok(inv.locales_adultos.total >= 1, 'sin locales de adultos no se puede afirmar la exclusión');
    assert.ok(inv.locales_adultos.ejemplos.length >= 1, 'el inventario tiene que dar ejemplos identificables');
    assert.ok(inv.agua_potable.total >= 1, 'sin agua potable no se puede afirmar que un tag masivo no monopoliza');
  });

  test('El fixture del barrio de tres calles declara sus componentes conexas y a qué distancia están', () => {
    const c = mundoCongelado('barrio-tres-calles').manifiesto.inventario.callejero;
    assert.ok(c.componentes >= 2, 'el callejero tiene que llegar troceado para que el cosido tenga sentido');
    assert.equal(c.vias_por_componente.length, c.componentes);
    assert.equal(c.distancia_al_vecino_mas_cercano_m.length, c.componentes);
    // Huecos cortos y uno largo: sin las dos cosas no se pueden escribir «Los
    // huecos cortos se cosen» y «Los huecos largos no se cosen» con el mismo mundo.
    assert.ok(c.distancia_minima_entre_componentes_m < 180, 'falta al menos un hueco que coserHuecos deba unir');
    assert.ok(c.distancia_maxima_al_vecino_mas_cercano_m > 180, 'falta al menos un hueco que coserHuecos no deba unir');
  });

  test('Servir un fixture no abre ninguna conexión de red', async () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const nombre of LOS_CUATRO) mundoCongelado(nombre);
      const inyectable = fetchDataCongelado('costero');
      await inyectable.geo();
      await inyectable.pois();
      await inyectable.callejero();
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });

  test('Recapturar un fixture que ya existe se rechaza sin sobrescribir nada', () => {
    const antes = ['manifiesto', 'geo', 'pois', 'callejero'].map((p) => huella('costero', p));

    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'captura-fixtures.mjs'), 'costero'], {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
    });

    assert.equal(r.status, 1, 'recapturar tiene que fallar');
    assert.match(r.stderr, /ya existe/);
    assert.match(r.stderr, /no se sobrescribe|deja de ser un fixture/);

    const despues = ['manifiesto', 'geo', 'pois', 'callejero'].map((p) => huella('costero', p));
    assert.deepEqual(despues, antes, 'la captura rechazada no puede haber tocado un solo byte');
  });
});
