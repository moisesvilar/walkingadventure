// SPEC-020 · Los módulos de plataforma de la app, su registro y su degradación.
// Ampliado en SPEC-030, que añade el rótulo del sistema como quinta capacidad.
//
// Es la mitad de RF-INFRA-006 que sí se puede afirmar sin dispositivo: el
// registro se construye con los módulos INYECTADOS, igual que el núcleo recibe su
// `fetchData`, así que «la app funciona aunque falte el háptico» se puede poner
// ROJO en lugar de afirmarse. Lo que hace falta para eso son módulos doblados, no
// un simulador.
//
// **La asimetría que trae SPEC-030, y por la que este fichero pasó de cuatro a
// cinco sin cambiar lo que afirma.** Las cinco capacidades se enumeran igual y las
// cinco declaran nombre, capa y sonda; lo que no es igual es qué significa que
// falte una:
//
// - **Las cuatro degradables** —salud, háptico, notificaciones y respaldo— son
//   RF-INFRA-006 entero: sin ellas la app arranca, la lista las enumera declaradas
//   ausentes y sigue quedando por dónde avisar. Eso es lo que sigue probándose aquí,
//   módulo a módulo y con los cuatro fuera a la vez.
// - **El rótulo no es degradable, y por eso no tiene aquí su caso de «sin él la app
//   arranca igual»**: sin rótulo una salida no se abre (SPEC-030, «Nada se abre en
//   silencio sin rótulo»), porque abrirla significaría o perder la ubicación a los
//   pocos minutos o pedir el permiso permanente, que es la exclusión 12 del PRD. Su
//   ausencia se afirma donde duele —en `test/nucleo/salidas.test.mjs`, contra
//   `abreSalida`— y no como una degradación más de esta lista.
//
// Lo que sí sigue siendo suyo en este fichero es el contrato: que se enumera como
// una capacidad más, que su capa es `ninguna` —no avisa de nada: es permanente y
// visible a propósito— y que su sonda no pide ningún permiso. Meterlo en los casos
// de degradación sería afirmar exactamente lo contrario de lo que la spec decide.
//
// **RF-INFRA-006 está marcado ⚠ sin escenario en docs/testing.md** —la spec
// propone el bloque Gherkin y decide no escribirlo—, así que todos los casos de
// degradación van marcados como hueco de batería en test/spec-test-map.json. El
// único escenario existente al que esto sirve es «Ningún aviso viaja por una sola
// capa», y solo en su mitad de capas: aquí se comprueba que ninguna capa es
// portadora única, no el catálogo de avisos, que es de la fila 29.
//
// Se importan `registro.js`, `gancho.js` y `capacidades.js` por ruta relativa y se
// ejecutan en Node: no importan nada de React Native ni de Expo, que es
// justamente lo que los hace comprobables aquí. `haptico.js` y
// `notificaciones.js` sí importan de Expo y por eso se leen, no se cargan.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CAPACIDADES, CAPAS, ETIQUETAS, estadoLegible, normalizaRespuesta } from '../../app/plataforma/capacidades.js';
import { creaRegistro } from '../../app/plataforma/registro.js';
import { leeGancho } from '../../app/plataforma/gancho.js';
import { fuente, hay } from './mundo-de-prueba.mjs';

const EN_DESARROLLO = true;
const EN_PRODUCCION = false;

/** Un módulo de capacidad doblado: la forma mínima que el registro exige. */
function modulo(nombre, capa, respuesta) {
  return {
    nombre,
    capa,
    async sonda() {
      if (typeof respuesta === 'function') return respuesta();
      return respuesta;
    },
  };
}

/** Los cinco módulos como los monta la app hoy, doblados y sin tocar Expo. */
function losCinco() {
  return [
    modulo('salud', 'ninguna', { montado: false, disponible: false, motivo: 'no montada todavía: la monta la fila 42 (pasos de fondo)' }),
    modulo('haptico', 'bolsillo', { montado: true, disponible: true, motivo: null }),
    modulo('notificaciones', 'pantalla', { montado: true, disponible: true, motivo: null }),
    modulo('respaldo', 'ninguna', { montado: true, disponible: true, motivo: null }),
    modulo('rotulo', 'ninguna', { montado: true, disponible: true, motivo: null }),
  ];
}

