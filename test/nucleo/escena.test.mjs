// SPEC-034 · La escena de un beat (A4P3), lo que te llevas (A4P4) y **el motor de la
//            aventura en curso**: aceptar, recorrer y declarar cómo acabó.
//
// Esta fila entrega lo que la verificación a mano del entregable de B2 echó en falta
// (`pipeline/decisiones-orquestador.md` §6r), así que casi todo lo que hay aquí abajo es
// la primera vez que se pone rojo: entre «el paquete sabe castear una aventura» y «el
// paquete sabe cerrarla en progresión» no había nada que se pudiera comprobar.
//
// Seis decisiones de este fichero que no son de estilo:
//
// - **Los recuentos van sobre los ocho mundos de referencia y sobre el catálogo entero**,
//   nunca sobre un beat inventado a medida (§6o). Que una plantilla con franja se recorra
//   fuera de hora no demuestra nada si es la única que se mira: lo que se afirma es que
//   **ninguna** de las que llevan franja se bloquea, y el caso dice en voz alta cuántas
//   son para que el día que sean cero se vea.
// - **Dentro y fuera de franja se comparan lado a lado, no por separado.** El criterio de
//   RF-QUEST-004 no es «fuera también resuelve», es «fuera resuelve **igual**»: los dos
//   ciclos completos se ejecutan enteros y se comparan el avance, el cierre y el registro
//   de hechos byte a byte. Lo único que puede diferir es `variante`, y se comprueba que
//   difiere — si no, la franja no ambientaría nada.
// - **El minuto se busca por todo el documento y por todo el registro**, no en el campo
//   donde se esperaría encontrarlo. La privacidad no se comprueba mirando el sitio donde
//   uno no lo metió; se comprueba recorriendo el documento entero (`recorreDocumento`) y
//   afirmando que ningún nodo lo lleva.
// - **La decisión de guardar el avance y no la cadena se comprueba, no se cita.** El
//   estado guarda `beatEnCurso` y `resueltos` porque la cadena es determinista desde el
//   mundo; eso es una promesa hasta que alguien vuelve a castear la misma plantilla contra
//   el mismo mundo y compara. Aquí se castea dos veces, y además con una tenencia distinta
//   —lo único que el estado de la partida aporta al casting—, para ver hasta dónde llega
//   la promesa.
// - **La escena sin cara se compara contra la escena con cara**, no consigo misma: la
//   spec dice que pierde el bloque de la cara y **no mueve de sitio ningún otro elemento**,
//   y eso solo se puede afirmar restando dos composiciones.
// - **El reloj se cuenta.** Que un beat sin franja no consulte el reloj de pared es la
//   otra mitad de RF-PRIV-002: el minuto no se guarda, pero además no se pide cuando no
//   decide nada.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «Sin el objeto hay
// otro camino al mismo beat», «Fallar por no llegar es casi imposible», «La escena queda
// disponible y espera», «Con LLM y sin LLM la estructura es idéntica», «Sin red, la
// aventura funciona entera» y «El estado manda sobre el registro». Los cuatro primeros
// tienen ya media implementación en `casting.test.mjs`, `objetos.test.mjs`,
// `llegadas.test.mjs` y `narrador.test.mjs`, que afirman la **estructura**; aquí se
// afirma la mitad que esta fila entrega —**recorrer** la aventura y **componer** la
// escena—, que es la que no existía. Todo lo demás va marcado como hueco de la batería
// en `test/spec-test-map.json`, y dos huecos son de la propia batería y no de esta fila:
// RF-QUEST-004 (franjas) y RF-PJ-009 (modo compañía) están marcados «⚠ sin escenario» en
// `docs/prd.md` y sus criterios se escriben aquí por primera vez.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: los mundos salen de
// `test/fixtures/osm/` por el doble de siempre y la hora, del reloj de pared inyectado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { recorreDocumento, textosDe } from './partida-de-prueba.mjs';
import { minutoDentroDe, minutoFueraDe, relojDePared, relojRoto } from '../dobles/reloj-de-pared.mjs';

