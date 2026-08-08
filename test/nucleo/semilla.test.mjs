// SPEC-003 · La semilla de la partida: su forma, su normalización, su validación
// y las semillas de fase que cuelgan de ella.
//
// docs/testing.md **no tiene ni una característica sobre la semilla como dato**:
// la usa como parámetro de los mundos sembrados y nada más. La propia spec lo
// declara como hueco de la batería (RF-MUNDO-002, marcado ⚠ en el PRD), así que
// todos los casos de este fichero van marcados como hueco en
// test/spec-test-map.json en lugar de citar un escenario que no existe.
//
// Nada de aquí toca la red ni el reloj: la entropía llega inyectada y escrita.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALFABETO_SEMILLA,
  LONGITUD_SEMILLA,
  SIMBOLOS_DE_DATO,
  SUFIJOS_DE_FASE,
  creaSemilla,
  digitoDeControl,
  exigeSemilla,
  formateaSemilla,
  normalizaSemilla,
  semillaDeCelda,
  semillaDeFase,
  semillaDeMapa,
  semillasDeFase,
  validaSemilla,
} from '../../packages/nucleo/core/semilla.js';
import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { creaRejilla } from '../../packages/nucleo/world/rejilla.js';
import { creaMapa } from '../../packages/nucleo/partida/mapa.js';
import {
  ENTROPIA_A,
  ENTROPIA_B,
  SEMILLA_A,
  SEMILLA_B,
  consultaDeFixture,
  consultaVacia,
  coordenadaDe,
} from './celda-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';

