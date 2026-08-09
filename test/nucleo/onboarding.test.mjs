// SPEC-027 · El arranque: la máquina de las siete pantallas, el punto de partida y su
// permiso, la reanudación, el guion de textos y lo que la fila deja puesto.
//
// Casi todo lo que esta fila entrega se afirma aquí y no en `test/app/`, y es
// deliberado: en esta máquina no hay simulador, así que un criterio que solo se
// pudiera leer en un dispositivo no se pondría rojo nunca. Lo que lo hace posible es
// que la secuencia, la lista cerrada de campos y **el guion de textos** vivan en el
// paquete: se leen como datos, en Node, sin montar ninguna pantalla.
//
// Los casos con nombre de escenario son los de `docs/testing.md`, literales —«El
// onboarding habla como aplicación», «No se pregunta la edad», «El horario diurno
// viene encendido», «Los pasos de fondo vienen apagados», «La app no pide el permiso
// de ubicación permanente»—. El resto va marcado como hueco de la batería en
// `test/spec-test-map.json`: la batería no tiene ninguna característica sobre la
// secuencia del arranque ni sobre la reanudación.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: la entropía de la semilla
// entra inyectada, los datos de OSM salen de fixtures y el proveedor de ubicación es
// uno de los tres dobles de `test/dobles/ubicacion.mjs`.
//
// Y dos cosas de la spec que **no se han entregado**, las dos por la misma razón
// —ninguna spec ha nombrado todavía su dependencia—: el módulo nativo de ubicación y
// la capa de teselas de A1P4. Tienen bloque propio al final, porque lo que sí se puede
// afirmar es que la ausencia se declara en vez de disimularse.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPOS_DEL_ARRANQUE,
  CAMPOS_POR_PASO,
  CLAVE_DEL_ARRANQUE,
  ORIGENES_DEL_PUNTO,
  PASOS,
  PASOS_CON_VUELTA,
  PIEZAS_DEL_ARRANQUE,
  TOTAL_DEL_CONTADOR,
  congelaOnboarding,
  contadorDe,
  creaArranque,
  exigePaso,
  levantaOnboarding,
  llevaVuelta,
  pasoAlReanudar,
  sinContestar,
} from '../../packages/nucleo/partida/onboarding.js';
import {
  EXCEPCIONES_DE_REGISTRO,
  FRONTERA_DE_REGISTRO,
  GUION,
  PREGUNTAS_QUE_EL_ARRANQUE_NO_HACE,
  REGISTROS,
  cifrasDeTexto,
  guionDePaso,
  revisaGuion,
  textoDeRespuestaDeTramo,
  textoDelGuion,
  textosDelArranque,
} from '../../packages/nucleo/partida/guion-de-arranque.js';
import { AJUSTES_DE_ORIGEN, IDS_DE_AJUSTE, cambiaAjuste, estadoDeAjustes } from '../../packages/nucleo/partida/ajustes.js';
import { DESTINO, compruebaFicha, fichaDeLaTienda } from '../../packages/nucleo/partida/ficha-de-la-tienda.js';
import { DECLARACION_DEL_SUELO, IDS_DE_RESPUESTA, RESPUESTAS_DE_TRAMO, SUELO_TRAMO_M, tramoDeRespuesta } from '../../packages/nucleo/partida/tramo.js';
import { anclaje, idDeMapa } from '../../packages/nucleo/world/rejilla.js';
import { ENTROPIA_A, ENTROPIA_B } from './celda-de-prueba.mjs';
import { fuente, leeExtracto, modulosDelPaquete } from './mundo-de-prueba.mjs';
import {
  POSICION_CONCEDIDA,
  PUNTO_POR_DEFECTO,
  ubicacionQueConcede,
  ubicacionQueDeniega,
  ubicacionQueLanza,
} from '../dobles/ubicacion.mjs';

/** Serialización completa: la única comparación que afirma «idéntico byte a byte». */
const serializado = (valor) => JSON.stringify(valor);

/** El idioma con el que se abre A1P1 en estas pruebas: el punto por defecto está en Galicia. */
const LOCALE = 'gl';

/** Los módulos que esta fila añade al paquete. Se nombran porque se les mira la fuente. */
const MODULOS_DE_LA_FILA = [
  'packages/nucleo/partida/onboarding.js',
  'packages/nucleo/partida/personaje.js',
  'packages/nucleo/partida/guion-de-arranque.js',
  'packages/nucleo/partida/ajustes.js',
  'packages/nucleo/partida/ficha-de-la-tienda.js',
];

/** Un arranque cableado con los cuatro dobles, listo para recorrer. */
function montaArranque({ ubicacion = ubicacionQueConcede(), entropia = ENTROPIA_A, locale = LOCALE, puntoPorDefecto = PUNTO_POR_DEFECTO } = {}) {
  const arranque = creaArranque({ ubicacion, entropia, locale, puntoPorDefecto });
  arranque.empieza();
  return arranque;
}

/**
 * Recorre el arranque entero con las mismas respuestas y devuelve lo que entrega.
 *
 * Las respuestas son argumentos y no constantes de dentro: dos recorridos con las
 * mismas respuestas tienen que dar lo mismo, y dos con distintas no.
 */
async function recorreEntero({
  ubicacion = ubicacionQueConcede(),
  entropia = ENTROPIA_A,
  locale = LOCALE,
  nombre = 'Xoana',
  genero = 'femenino',
  oficio = 'taberna',
  respuesta = 'otro-barrio',
  arrastra = null,
} = {}) {
  const arranque = montaArranque({ ubicacion, entropia, locale });
  arranque.escribeNombre(nombre);
  arranque.eligeGenero(genero);
  arranque.eligeOficio(oficio);
  arranque.avanza();
  arranque.respondeTramo(respuesta);
  arranque.avanza();
  await arranque.pideElPermiso();
  if (arrastra) arranque.mueveLaMarca(arrastra.lat, arrastra.lon);
  arranque.confirmaElPunto();
  arranque.mapaPintado();
  arranque.avanza();
  return { arranque, cerrado: arranque.cierra() };
}

// ── La secuencia de las siete pantallas ────────────────────────────────────────