import {
  COMO_ACABO,
  HECHOS_QUE_EMITE,
  HECHO_QUE_NADIE_EMITE,
  IDS_DE_COMO_ACABO,
  acepta,
  aventuraEnCurso,
  aventurasCerradas,
  cierra,
  congelaAventuras,
  estadoDeAventuras,
  hayAventuraEnCurso,
  levantaAventuras,
  resuelveBeat,
} from '../../packages/nucleo/partida/aventura-en-curso.js';
import {
  ABREVIATURAS,
  CIERRES_POR_RESULTADO,
  ESCALA_DE_TEXTO,
  ESCENAS_CON_MARCO,
  ESTADOS_DE_ESCENA,
  IDS_DE_TAMANO_DE_TEXTO,
  LO_QUE_LA_ESCENA_NO_LLEVA,
  MARCOS_DE_ESCENA,
  TAMANO_DE_TEXTO_DE_ORIGEN,
  TESTIDS,
  TEXTOS_DEL_TAMANO,
  UNIDADES_ABREVIADAS,
  VOCABULARIO_DE_REPROCHE,
  cierreDeResultado,
  componeEscena,
  componeLoQueTeLlevas,
  compruebaCoberturaDeMarcos,
  exigeTamanoDeTexto,
  factorDeTamano,
  infraccionesDeLecturaEnVozAlta,
  infraccionesDeReproche,
  marcoDeEscena,
  siguienteTamanoDeTexto,
  sinEscena,
  varianteDelBeat,
} from '../../packages/nucleo/quests/escena.js';
import { CAMPOS_DE_RAMIFICACION, FRANJAS, validaPlantilla } from '../../packages/nucleo/quests/aventura.js';
import { CATALOGO } from '../../packages/nucleo/quests/catalogo.js';
import { castTemplate } from '../../packages/nucleo/quests/casting.js';
import { rotuloDePuesto } from '../../packages/nucleo/partida/puestos.js';
import { AREAS_QUE_NO_REPRODUCEN } from '../../packages/nucleo/partida/estado.js';
import { reconstruye } from '../../packages/nucleo/partida/reconstruccion.js';
import { anexa, hecho, hechosDe, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { SIN_OBJETOS, estadoDeObjetos, guarda, objetoPersistente, vistaDeTenencia } from '../../packages/nucleo/partida/objetos.js';

const MAPA = 'costero#1';

const LOS_OCHO = ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso']
  .flatMap((nombre) => ['1', '2'].map((semilla) => ({ nombre, semilla, clave: `${nombre}#${semilla}` })));

// Un mundo por clave: generar los ocho cuesta unos tres segundos y aquí se miran muchas
// veces. Los mundos salen congelados de la tubería y ningún caso muta lo que recibe.
const MUNDOS = new Map();
async function mundoDe(nombre, semilla) {
  const clave = `${nombre}#${semilla}`;
  if (!MUNDOS.has(clave)) MUNDOS.set(clave, await generaMundo(nombre, semillaDe(nombre, semilla)));
  return MUNDOS.get(clave);
}

/** Las aventuras que castean en los ocho mundos de referencia, con su clave de mundo. */
async function losOchoCasteados() {
  const out = [];
  for (const { nombre, semilla, clave } of LOS_OCHO) {
    const mundo = await mundoDe(nombre, semilla);
    out.push({ clave, mundo, castean: mundo.casting.filter((c) => c.ok) });
  }
  return out;
}

/** La primera aventura casteada de un mundo que cumpla lo que se le pida. */
async function unaAventura(predicado = () => true, { nombre = 'costero', semilla = '1' } = {}) {
  const mundo = await mundoDe(nombre, semilla);
  const c = mundo.casting.find((x) => x.ok && predicado(x));
  assert.ok(c, `ninguna aventura casteada de ${nombre}#${semilla} cumple lo que el caso necesita`);
  return c;
}

const conFranja = (c) => c.beats.some((b) => b.disparador.tipo === 'franja');
const conObjeto = (c) => c.beats.some((b) => b.disparador.tipo === 'con_objeto');

/**
 * Un ciclo entero: aceptar, resolver los beats en orden y cerrar. Devuelve lo que sale
 * de cada transición y el registro de hechos, que es lo que se compara entre dos ciclos.
 */
function recorreEntera(c, { minuto = null, tenencia = SIN_OBJETOS, desenlace = 'el-desenlace', hastaBeat = null } = {}) {
  const estado = estadoDeAventuras();
  const registro = registroInicial();
  const reloj = minuto == null ? relojDePared(0) : relojDePared(minuto);
  const aceptada = acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
  const pasos = [];
  const cuantos = hastaBeat ?? c.beats.length;
  for (const beat of c.beats.slice(0, cuantos)) pasos.push(resuelveBeat(estado, { beat, reloj, tenencia }));
  const cerrada = cierra(estado, { registro, dia: 1, paso: 9, desenlace, motivo: 'me volví' });
  return { estado, registro, reloj, aceptada, pasos, cerrada, hechos: hechosDe(registro) };
}

/** El mismo ciclo con el minuto que cae dentro de la franja del beat que la tenga. */
function minutoDeLaFranja(c, dentro) {
  const beat = c.beats.find((b) => b.disparador.tipo === 'franja');
  return dentro ? minutoDentroDe(beat.disparador.franja) : minutoFueraDe(beat.disparador.franja);
}

// ── La cadena es lineal, y eso se comprueba sobre el catálogo entero ────────────

describe('La cadena de beats es lineal y se recorre en orden', () => {
  test('Cada beat apunta a un único siguiente y solo el último no apunta a ninguno', async () => {
    let cadenas = 0;
    for (const { clave, castean } of await losOchoCasteados()) {
      for (const c of castean) {
        cadenas++;
        c.beats.forEach((b, i) => {
          const esperado = i === c.beats.length - 1 ? null : i + 2;
          assert.equal(
            b.resultado.siguienteBeat ?? null, esperado,
            `${clave} · ${c.plantilla} beat ${b.n}: empuja a ${JSON.stringify(b.resultado.siguienteBeat)} y la cadena lineal esperaba ${JSON.stringify(esperado)}`,
          );
          // Una continuación es **una**: ni una lista, ni un campo de ramificación.
          assert.equal(Array.isArray(b.resultado.siguienteBeat), false, `${clave} · ${c.plantilla} beat ${b.n}: el siguiente llega como lista`);
          for (const campo of CAMPOS_DE_RAMIFICACION) {
            assert.equal(b[campo], undefined, `${clave} · ${c.plantilla} beat ${b.n}: lleva el campo de ramificación "${campo}"`);
            assert.equal(b.resultado[campo], undefined, `${clave} · ${c.plantilla} beat ${b.n}: el resultado lleva el campo de ramificación "${campo}"`);
          }
        });
      }
    }
    assert.ok(cadenas >= 200, `solo se han recorrido ${cadenas} cadenas: el caso no está mirando el catálogo sobre los ocho mundos`);
  });

  test('Un beat resuelto ofrece exactamente una continuación', async () => {
    const c = await unaAventura();
    const { pasos } = recorreEntera(c);
    pasos.forEach((p, i) => {
      const esperado = i === c.beats.length - 1 ? null : i + 2;
      assert.equal(p.siguienteBeat, esperado, `beat ${p.beat}: la resolución empuja a ${JSON.stringify(p.siguienteBeat)} y no a ${JSON.stringify(esperado)}`);
    });
    // Y una escena compuesta tiene **una** acción y la acción avanza.
    const escena = componeEscena({ beat: c.beats[0] });
    assert.deepEqual(Object.keys(escena.accion).sort(), ['avanza', 'verbo']);
    assert.equal(escena.accion.avanza, true);
    assert.equal(Array.isArray(escena.accion), false, 'la acción llega como lista: una lista con un elemento es una ramificación con un hueco');
  });

  test('Una plantilla que declarase dos beats siguientes falla nombrando la plantilla y el beat', () => {
    const buena = CATALOGO[0];
    for (const campo of CAMPOS_DE_RAMIFICACION) {
      const rota = {
        ...buena,
        beats: buena.beats.map((b, i) => (i === 1 ? { ...b, [campo]: ['a', 'b'] } : b)),
      };
      assert.throws(
        () => validaPlantilla(rota),
        (e) => e.message.includes(buena.id) && e.message.includes('beat 2') && e.message.includes(campo),
        `una plantilla con "${campo}" en su segundo beat se ha validado, o el error no nombra plantilla, beat y campo`,
      );
    }
    // Y una lista de siguientes, que es la otra forma de escribir lo mismo.
    const conLista = { ...buena, beats: buena.beats.map((b, i) => (i === 0 ? { ...b, resultado: { ...b.resultado, siguienteBeat: [2, 3] } } : b)) };
    assert.throws(() => validaPlantilla(conLista), /beat 1 de la plantilla/);
  });

  test('Ninguna aventura del catálogo pide una decisión', async () => {
    // Ni una transición emite el hecho que la ramificación necesitaría, y el tipo sigue
    // declarado: quitarlo rompería la reconstrucción de partidas futuras.
    assert.equal(HECHOS_QUE_EMITE.includes(HECHO_QUE_NADIE_EMITE), false);
    let recorridas = 0;
    for (const { clave, castean } of await losOchoCasteados()) {
      for (const c of castean.slice(0, 4)) {
        recorridas++;
        const { hechos } = recorreEntera(c, { minuto: conFranja(c) ? minutoDeLaFranja(c, true) : 0 });
        const decisiones = hechos.filter((h) => h.tipo === HECHO_QUE_NADIE_EMITE);
        assert.deepEqual(decisiones, [], `${clave} · ${c.plantilla}: recorrerla entera ha pedido ${decisiones.length} decisiones`);
        for (const h of hechos) assert.ok(HECHOS_QUE_EMITE.includes(h.tipo), `${clave} · ${c.plantilla}: el motor emitió el hecho "${h.tipo}", que no está entre los suyos`);
      }
    }
    assert.ok(recorridas >= 30, `solo se han recorrido ${recorridas} aventuras enteras`);
  });
});

// ── La franja es del beat, y llegar tarde no cancela nada ──────────────────────
//
// RF-QUEST-004 está marcado «⚠ sin escenario (franjas)» en docs/prd.md §4.2: estos casos
// lo cubren y van declarados como hueco de la batería.

describe('La franja es del beat y llegar fuera no cancela nada', () => {
  test('Fallar por no llegar es casi imposible', async () => {
    const c = await unaAventura(conFranja);
    const beat = c.beats.find((b) => b.disparador.tipo === 'franja');

    const dentro = recorreEntera(c, { minuto: minutoDentroDe(beat.disparador.franja) });
    const fuera = recorreEntera(c, { minuto: minutoFueraDe(beat.disparador.franja) });

    // Los dos ciclos enteros, lado a lado. Lo único que puede diferir es la variante.
    const sinVariante = (pasos) => pasos.map((p) => ({ ...p, variante: null }));
    assert.deepEqual(sinVariante(fuera.pasos), sinVariante(dentro.pasos), 'llegar fuera de la franja cambia algo más que la variante de escena');
    assert.deepEqual(fuera.cerrada, dentro.cerrada, 'llegar fuera de la franja cambia cómo acaba la aventura');
    assert.deepEqual(fuera.hechos, dentro.hechos, 'llegar fuera de la franja cambia el registro de hechos');

    // Y difiere: si no, la franja no ambientaría nada.
    const vDentro = dentro.pasos.find((p) => p.beat === beat.n).variante;
    const vFuera = fuera.pasos.find((p) => p.beat === beat.n).variante;
    assert.equal(vDentro, 'dentro');
    assert.equal(vFuera, 'fuera');

    // El beat sigue resolviéndose y la aventura sigue terminando.
    assert.equal(fuera.cerrada.comoAcabo, COMO_ACABO.TERMINADA, 'recorrer la aventura llegando siempre fuera de franja no la termina');
    assert.equal(fuera.cerrada.desenlace, 'el-desenlace', 'una aventura terminada fuera de franja recibe un cierre en corto en lugar de su desenlace');
    assert.equal(fuera.cerrada.motivo, null);
  });

  test('Ninguna plantilla con franja se bloquea llegando siempre fuera', async () => {
    let conFranjaVistas = 0;
    for (const { clave, castean } of await losOchoCasteados()) {
      for (const c of castean.filter(conFranja)) {
        conFranjaVistas++;
        const minuto = minutoDeLaFranja(c, false);
        const { pasos, cerrada } = recorreEntera(c, { minuto });
        assert.equal(pasos.length, c.beats.length, `${clave} · ${c.plantilla}: llegando fuera de franja se han resuelto ${pasos.length} de ${c.beats.length} beats`);
        assert.equal(cerrada.comoAcabo, COMO_ACABO.TERMINADA, `${clave} · ${c.plantilla}: llegando siempre fuera de franja la aventura queda a medias`);
      }
    }
    assert.ok(conFranjaVistas > 0, 'ninguna aventura casteada lleva franja: el caso no comprueba nada');
  });

  test('La variante de fuera de franja no reprocha nada', () => {
    let variantes = 0;
    for (const plantilla of CATALOGO) {
      for (const [i, b] of plantilla.beats.entries()) {
        if (b.disparador.tipo !== 'franja') continue;
        variantes++;
        const infracciones = infraccionesDeReproche(b.disparador.varianteFuera);
        assert.deepEqual(
          [...infracciones], [],
          `la plantilla "${plantilla.id}" beat ${i + 1} reprocha llegar tarde: ${infracciones.map((x) => `"${x.fragmento}" (${x.formula})`).join(', ')}`,
        );
      }
    }
    assert.ok(variantes > 0, 'ninguna plantilla del catálogo tiene beats de franja: el vocabulario de reproche no se está midiendo');
    // Y el filtro muerde: un texto con reproche se detecta, palabra a palabra.
    for (const palabra of VOCABULARIO_DE_REPROCHE) {
      const inventado = `Ya se ha ido. ${palabra[0].toUpperCase()}${palabra.slice(1)} eso lo cambia todo.`;
      assert.ok(infraccionesDeReproche(inventado).length, `la palabra de reproche "${palabra}" no se detecta: el criterio no se puede poner rojo`);
    }
  });

  test('Un beat de franja sin variante de fuera falla nombrando la plantilla y el beat', () => {
    const conFranjaEnCatalogo = CATALOGO.find((p) => p.beats.some((b) => b.disparador.tipo === 'franja'));
    assert.ok(conFranjaEnCatalogo, 'ninguna plantilla del catálogo tiene franja');
    const i = conFranjaEnCatalogo.beats.findIndex((b) => b.disparador.tipo === 'franja');
    for (const sinTexto of [undefined, null, '', '   ']) {
      const rota = {
        ...conFranjaEnCatalogo,
        beats: conFranjaEnCatalogo.beats.map((b, k) => (k === i ? { ...b, disparador: { ...b.disparador, varianteFuera: sinTexto } } : b)),
      };
      assert.throws(
        () => validaPlantilla(rota),
        (e) => e.message.includes(conFranjaEnCatalogo.id) && e.message.includes(`beat ${i + 1}`),
        `una plantilla con la variante de fuera ${JSON.stringify(sinTexto)} se ha validado, o el error no nombra plantilla y beat`,
      );
    }
    // Y el beat ya casteado que llegara sin ella tampoco se resuelve con el texto de dentro.
    const beat = {
      n: 1, lugar: { nombre: 'X' }, escena: { tipo: 'encuentro', texto: 'a' }, resultado: { tipo: 'informacion', siguienteBeat: null }, guiado: { destino: 'X', calzadas: [], marca: {} },
      disparador: { tipo: 'franja', franja: { id: 'tarde', desdeMin: 960, hastaMin: 1200 }, variantes: { dentro: 'la de dentro', fuera: null } },
    };
    assert.throws(
      () => varianteDelBeat({ beat, reloj: relojDePared(minutoFueraDe({ desdeMin: 960, hastaMin: 1200 })) }),
      /no trae escrita su variante de fuera/,
    );
  });

  test('La franja de noche cuenta dentro a las once y media y a las dos', () => {
    const noche = FRANJAS.find((f) => f.id === 'noche');
    const beat = {
      n: 1, lugar: { nombre: 'X' }, escena: { tipo: 'encuentro', texto: 'a' }, resultado: { tipo: 'informacion', siguienteBeat: null }, guiado: { destino: 'X', calzadas: [], marca: {} },
      disparador: { tipo: 'franja', franja: { ...noche }, variantes: { dentro: 'la de dentro', fuera: 'la de fuera' } },
    };
    for (const minuto of [23 * 60 + 30, 2 * 60]) {
      const v = varianteDelBeat({ beat, reloj: relojDePared(minuto) });
      assert.equal(v.variante, 'dentro', `las ${Math.floor(minuto / 60)}:${String(minuto % 60).padStart(2, '0')} quedan fuera de la franja de noche, que cruza la medianoche`);
      assert.equal(v.texto, 'la de dentro');
    }
    // Y el mediodía sí queda fuera, que es lo que hace que el caso no pase por casualidad.
    assert.equal(varianteDelBeat({ beat, reloj: relojDePared(12 * 60) }).variante, 'fuera');
  });

  test('Un beat sin franja no consulta el reloj de pared', async () => {
    const c = await unaAventura((x) => x.beats.every((b) => b.disparador.tipo !== 'franja'));
    const reloj = relojDePared(1297);
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    for (const beat of c.beats) resuelveBeat(estado, { beat, reloj, tenencia: SIN_OBJETOS });
    assert.deepEqual(reloj.llamadas, [], `el reloj se ha consultado ${reloj.llamadas.length} veces en una aventura sin un solo beat de franja`);
  });
});

// ── La aventura en curso: aceptar, recorrer y declarar cómo acabó ──────────────

describe('El motor de la aventura en curso', () => {
  test('Aceptar deja la aventura en curso en su primer beat y sin ninguno resuelto', async () => {
    const c = await unaAventura();
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    assert.equal(hayAventuraEnCurso(estado), false);
    assert.deepEqual([...aventurasCerradas(estado)], []);

    const en = acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    assert.equal(en.aventura, c.aventura.id);
    assert.equal(en.plantilla, c.aventura.plantilla);
    assert.equal(en.mapa, MAPA);
    assert.equal(en.beatEnCurso, 1);
    assert.deepEqual([...en.resueltos], []);
    assert.equal(hayAventuraEnCurso(estado), true);

    // Exactamente un hecho, con el identificador de la aventura dentro.
    const hechos = hechosDe(registro);
    assert.equal(hechos.length, 1);
    assert.equal(hechos[0].tipo, 'aventura-aceptada');
    assert.equal(hechos[0].carga.aventura, c.aventura.id);
    assert.equal(hechos[0].carga.plantilla, c.aventura.plantilla);

    // Y con una en curso no se acepta otra en silencio: falla nombrando la que está.
    const otra = await unaAventura((x) => x.plantilla !== c.plantilla);
    assert.throws(
      () => acepta(estado, { aventura: otra.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 }),
      (e) => e.message.includes(c.aventura.id) && e.message.includes(otra.aventura.id),
    );
  });

  test('Resolver el beat que toca avanza y anota la vía y la variante', async () => {
    const c = await unaAventura(conFranja);
    const beatDeFranja = c.beats.find((b) => b.disparador.tipo === 'franja');
    const { estado, pasos } = recorreEntera(c, { minuto: minutoDentroDe(beatDeFranja.disparador.franja), hastaBeat: c.beats.length - 1 });
    // El último ciclo cerró: se rehace a mano para poder mirar el estado a mitad.
    const est = estadoDeAventuras();
    const reg = registroInicial();
    acepta(est, { aventura: c.aventura, mapaId: MAPA, registro: reg, dia: 1, paso: 0 });
    const reloj = relojDePared(minutoDentroDe(beatDeFranja.disparador.franja));
    resuelveBeat(est, { beat: c.beats[0], reloj });
    const enCurso = aventuraEnCurso(est);
    assert.equal(enCurso.beatEnCurso, 2, 'resolver el primer beat no ha dejado el segundo como el que toca');
    assert.equal(enCurso.resueltos.length, 1);
    assert.deepEqual(Object.keys(enCurso.resueltos[0]).sort(), ['n', 'objeto', 'variante', 'via']);
    assert.equal(enCurso.resueltos[0].n, 1);
    // La variante queda anotada donde toca, y solo en los beats que tienen franja.
    const anotadas = pasos.map((p) => p.variante);
    assert.equal(anotadas.filter((v) => v !== null).length, 1, 'la variante se ha anotado en beats que no tienen franja');
    assert.equal(estado.enCurso, null, 'el ciclo de referencia no ha cerrado la aventura');
  });

  test('Resolver el beat que no toca falla nombrando el que llegó y el que se esperaba', async () => {
    const c = await unaAventura();
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    const reloj = relojDePared(0);
    const elQueNoToca = c.beats[c.beats.length - 1];
    assert.throws(
      () => resuelveBeat(estado, { beat: elQueNoToca, reloj }),
      (e) => e.message.includes(`beat ${elQueNoToca.n}`) && e.message.includes('el que toca es el 1') && e.message.includes(c.aventura.id),
      'resolver un beat que no toca no falla nombrando los dos',
    );
    // Y no ha avanzado.
    const enCurso = aventuraEnCurso(estado);
    assert.equal(enCurso.beatEnCurso, 1);
    assert.deepEqual([...enCurso.resueltos], []);
    assert.equal(hechosDe(registro).length, 1, 'un beat rechazado ha dejado hecho');
  });

  test('Resolver dos veces el mismo beat no cambia nada ni duplica ningún hecho', async () => {
    const c = await unaAventura();
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    const reloj = relojDePared(0);
    const primera = resuelveBeat(estado, { beat: c.beats[0], reloj });
    const antes = congelaAventuras(estado);
    const hechosAntes = hechosDe(registro);

    const segunda = resuelveBeat(estado, { beat: c.beats[0], reloj });
    assert.equal(primera.yaEstaba, false);
    assert.equal(segunda.yaEstaba, true, 'la segunda resolución del mismo beat no se declara como repetición');
    assert.equal(segunda.via, primera.via);
    assert.equal(segunda.variante, primera.variante);
    assert.equal(segunda.siguienteBeat, primera.siguienteBeat);
    assert.deepEqual(congelaAventuras(estado), antes, 'repetir un beat ha movido el estado');
    assert.deepEqual(hechosDe(registro), hechosAntes, 'repetir un beat ha duplicado algún hecho');
  });

  test('Con el último beat resuelto la aventura queda terminada con el desenlace de su plantilla', async () => {
    const c = await unaAventura();
    const { estado, cerrada, hechos } = recorreEntera(c, { desenlace: 'lo-que-dice-la-plantilla' });
    assert.equal(cerrada.comoAcabo, COMO_ACABO.TERMINADA);
    assert.equal(cerrada.desenlace, 'lo-que-dice-la-plantilla');
    assert.equal(cerrada.motivo, null, 'una aventura terminada arrastra un motivo de abandono');
    assert.equal(cerrada.resueltos, c.beats.length);
    assert.equal(hayAventuraEnCurso(estado), false);
    assert.equal(aventurasCerradas(estado).length, 1);

    const cierres = hechos.filter((h) => h.tipo === 'aventura-cerrada');
    assert.equal(cierres.length, 1, `hay ${cierres.length} hechos de cierre y tiene que haber exactamente uno`);
    assert.equal(cierres[0].carga.aventura, c.aventura.id);
    assert.equal(hechos.filter((h) => h.tipo === 'aventura-abandonada').length, 0);
  });

  test('Con beats sin resolver la aventura queda a medias, con cuántos se resolvieron y qué se consiguió', async () => {
    const c = await unaAventura((x) => x.beats.some((b) => b.resultado.objeto));
    const { cerrada, hechos } = recorreEntera(c, { hastaBeat: 1, motivo: 'me volví' });
    assert.equal(cerrada.comoAcabo, COMO_ACABO.A_MEDIAS);
    assert.equal(cerrada.desenlace, null, 'una aventura a medias se lleva el desenlace de la terminada');
    assert.equal(cerrada.resueltos, 1);
    assert.deepEqual([...cerrada.conseguido], c.beats.slice(0, 1).map((b) => b.resultado.objeto).filter(Boolean));

    const abandonos = hechos.filter((h) => h.tipo === 'aventura-abandonada');
    assert.equal(abandonos.length, 1);
    assert.equal(abandonos[0].carga.aventura, c.aventura.id);
    assert.equal(hechos.filter((h) => h.tipo === 'aventura-cerrada').length, 0);

    // Y con cero beats resueltos también queda a medias, y **no se borra**.
    const enCero = recorreEntera(c, { hastaBeat: 0 });
    assert.equal(enCero.cerrada.comoAcabo, COMO_ACABO.A_MEDIAS);
    assert.equal(enCero.cerrada.resueltos, 0);
    assert.equal(aventurasCerradas(enCero.estado).length, 1, 'cerrar con cero beats resueltos ha borrado la aventura en lugar de declararla a medias');
    assert.deepEqual([...IDS_DE_COMO_ACABO], ['a-medias', 'terminada']);
  });

  test('Una aventura ya cerrada falla nombrando la aventura y su estado', async () => {
    const c = await unaAventura();
    const { estado } = recorreEntera(c);
    assert.throws(
      () => resuelveBeat(estado, { beat: c.beats[0], reloj: relojDePared(0) }),
      (e) => e.message.includes(c.aventura.id) && e.message.includes(COMO_ACABO.TERMINADA),
      'resolver un beat de una aventura cerrada no falla nombrando la aventura y cómo acabó',
    );
    // Y cerrarla dos veces tampoco la declara acabada dos veces.
    assert.throws(() => cierra(estado, { registro: registroInicial(), dia: 1, paso: 9 }), /no hay ninguna aventura en curso que cerrar/);
  });

  test('Una partida a medias se congela y se levanta idéntica', async () => {
    const c = await unaAventura(conFranja);
    const beatDeFranja = c.beats.find((b) => b.disparador.tipo === 'franja');
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    const reloj = relojDePared(minutoDentroDe(beatDeFranja.disparador.franja));
    resuelveBeat(estado, { beat: c.beats[0], reloj });

    const doc = congelaAventuras(estado);
    assert.equal(doc.enCurso.beatEnCurso, 2);
    const levantado = levantaAventuras(doc);
    assert.deepEqual(congelaAventuras(levantado), doc, 'el ida y vuelta del registro de aventuras no devuelve lo mismo');
    assert.equal(aventuraEnCurso(levantado).beatEnCurso, 2, 'la partida levantada no vuelve por el beat en el que se quedó');
    // Y sigue viva: el beat que toca se resuelve sobre el estado levantado.
    const siguiente = resuelveBeat(levantado, { beat: c.beats[1], reloj });
    assert.equal(siguiente.yaEstaba, false);
    assert.equal(siguiente.beat, 2);
  });

  test('El estado manda sobre el registro', async () => {
    // El área `aventuras` **se reproduce**: ya no está entre las que solo se reconocen.
    assert.equal(AREAS_QUE_NO_REPRODUCEN.includes('aventuras'), false, 'el área de aventuras sigue declarada como no reproducible');

    const c = await unaAventura();
    const registro = registroInicial();
    anexa(registro, [hecho({ tipo: 'aventura-aceptada', mapa: MAPA, dia: 1, paso: 0, carga: { aventura: c.aventura.id, plantilla: c.aventura.plantilla } })]);
    const r = reconstruye({ registro, semilla: SEMILLA_A });
    assert.ok(r.areas.reproducidas.includes('aventuras'), `el área de aventuras no se reproduce: reproducidas ${r.areas.reproducidas.join(', ')}`);
    assert.equal(r.areas.sinEstadoTodavia.includes('aventuras'), false, 'el hecho de aventura aceptada se reconoce pero no se aplica');
    assert.equal(r.estado.aventuras.enCurso.aventura, c.aventura.id);
    assert.equal(r.estado.aventuras.enCurso.plantilla, c.aventura.plantilla);

    // El límite declarado: por qué beat iba no deja hecho propio, así que vuelve por el
    // primero. Manda el estado guardado, y la diferencia se ve en lugar de inventarse.
    assert.equal(r.estado.aventuras.enCurso.beatEnCurso, 1, 'la reconstrucción se inventa por qué beat iba la aventura');

    // Un cierre sin su aceptación delante falla nombrando la aventura.
    const suelto = registroInicial();
    anexa(suelto, [hecho({ tipo: 'aventura-cerrada', mapa: MAPA, dia: 1, paso: 1, carga: { aventura: 'la-que-nadie-aceptó', desenlace: null } })]);
    assert.throws(() => reconstruye({ registro: suelto, semilla: SEMILLA_A }), /la-que-nadie-aceptó/);

    // Y el hecho que nadie emite no se reproduce en silencio.
    const conDecision = registroInicial();
    anexa(conDecision, [hecho({ tipo: HECHO_QUE_NADIE_EMITE, mapa: MAPA, dia: 1, paso: 1, carga: { aventura: 'a', beat: 'b', opcion: 'o' } })]);
    assert.throws(() => reconstruye({ registro: conDecision, semilla: SEMILLA_A }), /exclusión 9/);
  });

  test('La misma partida reproducida dos veces sale idéntica', async () => {
    const c = await unaAventura(conFranja);
    const minuto = minutoDeLaFranja(c, true);
    const una = recorreEntera(c, { minuto });
    const otra = recorreEntera(c, { minuto });
    assert.deepEqual(congelaAventuras(otra.estado), congelaAventuras(una.estado), 'dos partidas con las mismas entradas no dan el mismo estado');
    assert.deepEqual(otra.hechos, una.hechos, 'dos partidas con las mismas entradas no dan el mismo registro');
    assert.equal(
      JSON.stringify(congelaAventuras(otra.estado)), JSON.stringify(congelaAventuras(una.estado)),
      'el estado de las dos partidas no es idéntico byte a byte',
    );
  });

  test('La cadena de beats es determinista desde el mundo, que es por qué el estado guarda el avance', async () => {
    // La decisión del implementador es que el estado guarde `beatEnCurso` y `resueltos` y
    // no la cadena casteada, **porque la cadena se puede volver a derivar del mundo**.
    // Eso es una promesa hasta que se castea dos veces y se compara.
    const mundo = await mundoDe('costero', '1');
    let comparadas = 0;
    for (const c of mundo.casting.filter((x) => x.ok)) {
      const otraVez = castTemplate(mundo, c.tpl);
      assert.equal(otraVez.ok, true, `${c.plantilla}: volver a castear la misma plantilla contra el mismo mundo ya no castea`);
      assert.deepEqual(otraVez.beats, c.beats, `${c.plantilla}: volver a castear la misma plantilla contra el mismo mundo da otra cadena`);
      comparadas++;
    }
    assert.ok(comparadas >= 20, `solo se han comparado ${comparadas} cadenas`);

    // Y la única cosa del estado de la partida que entra en el casting —la tenencia— no
    // mueve la cadena: mueve **por qué vía se pasa**, que es otra cosa y además se vuelve
    // a decidir al resolver el beat.
    const conLlave = mundo.casting.find((x) => x.ok && conObjeto(x));
    const beat = conLlave.beats.find((b) => b.disparador.tipo === 'con_objeto');
    const objetos = estadoDeObjetos();
    guarda(objetos, objetoPersistente({ id: beat.disparador.objeto, clase: 'llave', dia: 1 }));
    const llevando = castTemplate(mundo, conLlave.tpl, mundo.seed, { tenencia: vistaDeTenencia(objetos) });
    const sinNada = castTemplate(mundo, conLlave.tpl);
    const sinVia = (beats) => beats.map((b) => ({ ...b, disparador: { ...b.disparador, via: null } }));
    assert.deepEqual(sinVia(llevando.beats), sinVia(sinNada.beats), 'llevar la llave cambia la cadena y no solo la vía');
    assert.notEqual(
      llevando.beats.find((b) => b.n === beat.n).disparador.via,
      sinNada.beats.find((b) => b.n === beat.n).disparador.via,
      'llevar la llave no cambia ni la vía: entonces el caso no comprueba nada',
    );
  });
});

// ── La escena — A4P3 ───────────────────────────────────────────────────────────

describe('La escena de un beat', () => {
  test('La escena lleva sitio, titular, situación, quien habla, su parlamento y el cierre', async () => {
    const c = await unaAventura();
    const beat = c.beats[0];
    // La cara llega con su **clave** de puesto —la de la partida y la de la memoria— y lo
    // que sale compuesto es el **rótulo de mundo** (SPEC-051): `ANXO O DO NORTE · REGENCIA`
    // sería una etiqueta de catálogo y no una presentación. Un puesto inventado ya no vale
    // como decorado, y es a propósito: sin rótulo declarado, componer revienta.
    const cara = { nombre: 'Sabela', puesto: 'regencia' };
    const escena = componeEscena({ beat, cara });

    assert.equal(escena.estado, ESTADOS_DE_ESCENA[0]);
    assert.equal(escena.sitio, beat.lugar.nombre, 'la escena no sitúa con el nombre de fantasía del sitio');
    assert.equal(escena.titular, marcoDeEscena(beat.escena.tipo).titular);
    assert.deepEqual(escena.cara, { nombre: 'Sabela', puesto: rotuloDePuesto('regencia') });
    assert.notEqual(escena.cara.puesto, cara.puesto, 'la clave interna del puesto ha salido compuesta tal cual');
    assert.equal(escena.cuerpo.forma, 'parlamento', 'con cara, el cuerpo no es parlamento');
    assert.ok(escena.cuerpo.texto, 'la escena no lleva texto');
    assert.equal(escena.cierre, cierreDeResultado(beat.resultado.tipo));
    assert.equal(escena.accion.verbo, marcoDeEscena(beat.escena.tipo).verbo);
    assert.notEqual(escena.accion.verbo, 'Continuar', 'la única acción se llama «Continuar», que es un botón de aplicación');

    // Ningún retrato, y ninguno de los otros elementos que la pantalla no lleva.
    assert.ok(LO_QUE_LA_ESCENA_NO_LLEVA.includes('retrato-de-la-cara'));
    for (const ausente of LO_QUE_LA_ESCENA_NO_LLEVA) {
      recorreDocumento(escena, (ruta) => {
        assert.equal(ruta.includes(ausente.replace(/-/g, '')), false, `la escena lleva "${ausente}" en ${ruta}`);
      });
    }
    const camposDeRetrato = ['retrato', 'foto', 'imagen', 'avatar'];
    recorreDocumento(escena, (ruta) => {
      for (const campo of camposDeRetrato) {
        assert.equal(new RegExp(`\\.${campo}$`, 'i').test(ruta), false, `la escena lleva un retrato en ${ruta}: los retratos son exclusión 6 del PRD`);
      }
    });
  });

  test('La escena sin cara pierde el bloque de la cara y no mueve nada más', async () => {
    const c = await unaAventura();
    const beat = c.beats[0];
    const conCara = componeEscena({ beat, cara: { nombre: 'Sabela', puesto: 'regencia' } });
    const sinCara = componeEscena({ beat });

    assert.equal(sinCara.cara, null);
    assert.equal(sinCara.cuerpo.forma, 'parrafo', 'sin cara, el cuerpo sigue siendo un parlamento');
    assert.deepEqual(Object.keys(sinCara), Object.keys(conCara), 'la escena sin cara tiene otros elementos, o en otro orden');
    for (const clave of Object.keys(conCara)) {
      if (clave === 'cara' || clave === 'cuerpo') continue;
      assert.deepEqual(sinCara[clave], conCara[clave], `quitar la cara ha movido "${clave}"`);
    }
    assert.equal(sinCara.cuerpo.texto, conCara.cuerpo.texto, 'quitar la cara ha cambiado el texto');

    // Y una cara sin puesto no se presenta a medias.
    assert.throws(() => componeEscena({ beat, cara: { nombre: 'Sabela' } }), /nombre y su puesto/);
  });

  test('Con LLM y sin LLM la estructura es idéntica', async () => {
    const c = await unaAventura();
    const beat = c.beats[0];
    const delModelo = 'Te espera con la caja en el regazo, como si pesara más de lo que pesa.';
    const conModelo = componeEscena({ beat, texto: delModelo, origenDelTexto: 'modelo' });
    const sinModelo = componeEscena({ beat });

    assert.equal(conModelo.cuerpo.texto, delModelo, 'con el texto del modelo residente se enseña otro');
    assert.equal(conModelo.cuerpo.origen, 'modelo', 'el origen del texto no queda declarado');
    assert.equal(sinModelo.cuerpo.origen, 'plantilla');
    assert.equal(sinModelo.cuerpo.texto, beat.escena.texto, 'sin el texto del modelo no se enseña el de la plantilla');

    // La composición es la misma: cambia el texto y su origen, y nada más.
    assert.deepEqual(Object.keys(conModelo), Object.keys(sinModelo));
    for (const clave of Object.keys(conModelo)) {
      if (clave === 'cuerpo' || clave === 'situacion') continue;
      assert.deepEqual(conModelo[clave], sinModelo[clave], `quitar el texto del modelo ha movido "${clave}"`);
    }
    assert.equal(conModelo.cuerpo.forma, sinModelo.cuerpo.forma);

    // Y ningún texto de la pantalla menciona que falte nada.
    const disculpas = /(sin (conexi|red|internet))|(no hay (conexi|red))|(offline)|(no disponible)|(fallback)|(por defecto)|(genérico)/i;
    for (const { ruta, valor } of textosDe(sinModelo)) {
      assert.equal(disculpas.test(valor), false, `la escena sin modelo se disculpa en ${ruta}: "${valor}"`);
    }
  });

  test('Sin el objeto hay otro camino al mismo beat', async () => {
    const c = await unaAventura(conObjeto);
    const beat = c.beats.find((b) => b.disparador.tipo === 'con_objeto');
    const objetos = estadoDeObjetos();
    guarda(objetos, objetoPersistente({ id: beat.disparador.objeto, clase: 'llave', dia: 1 }));
    const conLlave = vistaDeTenencia(objetos);

    // La escena se compone por las dos vías, y solo cambia el texto de la vía.
    const escenaCon = componeEscena({ beat, tenencia: conLlave });
    const escenaSin = componeEscena({ beat, tenencia: SIN_OBJETOS });
    assert.equal(escenaCon.via, 'objeto');
    assert.equal(escenaSin.via, 'alternativa');
    for (const clave of Object.keys(escenaCon)) {
      if (clave === 'via' || clave === 'cuerpo' || clave === 'situacion') continue;
      assert.deepEqual(escenaSin[clave], escenaCon[clave], `pasar sin la llave ha movido "${clave}" de la escena`);
    }

    // Y el beat se resuelve igual por las dos: mismo resultado y mismo beat siguiente.
    const anteponer = (tenencia) => {
      const estado = estadoDeAventuras();
      const registro = registroInicial();
      acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
      const reloj = relojDePared(conFranja(c) ? minutoDeLaFranja(c, true) : 0);
      const pasos = c.beats.map((b) => resuelveBeat(estado, { beat: b, reloj, tenencia }));
      return { pasos, cerrada: cierra(estado, { registro, dia: 1, paso: 9, desenlace: 'd' }) };
    };
    const con = anteponer(conLlave);
    const sin = anteponer(SIN_OBJETOS);
    const elDelObjeto = (r) => r.pasos.find((p) => p.beat === beat.n);
    assert.equal(elDelObjeto(sin).siguienteBeat, elDelObjeto(con).siguienteBeat, 'las dos vías no empujan al mismo beat siguiente');
    assert.equal(elDelObjeto(sin).objeto, elDelObjeto(con).objeto, 'las dos vías no dejan el mismo resultado');
    assert.notEqual(elDelObjeto(sin).via, elDelObjeto(con).via, 'la vía anotada es la misma con llave y sin ella');
    assert.deepEqual(sin.cerrada.comoAcabo, con.cerrada.comoAcabo, 'pasar sin la llave cambia cómo acaba la aventura');

    // La llave no se anuncia: ni candado, ni lista de requisitos, ni «necesitas».
    const anuncios = /(necesitas|hace falta|requier|candado|bloquead|no puedes pasar)/i;
    for (const { ruta, valor } of textosDe(escenaSin)) {
      assert.equal(anuncios.test(valor), false, `la escena sin la llave la anuncia en ${ruta}: "${valor}"`);
    }
  });

  test('La escena queda disponible y espera', async () => {
    // Componer la escena no resuelve nada: si lo hiciera, abrir la app sería una acción
    // de juego y cerrarla con la escena abierta dejaría el beat resuelto sin tocarlo.
    const c = await unaAventura();
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    const antes = congelaAventuras(estado);

    for (let i = 0; i < 3; i++) componeEscena({ beat: c.beats[0] });
    componeLoQueTeLlevas({ beat: c.beats[0], siguiente: c.beats[1] });
    assert.deepEqual(congelaAventuras(estado), antes, 'mirar la escena ha resuelto el beat');
    assert.deepEqual(hechosDe(registro).length, 1, 'mirar la escena ha dejado un hecho');

    // Y la escena sigue ahí: se compone otra vez igual.
    assert.deepEqual(componeEscena({ beat: c.beats[0] }), componeEscena({ beat: c.beats[0] }));
    // Y cuando en este sitio no hay ninguna escena, se declara: ni una pantalla en blanco.
    assert.deepEqual(sinEscena(), { estado: 'sin-escena', beat: null, accion: null });
    assert.deepEqual([...ESTADOS_DE_ESCENA], ['escena', 'lo-que-te-llevas', 'sin-escena']);
  });
});

// ── Lo que te llevas — A4P4 ────────────────────────────────────────────────────

describe('Lo que te llevas', () => {
  test('Lleva lo que se lleva, el empuje y el nombre del sitio siguiente con su marca', async () => {
    const c = await unaAventura();
    const pantalla = componeLoQueTeLlevas({ beat: c.beats[0], siguiente: c.beats[1] });
    assert.equal(pantalla.estado, ESTADOS_DE_ESCENA[1]);
    assert.equal(pantalla.rotulo, 'Llevas encima');
    assert.equal(pantalla.seLleva.tipo, c.beats[0].resultado.tipo);
    assert.equal(pantalla.seLleva.objeto, c.beats[0].resultado.objeto ?? null);
    assert.ok(pantalla.empuje, 'no hay párrafo que empuje al siguiente sitio');
    // Sin cara, el empuje se dice como párrafo — y la forma la decide la escena, no esta
    // pantalla (SPEC-051): las dos mitades de un paso son el mismo momento, así que el
    // mismo texto no puede leerse entrecomillado arriba y como narración un toque después.
    assert.equal(pantalla.forma, 'parrafo', 'sin cara, lo que te llevas no dice el empuje como párrafo');
    assert.equal(pantalla.siguienteSitio.nombre, c.beats[1].guiado.destino, 'el sitio siguiente no se nombra');
    assert.deepEqual(pantalla.siguienteSitio.marca, { ...c.beats[1].guiado.marca }, 'el sitio siguiente no lleva su marca en el mapa');
    assert.equal(pantalla.accion.verbo, 'Seguir andando');
    assert.equal(pantalla.ultimo, false);
  });

  test('En la pantalla de lo que te llevas no aparece ninguna cifra', async () => {
    let miradas = 0;
    for (const { clave, castean } of await losOchoCasteados()) {
      for (const c of castean.slice(0, 4)) {
        for (let i = 0; i < c.beats.length; i++) {
          const pantalla = componeLoQueTeLlevas({ beat: c.beats[i], siguiente: c.beats[i + 1] ?? null });
          miradas++;
          // Sobre los textos, que es lo que se lee: la marca del mapa lleva números
          // porque es una posición del mundo congelado y no una cifra en pantalla.
          for (const { ruta, valor } of textosDe(pantalla)) {
            if (ruta.startsWith('documento.siguienteSitio.marca')) continue;
            assert.equal(/\d/.test(valor), false, `${clave} · ${c.plantilla} beat ${i + 1}: la pantalla enseña una cifra en ${ruta}: "${valor}"`);
          }
          // Ni cuántos beats quedan, ni cuánto falta, ni cuánto oro.
          recorreDocumento(pantalla, (ruta) => {
            assert.equal(/(quedan|restan|progreso|porcentaje|oro|distancia|metros|minutos)/i.test(ruta), false, `${clave} · ${c.plantilla}: la pantalla lleva "${ruta}"`);
          });
        }
      }
    }
    assert.ok(miradas >= 80, `solo se han mirado ${miradas} pantallas de resultado`);
  });

  test('El último beat no nombra ningún sitio siguiente y la aventura queda lista para cerrarse', async () => {
    const c = await unaAventura();
    const ultimo = c.beats[c.beats.length - 1];
    const pantalla = componeLoQueTeLlevas({ beat: ultimo });
    assert.equal(pantalla.ultimo, true);
    assert.equal(pantalla.siguienteSitio, null, 'el último beat nombra un sitio siguiente que no existe');
    assert.equal(pantalla.accion.verbo, 'Seguir andando', 'la acción del último beat es otra');

    // Y aun pasándole un siguiente, no lo enseña: quien pinta no puede inventarse uno.
    assert.equal(componeLoQueTeLlevas({ beat: ultimo, siguiente: c.beats[0] }).siguienteSitio, null);

    const { pasos } = recorreEntera(c);
    const final = pasos[pasos.length - 1];
    assert.equal(final.siguienteBeat, null);
    assert.equal(final.terminada, true, 'resolver el último beat no deja la aventura lista para cerrarse');
  });
});

// ── Modo compañía: escrito para leerse en voz alta ─────────────────────────────
//
// RF-PJ-009 está marcado «⚠ sin escenario» en docs/prd.md §4.8: estos casos lo cubren y
// van declarados como hueco de la batería.

describe('Modo compañía', () => {
  test('Ningún texto de escena del catálogo lleva nada que no se lea en voz alta', () => {
    let textos = 0;
    for (const plantilla of CATALOGO) {
      for (const [i, b] of plantilla.beats.entries()) {
        const suyos = [
          ['texto', b.texto],
          ['variante de dentro', b.disparador.variante],
          ['variante de fuera', b.disparador.varianteFuera],
          ['vía alternativa', b.disparador.viaAlternativa?.texto],
        ].filter(([, t]) => typeof t === 'string' && t);
        for (const [que, t] of suyos) {
          textos++;
          const infracciones = infraccionesDeLecturaEnVozAlta(t);
          assert.deepEqual(
            [...infracciones], [],
            `la plantilla "${plantilla.id}" beat ${i + 1}, ${que}: ${infracciones.map((x) => `"${x.fragmento}" (${x.formula})`).join(', ')}`,
          );
        }
      }
    }
    assert.ok(textos >= 100, `solo se han revisado ${textos} textos de escena`);

    // Y los marcos y los cierres, que también se leen en voz alta.
    for (const [tipo, marco] of Object.entries(MARCOS_DE_ESCENA)) {
      assert.deepEqual([...infraccionesDeLecturaEnVozAlta(marco.titular)], [], `el titular de la escena "${tipo}" no se lee en voz alta`);
      assert.deepEqual([...infraccionesDeLecturaEnVozAlta(marco.verbo)], [], `el verbo de la escena "${tipo}" no se lee en voz alta`);
    }
    for (const [tipo, cierre] of Object.entries(CIERRES_POR_RESULTADO)) {
      assert.deepEqual([...infraccionesDeLecturaEnVozAlta(cierre)], [], `el cierre del resultado "${tipo}" no se lee en voz alta`);
    }
  });

  test('La comprobación de lectura en voz alta falla nombrando el texto y lo que encontró', () => {
    const casos = [
      ['Te da 3 monedas.', 'cifras'],
      ['Sube un 20% la cuesta.', 'sinVoz'],
      ['Está a 2 km del molino.', 'sinVoz'],
      ['Te lo dice él (o eso cree).', 'sinVoz'],
      ['Pregunta por el ADN del asunto.', 'sinVoz'],
      ['Trae pan, queso, etc. y una nota.', 'sinVoz'],
      ['Va y viene entre uno y otro.', null],
    ];
    for (const [texto, familia] of casos) {
      const infracciones = infraccionesDeLecturaEnVozAlta(texto);
      if (familia === null) {
        assert.deepEqual([...infracciones], [], `"${texto}" se marca como no legible en voz alta y sí lo es`);
        continue;
      }
      assert.ok(infracciones.length, `"${texto}" pasa la comprobación de lectura en voz alta`);
      assert.ok(infracciones.some((i) => i.familia === familia), `"${texto}": las infracciones no son de la familia "${familia}"`);
      for (const i of infracciones) {
        assert.ok(i.formula, `"${texto}": una infracción sin fórmula no dice qué encontró`);
        assert.ok(i.fragmento, `"${texto}": una infracción sin fragmento no dice dónde`);
      }
    }
    // Las dos listas cerradas están y no son formas: nada de cazar la letra suelta.
    assert.ok(UNIDADES_ABREVIADAS.includes('km'));
    assert.ok(ABREVIATURAS.includes('etc.'));
    assert.deepEqual([...infraccionesDeLecturaEnVozAlta('La mano en el hombro, y a andar.')], [], 'una palabra corriente se cuela como abreviatura');
  });

  test('Ningún texto de escena del catálogo deja una ranura sin resolver', () => {
    const ranura = /(\{[^}]*\})|(\[\[[^\]]*\]\])|(<[a-zA-Z_][^>]*>)|(\$\{)|(%[a-z]+%)/;
    for (const plantilla of CATALOGO) {
      for (const [i, b] of plantilla.beats.entries()) {
        for (const t of [b.texto, b.disparador.variante, b.disparador.varianteFuera, b.disparador.viaAlternativa?.texto]) {
          if (typeof t !== 'string' || !t) continue;
          assert.equal(ranura.test(t), false, `la plantilla "${plantilla.id}" beat ${i + 1} deja una ranura sin resolver: "${t}"`);
        }
      }
    }
  });

  test('El único registro de aplicación de la escena es el tamaño de letra', async () => {
    const c = await unaAventura();
    const escena = componeEscena({ beat: c.beats[0], cara: { nombre: 'Sabela', puesto: 'regencia' } });
    // La escala tiene tres escalones, con nombre y sin cifras, y empieza por el primero.
    assert.equal(ESCALA_DE_TEXTO.length, 3);
    assert.deepEqual([...IDS_DE_TAMANO_DE_TEXTO], ['normal', 'grande', 'muy-grande']);
    for (const id of IDS_DE_TAMANO_DE_TEXTO) assert.equal(/\d/.test(id), false, `el escalón "${id}" lleva una cifra en su nombre`);
    assert.equal(escena.tamanoDeTexto, TAMANO_DE_TEXTO_DE_ORIGEN, 'la escena no empieza en el escalón de origen');

    // El factor es para quien pinta y no sale a pantalla.
    assert.equal(factorDeTamano('normal'), 1);
    assert.ok(factorDeTamano('muy-grande') > factorDeTamano('grande'));

    // El toque es cíclico y vuelve al principio al pasarse.
    let id = TAMANO_DE_TEXTO_DE_ORIGEN;
    const recorrido = [id];
    for (let i = 0; i < IDS_DE_TAMANO_DE_TEXTO.length; i++) {
      id = siguienteTamanoDeTexto(id);
      recorrido.push(id);
    }
    assert.deepEqual(recorrido, ['normal', 'grande', 'muy-grande', 'normal']);

    // Ni la etiqueta ni la ayuda mencionan accesibilidad, dificultad de lectura ni modo.
    const prohibido = /(accesibilidad|accesible|dificultad|discapacidad|visión|vista cansada|modo)/i;
    for (const [que, texto] of Object.entries(TEXTOS_DEL_TAMANO)) {
      assert.equal(prohibido.test(texto), false, `la ${que} del control de tamaño dice "${texto}"`);
    }
    // Y es el único elemento de la escena que no es voz del mundo.
    assert.equal(TESTIDS.tamanoDeTexto, 'escena-tamano-texto');
    assert.deepEqual(Object.values(TESTIDS).slice().sort(), [
      'escena', 'escena-accion', 'escena-cara', 'escena-estado', 'escena-tamano-texto', 'escena-texto', 'lo-que-te-llevas', 'siguiente-sitio',
    ]);
  });

  test('Un tamaño de letra fuera de la escala falla nombrando el valor y la escala', async () => {
    const c = await unaAventura();
    for (const malo of ['gigante', 'XL', '', null, undefined, 2, 'NORMAL']) {
      assert.throws(
        () => exigeTamanoDeTexto(malo),
        (e) => e.message.includes(IDS_DE_TAMANO_DE_TEXTO.join(', ')),
        `el tamaño ${JSON.stringify(malo)} se ha aceptado, o el error no enumera la escala`,
      );
      // `undefined` es la ausencia del argumento y cae al escalón de origen, que es lo
      // que hace que nadie tenga que elegir nada para leer: no es un valor fuera de la
      // escala, así que el que se comprueba en la escena es cualquier otro.
      if (malo === undefined) continue;
      assert.throws(() => componeEscena({ beat: c.beats[0], tamanoDeTexto: malo }), /escala declarada/);
    }
    assert.equal(componeEscena({ beat: c.beats[0], tamanoDeTexto: undefined }).tamanoDeTexto, TAMANO_DE_TEXTO_DE_ORIGEN);
    // Y el escalón elegido viaja con la escena, que es lo que hace que persista.
    for (const id of IDS_DE_TAMANO_DE_TEXTO) {
      assert.equal(componeEscena({ beat: c.beats[0], tamanoDeTexto: id }).tamanoDeTexto, id);
    }
    // Cambiarlo no cambia nada más de la escena: el texto es el mismo y solo se pinta mayor.
    const normal = componeEscena({ beat: c.beats[0], tamanoDeTexto: 'normal' });
    const grande = componeEscena({ beat: c.beats[0], tamanoDeTexto: 'muy-grande' });
    for (const clave of Object.keys(normal)) {
      if (clave === 'tamanoDeTexto') continue;
      assert.deepEqual(grande[clave], normal[clave], `cambiar el tamaño de letra ha movido "${clave}"`);
    }
  });
});

