// SPEC-028 · La preparación (A2P5), el guion de las cinco pantallas y los dos silencios.
//
// Aquí se afirma la asimetría que es la fila entera: **la pantalla dice exactamente lo
// mismo con red y sin ella, y el dato no**. Dos composiciones —una con todo conseguido y
// otra sin nada— tienen que salir iguales byte a byte, mientras el resumen guarda el
// origen de cada texto y el motivo de cada ausencia. Si algún día dejaran de serlo, la
// igualdad se pone roja sin abrir un simulador.
//
// Y se afirma la frontera entre los dos silencios, que se parecen y no son el mismo:
//
// - **El silencio de diseño** (RNF-RED-001): sin cobertura, ninguna pantalla lo menciona.
// - **La degradación silenciosa** (§6h): una pieza que no está y no protesta. Prohibida, y
//   se comprueba haciendo fallar la construcción.
//
// La otra mitad del fichero es el guion: sin simulador, un criterio de contenido que solo
// se pueda leer en pantalla no se pone rojo nunca (§6o), así que «ningún texto lleva una
// cifra de distancia», «hablan como mundo» y «ninguno se disculpa» se comprueban aquí.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: los clientes se doblan, los
// datos de OSM salen de fixtures congelados y el día se inyecta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BLOQUES_DE_LA_PREPARACION,
  BLOQUES_QUE_LA_PREPARACION_NO_TIENE,
  componePreparacion,
  resumenDeLaPreparacion,
} from '../../packages/nucleo/partida/preparacion.js';
import {
  CLAVES_DE_AUSENCIA,
  MOTIVOS_DE_AUSENCIA,
  ORIGENES_DE_TEXTO,
  PRESUPUESTO_PREPARACION_MS,
} from '../../packages/nucleo/partida/recursos.js';
import {
  EXCEPCIONES_DE_VOZ,
  GUION,
  LINEAS_DE_LA_PREPARACION,
  PALABRAS_QUE_NO_SE_DICEN,
  PANTALLAS,
  disculpasDeTexto,
  guionDePantalla,
  medidaDe,
  revisaAptitud,
  revisaGuionDeAntesDeSalir,
  textoConSitio,
  textoDelGuion,
  textosDeAntesDeSalir,
  vozDeTexto,
} from '../../packages/nucleo/partida/guion-de-antes-de-salir.js';
import { cifrasDeTexto } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { creaFiltroDeAptitud } from '../../packages/nucleo/names/aptitud-de-texto.js';
import { componePortada } from '../../packages/nucleo/partida/portada.js';
import { componeFicha, componeLoQueHayHoy } from '../../packages/nucleo/partida/lo-que-hay-hoy.js';
import { estadoDeSalidaAbierta } from '../../packages/nucleo/partida/salida-abierta.js';
import { CATALOGO } from '../../packages/nucleo/quests/catalogo.js';
import { creaConseguidorDeRecursos } from '../../app/recursos/conseguidor.js';
import { DEL_NUCLEO, creaPreparacion } from '../../app/salida/preparacion.js';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import {
  MUNDO,
  NUCLEO_DE_LA_PREPARACION,
  PERSONAJE,
  TRAMO,
  calendarioEn,
  losOchoMundos,
  mundoCongeladoGenerado,
  mundoDeUnaSola,
  mundoSinRepartoPorElFiltro,
  TRAMO_SIN_REPARTO,
  textosDe,
} from './antes-de-salir-de-prueba.mjs';

// ── Dobles de la frontera ───────────────────────────────────────────────────────

/**
 * El conseguidor que nunca consigue nada: es la tarde sin cobertura.
 *
 * No devuelve un lote vacío —eso sería indistinguible de que no hubiera nada que pedir—
 * sino cada petición ausente **con su motivo**, que es lo que el dato tiene que guardar.
 */
const conseguidorSinCobertura = (motivo = MOTIVOS_DE_AUSENCIA.NO_SE_PUDO_PEDIR) => ({
  ilustracionesDeSalida: async (plan) => ({
    conseguidos: [],
    ausentes: plan.lote.map((e) => ({ familia: 'ilustracion', clave: e.clave, motivo })),
    llamadas: 1,
  }),
});

