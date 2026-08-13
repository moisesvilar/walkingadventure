// SPEC-046 · La fuente de salud: de dónde salen los pasos del día a día, qué se le pide a la
//            app de salud del sistema y qué no se le pide nunca.
//
// Hasta esta fila el modo de contar los pasos estaba entero salvo por su primera pieza: no
// había de dónde leer. Lo que aquí se afirma es la pieza —Health Connect en Android, la
// pareja declarada en iOS— y, sobre todo, **la lista cerrada de lo que se le pide**, que es
// la mitad bloqueante (`@privacidad`, RF-PRIV-003).
//
// ## Qué se ejecuta y qué se lee, dicho antes de que alguien lo confunda con pereza
//
// `salud.ios.js` **se ejecuta de verdad**: no importa nada —ni Expo, ni React Native, ni la
// librería nativa—, y por eso su sonda y su fuente se pueden llamar aquí. Es lo que la
// convierte en un doble declarado y no en una promesa: dice `montado: false` porque lo
// dice, no porque lo diga un comentario.
//
// `salud.android.js` **se lee y no se carga**, igual que `haptico.js` y `notificaciones.js`
// en `plataforma.test.mjs` y por lo mismo: importa `react-native-health-connect`, y cargarla
// aquí ataría la batería a `node_modules`. Ese es un criterio duro de este repo —la batería
// de núcleo arranca en un clon limpio sin instalar nada— y no se afloja por una prueba. Lo
// que la sonda de Android contesta con la app de salud del sistema delante es de
// `test/app/`, y en esta fila lo midió el aparato.
//
// Lo que sí se puede afirmar de la de Android sin cargarla, y no es poco: qué registros le
// pide —que salen de `PERMISOS_DE_SALUD`, que sí se importa—, que ninguno de los que la
// spec prohíbe aparece en ninguna parte del módulo, que sus tres motivos son tres, y que la
// pareja exporta exactamente los mismos nombres que la de iOS.
//
// Los nombres de los casos son los escenarios de `docs/testing.md`, literales.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PERMISOS_DE_SALUD, PERMISOS_QUE_SE_PIDEN, LO_QUE_NUNCA_SE_DECLARA } from '../../app/plataforma/permisos.js';
import { creaRegistro } from '../../app/plataforma/registro.js';
import { creaFuenteDeSalud, salud as saludDeIOS, MECANISMO as MECANISMO_IOS } from '../../app/plataforma/salud.ios.js';
import { fuente, hay } from './mundo-de-prueba.mjs';

/** El módulo de Android, en texto. Se lee entero y también sin sus comentarios. */
const ANDROID = fuente('app/plataforma/salud.android.js');

/**
 * El código de un módulo sin comentarios.
 *
 * Varias afirmaciones de esta fila son **negativas** —«no pide entrenamientos», «nada con
 * recorrido»— y los comentarios del módulo dicen exactamente esas palabras para explicar que
 * no lo hace. Buscar sobre el texto entero convertiría una buena explicación en un rojo.
 */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

/** El trozo del módulo de Android que es la sonda, que es lo que varias afirmaciones acotan. */
function sondaDeAndroid() {
  return ANDROID.slice(ANDROID.indexOf('async sonda()'));
}

/** Un registro con un solo módulo de capacidad doblado, para leer la fila que produce. */
async function filaDe(modulo) {
  const estado = await creaRegistro([modulo]).sondea();
  return estado.find((c) => c.nombre === 'salud');
}

