// SPEC-025 · Las ilustraciones de ficción y las fotos del lado real: quién pide qué,
//            cuándo, con qué presupuesto y qué pasa cuando no hay nada.
//
// Lo que se afirma aquí son cuatro cosas y ninguna es de dibujo:
//
// 1. **El momento.** Las fotos salen en un único lote al terminar de generar la celda
//    y nunca por aventura; las ilustraciones, en un único lote al preparar la salida.
//    Por eso lo que se cuenta es el **número de llamadas** y no el de peticiones: una
//    petición por beat y un lote por salida se parecen mucho si solo se cuentan
//    peticiones.
// 2. **Lo que sale del móvil.** El prompt de ficción se construye sin red y se criba
//    contra los datos reales del mundo. La afirmación de privacidad viene siempre con
//    su caso rojo al lado —el nombre de fantasía puesto igual al del anclaje—, porque
//    un criterio que se cumple por construcción no mide nada.
// 3. **La degradación silenciosa hacia quien juega, y la ruidosa hacia quien cablea.**
//    Sin cobertura no se consigue nada, nada lanza y nada se llama fallo; sin cliente o
//    sin almacén, la construcción falla nombrando la pieza (§6h).
// 4. **El vocabulario cerrado de la ausencia.** Cinco motivos, contados por separado:
//    con un solo estado, «Places no tiene foto» y «nadie cableó el cliente» serían
//    indistinguibles.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales, y sostienen
// la mitad de esta fila —los otros interesados están anotados en el mapa—. Los demás van
// marcados como hueco en test/spec-test-map.json: la batería no tiene característica
// propia para el lote de ilustraciones, el presupuesto de la preparación, el interruptor
// de Places ni el cableado ausente.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema: los mundos salen de
// test/fixtures/osm/, la espera se inyecta y la fecha de captura viene de un reloj fijo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CAMPOS_DE_PETICION_DE_FOTO,
  CAMPOS_DE_PETICION_DE_IMAGEN,
  CLAVES_DE_AUSENCIA,
  ESTADOS,
  FAMILIAS_DE_AUSENCIA,
  FORMATO_DE_ILUSTRACION,
  MOTIVOS_DE_AUSENCIA,
  PLACES_ACTIVO,
  PRESUPUESTO_FOTOS_MAPA_MS,
  PRESUPUESTO_PREPARACION_MS,
  PUNTO_DE_ILUSTRACION,
  TOPE_ILUSTRACIONES_SALIDA,
  anclajesConsumidos,
  claveDeElemento,
  claveDeIlustracion,
  claveDeTextoDeBeat,
  cuentaAusencias,
  declaraAusencia,
  declaraFoto,
  declaraIlustracion,
  declaraTexto,
  elementosIlustrables,
  exigeMotivoDeAusencia,
  exigeResidentes,
  fichaDeIlustracion,
  lugaresParaIlustrar,
  peticionDeFoto,
  peticionDeImagen,
  planDeIlustraciones,
  promptDeIlustracion,
  queFaltaParaJugarSinRed,
  recursosVacios,
  sitiosParaFotografiar,
} from '../../packages/nucleo/partida/recursos.js';
import { datosRealesDeMundo } from '../../packages/nucleo/quests/prompt.js';
import { congelaCelda, levantaCelda, textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { repartoDeAventuras } from '../../packages/nucleo/partida/aventuras.js';
import { declaraTramo } from '../../packages/nucleo/partida/tramo.js';
import { construyePool } from '../../packages/nucleo/world/anclajes.js';
import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { ESQUEMAS as ESQUEMAS_DEL_PROXY } from '../../server/proxy.mjs';
import { TOPE_PAGO_LOTE_MAPA, creaConseguidorDeRecursos } from '../../app/recursos/conseguidor.js';

import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { mundoCongelado } from '../dobles/mundo-congelado.mjs';
import {
  NUNCA_VENCE,
  VENCE_YA,
  creaAlmacenDeRecursos,
  creaClienteDeFotos,
  creaClienteDeImagenes,
  paredContada,
} from '../dobles/recursos.mjs';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { celdaDeFixture, placesDePrueba, rejillaDe, textosDe } from './partida-de-prueba.mjs';
import { LOS_CUATRO, LAS_DOS_SEMILLAS, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { SEMILLA_A, consultaDeFixture, coordenadaDe } from './celda-de-prueba.mjs';

/** El reloj de la fecha de captura. Fijo, para que el documento siga comparándose byte a byte. */
const RELOJ = () => '2026-08-07';

/** Un lugar de reparto, con la forma que le da el casting: `tipo`, `nombre` y su ficha real. */
const lugar = (tipo, nombre, placeId = null) => ({ tipo, nombre, ...(placeId ? { real: { placeId } } : {}) });

/** Una aventura sintética: un beat por lugar, en el orden en que se pasan. */
const aventuraDe = (lugares, plantilla = 'entrega-sospechosa') => ({
  plantilla,
  beats: lugares.map((l, i) => ({ n: i + 1, lugar: l })),
});

/** Un mundo vacío de ficción: lo justo para que un plan sintético se pueda componer. */
const MUNDO_SIN_FICCION = { settlements: [], parajes: [] };

/** El conseguidor con las tres piezas cableadas, y lo que cada prueba quiera cambiar. */
function montaConseguidor({
  imagenes = creaClienteDeImagenes(),
  fotos = creaClienteDeFotos(),
  almacen = creaAlmacenDeRecursos(),
  espera = NUNCA_VENCE,
  topePorLote,
} = {}) {
  const conseguidor = creaConseguidorDeRecursos({
    clienteDeImagenes: imagenes,
    clienteDeFotos: fotos,
    almacen,
    presupuestoIlustracionesMs: PRESUPUESTO_PREPARACION_MS,
    presupuestoFotosMs: PRESUPUESTO_FOTOS_MAPA_MS,
    espera,
    ...(topePorLote ? { topePorLote } : {}),
  });
  return { conseguidor, imagenes, fotos, almacen };
}

/** Los motivos de una lista de ausencias, contados. */
const porMotivo = (ausencias) => ausencias.reduce((a, x) => ({ ...a, [x.motivo]: (a[x.motivo] ?? 0) + 1 }), {});

/** Los ocho mundos de referencia: los cuatro congelados por sus dos semillas. */
async function losOchoMundos() {
  const out = [];
  for (const nombre of LOS_CUATRO) {
    for (const s of LAS_DOS_SEMILLAS) {
      out.push({ nombre, semilla: s, mundo: await generaMundo(nombre, semillaDe(nombre, s)) });
    }
  }
  return out;
}

describe('El prompt de ficción: lo único que sale del móvil', () => {
  test('El prompt de una ilustración se construye sin abrir ninguna conexión', async () => {
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const prompts = elementosIlustrables(mundo).map((e) => promptDeIlustracion({
        elemento: e,
        locale: mundo.locale,
        datosReales: datosRealesDeMundo(mundo),
      }));
      assert.ok(prompts.length > 0, 'este mundo no tiene ni un elemento ilustrable: el caso no comprueba nada');
      assert.deepEqual(inspector.peticiones(), [], 'construir un prompt ha sacado tráfico del móvil');
    } finally {
      inspector.suelta();
    }
  });

  test('El prompt del LLM no lleva ningún dato real', async () => {
    // La mitad que sostiene esta fila es la del prompt **de imagen**: el de texto es de
    // SPEC-018 y ya está afirmado allí. Se criba sobre los ocho mundos de referencia,
    // que es donde el escenario dice «ninguna coordenada, dirección ni identificador».
    let cribados = 0;
    let datos = 0;
    for (const { nombre, semilla, mundo } of await losOchoMundos()) {
      const reales = datosRealesDeMundo(mundo);
      datos += reales.length;
      for (const elemento of elementosIlustrables(mundo)) {
        const { texto } = promptDeIlustracion({ elemento, locale: mundo.locale, datosReales: reales });
        cribados += 1;
        for (const real of reales) {
          assert.equal(texto.includes(real.dato), false,
            `el prompt de "${elemento.name ?? elemento.nombre}" en ${nombre}#${semilla} lleva dentro ${real.de}: "${real.dato}"`);
        }
        assert.equal(/\d+\.\d{3,}/.test(texto), false, `el prompt de ${nombre}#${semilla} lleva algo con forma de coordenada`);
        assert.equal(/\b(node|way|relation)\/\d+/.test(texto), false, `el prompt de ${nombre}#${semilla} lleva un identificador de OSM`);
        assert.equal(/ChIJ|place_id/.test(texto), false, `el prompt de ${nombre}#${semilla} lleva un place_id`);
      }
    }
    assert.ok(cribados >= 8, `solo se cribaron ${cribados} prompts: el caso no comprueba lo bastante`);
    assert.ok(datos > 0, 'no había ni un dato real contra el que cribar: el caso no comprueba nada');
  });

  test('Un nombre de fantasía que coincide con el del anclaje hace fallar la construcción', async () => {
    // El caso rojo de la afirmación anterior. Sin él, «el prompt no lleva el nombre real»
    // podría estar cumpliéndose porque nadie mira, y no porque alguien criba.
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const reales = datosRealesDeMundo(mundo);
    const real = reales.find((d) => d.de.includes('nombre real') && d.dato.length >= 5);
    assert.ok(real, 'ningún anclaje de este mundo trae nombre real: el caso no comprueba nada');

    assert.throws(
      () => promptDeIlustracion({ elemento: { type: 'ruina', name: real.dato }, locale: mundo.locale, datosReales: reales }),
      (e) => e.message.includes(real.dato),
      'un nombre de fantasía igual al del anclaje real ha construido un prompt sin protestar',
    );
  });

  test('Dos elementos de un mundo nunca comparten prompt', async () => {
    const registro = await celdaDeFixture('urbano-denso');
    const mundo = registro.mundo;
    const reales = datosRealesDeMundo(mundo);
    const vistos = new Map();
    for (const elemento of elementosIlustrables(mundo)) {
      const { texto, clave } = promptDeIlustracion({ elemento, locale: mundo.locale, datosReales: reales });
      const antes = vistos.get(texto);
      assert.equal(antes, undefined, `"${elemento.name}" y "${antes}" comparten prompt, así que compartirían ilustración`);
      vistos.set(texto, elemento.name);
      assert.equal(clave, claveDeIlustracion(texto), 'la clave de caché no se deriva del prompt');
    }
    assert.ok(vistos.size > 1, 'este mundo tiene un solo elemento ilustrable: el caso no comprueba nada');
  });

  test('El mismo mundo con la misma semilla da el mismo prompt y la misma clave de caché', async () => {
    const a = await generaMundo('costero', semillaDe('costero', '1'));
    const b = await generaMundo('costero', semillaDe('costero', '1'));
    const realesA = datosRealesDeMundo(a);
    const realesB = datosRealesDeMundo(b);
    const elementosA = elementosIlustrables(a);
    const elementosB = elementosIlustrables(b);
    assert.equal(elementosA.length, elementosB.length, 'dos generaciones con la misma semilla dan mundos con distinto número de elementos');
    for (let i = 0; i < elementosA.length; i++) {
      const pa = promptDeIlustracion({ elemento: elementosA[i], locale: a.locale, datosReales: realesA });
      const pb = promptDeIlustracion({ elemento: elementosB[i], locale: b.locale, datosReales: realesB });
      assert.equal(pa.texto, pb.texto, `el prompt de "${elementosA[i].name}" cambia entre dos generaciones de la misma semilla`);
      assert.equal(pa.clave, pb.clave, `la clave de caché de "${elementosA[i].name}" cambia entre dos generaciones de la misma semilla`);
    }
  });

  test('Un elemento sin nombre de fantasía falla nombrando el elemento y no devuelve un prompt genérico', () => {
    assert.throws(
      () => fichaDeIlustracion({ type: 'ruina' }),
      (e) => e.message.includes('ruina') && /nombre/.test(e.message),
      'un elemento sin nombre ha producido ficha en vez de protestar',
    );
    assert.throws(
      () => promptDeIlustracion({ elemento: { type: 'ruina', name: '   ' }, locale: 'gl' }),
      /nombre/,
      'un nombre en blanco ha producido un prompt genérico',
    );
    assert.throws(
      () => promptDeIlustracion({ elemento: { name: 'A Torre Rota' }, locale: 'gl' }),
      (e) => e.message.includes('A Torre Rota'),
      'un elemento sin tipo ha producido un prompt sin protestar',
    );
  });

  test('El idioma del mundo es parte del prompt', () => {
    const elemento = { type: 'ruina', name: 'A Torre Rota', scenes: { guarida: 3 }, label: 'Ruina' };
    const gl = promptDeIlustracion({ elemento, locale: 'gl' });
    const es = promptDeIlustracion({ elemento, locale: 'es' });
    assert.notEqual(gl.texto, es.texto, 'el mismo elemento en gallego y en castellano da el mismo prompt');
    assert.notEqual(gl.clave, es.clave, 'dos prompts distintos comparten clave de caché');
    assert.throws(() => promptDeIlustracion({ elemento }), /idioma|locale/, 'un prompt sin idioma se ha construido igual');
  });

  test('El sobre de la petición de imagen lleva el prompt y el formato, y ningún campo más', () => {
    const { texto } = promptDeIlustracion({ elemento: { type: 'ruina', name: 'A Torre Rota' }, locale: 'gl' });
    const peticion = peticionDeImagen({ prompt: texto });
    assert.deepEqual(Object.keys(peticion).sort(), [...CAMPOS_DE_PETICION_DE_IMAGEN].sort());
    assert.deepEqual(peticion.formato, FORMATO_DE_ILUSTRACION);
    assert.equal(peticion.prompt, texto);
    // La copia declarada en el núcleo y el esquema cerrado del proxy tienen que decir lo
    // mismo: el paquete no puede importar el servidor, así que este caso es lo único que
    // se pone rojo el día que una de las dos listas se mueva sin la otra.
    assert.deepEqual([...CAMPOS_DE_PETICION_DE_IMAGEN].sort(), [...ESQUEMAS_DEL_PROXY.imagen].sort());
    assert.deepEqual([...CAMPOS_DE_PETICION_DE_FOTO].sort(), [...ESQUEMAS_DEL_PROXY.places].sort());
    assert.equal(PUNTO_DE_ILUSTRACION, 'ilustrar-lugar');
    assert.throws(() => peticionDeImagen({ prompt: '' }), /prompt/, 'una petición de imagen sin prompt se ha construido igual');
  });
});

describe('El lote de fotos al crear el mapa, y nunca más', () => {
  test('Al terminar la generación se pide un único lote con los place_id de los anclajes consumidos', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    assert.ok(plan.lote.length > 0, 'ningún anclaje de Places acabó siendo algo: el caso no comprueba nada');

    const { conseguidor, fotos } = montaConseguidor();
    const resultado = await conseguidor.fotosDeCelda(plan);
    assert.equal(fotos.llamadas(), 1, `el lote de fotos salió en ${fotos.llamadas()} llamadas y no en una`);
    assert.equal(fotos.peticiones().length, plan.lote.length, 'el lote no llevó dentro todas las peticiones');
    assert.equal(resultado.llamadas, 1);
    assert.equal(resultado.conseguidos.length, plan.lote.length);
    for (const c of resultado.conseguidos) {
      assert.equal(typeof c.recurso, 'string', 'una foto conseguida vuelve sin referencia local');
      assert.equal(typeof c.atribucion, 'string', 'una foto conseguida vuelve sin su atribución');
    }
  });

  test('Cada petición de foto lleva un place_id y ningún campo más', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    const { conseguidor, fotos } = montaConseguidor();
    await conseguidor.fotosDeCelda(plan);
    assert.ok(fotos.peticiones().length > 0, 'no salió ninguna petición: el caso no comprueba nada');
    for (const p of fotos.peticiones()) {
      assert.deepEqual(Object.keys(p).sort(), [...CAMPOS_DE_PETICION_DE_FOTO].sort(), `una petición de foto lleva campos de más: ${JSON.stringify(p)}`);
      assert.equal(typeof p.place_id, 'string');
    }
    assert.deepEqual(peticionDeFoto({ placeId: 'ChIJ-A' }), { place_id: 'ChIJ-A' });
    assert.throws(() => peticionDeFoto({ placeId: null }), /place_id/, 'una petición de foto sin place_id se ha construido igual');
  });

  test('Un anclaje que se quedó en el pool sin llegar a ser nada no entra en el lote', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const mundo = registro.mundo;
    const plan = sitiosParaFotografiar({ mundo });
    const consumidos = new Set(anclajesConsumidos(mundo).map((a) => a.ficha?.placeId).filter(Boolean));
    const enElPool = (mundo.pool?.anclajes ?? []).map((a) => a.placeId ?? a.ficha?.placeId ?? null).filter(Boolean);
    const sobrantes = enElPool.filter((id) => !consumidos.has(id));
    for (const id of sobrantes) {
      assert.equal(plan.lote.some((l) => l.placeId === id), false, `el place_id "${id}" se quedó en el pool y aun así se le pidió foto`);
    }
    for (const entrada of plan.lote) {
      assert.equal(consumidos.has(entrada.placeId), true, `se pide foto de "${entrada.placeId}", que no acabó siendo núcleo, servicio ni paraje`);
    }
  });

  test('Las fotos de Places se piden al crear el mapa', async () => {
    // El escenario entero, con el lote del mapa delante: se pide una vez al terminar de
    // generar y ni una más en toda la semana de aventuras que viene detrás.
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const mundo = registro.mundo;
    const plan = sitiosParaFotografiar({ mundo });
    const { conseguidor, fotos, imagenes } = montaConseguidor();

    const delMapa = await conseguidor.fotosDeCelda(plan);
    assert.equal(fotos.llamadas(), 1, 'el lote de fotos del mapa no salió en una sola llamada');

    // Lo conseguido queda residente, que es lo que hace que la semana siguiente no
    // necesite ni una petición más.
    const recursos = recursosVacios();
    for (const c of delMapa.conseguidos) {
      recursos.fotos.push(declaraFoto({ anclaje: c.clave, placeId: c.placeId, recurso: c.recurso, reloj: RELOJ }));
    }

    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (let salida = 1; salida <= 5; salida++) {
        const aventura = aventuraDe([lugar('paraje', `Paraje ${salida}`, delMapa.conseguidos[0]?.placeId ?? 'ChIJ-A')]);
        const planIl = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: mundo.locale, recursos, datosReales: [] });
        await conseguidor.ilustracionesDeSalida(planIl);
        // Y lo que la aventura necesita del lado real ya está en el dispositivo.
        const falta = queFaltaParaJugarSinRed({ aventura, recursos });
        assert.equal(falta.faltan.some((f) => f.familia === 'foto'), false, `la salida ${salida} necesita una foto que no está en el dispositivo`);
      }
      assert.equal(fotos.llamadas(), 1, `aceptar cinco aventuras pidió ${fotos.llamadas() - 1} lotes de fotos de más`);
      assert.equal(imagenes.llamadas(), 5, 'las ilustraciones no salieron en un lote por salida');
      assert.deepEqual(inspector.peticiones(), [], 'la semana de aventuras sacó tráfico sin envolver del móvil');
    } finally {
      inspector.suelta();
    }
  });

  test('Una foto ya residente no se vuelve a pedir', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const mundo = registro.mundo;
    const primera = sitiosParaFotografiar({ mundo });
    const recursos = recursosVacios();
    for (const entrada of primera.lote) {
      recursos.fotos.push(declaraFoto({ anclaje: entrada.clave, placeId: entrada.placeId, recurso: `local/fotos/${entrada.placeId}.webp`, reloj: RELOJ }));
    }
    const segunda = sitiosParaFotografiar({ mundo, recursos });
    assert.deepEqual(segunda.lote, [], 'con todas las fotos residentes se vuelve a componer un lote');

    const { conseguidor, fotos } = montaConseguidor();
    const resultado = await conseguidor.fotosDeCelda(segunda);
    assert.equal(fotos.llamadas(), 0, 'un lote vacío llegó a salir del móvil');
    assert.equal(resultado.llamadas, 0);
  });

  test('El documento guarda el place_id, la referencia local y la fecha de captura, y ninguna URL de Places', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    const { conseguidor } = montaConseguidor();
    const resultado = await conseguidor.fotosDeCelda(plan);
    assert.ok(resultado.conseguidos.length > 0, 'no se consiguió ninguna foto: el caso no comprueba nada');

    const recursos = recursosVacios();
    for (const c of resultado.conseguidos) {
      recursos.fotos.push(declaraFoto({ anclaje: c.clave, placeId: c.placeId, recurso: c.recurso, reloj: RELOJ }));
    }
    const doc = congelaCelda(registro, { recursos });
    for (const foto of doc.recursos.fotos) {
      assert.deepEqual(Object.keys(foto).sort(), ['anclaje', 'capturadaEn', 'estado', 'placeId', 'recurso']);
      assert.equal(foto.capturadaEn, '2026-08-07', 'la fecha de captura no salió del reloj inyectado');
      assert.equal(foto.estado, ESTADOS.RESIDENTE);
    }
    const escrito = textoDeCelda(registro, { recursos });
    assert.equal(/https?:\/\//.test(escrito), false, 'el documento guarda una URL, y las de Places caducan');
    assert.equal(/googleapis|maps\.google/.test(escrito), false, 'el documento guarda un enlace a Places');
    assert.equal(/datos_base64|data:image/.test(escrito), false, 'el binario de una foto se ha colado dentro del documento');
  });

  test('Un anclaje de OSM sin place_id queda ausente con el motivo «sin sitio de Places»', async () => {
    const registro = await celdaDeFixture('costero');
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    assert.deepEqual(plan.lote, [], 'un mundo sin ninguna entrada de Places compuso lote de fotos');
    assert.ok(plan.ausentes.length > 0, 'un mundo entero de anclajes de OSM no declaró ni una ausencia');
    assert.deepEqual(porMotivo(plan.ausentes), { [MOTIVOS_DE_AUSENCIA.SIN_SITIO]: plan.ausentes.length });
    for (const a of plan.ausentes) {
      assert.equal(a.familia, 'foto');
      assert.equal(a.estado, ESTADOS.AUSENTE);
    }
  });

  test('Una celda vecina pide su propio lote y no vuelve a pedir las de la celda ya generada', async () => {
    const propia = { settlements: [], parajes: [{ name: 'A Torre Rota', type: 'ruina', real: { placeId: 'ChIJ-A' } }] };
    const vecina = {
      settlements: [],
      parajes: [
        { name: 'A Torre Rota', type: 'ruina', real: { placeId: 'ChIJ-A' } },
        { name: 'O Muíño Xordo', type: 'ruina', real: { placeId: 'ChIJ-C' } },
      ],
    };
    const { conseguidor, fotos } = montaConseguidor();
    const deLaPropia = await conseguidor.fotosDeCelda(sitiosParaFotografiar({ mundo: propia }));
    const recursos = recursosVacios();
    for (const c of deLaPropia.conseguidos) {
      recursos.fotos.push(declaraFoto({ anclaje: c.clave, placeId: c.placeId, recurso: c.recurso, reloj: RELOJ }));
    }
    const planVecina = sitiosParaFotografiar({ mundo: vecina, recursos });
    assert.deepEqual(planVecina.lote.map((l) => l.placeId), ['ChIJ-C'], 'la celda vecina volvió a pedir una foto que ya estaba');

    await conseguidor.fotosDeCelda(planVecina);
    assert.equal(fotos.llamadas(), 2, 'cada celda pide su propio lote y ni uno más');
    assert.deepEqual(fotos.lotes()[1].map((p) => p.place_id), ['ChIJ-C']);
  });

  test('La cobertura de fotos queda declarada mundo a mundo y ninguno la promete donde no la tiene', async () => {
    const cobertura = [];
    for (const nombre of LOS_CUATRO) {
      const registro = await celdaDeFixture(nombre);
      const mundo = registro.mundo;
      const consumidos = anclajesConsumidos(mundo);
      const plan = sitiosParaFotografiar({ mundo });
      cobertura.push({ nombre, consumidos: consumidos.length, lote: plan.lote.length, ausentes: plan.ausentes.length, motivos: porMotivo(plan.ausentes) });
      // La cuenta cuadra sin restos: cada anclaje consumido acaba en el lote o en una
      // ausencia con motivo. Un anclaje que no esté en ninguno de los dos sitios es
      // exactamente la cobertura prometida donde no la hay.
      assert.equal(plan.lote.length + plan.ausentes.length, consumidos.length,
        `en ${nombre} hay ${consumidos.length} anclajes consumidos y solo ${plan.lote.length + plan.ausentes.length} declarados`);
      for (const a of plan.ausentes) assert.ok(CLAVES_DE_AUSENCIA.includes(a.motivo), `${nombre} declara una ausencia sin motivo del catálogo`);
    }
    assert.equal(cobertura.length, LOS_CUATRO.length);
    assert.ok(cobertura.some((c) => c.consumidos > 0), 'ningún mundo de referencia consumió anclajes: la medida no dice nada');
  });
});

