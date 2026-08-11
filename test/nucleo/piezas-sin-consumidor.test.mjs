// Los **bloques de `app/nucleo/piezas.js` que no consume nadie**: lo que entra por la puerta
// del núcleo cruzado contra lo que cada módulo de `app/` enumera en su `DEL_NUCLEO`.
//
// ## Por qué existe
//
// Es `pipeline/decisiones-orquestador.md` §6h en su tercera variante, y en SPEC-049 llegó a su
// decimotercera aparición contando las tres anteriores: una pieza del núcleo se importa, se
// mete en un bundle de `piezas.js`, se prueba contra el paquete **y no la llama nadie**.
// `contratos-sin-llamador.test.mjs` no la ve, porque aquella guarda descubre contratos de
// plataforma por su forma `creaX`/`xSinMontar` y esto no la tiene.
//
// Lo que sí tiene forma es lo otro: **`piezas.js` enumera lo que la app toma del núcleo y cada
// módulo enumera en su `DEL_NUCLEO` lo que consume**, así que cruzar las dos listas es barato y
// no pide ningún marcador nuevo. Una pieza que entra por `piezas.js` y no aparece en ningún
// `DEL_NUCLEO` es una pieza que nadie pide.
//
// ## Lo que la hace obligar
//
// Dos direcciones de rojo, como en `pantallas-huerfanas.test.mjs` y `limite-declarado.test.mjs`:
//
// - **Rojo 1** · un bloque con piezas sin consumidor **que no está en la lista**. Es la
//   dirección que obliga: no se puede meter una pieza sin cablear en silencio.
// - **Rojo 2** · un bloque de la lista **cuyas piezas ya se consumen todas**. Bajar el número
//   es la buena noticia, y tiene que ser un acto con registro y no una limpieza silenciosa.
//
// ## Lo que esta guarda **no** dice
//
// No dice que el bundle se importe: eso lo mide el cierre transitivo de
// `contratos-sin-llamador.test.mjs`. Dice que sus piezas se piden por su nombre, que es lo que
// separa «este módulo está en el grafo» de «este módulo usa lo que le dieron». Y no mira los
// bundles cuyo consumidor enumera con **dos** listas —`levantamiento.js` declara `DEL_NUCLEO` y
// `DEL_NUCLEO_PARA_ANDAR` porque no todo el que monta esa orquestación anda—: las dos se leen,
// que es por lo que el patrón del nombre es `DEL_NUCLEO*` y no `DEL_NUCLEO`.
//
// **Nada de esto tiene escenario en `docs/testing.md`**, y es coherente: la batería describe qué
// hace el juego, no cómo está conectado su código. Va como hueco de batería en el mapa.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

/**
 * Los bloques de `piezas.js` cuyas piezas **no las pide nadie**, con su dueño. Se escribe a
 * mano, igual que la lista de pantallas huérfanas y por lo mismo: si se descubriera sola,
 * añadir un bundle muerto no costaría nada.
 *
 * Queda **uno**, y lo destapó esta guarda al escribirse:
 *
 * - `NUCLEO_DEL_OFRECIMIENTO` — las cinco piezas de A2P0, el ofrecimiento de levantar un mapa
 *   cuando no hay ninguno activo. `componeOfrecimiento` y `hayQueOfrecerMapa` **no los llama
 *   nadie desde `app/`**, y el bundle entero no lo importa ningún fichero:
 *   `antes-de-salir.jsx` recibe `ofrecimiento` como propiedad y quien lo monta nunca se la
 *   pasa, así que la pantalla existe, está probada y **es inalcanzable**. Es de la fila de los
 *   mapas (SPEC-041) y no de SPEC-049, que se limitó a medirlo.
 */
const BLOQUES_SIN_CONSUMIDOR = [
  'NUCLEO_DEL_OFRECIMIENTO',
];

/** Dónde vive la puerta del núcleo, y desde dónde se mide quién pide qué. */
const PIEZAS = 'app/nucleo/piezas.js';
const RAIZ_APP = 'app';

/** Todos los ficheros de código de la app, en orden estable. */
function ficherosDeLaApp(dir = RAIZ_APP, salida = []) {
  for (const nombre of readdirSync(join(RAIZ_REPO, dir)).sort()) {
    const ruta = `${dir}/${nombre}`;
    if (statSync(join(RAIZ_REPO, ruta)).isDirectory()) ficherosDeLaApp(ruta, salida);
    else if (/\.(js|jsx)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

const texto = (ruta) => readFileSync(join(RAIZ_REPO, ruta), 'utf8');

/** Los bloques `export const NUCLEO_… = Object.freeze({ … })` de `piezas.js`, con sus claves. */
function bloquesDePiezas() {
  const fuente = texto(PIEZAS);
  const bloques = new Map();
  for (const [, nombre, cuerpo] of fuente.matchAll(/export const (NUCLEO_[A-Z_]+) = Object\.freeze\(\{([\s\S]*?)\n\}\);/g)) {
    // Las claves del primer nivel: `pieza,` y `pieza: otroNombre,`. El renombrado importa —hay
    // dos `componeEscena` distintos en el paquete— y lo que se pide es **la clave**, que es lo
    // que el consumidor enumera.
    bloques.set(nombre, [...cuerpo.matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_]*)\s*[,:]/gm)].map((m) => m[1]));
  }
  return bloques;
}

