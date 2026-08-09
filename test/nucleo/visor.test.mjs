// SPEC-033 · El visor del anclaje y la ficha de texto: **tres presentaciones y una sola
// regla que elige entre ellas**, las dos cartelas, el recorrido del tirador y el
// vocabulario que ningún texto de esta capa puede decir.
//
// Lo que hace probable esta fila sin dispositivo es la raya que la spec traza: la
// elección de presentación, la composición de las cartelas y la de la ficha son funciones
// puras del paquete, y lo que vive en `app/` es el gesto, el pintado y el ciclo de vida de
// la capa. Por eso aquí está casi todo y en `test/app/visor.yaml` está solo el arrastre.
//
// Cinco decisiones de este fichero que no son de estilo:
//
// - **El orden `pregunta → anota` se afirma por sus dos lados.** Que `alLlegar` resuelva
//   contra el registro anterior es la mitad fácil; la que vale es la otra, y por eso hay
//   un caso que anota antes a mano y comprueba que **entonces la primera visita sale como
//   segunda**. Sin él, el criterio no se podría poner rojo y sería un comentario.
// - **Los recuentos van sobre los ocho mundos de referencia y no sobre un caso
//   construido** (§6o): los 144 sitios de los ocho extractos, cada uno en una de las tres
//   presentaciones, con el reparto exacto. Un mundo inventado a medida donde salen las
//   tres no demuestra que salgan en el juego.
// - **El vocabulario prohibido se comprueba sobre todos los textos, no sobre una
//   muestra**, y además palabra a palabra: las doce se detectan una a una y ninguna se
//   dispara por subcadena, que es lo que obligaría a reescribir textos legítimos.
// - **El caso sin foto se compara contra el caso con foto**, no consigo mismo. La cartela
//   real tiene que salir idéntica: si se pierde la foto y no el momento, la única
//   diferencia posible está en `real.foto` y en `real.fondoLiso`.
// - **Los ocho extractos no traen un solo `place_id`**, así que sobre dato real la
//   presentación con foto no ocurre. Se afirma en voz alta en lugar de dejarlo como una
//   casualidad del recuento: el día que Places entre, ese cero se mueve y hay que verlo.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «El visor abre por
// la ficción la primera vez», «Arrastrar descubre el sitio real», «El visor es una capa y
// debajo está el beat», «Sin foto de Places, el visor abre igual», «La segunda vez el
// visor no se abre solo», «Llegar sin haber venido a nada da la ficha del sitio» y «El
// visor no aparece nunca andando». De los tres primeros y del cuarto, `docs/testing.md`
// los etiqueta `@app` porque los escribió pensando en el gesto: aquí se implementa la
// mitad que la spec bajó al paquete —qué lado abre, qué dice cada cartela, qué queda
// debajo— y en `test/app/visor.yaml` queda la que necesita dedo. Los dos últimos ya
// tienen media implementación en `test/nucleo/llegadas.test.mjs`, que afirma la
// **secuencia**; aquí se afirma la **presentación**, que es la otra mitad y la que esta
// fila entrega. Todo lo demás va marcado como hueco de la batería en
// `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ARTICULO_DE_ANCLAJE,
  DEL_CALLEJERO,
  ESCENAS,
  ESTADOS_DE_LLEGADA,
  ESTADO_A_UN_TOQUE,
  IDS_DE_LADO,
  IDS_DE_PRESENTACION,
  LADOS,
  LO_QUE_EL_APUNTE_NO_LLEVA,
  LO_QUE_EL_VISOR_NO_ANADE,
  LO_QUE_LA_FICHA_NO_OFRECE,
  PRESENTACIONES,
  PUNTO_DE_CRUCE,
  REMATES,
  REMATE_DE_REPUESTO,
  ROTULOS_DE_ROL,
  TEXTOS,
  TIRADOR,
  VOCABULARIO_PROHIBIDO,
  alSoltar,
  apunteDeLoMirado,
  cartelaDeFiccion,
  cartelaEnPosicion,
  cartelaReal,
  claveDeFotoDeSitio,
  claveDeIlustracionDeSitio,
  componeFicha,
  componeVisor,
  creaVisor,
  exigePosicionDeTirador,
  exigeSinVocabularioProhibido,
  infraccionesDeVocabulario,
  ladoEnPosicion,
  referenteReal,
  resuelvePresentacion,
  rotuloDeTipo,
  sitioDelMundo,
  sitiosDelMundo,
} from '../../packages/nucleo/partida/visor.js';
import {
  MODOS,
  TIPOS_DE_PASO,
  avanzaLaSecuencia,
  pasoVigente,
  secuenciaDeLlegada,
} from '../../packages/nucleo/partida/secuencia.js';
import {
  claveDeElemento,
  declaraFoto,
  declaraIlustracion,
  elementosIlustrables,
} from '../../packages/nucleo/partida/recursos.js';
import { PARAJE_INFO } from '../../packages/nucleo/world/parajes.js';
import { CATALOGO_ADMISION } from '../../packages/nucleo/world/anclajes.js';
import {
  MOTIVOS_DE_CIERRE,
  abreSalida,
  cierraLaSalida,
  estadoDeSalidas,
  marcaElTelonComoLeido,
} from '../../packages/nucleo/partida/salidas.js';
import {
  congelaEstado,
  estadoInicial,
  levantaEstado,
  pisaSitio,
} from '../../packages/nucleo/partida/estado.js';
import { fuenteDePosiciones, rotuloQueFunciona } from '../dobles/rotulo-del-sistema.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import {
  LAS_DOS_SEMILLAS,
  LOS_CUATRO,
  fuente,
  generaMundo,
  semillaDe,
} from './mundo-de-prueba.mjs';

// ── El decorado ────────────────────────────────────────────────────────────────

const VISOR = 'packages/nucleo/partida/visor.js';
const PANTALLA_VISOR = 'app/pantallas/visor.js';
const PANTALLA_FICHA = 'app/pantallas/ficha.js';
const PANTALLA_LLEGADA = 'app/pantallas/llegada.js';

const MONFRIDA = 'Monfrida';        // núcleo con anclaje real con nombre y con foto
const OUTEIRO = 'Outeiro';          // núcleo colocado por geometría: no hay nada real que descubrir
const TABERNA = 'A Taberna Pechada'; // servicio anclado a un local con nombre
const TORREON = 'O Torreón Esquecido'; // paraje con anclaje con nombre y con `place_id`
const FONTE = 'A Fonte Vella';      // paraje cuyo anclaje real no tiene nombre en OSM
const CRUCE = 'O Cruce das Ánimas'; // paraje del callejero, sin anclaje
const SEMILLA = SEMILLA_A;
const MAPA = 'casa';
const PARTIDA = { lat: 42.4012, lon: -8.8114 };

/**
 * Un mundo escrito a mano, y a propósito: lo que estos casos necesitan son las cuatro
 * combinaciones de anclaje que la regla distingue —con nombre, sin nombre, del callejero
 * y sin nada— y un `place_id`, que ninguno de los ocho extractos trae. Los ocho mundos de
 * referencia entran donde toca, que es donde se cuentan las presentaciones.
 */