describe('El lote de ilustraciones al preparar la salida', () => {
  test('La preparación pide un único lote con los lugares que no están residentes', async () => {
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const reparto = repartoDeAventuras({ mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
    const aventura = reparto.aventuras.find((a) => a.cabe) ?? reparto.aventuras[0];
    const plan = planDeIlustraciones({ aventura, mundo, locale: mundo.locale });
    assert.ok(plan.lote.length > 0, 'la aventura no necesita ninguna ilustración: el caso no comprueba nada');

    const { conseguidor, imagenes } = montaConseguidor();
    const resultado = await conseguidor.ilustracionesDeSalida(plan);
    assert.equal(imagenes.llamadas(), 1, `el lote de ilustraciones salió en ${imagenes.llamadas()} llamadas y no en una`);
    assert.equal(imagenes.peticiones().length, plan.lote.length);
    assert.equal(resultado.conseguidos.length, plan.lote.length);
    for (const c of resultado.conseguidos) {
      assert.equal(typeof c.recurso, 'string', 'una ilustración conseguida vuelve sin referencia local');
      assert.equal(c.claveDeCache, claveDeIlustracion(c.prompt), 'la clave con la que se guarda no se deriva del prompt');
    }
  });

  test('Cuatro lugares distintos componen cuatro peticiones y no una por beat', () => {
    const lugares = ['A Torre Rota', 'O Muíño Xordo', 'Vilamar', 'A Fonte Vella'];
    const beats = [...lugares, ...lugares].map((n, i) => lugar(i % 2 === 0 ? 'paraje' : 'nucleo', n));
    // Ocho beats, cuatro lugares: el mismo lugar repetido no se pide dos veces.
    const aventura = aventuraDe(beats.map((b, i) => lugar('paraje', lugares[i % lugares.length])));
    assert.equal(aventura.beats.length, 8);
    const plan = lugaresParaIlustrar({ aventura });
    assert.equal(plan.lote.length, 4, `el lote llevó ${plan.lote.length} peticiones para cuatro lugares distintos`);
    assert.deepEqual(plan.lote.map((l) => l.nombre), lugares, 'el lote no va en orden de aparición');
    assert.deepEqual(plan.ausentes, []);
  });

  test('El reparto que se pasa del tope entra hasta el tope y lo demás queda ausente', () => {
    const nombres = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete'];
    const aventura = aventuraDe(nombres.map((n) => lugar('paraje', n)));
    const plan = lugaresParaIlustrar({ aventura });
    assert.equal(TOPE_ILUSTRACIONES_SALIDA, 5, 'el tope declarado ya no es el de RF-BUCLE-003');
    assert.equal(plan.tope, TOPE_ILUSTRACIONES_SALIDA);
    assert.deepEqual(plan.lote.map((l) => l.nombre), nombres.slice(0, 5), 'no entraron los primeros por orden de aparición');
    assert.deepEqual(porMotivo(plan.ausentes), { [MOTIVOS_DE_AUSENCIA.TOPE]: 2 });
    assert.throws(() => lugaresParaIlustrar({ aventura, tope: 0 }), /tope/, 'un tope de cero se ha aceptado');
  });

  test('Un reparto entero residente no pide ninguna ilustración y la preparación se cierra igual', async () => {
    const nombres = ['Uno', 'Dos', 'Tres'];
    const aventura = aventuraDe(nombres.map((n) => lugar('paraje', n)));
    const recursos = recursosVacios();
    for (const n of nombres) {
      recursos.ilustraciones.push(declaraIlustracion({
        elemento: claveDeElemento('paraje', n),
        prompt: `una ruina llamada ${n}`,
        recurso: `local/il/${n}.webp`,
      }));
    }
    const plan = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', recursos, datosReales: [] });
    assert.deepEqual(plan.lote, [], 'con el reparto entero residente se compuso lote igual');

    const { conseguidor, imagenes } = montaConseguidor();
    const resultado = await conseguidor.ilustracionesDeSalida(plan);
    assert.equal(imagenes.llamadas(), 0, 'una preparación sin nada que pedir llamó al proveedor');
    assert.deepEqual(resultado.conseguidos, []);
    assert.deepEqual(resultado.ausentes, [], 'no pedir nada se declaró como una ausencia');
    assert.equal(resultado.llamadas, 0);
  });

  test('Dos aventuras que pasan por el mismo paraje no vuelven a pedir su ilustración', async () => {
    const compartido = lugar('paraje', 'A Torre Rota');
    const primera = aventuraDe([compartido, lugar('nucleo', 'Vilamar')]);
    const segunda = aventuraDe([compartido, lugar('nucleo', 'Ponteboa')]);
    const { conseguidor, imagenes } = montaConseguidor();

    const planA = planDeIlustraciones({ aventura: primera, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });
    const deA = await conseguidor.ilustracionesDeSalida(planA);
    const recursos = recursosVacios();
    for (const c of deA.conseguidos) {
      recursos.ilustraciones.push(declaraIlustracion({ elemento: c.clave, prompt: c.prompt, recurso: c.recurso }));
    }

    const planB = planDeIlustraciones({ aventura: segunda, mundo: MUNDO_SIN_FICCION, locale: 'gl', recursos, datosReales: [] });
    assert.deepEqual(planB.lote.map((l) => l.clave), [claveDeElemento('nucleo', 'Ponteboa')], 'la segunda salida volvió a pedir el paraje compartido');
    await conseguidor.ilustracionesDeSalida(planB);
    assert.equal(imagenes.peticiones().length, 3, 'el paraje compartido se pidió dos veces');
  });

  test('El prompt de un lugar del reparto es el mismo que el de su elemento del mundo', async () => {
    // La clave de caché identifica al elemento, no a quien construyó el prompt: si el
    // plan no encuentra el elemento en el mundo, el prompt sale sin su escena ni su
    // rasgo y la ilustración de un sitio deja de depender de qué sitio es.
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const reales = datosRealesDeMundo(mundo);
    const paraje = mundo.parajes[0];
    const aventura = aventuraDe([lugar('paraje', paraje.name)]);
    const plan = planDeIlustraciones({ aventura, mundo, locale: mundo.locale });
    const directo = promptDeIlustracion({ elemento: paraje, locale: mundo.locale, datosReales: reales });
    assert.equal(plan.lote.length, 1);
    assert.equal(plan.lote[0].prompt, directo.texto,
      `el plan construye para "${paraje.name}" un prompt distinto del de su elemento en el mundo`);
    assert.equal(plan.lote[0].claveDeCache, directo.clave, 'la misma ilustración se pediría con dos claves de caché distintas');
  });

  test('El documento guarda el prompt, su clave derivada y la referencia, y no el binario', async () => {
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const aventura = aventuraDe([lugar('paraje', mundo.parajes[0].name)]);
    const plan = planDeIlustraciones({ aventura, mundo, locale: mundo.locale });
    const { conseguidor } = montaConseguidor();
    const resultado = await conseguidor.ilustracionesDeSalida(plan);

    const recursos = recursosVacios();
    for (const c of resultado.conseguidos) {
      recursos.ilustraciones.push(declaraIlustracion({ elemento: c.clave, prompt: c.prompt, recurso: c.recurso }));
    }
    const doc = congelaCelda(registro, { recursos });
    assert.ok(doc.recursos.ilustraciones.length > 0, 'no se declaró ninguna ilustración: el caso no comprueba nada');
    for (const il of doc.recursos.ilustraciones) {
      assert.deepEqual(Object.keys(il).sort(), ['clave', 'elemento', 'estado', 'prompt', 'recurso']);
      assert.equal(il.clave, claveDeIlustracion(il.prompt), 'la clave del documento no se deriva de su prompt');
      assert.equal(il.estado, ESTADOS.RESIDENTE);
    }
    const escrito = textoDeCelda(registro, { recursos });
    assert.equal(/datos_base64|data:image|iVBORw0KG/.test(escrito), false, 'el binario de la ilustración se coló dentro del documento');
  });

  test('Con la salida preparada entera no falta ninguna ilustración', async () => {
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const reparto = repartoDeAventuras({ mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
    const aventura = reparto.aventuras.find((a) => a.cabe) ?? reparto.aventuras[0];
    const plan = planDeIlustraciones({ aventura, mundo, locale: mundo.locale });
    const { conseguidor } = montaConseguidor();
    const resultado = await conseguidor.ilustracionesDeSalida(plan);

    const recursos = recursosVacios();
    for (const c of resultado.conseguidos) {
      recursos.ilustraciones.push(declaraIlustracion({ elemento: c.clave, prompt: c.prompt, recurso: c.recurso }));
    }
    for (const beat of aventura.beats) {
      const placeId = beat.lugar.real?.placeId ?? null;
      if (placeId) recursos.fotos.push(declaraFoto({ placeId, recurso: `local/fotos/${placeId}.webp`, reloj: RELOJ }));
      recursos.textos.push(declaraTexto({ clave: claveDeTextoDeBeat(aventura.plantilla, beat.n), texto: beat.escena.texto, origen: 'plantilla' }));
    }
    const falta = queFaltaParaJugarSinRed({ aventura, recursos });
    assert.deepEqual(falta.faltan.filter((f) => f.familia === 'ilustracion'), [],
      'la salida preparada entera dice que le falta alguna ilustración');
  });

  test('El lote que se pasaría del tope de pago se recorta y lo recortado queda ausente', async () => {
    const nombres = Array.from({ length: TOPE_PAGO_LOTE_MAPA + 5 }, (_, i) => `Sitio ${String(i).padStart(2, '0')}`);
    const aventura = aventuraDe(nombres.map((n) => lugar('paraje', n)));
    const plan = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', tope: nombres.length, datosReales: [] });
    assert.equal(plan.lote.length, nombres.length);

    const { conseguidor, imagenes } = montaConseguidor();
    const resultado = await conseguidor.ilustracionesDeSalida(plan);
    assert.equal(TOPE_PAGO_LOTE_MAPA, 60, 'la copia declarada del tope de pago ya no es la de SPEC-023');
    assert.equal(imagenes.peticiones().length, TOPE_PAGO_LOTE_MAPA, 'salieron aguas arriba más peticiones de las que el tope de pago admite');
    assert.equal(resultado.conseguidos.length, TOPE_PAGO_LOTE_MAPA);
    assert.deepEqual(porMotivo(resultado.ausentes), { [MOTIVOS_DE_AUSENCIA.TOPE]: 5 },
      'lo recortado por el tope de pago no quedó declarado con su motivo');
    assert.equal(imagenes.llamadas(), 1, 'el recorte partió el lote en varias llamadas');
  });
});

describe('El presupuesto de tiempo de los dos lotes', () => {
  test('Los dos presupuestos están declarados en el núcleo y el conseguidor no arranca sin ellos', () => {
    assert.equal(PRESUPUESTO_PREPARACION_MS, 20000, 'la pared de la preparación ya no es la que declara la spec');
    assert.equal(PRESUPUESTO_FOTOS_MAPA_MS, 15000, 'la rebanada del minuto del lote de fotos ya no es la que declara la spec');
    assert.ok(PRESUPUESTO_FOTOS_MAPA_MS < 60000, 'el lote de fotos se puede comer el minuto entero de la generación');
    for (const falta of ['presupuestoIlustracionesMs', 'presupuestoFotosMs']) {
      assert.throws(
        () => creaConseguidorDeRecursos({
          clienteDeImagenes: creaClienteDeImagenes(),
          clienteDeFotos: creaClienteDeFotos(),
          almacen: creaAlmacenDeRecursos(),
          presupuestoIlustracionesMs: falta === 'presupuestoIlustracionesMs' ? null : PRESUPUESTO_PREPARACION_MS,
          presupuestoFotosMs: falta === 'presupuestoFotosMs' ? null : PRESUPUESTO_FOTOS_MAPA_MS,
        }),
        /presupuesto/,
        `el conseguidor arrancó sin ${falta} y esperaría sin límite`,
      );
    }
  });

  test('La preparación cuyo lote no termina se cierra igual con lo que tenga', async () => {
    const aventura = aventuraDe([lugar('paraje', 'A Torre Rota'), lugar('nucleo', 'Vilamar')]);
    const plan = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });
    const { conseguidor } = montaConseguidor({ imagenes: creaClienteDeImagenes({ modo: 'tarda' }), espera: VENCE_YA });

    const resultado = await conseguidor.ilustracionesDeSalida(plan);
    assert.deepEqual(resultado.conseguidos, [], 'la pared venció y aun así se dio algo por conseguido');
    assert.equal(resultado.ausentes.length, plan.lote.length, 'la pared dejó lugares sin declarar');
    assert.deepEqual(porMotivo(resultado.ausentes), { [MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR]: plan.lote.length });
  });

  test('La pared se cancela al volver la respuesta y no deja ningún temporizador vivo', async () => {
    const aventura = aventuraDe([lugar('paraje', 'A Torre Rota')]);
    const plan = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });
    const pared = paredContada();
    const { conseguidor } = montaConseguidor({ espera: pared });
    await conseguidor.ilustracionesDeSalida(plan);
    assert.deepEqual(pared.estado.pedidas, [PRESUPUESTO_PREPARACION_MS], 'la preparación no esperó con el presupuesto declarado');
    assert.equal(pared.estado.canceladas, 1, 'la pared se quedó viva después de que llegara la respuesta');
  });

  test('Un lote de fotos que no responde no impide que el mapa quede completo', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    const { conseguidor } = montaConseguidor({ fotos: creaClienteDeFotos({ modo: 'tarda' }), espera: VENCE_YA });

    const resultado = await conseguidor.fotosDeCelda(plan);
    assert.deepEqual(resultado.conseguidos, []);
    assert.equal(resultado.ausentes.length, plan.lote.length);
    // Y el mapa se congela y se levanta igual, con las fotos declaradas ausentes.
    const recursos = recursosVacios();
    for (const entrada of plan.lote) {
      recursos.fotos.push(declaraFoto({ anclaje: entrada.clave, placeId: entrada.placeId }));
    }
    const doc = congelaCelda(registro, { recursos });
    for (const f of doc.recursos.fotos) assert.equal(f.estado, ESTADOS.AUSENTE);
    const levantado = levantaCelda(doc, { semilla: SEMILLA_A });
    assert.equal(levantado.mundo.settlements.length, registro.mundo.settlements.length, 'el mapa quedó incompleto por no haber conseguido las fotos');
  });

  test('Lo ausente se queda ausente: no se reintenta por aventura ni en marcha', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const mundo = registro.mundo;
    const plan = sitiosParaFotografiar({ mundo });
    const { conseguidor, fotos } = montaConseguidor({ fotos: creaClienteDeFotos({ modo: 'falla-siempre' }) });
    const fallido = await conseguidor.fotosDeCelda(plan);
    assert.equal(fallido.conseguidos.length, 0);
    assert.equal(fotos.llamadas(), 1);

    // Cinco salidas después: la preparación pide sus ilustraciones y ni una foto.
    for (let salida = 1; salida <= 5; salida++) {
      const aventura = aventuraDe([lugar('paraje', `Paraje ${salida}`)]);
      const planIl = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: mundo.locale, datosReales: [] });
      await conseguidor.ilustracionesDeSalida(planIl);
    }
    assert.equal(fotos.llamadas(), 1, `lo ausente se reintentó ${fotos.llamadas() - 1} veces fuera del lote de mapa`);
  });
});