/** Los motivos que la sonda de Android declara, leídos de su propia tabla. */
function motivosDeAndroid() {
  const tabla = ANDROID.slice(ANDROID.indexOf('MOTIVOS_DE_LA_SONDA = '), ANDROID.indexOf('/** Un instante del reloj real'));
  return Object.fromEntries([...tabla.matchAll(/^\s{2}([A-Z_]+): `([^`]+)`,$/gm)].map((m) => [m[1], m[2]]));
}

// ── La sonda, en sus tres respuestas y en su pareja ─────────────────────────────

describe('A la app de salud se le pide lo mínimo que mueve un contador', () => {
  test('La sonda de salud dice si se puede contar y no pide ningún permiso', async () => {
    // La respuesta buena: con la app de salud y con permiso, la capacidad está montada,
    // disponible y sin motivo. Se afirma sobre la rama del módulo de Android —es la única
    // plataforma que hoy puede darla— y sobre la fila que el registro produce a partir de
    // ella, que es lo que ven las pantallas.
    const sonda = sondaDeAndroid();
    assert.match(sonda, /return \{ montado: true, disponible: true, motivo: null \}/, 'la sonda de Android no tiene ninguna respuesta en la que todo esté en su sitio');

    const fila = await filaDe({ nombre: 'salud', capa: 'ninguna', async sonda() { return { montado: true, disponible: true, motivo: null }; } });
    assert.equal(fila.montado, true);
    assert.equal(fila.disponible, true);
    assert.equal(fila.motivo, null, 'una capacidad disponible trae motivo, y un motivo es lo que se lee cuando algo no va');

    // Y consultar no es preguntar: dentro de la sonda no se pide ningún permiso. La llamada
    // que lo pide existe en el módulo —la necesita el interruptor— y está fuera de ella.
    for (const patron of [/requestPermission/, /pideElPermiso/]) {
      assert.doesNotMatch(sonda, patron, 'la sonda de salud pide el permiso, y el permiso solo se pide desde el interruptor de A6P6');
    }
  });

  test('Sin la app de salud del sistema no se puede contar y se dice por qué', async () => {
    const motivos = motivosDeAndroid();
    assert.ok(motivos.SIN_APP_DE_SALUD, 'la sonda de Android no distingue el aparato sin app de salud');
    assert.match(motivos.SIN_APP_DE_SALUD, /no está instalada|no está disponible/, 'el motivo no nombra que la app de salud del sistema no está');

    // **Montada y no disponible**, que no es lo mismo que no montada: el módulo está y sabe
    // leer, lo que falta es la app del sistema. Confundirlas haría que instalar Health
    // Connect y compilar con la dependencia se leyeran como el mismo arreglo.
    const fila = await filaDe({ nombre: 'salud', capa: 'ninguna', async sonda() { return { montado: true, disponible: false, motivo: motivos.SIN_APP_DE_SALUD }; } });
    assert.equal(fila.montado, true);
    assert.equal(fila.disponible, false);
    assert.match(fila.motivo, /no está instalada|no está disponible/);
  });

  test('Con la app de salud y sin permiso el motivo nombra el permiso', async () => {
    const motivos = motivosDeAndroid();
    assert.ok(motivos.SIN_PERMISO, 'la sonda de Android no distingue el aparato con app de salud y sin permiso');
    assert.match(motivos.SIN_PERMISO, /permiso/, 'el motivo de la falta de permiso no nombra el permiso');
    assert.notEqual(motivos.SIN_PERMISO, motivos.SIN_APP_DE_SALUD, 'el motivo del permiso y el de la app que falta son el mismo, y se arreglan en sitios distintos');
    // Y dice **dónde** se pide, que es lo que impide que alguien lo busque en el arranque.
    assert.match(motivos.SIN_PERMISO, /ajustes/, 'el motivo no dice desde dónde se concede');

    const fila = await filaDe({ nombre: 'salud', capa: 'ninguna', async sonda() { return { montado: true, disponible: false, motivo: motivos.SIN_PERMISO }; } });
    assert.equal(fila.montado, true);
    assert.equal(fila.disponible, false);
  });

  test('En iOS no hay de dónde leer los pasos y se declara', async () => {
    // La única de las cuatro que se ejecuta de verdad, y la que hace que «doble declarado»
    // signifique algo: la pareja de iOS responde, no está a medias.
    const respuesta = await saludDeIOS.sonda();
    assert.equal(saludDeIOS.nombre, 'salud');
    assert.equal(saludDeIOS.capa, 'ninguna', 'salud no avisa de nada: declararla de pantalla la metería a competir en el par de capas');
    assert.equal(respuesta.montado, false, 'iOS dice tener montada una fuente de salud que no existe');
    assert.equal(respuesta.disponible, false);
    assert.match(respuesta.motivo, /Health Connect/, 'el motivo de iOS no dice cuál es la fuente de esta fila');
    assert.match(respuesta.motivo, /Android/, 'el motivo de iOS no dice que esa fuente es solo de Android');
    assert.match(MECANISMO_IOS, /HealthKit/, 'iOS no nombra el mecanismo que tendrá, y sin él la siguiente fila lo redescubre');

    // Devolver `null` es lo que el lector traduce a `sin-fuente`, y lo que hace que el
    // interruptor sea imposible de encender por construcción en lugar de uno que miente.
    assert.equal(await creaFuenteDeSalud(), null, 'iOS devuelve una fuente de salud: el lector la creería y el interruptor se encendería sin poder leer nada');

    // La pareja exporta exactamente los mismos nombres, que es lo que permite al empaquetador
    // elegir por sufijo sin que nadie tenga que acordarse de nada.
    const exportados = (ruta) => [...fuente(ruta).matchAll(/(?:^|\n)export\s+(?:const|let|function|async function|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]).sort();
    assert.equal(hay('app/plataforma/salud.android.js'), true);
    assert.equal(hay('app/plataforma/salud.ios.js'), true);
    assert.deepEqual(exportados('app/plataforma/salud.ios.js'), exportados('app/plataforma/salud.android.js'), 'las dos mitades de salud no exportan lo mismo');
    // Y el índice la importa sin extensión, que es como Metro elige la plataforma.
    assert.match(fuente('app/plataforma/index.js'), /from '\.\/salud'/, 'salud se importa con extensión y la selección por plataforma no ocurriría');
  });

  test('A la app de salud solo se le piden los metros y los pasos de una ventana', () => {
    // Bloqueante. La lista es cerrada y vive en `permisos.js`, no dentro del módulo de
    // Android: la mitad de iOS tiene que poder leer lo mismo, y ahí no hay fuente.
    assert.deepEqual(
      PERMISOS_DE_SALUD.map((p) => p.permiso),
      ['android.permission.health.READ_DISTANCE', 'android.permission.health.READ_STEPS'],
      'lo que se le pide a la app de salud ha dejado de ser exactamente esos dos permisos',
    );
    // Cada uno dice a qué lectura alimenta, que es lo que impide que sobre alguno: distancia
    // da metros y pasos da la caída cuando la fuente no tiene distancia. Los dos se usan.
    assert.deepEqual(PERMISOS_DE_SALUD.map((p) => p.alimenta), ['metrosEnVentana', 'pasosEnVentana']);
    assert.deepEqual(PERMISOS_DE_SALUD.map((p) => p.registro), ['Distance', 'Steps']);

    // Y el módulo de Android le pide a la librería exactamente esos registros, **derivados de
    // la lista** y no escritos a mano: dos listas serían dos sitios donde olvidarse de mirar.
    const codigo = codigoDe('app/plataforma/salud.android.js');
    assert.match(codigo, /PERMISOS_DE_SALUD\.map\(\(p\) => \(\{ accessType: 'read', recordType: p\.registro \}\)\)/, 'lo que se le pide a Health Connect no sale de la lista declarada');
    assert.doesNotMatch(codigo, /accessType: 'write'/, 'la app le pide escritura a la app de salud, y no escribe nada en ella');

    // Nada con recorrido, ningún entrenamiento, ninguna sesión con ruta y ningún registro del
    // cuerpo. Se busca sobre el código y no sobre el texto: los comentarios los nombran para
    // explicar que no se piden, y eso es una buena explicación y no un fallo.
    for (const prohibido of ['ExerciseSession', 'ExerciseRoute', 'HeartRate', 'SleepSession', 'BodyFat', 'Weight', 'BloodPressure', 'OxygenSaturation', 'Nutrition', 'SpeedRecord', 'Elevation']) {
      assert.doesNotMatch(codigo, new RegExp(prohibido), `la fuente de salud le pide "${prohibido}" a la app de salud, y esta app no lee nada del cuerpo ni nada con recorrido`);
    }
    // La escritura de salud no se declara nunca, ni siquiera cuando iOS tenga fuente.
    assert.equal(LO_QUE_NUNCA_SE_DECLARA.includes('NSHealthUpdateUsageDescription'), true, 'el permiso de escritura de salud ha salido de lo que nunca se declara');

    // Y lo que se pide se pide **en contexto**: al encender la fila de los ajustes, nunca al
    // instalar y nunca al abrir.
    const salud = PERMISOS_QUE_SE_PIDEN.find((p) => p.id === 'salud-lectura');
    assert.ok(salud, 'la app ha dejado de declarar que pide el permiso de salud');
    assert.match(salud.cuando, /ajustes/, 'el permiso de salud ya no se pide al encender la fila de los ajustes');
    assert.equal(salud.ios, null, 'iOS declara una clave de uso de salud, y mientras no haya fuente sería una cadena de uso sin uso');
  });
});
