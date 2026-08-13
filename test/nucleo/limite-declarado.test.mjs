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
// Lo que esta prueba NO afirma, a propósito: que las pantallas existan. Con los ocho
// primeros afirmaba lo contrario —que no hay camino hasta ellas—, y **desde la fila 46 esa
// frase ya no vale para todos**: `zurron.yaml` entra con la pantalla alcanzada y recorrida,
// y lo que declara es que su último tramo depende del mundo. Por eso las formas del límite
// son dos y se declaran una a una, más abajo. Su día de morir sigue siendo el mismo: el día
// en que haya camino hasta las que no lo tienen y se pueda pedir el mundo que las otras
// necesitan, y estos ficheros se desmarquen uno a uno.

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
 * Los que NO están, y por qué. **Eran seis y son cinco desde la fila 46**, que se llevó a
 * `zurron.yaml` de esta enumeración a la lista; su motivo está al final de este comentario y
 * no aquí, para que no haya dos sitios contándolo:
 *
 * - `arranque.yaml` recorre la app entera, de A1P1 a A1P7.
 * - `antes-de-salir.yaml` no tiene guarda ninguna: empieza con `runFlow: file: arranque.yaml`
 *   y sigue recorriendo. Su rojo es rojo de verdad.
 * - `ajustes.yaml` y `empezar-de-nuevo.yaml` **salieron de esta lista con la fila 43**,
 *   que montó el momento de consulta: se entra por `puerta-ajustes`, que es la del pie de
 *   la portada, y desde ahí a A6P7. Recorrido medido en `wa-pixel` el 10-ago-2026.
 * - `llegada.yaml` salió de esta lista con la fila 44 y **ha vuelto con la 49**: el motivo
 *   entero está más abajo, con su medida. Lo que aquella fila cableó sigue en pie —la máquina
 *   de una salida existe y funciona—; lo que no se sostenía era que hubiera siempre una
 *   llegada que validar.
 * - `en-marcha.yaml` **salió de esta lista con la fila 48**, que cableó el módulo de
 *   ubicación y el rótulo del sistema: «Salir a andar sin más» abre una salida de verdad y
 *   deja el momento en marcha en pantalla. Recorrido medido en `wa-pixel` el 11-ago-2026,
 *   **103 s de principio a fin** con el arranque entero dentro — un flujo que tarda diez
 *   segundos no ha recorrido nada, y este recorre. Lo que el flujo no puede comprobar y por
 *   qué está escrito en su cabecera, medido y no supuesto.
 *
 * La columna pasa de nueve a ocho, y sale **uno solo**: `llegada.yaml`, `visor.yaml` y
 * `descarte.yaml` dependen del camino de la llegada, que es la fila 44 entera.
 *
 * **La fila 44 la deja en siete, y sale uno de los tres: `llegada.yaml`.** Su spec preveía
 * cinco. La primera medida de la fila dio ocho —la capa de llegadas no se montaba en el
 * dispositivo y ninguna escena podía validar—; cerrados los cuatro defectos que aquello
 * destapó, se volvió a medir el 12-ago-2026 en `wa-pixel` y el número es siete. **El que se
 * publica es el medido, no el previsto, y las dos veces.**
 *
 * - `llegada.yaml` **salió** —y **volvió con la fila 49**, por lo que dice el bloque de abajo;
 *   esto queda como lo que aquella fila midió y no como lo que vale hoy—: recorría el arranque
 *   entero, echaba a andar desde la portada y la escena validaba sola estando parada dentro
 *   del geofence del sitio por el que empieza el mapa —veintitrés segundos—, sin tocar nada.
 *   Recorría A4P5 entera, la ausencia de navegación y de cifras, y el «Seguir» que devuelve al
 *   momento en marcha. **Ramificaba sobre la forma que salga** —lo que allí se cuenta, la
 *   ficha o el hueco declarado— porque qué sitio toca no lo decide el flujo: su primera
 *   versión daba por hecho el núcleo y era intermitente. Medido tres veces seguidas: **117 s,
 *   126 s y 119 s**. Lo que faltaba por aprender es que **eso solo era cierto con el aparato
 *   donde estaba**: la lección de «afirma la forma que salga» tenía un caso anterior sin
 *   cubrir, que puede no salir ninguna.
 * - `descarte.yaml` **se queda**, y el motivo que llevaba escrito era falso: decía que no
 *   había puerta hasta A4P8, y sí la hay —`ficha-descartar` está en la ficha, vista en el
 *   aparato, cuando el sitio de arranque es un servicio o un paraje—. Lo que no se puede es
 *   garantizar llegar a ella: el flujo no elige el sitio, y el ancla del mapa no la gobierna
 *   la posición que el flujo pone, porque el arranque lee la coordenada con precisión
 *   equilibrada y un fijo simulado no manda sobre esa lectura.
 * - `visor.yaml` **se queda** por su segundo límite, que sobrevivió al primero: sin lector de
 *   recursos binarios cableado toda llegada se resuelve como ficha —medido en el aparato,
 *   `llegada-estado` trae `ficha`—, así que el visor no se abre nunca.
 *
 * Los dos que se quedan cuentan ese motivo en su cabecera, y ninguno de los tres cuenta ya la
 * historia vieja —«falta `paso-llegada` en App.js»—, que era falsa desde que la máquina
 * existe: un límite declarado por un motivo que ya no es el suyo es peor que no declararlo.
 *
 * **La fila 49 la deja en ocho, y la que entra es `llegada.yaml`.** Su encargo preveía siete
 * → seis sacando `escena.yaml`, y lo medido es siete → ocho por un camino que nadie había
 * previsto: no entra ninguna pantalla nueva sin camino, **vuelve una que ya había salido**.
 *
 * - `llegada.yaml` **vuelve**, y salió con la fila 44. No porque falte camino —lo hay, y es
 *   el bueno: quien juega está parada y la escena valida sola— sino porque **el flujo no
 *   puede garantizar que haya ninguna llegada que validar**. Medido el 12-ago-2026, tres
 *   ejecuciones de tres muertas en `Assertion is false: id: llegada is visible`, con la
 *   salida abierta (`abierta-con-rotulo`), el momento en marcha montado sin ninguna avería,
 *   `marca-posicion = del-mapa:-633,-112:ambiguo` — y **`salida-sitio = sin-sitio`**, con
 *   `llegadas: 0 validadas`. El ancla del mapa sale de donde esté el GPS del emulador al
 *   arrancar, y alrededor de esa coordenada puede no haber ningún sitio a menos del radio del
 *   geofence. **El verde de la fila 44 no era reproducible**: lo midió con el aparato donde
 *   hubiera quedado entonces, y un flujo cuyo verde depende de eso no es una prueba. Lo que
 *   sí recorría y no dependía del azar —la salida abierta, el momento en marcha sin avería,
 *   el módulo de ubicación, la cadencia y el sitio bajo la marca— **se ha trasladado a
 *   `en-marcha.yaml`**, que recorre de verdad: aquí habrían tenido que colgar de una
 *   condición y habrían dejado de verificar nada.
 *
 * Y las dos de la fila que no se mueven, con lo que se aprendió midiéndolas:
 *
 * - `escena.yaml` **se queda**, y su motivo viejo era falso: decía que faltaba `paso-escena`
 *   en `App.js`. Hoy la escena se monta —inyectada en `PantallaLlegada` por su tipo de paso—
 *   y **esa puerta no debe existir**: SPEC-049 declara que la ausencia de rutas es la pieza,
 *   porque no hay manera de llegar a A4P3 sin haber llegado al sitio. Lo que lo mantiene aquí
 *   son tres medidas que se suman: el ancla del mapa no la gobierna la posición que el flujo
 *   pone (fila 44), la semilla nace de entropía real y el arranque no ofrece dónde escribirla,
 *   y **`setLocation` no mueve la marca** en esta máquina, así que no se puede andar hasta un
 *   beat. Juntas: **qué sitio tiene beat no es reproducible entre tandas**.
 *
 *   La cuarta medida **ya no está**, y con SPEC-050 se corrige aquí en el mismo commit que la
 *   cierra: decía que sin llamador de `siembraLaCola` no podía saltar ningún micro-encuentro,
 *   y ahora la cola se siembra al nacer la partida, así que una salida sin aventura sí puede
 *   producir un paso de beat. Lo que mantiene a `escena.yaml` en la lista son las **tres** de
 *   arriba, que son de reproducibilidad y no de cableado, y que esta fila no toca.
 * **La fila 46 la deja en nueve, y la que entra es `zurron.yaml`.** Y entra **contradiciendo un
 * criterio de su propia spec**, que decía «`zurron.yaml` sigue sin estar en la lista —no está
 * hoy y no entra— y la columna no sube por esta fila». Sube. Se dice aquí en voz alta en lugar
 * de disimularlo, porque lo que aquel criterio no podía saber es lo que se midió al recorrer el
 * flujo de verdad. Decisión del dueño, y el precedente que la sostiene es `llegada.yaml`: un
 * flujo que pasa o falla según el mundo, contado en la columna de los verdes, es peor que uno
 * declarado.
 *
 * - `zurron.yaml` **entra**, y no porque no llegue: **llega**. Recorre el arranque entero, la
 *   portada, A6P6, el interruptor con su permiso, la razón de permisos por su enlace y el
 *   gancho de metros de fondo — 168 comandos desde que `044af9b` arregló la fila del
 *   interruptor, que era inerte fuera del `Switch` y hacía que `enciende()` ni corriera. Lo
 *   que no puede garantizar es **lo último**: que A2P2 aparezca.
 *
 *   **El motivo NO es «falta la siembra».** Ese era el motivo que se iba a escribir y era
 *   falso: `siembraLaCola` tiene llamador desde SPEC-050 —`app/mapa/donde-estas.js:169`, con
 *   la pieza expuesta en `app/nucleo/piezas.js:222`—. Escribirlo habría estrenado el tercer
 *   motivo caducado de esta lista, después de los de `descarte.yaml` y `escena.yaml`, que
 *   costaron una sesión cada uno de desatascar.
 *
 *   **Lo medido, el 12-ago-2026, montando la partida en Node exactamente como la monta la
 *   app** —`correPrologo` + `siembraLaCola` como en `donde-estas.js`, y el motor con
 *   `creaMotorDelMapaActivo`—: el prólogo siembra **2 entradas** en la cola y deja **3
 *   rumores, los tres con `frentes: []` y `agotado: true`**; sesenta pasos del motor dan
 *   **0 pasos con efecto y 0 efectos**, y las 2 entradas de la cola **siguen pendientes**.
 *
 *   Son **dos vías** y no se comportan igual, que es justo lo que hace que esto sea un límite
 *   y no una avería:
 *
 *   - **La cola no produce nunca por pasos, y eso sí es estructural y siempre cierto.**
 *     `creaColaDeEntregas` declara que **sin `producciones` inyectadas su productor no produce
 *     nada y no falla** —«sin producción del mundo no hay encuentro, nunca relleno aleatorio»,
 *     `quests.md` decisión 3—, y `app/salida/motor.js` le pasa `producciones: null`
 *     **declarado**. Lo que el prólogo siembra se entrega por otra vía: el micro-encuentro al
 *     atravesar sitios durante una salida (`microencuentros.js`, «como mucho uno por paso del
 *     mundo»). Por aquí no llega nada al zurrón, ni en este mundo ni en ninguno.
 *   - **La propagación produce o no, y depende del grafo del mundo.** Un rumor nace con **un
 *     frente por vecino del núcleo donde ocurrió** —`rumores.js:332`,
 *     `frentes: arbol.vecinos(origen).map(...)`— y queda agotado en cuanto se queda sin
 *     ninguno —`rumores.js:338`, `rumor.agotado = rumor.frentes.length === 0`, con su propio
 *     comentario diciendo que «un mundo de un solo núcleo sedimenta ahí y ya está agotado»—.
 *     Cuántos frentes nacen y cuánto tardan en consumirse lo decide el árbol de calzadas: en
 *     un mundo pequeño el prólogo los gasta enteros y la partida arranca sin nada en vuelo; en
 *     uno con más vecinos quedan frentes vivos y los pasos de fondo **sí** producen.
 *
 *   Así que **los tres `frentes: []` de arriba son ciertos de aquel mundo, no del prólogo**:
 *   decir que los rumores «nacen sedimentados» afirmaría más de lo que la medida sostiene.
 *   **Y hay la medida contraria, que es la que cierra el argumento**: la tanda de cierre de la
 *   fila (`SUITE-run-20260813T050409Z`) corrió **la rama con zurrón** —`zurron-envoltorio` y
 *   `zurron-entrada` a la vista, la rama sin zurrón `SKIPPED`—, y el zurrón solo compone
 *   entradas a partir de efectos narrables (`esNarrable`, `packages/nucleo/partida/zurron.js`).
 *   Ese mundo sí produjo. Con las dos direcciones observadas, «depende del mundo» deja de ser
 *   una inferencia y pasa a ser un hecho medido — que es lo que **refuerza** este límite en
 *   lugar de debilitarlo: no es que nunca haya zurrón, es que no se puede pedir la tanda en la
 *   que lo haya.
 *
 *   O sea: **lo sembrado entrega por llegadas y no por pasos de fondo, y de los rumores del
 *   prólogo depende del grafo cuántos frentes queden vivos, así que una partida recién
 *   arrancada puede no tener nada en vuelo.** No es que no pueda haberlo nunca —un rumor nacido de un desenlace de quien juega
 *   sí tiene frentes—: es que **no se puede pedir un mundo que lo tenga**, y ahí este flujo
 *   comparte la deuda de fondo de `escena.yaml`, la segunda de las tres suyas: «la semilla nace
 *   de entropía real y el arranque no ofrece dónde escribirla». **No se abre entrada nueva**:
 *   es la misma deuda y el día que se cierre, se cierran las dos.
 *
 *   Lo que el flujo hace en su lugar es bifurcar donde el límite ocurre: sin zurrón afirma que
 *   la puerta lleva a lo que hay hoy, y con zurrón recorre A2P1 → A2P2 → A2P3 entero. Y **el
 *   mecanismo entero del zurrón se afirma en `@nucleo`**, que es donde el rojo es posible:
 *   `test/nucleo/zurron.test.mjs` cubre si hay zurrón y por qué, sus entradas y su orden, el
 *   tope de cinco, la caída a plantilla, la llamada única, el vaciado con su hecho, la
 *   confirmación repetida y el recorrido A2P1 → A2P2 → A2P3 sobre la máquina del momento.
 *
 * - `telon.yaml` **no entra**, y estuvo a punto. Se escribió marcado con el motivo «las tres
 *   vías de cierre están fuera del alcance de un flujo», y era falso: al telón **se llega sin
 *   moverse**. Se sale a andar, se mata la app —el servicio en primer plano muere con el
 *   proceso—, y al reabrir la portada enseña la tarjeta de a medias, cuyo «dejarlo aquí» es
 *   una de las tres vías. Recorrido a mano el 12-ago-2026, dos veces, y `en-marcha.yaml` ya
 *   recorría esa misma reapertura desde la fila 48. El error de método fue razonar sobre lo
 *   que un flujo puede hacer en lugar de mirar lo que el juego ya hace cuando el sistema mata
 *   la app, que es un caso diseñado a propósito en `bucle-jugable.md` §9.
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
  'zurron.yaml',
];