/** Los mismos, quitando los que se pidan: es cómo se dobla «este módulo no está». */
function losCincoSin(...ausentes) {
  return losCinco().filter((m) => !ausentes.includes(m.nombre));
}

/**
 * Las cuatro que sí admiten faltar. El rótulo queda fuera **a propósito**: su
 * ausencia no se degrada, impide abrir la salida, y afirmarla como una degradación
 * más contradiría el criterio de SPEC-030 que la prohíbe.
 */
const DEGRADABLES = ['salud', 'haptico', 'notificaciones', 'respaldo'];

async function sondeado(modulos, opciones = {}) {
  const registro = creaRegistro(modulos, opciones);
  const estado = await registro.sondea();
  return { registro, estado, por: (n) => estado.find((c) => c.nombre === n) };
}

// ── El contrato de una capacidad ────────────────────────────────────────────────

describe('El contrato de un módulo de capacidad', () => {
  test('Los cuatro módulos de plataforma están y declaran nombre, capa y sonda', () => {
    // El nombre del caso se queda como estaba —es el que cruza esta prueba con el
    // mapa de SPEC-020— y lo que enumera pasan a ser cinco: SPEC-030 añade el
    // rótulo con el MISMO contrato, que es justo lo que esta prueba mide.
    //
    // Se leen y no se cargan: dos de los cinco importan de Expo, que es lo
    // correcto —son plataforma— y lo que impide ejecutarlos en Node.
    const ficheros = {
      salud: 'app/plataforma/salud.js',
      haptico: 'app/plataforma/haptico.js',
      notificaciones: 'app/plataforma/notificaciones.js',
      respaldo: 'app/plataforma/respaldo.ios.js',
      rotulo: 'app/plataforma/rotulo.ios.js',
    };
    for (const [nombre, fichero] of Object.entries(ficheros)) {
      assert.equal(hay(fichero), true, `falta el módulo de ${nombre}`);
      const texto = fuente(fichero);
      assert.match(texto, new RegExp(`nombre:\\s*'${nombre}'`), `${fichero}: no declara su nombre`);
      assert.match(texto, /capa:\s*'(bolsillo|pantalla|ninguna)'/, `${fichero}: no declara su capa`);
      assert.match(texto, /async sonda\(\)/, `${fichero}: no expone una sonda de disponibilidad`);
    }
    // Las dos capacidades partidas por plataforma tienen su pareja, y las dos
    // parejas declaran lo mismo: lo que difiere es el ciclo de vida, nunca el contrato.
    for (const partida of ['respaldo', 'rotulo']) {
      for (const p of ['ios', 'android']) {
        assert.equal(hay(`app/plataforma/${partida}.${p}.js`), true, `falta ${partida}.${p}.js`);
        assert.match(fuente(`app/plataforma/${partida}.${p}.js`), new RegExp(`nombre:\\s*'${partida}'`));
      }
    }
    assert.deepEqual(CAPACIDADES, ['salud', 'haptico', 'notificaciones', 'respaldo', 'rotulo']);
    assert.deepEqual(CAPAS, ['bolsillo', 'pantalla', 'ninguna']);
  });

  test('Las capas de cada capacidad son las de accesibilidad.md §3', () => {
    // Háptico de bolsillo y notificaciones de pantalla es lo que sostiene el par;
    // salud y respaldo no avisan de nada y por eso su capa es «ninguna».
    assert.match(fuente('app/plataforma/haptico.js'), /capa:\s*'bolsillo'/);
    assert.match(fuente('app/plataforma/notificaciones.js'), /capa:\s*'pantalla'/);
    assert.match(fuente('app/plataforma/salud.js'), /capa:\s*'ninguna'/);
    for (const p of ['ios', 'android']) {
      assert.match(fuente(`app/plataforma/respaldo.${p}.js`), /capa:\s*'ninguna'/);
      // El rótulo también, y no por descuido: `accesibilidad.md` §3 define las capas
      // como capas DE AVISO, y el rótulo no avisa de nada — es permanente y visible a
      // propósito. Declararlo de pantalla lo metería a competir en el par de capas.
      assert.match(fuente(`app/plataforma/rotulo.${p}.js`), /capa:\s*'ninguna'/);
    }
  });

  test('Ninguna sonda pide un permiso al sistema ni abre un diálogo', () => {
    // El onboarding tiene decidido cuándo se piden los permisos; cinco diálogos
    // del sistema en el primer arranque contradicen ese diseño. Se buscan las
    // formas con las que se piden de verdad, no la palabra «permiso».
    //
    // La del rótulo es la que más tentaba: podría comprobar si puede arrancar el
    // servicio pidiendo el permiso de notificaciones. Sondear no es pedir.
    const pedir = [/requestPermissionsAsync/, /requestPermission\b/, /\bAlert\.alert\b/, /openSettings/];
    for (const fichero of ['salud.js', 'haptico.js', 'notificaciones.js', 'respaldo.ios.js', 'respaldo.android.js', 'rotulo.ios.js', 'rotulo.android.js']) {
      const texto = fuente(`app/plataforma/${fichero}`);
      for (const patron of pedir) {
        assert.doesNotMatch(texto, patron, `app/plataforma/${fichero}: la sonda pide algo al sistema`);
      }
    }
    // Y la de notificaciones lee el permiso ya concedido, que es lo que sí puede hacer.
    assert.match(fuente('app/plataforma/notificaciones.js'), /getPermissionsAsync/);
  });

  test('La sonda de salud declara la capacidad no montada y nombra la fila que la monta', async () => {
    assert.match(fuente('app/plataforma/salud.js'), /montado:\s*false/);
    assert.match(fuente('app/plataforma/salud.js'), /fila 42/);
    const { por } = await sondeado(losCinco());
    assert.equal(por('salud').montado, false);
    assert.match(por('salud').motivo, /fila 42/);
  });

  test('Una sonda que se deja un campo no produce una fila a medias', () => {
    // «disponible» ausente es «no disponible», nunca «no se sabe» disfrazado de sí.
    assert.deepEqual(normalizaRespuesta('haptico', 'bolsillo', { montado: true }), {
      nombre: 'haptico',
      capa: 'bolsillo',
      montado: true,
      disponible: false,
      motivo: 'la sonda no dijo por qué',
    });
    assert.deepEqual(normalizaRespuesta('haptico', 'bolsillo', undefined).disponible, false);
    assert.equal(normalizaRespuesta('respaldo', 'ninguna', { montado: false, disponible: true }).disponible, false);
  });

  test('Los tres estados legibles son disponible, montada sin poder usarse y no montada', () => {
    assert.equal(estadoLegible({ montado: true, disponible: true }), 'disponible');
    assert.equal(estadoLegible({ montado: true, disponible: false }), 'montada, sin poder usarse');
    assert.equal(estadoLegible({ montado: false, disponible: false }), 'no montada');
    assert.deepEqual(Object.keys(ETIQUETAS).sort(), [...CAPACIDADES].sort());
  });
});