describe('La secuencia de las siete pantallas', () => {
  test('Los siete pasos se recorren en el orden del flujo', () => {
    assert.deepEqual([...PASOS], [
      'quien-eres', 'tu-tramo', 'el-permiso', 'donde-se-levanta',
      'la-generacion', 'tu-mapa', 'la-primera-aventura',
    ]);
    // El vocabulario es cerrado por los dos lados: un paso inventado falla nombrando
    // los siete, en vez de dejar la pantalla en un estado que nadie declaró.
    assert.throws(() => exigePaso('la-portada'), /la-portada[\s\S]*quien-eres/);
    assert.throws(() => exigePaso(undefined), /quien-eres/);

    const arranque = montaArranque();
    const recorrido = [arranque.vista().paso];
    for (let k = 1; k < PASOS.length; k++) recorrido.push(arranque.avanza().paso);
    assert.deepEqual(recorrido, [...PASOS], 'avanzar no recorre los siete pasos en su orden');
    // El último no avanza a ninguna parte: de ahí se sale cerrando.
    assert.equal(arranque.avanza().paso, 'la-primera-aventura');
  });

  test('Las cinco primeras llevan flecha y contador sobre cinco, y las dos últimas ninguno', () => {
    assert.deepEqual([...PASOS_CON_VUELTA], PASOS.slice(0, 5));
    assert.equal(TOTAL_DEL_CONTADOR, 5);
    for (const [i, paso] of PASOS.entries()) {
      const contador = contadorDe(paso);
      if (i < 5) {
        assert.equal(llevaVuelta(paso), true, `${paso} debería llevar flecha`);
        assert.deepEqual({ ...contador }, { n: i + 1, de: 5 }, `el contador de ${paso} no dice el paso sobre cinco`);
      } else {
        // Desde que el mapa existe no se vuelve, y un contador que siguiera subiendo
        // sin flecha prometería algo que no existe.
        assert.equal(llevaVuelta(paso), false, `${paso} no puede llevar flecha: el mapa ya existe`);
        assert.equal(contador, null, `${paso} no puede llevar contador`);
      }
    }
  });

  test('Volver atrás desde A1P3 deja la respuesta de tramo ya marcada', async () => {
    const arranque = montaArranque();
    arranque.eligeOficio('botica');
    arranque.avanza();
    arranque.respondeTramo('pueblo-de-al-lado');
    const enPermiso = arranque.avanza();
    assert.equal(enPermiso.paso, 'el-permiso');

    const vuelta = arranque.atras();
    assert.equal(vuelta.paso, 'tu-tramo');
    assert.equal(vuelta.precubierto.respuestaDeTramo, 'pueblo-de-al-lado', 'la respuesta de tramo no vuelve marcada');
  });

  test('Retroceder hasta A1P1 no resortea el nombre ni pierde el oficio', () => {
    const arranque = montaArranque();
    const primeras = arranque.vista().sugerencias;
    arranque.escribeNombre('Sabela');
    arranque.eligeOficio('forja');
    arranque.avanza();
    arranque.avanza();

    const vuelta = arranque.atras().paso === 'tu-tramo' ? arranque.atras() : arranque.vista();
    assert.equal(vuelta.paso, 'quien-eres');
    assert.equal(vuelta.precubierto.nombre, 'Sabela', 'el nombre contestado no sigue puesto');
    assert.equal(vuelta.precubierto.oficio, 'forja', 'el oficio marcado no sigue marcado');
    assert.deepEqual([...vuelta.sugerencias], [...primeras], 'volver atrás ha vuelto a sortear las sugerencias');
  });

  test('La flecha de atrás en A1P1 no sale de la app ni pierde nada', () => {
    const arranque = montaArranque();
    arranque.escribeNombre('Uxía');
    const antes = serializado(arranque.vista());
    const despues = arranque.atras();
    assert.equal(despues.paso, 'quien-eres', 'la primera pantalla ha ido a alguna parte');
    assert.equal(serializado(despues), antes, 'la primera pantalla ha perdido algo al pulsar atrás');
  });

  test('Cerrar el arranque lo deja cerrado y sella el oficio', async () => {
    const { arranque, cerrado } = await recorreEntero();
    assert.equal(arranque.vista().cerrado, true);
    assert.equal(cerrado.personaje.oficioPermanente, true, 'el arranque se ha cerrado sin sellar el oficio');
    // Y no se cierra a medias: falta un campo de la lista cerrada y se dice cuál.
    const aMedias = montaArranque();
    assert.throws(() => aMedias.cierra(), /falta "oficio"[\s\S]*nombre, genero, oficio/);
  });

  test('El arranque no se puede cerrar sin contestar la lista cerrada de campos', () => {
    const arranque = montaArranque();
    // Recién abierto solo está contestado lo que llega puesto: el nombre precargado y
    // el género de origen. Lo demás es lo que las pantallas recogen.
    assert.deepEqual([...sinContestar(arranque.estado())], ['oficio', 'respuestaDeTramo', 'origenDelPunto', 'anclaje']);
    arranque.eligeOficio('mercado');
    assert.deepEqual([...sinContestar(arranque.estado())], ['respuestaDeTramo', 'origenDelPunto', 'anclaje']);
  });
});

// ── El guion de textos ─────────────────────────────────────────────────────────