function mundoDePrueba() {
  return {
    settlements: [
      {
        name: MONFRIDA,
        type: 'aldea',
        anchor: { name: 'Cambados', kind: 'parque', osmId: 'n/1', placeId: 'PID-MONFRIDA' },
        services: [
          { name: TABERNA, kind: 'taberna', label: 'Taberna', real: { name: 'Bar de Manolo', kind: 'restaurante', osmId: 'n/2' } },
        ],
      },
      { name: OUTEIRO, type: 'aldea', anchor: null, services: [] },
    ],
    parajes: [
      {
        name: TORREON,
        type: 'atalaya',
        label: PARAJE_INFO.atalaya.label,
        scenes: PARAJE_INFO.atalaya.scenes,
        real: { name: 'Chiringuito de Manolo', kind: 'torre', osmId: 'n/3', placeId: 'PID-TORREON' },
        origin: 'anclaje',
      },
      {
        name: FONTE,
        type: 'fuente',
        label: PARAJE_INFO.fuente.label,
        scenes: PARAJE_INFO.fuente.scenes,
        // Sin nombre en OSM: la línea de «qué es en realidad» se dice por su etiqueta.
        real: { name: null, kind: 'manantial', osmId: 'n/4' },
        origin: 'anclaje',
      },
      {
        name: CRUCE,
        type: 'cruce',
        label: PARAJE_INFO.cruce.label,
        scenes: PARAJE_INFO.cruce.scenes,
        real: null,
        origin: 'grafo',
      },
    ],
  };
}

/**
 * El lector de recursos binarios, doblado, y con **registro**: lo que se le preguntó es
 * lo que permite afirmar que la resolución miró el inventario del mundo y no una lista
 * vacía por defecto.
 */
function creaLector(almacen = new Map()) {
  const preguntas = [];
  return {
    almacen,
    preguntas,
    guarda(clave) {
      const referencia = `local/recursos/${clave}`;
      almacen.set(referencia, `binario de ${clave}`);
      return referencia;
    },
    olvida(referencia) { return almacen.delete(referencia); },
    tiene(referencia) { preguntas.push(referencia); return almacen.has(referencia); },
    lee(referencia) { return almacen.get(referencia) ?? null; },
  };
}

/** El registro de sitios pisados, doblado sobre un conjunto. */
function creaPisados(pisados = []) {
  const dentro = new Set(pisados);
  return {
    dentro,
    yaVisitado: (sitio) => dentro.has(sitio),
    anota: (sitio) => dentro.add(sitio),
  };
}

/**
 * Monta la frontera entera sobre el mundo de prueba: el inventario del mundo congelado,
 * el lector con los binarios que se le pidan y el registro de sitios pisados.
 *
 * `ilustrados` y `fotografiados` son listas de nombres de sitio. Un sitio en `perdidos`
 * queda declarado residente **sin** binario en el almacén, que es el caso del documento
 * que promete lo que no está.
 */
function frontera({ mundo = mundoDePrueba(), ilustrados = [], fotografiados = [], perdidos = [], pisados = [] } = {}) {
  const sitios = sitiosDelMundo(mundo);
  const lector = creaLector();
  const ilustraciones = [];
  const fotos = [];

  for (const nombre of [...ilustrados, ...perdidos]) {
    const sitio = sitios.get(nombre);
    const clave = claveDeIlustracionDeSitio(sitio);
    const referencia = lector.guarda(clave);
    ilustraciones.push(declaraIlustracion({ elemento: clave, prompt: `prompt de ${clave}`, recurso: referencia }));
    if (perdidos.includes(nombre)) lector.olvida(referencia);
  }
  for (const nombre of fotografiados) {
    const sitio = sitios.get(nombre);
    const placeId = sitio.real.placeId;
    const referencia = lector.guarda(`places:${placeId}`);
    fotos.push(declaraFoto({ placeId, recurso: referencia, capturadaEn: '2026-08-09' }));
  }

  const recursos = { ilustraciones, fotos, textos: [] };
  const visitados = creaPisados(pisados);
  return {
    mundo,
    sitios,
    recursos,
    lector,
    visitados,
    capa: creaVisor({ mundo, recursos, lector, visitados }),
    sitio: (nombre) => sitios.get(nombre),
    presenta: (nombre) => resuelvePresentacion({ sitio: sitios.get(nombre), recursos, lector, pisados: visitados }),
    visor: (nombre) => componeVisor({ sitio: sitios.get(nombre), recursos, lector, pisados: visitados }),
  };
}

/** Los ocho mundos de referencia, generados una sola vez: son ocho tuberías enteras. */
const MEMORIA = new Map();
async function losOchoMundos() {
  if (!MEMORIA.size) {
    for (const nombre of LOS_CUATRO) {
      for (const semilla of LAS_DOS_SEMILLAS) {
        MEMORIA.set(`${nombre}-${semilla}`, await generaMundo(nombre, semillaDe(nombre, semilla)));
      }
    }
  }
  return [...MEMORIA.entries()];
}

/**
 * La frontera de un mundo de referencia con una receta de recursos.
 *
 * `ilustrables` declara residentes las ilustraciones de los elementos que el juego
 * ilustra —núcleos y parajes, que es lo que dice `elementosIlustrables`—; `nada` es el
 * modo sin cobertura, con el mundo entero sin un solo recurso residente. Las fotos no
 * entran en ninguna receta porque **ningún extracto trae un `place_id`**, y fabricar uno
 * aquí sería inventarse el dato que se quiere medir.
 */
function fronteraDeReferencia(mundo, { receta = 'ilustrables', pisados = [] } = {}) {
  const lector = creaLector();
  const ilustraciones = [];
  if (receta === 'ilustrables') {
    for (const elemento of elementosIlustrables(mundo)) {
      const clave = claveDeElemento(elemento.type, elemento.name);
      const referencia = lector.guarda(clave);
      ilustraciones.push(declaraIlustracion({ elemento: clave, prompt: `prompt de ${clave}`, recurso: referencia }));
    }
  }
  const recursos = { ilustraciones, fotos: [], textos: [] };
  const visitados = creaPisados(pisados);
  return { recursos, lector, visitados, capa: creaVisor({ mundo, recursos, lector, visitados }) };
}

/** El código de un fichero del repo sin comentarios: los comentarios nombran lo que no se hace. */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//'))
    .join('\n');
}