/**
 * **Las dos formas que puede tener un límite declarado**, y por qué hay dos desde la fila 46.
 *
 * Hasta ella todos los flujos marcados eran de la misma especie: **no había camino hasta su
 * pantalla**, así que su verde solo podía significar «el límite sigue en pie» y la guarda se
 * evaluaba nada más arrancar. `zurron.yaml` es de otra: **hay camino y lo recorre entero** —el
 * arranque, la portada, A6P6, el interruptor con su permiso, la razón de permisos y el gancho—
 * y lo que no puede garantizar es **lo último**, que el mundo tenga algo que contar. Eso no se
 * sabe al arrancar: se sabe al final del recorrido.
 *
 * Meterlo a la fuerza en la primera forma habría costado los 168 comandos que sí verifica, y un
 * flujo que deja de verificar para caber en una guarda es exactamente lo que esta lista existe
 * para no premiar. Así que la forma se declara **una a una y a mano**, igual que la lista: un
 * flujo nuevo que quiera la segunda tiene que nombrarse aquí, y eso es lo que impide que
 * «depende del mundo» se convierta en la excusa cómoda de cualquier rojo intermitente.
 *
 * Lo que **no** cambia entre las dos: sigue habiendo **una sola guarda** de primer nivel, sigue
 * teniendo que comprobar que la app abre donde abre y que la pantalla no está, sigue teniendo
 * que quedar un cuerpo colgando de la condición contraria, y siguen valiendo las dos
 * direcciones de rojo. Lo único que cambia es **dónde puede estar ese cuerpo** y **qué frase
 * tiene que llevar la explicación del marcador**, que en la segunda forma no puede ser «no
 * recorre» porque sería falsa.
 */