// ── El registro ─────────────────────────────────────────────────────────────────

describe('El registro de capacidades responde por las cuatro y no lanza', () => {
  test('El registro devuelve las cuatro capacidades en un orden estable', async () => {
    const { estado } = await sondeado(losCinco());
    assert.deepEqual(estado.map((c) => c.nombre), CAPACIDADES);

    // Estable quiere decir que no depende del orden en que se inyectaron: una
    // lista que se reordena sola no se puede comparar entre dos ejecuciones.
    const alReves = await sondeado(losCinco().reverse());
    assert.deepEqual(alReves.estado.map((c) => c.nombre), CAPACIDADES);
    assert.deepEqual(alReves.estado, estado);

    for (const fila of estado) {
      assert.equal(typeof fila.montado, 'boolean');
      assert.equal(typeof fila.disponible, 'boolean');
      assert.ok(fila.disponible ? fila.motivo === null : typeof fila.motivo === 'string' && fila.motivo.length > 0);
    }
  });

  test('Pedirle al registro una capacidad que no está devuelve que no la hay y no lanza', async () => {
    const { registro } = await sondeado(losCincoSin('haptico'));
    const pedida = registro.capacidad('haptico');
    assert.equal(pedida.hay, false);
    assert.equal(pedida.modulo, null);
    assert.match(pedida.motivo, /\S/);

    // Ni siquiera con un nombre que no es ninguna de las cinco.
    const inventada = registro.capacidad('telepatia');
    assert.equal(inventada.hay, false);
    assert.match(inventada.motivo, /telepatia/);

    // Y la que sí está sigue estando.
    assert.equal(registro.capacidad('notificaciones').hay, true);
  });

  test('Una capacidad cuya sonda lanza queda no disponible con el motivo y las demás siguen', async () => {
    const modulos = losCincoSin('haptico');
    modulos.push(modulo('haptico', 'bolsillo', () => {
      throw new Error('el módulo nativo no respondió');
    }));

    const { estado, por, registro } = await sondeado(modulos);
    assert.equal(estado.length, CAPACIDADES.length, 'la lista sigue teniendo todas las filas');
    assert.equal(por('haptico').disponible, false);
    assert.match(por('haptico').motivo, /la sonda falló: el módulo nativo no respondió/);
    assert.equal(por('notificaciones').disponible, true, 'una sonda caída no se lleva por delante a las demás');
    assert.equal(registro.capacidad('haptico').hay, false);
  });

  test('Una sonda que lanza algo que no es un Error tampoco tumba el registro', async () => {
    const modulos = losCincoSin('respaldo');
    // eslint-disable-next-line no-throw-literal
    modulos.push(modulo('respaldo', 'ninguna', () => {
      throw 'sin mensaje';
    }));
    const { por } = await sondeado(modulos);
    assert.equal(por('respaldo').disponible, false);
    assert.match(por('respaldo').motivo, /sin mensaje/);
  });

  test('Un módulo mal declarado se rechaza al construir el registro, no al sondear', () => {
    assert.throws(() => creaRegistro([{ nombre: 'telepatia', capa: 'bolsillo', sonda: async () => ({}) }]), /telepatia/);
    assert.throws(() => creaRegistro([{ nombre: 'haptico', capa: 'oido', sonda: async () => ({}) }]), /oido/);
    assert.throws(() => creaRegistro([{ nombre: 'haptico', capa: 'bolsillo' }]), /sonda/);
    assert.throws(() => creaRegistro([modulo('haptico', 'bolsillo', {}), modulo('haptico', 'bolsillo', {})]), /dos veces/);
  });

  test('El registro se sondea una sola vez, al abrir, y no se re-sondea solo', async () => {
    // La re-sonda pertenece a la fila que use cada capacidad; aquí solo serviría
    // para que la pantalla cambiara sola mientras alguien la lee.
    let sondas = 0;
    const modulos = losCincoSin('haptico');
    modulos.push(modulo('haptico', 'bolsillo', () => {
      sondas += 1;
      return { montado: true, disponible: true, motivo: null };
    }));

    const registro = creaRegistro(modulos);
    // Antes de sondear la lista está vacía: no se inventa un estado que nadie midió.
    assert.deepEqual(registro.estado(), []);

    await registro.sondea();
    assert.equal(sondas, 1);
    registro.estado();
    registro.estado();
    registro.capacidad('haptico');
    assert.equal(sondas, 1, 'consultar el registro ha vuelto a disparar las sondas');

    // Y cada consulta entrega su propia lista: quien la recorra no puede vaciar la
    // del registro por el camino.
    const primera = registro.estado();
    primera.length = 0;
    assert.equal(registro.estado().length, CAPACIDADES.length);
  });
});