describe('El guion de textos del arranque', () => {
  test('El onboarding habla como aplicación', () => {
    // El escenario de la batería, afirmado sobre el guion: cada pieza declara su
    // registro, y las que hablan como mundo son **excepciones enumeradas**, no un
    // deslizamiento. Una nueva tiene que escribirse en la lista y se ve en el diff.
    const deMundo = GUION.filter((p) => p.registro === REGISTROS.MUNDO).map((p) => `${p.paso}/${p.id}`);
    assert.deepEqual(deMundo.slice().sort(), [...EXCEPCIONES_DE_REGISTRO].sort(), 'hay piezas que hablan como mundo fuera de la lista de excepciones');

    // Y las excepciones son las que la spec declara: las fases de A1P5, el prólogo, el
    // título y el trato de A1P6 y las tres piezas de A1P7.
    for (const clave of ['la-generacion/fases', 'la-generacion/prologo', 'tu-mapa/trato']) {
      assert.ok(EXCEPCIONES_DE_REGISTRO.includes(clave), `${clave} debería hablar como mundo`);
    }
    // Todo lo demás explica qué hace la app y por qué, empezando por las cuatro
    // pantallas donde se elige algo.
    for (const paso of ['quien-eres', 'tu-tramo', 'el-permiso', 'donde-se-levanta']) {
      const piezas = guionDePaso(paso).filter((p) => typeof p.texto === 'string');
      assert.ok(piezas.length > 0, `${paso} no tiene ninguna pieza con texto`);
      for (const pieza of piezas) {
        assert.equal(pieza.registro, REGISTROS.APLICACION, `${paso}/${pieza.id} habla como mundo antes de la frontera de registro`);
      }
    }
    // El guion se revisa a sí mismo al cargarse; que la revisión no tenga nada que
    // decir es lo que hace que lo anterior signifique algo.
    assert.deepEqual(revisaGuion({ pasos: PASOS }), []);
  });

  test('La frontera de registro es el botón «Salir a andar» de A1P7', () => {
    assert.deepEqual({ ...FRONTERA_DE_REGISTRO }, { paso: 'la-primera-aventura', pieza: 'salir' });
    assert.equal(textoDelGuion(FRONTERA_DE_REGISTRO.paso, FRONTERA_DE_REGISTRO.pieza), 'Salir a andar');
    // Es el último texto del guion: nada de la voz de aplicación va después.
    const ultima = GUION[GUION.length - 1];
    assert.equal(`${ultima.paso}/${ultima.id}`, `${FRONTERA_DE_REGISTRO.paso}/${FRONTERA_DE_REGISTRO.pieza}`);
  });

  test('Ninguna pantalla del arranque se queda sin texto, y la que falte se nombra', () => {
    for (const paso of PASOS) {
      assert.ok(guionDePaso(paso).length > 0, `${paso} se ha quedado sin guion`);
    }
    assert.throws(() => guionDePaso('la-portada'), /"la-portada"[\s\S]*quien-eres/);
    // Y una pieza que no trae texto propio dice de dónde sale el suyo, en vez de
    // devolver una cadena vacía que en pantalla se lee como un hueco.
    assert.throws(() => textoDelGuion('la-generacion', 'fases'), /no trae texto propio[\s\S]*fases del levantamiento/);
    assert.throws(() => textoDelGuion('tu-tramo', 'no-existe'), /no declara la pieza "no-existe"/);
  });

  test('Ningún texto del arranque lleva cifras de distancia, de tiempo, de ritmo ni de pasos', () => {
    for (const pieza of textosDelArranque()) {
      const infracciones = cifrasDeTexto(pieza.texto, { salvo: pieza.salvo ?? [] });
      assert.deepEqual(infracciones, [], `${pieza.paso}/${pieza.id} lleva una cifra: «${pieza.texto}»`);
      // Y una pieza que se salta una familia dice por qué. Hoy hay una sola, y es la
      // pregunta del tramo: `accesibilidad.md` §1 la formula literalmente en media
      // hora, que es la definición de la unidad y no una cifra de esfuerzo.
      if (pieza.salvo) {
        assert.equal(typeof pieza.porque, 'string', `${pieza.paso}/${pieza.id} se salta ${pieza.salvo} sin decir por qué`);
        assert.ok(pieza.porque.length > 20);
      }
    }
    const conExcepcion = textosDelArranque().filter((p) => p.salvo);
    assert.deepEqual(conExcepcion.map((p) => `${p.paso}/${p.id}`), ['tu-tramo/pregunta'], 'hay más excepciones de cifra que la pregunta del tramo');
  });

  test('Ningún texto depende de un número que solo existe en la maqueta', () => {
    // El escenario de la batería pide generar diez mundos distintos y comprobar que
    // ningún texto se vuelve falso. Sobre el guion, «falso» solo puede ocurrir de dos
    // maneras: que un texto afirme una cantidad, o que nombre algo del mundo. Se mide
    // contra los ocho extractos de referencia —cuatro mundos por dos semillas—, que
    // son los mundos distintos que este repositorio tiene congelados.
    const mundos = [];
    for (const nombre of ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso']) {
      for (const semilla of ['1', '2']) mundos.push(leeExtracto(nombre, semilla));
    }
    assert.equal(mundos.length, 8);

    const nombresDelMundo = new Set();
    for (const mundo of mundos) {
      for (const clave of ['nucleos', 'servicios', 'parajes', 'calzadas']) {
        for (const e of mundo[clave] ?? []) if (e.nombre) nombresDelMundo.add(e.nombre);
      }
      if (mundo.cabecera?.titulo) nombresDelMundo.add(mundo.cabecera.titulo);
    }
    assert.ok(nombresDelMundo.size > 50, `solo se han recogido ${nombresDelMundo.size} nombres: la prueba no está mirando ningún mundo`);

    for (const pieza of textosDelArranque()) {
      for (const nombre of nombresDelMundo) {
        assert.equal(pieza.texto.includes(nombre), false, `${pieza.paso}/${pieza.id} nombra "${nombre}", que es de un mundo concreto`);
      }
      // Ninguna cantidad afirmada: ni dígitos ni numerales de los que una pantalla
      // pueda quedarse corta cuando el mundo salga con otro tamaño.
      assert.equal(/\d/.test(pieza.texto), false, `${pieza.paso}/${pieza.id} afirma una cantidad`);
      assert.equal(
        /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(núcleos?|pueblos?|parajes?|aventuras?|sitios?|calzadas?|caminos?)\b/i.test(pieza.texto),
        false,
        `${pieza.paso}/${pieza.id} cuenta elementos del mundo`,
      );
    }
  });

  test('La primera línea de A1P1 dice que el nombre es el del personaje', () => {
    const linea = textoDelGuion('quien-eres', 'de-quien-es-el-nombre');
    assert.match(linea, /el nombre de tu personaje/);
    // Y deja claro que no es el de quien juega, sin prohibirlo: «puede coincidir con
    // el tuyo». `personaje.md` §1 quiere justo eso, que nadie teclee su nombre real
    // por inercia y que quien quiera hacerlo pueda.
    assert.match(linea, /[Pp]uede coincidir con el tuyo/);
    assert.match(linea, /inventarse otro/);
    // La pregunta que la encabeza es la de la maqueta, literal.
    assert.equal(textoDelGuion('quien-eres', 'pregunta'), '¿Quién vas a ser ahí dentro?');
  });

  test('Cada respuesta de tramo tiene su texto y ninguno nombra una medida', () => {
    for (const id of IDS_DE_RESPUESTA) {
      const texto = textoDeRespuestaDeTramo(id);
      assert.ok(texto.length > 3, `la respuesta "${id}" no tiene texto`);
      assert.deepEqual(cifrasDeTexto(texto), [], `la respuesta "${id}" nombra una medida: «${texto}»`);
    }
    // Y la preseleccionada es una sola, la que la maqueta dibuja marcada.
    const marcadas = RESPUESTAS_DE_TRAMO.filter((r) => r.preseleccionada);
    assert.equal(marcadas.length, 1);
  });
});

// ── El punto de partida y el permiso ───────────────────────────────────────────