// ── Nada degrada por falta de cableado (§6h) ───────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  test('Sin el reloj de pared, un beat de franja falla nombrando el reloj', async () => {
    const c = await unaAventura(conFranja);
    const beat = c.beats.find((b) => b.disparador.tipo === 'franja');
    for (const sinReloj of [null, undefined, {}, 'las cinco']) {
      assert.throws(
        () => varianteDelBeat({ beat, reloj: sinReloj }),
        (e) => /reloj de pared/.test(e.message) && e.message.includes(beat.disparador.franja.id),
        `el reloj ${JSON.stringify(sinReloj)} se ha aceptado, o el error no nombra el reloj y la franja`,
      );
      assert.throws(() => componeEscena({ beat, reloj: sinReloj }), /reloj de pared/);
    }
    // Y el motor tampoco resuelve el beat como si hubiera llegado dentro.
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    for (const b of c.beats.slice(0, beat.n - 1)) resuelveBeat(estado, { beat: b, reloj: relojDePared(0) });
    assert.throws(() => resuelveBeat(estado, { beat }), /reloj de pared/);
    assert.equal(aventuraEnCurso(estado).beatEnCurso, beat.n, 'el beat de franja sin reloj ha avanzado igual');

    // Un reloj que devuelve algo que no es un minuto del día tampoco cuela.
    for (const valor of [-1, 1440, 12.5, '600', null]) {
      assert.throws(() => varianteDelBeat({ beat, reloj: relojRoto(valor) }), /minuto/);
    }
  });

  test('Sin la vista de tenencia, un beat con objeto falla nombrando la tenencia', async () => {
    const c = await unaAventura(conObjeto);
    const beat = c.beats.find((b) => b.disparador.tipo === 'con_objeto');
    for (const sinTenencia of [null, undefined, {}, []]) {
      assert.throws(
        () => componeEscena({ beat, tenencia: sinTenencia }),
        (e) => /vista de tenencia/.test(e.message) && e.message.includes(`beat ${beat.n}`),
        `la tenencia ${JSON.stringify(sinTenencia)} se ha aceptado en la escena`,
      );
    }
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    const reloj = relojDePared(conFranja(c) ? minutoDeLaFranja(c, true) : 0);
    for (const b of c.beats.slice(0, beat.n - 1)) resuelveBeat(estado, { beat: b, reloj });
    assert.throws(() => resuelveBeat(estado, { beat, reloj }), /vista de tenencia/);
    assert.equal(aventuraEnCurso(estado).beatEnCurso, beat.n, 'el beat con objeto sin tenencia ha avanzado eligiendo la vía alternativa por defecto');
  });

  test('Sin el registro de hechos, aceptar una aventura falla nombrando el registro', async () => {
    const c = await unaAventura();
    for (const sinRegistro of [null, undefined, {}, { hechos: 'ninguno' }]) {
      const estado = estadoDeAventuras();
      assert.throws(
        () => acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro: sinRegistro, dia: 1, paso: 0 }),
        (e) => /registro de hechos/.test(e.message) && e.message.includes(c.aventura.id),
        `el registro ${JSON.stringify(sinRegistro)} se ha aceptado`,
      );
      assert.equal(hayAventuraEnCurso(estado), false, 'aceptar sin registro ha dejado la aventura en curso igual');
    }
    // Y cerrar tampoco.
    const { estado, registro } = { estado: estadoDeAventuras(), registro: registroInicial() };
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    assert.throws(() => cierra(estado, { registro: null, dia: 1, paso: 9 }), /registro de hechos/);
    assert.equal(hayAventuraEnCurso(estado), true, 'cerrar sin registro ha cerrado la aventura igual');
  });

  test('La escena se compone sobre el beat casteado entero y no sobre una copia recortada', async () => {
    const c = await unaAventura();
    const beat = c.beats[0];
    for (const campo of ['n', 'lugar', 'disparador', 'escena', 'resultado', 'guiado']) {
      const recortado = { ...beat, [campo]: null };
      assert.throws(
        () => componeEscena({ beat: recortado }),
        (e) => e.message.includes(campo) && /beat casteado entero/.test(e.message),
        `la escena se ha compuesto sin "${campo}"`,
      );
      assert.throws(() => componeLoQueTeLlevas({ beat: recortado }), new RegExp(campo));
    }
    // Solo el texto no basta: es exactamente la copia recortada que §6h prohíbe.
    assert.throws(() => componeEscena({ beat: { texto: beat.escena.texto } }), /beat casteado entero/);
  });

  test('Toda escena del catálogo tiene marco, y una sin él pone el módulo rojo', () => {
    assert.equal(compruebaCoberturaDeMarcos(CATALOGO), true);
    assert.throws(() => marcoDeEscena('escena-que-nadie-declaró'), (e) => e.message.includes(ESCENAS_CON_MARCO[0]));
    assert.throws(
      () => compruebaCoberturaDeMarcos([{ id: 'inventada', beats: [{ escena: 'ninguna' }] }]),
      (e) => e.message.includes('inventada') && e.message.includes('beat 1'),
    );
    assert.throws(() => compruebaCoberturaDeMarcos([]), /catálogo de plantillas/);
    // Y los tres cierres, uno por resultado y ninguno más.
    assert.deepEqual(Object.keys(CIERRES_POR_RESULTADO).sort(), ['estado', 'informacion', 'objeto']);
    assert.throws(() => cierreDeResultado('gloria'), /gloria/);
  });
});

