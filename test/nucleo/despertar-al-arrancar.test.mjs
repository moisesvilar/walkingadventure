// SPEC-052 · **La premisa que hace inocua la neutralización**, y lo que el plugin declara de
// sí mismo. Lo que se afirma sobre el artefacto —que ningún receptor escuche el arranque y
// que el de notificaciones conserve su acción de entrega— vive en
// `manifiesto-generado.test.mjs`, porque necesita un manifiesto fusionado. Aquí está lo que
// se puede afirmar en un clon limpio, y que es la otra mitad de la misma promesa.
//
// ## Por qué existe
//
// La fila 52 le quita al receptor de `expo-notifications` las cinco acciones de arranque, y
// con ellas la única vía por la que el sistema podía restaurar notificaciones programadas
// tras reiniciar el móvil. Eso es inocuo **hoy**, y por un motivo medido y no heredado: la
// única llamada que programa un aviso en código vivo lo hace con `trigger: null`, o sea al
// momento, y nadie consulta ni cancela nada programado. Restaurar tras un reinicio no
// tendría qué restaurar.
//
// El día que alguien programe con disparador futuro, la neutralización **deja de ser
// inocua**: ese aviso no sobreviviría a un reinicio y quien lo escribió no se enteraría. Eso
// es una decisión de producto y no un detalle de configuración nativa, así que la medición
// entra como guarda y no como comentario. Una premisa que no puede ponerse roja es la forma
// de fallo de este repo (`pipeline/decisiones-orquestador.md` §6o).
//
// ## Dos decisiones de este fichero
//
// - **El código se lee como texto y no se importa**, igual que en `plugins-declarados`: lo
//   que se busca son llamadas a `expo-notifications`, y importar cualquier módulo que lo use
//   ataría la batería de núcleo a `node_modules`. La única excepción es
//   `app/plataforma/notificador.js`, que no importa nada de nadie —el módulo nativo entra
//   inyectado— y por eso se le puede pasar un doble y mirar con qué llama de verdad.
// - **Se mira sobre el código sin comentarios.** Estos módulos explican precisamente por qué
//   **no** programan con disparador, y buscar la palabra convertiría la explicación en un
//   fallo.
//
// **Nada de esto tiene escenario en `docs/testing.md`**: la batería describe qué hace el
// juego, no qué le hace su compilación al proyecto nativo. Va como hueco de batería en
// `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { creaNotificadorDeExpo } from '../../app/plataforma/notificador.js';

/** Las dos raíces de código vivo. `archive/` no entra: son instantáneas congeladas. */
const RAICES = ['app', 'packages'];

/**
 * Lo que no es código vivo aunque cuelgue de `app/`: los dos proyectos nativos generados,
 * el empaquetado y las dependencias. Mirarlos daría un falso rojo con el JavaScript que
 * alguna librería trae dentro, que no es de esta app y no lo decide nadie de aquí.
 */
const NO_ES_CODIGO_VIVO = new Set(['android', 'ios', 'dist', 'build', 'node_modules', '.expo']);

/** El plugin de configuración nativa que esta fila tocó, leído como texto. */
const PLUGIN = 'app/plugins/retira-permisos-prohibidos.js';

/** La acción con la que `expo-notifications` entrega cada aviso, y lo único que se conserva. */
const ACCION_DE_ENTREGA = 'expo.modules.notifications.NOTIFICATION_EVENT';

/** La llamada de `expo-notifications` que programa un aviso. Es la única que hay que mirar. */
const LLAMADA_QUE_PROGRAMA = 'scheduleNotificationAsync(';

/**
 * Lo que consulta, cancela o reprograma un aviso **ya programado**.
 *
 * Ninguna aparece hoy, y por eso la lista existe: la neutralización del receptor de arranque
 * es inocua mientras no haya nada programado que restaurar, y cualquiera de estas es la
 * señal de que alguien empezó a tener cola de avisos.
 */
const LO_QUE_MIRA_LA_COLA = [
  'getAllScheduledNotificationsAsync',
  'cancelScheduledNotificationAsync',
  'cancelAllScheduledNotificationsAsync',
  'getNextTriggerDateAsync',
];

/**
 * Los tipos de disparador futuro de `expo-notifications`, por su nombre.
 *
 * Se buscan por identificador y no por forma —nada de `seconds:` ni `repeats:` sueltos, que
 * significan otra cosa en media docena de sitios de este repo— para que un rojo aquí sea
 * siempre un disparador de verdad y nunca una duración con el mismo nombre.
 */