describe('El punto de partida y el permiso', () => {
  test('La app no pide el permiso de ubicación permanente', () => {
    // La mitad que se lee: la pantalla dice qué se pide y qué no, antes de pedirlo.
    assert.match(textoDelGuion('el-permiso', 'alcance'), /mientras usas la app/);
    assert.match(textoDelGuion('el-permiso', 'alcance-nota'), /Nunca en segundo plano/);
    assert.match(textoDelGuion('el-permiso', 'razon'), /[Nn]unca.*guardamos/s);
    assert.match(textoDelGuion('el-permiso', 'razon'), /tampoco la compartimos/);

    // Y la mitad que se comprueba: ni el manifiesto de la app ni ninguno de sus
    // módulos nombra el permiso de segundo plano. Es lo que impide que la promesa de
    // la pantalla y lo que la app solicita se separen sin que nadie lo note.
    const permanentes = [
      /ACCESS_BACKGROUND_LOCATION/,
      /NSLocationAlwaysAndWhenInUseUsageDescription/,
      /NSLocationAlwaysUsageDescription/,
      /\bAlways\b/,
      /backgroundLocation/,
      /UIBackgroundModes/,
    ];
    const aRevisar = ['app/app.json', 'app/plataforma/ubicacion.js', 'app/pantallas/arranque.jsx', 'app/pantallas/arranque-montado.jsx'];
    for (const fichero of aRevisar) {
      const texto = fuente(fichero);
      for (const patron of permanentes) {
        assert.equal(patron.test(texto), false, `${fichero} nombra un permiso de ubicación permanente (${patron})`);
      }
    }
  });

  test('Conceder el permiso pasa a A1P4 con la marca en la posición actual', async () => {
    const ubicacion = ubicacionQueConcede();
    const arranque = montaArranque({ ubicacion });
    arranque.eligeOficio('taberna');
    arranque.respondeTramo('otro-barrio');

    const vista = await arranque.pideElPermiso();
    assert.equal(vista.paso, 'donde-se-levanta');
    assert.equal(ubicacion.peticiones(), 1, 'el permiso no se ha pedido exactamente una vez');
    assert.deepEqual({ ...arranque.marca() }, { ...POSICION_CONCEDIDA });
    assert.equal(arranque.vista().precubierto.origenDelPunto, 'permiso');
  });

  test('Elegir el punto a mano pasa a A1P4 sin pedir ningún permiso', () => {
    const ubicacion = ubicacionQueConcede();
    const arranque = montaArranque({ ubicacion });
    arranque.respondeTramo('otro-barrio');

    const vista = arranque.eligeAMano();
    assert.equal(vista.paso, 'donde-se-levanta');
    // La ausencia se afirma sobre el recuento del doble, no suponiéndola: es la única
    // manera de distinguir «no se pidió» de «se pidió y salió bien».
    assert.equal(ubicacion.peticiones(), 0, 'la vía manual ha pedido el permiso del sistema');
    assert.deepEqual({ ...arranque.marca() }, { ...PUNTO_POR_DEFECTO });
    assert.equal(arranque.vista().precubierto.origenDelPunto, 'a-mano');
    assert.deepEqual([...ORIGENES_DEL_PUNTO], ['permiso', 'a-mano']);
  });

  test('Denegar el permiso continúa por la vía de elegir el punto a mano', async () => {
    const ubicacion = ubicacionQueDeniega();
    const arranque = montaArranque({ ubicacion });
    arranque.respondeTramo('otro-barrio');

    const vista = await arranque.pideElPermiso();
    assert.equal(ubicacion.peticiones(), 1);
    // Sin pantalla intermedia y sin quedarse en A1P3: una pantalla de rescate
    // convertiría denegar en un problema que hay que resolver, y aquí no lo es.
    assert.equal(vista.paso, 'donde-se-levanta');
    assert.equal(vista.precubierto.origenDelPunto, 'a-mano');
    assert.deepEqual({ ...arranque.marca() }, { ...PUNTO_POR_DEFECTO });
    // Y ninguna pantalla se queda sin salida: desde aquí se llega hasta el final.
    arranque.eligeOficio('botica');
    arranque.confirmaElPunto();
    assert.deepEqual([...sinContestar(arranque.estado())], []);
  });

  test('Con el permiso denegado se vuelve a A1P3 y se puede volver a intentar', async () => {
    const ubicacion = ubicacionQueDeniega();
    const arranque = montaArranque({ ubicacion });
    arranque.respondeTramo('otro-barrio');
    await arranque.pideElPermiso();

    const vuelta = arranque.atras();
    assert.equal(vuelta.paso, 'el-permiso');
    await arranque.pideElPermiso();
    assert.equal(ubicacion.peticiones(), 2, 'no se ha podido volver a intentar');
  });

  test('No poder preguntar no es haber denegado, y se distingue', async () => {
    const arranque = montaArranque({ ubicacion: ubicacionQueLanza() });
    arranque.eligeOficio('taberna');
    arranque.avanza();
    arranque.respondeTramo('otro-barrio');
    assert.equal(arranque.avanza().paso, 'el-permiso');
    // Lo que lanza sube: la pantalla lo dice y deja la vía manual, en vez de
    // convertir una avería en una decisión de quien juega.
    await assert.rejects(() => arranque.pideElPermiso(), /no se pudo abrir/);
    assert.equal(arranque.vista().paso, 'el-permiso');
    assert.equal(arranque.vista().precubierto.origenDelPunto, null);

    const vista = arranque.eligeAMano();
    assert.equal(vista.paso, 'donde-se-levanta');
    assert.equal(vista.precubierto.origenDelPunto, 'a-mano');
  });

  test('La partida guardada lleva el anclaje redondeado y ninguna posición exacta', async () => {
    const exacta = { lat: 42.40371, lon: -8.81139 };
    const { arranque, cerrado } = await recorreEntero({ arrastra: exacta });

    assert.deepEqual({ ...cerrado.anclaje }, anclaje(exacta.lat, exacta.lon));
    assert.equal(cerrado.mapaId, idDeMapa(anclaje(exacta.lat, exacta.lon)));

    // Y lo que se escribe: ni la posición que devolvió el proveedor, ni la posición
    // donde se soltó la marca, ni ninguna marca de tiempo. Se afirma sobre el texto
    // canónico entero, que es lo que va al almacén.
    const texto = arranque.texto();
    for (const numero of [exacta.lat, exacta.lon, POSICION_CONCEDIDA.lat, POSICION_CONCEDIDA.lon]) {
      assert.equal(texto.includes(String(numero)), false, `el documento del arranque lleva la posición exacta ${numero}`);
    }
    assert.equal(/"(hora|fecha|instante|timestamp|t)"\s*:/.test(texto), false, `el documento del arranque lleva una marca de tiempo: ${texto}`);
    assert.match(texto, /"anclaje":\{"lat":42\.4,"lon":-8\.81\}/);
    // Y la clave con la que vive es una sola: no hay dos arranques a la vez.
    assert.equal(CLAVE_DEL_ARRANQUE, 'arranque/en-curso');
  });

  test('Las coordenadas salen una sola vez, al generar el mapa', async () => {
    // El escenario de la batería, en la mitad que es de esta fila: el arranque toca la
    // posición de quien juega —la pide, la arrastra, la ancla— y **no saca nada**. La
    // otra mitad, que levantar el mapa consulta una sola vez, la afirma SPEC-026.
    //
    // Se afirma sobre el registro de un inspector en modo estricto y no leyendo el
    // código: una salida a red que no pase por él se corta nombrando el destino, así
    // que aquí una ausencia es una ausencia y no una suposición.
    const { creaInspectorDeRed } = await import('../dobles/inspector-red.mjs');
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const exacta = { lat: 42.40371, lon: -8.81139 };
      const { arranque } = await recorreEntero({ arrastra: exacta });
      assert.deepEqual(inspector.peticiones(), [], 'el arranque ha sacado algo a la red');
      for (const dato of [String(exacta.lat), String(exacta.lon), String(POSICION_CONCEDIDA.lat), 'Xoana']) {
        assert.equal(inspector.contiene(dato), false, `"${dato}" ha salido del móvil durante el arranque`);
      }
      assert.equal(arranque.vista().cerrado, true);
    } finally {
      inspector.suelta();
    }
  });

  test('El documento del arranque no admite ningún campo que nadie haya declarado', () => {
    const arranque = montaArranque();
    const doc = { ...congelaOnboarding(arranque.estado()), posicionExacta: { lat: 42.40371, lon: -8.81139 } };
    // El esquema es cerrado por los dos lados: una posición exacta de polizón hace
    // fallar la escritura nombrándola, en vez de viajar hasta el disco.
    assert.throws(() => levantaOnboarding(doc), /posicionExacta/);
  });
});

// ── Dónde se levanta el mapa ───────────────────────────────────────────────────

