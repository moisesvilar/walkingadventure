// El contrato del marcador `@limite-declarado` de los flujos de `test/app/`.
//
// Existe por §6w de `pipeline/decisiones-orquestador.md`, y por la misma razón que
// `exigeGrafo` en §6h: **una pieza que, al no estar, no protesta**. Trece de los
// dieciséis flujos de `@app` pasan en 9-10 s sin recorrer ninguna pantalla —lo único
// que ejecutan es una guarda que comprueba que su pantalla sigue sin existir— y el
// runner los sumaba en la misma casilla que los tres que recorren la app de verdad.
// Lo que dicen esos flujos es honesto; sumarlo con lo demás no lo era.
//
// La decisión fue cerrarlo **por contrato y no por vigilancia**: cada flujo de límite
// se declara con una línea exacta en su cabecera, y esta prueba fija **la lista
// literal** de los que la llevan. Así, marcar uno nuevo obliga a tocar esta lista, y
// desmarcarlo el día que haya camino hasta su pantalla, también. Las dos direcciones
// son rojo: un marcador que la lista no conoce, y un nombre de la lista cuyo fichero ya
// no está marcado.
//
// **Nada de esto tiene escenario en `docs/testing.md`**, y es coherente: la batería
// describe qué hace el juego, no cómo se cuentan sus pruebas. Las entradas del mapa van
// marcadas como hueco de batería.
//
// Lo que esta prueba NO afirma, a propósito: que las pantallas existan. Precisamente
// afirma lo contrario —que hoy no hay camino hasta ellas— y su día de morir es el día
// en que alguien monte la orquestación de B5 en `app/` y estos ficheros se desmarquen
// uno a uno.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { fuente } from './mundo-de-prueba.mjs';

/**
 * La lista exacta de flujos de `@app` cuyo verde significa «el límite sigue en pie» y
 * no «la pantalla funciona». Se escribe a mano y en orden alfabético a propósito: si se
 * descubriera leyendo el directorio, marcar un flujo nuevo no costaría nada y el
 * marcador dejaría de ser un acto deliberado, que es lo único que aporta.
 *
 * Los seis que NO están, y por qué:
 *
 * - `arranque.yaml` recorre la app entera, de A1P1 a A1P7.
 * - `antes-de-salir.yaml` y `zurron.yaml` no tienen guarda ninguna: empiezan con
 *   `runFlow: file: arranque.yaml` y siguen recorriendo. Su rojo es rojo de verdad.
 * - `ajustes.yaml` y `empezar-de-nuevo.yaml` **salieron de esta lista con la fila 43**,
 *   que montó el momento de consulta: se entra por `puerta-ajustes`, que es la del pie de
 *   la portada, y desde ahí a A6P7. Recorrido medido en `wa-pixel` el 10-ago-2026.
 * - `en-marcha.yaml` **salió de esta lista con la fila 48**, que cableó el módulo de
 *   ubicación y el rótulo del sistema: «Salir a andar sin más» abre una salida de verdad y
 *   deja el momento en marcha en pantalla. Recorrido medido en `wa-pixel` el 11-ago-2026,
 *   **103 s de principio a fin** con el arranque entero dentro — un flujo que tarda diez
 *   segundos no ha recorrido nada, y este recorre. Lo que el flujo no puede comprobar y por
 *   qué está escrito en su cabecera, medido y no supuesto.
 *
 * La columna pasa de nueve a ocho, y sale **uno solo**: `llegada.yaml`, `visor.yaml` y
 * `descarte.yaml` dependen del camino de la llegada, que es la fila 44 entera.
 */
const FLUJOS_DE_LIMITE_DECLARADO = [
  'ajustes-filas-de-valor.yaml',
  'descarte.yaml',
  'diario.yaml',
  'escena.yaml',
  'llegada.yaml',
  'mapas.yaml',
  'repisa.yaml',
  'visor.yaml',
];

/** La línea de marcador, literal. Se compara con `===` sobre la línea recortada. */
const MARCADOR = '# @limite-declarado';

/**
 * Los flujos que Maestro ejecuta. `.gitkeep` y cualquier otra cosa que no sea `.yaml`
 * quedan fuera.
 */
function todosLosFlujos() {
  // Desde `RAIZ_REPO` y no desde el directorio de trabajo: el runner enumera ficheros y
  // los lanza desde la raíz, pero un `node --test` a mano puede salir de cualquier sitio,
  // y una prueba que dependa del `cwd` se cae por dónde la lanzaste y no por lo que mide.
  return readdirSync(join(RAIZ_REPO, 'test', 'app'))
    .filter((n) => n.endsWith('.yaml'))
    .sort();
}

/** La cabecera de un flujo: todo lo anterior al `---` que abre la lista de comandos. */
function cabecera(texto) {
  const lineas = texto.split('\n');
  const corte = lineas.indexOf('---');
  return (corte === -1 ? lineas : lineas.slice(0, corte)).join('\n');
}

/** La lista de comandos de un flujo: todo lo posterior al `---`. */
function comandos(texto) {
  const lineas = texto.split('\n');
  const corte = lineas.indexOf('---');
  assert.notEqual(corte, -1, 'el flujo no tiene el `---` que separa configuración de comandos');
  return lineas.slice(corte + 1);
}