/** El código sin sus textos, para las afirmaciones negativas sobre palabras. */
function codigoSinTextos(ruta) {
  return codigoDe(ruta)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

// ── La presentación se elige sola, y hay exactamente tres ──────────────────────

describe('La presentación se elige sola, y hay exactamente tres', () => {
  test('Las presentaciones declaradas son exactamente tres y el estado del momento añade la segunda vez', () => {
    assert.deepEqual([...IDS_DE_PRESENTACION], ['visor', 'visor-sin-foto', 'ficha']);
    assert.deepEqual([...ESTADOS_DE_LLEGADA], ['visor', 'visor-sin-foto', 'ficha', 'visor-a-un-toque']);
    assert.equal(ESTADO_A_UN_TOQUE, 'visor-a-un-toque');
    // Una cuarta presentación sería una pantalla que la regla no sabría elegir.
    assert.equal(Object.keys(PRESENTACIONES).length, 3);
    assert.deepEqual([...IDS_DE_LADO], ['ficcion', 'real']);
  });

  test('Un sitio con ilustración y foto residentes abre el visor por el lado de la ficción', () => {
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    const presentacion = f.presenta(TORREON);
    assert.equal(presentacion.presentacion, PRESENTACIONES.VISOR);
    assert.equal(presentacion.estado, 'visor');
    assert.equal(presentacion.abreSola, true);
    assert.equal(presentacion.modo, MODOS.ENCADENADO);

    const visor = f.visor(TORREON);
    assert.equal(ladoEnPosicion(visor.tirador.inicio), LADOS.FICCION, 'el visor no abre por la ficción');
    assert.equal(visor.real.fondoLiso, false);
    assert.ok(visor.real.foto, 'el lado real de un sitio con foto residente no la trae');
  });

  test('Un sitio con ilustración y sin foto sigue siendo el visor, con el lado real sobre fondo liso', () => {
    const f = frontera({ ilustrados: [TORREON] });
    const presentacion = f.presenta(TORREON);
    assert.equal(presentacion.presentacion, PRESENTACIONES.VISOR_SIN_FOTO);
    assert.equal(presentacion.foto, null);
    assert.equal(presentacion.abreSola, true, 'sin foto el visor deja de abrir solo: se perdería el momento y no solo la foto');

    const visor = f.visor(TORREON);
    assert.equal(visor.real.foto, null);
    assert.equal(visor.real.fondoLiso, true);
    assert.equal(ladoEnPosicion(visor.tirador.inicio), LADOS.FICCION);
  });

  test('Un sitio sin ilustración da la ficha de texto, tenga o no tenga foto', () => {
    const conFoto = frontera({ fotografiados: [TORREON] });
    assert.equal(conFoto.presenta(TORREON).presentacion, PRESENTACIONES.FICHA);
    const sinNada = frontera({});
    assert.equal(sinNada.presenta(TORREON).presentacion, PRESENTACIONES.FICHA);
    // Y no se le puede componer un visor: sería una capa con el lado de la ficción vacío.
    assert.throws(() => sinNada.visor(TORREON), /se resuelve como ficha de texto y no tiene visor/);
  });

  test('Cada sitio de los ocho mundos de referencia cae en una de las tres presentaciones y en ninguna otra', async () => {
    const cuenta = { visor: 0, 'visor-sin-foto': 0, ficha: 0 };
    let sitios = 0;
    for (const [, mundo] of await losOchoMundos()) {
      const f = fronteraDeReferencia(mundo);
      for (const [nombre] of sitiosDelMundo(mundo)) {
        const presentacion = f.capa.presentacionDe(nombre);
        assert.ok(IDS_DE_PRESENTACION.includes(presentacion.presentacion), `"${nombre}" resuelve "${presentacion.presentacion}"`);
        assert.ok(ESTADOS_DE_LLEGADA.includes(presentacion.estado), `"${nombre}" deja el estado "${presentacion.estado}"`);
        cuenta[presentacion.presentacion] += 1;
        sitios += 1;
      }
    }
    assert.equal(sitios, 144, 'los ocho extractos no traen los mismos sitios que cuando se escribió esta prueba');
    // El reparto exacto, que es lo que convierte esto en una red y no en una anécdota:
    // el cero de la primera columna es el que se mueve el día que Places entre.
    assert.deepEqual(cuenta, { visor: 0, 'visor-sin-foto': 65, ficha: 79 });
  });

  test('La misma llegada resuelta dos veces da la misma presentación', async () => {
    const f = frontera({ ilustrados: [TORREON, MONFRIDA], fotografiados: [TORREON] });
    for (const nombre of [TORREON, MONFRIDA, FONTE, CRUCE, OUTEIRO, TABERNA]) {
      assert.deepEqual(f.presenta(nombre), f.presenta(nombre), `"${nombre}" se resuelve distinto dos veces seguidas`);
    }
    // Y sobre los ocho mundos: dos capas montadas igual dan el mismo texto entero.
    for (const [clave, mundo] of await losOchoMundos()) {
      const a = fronteraDeReferencia(mundo);
      const b = fronteraDeReferencia(mundo);
      const serie = (f) => JSON.stringify([...sitiosDelMundo(mundo).keys()].sort().map((n) => f.capa.presentacionDe(n)));
      assert.equal(serie(a), serie(b), `el mundo ${clave} resuelve distinto dos veces`);
    }
  });

  test('Una ilustración declarada residente que no está en el almacén falla nombrando el sitio y el recurso', () => {
    const f = frontera({ perdidos: [TORREON] });
    assert.throws(() => f.presenta(TORREON), (e) => {
      assert.match(e.message, /la ilustración de "O Torreón Esquecido"/);
      assert.match(e.message, /local\/recursos\/atalaya:O Torreón Esquecido/);
      assert.match(e.message, /se ha perdido/);
      return true;
    });
  });

  test('Un sitio sin nombre de fantasía falla nombrando el sitio y no devuelve una cartela vacía', () => {
    const sitio = { rol: 'paraje', tipo: 'atalaya', nombre: '  ', escena: 'vigilancia', real: { name: 'x', kind: 'torre' } };
    const f = frontera({});
    for (const componer of [
      () => resuelvePresentacion({ sitio, recursos: f.recursos, lector: f.lector, pisados: f.visitados }),
      () => cartelaDeFiccion(sitio),
      () => componeFicha({ sitio }),
    ]) {
      assert.throws(componer, /no tiene nombre de fantasía/);
      assert.throws(componer, /atalaya/);
    }
    // Y el mundo entero: un sitio sin nombre no se indexa en silencio.
    const mundo = mundoDePrueba();
    mundo.parajes.push({ name: null, type: 'ruina', scenes: {}, real: null });
    assert.throws(() => sitiosDelMundo(mundo), /no tiene nombre de fantasía/);
  });

  test('Un sitio que no es del mundo falla nombrando el sitio', () => {
    assert.throws(() => sitioDelMundo(mundoDePrueba(), 'A Vila Que Non Existe'), /no es ningún sitio de este mundo/);
    assert.throws(() => frontera({}).capa.presentacionDe('A Vila Que Non Existe'), /no es ningún sitio de este mundo/);
  });
});

// ── El visor abre por la ficción la primera vez ────────────────────────────────

describe('El visor abre por la ficción la primera vez', () => {
  test('El visor abre por la ficción la primera vez', () => {
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    const visor = f.visor(TORREON);

    // Se ve la ilustración de fantasía y el nombre inventado.
    assert.equal(visor.ficcion.imagen, `binario de ${claveDeIlustracionDeSitio(f.sitio(TORREON))}`);
    assert.equal(visor.cartelas.ficcion.nombre, TORREON);
    assert.equal(visor.abreSola, true);

    // El tirador está en el borde del lado de la ficción.
    assert.equal(visor.tirador.inicio, TIRADOR.min);
    assert.equal(ladoEnPosicion(visor.tirador.inicio), LADOS.FICCION);
    assert.equal(cartelaEnPosicion(visor, visor.tirador.inicio).lado, LADOS.FICCION);

    // La cartela dice el tipo y el nombre de fantasía, y **no** dice el nombre real.
    assert.equal(visor.cartelas.ficcion.tipo, 'Paraje · revelación');
    assert.equal(visor.cartelas.ficcion.invitacion, TEXTOS.invitacion);
    assert.equal(JSON.stringify(visor.cartelas.ficcion).includes('Chiringuito de Manolo'), false, 'la cartela de la ficción dice el nombre real');
  });

  test('El rótulo del tipo dice el rol y su matiz, y los roles son exactamente tres', () => {
    const f = frontera({});
    assert.deepEqual(Object.keys(ROTULOS_DE_ROL).sort(), ['nucleo', 'paraje', 'servicio']);
    assert.equal(rotuloDeTipo(f.sitio(TORREON)), 'Paraje · revelación');
    assert.equal(rotuloDeTipo(f.sitio(MONFRIDA)), 'Núcleo · aldea');
    assert.equal(rotuloDeTipo(f.sitio(TABERNA)), 'Servicio · taberna');
    assert.throws(() => rotuloDeTipo({ rol: 'calzada', nombre: 'x' }), /no es ninguno de los declarados/);
  });

  test('El visor no aparece nunca andando', () => {
    // La mitad de la validación es de SPEC-032 y vive en `test/nucleo/llegadas.test.mjs`.
    // Lo que se afirma aquí es la otra: esta capa **no sabe nada del movimiento**, así que
    // no hay manera de que abra por su cuenta. Ninguna de sus entradas es una posición.
    const codigo = codigoSinTextos(VISOR);
    for (const sensor of [/geofence/i, /velocidad/i, /clasificacion/i, /permanencia/i, /andando/i, /tMs/, /\blat\b/, /\blon\b/]) {
      assert.equal(sensor.test(codigo), false, `el visor mira algo del movimiento (${sensor})`);
    }
    for (const capa of [/partida\/llegadas\.js/, /partida\/ritmo\.js/, /partida\/transporte\.js/]) {
      assert.equal(capa.test(fuente(VISOR)), false, `el visor importa la capa que valida la llegada (${capa})`);
    }
    // Y lo que decide que se abra sola es la presentación y el registro de pisados, no un
    // estado del sensor: con las mismas dos entradas, la respuesta es la misma siempre.
    const f = frontera({ ilustrados: [TORREON] });
    assert.equal(f.presenta(TORREON).abreSola, true);
    assert.equal(frontera({ ilustrados: [TORREON], pisados: [TORREON] }).presenta(TORREON).abreSola, false);
  });
});

// ── El arrastre descubre el sitio real ─────────────────────────────────────────

describe('El arrastre descubre el sitio real', () => {
  test('Arrastrar descubre el sitio real', () => {
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    const visor = f.visor(TORREON);

    // Arrastrado hasta el final: aparece la foto del lugar real y la cartela dice el
    // nombre real.
    assert.equal(ladoEnPosicion(TIRADOR.max), LADOS.REAL);
    assert.equal(visor.real.foto, 'binario de places:PID-TORREON');
    const real = cartelaEnPosicion(visor, TIRADOR.max);
    assert.equal(real.lado, LADOS.REAL);
    assert.equal(real.nombre, 'Chiringuito de Manolo');
    assert.equal(real.encabezado, TEXTOS.enRealidad);
    assert.equal(real.remate, REMATES.atalaya);
    // La invitación desaparece, y su ausencia es la pieza: ya se arrastró.
    assert.equal(Object.prototype.hasOwnProperty.call(real, 'invitacion'), false, 'la cartela real sigue invitando a arrastrar');
  });

  test('La cartela puesta es la de la ficción hasta el cruce y la real a partir de él, y nunca las dos', () => {
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    const visor = f.visor(TORREON);
    assert.equal(PUNTO_DE_CRUCE, 0.5, 'el cruce dejó de estar a la mitad del recorrido');

    for (const t of [0, 0.1, 0.25, 0.49, 0.4999]) {
      assert.equal(cartelaEnPosicion(visor, t).lado, LADOS.FICCION, `en ${t} la cartela ya es la real`);
    }
    // Soltar exactamente en el cruce cae al lado real: devolverlo se lee como un rechazo.
    for (const t of [0.5, 0.51, 0.75, 1]) {
      assert.equal(cartelaEnPosicion(visor, t).lado, LADOS.REAL, `en ${t} la cartela sigue siendo la de la ficción`);
    }
    // Nunca las dos a la vez: la cartela puesta es una de las dos del visor y no una mezcla.
    for (const t of [0, 0.3, 0.5, 1]) {
      const puesta = cartelaEnPosicion(visor, t);
      assert.equal(puesta === visor.cartelas.ficcion || puesta === visor.cartelas.real, true);
    }
  });

  test('Un arrastre soltado antes del cruce vuelve al lado de la ficción y la cartela no ha cambiado', () => {
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    const visor = f.visor(TORREON);
    for (const t of [0.05, 0.3, 0.49]) {
      const soltado = alSoltar(t);
      assert.deepEqual({ ...soltado }, { lado: LADOS.FICCION, posicion: TIRADOR.min }, `soltar en ${t} no vuelve al borde`);
      assert.equal(cartelaEnPosicion(visor, soltado.posicion), visor.cartelas.ficcion);
    }
    // Y dos posiciones estables y ninguna intermedia: pasado el cruce, el borde real.
    for (const t of [PUNTO_DE_CRUCE, 0.8, 1]) {
      assert.deepEqual({ ...alSoltar(t) }, { lado: LADOS.REAL, posicion: TIRADOR.max }, `soltar en ${t} no llega al borde real`);
    }
  });

  test('Una posición de tirador fuera del rango declarado falla nombrando el valor recibido', () => {
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    const visor = f.visor(TORREON);
    for (const t of [-0.0001, -1, 1.0001, 2, Number.NaN, Number.POSITIVE_INFINITY, '0.5', null, undefined, {}]) {
      const dicho = JSON.stringify(t) ?? String(t);
      assert.throws(() => exigePosicionDeTirador(t), new RegExp(`${dicho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${dicho} ha pasado`);
      assert.throws(() => ladoEnPosicion(t), /recorrido declarado va de 0 a 1/);
      assert.throws(() => cartelaEnPosicion(visor, t), /recorrido declarado va de 0 a 1/);
      assert.throws(() => alSoltar(t), /recorrido declarado va de 0 a 1/);
    }
    assert.deepEqual({ ...TIRADOR }, { min: 0, max: 1, inicio: 0, cruce: 0.5 });
    // Y la cartela se pide sobre un visor compuesto, no sobre cualquier cosa.
    assert.throws(() => cartelaEnPosicion(null, 0), /se pide sobre un visor ya compuesto/);
  });

  test('Sin foto de Places, el visor abre igual', () => {
    const conFoto = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] }).visor(TORREON);
    const sinFoto = frontera({ ilustrados: [TORREON] }).visor(TORREON);

    // Se ve la ilustración de fantasía igual, y al arrastrar aparece la cartela con el
    // nombre real sobre fondo liso.
    assert.equal(sinFoto.ficcion.imagen, conFoto.ficcion.imagen);
    assert.equal(sinFoto.real.foto, null);
    assert.equal(sinFoto.real.fondoLiso, true);
    assert.equal(cartelaEnPosicion(sinFoto, TIRADOR.max).nombre, 'Chiringuito de Manolo');

    // **La cartela es idéntica a la del caso con foto**: si se pierde la foto y no el
    // momento, la única diferencia posible está en `real.foto` y en `real.fondoLiso`.
    assert.deepEqual(sinFoto.cartelas, conFoto.cartelas);
    assert.deepEqual(
      { ...sinFoto, real: null, presentacion: null, estado: null },
      { ...conFoto, real: null, presentacion: null, estado: null },
      'el visor sin foto difiere del visor con foto en algo más que la foto',
    );
    assert.equal(sinFoto.presentacion, PRESENTACIONES.VISOR_SIN_FOTO);
    assert.equal(conFoto.presentacion, PRESENTACIONES.VISOR);
  });
});