describe('Dónde se levanta el mapa', () => {
  test('El círculo de alcance sale del tramo y de nada más', () => {
    const radios = new Map();
    for (const id of IDS_DE_RESPUESTA) {
      const arranque = montaArranque();
      arranque.eligeAMano();
      arranque.respondeTramo(id);
      radios.set(id, arranque.radioDeAlcanceM());
    }
    // Dos tramos distintos dan dos círculos distintos, y el orden es el del catálogo.
    const valores = [...radios.values()];
    assert.equal(new Set(valores).size, valores.length, `dos respuestas de tramo dan el mismo círculo: ${JSON.stringify([...radios])}`);
    for (let i = 1; i < valores.length; i++) assert.ok(valores[i] > valores[i - 1], 'el círculo no crece con el tramo');

    // Y de nada más: arrastrar la marca sin cambiar el tramo no lo mueve.
    const arranque = montaArranque();
    arranque.eligeAMano();
    arranque.respondeTramo('otro-barrio');
    const antes = arranque.radioDeAlcanceM();
    arranque.mueveLaMarca(42.60, -8.60);
    assert.equal(arranque.radioDeAlcanceM(), antes, 'arrastrar la marca ha cambiado el alcance');
  });

  test('Sin tramo declarado el círculo falla nombrando las cuatro respuestas', () => {
    const arranque = montaArranque();
    arranque.eligeAMano();
    assert.throws(() => arranque.radioDeAlcanceM(), new RegExp(IDS_DE_RESPUESTA.join(', ')));
  });

  test('Un tramo en el suelo dibuja el círculo igual y la pantalla no menciona el suelo', () => {
    const arranque = montaArranque();
    arranque.eligeAMano();
    arranque.respondeTramo(IDS_DE_RESPUESTA[0]);
    const radio = arranque.radioDeAlcanceM();
    assert.ok(radio > 0, 'el tramo más corto no dibuja círculo');
    assert.ok(tramoDeRespuesta(IDS_DE_RESPUESTA[0]) >= SUELO_TRAMO_M, 'la respuesta más corta baja del suelo');

    // Y ni el suelo ni ninguna limitación aparecen en A1P4.
    for (const pieza of guionDePaso('donde-se-levanta')) {
      if (typeof pieza.texto !== 'string') continue;
      assert.equal(/suelo|mínimo|limitaci|no llegas/i.test(pieza.texto), false, `donde-se-levanta/${pieza.id} menciona el suelo: «${pieza.texto}»`);
    }
  });

  test('El mapa se ancla a la coordenada redondeada de donde se soltó la marca', () => {
    const dentroDeLaMisma = [{ lat: 42.4037, lon: -8.8113 }, { lat: 42.4012, lon: -8.8149 }];
    const anclajes = dentroDeLaMisma.map((punto) => {
      const arranque = montaArranque();
      arranque.eligeOficio('taberna');
      arranque.respondeTramo('otro-barrio');
      arranque.eligeAMano();
      arranque.mueveLaMarca(punto.lat, punto.lon);
      arranque.confirmaElPunto();
      return { anclaje: arranque.estado().anclaje, mapaId: arranque.mapaId() };
    });
    // Dos posiciones distintas dentro de la misma celda dan el mismo mapa: es lo que
    // hace que la posición exacta no haga falta para nada.
    assert.deepEqual(anclajes[0], anclajes[1], 'dos puntos de la misma celda levantan mapas distintos');
    assert.deepEqual(anclajes[0].anclaje, anclaje(dentroDeLaMisma[0].lat, dentroDeLaMisma[0].lon));
    assert.notDeepEqual(anclajes[0].anclaje, { lat: dentroDeLaMisma[0].lat, lon: dentroDeLaMisma[0].lon });
  });

  test('Confirmar sin marca falla en vez de suponer un punto', () => {
    const arranque = montaArranque();
    arranque.respondeTramo('otro-barrio');
    assert.throws(() => arranque.confirmaElPunto(), /no hay marca que confirmar[\s\S]*nunca se supone/);
    assert.throws(() => arranque.mueveLaMarca('42.4', null), /coordenada válida/);
  });

  test('A1P4 dice que desde ahí ya no se vuelve, y es la única pantalla que lo dice', () => {
    const irreversible = textoDelGuion('donde-se-levanta', 'irreversible');
    assert.match(irreversible, /no se deshace/);
    // Y no es un diálogo de confirmación: se dice **antes** de pulsar. Lo que se
    // comprueba es que en el guion no hay ninguna pieza de «¿estás seguro?».
    for (const pieza of textosDelArranque()) {
      assert.equal(/¿estás segur|¿seguro|confirmar acción/i.test(pieza.texto), false, `${pieza.paso}/${pieza.id} pide una confirmación`);
    }
    const loDicen = textosDelArranque().filter((p) => /no se deshace|ya no se vuelve|no se puede volver/i.test(p.texto));
    assert.deepEqual(loDicen.map((p) => `${p.paso}/${p.id}`), ['donde-se-levanta/irreversible']);
  });

  test('No existe ninguna acción de regenerar ni de mover el mapa', () => {
    // Lo generado no se resiembra jamás, y la manera de afirmarlo sin dispositivo es
    // que la máquina no tenga por dónde: ni un método, ni un identificador.
    const arranque = montaArranque();
    for (const nombre of ['regenera', 'resiembra', 'mueveElMapa', 'vuelveAGenerar', 'cambiaElAnclaje']) {
      assert.equal(nombre in arranque, false, `el arranque expone "${nombre}"`);
    }
    for (const fichero of ['app/pantallas/arranque.jsx', 'packages/nucleo/partida/onboarding.js']) {
      assert.equal(/regenerar|volver a generar|resembrar/i.test(fuente(fichero)), false, `${fichero} ofrece regenerar el mapa`);
    }
  });
});

// ── La generación, y volver a abrir a mitad ────────────────────────────────────