/**
 * Los comandos del primer nivel, con su nombre y sus líneas. Un comando de primer nivel
 * empieza en columna cero con `- `; todo lo que va indentado debajo es suyo. No hace
 * falta un analizador de YAML —el repo no tiene dependencias— porque lo que se necesita
 * saber es exactamente esto: qué se ejecuta sin condición.
 */
function comandosDePrimerNivel(texto) {
  const bloques = [];
  for (const linea of comandos(texto)) {
    const abre = linea.match(/^- ([A-Za-z]\w*)/);
    if (abre) bloques.push({ nombre: abre[1], lineas: [linea] });
    else if (bloques.length && linea.trim() !== '' && !linea.trimStart().startsWith('#')) {
      bloques[bloques.length - 1].lineas.push(linea);
    }
  }
  return bloques;
}

/** Todo lo que afirma algo sobre la pantalla, y por tanto verifica la app. */
const AFIRMA = /^(assert|copyTextFrom|extendedWaitUntil)/;

/** Todo lo que toca la app: si se ejecuta sin condición, el flujo está recorriendo. */
const RECORRE = /^(tapOn|swipe|scroll|back|openLink|setOrientation|inputText|pressKey|stopApp)/;

describe('El marcador de límite declarado de los flujos de @app', () => {
  test('La lista de flujos de límite declarado es exactamente la que está marcada', () => {
    const marcados = todosLosFlujos().filter((f) =>
      cabecera(fuente(`test/app/${f}`))
        .split('\n')
        .some((l) => l.trim() === MARCADOR),
    );

    const declarados = new Set(FLUJOS_DE_LIMITE_DECLARADO);
    const sobran = marcados.filter((f) => !declarados.has(f));
    const faltan = FLUJOS_DE_LIMITE_DECLARADO.filter((f) => !marcados.includes(f));

    assert.deepEqual(
      sobran,
      [],
      `estos flujos llevan «${MARCADOR}» y no están en FLUJOS_DE_LIMITE_DECLARADO: ${sobran.join(', ')}. ` +
        'Marcar un flujo es declarar que su verde no verifica ninguna pantalla: se añade aquí a mano, o se quita el marcador.',
    );
    assert.deepEqual(
      faltan,
      [],
      `estos flujos están en FLUJOS_DE_LIMITE_DECLARADO y ya no llevan «${MARCADOR}»: ${faltan.join(', ')}. ` +
        'Si es porque ya hay camino hasta su pantalla, quítalos también de la lista; si no, devuelve el marcador.',
    );

    // Y la lista es lista, no multiconjunto: un nombre repetido esconde uno que falta.
    assert.equal(new Set(FLUJOS_DE_LIMITE_DECLARADO).size, FLUJOS_DE_LIMITE_DECLARADO.length);
  });

  test('Cada flujo de la lista existe y su marcador está en la cabecera', () => {
    for (const fichero of FLUJOS_DE_LIMITE_DECLARADO) {
      const texto = fuente(`test/app/${fichero}`);
      const lineas = cabecera(texto).split('\n');
      const donde = lineas.findIndex((l) => l.trim() === MARCADOR);
      assert.notEqual(donde, -1, `${fichero}: el marcador no está en la cabecera, antes del \`---\``);
      // Arriba del todo, donde se lee sin desplegar nada. No es cosmética: un marcador
      // enterrado a mitad de fichero se lee como una nota más.
      assert.ok(donde < 6, `${fichero}: el marcador está en la línea ${donde + 1} de la cabecera; va arriba, junto al título`);
      // Y explicado: la línea sola diría qué pasa y no por qué.
      assert.ok(
        lineas.slice(donde + 1, donde + 12).some((l) => l.includes('no recorre')),
        `${fichero}: el marcador no va seguido de la explicación de por qué no hay camino hasta su pantalla`,
      );
    }
  });

  test('Todo flujo marcado lleva su guarda de límite', () => {
    for (const fichero of FLUJOS_DE_LIMITE_DECLARADO) {
      const bloques = comandosDePrimerNivel(fuente(`test/app/${fichero}`));
      const guardas = bloques.filter((b) => b.nombre === 'runFlow' && b.lineas.join('\n').includes('notVisible:'));
      assert.equal(guardas.length, 1, `${fichero}: se esperaba exactamente una guarda \`runFlow / when / notVisible\` en el primer nivel, hay ${guardas.length}`);

      const guarda = guardas[0].lineas.join('\n');
      const pantalla = guarda.match(/notVisible:\s*\n\s*id: '([^']+)'/);
      assert.ok(pantalla, `${fichero}: la guarda no condiciona sobre el identificador de ninguna pantalla`);

      // Las dos mitades de lo que la guarda afirma: que la app abrió donde abre, y que
      // la pantalla de este flujo sigue sin estar. Sin la primera, un flujo con la app
      // caída pasaría igual; sin la segunda, no se estaría comprobando el límite.
      assert.match(guarda, /assertVisible:\s*\n\s*id: 'arranque'/, `${fichero}: la guarda no comprueba que la app abre en el arranque`);
      assert.ok(
        new RegExp(`assertNotVisible:\\s*\\n\\s*id: '${pantalla[1]}'`).test(guarda),
        `${fichero}: la guarda no comprueba que \`${pantalla[1]}\` sigue sin estar a la vista`,
      );

      // Y el cuerpo de verdad sigue ahí, colgando de la condición contraria: un flujo de
      // límite que hubiera perdido su cuerpo ya no volvería solo el día que haya camino.
      const contrarias = bloques.filter((b) => b.nombre === 'runFlow' && new RegExp(`visible:\\s*\\n\\s*id: '${pantalla[1]}'`).test(b.lineas.join('\n')));
      assert.ok(
        contrarias.some((b) => !b.lineas.join('\n').includes('notVisible:')),
        `${fichero}: no queda ningún \`runFlow\` condicionado a que \`${pantalla[1]}\` sí esté a la vista`,
      );
    }
  });

  test('Ningún flujo marcado afirma nada fuera de una condición', () => {
    for (const fichero of FLUJOS_DE_LIMITE_DECLARADO) {
      const bloques = comandosDePrimerNivel(fuente(`test/app/${fichero}`));

      // En el primer nivel solo se admiten `launchApp` y `runFlow` condicionados. Todo
      // lo demás —una afirmación suelta, un toque, un enlace profundo— se ejecutaría
      // siempre, y entonces el verde ya no significaría solo «el límite sigue en pie».
      const sueltos = bloques.filter((b) => AFIRMA.test(b.nombre) || RECORRE.test(b.nombre));
      assert.deepEqual(
        sueltos.map((b) => b.nombre),
        [],
        `${fichero}: hay comandos en el primer nivel que se ejecutan siempre (${sueltos.map((b) => b.nombre).join(', ')}). ` +
          'Un flujo de límite declarado no verifica nada: todo lo que afirme o toque tiene que colgar de una condición.',
      );

      // Y todo `runFlow` de primer nivel es condicional: uno sin `when` sería el mismo
      // agujero por otro camino.
      for (const b of bloques.filter((x) => x.nombre === 'runFlow')) {
        assert.ok(b.lineas.join('\n').includes('when:'), `${fichero}: hay un \`runFlow\` de primer nivel sin \`when\``);
      }

      // Un `launchApp` como mucho, y nada más antes de la guarda.
      const arranques = bloques.filter((b) => b.nombre === 'launchApp');
      assert.equal(arranques.length, 1, `${fichero}: se esperaba un único \`launchApp\`, hay ${arranques.length}`);
      assert.equal(bloques[0].nombre, 'launchApp', `${fichero}: el flujo no empieza por \`launchApp\``);
    }
  });

  test('Los flujos que recorren la app de verdad no llevan marcador', () => {
    // La otra mitad del contrato, y la que evita que esto se convierta en una manera
    // barata de callar un rojo: los flujos que sí recorren pantallas no pueden marcarse
    // sin que alguien lo vea aquí. `en-marcha.yaml` entra en esta lista con la fila 48, que
    // es lo que impide que vuelva a la columna sin que nadie se entere.
    for (const fichero of ['arranque.yaml', 'antes-de-salir.yaml', 'zurron.yaml', 'en-marcha.yaml']) {
      const texto = fuente(`test/app/${fichero}`);
      assert.ok(
        !texto.split('\n').some((l) => l.trim() === MARCADOR),
        `${fichero} recorre la app de verdad: marcarlo como límite declarado convertiría un rojo real en un verde de límite`,
      );
    }
  });

  test('La entrada a A1P7 se espera y no se afirma a la primera', () => {
    // Los tres rojos medidos morían en la misma línea, `assertVisible: 'Lo que se cuenta
    // hoy'`, porque componer la primera lista tarda 11 s y la espera por defecto de
    // Maestro son 5. Es espera, no lógica. Esta prueba fija el arreglo para que nadie lo
    // devuelva a un `assertVisible` sin darse cuenta —y para que quede escrito que el
    // número no está presupuestado en ninguna spec: el minuto de RNF-PER-001 es el del
    // levantamiento del mapa, no el de la lista.
    const texto = fuente('test/app/arranque.yaml');
    assert.match(
      texto,
      /extendedWaitUntil:\s*\n\s*visible: 'Lo que se cuenta hoy'\s*\n\s*timeout: \d+/,
      'arranque.yaml debe entrar a A1P7 con `extendedWaitUntil`, no con `assertVisible`',
    );
    assert.ok(
      !/^- assertVisible: 'Lo que se cuenta hoy'$/m.test(texto),
      'arranque.yaml vuelve a afirmar A1P7 a la primera: la composición de la primera lista tarda 11 s medidos',
    );

    const timeout = Number(texto.match(/visible: 'Lo que se cuenta hoy'\s*\n\s*timeout: (\d+)/)[1]);
    assert.ok(timeout >= 30000, `la espera de A1P7 es de ${timeout} ms y la composición tarda 11 s medidos: se queda corta`);
  });
});
