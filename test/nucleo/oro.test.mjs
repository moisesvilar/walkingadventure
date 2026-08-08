// SPEC-015 · El oro: **una cifra que se gasta, y nada más**, y lo que compra, que es
// saber y favores y nunca metros.
//
// Aquí se miden dos cosas que la spec afirma con números. La primera es el precio:
// con un ítem de precio base 7, los tres escalones dan **7, 4 y 0** — el redondeo
// hacia arriba de la mitad es lo que garantiza que el único cero sea el del escalón
// más alto—. La segunda es que el oro **sí** se enseña: `saldoDe` devuelve un número,
// al revés que el rango, del que no sale ni una cifra.
//
// Y una negativa que es estructura y no vigilancia: esta capa **no está en la cola de
// productores del motor de pasos**, así que cien pasos del mundo no pueden mover la
// bolsa. Es la misma prueba con la que SPEC-014 afirmó lo suyo.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { NIVEL_DEL_TESTIGO } from '../../packages/nucleo/partida/memoria.js';
import { hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import * as moduloDeOro from '../../packages/nucleo/partida/oro.js';
import {
  cierraSalidaDeProgresion,
  cobra,
  congelaOro,
  estadoDeOro,
  ingresa,
  levantaOro,
  saldoDe,
} from '../../packages/nucleo/partida/oro.js';
import {
  CAMPOS_DEL_MUNDO_REAL,
  CAMPOS_QUE_ACORTAN,
  EFECTOS_DE_COMPRA,
  FACTOR_POR_ESCALON,
  IDS_DE_EFECTO_DE_COMPRA,
  TIPOS_DE_ITEM,
  catalogoDelInformante,
  compra,
  exigeEfectoDeCompra,
  exigeItem,
  loQueAcortaElCamino,
  ofrece,
  planDeCompra,
  precioDe,
} from '../../packages/nucleo/partida/informantes.js';
import { estadoDeObjetos, objetosDe } from '../../packages/nucleo/partida/objetos.js';
import { estadoDeMotes } from '../../packages/nucleo/partida/motes.js';
import { estadoDeNucleos, loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { TONOS_DE_RANGO } from '../../packages/nucleo/partida/rango.js';
import { arbolDeCalzadas, creaPropagacionDeRumores, estadoDeRumores } from '../../packages/nucleo/partida/rumores.js';
import { capaSobre, desenlaceDe, mundoDeMesa, semillaDeRumor as semillaDeMesa, LA_TABERNERA } from './npc-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { CELDA_COSIDA, SEMILLA_A, mundoReal } from './rumor-de-prueba.mjs';
import {
  CADENA,
  CATALOGO,
  ITEM_DE_FAVOR,
  ITEM_DE_SABER,
  LOS_CINCO_MODULOS,
  MAPA,
  OTRO_MAPA,
  RUMORES_PARA,
  avanza,
  codigoDe,
  conRumores,
  desenlaceEn,
  informanteDe,
  mapaDe,
  mundoLineal,
  oye,
  propagacionSobre,
} from './progresion-de-prueba.mjs';

const MAPA_ACTIVO = mapaDe();

/** Lo que un núcleo oyó del rumor «r1», por la consulta pública de SPEC-012. */
function oyeronEn(nucleos, nucleo) {
  const version = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo }).find((v) => v.rumor === 'r1');
  assert.ok(version, `"${nucleo}" no ha oído nada y el caso no compara nada`);
  return version;
}

/** Un núcleo en el escalón que se pida, con el rumor «r1» siempre entre lo que oyó. */
function nucleoEn(escalon, { nucleo = 'Monfrida', nucleos = estadoDeNucleos(), nivel = 1 } = {}) {
  conRumores(RUMORES_PARA[escalon], { nucleos, nucleo, nivel });
  return nucleos;
}

/** Una bolsa con lo que se le pida dentro. */
function bolsaCon(saldo) {
  const estado = estadoDeOro();
  if (saldo) ingresa(estado, { oro: saldo });
  return estado;
}