describe('La degradación es silenciosa, y ninguna pantalla la llama fallo', () => {
  test('Sin cobertura, la preparación dice lo mismo', async () => {
    // La mitad de esta fila: con cobertura y sin ella, la preparación recorre las mismas
    // fases, cierra igual y **no lanza**. Lo que cambia es lo que queda residente, que es
    // justo lo que la pantalla no puede llegar a distinguir.
    const aventura = aventuraDe([lugar('paraje', 'A Torre Rota'), lugar('nucleo', 'Vilamar')]);
    const plan = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });

    const conCobertura = await montaConseguidor().conseguidor.ilustracionesDeSalida(plan);
    const sinCobertura = await montaConseguidor({ imagenes: creaClienteDeImagenes({ modo: 'falla-siempre' }) })
      .conseguidor.ilustracionesDeSalida(plan);

    assert.equal(conCobertura.llamadas, sinCobertura.llamadas, 'sin cobertura la preparación hace un número distinto de llamadas');
    assert.equal(sinCobertura.conseguidos.length, 0);
    assert.equal(conCobertura.conseguidos.length + conCobertura.ausentes.length,
      sinCobertura.conseguidos.length + sinCobertura.ausentes.length,
      'sin cobertura la preparación declara un número distinto de lugares');
    // Y las dos cierran: ni una excepción llega a la pantalla.
    assert.equal(Array.isArray(sinCobertura.ausentes), true);
  });

  test('Ningún texto que el conseguidor devuelve nombra la red, un fallo, un proveedor ni una caché', async () => {
    const VOCABULARIO = /red|conexión|conexion|cobertura|internet|offline|servidor|proveedor|caché|cache|error|fallo|fall[aó]|reintent|espera fallida|timeout|plazo/i;

    // 1 · Lo que sale por la puerta: cada texto del resultado de una carrera sin cobertura
    //     es una clave del plan, una referencia del almacén o un motivo del catálogo. Ni
    //     una frase, que es la única forma de que ninguna pantalla pueda contar un fallo.
    const aventura = aventuraDe([lugar('paraje', 'A Torre Rota'), lugar('nucleo', 'Vilamar')]);
    const plan = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });
    const { conseguidor } = montaConseguidor({ imagenes: creaClienteDeImagenes({ modo: 'falla-siempre' }) });
    const resultado = await conseguidor.ilustracionesDeSalida(plan);
    const permitidos = new Set([...CLAVES_DE_AUSENCIA, ...FAMILIAS_DE_AUSENCIA, ...plan.lote.map((l) => l.clave)]);
    for (const { ruta, valor } of textosDe({ resultado })) {
      assert.equal(permitidos.has(valor), true, `el conseguidor devuelve en ${ruta} un texto que no es clave ni motivo: "${valor}"`);
      assert.equal(VOCABULARIO.test(valor), false, `el conseguidor devuelve en ${ruta} un texto con vocabulario de red o de fallo: "${valor}"`);
    }

    // 2 · Y en el módulo: los literales que no son mensajes de cableado —los que sí pueden
    //     acabar en un valor devuelto— tampoco nombran ninguna de esas cosas. Los mensajes
    //     de `throw` sí las nombran a propósito: van a quien programa y no a la pantalla.
    const fuente = readFileSync(join(RAIZ_REPO, 'app', 'recursos', 'conseguidor.js'), 'utf8');
    const literales = literalesQueViajan(fuente);
    assert.ok(literales.total >= 20, `solo se leyeron ${literales.total} literales del conseguidor: la lectura del módulo no está midiendo nada`);
    for (const l of literales.viajan) {
      assert.equal(VOCABULARIO.test(l), false, `un literal del conseguidor que puede viajar nombra la red o un fallo: "${l}" (${literales.viajan.length} de ${literales.total} pueden viajar)`);
    }
  });

  test('Sin foto de Places, el visor abre igual', async () => {
    // La mitad de material de esta fila: la cartela del lado real se pinta con el nombre
    // del anclaje, que está en el mundo congelado y no en la foto. Sin foto residente el
    // visor tiene lo mismo que con ella menos el fondo, y nada declara que falte.
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const anclados = anclajesConsumidos(mundo);
    assert.ok(anclados.length > 0, 'ningún elemento de este mundo está anclado: el caso no comprueba nada');

    const recursos = recursosVacios();
    for (const { rol, nombre } of anclados) {
      recursos.ilustraciones.push(declaraIlustracion({
        elemento: claveDeElemento(rol, nombre),
        prompt: `un ${rol} llamado ${nombre}`,
        recurso: `local/il/${nombre}.webp`,
      }));
    }
    const plan = sitiosParaFotografiar({ mundo, recursos });
    assert.deepEqual(plan.lote, [], 'un mundo sin sitios de Places compuso lote de fotos');

    for (const { rol, nombre, ficha } of anclados) {
      // Lo de la ficción está: la ilustración es residente.
      assert.equal(recursos.ilustraciones.some((i) => i.elemento === claveDeElemento(rol, nombre) && i.estado === ESTADOS.RESIDENTE), true);
      // Y lo del lado real también, menos la foto: la cartela sale del anclaje.
      assert.equal(typeof (ficha.name ?? ficha.kind), 'string', `el anclaje de "${nombre}" se queda sin cartela cuando no hay foto`);
    }
    // Nada de lo declarado dice que falte algo: se declara ausente y punto.
    for (const a of plan.ausentes) assert.equal(Object.keys(a).sort().join(','), 'clave,estado,familia,motivo');
  });

  test('Una salida sin una sola ilustración y sin una sola foto se completa igual', async () => {
    const registro = await celdaDeFixture('costero');
    const mundo = registro.mundo;
    const reparto = repartoDeAventuras({ mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
    const aventura = reparto.aventuras.find((a) => a.cabe) ?? reparto.aventuras[0];

    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const falta = queFaltaParaJugarSinRed({ aventura, recursos: recursosVacios() });
      assert.ok(falta.faltan.some((f) => f.familia === 'ilustracion'), 'no falta ninguna ilustración: el caso no comprueba nada');
      // Enumera, no rechaza: el lazo sigue trazado y cada beat conserva su texto.
      assert.equal(aventura.lazo.trazado, true, 'sin recursos la aventura deja de poder recorrerse');
      for (const beat of aventura.beats) {
        assert.equal(typeof beat.escena.texto, 'string');
        assert.ok(beat.escena.texto.length > 0, `el beat ${beat.n} se queda mudo sin ilustración`);
      }
      assert.deepEqual(inspector.peticiones(), [], 'enumerar lo que falta sacó tráfico del móvil');
    } finally {
      inspector.suelta();
    }
  });
});