// ── El visor es una capa y no un paso ──────────────────────────────────────────

describe('El visor es una capa y no un paso', () => {
  test('El visor es una capa y debajo está el beat', () => {
    const secuencia = secuenciaDeLlegada({ tipoDeSitio: 'paraje', primeraVisita: true, hayIlustracion: true, hayBeat: true });
    assert.deepEqual(secuencia.map((p) => p.tipo), [TIPOS_DE_PASO.VISOR, TIPOS_DE_PASO.BEAT]);
    // Cerrar el visor deja la escena: el paso de debajo es el siguiente encadenado.
    const cerrado = avanzaLaSecuencia(secuencia, 0);
    assert.equal(cerrado.vigente.tipo, TIPOS_DE_PASO.BEAT);
    assert.equal(cerrado.cerrada, false);
    // Y la pantalla monta ya el de debajo mientras la capa está puesta, en lugar de
    // esperar a que se cierre: cerrar no lleva a ningún sitio.
    const pantalla = codigoDe(PANTALLA_LLEGADA);
    assert.match(pantalla, /encadenadoDesde\(llegada\.secuencia, vigente\.indice \+ 1\)/);
    assert.match(pantalla, /capaPuesta \? <PantallaVisor/);
  });

  test('El visor abierto en un sitio sin beat deja debajo la ficha del sitio', () => {
    const secuencia = secuenciaDeLlegada({ tipoDeSitio: 'paraje', primeraVisita: true, hayIlustracion: true, hayBeat: false });
    assert.deepEqual(secuencia.map((p) => p.tipo), [TIPOS_DE_PASO.VISOR, TIPOS_DE_PASO.FICHA]);
    assert.equal(avanzaLaSecuencia(secuencia, 0).vigente.tipo, TIPOS_DE_PASO.FICHA);
  });

  test('Tocar fuera y la flecha son la misma salida y dejan debajo lo mismo', () => {
    const pantalla = codigoDe(PANTALLA_VISOR);
    // Las dos salidas llaman a la misma propiedad y ninguna hace nada más: dos salidas
    // con efectos distintos obligarían a explicar cuál es cuál.
    const salidas = pantalla.match(/testID="visor-(?:fuera|cerrar)"[\s\S]{0,220}?onPress=\{(\w+)\}/g) ?? [];
    assert.equal(salidas.length, 2, 'el visor no tiene exactamente dos salidas');
    for (const salida of salidas) assert.match(salida, /onPress=\{alCerrar\}/);
    assert.equal(/onPress=\{\(\)\s*=>/.test(pantalla), false, 'alguna salida del visor hace algo además de cerrar');
  });

  test('El visor no añade ningún toque a una llegada: cerrarlo es la única y existe también sin él', () => {
    for (const tipoDeSitio of ['nucleo', 'paraje', 'servicio']) {
      const conVisor = secuenciaDeLlegada({ tipoDeSitio, primeraVisita: true, hayIlustracion: true, hayBeat: true });
      const sinVisor = secuenciaDeLlegada({ tipoDeSitio, primeraVisita: true, hayIlustracion: false, hayBeat: true });
      assert.deepEqual(
        conVisor.filter((p) => p.tipo !== TIPOS_DE_PASO.VISOR),
        [...sinVisor],
        `el visor cambia el resto de la llegada en un ${tipoDeSitio}`,
      );
      // Lo que se había venido a hacer está en el mismo sitio con visor y sin él: lo que
      // el visor añade es exactamente un paso, el suyo, y se cierra con la misma acción.
      assert.equal(conVisor.length - sinVisor.length, 1);
      assert.equal(pasoVigente(conVisor, 0).tipo, TIPOS_DE_PASO.VISOR);
      assert.equal(avanzaLaSecuencia(conVisor, 0).vigente.tipo, pasoVigente(sinVisor, 0).tipo);
    }
  });

  test('El visor no añade ningún control de más: ni aceptar, ni confirmar, ni pasar de lámina', () => {
    assert.deepEqual([...LO_QUE_EL_VISOR_NO_ANADE], [
      'boton-de-aceptar',
      'confirmacion-al-cerrar',
      'indicador-de-pagina',
      'tercera-lamina',
      'tutorial-del-arrastre',
    ]);
    const pantalla = codigoDe(PANTALLA_VISOR);
    for (const control of [/aceptar/i, /confirm/i, /siguiente/i, /p[áa]gina/i, /carrusel/i, /tutorial/i, /Animated/, /parpade/i]) {
      assert.equal(control.test(pantalla), false, `la capa del visor añade un control o una animación de más (${control})`);
    }
    // Dos lados y no tres: el visor compuesto no lleva más láminas que las declaradas.
    const visor = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] }).visor(TORREON);
    assert.deepEqual(Object.keys(visor.cartelas).sort(), ['ficcion', 'real']);
  });
});

