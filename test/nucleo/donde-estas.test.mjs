// SPEC-050 · Que A2P0 se pueda alcanzar, que es lo que hasta esta fila no pasaba.
//
// El ofrecimiento de levantar un mapa existía, estaba probado y **era inalcanzable**: nadie
// desde `app/` resolvía el mapa activo —`levantamiento.mapaActivo` no tenía un solo
// consumidor—, `NUCLEO_DEL_OFRECIMIENTO` no lo importaba ningún fichero, y
// `antes-de-salir.jsx` recibía `ofrecimiento` como propiedad que quien lo montaba no le
// pasaba nunca. Es §6h en su variante de cableado y es de SPEC-041, que entregó el
// mecanismo entero sin la mitad que lo alcanza.
//
// Todo se dobla y nada toca la red: el levantamiento, el proveedor de posición y el traedor
// de topónimos entran inyectados, que es exactamente la costura que hace esto ejecutable en
// `node --test` sin dispositivo y sin cobertura.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import {
  DEL_NUCLEO_DEL_MAPA_NUEVO,
  DEL_NUCLEO_DEL_OFRECIMIENTO,
  DONDE,
  resuelveDondeEstas,
} from '../../app/mapa/donde-estas.js';
import { consultaDeToponimo, eligeToponimo, creaTraedorDeToponimos } from '../../app/datos/toponimo.js';
import { componeOfrecimiento, hayQueOfrecerMapa } from '../../packages/nucleo/partida/mapas.js';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

/** Las dos piezas del núcleo que este camino pide, armadas por ruta relativa (§6u). */
const NUCLEO = { componeOfrecimiento, hayQueOfrecerMapa };

const SEMILLA = '37BKQX25DHZ18ETX';
const AQUI = { lat: 42.40, lon: -8.81 };

/** Un proveedor de ubicación doblado: responde lo que se le diga y no toca ningún sensor. */
const ubicacionQue = (respuesta) => ({ pide: async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta) });
const CONCEDE = ubicacionQue({ concedido: true, posicion: AQUI });

/** Un levantamiento doblado: solo sabe contestar qué mapa hay donde le preguntan. */
const levantamientoQue = (resolucion) => ({ mapaActivo: async () => resolucion });
const SIN_MAPA = levantamientoQue({ estado: 'ninguno', mapaId: 'sin-mapa-activo', mapa: null, celda: null });
const EN_CASA = levantamientoQue({ estado: 'dentro', mapaId: '42.40,-8.81', mapa: {}, celda: { i: 0, j: 0 } });

/** Un traedor de topónimos doblado. `null` es «hoy no sé cómo se llama esto». */
const toponimosQue = (nombre) => ({ nombreDe: async () => nombre });