describe('La generación, y volver a abrir a mitad', () => {
  test('A1P5 enseña las seis fases del levantamiento y no las reescribe', async () => {
    const fases = await import('../../app/mapa/fases.js');
    const pieza = guionDePaso('la-generacion').find((p) => p.id === 'fases');
    assert.equal(pieza.texto, null, 'el guion se ha escrito las fases por su cuenta en vez de consumir las del levantamiento');
    assert.match(pieza.de, /fases del levantamiento/);
    assert.equal(fases.FASES.length, 6);
    assert.deepEqual(fases.FASES.map((f) => f.texto), [
      'Mirando qué hay por ahí',
      'Separando la tierra del agua',
      'Repartiendo la gente',
      'Trazando las calzadas',
      'Buscando los sitios con historia',
      'Poniéndole nombre a todo',
    ]);
  });

  test('A1P5 no lleva barra de progreso, porcentaje, contador ni estimación de segundos', () => {
    for (const pieza of guionDePaso('la-generacion')) {
      if (typeof pieza.texto !== 'string') continue;
      assert.deepEqual(cifrasDeTexto(pieza.texto, { salvo: pieza.salvo ?? [] }), [], `la-generacion/${pieza.id} lleva una cifra`);
      assert.equal(/%|por ciento|progreso|quedan|segundos/i.test(pieza.texto), false, `la-generacion/${pieza.id} habla de progreso: «${pieza.texto}»`);
    }
    // Y la pantalla tampoco: ni un porcentaje ni una barra en el componente.
    // Se busca lo que pintaría progreso y no la palabra: el comentario de cabecera
    // del componente declara justamente esa ausencia, y prohibir la palabra obligaría
    // a borrar la declaración.
    const pantalla = fuente('app/pantallas/arranque.jsx');
    for (const patron of [/ProgressBar/, /ActivityIndicator/, /%/, /setInterval/, /segundos restantes/i]) {
      assert.equal(patron.test(pantalla), false, `la pantalla del arranque pinta progreso (${patron})`);
    }
  });

  test('La última línea de A1P5 anuncia el prólogo sin explicar qué es', () => {
    const prologo = textoDelGuion('la-generacion', 'prologo');
    assert.match(prologo, /ahí fuera ya pasan cosas que nadie te ha contado/);
    assert.equal(/prólogo|rumor|mecánica|se genera/i.test(prologo), false, `la línea del prólogo lo explica: «${prologo}»`);
  });

  test('Terminada la generación se pasa a A1P6 sin pulsar nada', () => {
    const arranque = montaArranque();
    arranque.eligeOficio('taberna');
    arranque.respondeTramo('otro-barrio');
    arranque.eligeAMano();
    assert.equal(arranque.confirmaElPunto().paso, 'la-generacion');
    // Lo dispara el mapa pintado y no un botón: A1P5 no tiene ninguna acción.
    const vista = arranque.mapaPintado();
    assert.equal(vista.paso, 'tu-mapa');
    assert.equal(vista.atras, false, 'A1P6 ha aparecido con flecha de atrás');
    assert.equal(guionDePaso('la-generacion').some((p) => /seguir|generar|continuar/.test(p.id)), false, 'A1P5 declara una acción');
  });

  test('Reabrir tras cerrarse durante la generación vuelve a A1P4 con todo contestado', async () => {
    const arranque = montaArranque();
    arranque.escribeNombre('Xoana');
    arranque.eligeOficio('mercado');
    arranque.respondeTramo('pueblo-de-al-lado');
    arranque.eligeAMano();
    arranque.mueveLaMarca(42.4037, -8.8113);
    arranque.confirmaElPunto();
    assert.equal(arranque.vista().paso, 'la-generacion');

    // Se cierra la app: lo único que sobrevive es el documento guardado.
    const doc = JSON.parse(arranque.texto());
    const otro = montaArranque({ entropia: ENTROPIA_B });
    const vista = otro.reanuda(doc);

    assert.equal(vista.paso, 'donde-se-levanta', 'reanudar no vuelve al paso anterior');
    assert.equal(pasoAlReanudar('la-generacion'), 'donde-se-levanta');
    // No se repite ninguna pregunta ya contestada.
    assert.deepEqual([...vista.sinContestar], []);
    assert.deepEqual({ ...vista.precubierto }, {
      nombre: 'Xoana',
      genero: 'femenino',
      oficio: 'mercado',
      respuestaDeTramo: 'pueblo-de-al-lado',
      origenDelPunto: 'a-mano',
      anclaje: { lat: 42.4, lon: -8.81 },
    });
    // Y la marca vuelve al anclaje, que es lo único que se guardó.
    assert.deepEqual({ ...otro.marca() }, { lat: 42.4, lon: -8.81 });
    // La semilla es la de la partida interrumpida y no una nueva: reanudar no
    // resiembra, aunque el montaje traiga otra entropía.
    assert.equal(otro.semilla(), doc.semilla);
  });

  test('Los dos últimos pasos tampoco se reanudan en su sitio', () => {
    for (const paso of ['la-generacion', 'tu-mapa', 'la-primera-aventura']) {
      assert.equal(pasoAlReanudar(paso), 'donde-se-levanta', `${paso} se reanuda donde estaba y el mapa puede no existir`);
    }
    for (const paso of PASOS.slice(0, 4)) assert.equal(pasoAlReanudar(paso), paso);
  });

  test('La generación que no se puede completar deja el arranque en A1P4 con todo contestado', () => {
    const arranque = montaArranque();
    arranque.eligeOficio('forja');
    arranque.respondeTramo('otro-barrio');
    arranque.eligeAMano();
    arranque.confirmaElPunto();

    const vista = arranque.noSePudoLevantar();
    assert.equal(vista.paso, 'donde-se-levanta');
    assert.deepEqual([...vista.sinContestar], [], 'volver del fallo ha perdido alguna respuesta');
    // Y lo que se lee no nombra la red ni ningún código.
    const texto = textoDelGuion('donde-se-levanta', 'no-se-pudo');
    assert.match(texto, /Vuelve a intentarlo/);
    assert.equal(/red|conexión|servidor|código|error \d|Overpass/i.test(texto), false, `«${texto}» nombra la avería`);
  });

  test('Una celda que no da para un mundo jugable se dice y se ofrece mover la marca', () => {
    const texto = textoDelGuion('donde-se-levanta', 'celda-no-jugable');
    assert.match(texto, /Mueve la marca/);
    assert.equal(/red|conexión|servidor|vacío/i.test(texto), false, `«${texto}» nombra la avería`);
    // Se resuelve dentro de A1P4 y no entregando un mapa que parece un mapa.
    assert.equal(guionDePaso('donde-se-levanta').some((p) => p.id === 'celda-no-jugable'), true);
  });
});

// ── Lo que el arranque deja puesto ─────────────────────────────────────────────