describe('El rango cambia el trato y el precio, no el catálogo', () => {
  test('El rango cambia el trato y el precio, no el catálogo', () => {
    // Dos jugadoras en escalones distintos del mismo núcleo. Se modelan con dos
    // partidas sobre el mismo mapa: lo que las separa es lo que allí ha llegado de
    // cada una, que es de lo único que depende su rango.
    const forastera = nucleoEn('forasteria');
    const deAqui = nucleoEn('pertenencia');
    const informante = informanteDe('Monfrida');

    const aLaForastera = ofrece({ nucleos: forastera, mapaId: MAPA, mapa: MAPA_ACTIVO, informante, catalogo: CATALOGO });
    const aLaDeAqui = ofrece({ nucleos: deAqui, mapaId: MAPA, mapa: MAPA_ACTIVO, informante, catalogo: CATALOGO });

    // Se les ofrece exactamente lo mismo...
    assert.deepEqual(aLaForastera.catalogo, aLaDeAqui.catalogo, 'el rango ha filtrado lo que se ofrece');
    assert.deepEqual(aLaForastera.catalogo.map((i) => i.id), [ITEM_DE_SABER.id, ITEM_DE_FAVOR.id]);

    // ...pero a distinto precio y con distinto tono.
    assert.notDeepEqual(aLaForastera.precios, aLaDeAqui.precios, 'el precio no cambia con el rango');
    assert.deepEqual(aLaForastera.precios, [{ id: ITEM_DE_SABER.id, precio: 7 }, { id: ITEM_DE_FAVOR.id, precio: 4 }]);
    assert.deepEqual(aLaDeAqui.precios, [{ id: ITEM_DE_SABER.id, precio: 0 }, { id: ITEM_DE_FAVOR.id, precio: 0 }]);
    assert.notEqual(aLaForastera.tono, aLaDeAqui.tono, 'el tono no cambia con el rango');
    assert.equal(aLaForastera.tono, TONOS_DE_RANGO.forasteria);
    assert.equal(aLaDeAqui.tono, TONOS_DE_RANGO.pertenencia);

    // Y el catálogo no depende del rango ni por dentro: `catalogoDelInformante` no lo
    // recibe, así que no hay por dónde metérselo.
    assert.deepEqual(
      catalogoDelInformante(CATALOGO).map((i) => i.id),
      aLaDeAqui.catalogo.map((i) => i.id),
    );
    const firma = codigoDe(fuente('packages/nucleo/partida/informantes.js')).split('export function catalogoDelInformante')[1].split(')')[0];
    assert.equal(/escalon|rango|nucleos/.test(firma), false, 'el catálogo de un informante depende del rango');
  });

  test('En el escalón de partida el precio es el precio base declarado por el ítem', () => {
    assert.equal(precioDe(ITEM_DE_SABER, 'forasteria'), ITEM_DE_SABER.precioBase);
    assert.equal(FACTOR_POR_ESCALON.forasteria, 1);
  });

  test('En el escalón más alto el precio es cero', () => {
    assert.equal(precioDe(ITEM_DE_SABER, 'pertenencia'), 0);
    assert.equal(precioDe(ITEM_DE_FAVOR, 'pertenencia'), 0);
    assert.equal(FACTOR_POR_ESCALON.pertenencia, 0);
  });

  test('En el escalón intermedio el precio es la mitad redondeada hacia arriba y nunca cero', () => {
    assert.equal(precioDe(ITEM_DE_SABER, 'nombradia'), 4, '7 a la mitad y hacia arriba son 4');
    assert.equal(precioDe({ ...ITEM_DE_SABER, precioBase: 1 }, 'nombradia'), 1, 'el redondeo hacia arriba es lo que impide un segundo precio cero');
    for (let base = 1; base <= 40; base++) {
      const precio = precioDe({ ...ITEM_DE_SABER, precioBase: base }, 'nombradia');
      assert.equal(precio, Math.ceil(base / 2));
      assert.ok(precio > 0, `un ítem de precio base ${base} sale gratis en el escalón intermedio`);
    }
  });

  test('Un precio cero se compra entero y no cobra nada', () => {
    const oro = bolsaCon(10);
    const nucleos = nucleoEn('pertenencia');
    const resultado = compra({ oro, nucleos, mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida'), catalogo: CATALOGO, item: ITEM_DE_SABER.id });

    assert.equal(resultado.precio, 0);
    assert.equal(resultado.pagado, 0);
    assert.equal(saldoDe(oro), 10, 'una compra de precio cero ha cobrado algo');
    assert.equal(resultado.hayQueVender, true, 'la compra de precio cero no se ha resuelto entera');
    assert.ok(resultado.entrega, 'la compra de precio cero no ha entregado nada');
  });

  test('El tono es una clave de un enumerado cerrado, una por escalón', () => {
    assert.deepEqual(Object.keys(TONOS_DE_RANGO).sort(), ['forasteria', 'nombradia', 'pertenencia']);
    for (const tono of Object.values(TONOS_DE_RANGO)) {
      assert.equal(typeof tono, 'string');
      assert.ok(/^[a-z-]+$/.test(tono), `el tono "${tono}" parece un texto redactado y no una clave`);
      assert.equal(tono.includes(' '), false);
    }
    const oferta = ofrece({ nucleos: nucleoEn('nombradia'), mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida'), catalogo: CATALOGO });
    assert.ok(Object.values(TONOS_DE_RANGO).includes(oferta.tono));
  });

  test('Un ítem sin precio base declarado falla nombrando el ítem', () => {
    const sinPrecio = { id: 'lo-del-molino', tipo: 'saber', efecto: 'version-que-oyo', rumor: 'r1' };
    assert.throws(() => precioDe(sinPrecio, 'forasteria'), /"lo-del-molino"/);
    assert.throws(() => precioDe(sinPrecio, 'forasteria'), /precio base/);
    assert.throws(() => precioDe({ ...sinPrecio, precioBase: -1 }, 'forasteria'), /"lo-del-molino"/);
    // Y no vale cero por defecto, que es la degradación silenciosa que dejaría gratis
    // un catálogo incompleto.
    assert.throws(() => catalogoDelInformante([sinPrecio]), /"lo-del-molino"/);
  });
});

describe('El oro compra saber y favores, nunca metros', () => {
  test('No se puede pagar por no andar', () => {
    // El catálogo de tipos es cerrado, y son los dos que nombra el diseño.
    assert.deepEqual(TIPOS_DE_ITEM, ['saber', 'favor']);
    assert.deepEqual(IDS_DE_EFECTO_DE_COMPRA, ['algo-guardado', 'recado-llevado', 'version-que-oyo']);
    for (const efecto of IDS_DE_EFECTO_DE_COMPRA) {
      assert.ok(TIPOS_DE_ITEM.includes(EFECTOS_DE_COMPRA[efecto].tipo), `el efecto "${efecto}" es de un tipo que no está en el enumerado`);
    }

    // Y nada de lo que se ofrece reduce la distancia: ni el catálogo de referencia ni
    // ninguno que declare un campo que acorte el camino, porque no llega a existir.
    assert.deepEqual(loQueAcortaElCamino(CATALOGO), []);
    for (const campo of CAMPOS_QUE_ACORTAN) {
      const tramposo = { ...ITEM_DE_FAVOR, [campo]: 'lo que sea' };
      assert.deepEqual(loQueAcortaElCamino([tramposo]), [ITEM_DE_FAVOR.id]);
      assert.throws(() => exigeItem(tramposo), new RegExp(`"${campo}"`), `un ítem que declara "${campo}" se acepta`);
    }
    for (const prohibido of ['tramo', 'metros', 'grafo', 'criterios', 'beat']) {
      assert.ok(CAMPOS_QUE_ACORTAN.includes(prohibido), `la red no vigila "${prohibido}"`);
    }
    // Lo que una compra entrega no lleva nada de eso dentro.
    const oro = bolsaCon(20);
    const plan = planDeCompra({ oro, nucleos: nucleoEn('forasteria'), mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida'), catalogo: CATALOGO, item: ITEM_DE_FAVOR.id });
    assert.deepEqual(Object.keys(plan.entrega), ['efecto'], 'un favor entrega algo más que la constancia de que se hizo');
    for (const campo of [...CAMPOS_QUE_ACORTAN, 'siguienteBeat']) {
      assert.equal(JSON.stringify(plan).includes(`"${campo}"`), false, `lo que devuelve una compra lleva "${campo}"`);
    }
  });

  test('Un favor que devolviera un efecto sobre un beat se rechaza nombrando el favor', () => {
    const recado = { ...ITEM_DE_FAVOR, id: 'que-resuelvan-el-beat', beat: 3 };
    assert.throws(() => exigeItem(recado), /"que-resuelvan-el-beat"/);
    assert.throws(() => exigeItem(recado), /"beat"/);

    // Y el estado de la partida no cambia: el rechazo ocurre al validar el catálogo,
    // antes de cobrar nada.
    const oro = bolsaCon(30);
    const nucleos = nucleoEn('forasteria');
    assert.throws(() => compra({ oro, nucleos, mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida'), catalogo: [recado], item: recado.id }), /"que-resuelvan-el-beat"/);
    assert.equal(saldoDe(oro), 30, 'el favor rechazado ha cobrado');
  });

  test('Lo que compras es la versión que ese informante oyó', () => {
    // Un desenlace notable en «Monfrida» y la propagación de verdad: a «Cadaval» le
    // llega en nivel 2, que es exactamente el caso de la batería.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 10);

    const enElOrigen = oyeronEn(nucleos, 'Monfrida');
    const enCadaval = oyeronEn(nucleos, 'Cadaval');
    assert.equal(enCadaval.nivel, 2, 'el caso necesita un informante que recibió el rumor en nivel 2');
    assert.equal(enElOrigen.nivel, 0, 'en el origen tiene que estar la versión fiel');

    const oro = bolsaCon(30);
    const resultado = compra({
      oro,
      nucleos,
      mapaId: MAPA,
      mapa: MAPA_ACTIVO,
      informante: informanteDe('Cadaval'),
      catalogo: [ITEM_DE_SABER],
      item: ITEM_DE_SABER.id,
    });

    // Recibe la versión de nivel 2...
    assert.deepEqual(resultado.entrega.loQueOyo.hechos, enCadaval.hechos, 'lo que se compra no es lo que ese informante oyó');
    // ...y no la versión fiel.
    assert.notDeepEqual(resultado.entrega.loQueOyo.hechos, enElOrigen.hechos, 'pagar ha dado la verdad');
    // Y sin el nivel de deformación, que no sale nunca a pantalla.
    assert.equal(JSON.stringify(resultado).includes('"nivel"'), false, 'lo que devuelve una compra lleva el nivel de deformación');
    assert.deepEqual(Object.keys(resultado.entrega.loQueOyo).sort(), ['hechos', 'origen', 'plantilla', 'rumor', 'signo', 'texto']);
  });

  test('El testigo cuenta la fiel sin cobrar y el informante cobra la que le llegó', () => {
    const mundo = mundoDeMesa();
    const { capa } = capaSobre(mundo);
    const hechos = hechosFieles(semillaDeMesa(), { lugar: 'Ourela' });
    capa.cierraSalida({ desenlace: desenlaceDe({ hechos, caras: [LA_TABERNERA] }), n: 1 });

    // Al mismo núcleo de esa cara le llega el rumor deformado.
    const nucleos = estadoDeNucleos();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Vilanova', rumor: 'r1', nivel: 2, origen: 'Ourela' });
    const mapa = arbolDeCalzadas(mundo);

    const testigo = capa.consultaAlTestigo(LA_TABERNERA);
    assert.equal(testigo.gratis, true, 'al testigo se le paga');
    assert.deepEqual(testigo.coste, { oro: 0 });
    assert.equal(testigo.hechos[0].nivel, NIVEL_DEL_TESTIGO);
    assert.deepEqual(testigo.hechos[0].hechos, hechos, 'el testigo no cuenta la versión fiel');

    const oro = bolsaCon(30);
    const resultado = compra({ oro, nucleos, mapaId: MAPA, mapa, informante: informanteDe('Vilanova'), catalogo: [ITEM_DE_SABER], item: ITEM_DE_SABER.id });
    // En «Vilanova» ha llegado un rumor, así que el escalón es «nombradia» y el ítem
    // de precio base 7 cuesta 4: al informante se le paga, y al testigo no.
    assert.equal(resultado.pagado, 4, 'al informante no se le ha cobrado');
    assert.equal(saldoDe(oro), 26);
    assert.notDeepEqual(resultado.entrega.loQueOyo.hechos, hechos, 'el informante cuenta la fiel, que es lo del testigo');
  });

  test('Un informante que no ha oído nada no tiene nada que vender, y no es un error', () => {
    const oro = bolsaCon(30);
    const nucleos = nucleoEn('nombradia', { nucleo: 'Sanxil' });
    const resultado = compra({
      oro,
      nucleos,
      mapaId: MAPA,
      mapa: MAPA_ACTIVO,
      informante: informanteDe('Sanxil'),
      catalogo: [{ ...ITEM_DE_SABER, rumor: 'lo-que-nadie-oyo' }],
      item: ITEM_DE_SABER.id,
    });
    assert.equal(resultado.hayQueVender, false);
    assert.equal(resultado.entrega, null);
    assert.equal(resultado.pagado, 0);
    assert.equal(saldoDe(oro), 30, 'se ha cobrado por vender la ausencia');
  });

  test('El oro ficticio no toca dinero real', () => {
    // Las dos maneras de mover oro son ingresar lo que declara un desenlace y cobrar
    // una compra, y ninguna de las dos toca dinero de verdad.
    const codigo = LOS_CINCO_MODULOS.map((r) => codigoDe(fuente(r))).join('\n');
    for (const prohibido of ['euros', 'dineroReal', 'compraReal', 'precioReal', 'stripe', 'iap', 'checkout', 'paywall']) {
      assert.equal(codigo.includes(prohibido), false, `la capa del oro menciona "${prohibido}"`);
    }
    // Y ningún ítem manda a gastar en el negocio real del anclaje: declararlo es un
    // error, y el catálogo entero se revisa de una pasada.
    assert.deepEqual(loQueAcortaElCamino(CATALOGO), []);
    for (const campo of CAMPOS_DEL_MUNDO_REAL) {
      const tramposo = { ...ITEM_DE_SABER, [campo]: 'la tienda de la esquina' };
      assert.throws(() => exigeItem(tramposo), new RegExp(`"${campo}"`), `un ítem que declara "${campo}" se acepta`);
      assert.deepEqual(loQueAcortaElCamino([tramposo]), [ITEM_DE_SABER.id]);
    }
    for (const prohibido of ['anclaje', 'negocio', 'dinero', 'tienda']) {
      assert.ok(CAMPOS_DEL_MUNDO_REAL.includes(prohibido), `la red no vigila "${prohibido}"`);
    }
  });
});

describe('El oro: una cifra que se gasta, y nada más', () => {
  test('Una partida recién creada tiene la bolsa a cero, y cero no es un error', () => {
    const oro = estadoDeOro();
    assert.equal(saldoDe(oro), 0);
    assert.equal(typeof saldoDe(oro), 'number', 'el oro sí se enseña, al revés que el rango');
  });

  test('Un desenlace que declara oro sube la bolsa en lo declarado', () => {
    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    const cierre = cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1', oro: 12 }, dia: '2026-08-08' });
    assert.equal(cierre.oro, 12);
    assert.equal(cierre.saldo, 12);
    assert.equal(saldoDe(estado.oro), 12);

    cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd2', oro: 8 }, dia: '2026-08-09' });
    assert.equal(saldoDe(estado.oro), 20);
  });

  test('Un desenlace que no declara oro no mueve la bolsa', () => {
    const estado = { oro: bolsaCon(5), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    const cierre = cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1' }, dia: '2026-08-08' });
    assert.equal(cierre.oro, 0);
    assert.equal(saldoDe(estado.oro), 5);
  });

  test('Una compra más cara que la bolsa se rechaza nombrando lo que falta', () => {
    const oro = bolsaCon(3);
    const nucleos = nucleoEn('forasteria');
    const comprar = () => compra({ oro, nucleos, mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida'), catalogo: CATALOGO, item: ITEM_DE_FAVOR.id });
    assert.throws(comprar, /faltan 1 de oro/);
    assert.throws(comprar, /no se entrega nada/);
    assert.equal(saldoDe(oro), 3, 'la compra rechazada ha movido la bolsa');
  });

  test('Ninguna operación deja la bolsa por debajo de cero', () => {
    const oro = bolsaCon(2);
    assert.throws(() => cobra(oro, { precio: 3, quien: 'lo que sea' }), /faltan 1 de oro/);
    assert.equal(saldoDe(oro), 2);
    assert.throws(() => ingresa(oro, { oro: -5 }), /-5/, 'ingresar en negativo es restar por la puerta de atrás');
    assert.equal(saldoDe(oro), 2);
    // Y el saldo se valida al leerlo: una bolsa manipulada a mano no pasa.
    assert.throws(() => saldoDe({ saldo: -1 }), /saldo/);
    for (const nombre of Object.keys(moduloDeOro)) {
      if (typeof moduloDeOro[nombre] !== 'function') continue;
      assert.equal(/resta|descuenta|penaliza|multa/i.test(nombre), false, `"${nombre}" suena a una operación que resta sin comprobar`);
    }
  });

  test('No existe ninguna consulta del oro acumulado: solo el saldo', () => {
    const oro = bolsaCon(0);
    ingresa(oro, { oro: 10 });
    cobra(oro, { precio: 4, quien: 'una compra' });
    assert.equal(saldoDe(oro), 6);
    assert.deepEqual(Object.keys(congelaOro(oro)), ['saldo'], 'el documento de la bolsa guarda algo más que el saldo');

    for (const nombre of Object.keys(moduloDeOro)) {
      assert.equal(/acumulad|historic|histórico|ganado|gastado|total/i.test(nombre), false, `"${nombre}" es un acumulado histórico y eso es un marcador de progreso`);
    }
    const codigo = codigoDe(fuente('packages/nucleo/partida/oro.js'));
    for (const delator of ['acumulado', 'historico', 'ganadoTotal', 'gastadoTotal', 'tope']) {
      assert.equal(codigo.includes(delator), false, `oro.js lleva un "${delator}"`);
    }
  });

  test('El oro se gasta en una compra y nunca en un paso del mundo', () => {
    // Esta capa no está en la cola de productores: no declara identidad de productor
    // ni sabe producir, así que no hay por dónde metérsela al motor.
    for (const ruta of LOS_CINCO_MODULOS) {
      const codigo = codigoDe(fuente(ruta));
      assert.equal(codigo.includes('ID_DEL_PRODUCTOR'), false, `${ruta} se declara productor de paso`);
      assert.equal(/\bproduce\s*\(/.test(codigo), false, `${ruta} sabe producir un paso`);
    }
    assert.equal(codigoDe(fuente('packages/nucleo/partida/rumores.js')).includes('ID_DEL_PRODUCTOR'), true, 'la propagación ya no declara identidad de productor y la comparación deja de significar nada');

    // Y el mundo avanza de verdad cien pasos, con la propagación colgada del motor:
    // la bolsa no se mueve.
    const oro = bolsaCon(40);
    const rumores = estadoDeRumores();
    const nucleos = estadoDeNucleos();
    const arbol = arbolDeCalzadas(mundoLineal(CADENA));
    const prop = creaPropagacionDeRumores({ semilla: SEMILLA_A, mapaId: MAPA, arbol, estado: rumores, nucleos, tramo: 2000 });
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [prop] });
    prop.nace(desenlaceEn('Monfrida'), 0);
    for (let n = 1; n <= 100; n++) motor.paso(n);
    assert.equal(saldoDe(oro), 40, 'cien pasos del mundo han movido la bolsa');
  });

  test('La bolsa es una por partida y se consulta igual desde los dos mapas', () => {
    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1', oro: 20 }, dia: '2026-08-08' });
    cierraSalidaDeProgresion({ ...estado, mapaId: OTRO_MAPA, desenlace: { id: 'd2', oro: 10 }, dia: '2026-08-09' });

    assert.equal(saldoDe(estado.oro), 30, 'el oro es lo que se lleva encima y no lo que un sitio piensa de ti');
    // No hay ninguna bolsa por mapa que consultar: la bolsa no sabe de mapas.
    assert.deepEqual(Object.keys(estado.oro), ['saldo']);
    assert.equal(codigoDe(fuente('packages/nucleo/partida/oro.js')).includes('mapas'), false, 'la bolsa se guarda por mapa');
  });
});

describe('Vacíos, entradas inválidas y errores del oro', () => {
  test('Un ítem que no está en el catálogo falla nombrando el ítem', () => {
    const oro = bolsaCon(30);
    const nucleos = nucleoEn('forasteria');
    assert.throws(
      () => compra({ oro, nucleos, mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida'), catalogo: CATALOGO, item: 'lo-del-molino' }),
      /"lo-del-molino"/,
    );
    assert.equal(saldoDe(oro), 30);
  });

  test('Un efecto de compra fuera del catálogo cerrado falla nombrando el tipo', () => {
    assert.throws(() => exigeEfectoDeCompra('teletransporte'), /"teletransporte"/);
    assert.throws(() => exigeItem({ ...ITEM_DE_SABER, efecto: 'teletransporte' }), /"teletransporte"/);
    // Y un efecto declarado de un tipo que no le corresponde tampoco pasa.
    assert.throws(() => exigeItem({ ...ITEM_DE_FAVOR, efecto: 'version-que-oyo' }), /version-que-oyo/);
  });

  test('Un informante de otro mapa falla nombrando el mapa', () => {
    const oro = bolsaCon(30);
    const nucleos = nucleoEn('forasteria');
    assert.throws(
      () => compra({ oro, nucleos, mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida', OTRO_MAPA), catalogo: CATALOGO, item: ITEM_DE_SABER.id }),
      new RegExp(OTRO_MAPA),
    );
    assert.equal(saldoDe(oro), 30);
  });

  test('Un desenlace con oro negativo o no entero falla nombrando el valor recibido', () => {
    for (const malo of [-3, 1.5, '5', true]) {
      const estado = { oro: bolsaCon(7), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
      assert.throws(
        () => cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1', oro: malo }, dia: '2026-08-08' }),
        new RegExp(JSON.stringify(malo) ?? String(malo)),
        `un desenlace con oro ${JSON.stringify(malo)} se acepta`,
      );
      assert.equal(saldoDe(estado.oro), 7);
    }
  });

  test('Un cierre de salida que falla a mitad no deja ni bolsa ni objetos tocados', () => {
    const estado = { oro: bolsaCon(5), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    const desenlace = {
      id: 'd1',
      oro: 9,
      objetos: [
        { id: 'hebilla-de-laton', clase: 'recuerdo' },
        { id: 'llave-del-molino' }, // sin clase declarada: falla, y falla después del oro
      ],
    };
    assert.throws(() => cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace, dia: '2026-08-08' }), /"llave-del-molino"/);
    assert.equal(saldoDe(estado.oro), 5, 'el oro se ingresó y el cierre falló después');
    assert.deepEqual(objetosDe(estado.objetos), [], 'un objeto entró antes de que fallara el siguiente');
  });

  test('Una compra que falla a mitad no cobra nada y no entrega nada', () => {
    // El informante tiene algo que vender —«Monfrida» ha oído el rumor «r1»— y la
    // bolsa no llega: se calcula entero y se rechaza antes de escribir nada.
    const oro = bolsaCon(2);
    const nucleos = nucleoEn('nombradia');
    let entregado = null;
    try {
      entregado = compra({ oro, nucleos, mapaId: MAPA, mapa: MAPA_ACTIVO, informante: informanteDe('Monfrida'), catalogo: CATALOGO, item: ITEM_DE_SABER.id });
    } catch (e) {
      assert.match(e.message, /faltan 2 de oro/);
    }
    assert.equal(entregado, null, 'la compra fallida ha entregado algo');
    assert.equal(saldoDe(oro), 2, 'la compra fallida ha cobrado');
  });
});

describe('Lo generado no se resiembra jamás', () => {
  test('Ganar oro, comprar saber y guardar objetos deja el documento de la celda idéntico byte a byte', async () => {
    const { registro, arbol } = await mundoReal(CELDA_COSIDA);
    const antes = textoDeCelda(registro);

    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    const nucleos = estadoDeNucleos();
    const nucleo = arbol.nucleos[0];
    oye(nucleos, { mapaId: MAPA, nucleo, rumor: 'r1', nivel: 1, origen: nucleo });

    cierraSalidaDeProgresion({
      ...estado,
      mapaId: MAPA,
      desenlace: { id: 'd1', oro: 25, objetos: [{ id: 'hebilla-de-laton', clase: 'llave' }], mote: 'la-del-paquete' },
      rumor: 'r1',
      dia: '2026-08-08',
    });
    compra({ oro: estado.oro, nucleos, mapaId: MAPA, mapa: arbol, informante: informanteDe(nucleo), catalogo: [ITEM_DE_SABER], item: ITEM_DE_SABER.id });

    assert.equal(saldoDe(estado.oro), 21, 'el caso no ha ganado ni gastado oro y no afirma nada');
    assert.equal(objetosDe(estado.objetos).length, 1);
    assert.equal(textoDeCelda(registro), antes, 'ganar oro, comprar o guardar un objeto ha repintado el mundo congelado');
  });
});

