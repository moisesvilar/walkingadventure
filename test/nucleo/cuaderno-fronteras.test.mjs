// SPEC-054 · Guardas estructurales de producción y privacidad. docs/testing.md no trae
// escenarios específicos para esta herramienta de desarrollo.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { partesDeLaPartida, PREFIJOS_DE_LA_PARTIDA } from '../../packages/nucleo/partida/exportacion.js';
import { fuente } from './mundo-de-prueba.mjs';

test('El cuaderno vive bajo un único prefijo de caché y fuera de documentos y partida', () => {
  const adaptador = fuente('app/desarrollo/cuaderno-del-dispositivo.js');
  assert.match(adaptador, /new Directory\(Paths\.cache, CARPETA\)/);
  assert.match(adaptador, /const CARPETA = 'cuaderno-de-a-bordo'/);
  assert.doesNotMatch(adaptador, /Paths\.document|partida\//);
  assert.deepEqual(PREFIJOS_DE_LA_PARTIDA, ['arranque/', 'camara/', 'mapa/', 'partida/']);
});

test('Una copia y una exportación excluyen coordenadas y sitios del cuaderno', async () => {
  const documentos = new Map([
    ['partida/estado.json', '{"clase":"estado"}'],
    ['cache/cuaderno-de-a-bordo/cuaderno-de-a-bordo.jsonl', '{"lat":42.4,"lon":-8.81,"sitio":"Casa real"}\n'],
  ]);
  const pedidos = [];
  const almacen = {
    async lista(prefijo) { pedidos.push(prefijo); return [...documentos.keys()].filter((k) => k.startsWith(prefijo)); },
    async lee(clave) { return documentos.get(clave) ?? null; },
    async escribe(clave, valor) { documentos.set(clave, valor); },
    async borra(clave) { documentos.delete(clave); },
  };
  const { partes } = await partesDeLaPartida({ almacen });
  const volcado = JSON.stringify(partes);
  assert.deepEqual(pedidos, PREFIJOS_DE_LA_PARTIDA);
  assert.doesNotMatch(volcado, /42\.4|-8\.81|Casa real|cuaderno-de-a-bordo/);

  const copia = fuente('app/plataforma/ficheros.js');
  assert.match(copia, /directorioDeLaPartida/);
  assert.doesNotMatch(copia, /cuaderno-de-a-bordo/);
});

test('En producción el cuaderno no se registra ni deja símbolos alcanzables', () => {
  const app = fuente('app/App.js');
  assert.match(app, /const EN_DESARROLLO = typeof __DEV__ !== 'undefined' && __DEV__/);
  assert.doesNotMatch(app, /^import .*cuaderno/m);
  assert.match(app, /const creaCuadernoDelDispositivo = EN_DESARROLLO\s*\? require\('\.\/desarrollo\/cuaderno-del-dispositivo\.js'\)[\s\S]*?: null/);
  assert.match(app, /const CuadernoEnAndamiaje = EN_DESARROLLO\s*\? require\('\.\/desarrollo\/cuaderno-en-andamiaje\.jsx'\)[\s\S]*?: null/);
  assert.match(app, /creaCuadernoDelDispositivo \? creaCuadernoDelDispositivo\(\) : null/);
});

test('El bloque del andamiaje declara todos los selectores y el aviso literal de privacidad', () => {
  const ui = fuente('app/desarrollo/cuaderno-en-andamiaje.jsx');
  for (const id of ['cuaderno-de-a-bordo', 'cuaderno-interruptor', 'cuaderno-estado', 'cuaderno-compartir', 'cuaderno-provocar-error', 'cuaderno-provocar-rechazo', 'cuaderno-privacidad']) {
    assert.match(ui, new RegExp(`testID=["']${id}["']`));
  }
  assert.match(ui, /Contiene posiciones y sitios reales\. La app no lo envía: solo sale de este aparato si pulsas compartir\./);
  assert.match(ui, /disabled=!\{?estado\.tieneContenido|disabled=\{!estado\.tieneContenido\}/);
  assert.match(ui, /disabled=\{!estado\.encendido\}/);
});