// ── Privacidad y red ──────────────────────────────────────────────────────────

describe('Privacidad y red', () => {
  test('Sin red, la aventura funciona entera', async () => {
    // Ni la escena ni el motor pueden pedir nada: el paquete no importa ningún cliente
    // de red, así que la única manera de que hubiera una petición sería un global.
    const globales = ['fetch', 'XMLHttpRequest', 'WebSocket'];
    const originales = globales.map((g) => [g, globalThis[g]]);
    const peticiones = [];
    for (const g of globales) {
      globalThis[g] = (...args) => {
        peticiones.push({ g, args });
        throw new Error(`la escena ha pedido algo por ${g}`);
      };
    }
    try {
      const c = await unaAventura(conFranja);
      const minuto = minutoDeLaFranja(c, false);
      const { estado, pasos, cerrada } = recorreEntera(c, { minuto });
      for (let i = 0; i < c.beats.length; i++) {
        componeEscena({ beat: c.beats[i], reloj: relojDePared(minuto) });
        componeLoQueTeLlevas({ beat: c.beats[i], siguiente: c.beats[i + 1] ?? null });
      }
      assert.equal(pasos.length, c.beats.length, 'sin red la aventura no se completa de principio a fin');
      assert.equal(cerrada.comoAcabo, COMO_ACABO.TERMINADA);
      assert.equal(hayAventuraEnCurso(estado), false);
    } finally {
      for (const [g, v] of originales) globalThis[g] = v;
    }
    assert.deepEqual(peticiones, [], `componer la escena y recorrer la aventura han hecho ${peticiones.length} peticiones de red`);
  });

  test('El minuto en que se resolvió un beat no está en el estado ni en el registro', async () => {
    const c = await unaAventura(conFranja);
    const beat = c.beats.find((b) => b.disparador.tipo === 'franja');
    // Un minuto que no se pueda confundir con nada: 1297 son las nueve y treinta y siete.
    const MINUTO = 1297;
    const estado = estadoDeAventuras();
    const registro = registroInicial();
    acepta(estado, { aventura: c.aventura, mapaId: MAPA, registro, dia: 1, paso: 0 });
    const reloj = relojDePared(MINUTO);
    for (const b of c.beats) resuelveBeat(estado, { beat: b, reloj });
    cierra(estado, { registro, dia: 1, paso: 9, desenlace: 'd' });
    assert.ok(reloj.llamadas.includes(MINUTO), 'el reloj no se ha llegado a consultar: el caso no comprueba nada');

    const doc = congelaAventuras(estado);
    for (const donde of [{ que: 'el estado', doc }, { que: 'el registro', doc: hechosDe(registro) }]) {
      recorreDocumento(donde.doc, (ruta, valor) => {
        assert.notEqual(valor, MINUTO, `${donde.que} guarda el minuto en que se resolvió el beat, en ${ruta}`);
        if (typeof valor === 'string') assert.equal(valor.includes(String(MINUTO)), false, `${donde.que} guarda el minuto dentro de un texto, en ${ruta}`);
      });
      // Y ningún campo que huela a hora, ni a coordenada.
      recorreDocumento(donde.doc, (ruta) => {
        assert.equal(/(minuto|hora|instante|timestamp|cuando|lat|lon|latitud|longitud|coord)/i.test(ruta), false, `${donde.que} lleva "${ruta}"`);
      });
    }
    // Lo que sí queda anotado es la variante que se leyó, que es lo que la pantalla usa.
    assert.equal(doc.enCurso, null);
    const resueltos = aventurasCerradas(estado);
    assert.equal(resueltos.length, 1);
    assert.equal(varianteDelBeat({ beat, reloj }).variante, 'dentro');
  });
});