describe('Lo que el arranque deja puesto', () => {
  test('No se pregunta la edad', () => {
    // Las dos mitades del escenario. La lista de campos es cerrada y no tiene dónde
    // meter una edad; y ningún texto de las siete pantallas la pregunta.
    assert.deepEqual([...CAMPOS_DEL_ARRANQUE], ['nombre', 'genero', 'oficio', 'respuestaDeTramo', 'origenDelPunto', 'anclaje']);
    for (const prohibida of PREGUNTAS_QUE_EL_ARRANQUE_NO_HACE) {
      for (const pieza of textosDelArranque()) {
        assert.equal(pieza.texto.toLowerCase().includes(prohibida), false, `${pieza.paso}/${pieza.id} pregunta por «${prohibida}»`);
      }
    }
    assert.ok(PREGUNTAS_QUE_EL_ARRANQUE_NO_HACE.includes('edad'));
    // Y lo que recoge cada paso cuadra con la lista, sin campos sueltos por el medio.
    const recogidos = PASOS.flatMap((paso) => CAMPOS_POR_PASO[paso]);
    assert.deepEqual(recogidos, [...CAMPOS_DEL_ARRANQUE], 'los pasos recogen campos que no están en la lista cerrada');
    for (const paso of PASOS.slice(4)) assert.deepEqual([...CAMPOS_POR_PASO[paso]], [], `${paso} recoge algo y solo debería enseñar`);
  });

  test('El horario diurno viene encendido', async () => {
    assert.equal(AJUSTES_DE_ORIGEN.soloDeDia, true, '«solo de día» no viene encendido de origen');
    const { cerrado } = await recorreEntero();
    assert.equal(cerrado.ajustes.soloDeDia, true, 'la partida no nace con «solo de día» encendido');
    // Y se puede desactivar: de origen no significa fijo.
    const ajustes = estadoDeAjustes();
    cambiaAjuste(ajustes, 'soloDeDia', false);
    assert.equal(ajustes.soloDeDia, false);
  });

  test('Los pasos de fondo vienen apagados', async () => {
    assert.equal(AJUSTES_DE_ORIGEN.pasosDelDiaADia, false, 'contar los pasos del día a día viene encendido');
    const { cerrado } = await recorreEntero();
    assert.equal(cerrado.ajustes.pasosDelDiaADia, false);
    // El juego es completo sin activarlo: nada del arranque lo pide ni lo menciona.
    for (const pieza of textosDelArranque()) {
      assert.equal(/salud|podómetro|contar los pasos|segundo plano.*pasos/i.test(pieza.texto), false, `${pieza.paso}/${pieza.id} pide los pasos del día a día`);
    }
    assert.deepEqual([...IDS_DE_AJUSTE], ['soloDeDia', 'pasosDelDiaADia']);
  });

  test('El arranque deja los ajustes puestos sin enseñarlos ni preguntarlos', () => {
    // «Sin preguntar nada» es la mitad de la decisión: enseñarlos en el arranque sería
    // preguntar por la puerta de atrás, y por eso ninguna pantalla los nombra.
    for (const id of IDS_DE_AJUSTE) {
      for (const pieza of textosDelArranque()) {
        assert.equal(pieza.texto.includes(id), false, `${pieza.paso}/${pieza.id} enseña el ajuste "${id}"`);
      }
    }
    assert.equal(/solo de día|de noche/i.test(textosDelArranque().map((p) => p.texto).join(' ')), false, 'el arranque enseña el horario diurno');
  });

  test('La ficha de la tienda declara el suelo con el número que declara el núcleo', () => {
    const ficha = fichaDeLaTienda();
    assert.equal(ficha.destino, DESTINO);
    assert.equal(ficha.destino, DECLARACION_DEL_SUELO.destino);
    assert.equal(ficha.suelo, SUELO_TRAMO_M);
    // El párrafo es el del núcleo, tal cual: no se reescribe ni se parafrasea, para
    // que cambiar el suelo en un sitio lo cambie en el único sitio donde se enseña.
    assert.ok(ficha.parrafos.includes(DECLARACION_DEL_SUELO.texto), 'la ficha no incluye la declaración del suelo');
    assert.match(ficha.declaracionDelSuelo, new RegExp(String(SUELO_TRAMO_M)));
    assert.equal(compruebaFicha(ficha), ficha);
    // Y una ficha que no la incluyera falla nombrando por qué existe el artefacto.
    assert.throws(() => compruebaFicha({ ...ficha, parrafos: ficha.parrafos.slice(0, 2) }), /no incluye la declaración del suelo/);
  });

  test('El suelo se dice antes de instalar y no aparece dentro del arranque', () => {
    const frases = DECLARACION_DEL_SUELO.texto.split('. ').map((f) => f.trim()).filter((f) => f.length > 20);
    assert.ok(frases.length >= 2);
    for (const pieza of textosDelArranque()) {
      for (const frase of frases) {
        assert.equal(pieza.texto.toLowerCase().includes(frase.toLowerCase()), false, `${pieza.paso}/${pieza.id} dice el suelo dentro del juego`);
      }
      assert.equal(new RegExp(`\\b${SUELO_TRAMO_M}\\b`).test(pieza.texto), false, `${pieza.paso}/${pieza.id} dice el número del suelo`);
    }
  });

  test('A1P7 dice que se puede salir a andar sin coger ninguna aventura', () => {
    const texto = textoDelGuion('la-primera-aventura', 'andar-sin-nada');
    assert.match(texto, /sin coger ninguna/);
    assert.match(textoDelGuion('la-primera-aventura', 'regla-del-reloj'), /Lo que cuenta es lo que andas, no el reloj/);
    // Y las tarjetas no las escribe el guion: salen del reparto casteado.
    const tarjetas = guionDePaso('la-primera-aventura').find((p) => p.id === 'tarjetas');
    assert.equal(tarjetas.texto, null);
    assert.match(tarjetas.de, /aventuras casteadas del reparto/);
  });
});

// ── Nada degrada por falta de cableado ─────────────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  test('El arranque sin proveedor de ubicación falla nombrando la pieza que falta', () => {
    assert.deepEqual([...PIEZAS_DEL_ARRANQUE], ['ubicacion', 'entropia', 'locale', 'puntoPorDefecto']);
    const completo = { ubicacion: ubicacionQueConcede(), entropia: ENTROPIA_A, locale: LOCALE, puntoPorDefecto: PUNTO_POR_DEFECTO };
    // Un arranque sin proveedor **no** cae en silencio a la vía de elegir el punto a
    // mano: eso sería la pieza que, al no estar, no protesta.
    assert.throws(() => creaArranque({ ...completo, ubicacion: null }), /sin ubicacion[\s\S]*caída silenciosa/);
    assert.throws(() => creaArranque({ ...completo, ubicacion: {} }), /sin ubicacion/);
  });

  test('El arranque sin origen de entropía falla en vez de fabricar la semilla con el reloj', () => {
    const completo = { ubicacion: ubicacionQueConcede(), entropia: ENTROPIA_A, locale: LOCALE, puntoPorDefecto: PUNTO_POR_DEFECTO };
    assert.throws(() => creaArranque({ ...completo, entropia: null }), /sin entropia[\s\S]*reloj/);
    assert.throws(() => creaArranque({ ...completo, puntoPorDefecto: null }), /sin puntoPorDefecto/);
    assert.throws(() => creaArranque({ ...completo, puntoPorDefecto: { lat: 42.4 } }), /sin puntoPorDefecto/);
  });

  test('El arranque sin paquete de idioma resuelto falla nombrando el paquete', () => {
    const completo = { ubicacion: ubicacionQueConcede(), entropia: ENTROPIA_A, locale: LOCALE, puntoPorDefecto: PUNTO_POR_DEFECTO };
    assert.throws(() => creaArranque({ ...completo, locale: '' }), /sin locale/);
    // Un idioma sin paquete falla **al construir** y no al pedir sugerencias: tiene
    // que romperse antes de que nadie vea una pantalla, y nunca entregar una lista
    // vacía ni resolverse en silencio con el paquete de otro idioma.
    assert.throws(() => creaArranque({ ...completo, locale: 'pt' }), /"pt" no tiene paquete de nombres declarado[\s\S]*es, gl/);
  });

  test('El levantamiento recibe el tramo declarado y la coordenada redondeada, y no un radio por defecto', async () => {
    const { cerrado } = await recorreEntero({ respuesta: 'pueblo-de-al-lado', arrastra: { lat: 42.4037, lon: -8.8113 } });
    assert.equal(cerrado.tramoM, tramoDeRespuesta('pueblo-de-al-lado'), 'lo que se entrega no es el tramo declarado');
    assert.deepEqual({ ...cerrado.anclaje }, anclaje(42.4037, -8.8113));
    assert.equal(cerrado.mapaId, idDeMapa(cerrado.anclaje));
    // Y la pantalla se lo pasa tal cual al mapa: el tramo del personaje, no una
    // constante suya. Se lee en la fuente porque el componente no corre en Node.
    assert.match(fuente('app/pantallas/arranque.jsx'), /tramoM=\{arranque\.estado\(\)\.personaje\.tramo\.declaradoM\}/);
    assert.match(fuente('app/pantallas/arranque-montado.jsx'), /tramoM: personaje\.tramo\.declaradoM/);
  });
});

