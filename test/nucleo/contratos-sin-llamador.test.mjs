// Los **contratos de plataforma a los que no llega ningún llamador**: la lista escrita a
// mano en `app/plataforma/contratos.js`, cruzada contra lo que se mide sobre `app/`.
//
// ## Por qué existe
//
// Es `pipeline/decisiones-orquestador.md` §6h en su versión más silenciosa, y en la fila 48
// llegó a su décima aparición: un contrato de plataforma se escribe, se prueba contra un
// doble en `node --test`, sus pruebas pasan **y no lo llama nadie**. Hasta esta fila eran
// cuatro a la vez — `app/plataforma/ubicacion.js`, `app/plataforma/posiciones.js`,
// `app/marcha/seguidor.js` y `app/plataforma/rotulo.android.js` —, así que «sin rótulo una
// salida no se abre» era un comentario y la marca de posición no se había movido nunca.
//
// Poner llamador arregla los cuatro casos de hoy. Esta guarda es lo único que arregla el de
// mañana, y lo hace por el mismo mecanismo que `pantallas-huerfanas.test.mjs` y
// `limite-declarado.test.mjs`: **una lista escrita a mano y dos direcciones de rojo**.
//
// ## Lo que la hace obligar, que es lo que aquí importa
//
// Una lista que solo se lee no obliga a nadie: alguien podría escribir el contrato número
// once, dejarlo sin cablear, no tocar la lista y que nada protestara — que es exactamente
// el fallo que se persigue. Así que esta guarda **descubre los contratos por su forma** y
// después los cruza contra la lista:
//
// - **Rojo 1** · un contrato descubierto, sin llamador y **que no está en la lista**. Es la
//   dirección que obliga: no se puede añadir un contrato sin cablear en silencio.
// - **Rojo 2** · un contrato de la lista **que ya tiene llamador**. Bajar el número es la
//   buena noticia, y tiene que ser un acto con registro y no una limpieza silenciosa.
//
// ## Cómo se mide «tener llamador», y por qué así
//
// Por el **cierre transitivo de imports desde las raíces de la app**, el mismo que usa
// `pantallas-huerfanas.test.mjs` — una sola medida en el repo y no dos — más la exigencia
// de que algún módulo alcanzable **invoque** el `crea…`: que un fichero esté importado no
// significa que su contrato se use, y ese matiz es justo el que separa un contrato cableado
// de uno que solo está en el grafo.
//
// **La pareja de plataforma pide una línea aparte, porque es donde esto se puede volver
// mentira.** `app/marcha/salida-montada.js` importa `creaRotulo` de `'../plataforma/rotulo'`
// sin extensión, y Metro elige entre `rotulo.android.js` y `rotulo.ios.js` al compilar. El
// resolutor de aquí elige la de Android, que es la plataforma que esta máquina compila, así
// que la mitad de iOS queda fuera del cierre. Contarla como «sin llamador» solo por eso
// sería un accidente del resolutor, así que **no se deja en pie sola**: a todo fichero con
// sufijo de plataforma que siga en la lista se le exige que **su propia sonda responda «no
// montada»**. Es lo que hace la entrada verificable en vez de casual, y lo que la saca de
// la lista sola el día que iOS traiga su módulo de ActivityKit: entonces la sonda dirá que
// sí, esto se pondrá rojo y habrá que quitarla a mano.
//
// **Lo que no entra**: los dobles y las implementaciones de Node —`creaAlmacenEnMemoria`,
// `creaFicherosDeNode`— que existen para que la batería corra sin dispositivo. Que la app
// no los llame es su cometido, no una deuda; y no se descubren porque no tienen la forma.
//
// **Nada de esto tiene escenario en `docs/testing.md`**, y es coherente: la batería describe
// qué hace el juego, no cómo está conectado su código. Va como hueco de batería en el mapa.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { CONTRATOS_SIN_LLAMADOR, FICHEROS_SIN_LLAMADOR } from '../../app/plataforma/contratos.js';

/** Dónde viven los contratos de plataforma que esta guarda descubre. */
const DONDE_HAY_CONTRATOS = ['app/plataforma', 'app/marcha'];

/** Las dos raíces desde las que se alcanza todo lo demás. Las mismas de `pantallas-huerfanas`. */
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