/** El conseguidor de una tarde con cobertura: todo lo del plan vuelve con su binario. */
const conseguidorGeneroso = () => ({
  ilustracionesDeSalida: async (plan) => ({
    conseguidos: plan.lote.map((e) => ({
      clave: e.clave,
      prompt: e.prompt,
      recurso: { uri: `almacen://${e.claveDeCache}`, bytes: 1024, tipo: 'webp' },
    })),
    ausentes: [],
    llamadas: 1,
  }),
});

/** Un narrador que responde a todo con la misma frase apta. */
const narradorQueResponde = () => async (peticion) => ({
  textos: Object.fromEntries((peticion?.huecos ?? []).map((h) => [h.clave ?? h, 'Una brisa serena empuja la puerta del molino y sigue camino.'])),
});

/** Una aventura de la lista de hoy sobre el mundo costero, con su plantilla del catálogo. */
async function unaAventura() {
  const mundo = await mundoCongeladoGenerado('costero', '1');
  const lista = componeLoQueHayHoy({ mundo, oficio: 'taberna', tramo: TRAMO, calendario: calendarioEn() });
  const entrada = lista.entradas[0];
  return {
    mundo,
    entrada,
    aventura: { id: entrada.id, tamano: entrada.tamano, beats: entrada.beats },
    plantilla: CATALOGO.find((p) => p.id === entrada.id),
  };
}

// ── La preparación ──────────────────────────────────────────────────────────────