describe('Si los términos de Places bloquean', () => {
  test('Con el interruptor apagado no sale ninguna petición de foto', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const mundo = registro.mundo;
    const plan = sitiosParaFotografiar({ mundo, placesActivo: false });
    assert.equal(PLACES_ACTIVO, true, 'el interruptor ya no viene encendido por defecto');
    assert.deepEqual(plan.lote, [], 'con el interruptor apagado se compuso lote de fotos igual');
    assert.equal(plan.placesActivo, false);

    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const { conseguidor, fotos } = montaConseguidor();
      const resultado = await conseguidor.fotosDeCelda(plan);
      assert.equal(fotos.llamadas(), 0, 'con el interruptor apagado salió una llamada a la ruta de fotos');
      assert.equal(resultado.llamadas, 0);
      assert.deepEqual(inspector.peticiones(), [], 'con el interruptor apagado salió tráfico del móvil');
    } finally {
      inspector.suelta();
    }
  });

  test('Preguntar por qué no hay fotos responde el interruptor y no un fallo de red', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo, placesActivo: false });
    assert.ok(plan.ausentes.length > 0, 'con el interruptor apagado no se declaró ninguna ausencia');
    assert.deepEqual(porMotivo(plan.ausentes), { [MOTIVOS_DE_AUSENCIA.INTERRUPTOR]: plan.ausentes.length });
    const cuenta = cuentaAusencias(plan.ausentes);
    assert.equal(cuenta.porMotivo[MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR], 0, 'el interruptor apagado se contó como un fallo de red');
    assert.equal(cuenta.sinMotivo, 0);
  });

  test('Con el interruptor apagado el pool se construye solo con OSM', () => {
    const nombre = 'barrio-tres-calles';
    const { lat, lon } = coordenadaDe(nombre);
    const poiJson = mundoCongelado(nombre).pois;
    const places = placesDePrueba(nombre);
    const demanda = { total: 40, suelo: 8 };
    const comun = { poiJson, lat0: lat, lon0: lon, semilla: SEMILLA_A, demanda };

    const conPlaces = construyePool({ ...comun, places });
    const apagado = construyePool({ ...comun, places, placesActivo: false });
    const sinFuente = construyePool({ ...comun });

    assert.ok(conPlaces.anclajes.length > sinFuente.anclajes.length, 'la fuente de relleno no aportó nada: el caso no comprueba nada');
    assert.equal(apagado.anclajes.length, sinFuente.anclajes.length, 'con el interruptor apagado entró algún anclaje de Places');
    assert.deepEqual(apagado.anclajes.map((a) => a.osmId ?? a.placeId), sinFuente.anclajes.map((a) => a.osmId ?? a.placeId),
      'el pool con el interruptor apagado no es el mismo que el pool sin fuente de relleno');
    assert.equal(apagado.anclajes.some((a) => a.placeId), false, 'con el interruptor apagado se coló un anclaje con place_id');
  });

  test('Con el interruptor apagado el mundo se genera igual, byte a byte', async () => {
    const nombre = 'barrio-tres-calles';
    const rejilla = rejillaDe(nombre);
    const comun = { rejilla, semilla: SEMILLA_A, mapaId: rejilla.id, celda: { i: 0, j: 0 }, consultaOsm: consultaDeFixture(nombre) };
    const apagado = await generaCelda({ ...comun, places: placesDePrueba(nombre), placesActivo: false });
    const sinFuente = await generaCelda({ ...comun });
    assert.equal(textoDeCelda(apagado), textoDeCelda(sinFuente),
      'con el interruptor apagado el mundo no sale idéntico al que se genera sin fuente de relleno: no ha cambiado ni un nombre, ni un tipo, ni una posición es lo que la spec exige');
  });

  test('Una foto ya residente sobrevive a apagar el interruptor', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const conseguido = sitiosParaFotografiar({ mundo: registro.mundo }).lote[0];
    assert.ok(conseguido, 'no hay ninguna foto que conseguir: el caso no comprueba nada');
    const recursos = recursosVacios();
    recursos.fotos.push(declaraFoto({ anclaje: conseguido.clave, placeId: conseguido.placeId, recurso: `local/fotos/${conseguido.placeId}.webp`, reloj: RELOJ }));

    const doc = congelaCelda(registro, { recursos });
    const levantado = levantaCelda(doc, { semilla: SEMILLA_A });
    assert.equal(levantado.mundo.settlements.length, registro.mundo.settlements.length, 'el mundo congelado dejó de levantarse al apagar el interruptor');
    // Y con el interruptor apagado sigue sin pedirse nada, incluida la que ya está.
    const plan = sitiosParaFotografiar({ mundo: registro.mundo, recursos, placesActivo: false });
    assert.deepEqual(plan.lote, []);
    assert.equal(exigeResidentes({ recursos, tiene: () => true }), true);
  });
});

