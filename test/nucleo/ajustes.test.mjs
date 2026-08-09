// SPEC-038 · Los ajustes (A6P6): **el catálogo cerrado de filas** y las dos del
// personaje —el nombre y el género, que se cambian sin tocar el mundo—.
//
// Lo que aquí se afirma es lo que la spec compra registrando las filas en lugar de
// dibujarlas: **una lista cerrada se puede poner roja**. «No existe una fila del
// oficio» y «no hay ninguna que cambie el mapa activo» son consultas sobre datos, no
// impresiones de mirar una pantalla; y una fila cuyo dueño no está cableado **impide
// componer la pantalla** en lugar de pintarse apagada, que es la forma de fallo que
// este repo ha pagado siete veces (§6h).
//
// «El oficio no aparece en ajustes» está etiquetado `@app` en `docs/testing.md` y se
// implementa aquí en `@nucleo`, sobre el catálogo: es donde de verdad vive la ausencia.
// «El horario diurno viene encendido» y «Los pasos de fondo vienen apagados» llevan
// también su nombre literal, y aquí se afirma **la mitad de la fila** —que el valor
// mostrado sea el real—; la mitad del valor de origen ya vive en
// `test/nucleo/onboarding.test.mjs`. «Cambiar el estilo de pintado no resiembra nada»
// se sostiene aquí en lo que esta fila posee: que el estilo se cambia desde esta
// pantalla y que cambiarlo no toca el documento del mundo.
//
// El resto son huecos de la batería, declarados como tales en
// `test/spec-test-map.json`: el catálogo de ajustes no tiene escenario propio, y que
// cambiar el nombre no toque el mundo tampoco —siendo la mitad de RF-PJ-010—.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: los mundos salen de los
// fixtures congelados y el filtro de aptitud entra inyectado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  FILAS_DE_AJUSTES,
  GRUPOS_DE_AJUSTES,
  IDS_DE_FILA,
  IDS_DE_GRUPO,
  LO_QUE_LOS_AJUSTES_NO_TIENEN,
  MOMENTO,
  PALABRAS_DE_CRITERIO,
  PALABRAS_DE_GENERO,
  PALABRAS_DE_INTERRUPTOR,
  PALABRAS_QUE_NINGUNA_FILA_DICE,
  SITIO,
  TESTIDS,
  TEXTOS_DE_AJUSTES,
  TIPOS_DE_FILA,
  TOPE_DEL_NOMBRE,
  cambiaElGenero,
  cambiaElNombre,
  componeAjustes,
  edicionDelNombre,
  eleccionDelGenero,
  congelaAjustes,
  estadoDeAjustes,
  etiquetaDeFila,
  exigeFilaDeAjustes,
  filasDeGrupo,
  levantaAjustes,
  palabrasProhibidasEn,
  revisaCatalogoDeAjustes,
  valorDeFila,
} from '../../packages/nucleo/partida/ajustes.js';
import { REGISTROS, TIPOGRAFIAS } from '../../packages/nucleo/lenguaje/registro.js';
import { creaFiltroDeAptitud } from '../../packages/nucleo/names/aptitud-de-texto.js';
import { GENEROS, IDS_DE_GENERO } from '../../packages/nucleo/partida/puestos.js';
import { MOTIVOS_DEL_NOMBRE, congelaPersonaje, estadoDePersonaje, levantaPersonaje, ponTramo } from '../../packages/nucleo/partida/personaje.js';
import { estadoDeTextos, guardaTexto, textoDe } from '../../packages/nucleo/partida/diario.js';
import { estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { congelaCelda } from '../../packages/nucleo/partida/mundo.js';
import { resuelveConcordancia } from '../../packages/nucleo/names/lenguaje.js';
import { ESTILOS } from '../../packages/nucleo/render/estilos.js';
import { CRITERIOS } from '../../packages/nucleo/world/aptitud.js';
import { IDS_DE_TAMANO_DE_TEXTO } from '../../packages/nucleo/quests/escena.js';
import { IDS_DE_RESPUESTA } from '../../packages/nucleo/partida/tramo.js';
import { textoDeRespuestaDeTramo } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { SEMILLA_A, consultaDeFixture } from './celda-de-prueba.mjs';
import { celdaDeFixture, rejillaDe } from './partida-de-prueba.mjs';
import { fuente, nombresDelMundo } from './mundo-de-prueba.mjs';

/** El filtro de aptitud del idioma, que es lo que criba el nombre escrito a mano. */
const filtroDe = (locale = 'gl') => creaFiltroDeAptitud({ locale });

/** Un personaje con lo que las filas necesitan: nombre, género y tramo declarados. */
function personajeDePrueba({ nombre = 'Sabela', genero = GENEROS.FEMENINO, respuesta = 'otro-barrio' } = {}) {
  const personaje = estadoDePersonaje();
  personaje.nombre = nombre;
  personaje.genero = genero;
  ponTramo(personaje, respuesta);
  return personaje;
}

/** Todo lo que las once filas necesitan para poder componerse. */
function contextoCompleto(cambios = {}) {
  return {
    personaje: personajeDePrueba(),
    ajustes: estadoDeAjustes(),
    estilo: 'reino',
    tamanoDeTexto: IDS_DE_TAMANO_DE_TEXTO[0],
    criterios: ['escalones'],
    sitiosMarcados: 2,
    puertas: ['copia', 'empezar-de-nuevo'],
    ...cambios,
  };
}

/** La fila compuesta con ese identificador. */
const filaDe = (ajustes, id) => ajustes.filas.find((f) => f.id === id);

describe('El catálogo de ajustes', () => {
  test('El catálogo es cerrado y cada fila declara su identificador, su grupo, su orden, su tipo y su dueña', () => {
    // El catálogo se revisa a sí mismo al cargarse; aquí se afirma que esa revisión
    // existe y que no se limita a devolver la lista vacía por no mirar nada.
    assert.deepEqual(revisaCatalogoDeAjustes(), []);
    assert.equal(FILAS_DE_AJUSTES.length, IDS_DE_FILA.length);
    assert.equal(new Set(IDS_DE_FILA).size, IDS_DE_FILA.length, 'hay una fila repetida');

    FILAS_DE_AJUSTES.forEach((fila, i) => {
      assert.ok(typeof fila.id === 'string' && fila.id, 'una fila sin identificador');
      assert.ok(IDS_DE_GRUPO.includes(fila.grupo), `la fila "${fila.id}" declara un grupo que no existe`);
      assert.equal(fila.orden, i + 1, `la fila "${fila.id}" no va en orden correlativo`);
      assert.ok(TIPOS_DE_FILA.includes(fila.tipo), `la fila "${fila.id}" declara un tipo que no está entre los tres`);
      assert.ok(typeof fila.dueña === 'string' && fila.dueña, `la fila "${fila.id}" no dice qué fila del checklist la posee`);
      assert.ok(typeof fila.necesita === 'string' && fila.necesita, `la fila "${fila.id}" no dice qué pieza hay que inyectarle`);
      assert.ok(etiquetaDeFila(fila).trim().length, `la fila "${fila.id}" no tiene etiqueta`);
    });

    // Y es cerrado de verdad: no hay ninguna manera de añadir una fila desde fuera.
    assert.throws(() => { FILAS_DE_AJUSTES.push({ id: 'oficio' }); }, TypeError);
    assert.equal(TIPOS_DE_FILA.length, 3, 'los tipos de fila son tres: valor, interruptor y puerta');
  });

  test('Los cinco grupos van en su orden', () => {
    assert.deepEqual(IDS_DE_GRUPO, ['como-andas', 'tu-personaje', 'el-mapa', 'el-mundo', 'tus-cosas']);
    const ajustes = componeAjustes(contextoCompleto());
    assert.deepEqual(ajustes.grupos.map((g) => g.id), IDS_DE_GRUPO);
    assert.deepEqual(ajustes.grupos.map((g) => g.titulo), GRUPOS_DE_AJUSTES.map((g) => g.titulo));
    // Las filas de un grupo van seguidas: un grupo partido se pintaría dos veces.
    assert.deepEqual(ajustes.filas.map((f) => f.id), IDS_DE_FILA);
    assert.throws(() => filasDeGrupo('el-oficio'), /no tiene ningún grupo/);
  });

  test('El grupo «cómo andas» tiene el tramo y los caminos que evitar', () => {
    assert.deepEqual(filasDeGrupo('como-andas').map((f) => f.id), ['tramo', 'caminos-que-evitar']);
  });

  test('La fila del tramo enseña la respuesta declarada y nunca una distancia', () => {
    for (const respuesta of IDS_DE_RESPUESTA) {
      const valor = valorDeFila('tramo', contextoCompleto({ personaje: personajeDePrueba({ respuesta }) }));
      assert.equal(valor, textoDeRespuestaDeTramo(respuesta), `la fila del tramo no enseña la respuesta "${respuesta}"`);
      // Ni metros, ni minutos, ni ritmo: el tramo se pregunta en lenguaje de sitios.
      assert.ok(!/\d/.test(valor), `la fila del tramo enseña una cifra con "${respuesta}": ${valor}`);
      assert.ok(!/\bkm\b|metros|minutos|ritmo|paso a paso|velocidad/i.test(valor), `la fila del tramo habla de distancia o de ritmo: ${valor}`);
    }

    // Y el ajuste no se comenta nunca: ningún texto de la pantalla insinúa que se ande
    // más o menos últimamente.
    const ajustes = componeAjustes(contextoCompleto());
    for (const texto of [...ajustes.textos.map((t) => t.texto), ...ajustes.filas.map((f) => String(f.valor ?? ''))]) {
      assert.ok(
        !/[úu]ltimamente|ahora andas|has andado|menos que|m[áa]s que|te cuesta|has bajado|has mejorado/i.test(texto),
        `un texto de los ajustes comenta el tramo: "${texto}"`,
      );
    }

    // Un tramo que no viene de ninguna respuesta declarada falla en vez de enseñar los
    // metros que la fila no dice nunca.
    const sinRespuesta = personajeDePrueba();
    sinRespuesta.tramo = { declaradoM: 1200 };
    assert.throws(() => valorDeFila('tramo', contextoCompleto({ personaje: sinRespuesta })), /SPEC-004|respuesta/);
  });

  test('Ni la etiqueta ni el valor de los caminos que evitar dicen accesibilidad', () => {
    const fila = exigeFilaDeAjustes('caminos-que-evitar');
    assert.deepEqual(palabrasProhibidasEn(etiquetaDeFila(fila)), []);
    assert.ok(PALABRAS_QUE_NINGUNA_FILA_DICE.includes('accesibilidad'));

    for (const criterio of CRITERIOS) {
      const valor = valorDeFila('caminos-que-evitar', contextoCompleto({ criterios: [criterio] }));
      assert.equal(valor, PALABRAS_DE_CRITERIO[criterio]);
      assert.deepEqual(palabrasProhibidasEn(valor), [], `el valor de "${criterio}" dice una palabra que ninguna fila dice`);
    }

    // El orden del valor sale del catálogo y no del de llegada: dos partidas con lo
    // mismo elegido leen lo mismo.
    const derecho = valorDeFila('caminos-que-evitar', contextoCompleto({ criterios: ['escalones', 'paso'] }));
    const revés = valorDeFila('caminos-que-evitar', contextoCompleto({ criterios: ['paso', 'escalones'] }));
    assert.equal(derecho, revés);
    // Sin nada elegido, lo dice; y un criterio que su dueña no reconoce falla nombrándolo.
    assert.equal(valorDeFila('caminos-que-evitar', contextoCompleto({ criterios: [] })), TEXTOS_DE_AJUSTES.ningunCriterio);
    assert.throws(
      () => valorDeFila('caminos-que-evitar', contextoCompleto({ criterios: ['cuestas'] })),
      /cuestas/,
      'un criterio que su dueña no reconoce se ha pintado',
    );

    // Y ninguna etiqueta de todo el catálogo dice ninguna de esas palabras.
    for (const f of FILAS_DE_AJUSTES) {
      assert.deepEqual(palabrasProhibidasEn(etiquetaDeFila(f)), [], `la etiqueta de "${f.id}" dice una palabra prohibida`);
    }
  });

  test('El grupo «el mapa» tiene cómo se pinta, con el nombre visible del estilo, y el tamaño de la letra', () => {
    assert.deepEqual(filasDeGrupo('el-mapa').map((f) => f.id), ['como-se-pinta', 'tamano-de-letra']);
    for (const estilo of ESTILOS) {
      const valor = valorDeFila('como-se-pinta', contextoCompleto({ estilo: estilo.id }));
      // El nombre visible es `title`, no `label` —esa es la tipografía de los rótulos—.
      assert.equal(valor, estilo.title, `la fila del estilo no enseña el nombre visible de "${estilo.id}"`);
      assert.notEqual(valor, estilo.label?.family);
    }
    for (const tamano of IDS_DE_TAMANO_DE_TEXTO) {
      const valor = valorDeFila('tamano-de-letra', contextoCompleto({ tamanoDeTexto: tamano }));
      assert.ok(valor.length, `el escalón "${tamano}" no se lee`);
      // El factor de SPEC-021 no sale nunca a pantalla: el escalón se lee en palabras.
      assert.ok(!/\d/.test(valor), `el escalón "${tamano}" enseña el factor: ${valor}`);
    }
    assert.throws(() => valorDeFila('tamano-de-letra', contextoCompleto({ tamanoDeTexto: 'enorme' })), /enorme/);
  });

  test('Cambiar el estilo de pintado no resiembra nada', async () => {
    // De esta fila es la mitad que dice que **el estilo se cambia desde esta pantalla**:
    // la fila existe, enseña el nombre visible del estilo activo y cambiarla no toca el
    // documento del mundo. El repintado sin resembrar es de SPEC-021 y se afirma en
    // `test/nucleo/render.test.mjs`.
    const rejilla = rejillaDe('barrio-tres-calles');
    const registro = await generaCelda({
      rejilla, semilla: SEMILLA_A, mapaId: rejilla.id, celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('barrio-tres-calles'),
    });
    const antes = JSON.stringify(congelaCelda(registro));

    const reino = componeAjustes(contextoCompleto({ estilo: 'reino' }));
    const pergamino = componeAjustes(contextoCompleto({ estilo: 'pergamino' }));
    assert.notEqual(filaDe(reino, 'como-se-pinta').valor, filaDe(pergamino, 'como-se-pinta').valor);
    assert.equal(JSON.stringify(congelaCelda(registro)), antes, 'cambiar el estilo ha movido el mundo');

    // Y es la única fila del catálogo que toca el pintado: no hay una segunda puerta al
    // estilo escondida en otro grupo.
    assert.deepEqual(FILAS_DE_AJUSTES.filter((f) => f.necesita === 'estilo').map((f) => f.id), ['como-se-pinta']);
    assert.equal(exigeFilaDeAjustes('como-se-pinta').testid, TESTIDS.comoSePinta);
  });

  test('El horario diurno viene encendido', () => {
    // La mitad de fila del escenario: el valor que se **enseña** es el real, y se puede
    // desactivar. El valor de origen se afirma en `test/nucleo/onboarding.test.mjs`.
    const ajustes = estadoDeAjustes();
    assert.equal(valorDeFila('solo-de-dia', contextoCompleto({ ajustes })), PALABRAS_DE_INTERRUPTOR.si);
    ajustes.soloDeDia = false;
    assert.equal(valorDeFila('solo-de-dia', contextoCompleto({ ajustes })), PALABRAS_DE_INTERRUPTOR.no);
    assert.equal(exigeFilaDeAjustes('solo-de-dia').tipo, 'interruptor');
    assert.equal(exigeFilaDeAjustes('solo-de-dia').grupo, 'el-mundo');
  });

  test('Los pasos de fondo vienen apagados', () => {
    const ajustes = estadoDeAjustes();
    assert.equal(valorDeFila('pasos-del-dia-a-dia', contextoCompleto({ ajustes })), PALABRAS_DE_INTERRUPTOR.no);
    // El valor mostrado es el real y nunca el pedido: encenderlo en el estado es lo que
    // lo enciende en la fila, y pedir el permiso no.
    ajustes.pasosDelDiaADia = true;
    assert.equal(valorDeFila('pasos-del-dia-a-dia', contextoCompleto({ ajustes })), PALABRAS_DE_INTERRUPTOR.si);
    assert.equal(exigeFilaDeAjustes('pasos-del-dia-a-dia').testid, TESTIDS.pasosDeFondo);
    assert.deepEqual(filasDeGrupo('el-mundo').map((f) => f.id), ['pasos-del-dia-a-dia', 'solo-de-dia']);
  });

  test('El grupo «tus cosas» tiene los sitios marcados, la copia y empezar de nuevo', () => {
    assert.deepEqual(filasDeGrupo('tus-cosas').map((f) => f.id), ['sitios-marcados', 'copia', 'empezar-de-nuevo']);
    assert.equal(valorDeFila('sitios-marcados', contextoCompleto({ sitiosMarcados: 3 })), '3');
    assert.equal(valorDeFila('sitios-marcados', contextoCompleto({ sitiosMarcados: { cuantos: 0 } })), '0');
  });

  test('Empezar de nuevo es la última de todas y no es la acción principal', () => {
    const ultima = FILAS_DE_AJUSTES[FILAS_DE_AJUSTES.length - 1];
    assert.equal(ultima.id, 'empezar-de-nuevo');
    assert.equal(ultima.grupo, IDS_DE_GRUPO[IDS_DE_GRUPO.length - 1]);
    // Lo destructivo se declara en su propia pantalla, no en la lista.
    assert.equal(ultima.destructivaEnLaLista, false);
    const compuesta = filaDe(componeAjustes(contextoCompleto()), 'empezar-de-nuevo');
    assert.equal(compuesta.destructivaEnLaLista, false);
    assert.equal(compuesta.tipo, 'puerta');
    assert.equal(compuesta.chevron, true);
    assert.equal(compuesta.valor, null, 'una puerta no enseña valor');
    // Las dos puertas son las dos últimas y no hay ninguna más.
    assert.deepEqual(FILAS_DE_AJUSTES.filter((f) => f.tipo === 'puerta').map((f) => f.id), ['copia', 'empezar-de-nuevo']);
  });

  test('El catálogo no tiene ninguna fila del mapa activo, de la red, de una cuenta, de una suscripción ni de analítica', () => {
    for (const prohibida of LO_QUE_LOS_AJUSTES_NO_TIENEN) {
      assert.ok(!IDS_DE_FILA.includes(prohibida), `el catálogo tiene la fila "${prohibida}"`);
    }
    const compuesta = JSON.stringify(componeAjustes(contextoCompleto()));
    for (const palabra of ['mapa activo', 'cuenta', 'suscripción', 'analítica', 'red', 'iniciar sesión', 'anuncios']) {
      assert.ok(!compuesta.toLowerCase().includes(palabra.toLowerCase()), `los ajustes hablan de "${palabra}"`);
    }
  });

  test('Una fila cuyo dueño no está cableado impide componer la pantalla, nombrándola', () => {
    // §6h: no se pinta apagada. La pantalla no se compone y dice **la fila y la pieza**.
    const faltantes = {
      tramo: { personaje: personajeDePrueba() },
      'caminos-que-evitar': { criterios: null },
      nombre: { personaje: personajeDePrueba({ nombre: '' }) },
      'como-se-pinta': { estilo: null },
      'tamano-de-letra': { tamanoDeTexto: null },
      'pasos-del-dia-a-dia': { ajustes: null },
      'sitios-marcados': { sitiosMarcados: null },
      copia: { puertas: [] },
    };
    faltantes.tramo.personaje.tramo = null;

    for (const [id, cambio] of Object.entries(faltantes)) {
      const fila = exigeFilaDeAjustes(id);
      assert.throws(() => componeAjustes(contextoCompleto(cambio)), (e) => {
        assert.match(e.message, new RegExp(id), `el error no nombra la fila "${id}"`);
        assert.ok(e.message.includes(fila.necesita), `el error de "${id}" no nombra la pieza que falta (${fila.necesita})`);
        assert.ok(e.message.includes(fila.dueña), `el error de "${id}" no dice quién la pone`);
        return true;
      }, `la fila "${id}" se ha compuesto sin su dueño cableado`);
    }
  });

  test('Un identificador de fila que el catálogo no tiene falla nombrándolo', () => {
    assert.throws(() => valorDeFila('oficio', contextoCompleto()), /"oficio"/);
    assert.throws(() => valorDeFila('modo-oscuro', contextoCompleto()), /modo-oscuro/);
    // Y el error enumera las que sí hay, que es lo que convierte un fallo en una pista.
    assert.throws(() => exigeFilaDeAjustes(null), new RegExp(IDS_DE_FILA[0]));
  });

  test('Un estilo guardado que ya no existe en el catálogo falla nombrándolo', () => {
    // SPEC-021 sustituye y lo declara; aquí se falla, porque la fila enseñaría «Reino»
    // junto a un estilo guardado que no es Reino: caer al de por defecto sin decirlo.
    assert.throws(
      () => valorDeFila('como-se-pinta', contextoCompleto({ estilo: 'aguafuerte' })),
      (e) => {
        assert.match(e.message, /aguafuerte/);
        assert.ok(ESTILOS.every((estilo) => e.message.includes(estilo.id)), 'el error no enumera el catálogo que sí hay');
        return true;
      },
    );
  });

  test('La pantalla declara su momento, su registro y sus localizadores', () => {
    const ajustes = componeAjustes(contextoCompleto());
    assert.equal(ajustes.momento, MOMENTO);
    assert.equal(MOMENTO, 'de-consulta');
    assert.equal(SITIO, 'ajustes');
    assert.equal(ajustes.registro, REGISTROS.APLICACION);
    assert.deepEqual(
      Object.values(TESTIDS).sort(),
      ['ajustes-como-se-pinta', 'ajustes-fila', 'ajustes-genero', 'ajustes-grupo', 'ajustes-lista',
        'ajustes-nombre', 'ajustes-pasos-de-fondo', 'ajustes-registro', 'momento'],
    );
    // No hay ningún localizador del oficio, y su ausencia es una afirmación.
    assert.ok(!Object.values(TESTIDS).some((t) => /oficio/.test(t)));
    for (const fila of ajustes.filas) {
      assert.ok(typeof fila.testid === 'string' && fila.testid, `la fila "${fila.id}" no trae localizador`);
    }
  });

  test('Dos composiciones del mismo estado son idénticas', () => {
    const contexto = contextoCompleto();
    assert.equal(JSON.stringify(componeAjustes(contexto)), JSON.stringify(componeAjustes(contexto)));
  });

  test('Los ajustes no leen el reloj del sistema ni el azar', () => {
    const codigo = fuente('packages/nucleo/partida/ajustes.js');
    for (const prohibido of ['Math.random', 'Date.now', 'new Date']) {
      assert.ok(!codigo.includes(prohibido), `ajustes.js usa ${prohibido}`);
    }
  });
});

describe('El personaje se elige una vez y el oficio no se cambia', () => {
  test('El oficio no aparece en ajustes', () => {
    // Escenario `@app` de la batería, verificado aquí en `@nucleo` sobre el catálogo: es
    // donde de verdad vive la ausencia, y donde se puede poner roja.
    const ajustes = componeAjustes(contextoCompleto());

    // Puede cambiar su nombre y su género gramatical...
    assert.deepEqual(filasDeGrupo('tu-personaje').map((f) => f.id), ['nombre', 'genero']);
    assert.equal(filaDe(ajustes, 'nombre').valor, 'Sabela');
    assert.equal(filaDe(ajustes, 'genero').valor, PALABRAS_DE_GENERO[GENEROS.FEMENINO]);

    // ...pero no su oficio: no hay fila, no aparece en la composición y pedir su valor
    // falla nombrándolo.
    assert.ok(!IDS_DE_FILA.includes('oficio'));
    assert.ok(LO_QUE_LOS_AJUSTES_NO_TIENEN.includes('oficio'));
    assert.ok(!JSON.stringify(ajustes).includes('oficio'), 'el oficio ha llegado a la composición de los ajustes');
    assert.throws(() => valorDeFila('oficio', contextoCompleto()), /"oficio"/);
    // Y el personaje sí lo tiene: la ausencia es de la pantalla, no del dato.
    assert.ok(Object.keys(estadoDePersonaje()).includes('oficio'));
  });
});

describe('El nombre y el género se cambian sin tocar el mundo', () => {
  test('Cambiar el nombre no mueve un byte de ningún documento congelado', async () => {
    // Hueco de la batería: es la mitad de RF-PJ-010 y no tiene escenario. Es además la
    // regresión que aparece el día que alguien mete el nombre en una semilla «para que
    // el mundo sea más tuyo», así que se genera **dos veces de verdad**, una a cada lado
    // del cambio, en lugar de comparar el mismo objeto consigo mismo.
    const personaje = personajeDePrueba({ nombre: 'Sabela' });

    /** Todas las celdas, congeladas: su documento entero y los nombres de su mundo. */
    const todasLasCeldas = async () => {
      const salida = [];
      for (const fixture of ['barrio-tres-calles', 'suelo-250m']) {
        const rejilla = rejillaDe(fixture);
        for (const celda of [{ i: 0, j: 0 }, { i: 1, j: -2 }]) {
          const registro = await generaCelda({
            rejilla, semilla: SEMILLA_A, mapaId: rejilla.id, celda, consultaOsm: consultaDeFixture(fixture),
          });
          salida.push({
            clave: `${fixture}|${celda.i},${celda.j}`,
            documento: JSON.stringify(congelaCelda(registro)),
            nombres: nombresDelMundo(registro.mundo),
          });
        }
      }
      return salida;
    };

    const antes = await todasLasCeldas();
    assert.equal(antes.length, 4);
    assert.ok(antes.some((c) => c.nombres.length), 'no se ha congelado ningún mundo con nombres');

    // El cambio: nombre y género. Ninguno de los dos entra en ninguna semilla.
    const veredicto = cambiaElNombre(personaje, 'Uxía', { filtro: filtroDe() });
    assert.equal(veredicto.ok, true);
    assert.equal(personaje.nombre, 'Uxía');
    cambiaElGenero(personaje, GENEROS.MASCULINO);

    // Se genera otra vez, de verdad: comparar el mismo objeto consigo mismo no afirmaría
    // nada. Byte a byte, y además los nombres de núcleos, servicios, parajes y calzadas.
    const despues = await todasLasCeldas();
    for (const [i, celda] of despues.entries()) {
      assert.equal(celda.clave, antes[i].clave);
      assert.equal(
        celda.documento.length, antes[i].documento.length,
        `${celda.clave}: el documento congelado ha cambiado de tamaño al cambiar el nombre`,
      );
      assert.equal(celda.documento, antes[i].documento, `${celda.clave}: el documento congelado ha cambiado al cambiar el nombre`);
      assert.deepEqual(celda.nombres, antes[i].nombres, `${celda.clave}: un nombre del mundo ha cambiado al cambiar el nombre de quien juega`);
    }

    // Y la razón por la que no puede moverse: la generación no recibe el personaje.
    const codigo = fuente('packages/nucleo/world/celda.js');
    assert.ok(!/personaje/i.test(codigo), 'la generación de una celda ha empezado a saber del personaje');
  });

  test('Cambiar el nombre no toca la semilla de la partida', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const antes = estado.semilla;
    const personaje = personajeDePrueba();
    cambiaElNombre(personaje, 'Uxía', { filtro: filtroDe() });
    cambiaElGenero(personaje, GENEROS.MASCULINO);
    assert.equal(estado.semilla, antes);
    // Y el nombre no aparece dentro de la semilla, que es por donde se colaría.
    assert.ok(!estado.semilla.includes('UXIA'), 'el nombre se ha colado dentro de la semilla');
    assert.ok(!fuente('packages/nucleo/partida/ajustes.js').includes('makeRng'), 'los ajustes han empezado a sembrar');
  });

  test('Un nombre vacío o de solo espacios se rechaza diciendo qué falta, y el anterior sigue', () => {
    const personaje = personajeDePrueba({ nombre: 'Sabela' });
    for (const escrito of ['', '   ', '\t']) {
      const veredicto = cambiaElNombre(personaje, escrito, { filtro: filtroDe() });
      assert.equal(veredicto.ok, false);
      assert.equal(veredicto.motivo, MOTIVOS_DEL_NOMBRE.VACIO);
      assert.equal(personaje.nombre, 'Sabela', 'un nombre vacío ha dejado a alguien sin nombre');
    }
  });

  test('Un nombre más largo que el tope se rechaza nombrando el tope', () => {
    const personaje = personajeDePrueba({ nombre: 'Sabela' });
    const veredicto = cambiaElNombre(personaje, 'A'.repeat(TOPE_DEL_NOMBRE + 1), { filtro: filtroDe() });
    assert.equal(veredicto.ok, false);
    assert.equal(veredicto.motivo, MOTIVOS_DEL_NOMBRE.DEMASIADO_LARGO);
    assert.equal(personaje.nombre, 'Sabela');
    // El tope está declarado y llega a la edición, que es donde la pantalla lo dice.
    assert.equal(edicionDelNombre({ personaje, semilla: SEMILLA_A }).tope, TOPE_DEL_NOMBRE);
    // Y justo el tope sí pasa: el rechazo es por encima, no por igual.
    assert.equal(cambiaElNombre(personaje, 'A'.repeat(TOPE_DEL_NOMBRE), { filtro: filtroDe() }).ok, true);
  });

  test('Un género fuera del enumerado falla nombrando el valor recibido', () => {
    const personaje = personajeDePrueba();
    assert.throws(() => cambiaElGenero(personaje, 'neutro'), /neutro/);
    assert.throws(() => cambiaElGenero(personaje, null), (e) => {
      assert.ok(IDS_DE_GENERO.every((id) => e.message.includes(id)), 'el error no enumera los géneros declarados');
      return true;
    });
    assert.equal(personaje.genero, GENEROS.FEMENINO, 'un género inventado se ha guardado');
    // Y la elección enseña los dos del enumerado, con el actual marcado.
    const eleccion = eleccionDelGenero(personaje);
    assert.deepEqual(eleccion.opciones.map((o) => o.id), IDS_DE_GENERO);
    assert.deepEqual(eleccion.opciones.filter((o) => o.marcada).map((o) => o.id), [GENEROS.FEMENINO]);
    assert.equal(eleccion.testid, TESTIDS.genero);
  });

  test('Las sugerencias de nombre llevan las femeninas primero', () => {
    const personaje = personajeDePrueba();
    const edicion = edicionDelNombre({ personaje, semilla: SEMILLA_A, locale: 'gl' });
    assert.equal(edicion.actual, personaje.nombre, 'la edición no precarga el nombre actual');
    assert.equal(edicion.testid, TESTIDS.nombre);
    assert.equal(edicion.registro, REGISTROS.APLICACION);

    const paquete = { personNames: (genero) => (genero === GENEROS.FEMENINO ? ['Sabela', 'Uxía', 'Antía'] : ['Breogán', 'Xoán', 'Anxo']) };
    const sugerencias = edicionDelNombre({ personaje, semilla: SEMILLA_A, paquete }).sugerencias;
    const generos = sugerencias.map((n) => (paquete.personNames(GENEROS.FEMENINO).includes(n) ? 'f' : 'm'));
    assert.deepEqual(generos, ['f', 'f', 'm', 'm'], 'las sugerencias no llevan las femeninas primero');
    assert.equal(new Set(sugerencias).size, sugerencias.length, 'una sugerencia se repite');

    // Sin nombre puesto no hay nada que precargar, y eso falla en vez de abrir en blanco.
    assert.throws(() => edicionDelNombre({ personaje: estadoDePersonaje(), semilla: SEMILLA_A }), /precarga|nombre/);
  });

  test('Un nombre igual al de un NPC del mundo se acepta', async () => {
    // El índice de nombres únicos es del mundo, y el personaje no entra en él: se coge
    // un nombre de fantasía de un mundo generado de verdad y se guarda tal cual.
    const registro = await celdaDeFixture('barrio-tres-calles');
    const delMundo = nombresDelMundo(registro.mundo).find((n) => n.length <= TOPE_DEL_NOMBRE);
    assert.ok(delMundo, 'el mundo congelado no ha dado ningún nombre que quepa en el tope');

    const personaje = personajeDePrueba({ nombre: 'Sabela' });
    const veredicto = cambiaElNombre(personaje, delMundo, { filtro: filtroDe() });
    assert.equal(veredicto.ok, true, `el nombre "${delMundo}", que ya está en el mundo, se ha rechazado`);
    assert.equal(personaje.nombre, delMundo);
    // Y el mundo sigue teniéndolo: ponerse ese nombre no se lo quita a nadie.
    assert.ok(nombresDelMundo(registro.mundo).includes(delMundo));
  });

  test('El nombre y el género cambiados vuelven al guardar y cargar la partida', () => {
    // De los tres que pide el criterio —nombre, género y estilo— aquí vuelven dos: el
    // **estilo no se guarda en ninguna parte del estado**, así que no puede volver. Queda
    // dicho en el resumen de cobertura y en `test/spec-test-map.json`, en vez de fingir
    // que el criterio está entero.
    const personaje = personajeDePrueba({ nombre: 'Sabela', genero: GENEROS.FEMENINO });
    cambiaElNombre(personaje, 'Uxía', { filtro: filtroDe() });
    cambiaElGenero(personaje, GENEROS.MASCULINO);

    const vuelto = levantaPersonaje(JSON.parse(JSON.stringify(congelaPersonaje(personaje))));
    assert.equal(vuelto.nombre, 'Uxía');
    assert.equal(vuelto.genero, GENEROS.MASCULINO);
    // Y el par de interruptores del área de ajustes también vuelve tal cual.
    const ajustes = estadoDeAjustes();
    ajustes.soloDeDia = false;
    assert.deepEqual(levantaAjustes(JSON.parse(JSON.stringify(congelaAjustes(ajustes)))), { soloDeDia: false, pasosDelDiaADia: false });
    // Un ajuste que falta vuelve en su valor de origen, no en `false`.
    assert.deepEqual(levantaAjustes({}), estadoDeAjustes());
  });

  test('Un género cambiado concuerda los textos nuevos y no reescribe los del narrador', () => {
    const personaje = personajeDePrueba({ genero: GENEROS.FEMENINO });

    // Un texto del narrador ya escrito y guardado con la partida.
    const textos = estadoDeTextos();
    guardaTexto(textos, { clave: 't1', texto: 'Volviste sola y contenta.', origen: 'plantilla' });
    const guardado = textoDe(textos, { texto: 't1' }).texto;

    cambiaElGenero(personaje, GENEROS.MASCULINO);
    assert.equal(personaje.genero, GENEROS.MASCULINO);
    // Lo escrito se quedó como se escribió: no se vuelve a pedir ni se reescribe.
    assert.equal(textoDe(textos, { texto: 't1' }).texto, guardado);
    assert.equal(textoDe(textos, { texto: 't1' }).texto, 'Volviste sola y contenta.');

    // Y los textos de plantilla que se componen a partir de ahora ya concuerdan.
    const enFemenino = resuelveConcordancia('Llegas {sola}.', { genero: GENEROS.FEMENINO });
    const enMasculino = resuelveConcordancia('Llegas {sola}.', { genero: personaje.genero });
    assert.notEqual(enFemenino, enMasculino, 'la concordancia no ha seguido al género nuevo');
    assert.ok(!/\{/.test(enMasculino), 'la concordancia ha dejado una ranura sin resolver');
  });
});