const DISPARADORES_FUTUROS = [
  'SchedulableTriggerInputTypes',
  'DateTriggerInput',
  'DailyTriggerInput',
  'WeeklyTriggerInput',
  'YearlyTriggerInput',
  'TimeIntervalTriggerInput',
  'CalendarTriggerInput',
];

const texto = (ruta) => readFileSync(join(RAIZ_REPO, ruta), 'utf8');

/** El código sin comentarios: lo comentado no corre, y aquí las explicaciones abundan. */
function sinComentarios(fuente) {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Todos los ficheros de código vivo de `app/` y `packages/`, en orden estable. */
function ficherosDeCodigo(dir, salida = []) {
  for (const nombre of readdirSync(join(RAIZ_REPO, dir)).sort()) {
    if (NO_ES_CODIGO_VIVO.has(nombre)) continue;
    const ruta = `${dir}/${nombre}`;
    if (statSync(join(RAIZ_REPO, ruta)).isDirectory()) ficherosDeCodigo(ruta, salida);
    else if (/\.(js|jsx|mjs)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

/**
 * Cada llamada a `scheduleNotificationAsync(...)` de un fuente, con sus argumentos enteros.
 *
 * Se recorta equilibrando paréntesis y no con una expresión regular: el argumento es un
 * objeto anidado y una regla perezosa lo cortaría en el primer `)` de dentro, que es donde
 * justo puede estar el disparador.
 */
function llamadasQueProgramanAviso(fuente) {
  const codigo = sinComentarios(fuente);
  const llamadas = [];
  let desde = 0;
  for (;;) {
    const inicio = codigo.indexOf(LLAMADA_QUE_PROGRAMA, desde);
    if (inicio === -1) break;
    let nivel = 0;
    let fin = inicio + LLAMADA_QUE_PROGRAMA.length - 1;
    for (; fin < codigo.length; fin += 1) {
      if (codigo[fin] === '(') nivel += 1;
      else if (codigo[fin] === ')') {
        nivel -= 1;
        if (nivel === 0) break;
      }
    }
    llamadas.push(codigo.slice(inicio, fin + 1));
    desde = fin + 1;
  }
  return llamadas;
}

describe('Ninguna notificación de esta app tiene que sobrevivir a un reinicio', () => {
  test('Ninguna notificación de esta app se programa con disparador futuro', () => {
    const programan = [];
    for (const ruta of RAICES.flatMap((raiz) => ficherosDeCodigo(raiz))) {
      for (const llamada of llamadasQueProgramanAviso(texto(ruta))) programan.push({ ruta, llamada });
    }

    // La lista no puede quedarse vacía sin protestar: una guarda que itera cero llamadas
    // pasa trivialmente, y entonces «nada programa con disparador futuro» dejaría de ser un
    // hecho medido para ser una casilla en blanco.
    assert.ok(
      programan.length > 0,
      'no hay ninguna llamada que programe una notificación en código vivo. Si las notificaciones se han retirado, esta guarda ' +
      'sobra y se quita a mano; si es que se han movido, hay que volver a medir por dónde salen.',
    );

    const conDisparador = programan.filter(({ llamada }) => !/trigger:\s*null\b/.test(llamada));
    assert.deepEqual(
      conDisparador.map(({ ruta }) => ruta),
      [],
      'estas llamadas programan una notificación sin `trigger: null`, o sea con disparador futuro. La fila 52 le quitó al ' +
      'receptor de `expo-notifications` las acciones de arranque, así que un aviso programado **no sobrevive a un reinicio**: ' +
      'que eso pase o no es una decisión de producto y se toma, no se descubre en un reinicio.',
    );

    // Y el otro lado del mismo disparador: `repeats` dentro de la llamada es una repetición
    // programada aunque el disparador venga escrito de otra forma.
    for (const { ruta, llamada } of programan) {
      assert.doesNotMatch(llamada, /\brepeats\b/, `la llamada de ${ruta} programa un aviso que se repite, y una repetición no sobrevive a un reinicio`);
    }

    const codigoEntero = RAICES.flatMap((raiz) => ficherosDeCodigo(raiz)).map((ruta) => sinComentarios(texto(ruta))).join('\n');
    for (const tipo of DISPARADORES_FUTUROS) {
      assert.equal(codigoEntero.includes(tipo), false, `el código vivo nombra "${tipo}", que es un disparador futuro de expo-notifications`);
    }
  });

  test('Nada consulta, cancela ni reprograma una notificación ya programada', () => {
    // Si no hay cola, no hay nada que restaurar tras un reinicio — que es exactamente lo que
    // hace inocuo haberle quitado el arranque al receptor. Cualquiera de estas llamadas es
    // la señal de que la cola empezó a existir.
    const apariciones = [];
    for (const ruta of RAICES.flatMap((raiz) => ficherosDeCodigo(raiz))) {
      const codigo = sinComentarios(texto(ruta));
      for (const llamada of LO_QUE_MIRA_LA_COLA) {
        if (codigo.includes(llamada)) apariciones.push(`${ruta} → ${llamada}`);
      }
    }
    assert.deepEqual(
      apariciones,
      [],
      'hay código que mira o toca la cola de notificaciones programadas. Mientras la cola esté vacía, quitarle el arranque al ' +
      'receptor de `expo-notifications` no le quita nada a nadie; en cuanto deja de estarlo, hay que decidir qué pasa con lo ' +
      'programado al reiniciar el móvil.',
    );
  });

  test('El notificador de Expo entrega el aviso al momento y sin disparador', () => {
    // Lo que la app hace con las notificaciones **no cambia con esta fila**, y esto lo mide
    // sobre la llamada de verdad y no sobre el código leído: el módulo nativo entra
    // inyectado, así que doblar aquí no es interceptar, es pasar otro argumento.
    const programadas = [];
    const notificaciones = {
      scheduleNotificationAsync(peticion) {
        programadas.push(peticion);
      },
    };

    const notificador = creaNotificadorDeExpo(notificaciones, { concedido: true });
    assert.equal(notificador.montado, true, 'el notificador de Expo no se monta con el módulo cableado y el permiso concedido');
    assert.equal(notificador.permisoConcedido(), true);

    notificador.notifica({ texto: 'Alguien espera en A Fonte Vella' });

    assert.equal(programadas.length, 1, 'la entrega no llegó al módulo, o llegó más de una vez');
    assert.deepEqual(programadas[0], { content: { title: 'Alguien espera en A Fonte Vella' }, trigger: null });
    // `trigger: null` es el aviso que sale ya. Que la clave esté y valga `null` es distinto de
    // que no esté: sin ella `expo-notifications` no promete entrega inmediata.
    assert.equal('trigger' in programadas[0], true, 'la petición no lleva la clave `trigger`, así que no dice que el aviso sale ya');
  });
});

describe('Lo que el plugin de configuración nativa declara de sí mismo', () => {
  test('La cabecera del plugin nombra la acción que el reemplazo conserva', () => {
    // El reemplazo del receptor de notificaciones **no puede** copiar el molde del de tareas,
    // y el porqué medido tiene que estar escrito donde se escribe el reemplazo: a este
    // receptor se le descubre por la acción de su filtro, así que quitársela no lo dejaría
    // dormido, lo dejaría mudo.
    const fuente = texto(PLUGIN);
    assert.ok(
      fuente.includes(ACCION_DE_ENTREGA),
      `la cabecera de ${PLUGIN} no nombra "${ACCION_DE_ENTREGA}", que es lo único que el reemplazo conserva`,
    );
    assert.match(
      fuente,
      /findDesignatedBroadcastReceiver|por la acción/,
      `${PLUGIN} no dice por qué el reemplazo conserva esa acción: el receptor se descubre por la acción declarada en su filtro, y sin filtro no entrega nada`,
    );
  });

  test('La cabecera del plugin ya no promete que la vía de las notificaciones siga abierta', () => {
    // La cabecera decía «No cierra la propiedad entera» mientras el receptor de
    // `expo-notifications` seguía escuchando el arranque. Ya no lo hace, y un comentario que
    // describe un estado que dejó de existir es peor que no tenerlo: se lee como vigente.
    assert.equal(
      texto(PLUGIN).includes('No cierra la propiedad entera'),
      false,
      `${PLUGIN} sigue diciendo que no cierra la propiedad entera, y desde SPEC-052 la cierra: los dos receptores que escuchaban el arranque están neutralizados`,
    );
  });
});