describe('Cuando no se puede pedir', () => {
  test('El proveedor de imágenes caído deja las ilustraciones ausentes y la salida se prepara igual', async () => {
    const aventura = aventuraDe([lugar('paraje', 'A Torre Rota'), lugar('nucleo', 'Vilamar')]);
    const plan = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });
    const { conseguidor } = montaConseguidor({ imagenes: creaClienteDeImagenes({ modo: 'falla-siempre' }) });
    const resultado = await conseguidor.ilustracionesDeSalida(plan);
    assert.deepEqual(resultado.conseguidos, []);
    assert.deepEqual(porMotivo(resultado.ausentes), { [MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR]: 2 });
  });

  test('Places caído deja las fotos ausentes con «no se pudo pedir» y la generación termina', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    const { conseguidor } = montaConseguidor({ fotos: creaClienteDeFotos({ modo: 'falla-siempre' }) });
    const resultado = await conseguidor.fotosDeCelda(plan);
    assert.deepEqual(resultado.conseguidos, []);
    assert.deepEqual(porMotivo(resultado.ausentes), { [MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR]: plan.lote.length });
  });

  test('Una respuesta que no encaja en el esquema del sobre se descarta sin interpretarse', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    for (const defecto of ['places-sin-foto-dentro', 'places-sin-atribucion', 'places-con-url']) {
      const { conseguidor, almacen } = montaConseguidor({ fotos: creaClienteDeFotos({ modo: 'responde-mal', defecto }) });
      const resultado = await conseguidor.fotosDeCelda(plan);
      assert.deepEqual(resultado.conseguidos, [], `la respuesta defectuosa "${defecto}" se dio por buena`);
      assert.deepEqual(porMotivo(resultado.ausentes), { [MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR]: plan.lote.length });
      assert.deepEqual(almacen.guardados(), [], `la respuesta defectuosa "${defecto}" llegó a guardarse`);
    }
    const aventura = aventuraDe([lugar('paraje', 'A Torre Rota')]);
    const planIl = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });
    for (const defecto of ['imagen-sin-binario', 'imagen-con-medidas-de-texto', 'imagen-con-campo-de-mas']) {
      const { conseguidor, almacen } = montaConseguidor({ imagenes: creaClienteDeImagenes({ modo: 'responde-mal', defecto }) });
      const resultado = await conseguidor.ilustracionesDeSalida(planIl);
      assert.deepEqual(resultado.conseguidos, [], `la imagen defectuosa "${defecto}" se dio por buena`);
      assert.deepEqual(almacen.guardados(), []);
    }
  });

  test('Una respuesta que dice «no hay» es «sin foto en el sitio» y no «no se pudo pedir»', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    const { conseguidor } = montaConseguidor({ fotos: creaClienteDeFotos({ modo: 'no-hay' }) });
    const resultado = await conseguidor.fotosDeCelda(plan);
    assert.deepEqual(porMotivo(resultado.ausentes), { [MOTIVOS_DE_AUSENCIA.SIN_FOTO]: plan.lote.length },
      'un «no hay» de Places se contó como un fallo de red');

    // La ilustración no tiene equivalente de «no hay»: si no llega, no se pudo pedir.
    const aventura = aventuraDe([lugar('paraje', 'A Torre Rota')]);
    const planIl = planDeIlustraciones({ aventura, mundo: MUNDO_SIN_FICCION, locale: 'gl', datosReales: [] });
    const { conseguidor: otro } = montaConseguidor({ imagenes: creaClienteDeImagenes({ modo: 'no-hay' }) });
    const deImagen = await otro.ilustracionesDeSalida(planIl);
    assert.deepEqual(porMotivo(deImagen.ausentes), { [MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR]: 1 });
  });

  test('Los dos motivos se cuentan por separado en un mismo mapa', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    assert.ok(plan.lote.length >= 2, 'este mundo no tiene dos sitios de Places: el caso mixto no se puede montar');
    const { conseguidor } = montaConseguidor({ fotos: creaClienteDeFotos({ sinContenido: [0] }) });
    const resultado = await conseguidor.fotosDeCelda(plan);

    const cuenta = cuentaAusencias(resultado.ausentes);
    assert.equal(cuenta.porMotivo[MOTIVOS_DE_AUSENCIA.SIN_FOTO], 1, 'el «no hay» de un sitio no se cuenta aparte');
    assert.equal(cuenta.porMotivo[MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR], 0, 'un «no hay» acabó contado como fallo');
    assert.equal(resultado.conseguidos.length, plan.lote.length - 1, 'el resto del lote no se consiguió pese a llegar bien');
    assert.deepEqual(Object.keys(cuenta.porMotivo), [...CLAVES_DE_AUSENCIA], 'el recuento no declara los cinco motivos');
  });

  test('El vocabulario de la ausencia es cerrado y uno de fuera hace fallar el recuento', () => {
    assert.deepEqual([...CLAVES_DE_AUSENCIA], ['sin-sitio', 'sin-foto', 'no-se-pudo-pedir', 'tope', 'interruptor']);
    for (const motivo of CLAVES_DE_AUSENCIA) assert.equal(exigeMotivoDeAusencia(motivo), motivo);
    for (const fuera of ['sin-red', 'desconocido', '', null, undefined, 'SIN_FOTO']) {
      assert.throws(() => exigeMotivoDeAusencia(fuera), (e) => e.message.includes('sin-sitio') && e.message.includes('interruptor'),
        `el motivo fuera del catálogo ${JSON.stringify(fuera)} se aceptó`);
      // `null` y `undefined` no son un motivo inventado sino la falta de motivo, y el
      // recuento los lleva a `sinMotivo` a propósito: reparte lo que nadie explicó a la
      // vista en vez de sumarlo a un motivo, que es lo que escondería el cableado roto.
      if (fuera == null) continue;
      assert.throws(() => cuentaAusencias([{ motivo: fuera }]), /motivo de ausencia desconocido|vocabulario cerrado/);
    }
    assert.throws(() => declaraAusencia({ familia: 'texto', clave: 'x', motivo: 'tope' }), /familia/, 'los textos van en línea y no pueden faltar como binario');
    assert.throws(() => declaraAusencia({ familia: 'foto', clave: '', motivo: 'tope' }), /clave/);
    assert.equal(cuentaAusencias([{ familia: 'foto', clave: 'x' }]).sinMotivo, 1, 'una ausencia sin motivo se repartió entre los motivos declarados');
  });

  test('Un lote que vuelve descuadrado no se interpreta a medias', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    const { conseguidor, almacen } = montaConseguidor({ fotos: creaClienteDeFotos({ deMenos: 1 }) });
    const resultado = await conseguidor.fotosDeCelda(plan);
    assert.deepEqual(resultado.conseguidos, [], 'un lote descuadrado se emparejó a ciegas con lo que se pidió');
    assert.deepEqual(almacen.guardados(), []);
    assert.equal(resultado.ausentes.length, plan.lote.length);
  });
});