/** Todos los ficheros de código de los directorios donde hay contratos. */
function ficherosDeContrato() {
  const salida = [];
  for (const dir of DONDE_HAY_CONTRATOS) {
    for (const nombre of readdirSync(join(RAIZ_REPO, dir)).sort()) {
      if (!/\.(js|jsx)$/.test(nombre)) continue;
      salida.push(`${dir}/${nombre}`);
    }
  }
  return salida;
}

/** Los nombres exportados de un fichero, en orden de aparición. */
function exportados(texto) {
  return [...texto.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
}

/**
 * La forma de un contrato de plataforma: exporta al menos un `creaX` y al menos un
 * `xSinMontar`.
 *
 * Es la forma y no una lista porque es lo que obliga: el contrato número once la tendrá sin
 * que nadie tenga que acordarse de nada. Los dos exportados son las dos mitades del mismo
 * trato — el mecanismo real y la respuesta honesta cuando no está —, y un contrato que
 * tuviera solo la primera es otro problema, que aquí no se persigue.
 */
function esContrato(nombres) {
  return nombres.some((n) => /^crea[A-Z]/.test(n)) && nombres.some((n) => /SinMontar$/.test(n));
}

/** Los contratos que hay hoy en `app/`, descubiertos por su forma. */
function contratosDescubiertos() {
  const salida = [];
  for (const fichero of ficherosDeContrato()) {
    const texto = readFileSync(join(RAIZ_REPO, fichero), 'utf8');
    const nombres = exportados(texto);
    if (!esContrato(nombres)) continue;
    salida.push({ fichero, constructores: nombres.filter((n) => /^crea[A-Z]/.test(n)) });
  }
  return salida;
}

/**
 * Si algún módulo **alcanzable desde las raíces** invoca alguno de los constructores de
 * este fichero.
 *
 * Se exige la invocación y no solo el import: un fichero que está en el grafo porque
 * alguien le importó una constante no tiene cableado su contrato.
 */
function tieneLlamador(contrato, vistas) {
  for (const modulo of vistas) {
    if (modulo === contrato.fichero) continue;
    let texto;
    try {
      texto = readFileSync(join(RAIZ_REPO, modulo), 'utf8');
    } catch {
      continue;
    }
    // El llamador tiene que importar de este fichero, y no de otro que exporte lo mismo.
    const importaDeAqui = [...texto.matchAll(/from\s+'([^']+)'/g)]
      .some(([, especificador]) => resuelve(modulo, especificador) === contrato.fichero);
    if (!importaDeAqui) continue;
    if (contrato.constructores.some((c) => new RegExp(`\\b${c}\\s*\\(`).test(texto))) return modulo;
  }
  return null;
}

describe('Los contratos de plataforma a los que no llega ningún llamador', () => {
  test('La lista de contratos sin llamador es exactamente la que se mide', () => {
    const vistas = alcanzables();
    const declarados = new Set(FICHEROS_SIN_LLAMADOR);

    // Antes de cruzar nada: que el descubrimiento **descubra**. Una forma que no reconoce
    // ningún contrato hace que el cruce pase en vacío, que es la manera silenciosa de que
    // esta guarda deje de obligar — la misma forma de fallo que persigue. Se afirman las
    // dos mitades: que se descubre algo, y que se descubre bastante más que la lista.
    const descubiertos = contratosDescubiertos();
    assert.ok(
      descubiertos.length >= 5,
      `la forma de un contrato de plataforma solo reconoce ${descubiertos.length}: o la convención ha cambiado —`
      + '`creaX` más `xSinMontar`— o el descubrimiento está mirando donde no es, y en los dos casos el cruce de abajo pasa en vacío.',
    );
    assert.ok(
      alcanzables().size > 20,
      'el cierre de imports desde App.js no alcanza casi nada: con el grafo vacío todo contrato parecería sin llamador y esta guarda mentiría en la otra dirección',
    );

    // Rojo 1 · descubierto, sin llamador y sin declarar. La dirección que obliga.
    const sinDeclarar = descubiertos
      .filter((c) => !declarados.has(c.fichero))
      .filter((c) => tieneLlamador(c, vistas) === null)
      .map((c) => `${c.fichero} (${c.constructores.join(', ')})`);
    assert.deepEqual(
      sinDeclarar,
      [],
      `estos contratos de plataforma están escritos y no los llama nadie desde app/: ${sinDeclarar.join(', ')}. ` +
      'Un contrato que nadie llama no está entregado, por muy probado que esté contra un doble: se cablea, o se declara en ' +
      '`app/plataforma/contratos.js` con su dueño y con lo que falta para poder cablearlo.',
    );

    // Rojo 2 · declarado y con llamador. Bajar el número es un acto con registro.
    const yaCableados = [];
    for (const entrada of CONTRATOS_SIN_LLAMADOR) {
      const texto = (() => {
        try { return readFileSync(join(RAIZ_REPO, entrada.fichero), 'utf8'); } catch { return null; }
      })();
      assert.ok(texto !== null, `la lista declara "${entrada.fichero}" y ese fichero no existe`);
      const llamador = tieneLlamador({ fichero: entrada.fichero, constructores: [entrada.contrato] }, vistas);
      if (llamador) yaCableados.push(`${entrada.fichero}::${entrada.contrato} ← ${llamador}`);
    }
    assert.deepEqual(
      yaCableados,
      [],
      `estos contratos ya tienen llamador y siguen declarados como sin cablear: ${yaCableados.join(', ')}. ` +
      'Bajar el número es la buena noticia: quítalos de la lista.',
    );
  });

  test('Cada entrada de la lista nombra un contrato que su fichero exporta, con dueño y motivo', () => {
    assert.ok(CONTRATOS_SIN_LLAMADOR.length > 0, 'la lista está vacía: entonces no puede obligar a nadie, y el día que aparezca un contrato sin cablear no habrá dónde declararlo');
    const vistas = new Set();
    for (const entrada of CONTRATOS_SIN_LLAMADOR) {
      const clave = `${entrada.fichero}::${entrada.contrato}`;
      assert.equal(vistas.has(clave), false, `"${clave}" está dos veces en la lista: un nombre repetido esconde uno que falta`);
      vistas.add(clave);
      const texto = readFileSync(join(RAIZ_REPO, entrada.fichero), 'utf8');
      assert.equal(
        exportados(texto).includes(entrada.contrato),
        true,
        `"${entrada.fichero}" no exporta "${entrada.contrato}": la lista está declarando un contrato que ya no existe con ese nombre`,
      );
      assert.ok(entrada.porque && entrada.porque.length > 20, `"${clave}" no dice qué falta para poder cablearlo`);
      assert.ok(entrada.dueña, `"${clave}" no dice de quién es`);
    }
    // Y las dos vistas de la lista dicen lo mismo: si `FICHEROS_SIN_LLAMADOR` se calculara
    // mal, el cruce de arriba miraría otra cosa que la lista escrita.
    assert.deepEqual([...FICHEROS_SIN_LLAMADOR], CONTRATOS_SIN_LLAMADOR.map((c) => c.fichero));
  });

  test('Un contrato de plataforma que sigue en la lista por su sufijo lo sostiene su propia sonda', async () => {
    // La salvaguarda de la pareja de plataforma, explicada en la cabecera: la mitad que el
    // resolutor deja fuera del cierre no se queda en la lista por accidente, sino porque su
    // sonda dice que lo suyo no está en esta compilación. El día que lo esté, esto se pone
    // rojo y la entrada sale a mano.
    const conSufijo = CONTRATOS_SIN_LLAMADOR.filter((c) => /\.(ios|android)\.js$/.test(c.fichero));
    for (const entrada of conSufijo) {
      const modulo = await import(`../../${entrada.fichero}`);
      assert.ok(modulo.rotulo?.sonda || modulo.capacidad?.sonda, `"${entrada.fichero}" no expone ninguna sonda con la que sostener su entrada en la lista`);
      const sonda = (modulo.rotulo ?? modulo.capacidad).sonda;
      const respuesta = await sonda();
      assert.equal(
        respuesta.montado,
        false,
        `"${entrada.fichero}" declara su capacidad montada y sigue en la lista de contratos sin llamador: si el módulo nativo ya está, ` +
        'la mitad de esta plataforma sí tiene llamador y la entrada sobra.',
      );
      assert.ok(respuesta.motivo && respuesta.motivo.length > 20, `"${entrada.fichero}" dice que no está montado y no dice qué falta`);
    }
  });
});