describe('La preparación, y la red que no está', () => {
  test('La preparación enseña las tres líneas de SPEC-025 y la frase de contrato', () => {
    const pantalla = componePreparacion();
    assert.deepEqual(pantalla.bloques, [...BLOQUES_DE_LA_PREPARACION]);
    assert.equal(pantalla.titulo, 'Preparando la salida');
    assert.equal(pantalla.lineas.length, 3, 'las líneas de la preparación no son tres');
    assert.deepEqual(pantalla.lineas, LINEAS_DE_LA_PREPARACION.map((id) => textoDelGuion('a2p5', id)));
    assert.equal(pantalla.contrato, 'A partir de aquí no hace falta cobertura. Puedes meter el móvil en el bolsillo.');
    assert.equal(pantalla.listo, 'Listo. Vamos.');
    // Y de ella se sale a andar: esa es la última pantalla que pide atención.
    assert.equal(pantalla.dejaSalir, true);
  });

  test('La preparación no ofrece cancelar ni ningún indicador por recurso', () => {
    const pantalla = componePreparacion();
    for (const bloque of BLOQUES_QUE_LA_PREPARACION_NO_TIENE) {
      assert.equal(pantalla.bloques.includes(bloque), false, `la preparación monta "${bloque}"`);
      assert.equal(BLOQUES_DE_LA_PREPARACION.includes(bloque), false, `el vocabulario declara "${bloque}"`);
    }
    // Volver atrás desde aquí es «Otra cosa» en la ficha, un paso antes.
    assert.ok(BLOQUES_QUE_LA_PREPARACION_NO_TIENE.includes('cancelar'));
    assert.equal(pantalla.menciona, null, 'la pantalla menciona lo que faltó');
  });

  test('Sin cobertura, la preparación dice lo mismo', async () => {
    // La mitad barata: la composición no depende de lo conseguido, y se afirma comparando
    // las dos composiciones enteras.
    const conTodo = componePreparacion({ recursos: { ilustraciones: [{ clave: 'x' }], textos: [{ clave: 'y' }] } });
    const sinNada = componePreparacion({ recursos: null });
    assert.equal(JSON.stringify(sinNada), JSON.stringify(conTodo), 'la pantalla cambia según lo que se haya conseguido');

    // Y la de verdad: la tubería entera, una vez con todo y otra sin nada.
    const { aventura, plantilla, mundo } = await unaAventura();
    const conRed = await creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorGeneroso(), llamada: narradorQueResponde(), locale: 'gl' })
      .prepara({ aventura, plantilla, mundo });
    const sinRed = await creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorSinCobertura(), sinNarrador: true, locale: 'gl' })
      .prepara({ aventura, plantilla, mundo });

    assert.equal(JSON.stringify(sinRed.pantalla), JSON.stringify(conRed.pantalla), 'la preparación no dice lo mismo con red y sin ella');
    assert.equal(sinRed.pantalla.dejaSalir, true, 'sin cobertura la preparación no deja salir');

    // Y ninguna pantalla menciona la falta de red. La única pieza que nombra la cobertura
    // es la frase de contrato, que está declarada como excepción y promete que la red deja
    // de importar en lugar de avisar de que falta.
    for (const { ruta, texto } of textosDe(sinRed.pantalla)) {
      if (texto === sinRed.pantalla.contrato) continue;
      assert.deepEqual(vozDeTexto(texto), [], `la preparación menciona lo que no se menciona en ${ruta}: «${texto}»`);
    }
    assert.deepEqual(EXCEPCIONES_DE_VOZ, ['a2p5/contrato']);
  });

  test('Sin cobertura, el dato lo dice todo: cada texto con su origen y cada ausencia con su motivo', async () => {
    const { aventura, plantilla, mundo } = await unaAventura();
    const sinRed = await creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorSinCobertura(), sinNarrador: true, locale: 'gl' })
      .prepara({ aventura, plantilla, mundo });

    // El silencio es hacia quien juega, nunca hacia el dato.
    assert.ok(sinRed.resumen.textos > 0, 'la preparación sin cobertura no ha dejado ningún texto anotado');
    assert.equal(sinRed.resumen.deLlm, 0, 'sin cobertura hay textos anotados como del modelo');
    assert.equal(sinRed.resumen.dePlantilla, sinRed.resumen.textos);
    for (const [clave, origen] of Object.entries(sinRed.resumen.origenes)) {
      assert.equal(origen, 'plantilla', `el texto "${clave}" no queda anotado como de plantilla`);
    }
    assert.ok(sinRed.resumen.ausencias.length > 0, 'no ha quedado ninguna ausencia anotada');
    for (const ausencia of sinRed.resumen.ausencias) {
      assert.ok(CLAVES_DE_AUSENCIA.includes(ausencia.motivo), `la ausencia de "${ausencia.clave}" lleva el motivo "${ausencia.motivo}", que no está declarado`);
      assert.ok(ausencia.clave, 'una ausencia sin clave no dice de qué es');
    }

    // Con cobertura, el mismo resumen dice otra cosa: es la asimetría entera.
    const conRed = await creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorGeneroso(), llamada: narradorQueResponde(), locale: 'gl' })
      .prepara({ aventura, plantilla, mundo });
    assert.deepEqual(conRed.resumen.ausencias, [], 'con cobertura queda alguna ausencia anotada');
    assert.notEqual(JSON.stringify(conRed.resumen), JSON.stringify(sinRed.resumen), 'el resumen es el mismo con red y sin ella: el dato tampoco lo dice');
  });

  test('Una preparación que se pasa de su presupuesto sale igual con lo que haya', async () => {
    const { aventura, plantilla, mundo } = await unaAventura();
    // El motivo `tope` es el que declara «cabía preguntarlo pero no cabía»: lo que no entra
    // queda ausente con su motivo, y la pantalla no lo menciona.
    const alPasarse = await creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorSinCobertura(MOTIVOS_DE_AUSENCIA.TOPE), sinNarrador: true, locale: 'gl' })
      .prepara({ aventura, plantilla, mundo });

    assert.equal(alPasarse.pantalla.dejaSalir, true, 'pasarse del presupuesto deja la salida sin poder salir');
    assert.equal(JSON.stringify(alPasarse.pantalla), JSON.stringify(componePreparacion()), 'la pantalla cuenta que se pasó del presupuesto');
    assert.ok(alPasarse.ausencias.length > 0);
    for (const ausencia of alPasarse.ausencias) assert.equal(ausencia.motivo, MOTIVOS_DE_AUSENCIA.TOPE);
    // El presupuesto está declarado y no es un número suelto en medio del código.
    assert.ok(Number.isFinite(PRESUPUESTO_PREPARACION_MS) && PRESUPUESTO_PREPARACION_MS > 0);
    assert.equal(creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorSinCobertura(), sinNarrador: true }).presupuestoMs, PRESUPUESTO_PREPARACION_MS);
  });

  test('Una preparación con el cliente de imágenes sin cablear falla nombrando la pieza', () => {
    // La falta de red es un estado del mundo y la falta de cableado es una avería, y se
    // distinguen: la primera deja el recurso ausente con su motivo, la segunda no construye.
    assert.throws(
      () => creaConseguidorDeRecursos({ clienteDeFotos: { lote: async () => [] }, almacen: { guarda: async () => ({}) } }),
      (e) => {
        assert.match(e.message, /cliente de im[áa]genes|clienteDeImagenes/i);
        return true;
      },
      'el conseguidor se construye sin cliente de imágenes',
    );
    assert.throws(() => creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: null }), (e) => {
      assert.match(e.message, /conseguidor de recursos/);
      return true;
    });
    // El generador es una pieza inyectada desde SPEC-020, así que también se puede
    // olvidar: sin él, y con él a medias, hay que protestar al construir y nombrar lo
    // que falta. Un núcleo sin `redactaAventura` que construya reventaría a mitad de
    // una salida, que es tarde.
    assert.throws(() => creaPreparacion({ conseguidor: conseguidorSinCobertura(), sinNarrador: true }), /n[úu]cleo/);
    assert.ok(DEL_NUCLEO.length > 0);
    for (const nombre of DEL_NUCLEO) {
      assert.throws(
        () => creaPreparacion({
          nucleo: { ...NUCLEO_DE_LA_PREPARACION, [nombre]: undefined },
          conseguidor: conseguidorSinCobertura(),
          sinNarrador: true,
        }),
        new RegExp(nombre),
        `la preparación se ha construido con un núcleo sin "${nombre}"`,
      );
    }
    // Y el narrador se puede no tener, pero **se declara**: sin declararlo, olvidarlo y no
    // tenerlo serían la misma cosa y todos los textos saldrían de plantilla sin que nadie
    // lo hubiera decidido.
    assert.throws(() => creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorSinCobertura() }), /sinNarrador/);
    assert.ok(creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: conseguidorSinCobertura(), sinNarrador: true }));
    assert.throws(() => creaPreparacion({ nucleo: NUCLEO_DE_LA_PREPARACION, conseguidor: { pide: () => {} }, sinNarrador: true }), /ilustracionesDeSalida/);
  });

  test('Un origen de texto o un motivo de ausencia sin declarar falla enumerando el vocabulario', () => {
    assert.throws(() => resumenDeLaPreparacion({ textos: [{ clave: 'gancho', origen: 'inventado' }] }), (e) => {
      assert.match(e.message, /inventado/);
      for (const origen of ORIGENES_DE_TEXTO) assert.ok(e.message.includes(origen), `el error no enumera el origen "${origen}"`);
      return true;
    });
    assert.throws(() => resumenDeLaPreparacion({ ausencias: [{ familia: 'ilustracion', clave: 'x', motivo: 'porque-si' }] }), (e) => {
      assert.match(e.message, /porque-si/);
      for (const motivo of CLAVES_DE_AUSENCIA) assert.ok(e.message.includes(motivo), `el error no enumera el motivo "${motivo}"`);
      return true;
    });
    assert.deepEqual([...ORIGENES_DE_TEXTO], ['llm', 'plantilla']);
  });
});