describe('La semilla de la partida', () => {
  test('La semilla son dieciséis símbolos del alfabeto declarado en cuatro grupos de cuatro', () => {
    for (const entropia of [ENTROPIA_A, ENTROPIA_B, () => 0.5, () => 0.999]) {
      const semilla = creaSemilla(entropia);
      assert.equal(semilla.length, LONGITUD_SEMILLA, `"${semilla}" no tiene ${LONGITUD_SEMILLA} símbolos`);
      for (const c of semilla) assert.ok(ALFABETO_SEMILLA.includes(c), `"${c}" no está en el alfabeto declarado`);

      const presentada = formateaSemilla(semilla);
      assert.match(presentada, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/, `la forma de presentación de "${semilla}" no son cuatro grupos de cuatro`);
      assert.equal(normalizaSemilla(presentada), semilla, 'la forma de presentación no vuelve a la canónica');
    }
  });

  test('Dos partidas creadas con entropía distinta en la misma calle tienen semillas distintas', () => {
    assert.notEqual(SEMILLA_A, SEMILLA_B);
    // Y no es cosa de dos ejemplos afortunados: la semilla es función de la
    // entropía y de nada más, así que cambiar un solo valor tiene que cambiarla.
    for (let i = 0; i < SIMBOLOS_DE_DATO; i++) {
      const otra = ENTROPIA_A.map((v, k) => (k === i ? (v + 1) % 32 : v));
      assert.notEqual(creaSemilla(otra), SEMILLA_A, `cambiar el valor ${i} de la entropía no cambia la semilla`);
    }
  });

  test('Dos partidas con semillas distintas, el mismo anclaje y los mismos datos difieren en los nombres de al menos un núcleo', async () => {
    const { lat, lon } = coordenadaDe('urbano-denso');
    const mundos = [];
    for (const semilla of [SEMILLA_A, SEMILLA_B]) {
      const mapa = creaMapa({ semilla, lat, lon, tramoM: 2000 });
      const registro = await generaCelda({
        rejilla: mapa.rejilla,
        semilla,
        mapaId: mapa.id,
        celda: { i: 0, j: 0 },
        consultaOsm: consultaDeFixture('urbano-denso'),
      });
      mundos.push({ mapaId: mapa.id, nucleos: registro.mundo.settlements.map((s) => s.name) });
    }
    assert.equal(mundos[0].mapaId, mundos[1].mapaId, 'las dos partidas tenían que compartir anclaje');
    assert.notDeepEqual(mundos[0].nucleos, mundos[1].nucleos, 'ningún núcleo cambia de nombre al cambiar la semilla de partida');
  });

  test('La semilla no contiene ninguna coordenada, ninguna fecha ni ningún identificador del dispositivo', () => {
    // La afirmación fuerte no es que no se vea una coordenada dentro: es que la
    // semilla no depende de dónde ni de cuándo se crea. Con la misma entropía en
    // dos sitios y dos momentos sale la misma cadena, así que no lleva nada de eso.
    assert.equal(creaSemilla(ENTROPIA_A), SEMILLA_A);
    assert.match(SEMILLA_A, new RegExp(`^[${ALFABETO_SEMILLA}]{${LONGITUD_SEMILLA}}$`));
    assert.doesNotMatch(SEMILLA_A, /[.,:@/#-]/, 'la semilla lleva separadores de coordenada, de fecha o de ruta');
    // Ni el módulo tiene por dónde colarlos: no lee el entorno ni el reloj.
    const texto = fuente('packages/nucleo/core/semilla.js');
    for (const puerta of [/\bDate\b/, /\bprocess\b/, /\bnavigator\b/, /\bgetRandomValues\b/, /\brandomUUID\b/]) {
      assert.doesNotMatch(texto, puerta, `core/semilla.js usa ${puerta}`);
    }
  });

  test('Una semilla en minúsculas, con espacios y sin guiones da la misma semilla canónica', () => {
    const presentada = formateaSemilla(SEMILLA_A);
    const maltratada = ` ${presentada.toLowerCase().replace(/-/g, ' ')}\t`;
    assert.equal(normalizaSemilla(maltratada), SEMILLA_A);
    assert.deepEqual(validaSemilla(maltratada), { ok: true, semilla: SEMILLA_A, motivo: null });
    assert.equal(normalizaSemilla(presentada.toLowerCase()), SEMILLA_A);
  });

  test('Una semilla con I por 1 o con O por 0 se acepta y da la misma semilla canónica', () => {
    // Solo tiene sentido probarlo sobre una semilla que lleve esos dígitos: si no,
    // la sustitución no toca nada y el caso pasa sin haber comprobado nada.
    const conDigitos = creaSemilla([1, 0, 1, 0, 1, 0, 12, 5, 1, 0, 20, 1, 0, 7, 1]);
    assert.ok(/[01]/.test(conDigitos), 'la semilla de este caso tiene que llevar ceros o unos');
    const tecleada = conDigitos.replace(/1/g, 'I').replace(/0/g, 'O');
    assert.notEqual(tecleada, conDigitos, 'la sustitución no ha cambiado nada');
    assert.equal(normalizaSemilla(tecleada), conDigitos);
    assert.equal(validaSemilla(tecleada).ok, true, 'la semilla con las confusiones clásicas tenía que aceptarse');
    assert.equal(normalizaSemilla(conDigitos.replace(/1/g, 'l')), conDigitos, 'la L minúscula por 1 también es confusión clásica');
  });

  test('Una cadena con un símbolo fuera del alfabeto se rechaza nombrando el símbolo que sobra', () => {
    for (const intruso of ['U', '$', 'Ñ']) {
      const mala = intruso + SEMILLA_A.slice(1);
      const r = validaSemilla(mala);
      assert.equal(r.ok, false, `"${mala}" se ha aceptado`);
      assert.equal(r.semilla, null);
      assert.ok(r.motivo.includes(intruso), `el motivo no nombra el símbolo que sobra: ${r.motivo}`);
    }
  });

  test('Una semilla mal copiada la rechaza el dígito de control', () => {
    // Cada una de las quince posiciones de dato, con un símbolo del alfabeto
    // distinto del que había: un cambio de un solo símbolo no puede colarse.
    for (let i = 0; i < SIMBOLOS_DE_DATO; i++) {
      const original = SEMILLA_A[i];
      const otro = ALFABETO_SEMILLA[(ALFABETO_SEMILLA.indexOf(original) + 7) % 32];
      const mala = SEMILLA_A.slice(0, i) + otro + SEMILLA_A.slice(i + 1);
      const r = validaSemilla(mala);
      assert.equal(r.ok, false, `"${mala}" (posición ${i}) se ha aceptado con un símbolo cambiado`);
      assert.match(r.motivo, /mal copiada|control/, `el motivo no dice que está mal copiada: ${r.motivo}`);
    }
    assert.equal(digitoDeControl(SEMILLA_A.slice(0, SIMBOLOS_DE_DATO)), SEMILLA_A[SIMBOLOS_DE_DATO]);
  });

  test('Una cadena más corta o más larga de dieciséis símbolos se rechaza nombrando la longitud esperada', () => {
    for (const mala of [SEMILLA_A.slice(0, 15), SEMILLA_A + ALFABETO_SEMILLA[0], SEMILLA_A.slice(0, 4)]) {
      const r = validaSemilla(mala);
      assert.equal(r.ok, false, `"${mala}" se ha aceptado`);
      assert.ok(r.motivo.includes(String(LONGITUD_SEMILLA)), `el motivo no nombra la longitud esperada: ${r.motivo}`);
    }
  });

  test('La entropía de la semilla llega inyectada y no sale de Math.random() ni del reloj', () => {
    const texto = fuente('packages/nucleo/core/semilla.js');
    assert.doesNotMatch(texto, /Math\.random\s*\(/, 'core/semilla.js fabrica azar por su cuenta');
    assert.doesNotMatch(texto, /Date\.now\s*\(|performance\.now\s*\(/, 'core/semilla.js lee el reloj del sistema');
    assert.match(texto, /export function creaSemilla\(entropia\)/, 'la entropía tiene que entrar por la firma');

    // Y sin entropía no hay semilla por defecto: se falla diciéndolo.
    for (const nada of [undefined, null, 42, {}]) {
      assert.throws(() => creaSemilla(nada), /entropía/i, `creaSemilla(${JSON.stringify(nada)}) no ha protestado`);
    }
    assert.throws(() => creaSemilla([1, 2, 3]), /15|quince/, 'una entropía corta tiene que decir cuántos valores hacen falta');
    // Misma entropía, misma semilla: es lo que permite fijarla en una prueba.
    assert.equal(creaSemilla(ENTROPIA_A), creaSemilla([...ENTROPIA_A]));
  });

  test('Cada fase de la tubería recibe un sufijo propio y estable', () => {
    const sufijos = Object.values(SUFIJOS_DE_FASE);
    assert.equal(new Set(sufijos).size, sufijos.length, `dos fases comparten sufijo: ${sufijos.join(', ')}`);
    for (const fase of ['nucleos', 'calzadas', 'parajes', 'titulo', 'casting', 'costura', 'acontecimiento']) {
      assert.ok(SUFIJOS_DE_FASE[fase], `falta el sufijo declarado de la fase ${fase}`);
    }

    const celda = { i: 2, j: -3 };
    const todas = semillasDeFase(SEMILLA_A, '42.41,-8.81', celda);
    assert.deepEqual(Object.keys(todas).sort(), Object.keys(SUFIJOS_DE_FASE).sort());
    assert.equal(new Set(Object.values(todas)).size, Object.keys(todas).length, 'dos fases de la misma celda comparten semilla');
    for (const [fase, valor] of Object.entries(todas)) {
      assert.equal(valor, semillaDeFase(SEMILLA_A, '42.41,-8.81', celda, fase), `la semilla de la fase ${fase} no es estable`);
      assert.ok(valor.startsWith(semillaDeCelda(SEMILLA_A, '42.41,-8.81', celda)), `la fase ${fase} no cuelga de la semilla de la celda`);
    }
    assert.throws(() => semillaDeFase(SEMILLA_A, '42.41,-8.81', celda, 'inventada'), /fase desconocida/);
  });

  test('Dos celdas distintas del mismo mapa tienen semillas de fase distintas', () => {
    const mapaId = '42.41,-8.81';
    const vistas = new Map();
    for (const i of [-1, 0, 1, 7]) {
      for (const j of [-1, 0, 1, 7]) {
        for (const fase of Object.keys(SUFIJOS_DE_FASE)) {
          const s = semillaDeFase(SEMILLA_A, mapaId, { i, j }, fase);
          assert.equal(vistas.has(s), false, `"${s}" se repite: ${vistas.get(s)} y ${i},${j}/${fase}`);
          vistas.set(s, `${i},${j}/${fase}`);
        }
      }
    }
  });

  test('Dos mapas distintos de la misma partida tienen semillas distintas para la misma celda y fase', () => {
    const celda = { i: 0, j: 0 };
    const casa = semillaDeMapa(SEMILLA_A, '42.41,-8.81');
    const vacaciones = semillaDeMapa(SEMILLA_A, '39.86,-4.02');
    assert.notEqual(casa, vacaciones);
    for (const fase of Object.keys(SUFIJOS_DE_FASE)) {
      assert.notEqual(
        semillaDeFase(SEMILLA_A, '42.41,-8.81', celda, fase),
        semillaDeFase(SEMILLA_A, '39.86,-4.02', celda, fase),
        `la fase ${fase} de la celda 0,0 sale igual en dos mapas distintos de la misma partida`,
      );
    }
  });

  test('Generar una celda sin semilla falla nombrando la semilla que falta', async () => {
    const rejilla = creaRejilla({ lat: 42.4071, lon: -8.8093, tramoM: 2000 });
    for (const ausente of [undefined, null, '']) {
      await assert.rejects(
        () => generaCelda({ rejilla, semilla: ausente, mapaId: rejilla.id, celda: { i: 0, j: 0 }, consultaOsm: consultaVacia() }),
        (e) => {
          assert.match(e.message, /semilla/, `el error no nombra la semilla: ${e.message}`);
          assert.match(e.message, /falta|no hay|por defecto/, `el error no dice que falta: ${e.message}`);
          return true;
        },
        `generar con semilla ${JSON.stringify(ausente)} no ha fallado`,
      );
      assert.throws(() => creaMapa({ semilla: ausente, lat: 42.4071, lon: -8.8093, tramoM: 2000 }), /semilla/);
    }
    // Y una semilla presente pero inválida tampoco pasa: generar con una semilla
    // mal copiada es exactamente el mundo distinto en silencio que hay que evitar.
    assert.throws(() => exigeSemilla('K3M7-9QTX-2BVR-5FHY'), /semilla inválida/);
  });
});