// ── Determinismo ───────────────────────────────────────────────────────────────

describe('El arranque es determinista', () => {
  test('Dos recorridos con la misma semilla y las mismas respuestas dan lo mismo', async () => {
    const uno = await recorreEntero({ arrastra: { lat: 42.4037, lon: -8.8113 } });
    const otro = await recorreEntero({ arrastra: { lat: 42.4037, lon: -8.8113 } });
    assert.equal(serializado(uno.cerrado), serializado(otro.cerrado), 'dos recorridos iguales entregan cosas distintas');
    assert.equal(uno.arranque.texto(), otro.arranque.texto(), 'el documento del arranque no es idéntico');

    // Y con otra entropía, otra partida: si no, la semilla no estaría haciendo nada.
    const tercero = await recorreEntero({ entropia: ENTROPIA_B, arrastra: { lat: 42.4037, lon: -8.8113 } });
    assert.notEqual(tercero.cerrado.semilla, uno.cerrado.semilla);
  });

  test('No se usa ninguna fuente de azar ni de tiempo del sistema', () => {
    for (const modulo of MODULOS_DE_LA_FILA) {
      const texto = fuente(modulo);
      // Se busca la llamada y no la palabra: los comentarios de estos módulos
      // explican precisamente por qué no las usan, y prohibir la palabra obligaría a
      // borrar la explicación.
      assert.equal(/Math\.random\s*\(/.test(texto), false, `${modulo} usa Math.random`);
      assert.equal(/Date\.now\s*\(/.test(texto), false, `${modulo} usa Date.now`);
      assert.equal(/new Date\s*\(/.test(texto), false, `${modulo} usa el reloj del sistema`);
      assert.equal(/crypto\.getRandomValues/.test(texto), false, `${modulo} saca azar por su cuenta en vez de recibirlo`);
    }
    // Y el paquete entero sigue sin azar de sistema, que es la red de seguridad de
    // verdad: un módulo nuevo de esta fila que se saltara la lista de arriba caería
    // aquí igual.
    for (const modulo of modulosDelPaquete()) {
      assert.equal(/Math\.random\s*\(/.test(fuente(modulo)), false, `${modulo} usa Math.random`);
    }
  });
});

// ── Lo que esta entrega no trae, y lo dice ─────────────────────────────────────

describe('Lo que esta entrega no trae, y lo dice en vez de fingirlo', () => {
  test('No hay módulo nativo de ubicación: «Permitir» sale apagado con su motivo y la vía manual queda entera', async () => {
    const { proveedorSinMontar, creaProveedorDeUbicacion } = await import('../../app/plataforma/ubicacion.js');
    const proveedor = proveedorSinMontar();
    assert.equal(proveedor.montado, false, 'el proveedor sin montar dice estar montado');
    assert.match(proveedor.motivo, /ninguna spec ha nombrado la dependencia/);
    // Lo que **no** hace es responder «denegado»: eso convertiría una pieza sin
    // cablear en una decisión de quien juega, y la vía manual dejaría de ser una
    // elección para pasar a ser una caída silenciosa.
    await assert.rejects(() => proveedor.pide(), /no se puede pedir el permiso[\s\S]*vía de elegir el punto a mano sigue abierta/);

    // El arranque se construye igual con él —la pieza está, aunque no esté cableada—
    // y la vía manual llega hasta el final.
    const arranque = montaArranque({ ubicacion: proveedor });
    arranque.eligeOficio('taberna');
    arranque.respondeTramo('otro-barrio');
    arranque.eligeAMano();
    arranque.mueveLaMarca(42.4037, -8.8113);
    arranque.confirmaElPunto();
    assert.deepEqual([...sinContestar(arranque.estado())], []);
    assert.equal(arranque.cierra().origenDelPunto, 'a-mano');

    // Y la pantalla lo enseña apagado con el motivo al lado, en vez de un botón que
    // no responde y no explica nada.
    const pantalla = fuente('app/pantallas/arranque.jsx');
    assert.match(pantalla, /const sinMontar = proveedor \? proveedor\.montado === false : false;/);
    assert.match(pantalla, /apagada=\{sinMontar\}/);
    assert.match(pantalla, /motivo=\{sinMontar \? proveedor\.motivo : null\}/);
    // El montaje real monta ese y no uno que deniegue.
    assert.match(fuente('app/pantallas/arranque-montado.jsx'), /ubicacion \?\? proveedorSinMontar\(\)/);
    // Y el contrato del módulo nativo existe entero, para el día que la dependencia
    // se nombre: lo que falta es el módulo, no la frontera.
    assert.equal(typeof creaProveedorDeUbicacion, 'function');
    assert.throws(() => creaProveedorDeUbicacion({}), /pidePermiso\(\) y leePosicion\(\)/);
  });

  test('No hay capa de teselas para A1P4: la superficie declara «sin-mapa-real» en vez de fingir un mapa', () => {
    const mapaReal = fuente('app/pantallas/mapa-real.jsx');
    assert.match(mapaReal, /export const SIN_MAPA_REAL = 'sin-mapa-real: falta la capa de teselas, que ninguna spec ha nombrado todavía';/);
    // La superficie mantiene el identificador que la spec declara —para que el día
    // que exista la capa el flujo de dispositivo no cambie— y dice en voz alta que
    // las calles no están.
    assert.match(mapaReal, /testID="punto-mapa-real"/);
    assert.match(mapaReal, /accessibilityLabel=\{SIN_MAPA_REAL\}/);
    // Lo que sí es de esta entrega y se puede ejercitar: la marca y el círculo se
    // pintan encima y son de `arranque.jsx`, y por eso arrastrar y el radio del
    // círculo se afirman sin ninguna librería.
    const pantalla = fuente('app/pantallas/arranque.jsx');
    assert.match(pantalla, /testID="punto-pin"/);
    assert.match(pantalla, /testID="punto-circulo"/);
    assert.match(pantalla, /MapaReal = MapaRealSinMontar/);
    // Y no se hace pasar por un mapa: la superficie no dibuja calles ni pinta ningún
    // nombre de sitio real.
    for (const patron of [/react-native-maps/, /MapView/, /mapbox/i, /leaflet/i, /https?:\/\//]) {
      assert.equal(patron.test(mapaReal), false, `la superficie finge tener mapa (${patron})`);
    }
  });
});