describe('Nada degrada por falta de cableado', () => {
  const piezas = {
    clienteDeImagenes: () => creaClienteDeImagenes(),
    clienteDeFotos: () => creaClienteDeFotos(),
    almacen: () => creaAlmacenDeRecursos(),
  };
  const nombreDe = {
    clienteDeImagenes: /cliente de im[áa]genes/,
    clienteDeFotos: /cliente de fotos/,
    almacen: /almac[ée]n de recursos binarios/,
  };

  for (const falta of Object.keys(piezas)) {
    test(`El conseguidor construido sin ${falta} falla nombrando la pieza que falta`, () => {
      const deps = {
        presupuestoIlustracionesMs: PRESUPUESTO_PREPARACION_MS,
        presupuestoFotosMs: PRESUPUESTO_FOTOS_MAPA_MS,
      };
      for (const pieza of Object.keys(piezas)) if (pieza !== falta) deps[pieza] = piezas[pieza]();
      assert.throws(
        () => creaConseguidorDeRecursos(deps),
        (e) => nombreDe[falta].test(e.message),
        `sin ${falta} el conseguidor se construyó igual y devolvería lotes vacíos, que es indistinguible de no tener nada que pedir`,
      );
    });
  }

  test('Un cliente que no expone «pideLote» falla nombrando el método', () => {
    for (const roto of ['clienteDeImagenes', 'clienteDeFotos']) {
      assert.throws(
        () => creaConseguidorDeRecursos({
          clienteDeImagenes: roto === 'clienteDeImagenes' ? {} : creaClienteDeImagenes(),
          clienteDeFotos: roto === 'clienteDeFotos' ? {} : creaClienteDeFotos(),
          almacen: creaAlmacenDeRecursos(),
          presupuestoIlustracionesMs: PRESUPUESTO_PREPARACION_MS,
          presupuestoFotosMs: PRESUPUESTO_FOTOS_MAPA_MS,
        }),
        /pideLote/,
        `un ${roto} sin pideLote se aceptó y pediría una petición por vez`,
      );
    }
    assert.throws(
      () => creaConseguidorDeRecursos({
        clienteDeImagenes: creaClienteDeImagenes(),
        clienteDeFotos: creaClienteDeFotos(),
        almacen: { guarda: () => 'x' },
        presupuestoIlustracionesMs: PRESUPUESTO_PREPARACION_MS,
        presupuestoFotosMs: PRESUPUESTO_FOTOS_MAPA_MS,
      }),
      /tiene/,
      'un almacén que no sabe decir si tiene un binario se aceptó igual',
    );
  });

  test('Un plan sin el vocabulario de motivos falla en vez de contar con un catálogo viejo', async () => {
    const { conseguidor } = montaConseguidor({ imagenes: creaClienteDeImagenes({ modo: 'falla-siempre' }) });
    const plan = { familia: 'ilustracion', lote: [{ clave: 'paraje:A Torre Rota', peticion: { prompt: 'x', formato: FORMATO_DE_ILUSTRACION } }], ausentes: [] };
    await assert.rejects(() => conseguidor.ilustracionesDeSalida(plan), /vocabulario de motivos/,
      'un plan sin catálogo de motivos se atendió con el catálogo que tuviera la app');
    await assert.rejects(() => conseguidor.fotosDeCelda({ familia: 'foto' }), /plan/, 'un plan sin lote se atendió igual');
  });

  test('Una foto declarada residente cuyo binario no está falla nombrando el recurso', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles') });
    const plan = sitiosParaFotografiar({ mundo: registro.mundo });
    const { conseguidor, almacen } = montaConseguidor();
    const resultado = await conseguidor.fotosDeCelda(plan);
    const recursos = recursosVacios();
    for (const c of resultado.conseguidos) {
      recursos.fotos.push(declaraFoto({ anclaje: c.clave, placeId: c.placeId, recurso: c.recurso, reloj: RELOJ }));
    }
    assert.equal(exigeResidentes({ recursos, tiene: (ref) => almacen.tiene(ref) }), true, 'lo recién guardado no está en el almacén');

    almacen.olvida(recursos.fotos[0].recurso);
    assert.throws(
      () => exigeResidentes({ recursos, tiene: (ref) => almacen.tiene(ref) }),
      (e) => e.message.includes(recursos.fotos[0].recurso) && /perdid/.test(e.message),
      'una foto residente sin binario levantó el mundo en silencio, como si nunca la hubiera tenido',
    );
  });

  test('exigeResidentes sin almacén inyectado falla en vez de decir que está todo', () => {
    const recursos = recursosVacios();
    recursos.ilustraciones.push(declaraIlustracion({ elemento: 'paraje:A Torre Rota', prompt: 'una ruina', recurso: 'local/il/a.webp' }));
    assert.throws(() => exigeResidentes({ recursos }), /almac[ée]n/, 'sin almacén se dio por bueno que estaba todo sin haber mirado');
    assert.throws(() => exigeResidentes({ recursos, tiene: null }), /almac[ée]n/);
    assert.throws(
      () => exigeResidentes({ recursos, tiene: () => false }),
      (e) => e.message.includes('local/il/a.webp'),
      'una ilustración residente sin binario no se nombró',
    );
  });
});