// ── El guion de las cinco pantallas ─────────────────────────────────────────────

describe('Lo que ninguna de las cinco pantallas lleva', () => {
  test('Ningún texto lleva una cifra de distancia, de ritmo, de pasos ni de progreso', () => {
    for (const pieza of textosDeAntesDeSalir()) {
      const cifras = cifrasDeTexto(pieza.texto, { salvo: pieza.salvo ?? [] });
      assert.deepEqual(cifras, [], `${pieza.pantalla}/${pieza.id} lleva una cifra: «${pieza.texto}»`);
      // Y las únicas excepciones son la hora orientativa que `bucle-jugable.md` §3 pide al
      // lado de la palabra del mundo, siempre con su motivo escrito.
      if (pieza.salvo) {
        assert.deepEqual(pieza.salvo, ['tiempo'], `${pieza.pantalla}/${pieza.id} se salta una familia que no es el tiempo`);
        assert.equal(typeof pieza.porque, 'string', `${pieza.pantalla}/${pieza.id} se salta una familia sin decir por qué`);
      }
      // La distancia no se dice nunca, ni con excepción declarada.
      assert.deepEqual(cifrasDeTexto(pieza.texto, { salvo: ['tiempo', 'digitos', 'progreso'] }), [], `${pieza.pantalla}/${pieza.id} dice una distancia`);
    }
    // El oro sí es un número y sí se enseña donde toque, pero no en estas cinco pantallas.
    assert.equal(GUION.some((p) => typeof p.texto === 'string' && /\boro\b|monedas/i.test(p.texto)), false);
  });

  test('Los textos hablan como mundo: ninguno menciona la aplicación, la red ni los permisos', () => {
    for (const pieza of textosDeAntesDeSalir()) {
      const clave = `${pieza.pantalla}/${pieza.id}`;
      const fuera = vozDeTexto(pieza.texto);
      if (EXCEPCIONES_DE_VOZ.includes(clave)) {
        // La única excepción, declarada y con su motivo: promete que la red deja de
        // importar en lugar de avisar de que falta.
        assert.ok(fuera.length > 0, `${clave} está declarada como excepción de voz y no la necesita`);
        assert.equal(typeof pieza.porque, 'string');
        continue;
      }
      assert.deepEqual(fuera, [], `${clave} menciona lo que ninguna de estas pantallas menciona: «${pieza.texto}»`);
    }
    // Hoy hay una sola excepción, y que sea una sola es lo que se está afirmando: la
    // siguiente tendría que escribirse en la lista y se vería en el diff.
    assert.equal(EXCEPCIONES_DE_VOZ.length, 1);
    // La comprobación de la comprobación: la lista de palabras reconoce lo que busca.
    assert.ok(PALABRAS_QUE_NO_SE_DICEN.includes('cobertura'));
    assert.deepEqual(vozDeTexto('No hay cobertura, revisa los permisos de la app.'), ['app', 'cobertura', 'permisos']);
  });

  test('Ningún texto del guion se disculpa', () => {
    for (const pieza of textosDeAntesDeSalir()) {
      assert.deepEqual(disculpasDeTexto(pieza.texto), [], `${pieza.pantalla}/${pieza.id} se disculpa: «${pieza.texto}»`);
    }
  });

  test('El guion pasa el filtro de aptitud en masculino genérico y morfología inventada', () => {
    // El filtro llega inyectado porque vive en `names/` y depende del idioma; se revisan
    // los dos que el juego habla.
    for (const locale of ['es', 'gl']) {
      const problemas = revisaAptitud(creaFiltroDeAptitud({ locale }));
      assert.deepEqual(problemas, [], `el guion no pasa el filtro de aptitud en ${locale}: ${JSON.stringify(problemas)}`);
    }
    assert.throws(() => revisaAptitud(null), /filtro inyectado/);
  });

  test('El guion se revisa a sí mismo al cargarse, y sus consultas fallan nombrando lo que falta', () => {
    assert.deepEqual(revisaGuionDeAntesDeSalir(), [], 'el guion no pasa su propia revisión');
    // REEXPRESADO EN SPEC-042, y la reexpresión es el contenido del cambio. Hasta esta
    // fila A2P2 no existía y su guion habría sido texto sin pantalla; ahora su dueña la
    // entrega, así que el zurrón entra en la lista y **pasa por la misma revisión que las
    // otras cuatro**: ni una cifra, voz del mundo y ninguna disculpa, que es literalmente
    // lo que sus criterios afirman. La lista sigue siendo cerrada y sigue enumerándose
    // entera: lo que se afirma es que son estas cinco y ninguna más.
    assert.deepEqual([...PANTALLAS], ['a2p1', 'a2p2', 'a2p3', 'a2p4', 'a2p5'], 'A2P2 es de SPEC-042 y su guion vive aquí, con las otras cuatro');
    for (const pantalla of PANTALLAS) assert.ok(guionDePantalla(pantalla).length > 0);

    // Y una pantalla del artefacto que este guion no declara sigue fallando enumerando
    // las que sí: A2P6 no existe, y pedir su guion no puede devolver una lista vacía.
    assert.throws(() => guionDePantalla('a2p6'), (e) => {
      for (const pantalla of PANTALLAS) assert.ok(e.message.includes(pantalla), `el error no enumera "${pantalla}"`);
      return true;
    });
    assert.throws(() => textoDelGuion('a2p1', 'inventada'), /inventada/);
    // Una pieza sin texto propio dice de dónde sale el suyo, en vez de devolver vacío.
    assert.throws(() => textoDelGuion('a2p1', 'identidad'), /su contenido sale de/);
    assert.throws(() => textoConSitio('a2p4', 'vuelves', 'A Fonte'), /ning[uú]n hueco de sitio/);
    assert.throws(() => medidaDe('paseíto'), /paseíto/);
    assert.equal(medidaDe('un-momento'), 'Un momento');
  });

  test('Los textos de las cinco pantallas son los mismos en diez mundos distintos', async () => {
    // «Ninguno se vuelve falso en ninguno de ellos» se mecaniza así: ningún texto de estas
    // pantallas se recompone con datos del mundo, así que no puede volverse falso al
    // cambiar de mundo. Los ocho congelados —cuatro fixtures por dos semillas— y dos
    // sintéticos, que son los que producen los dos casos que los fixtures no dan.
    const mundos = [
      ...(await losOchoMundos()),
      { nombre: 'sintetico-una-sola', mundo: mundoDeUnaSola(), tramo: 1500 },
      { nombre: 'sintetico-sin-reparto', mundo: mundoSinRepartoPorElFiltro(), tramo: TRAMO_SIN_REPARTO, criterios: ['escalones'] },
    ];
    assert.equal(mundos.length, 10);

    let referencia = null;
    let conLista = 0;
    for (const { nombre, mundo, tramo = TRAMO, criterios = [] } of mundos) {
      const portada = componePortada({
        calendario: calendarioEn(),
        personaje: PERSONAJE,
        mundo: { ...MUNDO, titulo: `Reinos de ${nombre}` },
        salidas: estadoDeSalidaAbierta(),
      });
      const lista = componeLoQueHayHoy({ mundo, oficio: 'taberna', tramo, criterios, calendario: calendarioEn() });
      const ficha = lista.hayLista && lista.entradas[0].clase === 'aventura' ? componeFicha({ entrada: lista.entradas[0] }) : null;

      // Lo que esta fila escribe, junto: si algo de aquí dependiera del mundo, dos mundos
      // darían dos huellas distintas. La rama de la lista se compara aparte porque un
      // mundo sin reparto monta otros bloques, que es una decisión y no una variación.
      const huella = JSON.stringify({
        portada: [portada.miniatura.encabezado, ...portada.acciones.map((a) => a.texto), ...portada.puertas.map((p) => p.texto)],
        preparacion: componePreparacion(),
      });
      const deLaLista = lista.hayLista ? JSON.stringify([lista.titulo, lista.subtitulo, lista.andarSinNada]) : null;
      const deLaFicha = ficha ? JSON.stringify([ficha.pie.split(' · ').slice(-1)[0], ficha.empiezas.replace(ficha.primeraParada, '{sitio}'), ...ficha.acciones.map((a) => a.texto)]) : null;

      if (referencia === null) {
        assert.ok(deLaLista && deLaFicha, `el mundo de referencia "${nombre}" no compone lista ni ficha, así que no sirve de referencia`);
        referencia = { nombre, huella, deLaLista, deLaFicha };
      } else {
        assert.equal(huella, referencia.huella, `los textos de la portada y la preparación de "${nombre}" no son los de "${referencia.nombre}"`);
        if (deLaLista) assert.equal(deLaLista, referencia.deLaLista, `los textos de la lista de "${nombre}" no son los de "${referencia.nombre}"`);
        if (deLaFicha) assert.equal(deLaFicha, referencia.deLaFicha, `los textos de la ficha de "${nombre}" no son los de "${referencia.nombre}"`);
      }
      conLista += lista.hayLista ? 1 : 0;

      // Y en todos los mundos, sin excepción: ni una cifra de distancia ni una disculpa.
      const suyos = lista.hayLista
        ? [lista.titulo, lista.subtitulo, lista.andarSinNada]
        : [lista.sinReparto.texto, lista.andarSinNada, ...(lista.estiron ? [lista.estiron.texto] : [])];
      for (const texto of suyos) {
        assert.deepEqual(cifrasDeTexto(texto), [], `${nombre}: «${texto}» lleva una cifra`);
        assert.deepEqual(disculpasDeTexto(texto), [], `${nombre}: «${texto}» se disculpa`);
        assert.deepEqual(vozDeTexto(texto), [], `${nombre}: «${texto}» habla de lo que el mundo no habla`);
      }
    }
    // Y que la comparación haya medido algo: si ningún mundo compusiera lista, el bucle
    // pasaría sin comparar ni un texto.
    assert.ok(conLista >= 9, `solo ${conLista} de los diez mundos componen lista, y entonces esto no está midiendo la variación`);
  });
});