// ── La segunda vez no se abre solo, y queda a un toque ─────────────────────────

describe('La segunda vez no se abre solo, y queda a un toque', () => {
  test('La segunda vez el visor no se abre solo', () => {
    const f = frontera({ ilustrados: [TORREON], pisados: [TORREON] });
    const presentacion = f.presenta(TORREON);
    assert.equal(presentacion.modo, MODOS.A_UN_TOQUE);
    assert.equal(presentacion.estado, ESTADO_A_UN_TOQUE);
    assert.equal(presentacion.abreSola, false, 'la segunda visita abre el visor sola');
    // Y queda disponible: el visor se compone igual, con los mismos dos lados.
    const visor = f.visor(TORREON);
    assert.equal(visor.estado, ESTADO_A_UN_TOQUE);
    assert.equal(visor.volverAMirar, `${TEXTOS.volverAMirar} ${TORREON}`);
  });

  test('El visor que se reabre a un toque tiene los mismos dos lados y el tirador en el borde', () => {
    const primera = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] }).visor(TORREON);
    const segunda = frontera({ ilustrados: [TORREON], fotografiados: [TORREON], pisados: [TORREON] }).visor(TORREON);
    assert.deepEqual(segunda.cartelas, primera.cartelas);
    assert.deepEqual({ ...segunda.real }, { ...primera.real });
    assert.deepEqual({ ...segunda.tirador }, { ...primera.tirador });
    assert.equal(ladoEnPosicion(segunda.tirador.inicio), LADOS.FICCION, 'el visor reabierto no vuelve al borde de la ficción');
    // Y la capa vuelve al borde cada vez que se monta, también al reabrirse: quien vuelve
    // a mirar quiere volver a ver el cruce, no que le regalen la revelación.
    assert.match(codigoDe(PANTALLA_VISOR), /useState\(TIRADOR\.inicio\)/);
  });

  test('La llegada se resuelve contra el registro anterior y la anotación se hace después', () => {
    const f = frontera({ ilustrados: [TORREON] });
    // Primera visita: el visor sin foto, y se abre sola.
    const primera = f.capa.alLlegar(TORREON);
    assert.equal(primera.estado, 'visor-sin-foto');
    assert.equal(primera.abreSola, true);
    assert.equal(f.visitados.dentro.has(TORREON), true, 'llegar no ha dejado el sitio pisado');

    // Segunda: el mismo sitio, ya pisado, queda a un toque.
    const segunda = f.capa.alLlegar(TORREON);
    assert.equal(segunda.estado, ESTADO_A_UN_TOQUE);
    assert.equal(segunda.abreSola, false);

    // **El rojo a propósito**: anotando antes de resolver, la primera visita sale como
    // segunda y el visor no se abriría nunca solo. Es la degradación silenciosa de §6h,
    // y por eso `alLlegar` es una operación y no dos llamadas que haya que ordenar.
    const g = frontera({ ilustrados: [TORREON] });
    g.visitados.anota(TORREON);
    const alReves = g.capa.presentacionDe(TORREON);
    assert.equal(alReves.estado, ESTADO_A_UN_TOQUE);
    assert.equal(alReves.abreSola, false);
    assert.notDeepEqual(alReves, primera, 'anotar antes de resolver da la misma presentación: el orden no lo sostiene nada');
  });

  test('Consultar la presentación no anota nada: solo llegar deja el sitio pisado', () => {
    const f = frontera({ ilustrados: [TORREON] });
    for (let i = 0; i < 3; i++) assert.equal(f.capa.presentacionDe(TORREON).abreSola, true);
    assert.equal(f.visitados.dentro.size, 0, 'consultar la presentación ha anotado el sitio');
    // La misma llegada resuelta dos veces sin salir de ella —la app se cierra y se vuelve
    // a abrir sin moverse— da lo mismo las dos veces.
    const antes = f.capa.presentacionDe(TORREON);
    assert.deepEqual(f.capa.presentacionDe(TORREON), antes);
  });

  test('Un sitio pisado en una salida anterior cuenta como segunda vez: el registro no se vacía al echar el telón', () => {
    // El registro de sitios pisados vive en el estado de la partida y no en el de la
    // salida, así que echar el telón no lo toca. Se comprueba con las dos capas de
    // verdad: se cierra la salida, se lee el telón y el estado va y vuelve del disco.
    const estado = estadoInicial({ semilla: SEMILLA });
    pisaSitio(estado.sitios, { mapaId: MAPA, sitio: TORREON });

    const salidas = estadoDeSalidas();
    const rotulo = rotuloQueFunciona();
    abreSalida(salidas, { salida: 'la-de-ayer', mapa: MAPA, partida: PARTIDA, tMs: 0, mundo: 'O Val de Arriba', rotulo, fuente: fuenteDePosiciones() });
    cierraLaSalida(salidas, { motivo: MOTIVOS_DE_CIERRE.REGRESO, rotulo });
    marcaElTelonComoLeido(salidas);

    const vuelto = levantaEstado(congelaEstado(estado));
    assert.deepEqual(vuelto.sitios.mapas[MAPA], [TORREON], 'el telón se ha llevado por delante los sitios pisados');

    // Y la presentación de hoy, resuelta contra ese registro, es la de la segunda vez.
    const f = frontera({
      ilustrados: [TORREON],
      pisados: vuelto.sitios.mapas[MAPA],
    });
    assert.equal(f.presenta(TORREON).estado, ESTADO_A_UN_TOQUE);
    assert.equal(f.presenta(TORREON).abreSola, false);
  });

  test('La ficha no queda nunca a un toque: no ofrece volver a mirar nada', () => {
    for (const pisados of [[], [FONTE]]) {
      const f = frontera({ pisados });
      const presentacion = f.presenta(FONTE);
      assert.equal(presentacion.presentacion, PRESENTACIONES.FICHA);
      assert.equal(presentacion.modo, MODOS.ENCADENADO, 'la ficha de un sitio ya pisado queda a un toque');
      assert.equal(presentacion.estado, 'ficha');
      assert.equal(presentacion.abreSola, false);
    }
  });
});