/**
 * Los literales de un módulo, separando los que solo existen dentro de un `throw` —los
 * mensajes de cableado, que van a quien programa— de los que pueden acabar en un valor
 * devuelto. Se cuenta con un contador de paréntesis y no con un analizador: es suficiente
 * para lo que se afirma y no mete una dependencia en la suite.
 */
function literalesQueViajan(fuente) {
  const sinComentarios = fuente.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const dentroDeThrow = [];
  const re = /throw\s+new\s+Error\s*\(/g;
  let m;
  while ((m = re.exec(sinComentarios)) !== null) {
    let i = m.index + m[0].length;
    let nivel = 1;
    while (i < sinComentarios.length && nivel > 0) {
      if (sinComentarios[i] === '(') nivel += 1;
      else if (sinComentarios[i] === ')') nivel -= 1;
      i += 1;
    }
    dentroDeThrow.push([m.index, i]);
  }
  const enThrow = (pos) => dentroDeThrow.some(([a, b]) => pos >= a && pos < b);

  const literales = [];
  const viajan = [];
  const reLit = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g;
  let l;
  while ((l = reLit.exec(sinComentarios)) !== null) {
    const valor = l[1] ?? l[2] ?? l[3];
    literales.push(valor);
    if (!enThrow(l.index)) viajan.push(valor);
  }
  return { total: literales.length, viajan };
}