/** Todo lo que algún módulo de `app/` enumera como suyo, en cualquier lista `DEL_NUCLEO*`. */
function loQuePideAlguien() {
  const pedidas = new Set();
  for (const ruta of ficherosDeLaApp()) {
    if (ruta === PIEZAS) continue;
    for (const [, lista] of texto(ruta).matchAll(/export const DEL_NUCLEO[A-Z_]* = Object\.freeze\(\[([\s\S]*?)\]\)/g)) {
      for (const [, pieza] of lista.matchAll(/'([^']+)'/g)) pedidas.add(pieza);
    }
  }
  return pedidas;
}

describe('Lo que entra por la puerta del núcleo lo pide alguien', () => {
  test('La lista de bloques sin consumidor es exactamente la que se mide', () => {
    const bloques = bloquesDePiezas();
    assert.ok(bloques.size >= 10, `solo se han encontrado ${bloques.size} bloques en ${PIEZAS} y hay más de diez: el patrón de lectura se ha quedado atrás`);

    const pedidas = loQuePideAlguien();
    assert.ok(pedidas.size >= 100, `solo se han encontrado ${pedidas.size} piezas pedidas y se midieron más de cien: alguna lista DEL_NUCLEO se ha dejado de leer`);

    const medidos = [...bloques]
      .filter(([, claves]) => claves.some((clave) => !pedidas.has(clave)))
      .map(([nombre]) => nombre)
      .sort();

    const declarados = new Set(BLOQUES_SIN_CONSUMIDOR);
    const sobran = medidos.filter((n) => !declarados.has(n));
    const faltan = BLOQUES_SIN_CONSUMIDOR.filter((n) => !medidos.includes(n));

    assert.deepEqual(
      sobran,
      [],
      `estos bloques de ${PIEZAS} traen piezas que no pide ningún DEL_NUCLEO de app/: ${sobran.join(', ')}. ` +
        'Meter una pieza sin cablear es la forma silenciosa de §6h: o se cablea, o se añade aquí a mano con su dueño.',
    );
    assert.deepEqual(
      faltan,
      [],
      `estos bloques están en BLOQUES_SIN_CONSUMIDOR y ya se consumen enteros: ${faltan.join(', ')}. ` +
        'Bajar el número es la buena noticia y se hace aquí, para que sea un acto con registro.',
    );

    // Y la lista es lista, no multiconjunto: un nombre repetido esconde uno que falta.
    assert.equal(new Set(BLOQUES_SIN_CONSUMIDOR).size, BLOQUES_SIN_CONSUMIDOR.length);
  });

  test('Las piezas sin consumidor de cada bloque declarado se pueden nombrar una a una', () => {
    // Que el bloque esté en la lista no basta: hay que poder decir **cuáles** son las piezas
    // que nadie pide, porque si no la entrada se convierte en un permiso para todo el bloque.
    const bloques = bloquesDePiezas();
    const pedidas = loQuePideAlguien();

    const huerfanas = {
      NUCLEO_DEL_OFRECIMIENTO: ['ACCIONES_DEL_OFRECIMIENTO', 'TESTIDS_DE_MAPAS', 'ALCANCE_EN_TRAMOS', 'componeOfrecimiento', 'hayQueOfrecerMapa'],
    };
    assert.deepEqual(Object.keys(huerfanas).sort(), [...BLOQUES_SIN_CONSUMIDOR].sort(), 'la lista de bloques y el detalle de sus piezas se han desincronizado');

    for (const [nombre, esperadas] of Object.entries(huerfanas)) {
      const claves = bloques.get(nombre);
      assert.ok(claves, `${nombre} ya no existe en ${PIEZAS}: si se ha retirado, quítalo también de BLOQUES_SIN_CONSUMIDOR`);
      assert.deepEqual(
        claves.filter((c) => !pedidas.has(c)),
        esperadas,
        `las piezas de ${nombre} que nadie pide han cambiado`,
      );
    }
  });

  test('El bloque sin consumidor tampoco lo importa nadie, que es la mitad que lo explica', () => {
    // Una pieza que nadie pide podría estar en un bundle que sí se usa —y entonces sería solo
    // una pieza de más—. Aquí no: el bundle entero no lo importa ningún fichero de `app/`, así
    // que A2P0 no la monta nadie. Se dice porque es lo que convierte el número en un hallazgo.
    for (const nombre of BLOQUES_SIN_CONSUMIDOR) {
      const quienes = ficherosDeLaApp().filter((ruta) => ruta !== PIEZAS && texto(ruta).includes(nombre));
      assert.deepEqual(quienes, [], `${nombre} sí lo importa alguien (${quienes.join(', ')}): entonces lo que sobra son sus piezas, no el bloque`);
    }
  });
});
