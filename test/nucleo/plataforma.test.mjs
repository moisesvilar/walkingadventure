// SPEC-020 · Los módulos de plataforma de la app, su registro y su degradación.
//
// Es la mitad de RF-INFRA-006 que sí se puede afirmar sin dispositivo: el
// registro se construye con los módulos INYECTADOS, igual que el núcleo recibe su
// `fetchData`, así que «la app funciona aunque falte el háptico» se puede poner
// ROJO en lugar de afirmarse. Lo que hace falta para eso son módulos doblados, no
// un simulador.
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

/** Los cuatro módulos como los monta la app hoy, doblados y sin tocar Expo. */
function losCuatro() {
  return [
    modulo('salud', 'ninguna', { montado: false, disponible: false, motivo: 'no montada todavía: la monta la fila 42 (pasos de fondo)' }),
    modulo('haptico', 'bolsillo', { montado: true, disponible: true, motivo: null }),
    modulo('notificaciones', 'pantalla', { montado: true, disponible: true, motivo: null }),
    modulo('respaldo', 'ninguna', { montado: true, disponible: true, motivo: null }),
  ];
}

/** Los mismos, quitando los que se pidan: es cómo se dobla «este módulo no está». */
function losCuatroSin(...ausentes) {
  return losCuatro().filter((m) => !ausentes.includes(m.nombre));
}

async function sondeado(modulos, opciones = {}) {
  const registro = creaRegistro(modulos, opciones);
  const estado = await registro.sondea();
  return { registro, estado, por: (n) => estado.find((c) => c.nombre === n) };
}

// ── El contrato de una capacidad ────────────────────────────────────────────────

describe('El contrato de un módulo de capacidad', () => {
  test('Los cuatro módulos de plataforma están y declaran nombre, capa y sonda', () => {
    // Se leen y no se cargan: dos de los cuatro importan de Expo, que es lo
    // correcto —son plataforma— y lo que impide ejecutarlos en Node.
    const ficheros = {
      salud: 'app/plataforma/salud.js',
      haptico: 'app/plataforma/haptico.js',
      notificaciones: 'app/plataforma/notificaciones.js',
      respaldo: 'app/plataforma/respaldo.ios.js',
    };
    for (const [nombre, fichero] of Object.entries(ficheros)) {
      assert.equal(hay(fichero), true, `falta el módulo de ${nombre}`);
      const texto = fuente(fichero);
      assert.match(texto, new RegExp(`nombre:\\s*'${nombre}'`), `${fichero}: no declara su nombre`);
      assert.match(texto, /capa:\s*'(bolsillo|pantalla|ninguna)'/, `${fichero}: no declara su capa`);
      assert.match(texto, /async sonda\(\)/, `${fichero}: no expone una sonda de disponibilidad`);
    }
    assert.deepEqual(CAPACIDADES, ['salud', 'haptico', 'notificaciones', 'respaldo']);
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
    }
  });

  test('Ninguna sonda pide un permiso al sistema ni abre un diálogo', () => {
    // El onboarding tiene decidido cuándo se piden los permisos; cuatro diálogos
    // del sistema en el primer arranque contradicen ese diseño. Se buscan las
    // formas con las que se piden de verdad, no la palabra «permiso».
    const pedir = [/requestPermissionsAsync/, /requestPermission\b/, /\bAlert\.alert\b/, /openSettings/];
    for (const fichero of ['salud.js', 'haptico.js', 'notificaciones.js', 'respaldo.ios.js', 'respaldo.android.js']) {
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
    const { por } = await sondeado(losCuatro());
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
    const { estado } = await sondeado(losCuatro());
    assert.deepEqual(estado.map((c) => c.nombre), CAPACIDADES);

    // Estable quiere decir que no depende del orden en que se inyectaron: una
    // lista que se reordena sola no se puede comparar entre dos ejecuciones.
    const alReves = await sondeado(losCuatro().reverse());
    assert.deepEqual(alReves.estado.map((c) => c.nombre), CAPACIDADES);
    assert.deepEqual(alReves.estado, estado);

    for (const fila of estado) {
      assert.equal(typeof fila.montado, 'boolean');
      assert.equal(typeof fila.disponible, 'boolean');
      assert.ok(fila.disponible ? fila.motivo === null : typeof fila.motivo === 'string' && fila.motivo.length > 0);
    }
  });

  test('Pedirle al registro una capacidad que no está devuelve que no la hay y no lanza', async () => {
    const { registro } = await sondeado(losCuatroSin('haptico'));
    const pedida = registro.capacidad('haptico');
    assert.equal(pedida.hay, false);
    assert.equal(pedida.modulo, null);
    assert.match(pedida.motivo, /\S/);

    // Ni siquiera con un nombre que no es ninguna de las cuatro.
    const inventada = registro.capacidad('telepatia');
    assert.equal(inventada.hay, false);
    assert.match(inventada.motivo, /telepatia/);

    // Y la que sí está sigue estando.
    assert.equal(registro.capacidad('notificaciones').hay, true);
  });

  test('Una capacidad cuya sonda lanza queda no disponible con el motivo y las demás siguen', async () => {
    const modulos = losCuatroSin('haptico');
    modulos.push(modulo('haptico', 'bolsillo', () => {
      throw new Error('el módulo nativo no respondió');
    }));

    const { estado, por, registro } = await sondeado(modulos);
    assert.equal(estado.length, 4, 'la lista sigue teniendo las cuatro filas');
    assert.equal(por('haptico').disponible, false);
    assert.match(por('haptico').motivo, /la sonda falló: el módulo nativo no respondió/);
    assert.equal(por('notificaciones').disponible, true, 'una sonda caída no se lleva por delante a las demás');
    assert.equal(registro.capacidad('haptico').hay, false);
  });

  test('Una sonda que lanza algo que no es un Error tampoco tumba el registro', async () => {
    const modulos = losCuatroSin('respaldo');
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
    const modulos = losCuatroSin('haptico');
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
    assert.equal(registro.estado().length, 4);
  });
});