describe('El mapa activo lo decide dónde estás', () => {
  test('El mapa activo lo decide dónde estás', async () => {
    const resuelto = await resuelveDondeEstas(
      { levantamiento: EN_CASA, ubicacion: CONCEDE, toponimos: toponimosQue('Bueu'), nucleo: NUCLEO },
      { semilla: SEMILLA },
    );
    assert.equal(resuelto.donde, DONDE.EN_UN_MAPA);
    assert.equal(resuelto.ofrecimiento, null, 'con mapa donde estás no se ofrece levantar ninguno');
  });

  test('Estando en un mapa no se pregunta el topónimo, que es una llamada que no hace falta', async () => {
    let preguntas = 0;
    await resuelveDondeEstas(
      {
        levantamiento: EN_CASA,
        ubicacion: CONCEDE,
        toponimos: { nombreDe: async () => { preguntas += 1; return 'Bueu'; } },
        nucleo: NUCLEO,
      },
      { semilla: SEMILLA },
    );
    assert.equal(preguntas, 0);
  });

  test('Llegar a un sitio nuevo ofrece levantar un mapa', async () => {
    const resuelto = await resuelveDondeEstas(
      { levantamiento: SIN_MAPA, ubicacion: CONCEDE, toponimos: toponimosQue('la ribera del Manzanares'), nucleo: NUCLEO },
      { semilla: SEMILLA },
    );
    assert.equal(resuelto.donde, DONDE.SIN_MAPA);
    assert.equal(resuelto.ofrecimiento.sitio, 'la ribera del Manzanares');
    assert.equal(resuelto.ofrecimiento.testid, 'ofrecer-levantar-mapa');
    assert.equal(resuelto.ofrecimiento.seSaleAAndar, false, 'no se juega donde no estás');
    assert.deepEqual([...resuelto.ofrecimiento.puertas], ['diario', 'repisa', 'ajustes']);
  });

  test('Lo que se resuelve no lleva ninguna coordenada dentro', async () => {
    const resuelto = await resuelveDondeEstas(
      { levantamiento: SIN_MAPA, ubicacion: CONCEDE, toponimos: toponimosQue('Bueu'), nucleo: NUCLEO },
      { semilla: SEMILLA },
    );
    // RF-PRIV-002: lo único que sale de aquí es cómo se llama el sitio. Se afirma sobre el
    // texto entero porque una coordenada colada en cualquier campo valdría igual de mal.
    const dicho = JSON.stringify(resuelto.ofrecimiento);
    assert.ok(!dicho.includes(String(AQUI.lat)) && !dicho.includes(String(AQUI.lon)), `el ofrecimiento trae una coordenada: ${dicho}`);
  });

  test('Sin permiso de ubicación no se supone que hay mapa ni que no lo hay: se dice', async () => {
    const resuelto = await resuelveDondeEstas(
      { levantamiento: SIN_MAPA, ubicacion: ubicacionQue({ concedido: false, posicion: null }), toponimos: toponimosQue('Bueu'), nucleo: NUCLEO },
      { semilla: SEMILLA },
    );
    assert.equal(resuelto.donde, DONDE.NO_SE_SABE);
    assert.equal(resuelto.ofrecimiento, null, 'denegar el permiso no puede ofrecer levantar un mapa');
    assert.match(resuelto.motivo, /permiso/);
  });

  test('Un sensor que falla no tumba la app y deja dicho por qué', async () => {
    const resuelto = await resuelveDondeEstas(
      { levantamiento: SIN_MAPA, ubicacion: ubicacionQue(new Error('el sensor no responde')), nucleo: NUCLEO },
      { semilla: SEMILLA },
    );
    assert.equal(resuelto.donde, DONDE.NO_SE_SABE);
    assert.match(resuelto.motivo, /sensor/);
  });

  test('Montar esto sin sus piezas falla nombrando la que falta', async () => {
    await assert.rejects(
      () => resuelveDondeEstas({ levantamiento: null, ubicacion: CONCEDE, nucleo: NUCLEO }, { semilla: SEMILLA }),
      /levantamiento/,
    );
    await assert.rejects(
      () => resuelveDondeEstas({ levantamiento: SIN_MAPA, ubicacion: null, nucleo: NUCLEO }, { semilla: SEMILLA }),
      /ubicación/,
    );
    for (const pieza of DEL_NUCLEO_DEL_OFRECIMIENTO) {
      const cojo = { ...NUCLEO, [pieza]: undefined };
      await assert.rejects(
        () => resuelveDondeEstas({ levantamiento: SIN_MAPA, ubicacion: CONCEDE, nucleo: cojo }, { semilla: SEMILLA }),
        new RegExp(pieza),
      );
    }
  });

  test('Las dos listas de piezas del núcleo son las que los bloques traen', () => {
    assert.deepEqual([...DEL_NUCLEO_DEL_OFRECIMIENTO].sort(), ['componeOfrecimiento', 'hayQueOfrecerMapa']);
    assert.deepEqual([...DEL_NUCLEO_DEL_MAPA_NUEVO].sort(), ['correPrologo', 'siembraLaCola']);
  });
});