const FORMA_DEL_LIMITE = {
  'zurron.yaml': {
    id: 'depende-del-mundo',
    frase: 'depende del mundo',
    porque: 'recorre hasta el final y lo que no puede garantizar es que el mundo dé el caso',
  },
};

/** La forma por defecto: no hay camino hasta la pantalla, que es con la que nació la lista. */
const SIN_CAMINO = { id: 'sin-camino', frase: 'no recorre', porque: 'no hay camino hasta su pantalla' };

/** La forma declarada de un flujo. Sin entrada propia, la de siempre. */
function formaDe(fichero) {
  return FORMA_DEL_LIMITE[fichero] ?? SIN_CAMINO;
}

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
      // Y explicado: la línea sola diría qué pasa y no por qué. Cada forma tiene la suya, y
      // pedir la que no es sería obligar a escribir algo falso: «no recorre» en un flujo que
      // recorre entero es peor que no explicar nada.
      const forma = formaDe(fichero);
      assert.ok(
        lineas.slice(donde + 1, donde + 16).some((l) => l.includes(forma.frase)),
        `${fichero}: el marcador no va seguido de la explicación de su forma («${forma.frase}»: ${forma.porque})`,
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
      //
      // Dónde se busca depende de la forma. En la de siempre el cuerpo cuelga del primer
      // nivel, porque el límite se conoce al arrancar. En la de «depende del mundo» el límite
      // se conoce **al final del recorrido**, así que la bifurcación vive dentro y aquí se
      // busca sobre el fichero entero — lo que se exige es lo mismo: que exista una rama que
      // sí recorra la pantalla el día que el mundo la dé.
      const forma = formaDe(fichero);
      const donde = forma.id === 'sin-camino'
        ? bloques.filter((b) => b.nombre === 'runFlow').map((b) => b.lineas.join('\n'))
        : [...fuente(`test/app/${fichero}`).matchAll(/- runFlow:\n(?:[ ]+.*\n)+/g)].map((m) => m[0]);
      const contrarias = donde.filter((t) => new RegExp(`(?<!not)[Vv]isible:\\s*\\n\\s*id: '${pantalla[1]}'`).test(t));
      assert.ok(
        contrarias.some((t) => new RegExp(`when:\\s*\\n\\s*visible:\\s*\\n\\s*id: '${pantalla[1]}'`).test(t)),
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
      //
      // Vale igual para las dos formas, y en la de «depende del mundo» dice algo más fuerte:
      // allí el verde significa «el límite sigue en pie **y** el recorrido hasta él funciona»,
      // que es más y no menos. Lo que esta comprobación impide es lo mismo en los dos casos:
      // que algo se ejecute sin que nadie haya declarado bajo qué condición.
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
    // sin que alguien lo vea aquí. `en-marcha.yaml` entra en esta lista con la fila 48 y
    // `telon.yaml` con la 49, que es lo que impide que vuelvan a la columna sin que nadie se
    // entere. `llegada.yaml` no está por lo de siempre: hasta la 44 sí llevaba marcador, y
    // meterlo aquí obligaría a recordar por qué; lo que lo sostiene es la lista de arriba,
    // donde su salida está escrita con la medida.
    // Y `zurron.yaml` **sale de la lista de aquí abajo con la fila 46 porque entra en la de
    // límite declarado**, que es el movimiento contrario al que la fórmula «salió de esta
    // lista con la fila NNN» describe en el comentario de arriba: aquélla se lee «dejó de
    // ser un límite declarado», y esto es lo opuesto. Sale de aquí porque aquí solo pueden
    // estar los que **no** llevan marcador. No es un aflojamiento: entra por haberse
    // recorrido y haberse medido que su último tramo depende del mundo, igual que
    // `llegada.yaml`. El motivo entero está arriba, con la medida.
    for (const fichero of ['arranque.yaml', 'antes-de-salir.yaml', 'en-marcha.yaml', 'telon.yaml']) {
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