// ── RF-INFRA-006: la degradación por módulo ausente ─────────────────────────────

describe('La app funciona con módulos de plataforma ausentes', () => {
  // Los casos de este bloque recorren **las cuatro degradables**, no las cinco. El
  // rótulo no tiene aquí su «sin él la app arranca igual» porque sin él la app
  // arranca pero **la salida no se abre**, que es lo contrario de degradar: es
  // SPEC-030 §«Nada se abre en silencio sin rótulo» y vive en salidas.test.mjs.
  // Un caso aquí que dijera que sin rótulo todo sigue igual sería un verde que
  // contradice la spec.

  test('Sin háptico la app arranca igual', async () => {
    const { estado, por, registro } = await sondeado(losCincoSin('haptico'));
    assert.equal(estado.length, CAPACIDADES.length, 'el háptico sigue en la lista, declarado ausente');
    assert.equal(por('haptico').montado, false);
    assert.equal(por('haptico').disponible, false);
    assert.match(por('haptico').motivo, /ningún módulo la monta/);
    assert.equal(por('notificaciones').disponible, true);
    assert.equal(registro.montadas(), CAPACIDADES.length - 1);
  });

  test('Sin notificaciones la app arranca igual', async () => {
    const { estado, por } = await sondeado(losCincoSin('notificaciones'));
    assert.equal(estado.length, CAPACIDADES.length);
    assert.equal(por('notificaciones').montado, false);
    assert.match(por('notificaciones').motivo, /\S/);
    assert.equal(por('haptico').disponible, true);
  });

  test('Sin respaldo la app arranca igual', async () => {
    const { estado, por } = await sondeado(losCincoSin('respaldo'));
    assert.equal(estado.length, CAPACIDADES.length);
    assert.equal(por('respaldo').montado, false);
    assert.match(por('respaldo').motivo, /\S/);
  });

  test('Con las tres ausentes a la vez la app sigue en pie', async () => {
    const { estado, por, registro } = await sondeado(losCincoSin('haptico', 'notificaciones', 'respaldo'));
    assert.equal(estado.length, CAPACIDADES.length, 'la lista enumera todas aunque falten tres');
    for (const nombre of ['haptico', 'notificaciones', 'respaldo', 'salud']) {
      assert.equal(por(nombre).disponible, false);
      assert.match(por(nombre).motivo, /\S/, 'ninguna fila queda vacía: la ausencia se declara');
    }
    // El rótulo sigue en pie, y por eso una salida todavía se puede abrir: las tres
    // que faltan son las que no la sostienen.
    assert.equal(por('rotulo').disponible, true, 'el rótulo no es una de las degradables y no se ha quitado');
    assert.equal(registro.montadas(), 2, 'quedan salud y rótulo montados… y salud no está montada tampoco');
    // Y sigue quedando por dónde avisar, que es lo que impide que esto sea una app rota.
    assert.ok(registro.capasDeAviso().some((c) => c.capa === 'pantalla'));
  });

  test('Con las cuatro capacidades ausentes a la vez la lista las muestra las cuatro', async () => {
    // «Las cuatro» del nombre son las degradables; el registro vacío las enumera
    // todas, rótulo incluido, porque enumerar es lo que impide que una ausencia se
    // confunda con un olvido.
    const { estado, por, registro } = await sondeado(losCincoSin(...DEGRADABLES));
    assert.equal(registro.montadas(), 1, 'solo queda montado el rótulo');
    assert.deepEqual(estado.map((c) => c.nombre), CAPACIDADES);
    for (const nombre of DEGRADABLES) {
      assert.equal(por(nombre).montado, false);
      assert.equal(por(nombre).disponible, false);
      assert.match(por(nombre).motivo, /ningún módulo la monta en esta compilación/);
    }
    assert.ok(registro.capasDeAviso().some((c) => c.capa === 'pantalla'), 'sin las cuatro sigue quedando la pantalla de la app');

    // Y con las cinco fuera —que ya no es degradar, es una compilación sin nada—
    // la lista sigue enumerando las cinco.
    const vacio = await sondeado([]);
    assert.equal(vacio.registro.montadas(), 0);
    assert.deepEqual(vacio.estado.map((c) => c.nombre), CAPACIDADES);
    for (const fila of vacio.estado) {
      assert.equal(fila.montado, false);
      assert.equal(fila.disponible, false);
      assert.match(fila.motivo, /ningún módulo la monta en esta compilación/);
    }
  });

  test('Un registro construido sin ningún módulo lo dice con una frase, no con una lista vacía', async () => {
    // Una lista vacía sin explicación no se distingue de una lista que no cargó, y
    // por eso la pantalla tiene un mensaje propio para este estado.
    const registro = creaRegistro([]);
    assert.equal(registro.montadas(), 0);
    const pantalla = fuente('app/pantallas/andamiaje.js');
    assert.match(pantalla, /testID="capacidades-vacio"/, 'la pantalla no tiene el estado de «ninguna montada»');
    assert.match(pantalla, /Ninguna capacidad montada todavía/);
    assert.match(pantalla, /modulos\.length > 0/, 'la pantalla no decide entre lista y frase por si hay módulos');
  });

  test('Sin capas de bolsillo queda una capa de pantalla', async () => {
    // El escenario existe en docs/testing.md («Ningún aviso viaja por una sola
    // capa»), aunque allí mira el catálogo de avisos, que es de la fila 29. Lo que
    // se afirma aquí es su premisa: ninguna capa es portadora única.
    const { registro } = await sondeado(losCincoSin('haptico'));
    const capas = registro.capasDeAviso();
    assert.ok(capas.some((c) => c.capa === 'pantalla'), 'sin háptico no queda ninguna capa de pantalla declarada');
    assert.ok(capas.some((c) => c.siempre === true), 'la capa que no cuelga de ningún módulo tiene que existir');
    assert.equal(capas.some((c) => c.capa === 'bolsillo'), false);
  });

  test('Sin háptico y sin notificaciones sigue quedando declarada al menos una capa de pantalla', async () => {
    const { registro } = await sondeado(losCincoSin('haptico', 'notificaciones'));
    const capas = registro.capasDeAviso();
    assert.ok(capas.length > 0, 'no queda ninguna capa: la app se ha quedado sin manera de avisar');
    assert.ok(capas.some((c) => c.capa === 'pantalla'));
  });

  test('Ninguna capacidad de plataforma es portadora única de una capa', async () => {
    // Se comprueba quitando cada módulo por separado: si alguna ausencia dejara la
    // app sin ninguna capa, esa capacidad sería portadora única y RF-INFRA-006
    // estaría incumplido para ella.
    for (const nombre of CAPACIDADES) {
      const { registro } = await sondeado(losCincoSin(nombre));
      const capas = registro.capasDeAviso();
      assert.ok(capas.length > 0, `sin ${nombre} la app se queda sin ninguna capa de aviso`);
      assert.ok(capas.some((c) => c.capa === 'pantalla'), `sin ${nombre} no queda ninguna capa de pantalla`);
    }
    // Y con las cinco fuera, también: la pantalla de la app no es un módulo.
    const { registro } = await sondeado([]);
    assert.ok(registro.capasDeAviso().some((c) => c.capa === 'pantalla'));
  });

  test('Una capacidad no disponible no aporta capa aunque su módulo esté montado', async () => {
    // Montada sin permiso no es una capa de aviso: contarla sería exactamente la
    // manera de creer que un aviso llegó cuando no puede llegar.
    const modulos = losCincoSin('notificaciones');
    modulos.push(modulo('notificaciones', 'pantalla', { montado: true, disponible: false, motivo: 'sin permiso concedido' }));
    const { registro } = await sondeado(modulos);
    const portadores = registro.capasDeAviso().map((c) => c.portador);
    assert.equal(portadores.includes('notificaciones'), false);
    assert.ok(registro.capasDeAviso().some((c) => c.capa === 'bolsillo'), 'el háptico sí sigue aportando su capa');
  });
});