describe('El sitio se dice como lugar, y cuando no se sabe también', () => {
  test('Sin topónimo el ofrecimiento se compone igual, y entero', async () => {
    const resuelto = await resuelveDondeEstas(
      { levantamiento: SIN_MAPA, ubicacion: CONCEDE, toponimos: toponimosQue(null), nucleo: NUCLEO },
      { semilla: SEMILLA },
    );
    assert.equal(resuelto.donde, DONDE.SIN_MAPA, 'sin nombre se ofrece igual: la alternativa es una pantalla en blanco');
    assert.equal(resuelto.ofrecimiento.sitioConNombre, false);
    assert.ok(resuelto.ofrecimiento.sitio.length > 0, 'algo se dice en el sitio del nombre');
    assert.deepEqual([...resuelto.ofrecimiento.puertas], ['diario', 'repisa', 'ajustes'], 'las tres puertas siguen sin red');
  });

  test('El respaldo del sitio no nombra la red, ni la cobertura, ni ninguna cifra', () => {
    const sinRed = componeOfrecimiento({ sinRed: true });
    const dicho = [sinRed.sitio, sinRed.titular, sinRed.cuerpo, sinRed.aviso].join(' ');
    for (const palabra of ['red', 'conexión', 'cobertura', 'internet', 'wifi', 'datos', 'servidor', 'error']) {
      assert.ok(!new RegExp(`\\b${palabra}`, 'i').test(dicho), `el ofrecimiento sin red dice "${palabra}"`);
    }
    assert.ok(!/\d/.test(dicho), `el ofrecimiento sin red trae una cifra: ${dicho}`);
  });

  test('Con red el contrato no se ablanda: sin sitio y con cadena vacía siguen siendo error', () => {
    assert.throws(() => componeOfrecimiento({}), /dicho como lugar/);
    assert.throws(() => componeOfrecimiento({ sitio: '' }), /dicho como lugar/);
    assert.throws(() => componeOfrecimiento({ sitio: '', sinRed: true }), /dicho como lugar/);
  });

  test('Con topónimo se dice el topónimo y se declara que es el de verdad', () => {
    const conNombre = componeOfrecimiento({ sitio: 'la ribera del Manzanares' });
    assert.equal(conNombre.sitio, 'la ribera del Manzanares');
    assert.equal(conNombre.sitioConNombre, true);
    assert.equal(conNombre.aviso, null, 'con red no hay nada que avisar');
  });
});

