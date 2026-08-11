// El recuento de **pantallas huérfanas**: las que están escritas en `app/pantallas/` y a
// las que no llega ningún import desde la raíz de la app.
//
// Por qué existe. El 10-ago-2026, al buscar por qué doce flujos de `@app` no recorrían
// nada, se contó cuántas de las dieciséis filas de B5 y B6 habían entregado solo núcleo:
// **dos**, SPEC-034 y SPEC-036. Ese número dice poco. El que sí dice algo se saca del
// cierre transitivo de imports desde `App.js`, y era **12 de 32**: doce pantallas escritas,
// probadas en Node y a las que no llegaba ni un `import`. Es decir, el defecto sistemático
// no era que las filas no entregaran pantalla — doce de dieciséis la entregaron — sino que
// **una fila podía entregar una pantalla y darse por hecha sin que nadie pudiera abrirla**.
//
// Eso es §6h en la escala más grande que ha tenido en este repo, y se cierra como se han
// cerrado las otras: por contrato y con un número. Esta prueba fija el recuento actual y
// **falla si sube**. No exige que sea cero —no lo es, y las que quedan tienen dueño
// escrito—: exige que nadie añada una pantalla huérfana más sin que se vea.
//
// Cuando una fila conecte una pantalla, este número baja y hay que bajarlo aquí a mano.
// Que haya que tocarlo es la gracia: es lo que convierte conectar una pantalla en un acto
// con registro, igual que el marcador de `limite-declarado.test.mjs`.
//
// **Nada de esto tiene escenario en `docs/testing.md`**, y es coherente: la batería
// describe qué hace el juego, no cómo está conectado su código. Va como hueco de batería.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

/**
 * Las pantallas que hoy no alcanza nadie, con su dueño. Se escribe a mano y en orden
 * alfabético, igual que la lista de flujos de límite declarado y por lo mismo: si se
 * descubriera sola, añadir una huérfana no costaría nada.
 *
 * Queda **una**, y es `zurron`: necesita la fuente de salud, el motor de pasos y el
 * registro de hechos, que son de la fila 46.
 *
 * SPEC-044 se llevó las otras siete. Seis eran las del momento «al parar» —`llegada`,
 * `visor`, `ficha`, `lo-que-se-cuenta`, `descarte`, `triangulacion`—, que estaban escritas y
 * probadas en Node desde las filas 32, 33, 35 y 37 y a las que no llegaba ni un import
 * porque nadie había cableado la máquina de una salida. La séptima es `sitios-marcados`, que
 * es de la fila 38 y **el cierre transitivo la alcanza**: el camino de deshacer un descarte
 * pasa por ella, así que baja de ocho a una y no a dos como se preveía. **El número que se
 * publica es el medido**, no el previsto.
 */
const HUERFANAS = [
  'app/pantallas/zurron.jsx',
];

/** Las dos raíces desde las que se alcanza todo lo demás. */
const RAICES = ['app/App.js', 'app/index.js'];

/** Resuelve un import relativo a un fichero del repo, con los sufijos de plataforma. */
function resuelve(desde, especificador) {
  if (!especificador.startsWith('.')) return null;
  const base = normalize(join(dirname(desde), especificador));
  for (const candidato of [base, `${base}.js`, `${base}.jsx`]) {
    try {
      if (statSync(join(RAIZ_REPO, candidato)).isFile()) return candidato;
    } catch { /* sigue probando */ }
  }
  // Metro elige la implementación por sufijo y el import va sin él.
  const sinExt = base.endsWith('.js') ? base.slice(0, -3) : base;
  for (const sufijo of ['.android.js', '.ios.js']) {
    try {
      if (statSync(join(RAIZ_REPO, sinExt + sufijo)).isFile()) return sinExt + sufijo;
    } catch { /* sigue probando */ }
  }
  return null;
}

/** El cierre transitivo de imports desde las raíces de la app. */
function alcanzables() {
  const vistos = new Set();
  const pila = [...RAICES];
  while (pila.length) {
    const fichero = pila.pop();
    if (vistos.has(fichero)) continue;
    let texto;
    try {
      texto = readFileSync(join(RAIZ_REPO, fichero), 'utf8');
    } catch {
      continue;
    }
    vistos.add(fichero);
    for (const [, especificador] of texto.matchAll(/from\s+'([^']+)'/g)) {
      const destino = resuelve(fichero, especificador);
      if (destino) pila.push(destino);
    }
  }
  return vistos;
}

/** Todas las pantallas escritas. */
function todasLasPantallas() {
  return readdirSync(join(RAIZ_REPO, 'app', 'pantallas'))
    .filter((n) => n.endsWith('.js') || n.endsWith('.jsx'))
    .map((n) => `app/pantallas/${n}`)
    .sort();
}

describe('Las pantallas que nadie puede abrir', () => {
  test('La lista de pantallas huérfanas es exactamente la declarada', () => {
    const vistas = alcanzables();
    const medidas = todasLasPantallas().filter((p) => !vistas.has(p));
    const declaradas = new Set(HUERFANAS);

    const nuevas = medidas.filter((p) => !declaradas.has(p));
    assert.deepEqual(
      nuevas,
      [],
      `estas pantallas están escritas y no las alcanza ningún import desde App.js: ${nuevas.join(', ')}. ` +
      'Una pantalla que nadie puede abrir no está entregada, por muy probada que esté en Node: se conecta, o se declara aquí con su dueño.',
    );

    const conectadas = HUERFANAS.filter((p) => vistas.has(p));
    assert.deepEqual(
      conectadas,
      [],
      `estas pantallas ya se alcanzan desde App.js y siguen declaradas como huérfanas: ${conectadas.join(', ')}. ` +
      'Bajar el número es la buena noticia: quítalas de la lista.',
    );
  });

  test('El recuento es el medido y no ha subido', () => {
    // El número, en crudo y a la vista. El 10-ago-2026 eran 12 de 32, la fila 43 lo dejó en
    // 8 y la 44 en **1 de 33**; si alguien lo sube, esto lo dice con las dos cifras delante.
    const vistas = alcanzables();
    const todas = todasLasPantallas();
    const huerfanas = todas.filter((p) => !vistas.has(p));
    assert.equal(
      huerfanas.length,
      HUERFANAS.length,
      `hay ${huerfanas.length} pantallas huérfanas de ${todas.length} y la lista declara ${HUERFANAS.length}`,
    );
  });
});