// ── El gancho para poner una capacidad en rojo ──────────────────────────────────

describe('El gancho de andamiaje pone una capacidad en rojo sin tocar el código', () => {
  test('El gancho con una capacidad la deja ausente', async () => {
    const leido = leeGancho('walkingadventure://andamiaje?ausentes=haptico', EN_DESARROLLO);
    assert.deepEqual(leido, { ausentes: ['haptico'], noReconocidos: [] });

    const { por } = await sondeado(losCinco(), { ausentes: leido.ausentes });
    assert.equal(por('haptico').disponible, false);
    assert.match(por('haptico').motivo, /ausente por el gancho de andamiaje/);
    assert.equal(por('notificaciones').disponible, true, 'las demás mantienen su estado real');
  });

  test('El gancho con varias capacidades las deja todas ausentes y no toca las demás', async () => {
    const leido = leeGancho('walkingadventure://andamiaje?ausentes=notificaciones,haptico', EN_DESARROLLO);
    // El orden de salida es el de CAPACIDADES y no el del enlace: el estado de la
    // app no puede depender de en qué orden se escribieron los parámetros.
    assert.deepEqual(leido.ausentes, ['haptico', 'notificaciones']);

    const { por } = await sondeado(losCinco(), { ausentes: leido.ausentes });
    assert.equal(por('haptico').disponible, false);
    assert.equal(por('notificaciones').disponible, false);
    assert.equal(por('respaldo').disponible, true);
  });

  test('El gancho con un nombre que no es ninguna capacidad no cambia nada y dice cuál fue', async () => {
    const leido = leeGancho('walkingadventure://andamiaje?ausentes=telepatia', EN_DESARROLLO);
    assert.deepEqual(leido, { ausentes: [], noReconocidos: ['telepatia'] });

    const { estado } = await sondeado(losCinco(), { ausentes: leido.ausentes });
    const sinGancho = await sondeado(losCinco());
    assert.deepEqual(estado, sinGancho.estado, 'un nombre no reconocido ha cambiado el estado de algo');

    const pantalla = fuente('app/pantallas/andamiaje.js');
    assert.match(pantalla, /testID="gancho-no-reconocido"/);
    assert.match(pantalla, /No reconozco la capacidad/);
  });

  test('El gancho mezclando reconocidos y no reconocidos reparte cada nombre a su lado', () => {
    const leido = leeGancho('walkingadventure://andamiaje?ausentes=respaldo,telepatia,haptico', EN_DESARROLLO);
    assert.deepEqual(leido.ausentes, ['haptico', 'respaldo']);
    assert.deepEqual(leido.noReconocidos, ['telepatia']);
  });

  test('En una compilación de producción el enlace de andamiaje es inerte', async () => {
    const leido = leeGancho('walkingadventure://andamiaje?ausentes=haptico,notificaciones,respaldo', EN_PRODUCCION);
    assert.deepEqual(leido, { ausentes: [], noReconocidos: [] });

    const { estado } = await sondeado(losCinco(), { ausentes: leido.ausentes });
    const sinGancho = await sondeado(losCinco());
    assert.deepEqual(estado, sinGancho.estado, 'el gancho ha cambiado algo en producción');

    // Y el gancho se lee con `__DEV__`, que es lo que lo apaga en producción.
    assert.match(fuente('app/App.js'), /__DEV__/);
    assert.match(fuente('app/App.js'), /leeGancho\(url, EN_DESARROLLO\)/);
  });

  test('Un enlace que no es el de andamiaje no cambia ninguna capacidad', () => {
    for (const url of [null, '', 'walkingadventure://otra-cosa?ausentes=haptico', 'https://example.com/andamiaje?ausentes=haptico', 'walkingadventure://andamiaje']) {
      assert.deepEqual(leeGancho(url, EN_DESARROLLO), { ausentes: [], noReconocidos: [] }, `el enlace "${url}" ha hecho algo`);
    }
  });

  test('El gancho no escribe nada en el almacenamiento del dispositivo', () => {
    // Es lo que hace que al cerrar y volver a abrir las capacidades vuelvan a su
    // estado real: no hay nada que recordar. Un gancho que sobrevive al reinicio es
    // una puerta trasera.
    for (const fichero of ['app/plataforma/gancho.js', 'app/App.js', 'app/plataforma/registro.js']) {
      const texto = fuente(fichero);
      for (const escritura of [/AsyncStorage/, /localStorage/, /SecureStore/, /FileSystem/, /writeFile/, /setItem/]) {
        assert.doesNotMatch(texto, escritura, `${fichero}: el gancho persiste algo`);
      }
    }
    // Y el estado del gancho vive en un useState, que se pierde al cerrar la app.
    assert.match(fuente('app/App.js'), /useState\(SIN_GANCHO\)/);
  });

  test('Volver a abrir sin enlace devuelve las capacidades a su estado real', async () => {
    const conGancho = await sondeado(losCinco(), { ausentes: leeGancho('walkingadventure://andamiaje?ausentes=haptico', EN_DESARROLLO).ausentes });
    assert.equal(conGancho.por('haptico').disponible, false);

    const alVolverAAbrir = await sondeado(losCinco(), { ausentes: leeGancho(null, EN_DESARROLLO).ausentes });
    assert.equal(alVolverAAbrir.por('haptico').disponible, true);
  });

  test('Una capacidad forzada por el gancho no llega a sondearse', async () => {
    // Si se sondease, el gancho no serviría para doblar un módulo que revienta.
    let sondas = 0;
    const modulos = losCincoSin('haptico');
    modulos.push(modulo('haptico', 'bolsillo', () => {
      sondas += 1;
      return { montado: true, disponible: true, motivo: null };
    }));
    await sondeado(modulos, { ausentes: ['haptico'] });
    assert.equal(sondas, 0, 'el gancho ha sondeado una capacidad que había declarado ausente');
  });
});