describe('El topónimo viaja por la ruta ciega y se elige en orden declarado', () => {
  test('La consulta se hace sobre un recuadro y pide lugares con nombre', () => {
    const ql = consultaDeToponimo({ lat: AQUI.lat, lon: AQUI.lon });
    assert.match(ql, /\[out:json\]/);
    assert.match(ql, /around:\d+,42\.4,-8\.81/);
    assert.match(ql, /\["name"\]/, 'un lugar sin nombre no sirve para nada aquí');
  });

  test('La consulta sin posición falla nombrando lo que llegó', () => {
    assert.throws(() => consultaDeToponimo({ lat: null, lon: -8.81 }), /posición/);
    assert.throws(() => consultaDeToponimo({ lat: 42.4, lon: undefined }), /posición/);
  });

  test('El nombre elegido no depende del orden en que Overpass devuelva los elementos', () => {
    const elementos = [
      { tags: { place: 'hamlet', name: 'Aldea de Arriba' } },
      { tags: { place: 'village', name: 'Bueu' } },
      { tags: { place: 'village', name: 'Aldán' } },
      { tags: { place: 'locality' } },
      { tags: { name: 'sin clase de lugar' } },
    ];
    const elegido = eligeToponimo(elementos);
    assert.equal(elegido, 'Aldán', 'el lugar mayor primero, y a igualdad el nombre en orden de texto');
    assert.equal(eligeToponimo([...elementos].reverse()), elegido, 'el orden de llegada no puede decidir el nombre');
  });

  test('Sin ningún lugar con nombre no se inventa uno', () => {
    assert.equal(eligeToponimo([]), null);
    assert.equal(eligeToponimo(null), null);
    assert.equal(eligeToponimo([{ tags: { place: 'village' } }]), null, 'un lugar sin nombre no vale');
    assert.equal(eligeToponimo([{ tags: { name: 'Bueu' } }]), null, 'un nombre sin clase de lugar tampoco');
  });

  test('Que no se pueda preguntar no es una avería: se responde que no se sabe', async () => {
    const traedor = creaTraedorDeToponimos({ cliente: { pideGeneracion: async () => { throw new Error('sin red'); } } });
    assert.equal(await traedor.nombreDe(AQUI), null, 'un fallo de transporte y un sitio sin nombre llevan al mismo sitio');
  });

  test('El traedor pide por la ruta de generación y no manda nada más que la consulta', async () => {
    const enviado = [];
    const traedor = creaTraedorDeToponimos({
      cliente: { pideGeneracion: async (consulta) => { enviado.push(consulta); return { elements: [{ tags: { place: 'village', name: 'Bueu' } }] }; } },
    });
    assert.equal(await traedor.nombreDe(AQUI), 'Bueu');
    assert.equal(enviado.length, 1);
    // Es la misma puerta y el mismo sobre que el levantamiento: **no sale del móvil nada que
    // no saliera ya**, y por eso esto se puede afirmar en lugar de suponerse.
    assert.deepEqual(Object.keys(enviado[0]), ['ql']);
  });

  test('Montar el traedor sin cliente falla nombrando la pieza', () => {
    assert.throws(() => creaTraedorDeToponimos({}), /cliente del proxy/);
    assert.throws(() => creaTraedorDeToponimos({ cliente: {} }), /cliente del proxy/);
  });
});

describe('La rama de A2P0 se puede ejecutar, que es más que existir', () => {
  const ANTES_DE_SALIR = 'app/pantallas/antes-de-salir.jsx';

  test('El ofrecimiento no sale antes de los hooks de la pantalla', () => {
    // Es el defecto que la fila 50 encontró **la primera vez que alguien entró en la rama**:
    // el `return` del ofrecimiento estaba en medio del cuerpo, así que esa rama montaba menos
    // hooks que las demás y React tumbaba la app con «Rendered fewer hooks than expected».
    // Nunca había saltado porque nadie pasaba nunca `ofrecimiento` — SPEC-041 escribió la
    // rama y la dejó sin llamador (§6h). Medido en `wa-pixel` el 12-ago-2026.
    const codigo = readFileSync(join(RAIZ_REPO, ANTES_DE_SALIR), 'utf8');
    const rama = codigo.indexOf('if (ofrecimiento) {');
    assert.ok(rama > 0, 'la pantalla ya no tiene la rama del ofrecimiento');

    // Ningún hook puede quedar por debajo del `return` de esa rama.
    const despues = codigo.slice(rama);
    for (const hook of ['useState(', 'useMemo(', 'useCallback(', 'useEffect(', 'useRef(']) {
      assert.ok(
        !despues.includes(hook),
        `la pantalla monta ${hook} después del return del ofrecimiento: esa rama montaría menos hooks que las demás y React la tumbaría`,
      );
    }
  });

  test('La pantalla recibe el ofrecimiento y sus dos acciones desde quien la monta', () => {
    // La mitad que faltaba: la pantalla lo aceptaba y quien la montaba no se lo pasaba nunca.
    const montado = readFileSync(join(RAIZ_REPO, 'app/pantallas/antes-de-salir-montado.jsx'), 'utf8');
    for (const propiedad of ['ofrecimiento=', 'alLevantarMapa=', 'alDejarloEstar=']) {
      assert.ok(montado.includes(propiedad), `el punto de montaje no pasa ${propiedad}`);
    }
  });
});