// ── RF-INFRA-006: la degradación por módulo ausente ─────────────────────────────

describe('La app funciona con módulos de plataforma ausentes', () => {
  test('Sin háptico la app arranca igual', async () => {
    const { estado, por, registro } = await sondeado(losCuatroSin('haptico'));
    assert.equal(estado.length, 4, 'el háptico sigue en la lista, declarado ausente');
    assert.equal(por('haptico').montado, false);
    assert.equal(por('haptico').disponible, false);
    assert.match(por('haptico').motivo, /ningún módulo la monta/);
    assert.equal(por('notificaciones').disponible, true);
    assert.equal(registro.montadas(), 3);
  });

  test('Sin notificaciones la app arranca igual', async () => {
    const { estado, por } = await sondeado(losCuatroSin('notificaciones'));
    assert.equal(estado.length, 4);
    assert.equal(por('notificaciones').montado, false);
    assert.match(por('notificaciones').motivo, /\S/);
    assert.equal(por('haptico').disponible, true);
  });

  test('Sin respaldo la app arranca igual', async () => {
    const { estado, por } = await sondeado(losCuatroSin('respaldo'));
    assert.equal(estado.length, 4);
    assert.equal(por('respaldo').montado, false);
    assert.match(por('respaldo').motivo, /\S/);
  });

  test('Con las tres ausentes a la vez la app sigue en pie', async () => {
    const { estado, registro } = await sondeado(losCuatroSin('haptico', 'notificaciones', 'respaldo'));
    assert.equal(estado.length, 4, 'la lista enumera las cuatro aunque no haya ninguna disponible');
    for (const fila of estado) {
      assert.equal(fila.disponible, false);
      assert.match(fila.motivo, /\S/, 'ninguna fila queda vacía: la ausencia se declara');
    }
    assert.equal(registro.montadas(), 1, 'solo queda salud montada… y salud no está montada tampoco');
    // Y sigue quedando por dónde avisar, que es lo que impide que esto sea una app rota.
    assert.ok(registro.capasDeAviso().some((c) => c.capa === 'pantalla'));
  });

  test('Con las cuatro capacidades ausentes a la vez la lista las muestra las cuatro', async () => {
    const { estado, registro } = await sondeado([]);
    assert.equal(registro.montadas(), 0);
    assert.deepEqual(estado.map((c) => c.nombre), CAPACIDADES);
    for (const fila of estado) {
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
    const { registro } = await sondeado(losCuatroSin('haptico'));
    const capas = registro.capasDeAviso();
    assert.ok(capas.some((c) => c.capa === 'pantalla'), 'sin háptico no queda ninguna capa de pantalla declarada');
    assert.ok(capas.some((c) => c.siempre === true), 'la capa que no cuelga de ningún módulo tiene que existir');
    assert.equal(capas.some((c) => c.capa === 'bolsillo'), false);
  });

  test('Sin háptico y sin notificaciones sigue quedando declarada al menos una capa de pantalla', async () => {
    const { registro } = await sondeado(losCuatroSin('haptico', 'notificaciones'));
    const capas = registro.capasDeAviso();
    assert.ok(capas.length > 0, 'no queda ninguna capa: la app se ha quedado sin manera de avisar');
    assert.ok(capas.some((c) => c.capa === 'pantalla'));
  });

  test('Ninguna capacidad de plataforma es portadora única de una capa', async () => {
    // Se comprueba quitando cada módulo por separado: si alguna ausencia dejara la
    // app sin ninguna capa, esa capacidad sería portadora única y RF-INFRA-006
    // estaría incumplido para ella.
    for (const nombre of CAPACIDADES) {
      const { registro } = await sondeado(losCuatroSin(nombre));
      const capas = registro.capasDeAviso();
      assert.ok(capas.length > 0, `sin ${nombre} la app se queda sin ninguna capa de aviso`);
      assert.ok(capas.some((c) => c.capa === 'pantalla'), `sin ${nombre} no queda ninguna capa de pantalla`);
    }
    // Y con las cuatro fuera, también: la pantalla de la app no es un módulo.
    const { registro } = await sondeado([]);
    assert.ok(registro.capasDeAviso().some((c) => c.capa === 'pantalla'));
  });

  test('Una capacidad no disponible no aporta capa aunque su módulo esté montado', async () => {
    // Montada sin permiso no es una capa de aviso: contarla sería exactamente la
    // manera de creer que un aviso llegó cuando no puede llegar.
    const modulos = losCuatroSin('notificaciones');
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

    const { por } = await sondeado(losCuatro(), { ausentes: leido.ausentes });
    assert.equal(por('haptico').disponible, false);
    assert.match(por('haptico').motivo, /ausente por el gancho de andamiaje/);
    assert.equal(por('notificaciones').disponible, true, 'las demás mantienen su estado real');
  });

  test('El gancho con varias capacidades las deja todas ausentes y no toca las demás', async () => {
    const leido = leeGancho('walkingadventure://andamiaje?ausentes=notificaciones,haptico', EN_DESARROLLO);
    // El orden de salida es el de CAPACIDADES y no el del enlace: el estado de la
    // app no puede depender de en qué orden se escribieron los parámetros.
    assert.deepEqual(leido.ausentes, ['haptico', 'notificaciones']);

    const { por } = await sondeado(losCuatro(), { ausentes: leido.ausentes });
    assert.equal(por('haptico').disponible, false);
    assert.equal(por('notificaciones').disponible, false);
    assert.equal(por('respaldo').disponible, true);
  });

  test('El gancho con un nombre que no es ninguna capacidad no cambia nada y dice cuál fue', async () => {
    const leido = leeGancho('walkingadventure://andamiaje?ausentes=telepatia', EN_DESARROLLO);
    assert.deepEqual(leido, { ausentes: [], noReconocidos: ['telepatia'] });

    const { estado } = await sondeado(losCuatro(), { ausentes: leido.ausentes });
    const sinGancho = await sondeado(losCuatro());
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

    const { estado } = await sondeado(losCuatro(), { ausentes: leido.ausentes });
    const sinGancho = await sondeado(losCuatro());
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
    const conGancho = await sondeado(losCuatro(), { ausentes: leeGancho('walkingadventure://andamiaje?ausentes=haptico', EN_DESARROLLO).ausentes });
    assert.equal(conGancho.por('haptico').disponible, false);

    const alVolverAAbrir = await sondeado(losCuatro(), { ausentes: leeGancho(null, EN_DESARROLLO).ausentes });
    assert.equal(alVolverAAbrir.por('haptico').disponible, true);
  });

  test('Una capacidad forzada por el gancho no llega a sondearse', async () => {
    // Si se sondease, el gancho no serviría para doblar un módulo que revienta.
    let sondas = 0;
    const modulos = losCuatroSin('haptico');
    modulos.push(modulo('haptico', 'bolsillo', () => {
      sondas += 1;
      return { montado: true, disponible: true, motivo: null };
    }));
    await sondeado(modulos, { ausentes: ['haptico'] });
    assert.equal(sondas, 0, 'el gancho ha sondeado una capacidad que había declarado ausente');
  });
});
