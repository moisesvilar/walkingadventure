// Fila 47 · La partida se guarda y se vuelve a abrir: **la guarda, escrita antes que el
// cableado**, y roja a propósito hasta que la fila se cierre.
//
// Por qué existe, medido el 10-ago-2026 mientras se cableaba la navegación de consulta:
// `congelaEstado` y `levantaEstado` viven en `packages/nucleo/partida/estado.js`, están
// probados de arriba abajo en `partida-completa.test.mjs` y **no los llama nadie desde
// `app/`**. `App.js` construye `estadoInicial({ semilla })` en cada arranque y ese estado
// vive solo en memoria de React. De los cuatro prefijos que `PREFIJOS_DE_LA_PARTIDA`
// declara —`arranque/`, `camara/`, `mapa/`, `partida/`— la app escribe tres: el cuarto,
// que es donde iría el documento de estado, no lo escribe nadie.
//
// Consecuencia, dicha entera: el diario, la repisa, el oro, los motes, las aventuras, las
// entregas, los rumores y los NPCs **se pierden al cerrar la app**. Sobreviven el
// personaje, la semilla y los mapas levantados. Y una copia exportada hoy sale sin
// documento de partida: el respaldo funciona y no respalda nada de lo jugado.
//
// Es la forma de fallo de `decisiones-orquestador.md` §6h en su versión más silenciosa —la
// máquina entera construida, verificada y sin conectar— y por eso se cierra como se
// cerraron las otras siete: **lo que falta se exige, y su ausencia es error de
// construcción, nunca un valor por defecto**. Un comentario no se pone rojo; esto sí.
//
// La fila 39 entregó el mecanismo y su `done` es correcto sobre lo que entregó. Lo que no
// cubrió es el cableado, y eso es esta fila.
//
// **Nada de esto tiene escenario en `docs/testing.md`** todavía: RF-PERS-008 está marcado
// como hueco ⚠ y RF-PERS-003 tiene el suyo sobre el núcleo, no sobre la app. Va anotado
// como hueco de batería en el mapa de cobertura.
//
// Se mira `app/` **desde fuera y leyendo su fuente**, igual que `app.test.mjs` y
// `duradero.test.mjs`: una prueba de `@nucleo` no puede importar la app sin arrastrar
// React Native, y el criterio duro es que esta batería arranque sin `node_modules`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { PREFIJOS_DE_LA_PARTIDA } from '../../packages/nucleo/partida/exportacion.js';

/** Los directorios de `app/` que son código nuestro. Ni compilación ni dependencias. */
const DE_LA_APP = ['datos', 'mapa', 'marcha', 'nucleo', 'pantallas', 'plataforma', 'recursos', 'render', 'salida'];

/** Todos los ficheros de código de la app, con su ruta relativa al repo. */
function ficherosDeLaApp() {
  const salida = ['app/App.js', 'app/index.js'];
  for (const dir of DE_LA_APP) {
    const raiz = join(RAIZ_REPO, 'app', dir);
    let entradas;
    try {
      entradas = readdirSync(raiz);
    } catch {
      continue;
    }
    for (const nombre of entradas) {
      const ruta = join(raiz, nombre);
      if (!statSync(ruta).isFile()) continue;
      if (!/\.(js|jsx)$/.test(nombre)) continue;
      salida.push(relative(RAIZ_REPO, ruta));
    }
  }
  return salida.sort();
}

/** Dónde aparece un nombre dentro del código de la app. Lista vacía si en ningún sitio. */
function dondeSeCita(nombre) {
  const patron = new RegExp(`\\b${nombre}\\b`);
  return ficherosDeLaApp().filter((f) => patron.test(fuente(f)));
}

describe('La partida guardada está cableada de verdad, y no solo construida', () => {
  test('La app congela el estado de la partida', () => {
    // No basta con que exista `congelaEstado`: tiene que llamarlo alguien de `app/`. La
    // pieza que al no estar no protesta es exactamente esta.
    const donde = dondeSeCita('congelaEstado');
    assert.notDeepEqual(
      donde,
      [],
      'ningún fichero de app/ cita congelaEstado: el estado de la partida se compone en memoria y no se escribe nunca, ' +
      'así que el diario, la repisa, el oro, los motes y las aventuras se pierden al cerrar la app. Es la fila 47 del checklist.',
    );
  });

  test('La app levanta el estado de la partida al abrir', () => {
    // La otra mitad, y sin ella escribir no sirve de nada: una partida escrita que nadie
    // lee es indistinguible de una partida que no se escribió.
    const donde = dondeSeCita('levantaEstado');
    assert.notDeepEqual(
      donde,
      [],
      'ningún fichero de app/ cita levantaEstado: aunque se escribiera el estado, al abrir la app se volvería a empezar ' +
      'de estadoInicial. Es la fila 47 del checklist.',
    );
  });

  test('La app escribe el prefijo de la partida, y no solo los otros tres', () => {
    // `PREFIJOS_DE_LA_PARTIDA` es lo que la exportación recorre. Que uno de los cuatro no
    // lo escriba nadie es lo que hace que una copia salga sin nada de lo jugado, y la
    // exportación no puede detectarlo: recorre lo que hay y lo que hay es correcto.
    assert.ok(PREFIJOS_DE_LA_PARTIDA.includes('partida/'), 'el prefijo de la partida ya no se llama así y esta guarda ha quedado desalineada');
    // **En la misma línea**, y no en el mismo fichero. Con el fichero entero esta guarda
    // pasaba en verde por `copia.js`, que hace `almacen.lista('partida/')` —lee, no
    // escribe— y en otro sitio tiene un `escribe`. Una guarda que se cumple por
    // proximidad no es una guarda.
    const escriben = ficherosDeLaApp().filter((f) => fuente(f)
      .split('\n')
      .some((l) => /escribe/.test(l) && /['"`]partida\//.test(l)));
    assert.notDeepEqual(
      escriben,
      [],
      'ningún fichero de app/ escribe bajo el prefijo "partida/", que es donde la exportación busca lo jugado: ' +
      'una copia hecha hoy sale sin documento de partida. El respaldo funciona y no respalda nada de lo jugado. Es la fila 47.',
    );
  });

  test('El área del personaje de la partida la rellena alguien', () => {
    // Esta se puso roja de verdad el 10-ago en el emulador, y por eso está escrita: A6P7
    // pide el nombre al área `personaje` del estado y la encontró en blanco, porque el
    // arranque lo dejaba en una propiedad hermana. Se arregló en SPEC-043 y aquí se fija,
    // porque el área es lo que se congela y lo que se exporta.
    const donde = ficherosDeLaApp().filter((f) => /\.personaje\s*=/.test(fuente(f)));
    assert.notDeepEqual(
      donde,
      [],
      'nadie en app/ rellena el área "personaje" del estado de la partida: lo que se congela y se exporta es el área, ' +
      'así que una partida guardada saldría sin nombre sin que nada protestara',
    );
  });
});