// ── La ficha de texto, que es la misma con imagen que sin cobertura ────────────

describe('La ficha de texto, que es la misma con imagen que sin cobertura', () => {
  test('Llegar sin haber venido a nada da la ficha del sitio', () => {
    const f = frontera({});
    const ficha = f.capa.fichaDe(TORREON);
    // El nombre de fantasía, qué es en realidad y la escena.
    assert.equal(ficha.nombre, TORREON);
    assert.equal(ficha.tipo, 'Paraje · revelación');
    assert.equal(ficha.enRealidad, 'En realidad: Chiringuito de Manolo.');
    assert.equal(ficha.escena, ESCENAS['revelación']);
    assert.equal(ficha.visita, TEXTOS.dePaso);
    // Y ningún texto lo llama error ni falta.
    for (const [clave, valor] of Object.entries(ficha)) {
      assert.deepEqual(infraccionesDeVocabulario(String(valor)), [], `la línea "${clave}" de la ficha dice algo del vocabulario prohibido`);
    }
    // Las dos acciones de abajo, y la de la izquierda es de la fila 35.
    assert.equal(ficha.descartar, TEXTOS.noPega);
    assert.equal(ficha.seguir, TEXTOS.seguir);
  });

  test('La ficha de un sitio con foto y la de un sitio sin nada tienen la misma composición', () => {
    const conRecursos = frontera({ ilustrados: [MONFRIDA], fotografiados: [TORREON] });
    const sinNada = frontera({});
    assert.deepEqual(Object.keys(conRecursos.capa.fichaDe(TORREON)).sort(), Object.keys(sinNada.capa.fichaDe(TORREON)).sort());
    assert.deepEqual(conRecursos.capa.fichaDe(TORREON), sinNada.capa.fichaDe(TORREON), 'la ficha cambia según lo que haya descargado');
  });

  test('Un mundo entero sin un solo recurso residente resuelve todas sus llegadas como ficha', async () => {
    for (const [clave, mundo] of await losOchoMundos()) {
      const f = fronteraDeReferencia(mundo, { receta: 'nada' });
      const sitios = sitiosDelMundo(mundo);
      for (const [nombre, sitio] of sitios) {
        const presentacion = f.capa.presentacionDe(nombre);
        assert.equal(presentacion.presentacion, PRESENTACIONES.FICHA, `${clave}: "${nombre}" no cae a la ficha sin ningún recurso`);
        assert.equal(presentacion.estado, 'ficha');
        // Y su composición es la misma que la de un sitio que sí tenía recursos.
        if (referenteReal(sitio)) {
          assert.deepEqual(Object.keys(f.capa.fichaDe(nombre)).sort(), ['descartar', 'enRealidad', 'escena', 'nombre', 'seguir', 'sitio', 'tipo', 'visita']);
        }
      }
    }
  });

  test('El tipo de fantasía y lo que el sitio es en realidad pueden no tener nada que ver', () => {
    const f = frontera({});
    const ficha = f.capa.fichaDe(TORREON);
    // Una atalaya que es un chiringuito: está desacoplado a propósito y no es un fallo.
    assert.equal(ficha.tipo.startsWith('Paraje'), true);
    assert.equal(ficha.enRealidad.includes('Chiringuito'), true);
    assert.equal(referenteReal(f.sitio(TORREON)).porEtiqueta, false);
    // Y sobre los ocho mundos: ningún sitio exige que su tipo pegue con su anclaje.
    assert.equal(REMATES.atalaya !== REMATE_DE_REPUESTO, true);
  });

  test('Un anclaje real sin nombre en OSM se dice por su etiqueta y nunca queda vacío', () => {
    const f = frontera({});
    const ficha = f.capa.fichaDe(FONTE);
    assert.equal(ficha.enRealidad, 'En realidad: el manantial.');
    const referente = referenteReal(f.sitio(FONTE));
    assert.equal(referente.porEtiqueta, true);
    assert.equal(referente.nombre.trim().length > 0, true);
    for (const excusa of [/desconoc/i, /sin nombre/i, /an[óo]nimo/i, /\?\?/]) {
      assert.equal(excusa.test(JSON.stringify(ficha)), false, `la ficha se excusa por el nombre que no hay (${excusa})`);
    }
    // Y el paraje que sale del callejero se dice por lo que es.
    assert.equal(f.capa.fichaDe(CRUCE).enRealidad, `En realidad: ${DEL_CALLEJERO.cruce}.`);
  });

  test('El catálogo de admisión y el de artículos son el mismo catálogo visto dos veces', () => {
    for (const entrada of CATALOGO_ADMISION) {
      assert.ok(ARTICULO_DE_ANCLAJE[entrada.kind], `el anclaje "${entrada.kind}" (${entrada.etiqueta}) no declara artículo`);
    }
    // Y un anclaje de un tipo que el catálogo no admite falla nombrándolo, en lugar de
    // dejar la línea de «qué es en realidad» coja.
    assert.throws(
      () => referenteReal({ nombre: 'X', tipo: 'ruina', real: { name: null, kind: 'pista de karts' } }),
      /"pista de karts"[\s\S]*catálogo de admisión/,
    );
    // Cada tipo de paraje tiene remate y cada escena tiene párrafo: si no, el módulo no
    // habría cargado, y esto lo deja escrito donde se lee.
    for (const tipo of Object.keys(PARAJE_INFO)) {
      assert.ok(REMATES[tipo], `el tipo "${tipo}" no tiene remate`);
      for (const escena of Object.keys(PARAJE_INFO[tipo].scenes)) assert.ok(ESCENAS[escena], `la escena "${escena}" no tiene párrafo`);
    }
  });

  test('Un sitio sin anclaje real ni origen en el callejero cae a la ficha y no se le compone ninguna', () => {
    const f = frontera({ ilustrados: [OUTEIRO] });
    // Un núcleo colocado por geometría no tiene lado real: con ilustración y todo, cae a
    // la ficha, porque un visor cuyo lado real no dice nada es un visor sin revelación.
    assert.equal(referenteReal(f.sitio(OUTEIRO)), null);
    assert.equal(f.presenta(OUTEIRO).presentacion, PRESENTACIONES.FICHA);
    assert.throws(() => f.capa.fichaDe(OUTEIRO), /no tiene ni anclaje real ni origen en el callejero/);
    assert.throws(() => cartelaReal(f.sitio(OUTEIRO)), /no hay lado real que descubrir/);
    assert.throws(() => f.visor(OUTEIRO), /se resuelve como ficha de texto y no tiene visor/);
  });

  test('Ningún extracto de los ocho mundos trae un solo place_id', async () => {
    let conFoto = 0;
    let sitios = 0;
    for (const [, mundo] of await losOchoMundos()) {
      for (const [, sitio] of sitiosDelMundo(mundo)) {
        sitios += 1;
        if (claveDeFotoDeSitio(sitio) !== null) conFoto += 1;
      }
    }
    assert.equal(sitios, 144);
    assert.equal(conFoto, 0, 'algún extracto trae un place_id: los recuentos de presentación de esta suite dejan de significar lo que dicen');
  });
});