// ── Determinismo ────────────────────────────────────────────────────────────────

describe('El determinismo de la fila', () => {
  /** Los módulos de núcleo que esta fila añade, más la mitad de `app/` que no es montaje. */
  const FICHEROS = [
    'packages/nucleo/partida/portada.js',
    'packages/nucleo/partida/lo-que-hay-hoy.js',
    'packages/nucleo/partida/salida-abierta.js',
    'packages/nucleo/partida/calendario.js',
    'packages/nucleo/partida/guion-de-antes-de-salir.js',
    'packages/nucleo/partida/preparacion.js',
    'app/pantallas/portada.jsx',
    'app/pantallas/lo-que-hay-hoy.jsx',
    'app/pantallas/antes-de-salir.jsx',
    'app/pantallas/preparacion.jsx',
    'app/salida/preparacion.js',
  ];

  test('En el código que esta fila añade no aparece Math.random ni Date.now', () => {
    for (const relativo of FICHEROS) {
      const fuente = readFileSync(join(RAIZ_REPO, relativo), 'utf8');
      for (const prohibido of ['Math.random', 'Date.now', 'new Date(']) {
        assert.equal(fuente.includes(prohibido), false, `${relativo} usa ${prohibido}: el día llega inyectado`);
      }
    }
    // El reloj vive donde tiene que vivir —`app/datos/calendario.js`, del lado de la app— y
    // entra al núcleo por la única puerta que hay.
    const calendarioDeLaApp = readFileSync(join(RAIZ_REPO, 'app/datos/calendario.js'), 'utf8');
    assert.ok(calendarioDeLaApp.includes('Date.now'), 'el reloj ha dejado de estar en la app: entonces está en otro sitio');
  });

  test('La misma partida, el mismo mundo y el mismo día componen la portada y la lista idénticas', async () => {
    const mundo = await mundoCongeladoGenerado('costero', '1');
    const peticion = { mundo, oficio: 'taberna', tramo: TRAMO, calendario: calendarioEn() };
    const portada = () => componePortada({ calendario: calendarioEn(), personaje: PERSONAJE, mundo: MUNDO, salidas: estadoDeSalidaAbierta() });

    assert.equal(JSON.stringify(portada()), JSON.stringify(portada()));
    assert.equal(JSON.stringify(componeLoQueHayHoy(peticion)), JSON.stringify(componeLoQueHayHoy(peticion)));

    // Y la ficha de la misma entrada, también.
    const entrada = componeLoQueHayHoy(peticion).entradas[0];
    assert.equal(JSON.stringify(componeFicha({ entrada })), JSON.stringify(componeFicha({ entrada })));
  });
});