// ── Ninguna pantalla llama fallo a esto ────────────────────────────────────────

describe('Ninguna pantalla llama fallo a esto', () => {
  test('Ningún texto de esta capa dice una palabra del vocabulario prohibido, sobre los ocho mundos y en los dos idiomas', async () => {
    const idiomas = new Set();
    let textos = 0;
    for (const [clave, mundo] of await losOchoMundos()) {
      idiomas.add(mundo.locale);
      // Las tres presentaciones que el dato real produce: la primera visita, la segunda
      // —que añade la acción de volver a mirar— y el modo sin cobertura.
      const recetas = [
        fronteraDeReferencia(mundo),
        fronteraDeReferencia(mundo, { pisados: [...sitiosDelMundo(mundo).keys()] }),
        fronteraDeReferencia(mundo, { receta: 'nada' }),
      ];
      for (const f of recetas) {
        const lista = f.capa.textos();
        assert.ok(lista.length > 0, `${clave} no produce ni un texto`);
        for (const texto of lista) {
          textos += 1;
          assert.deepEqual(infraccionesDeVocabulario(texto), [], `un texto de ${clave} dice algo prohibido: "${texto}"`);
        }
      }
    }
    assert.deepEqual([...idiomas].sort(), ['es', 'gl'], 'los ocho mundos ya no cubren los dos idiomas');
    // Sobre todos y no sobre una muestra: el recuento se afirma para que nadie pueda
    // aprobar este criterio recorriendo tres textos.
    assert.equal(textos, 2981, 'el recorrido de textos de esta capa ha cambiado de tamaño');
  });

  test('El vocabulario prohibido es una lista cerrada de doce palabras y cada una se detecta', () => {
    assert.equal(VOCABULARIO_PROHIBIDO.length, 12);
    assert.deepEqual([...VOCABULARIO_PROHIBIDO], [
      'error', 'fallo', 'no disponible', 'sin conexión', 'sin cobertura',
      'reintentar', 'cargar', 'descargar', 'imagen no', 'foto no', 'falta', 'pendiente',
    ]);
    for (const palabra of VOCABULARIO_PROHIBIDO) {
      assert.deepEqual(infraccionesDeVocabulario(`Vuelve a intentarlo: ${palabra} de momento.`), [palabra], `"${palabra}" no se detecta`);
      // Y con otra caja y sin tildes: una lista que solo cazara la forma exacta se
      // esquivaría sin querer con una mayúscula.
      const gritada = palabra.toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      assert.deepEqual(infraccionesDeVocabulario(`${gritada}.`), [palabra], `"${gritada}" se escapa de la lista`);
    }
  });

  test('El criterio se puede poner rojo: un texto prohibido falla nombrando el texto y la palabra', () => {
    assert.throws(
      () => exigeSinVocabularioProhibido('La foto no está disponible sin conexión.', 'la cartela real'),
      (e) => {
        assert.match(e.message, /la cartela real/);
        assert.match(e.message, /"no disponible"|"foto no"|"sin conexión"/);
        assert.match(e.message, /La foto no está disponible sin conexión\./);
        return true;
      },
    );
    // Y la criba recorre una descripción entera por su ruta, hoja a hoja.
    assert.throws(() => exigeSinVocabularioProhibido(42), /recibe un texto/);
  });

  test('Ninguna palabra del vocabulario prohibido se dispara por subcadena', () => {
    const legitimos = [
      ['Le encargar la piedra a un cantero.', 'cargar'],
      ['Se encarga el propio molinero.', 'cargar'],
      ['El descargador del muelle ya no viene.', 'descargar'],
      ['La faltriquera del vendedor.', 'falta'],
      ['Errorista no es una palabra, pero sirve.', 'error'],
      ['El fallador del pueblo.', 'fallo'],
    ];
    for (const [texto, palabra] of legitimos) {
      assert.equal(infraccionesDeVocabulario(texto).includes(palabra), false, `"${texto}" se marca como "${palabra}" por subcadena`);
    }
    // «descargar» lleva «cargar» dentro y son dos infracciones distintas: la palabra
    // entera se detecta y la de dentro no se cobra dos veces.
    assert.deepEqual(infraccionesDeVocabulario('Hay que descargar el lote.'), ['descargar']);
    assert.deepEqual(infraccionesDeVocabulario('Hay que cargar el carro.'), ['cargar']);
    // Y «pendiente» de la oreja es legítimo y la lista lo caza igual: la lista es cerrada
    // y cambiarla obliga a decir por qué, que es justo el debate que se quiere tener.
    assert.deepEqual(infraccionesDeVocabulario('Un pendiente de plata.'), ['pendiente']);
  });

  test('El lado real de un sitio sin foto no menciona la foto, ni la red, ni que esté incompleto', () => {
    const sinFoto = frontera({ ilustrados: [TORREON] }).visor(TORREON);
    const dicho = JSON.stringify({ cartelas: sinFoto.cartelas, volverAMirar: sinFoto.volverAMirar });
    for (const mencion of [/foto/i, /imagen/i, /red/i, /conexi/i, /incompleto/i, /todav[íi]a no/i, /por ahora/i]) {
      assert.equal(mencion.test(dicho), false, `el lado real sin foto menciona lo que no hay (${mencion})`);
    }
    // La ausencia no se representa: se sustituye. Ni hueco de imagen, ni icono roto.
    assert.equal(sinFoto.real.fondoLiso, true);
    const pantalla = codigoDe(PANTALLA_VISOR);
    for (const marcador of [/placeholder/i, /imagen-rota/i, /skeleton/i, /spinner/i, /ActivityIndicator/]) {
      assert.equal(marcador.test(pantalla), false, `la capa del visor dibuja un marcador de ausencia (${marcador})`);
    }
  });

  test('La ficha no ofrece reintentar, ni descargar, ni conectarse, ni una acción deshabilitada', () => {
    assert.deepEqual([...LO_QUE_LA_FICHA_NO_OFRECE], ['volver-a-mirar-deshabilitado', 'reintentar', 'descargar', 'conectarse']);
    const ficha = frontera({}).capa.fichaDe(TORREON);
    for (const accion of [/reintent/i, /descarg/i, /conect/i, /actualiz/i]) {
      assert.equal(accion.test(JSON.stringify(ficha)), false, `la ficha ofrece ${accion}`);
    }
    // La ficha no ofrece volver a mirar nada, ni siquiera deshabilitado: una acción
    // deshabilitada es el anuncio más ruidoso que hay.
    assert.equal(Object.prototype.hasOwnProperty.call(ficha, 'volverAMirar'), false);
    const pantalla = codigoDe(PANTALLA_FICHA);
    assert.equal(/disabled/.test(pantalla), false, 'la ficha dibuja una acción deshabilitada');
    assert.equal(/volverAMirar|visor-abrir/.test(pantalla), false, 'la ficha ofrece volver a mirar');
    // Dos acciones abajo y no tres: descartar —que es de la fila 35— y seguir.
    assert.deepEqual((pantalla.match(/<Pressable/g) ?? []).length, 2);
  });
});

// ── Nada degrada por falta de cableado ─────────────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  test('La composición de una llegada sin lector de recursos cableado falla nombrando la pieza', () => {
    const f = frontera({ ilustrados: [TORREON] });
    for (const lector of [undefined, null, {}, { tiene: () => true }, { lee: () => 'x' }]) {
      assert.throws(
        () => resuelvePresentacion({ sitio: f.sitio(TORREON), recursos: f.recursos, lector, pisados: f.visitados }),
        /lector de recursos binarios no está cableado/,
        `un lector ${JSON.stringify(lector) ?? String(lector)} ha pasado`,
      );
    }
    assert.throws(() => creaVisor({ mundo: mundoDePrueba(), recursos: f.recursos, visitados: f.visitados }), /lector de recursos binarios/);
  });

  test('La composición de una llegada sin el registro de sitios pisados falla nombrando el registro', () => {
    const f = frontera({ ilustrados: [TORREON] });
    for (const pisados of [undefined, null, {}, { anota: () => {} }]) {
      assert.throws(
        () => resuelvePresentacion({ sitio: f.sitio(TORREON), recursos: f.recursos, lector: f.lector, pisados }),
        /registro de sitios pisados no está cableado/,
        `un registro ${JSON.stringify(pisados) ?? String(pisados)} ha pasado`,
      );
    }
    // Y no trata todas las llegadas como primeras: el error lo dice en voz alta.
    assert.throws(
      () => resuelvePresentacion({ sitio: f.sitio(TORREON), recursos: f.recursos, lector: f.lector, pisados: null }),
      /toda llegada sería la primera/,
    );
    // Un registro que sabe mirar y no sabe anotar falla al llegar, no al resolver.
    const soloMira = creaVisor({ mundo: mundoDePrueba(), recursos: f.recursos, lector: f.lector, visitados: { yaVisitado: () => false } });
    assert.equal(soloMira.presentacionDe(TORREON).abreSola, true);
    assert.throws(() => soloMira.alLlegar(TORREON), /no sabe anotar/);
  });

  test('La resolución recibe el inventario de recursos del mundo y no una lista vacía por defecto', () => {
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    for (const recursos of [undefined, null, {}, { ilustraciones: [] }, { fotos: [] }, { ilustraciones: {}, fotos: [] }]) {
      assert.throws(
        () => resuelvePresentacion({ sitio: f.sitio(TORREON), recursos, lector: f.lector, pisados: f.visitados }),
        /inventario de recursos del mundo congelado/,
        `un inventario ${JSON.stringify(recursos) ?? String(recursos)} ha pasado`,
      );
    }
    // El modo sin cobertura es una respuesta y se declara: `{ ilustraciones: [], fotos: [], textos: [] }`.
    assert.equal(frontera({}).presenta(TORREON).presentacion, PRESENTACIONES.FICHA);
    // Y lo que la resolución miró es el inventario de verdad: preguntó por las dos
    // referencias declaradas y no dio nada por supuesto.
    f.lector.preguntas.length = 0;
    f.presenta(TORREON);
    assert.deepEqual(f.lector.preguntas, [
      `local/recursos/${claveDeIlustracionDeSitio(f.sitio(TORREON))}`,
      'local/recursos/places:PID-TORREON',
    ]);
  });

  test('Resolver una presentación no hace ninguna petición de red', async () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
      f.capa.alLlegar(TORREON);
      f.visor(TORREON);
      f.capa.fichaDe(FONTE);
      f.capa.textos();
      const [, mundo] = (await losOchoMundos())[0];
      fronteraDeReferencia(mundo).capa.textos();
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico al resolver una presentación');
    } finally {
      inspector.suelta();
    }
  });

  test('Esta capa no lee el reloj, no sortea y no lee de disco', () => {
    const codigo = codigoSinTextos(VISOR);
    for (const prohibido of [/Date\.now/, /new Date/, /Math\.random/, /readFile/, /fetch\s*\(/, /performance\.now/]) {
      assert.equal(prohibido.test(codigo), false, `el visor usa ${prohibido}`);
    }
    // El momento del apunte entra inyectado, que es la otra mitad de lo mismo.
    assert.throws(() => apunteDeLoMirado({ sitio: TORREON, dia: null, paso: 1 }), /el momento entra inyectado/);
  });
});

// ── Privacidad ────────────────────────────────────────────────────────────────

describe('Privacidad', () => {
  test('Una llegada con el visor abierto y arrastrado hasta el final no manda ninguna petición', async () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
      f.capa.alLlegar(TORREON);
      const visor = f.visor(TORREON);
      for (const t of [0, 0.25, PUNTO_DE_CRUCE, 0.75, 1]) cartelaEnPosicion(visor, t);
      alSoltar(1);
      apunteDeLoMirado({ sitio: TORREON, dia: 3, paso: 7 });
      assert.deepEqual(inspector.peticiones(), [], 'el visor ha hablado con alguien');
    } finally {
      inspector.suelta();
    }
  });

  test('El apunte de haber mirado un sitio es su identificador y el momento, y ninguna coordenada', () => {
    const apunte = apunteDeLoMirado({ sitio: TORREON, dia: 3, paso: 7 });
    assert.deepEqual({ ...apunte }, { sitio: TORREON, dia: 3, paso: 7 });
    assert.deepEqual(Object.keys(apunte).sort(), ['dia', 'paso', 'sitio']);
    const serializado = JSON.stringify(apunte);
    for (const campo of LO_QUE_EL_APUNTE_NO_LLEVA) {
      assert.equal(new RegExp(`"${campo}"`, 'i').test(serializado), false, `el apunte lleva "${campo}"`);
    }
    assert.equal(/\d+\.\d+/.test(serializado), false, `el apunte lleva algo con pinta de coordenada: ${serializado}`);
    // Y el sitio se nombra: un apunte por coordenada no se puede escribir.
    assert.throws(() => apunteDeLoMirado({ sitio: { x: 1, y: 2 }, dia: 1, paso: 1 }), /no tiene nombre de fantasía/);
    // El sitio pisado se anota igual en el estado de la partida: solo el identificador.
    const estado = estadoInicial({ semilla: SEMILLA });
    assert.throws(() => pisaSitio(estado.sitios, { mapaId: MAPA, sitio: { lat: 42.4, lon: -8.8 } }), /nunca por su coordenada/);
  });

  test('Ningún texto de esta capa lleva el nombre real de un sitio al que no se haya llegado', () => {
    // La cartela real es el único sitio donde el nombre real se escribe, y se compone
    // aquí dentro: la línea de remate sale de la plantilla y nunca del LLM en marcha.
    const codigo = codigoSinTextos(VISOR);
    assert.equal(/prompt|llm|proxy|peticion/i.test(codigo), false, 'el visor habla con la capa que llama al modelo');
    const f = frontera({ ilustrados: [TORREON], fotografiados: [TORREON] });
    const visor = f.visor(TORREON);
    assert.equal(visor.cartelas.real.remate, REMATES.atalaya);
    assert.equal(JSON.stringify(visor.cartelas.ficcion).includes('Manolo'), false);
  });
});
