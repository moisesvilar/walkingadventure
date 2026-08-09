// Los ajustes de la partida: **el valor con el que llegan de origen** y, desde
// SPEC-038, **el catálogo cerrado de filas de A6P6** con su grupo, su orden, su tipo y
// la fila del checklist que las posee.
//
// Los dos interruptores que `game-design/seguridad-privacidad.md` §4 declara los deja
// puestos el arranque sin preguntar nada: el horario diurno, encendido, y los pasos del
// día a día, apagados. Que su valor de origen viva en el estado y no en la pantalla es
// lo que permite afirmarlo sin abrirla. «Sin preguntar nada» es la mitad de la
// decisión: enseñarlos en el arranque sería preguntar por la puerta de atrás.
//
// El catálogo es **cerrado y cada fila declara quién la posee**, y eso compra tres
// cosas concretas:
//
//   1. **La lista cerrada se puede afirmar.** «No existe una fila del oficio» y «no hay
//      ningún control de mapa activo» son criterios que se pueden poner rojos, cosa que
//      mirando una pantalla a ojo no se puede (§6o).
//   2. **Ninguna fila puede aparecer apagada por falta de cableado.** Si el dueño de una
//      fila no está inyectado, la pantalla **no se compone** y lo dice nombrando la fila
//      y la pieza que falta: §6h, una pieza que al no estar no protesta es la forma de
//      fallo que este repo ya ha pagado siete veces.
//   3. **Las filas de otras filas del checklist entran sin renegociar nada.**
//
// Añadir una fila es tocar este fichero, a propósito: los ajustes son el sitio del que
// más fácil es tirar cuando algo no cabe en el juego, y `lenguaje.md` advierte que
// dentro del juego lo que solo se puede decir como aplicación es señal de rediseñar el
// momento, no de añadir un ajuste.
//
// Y aquí se habla **como aplicación**, que es la única excepción de todo el juego. El
// registro viaja en el dato de cada texto (`lenguaje/registro.js`) y de él sale la
// tipografía, para que la frontera no dependa de que nadie se equivoque una vez.

import { congelaHondo } from '../core/congelar.js';
import { REGISTROS, coloca, textoConRegistro } from '../lenguaje/registro.js';
import { reglaDeFormula } from '../names/lenguaje.js';
import { FRANJA_DIURNA } from '../quests/aventura.js';
import { ESCALA_DE_TEXTO, IDS_DE_TAMANO_DE_TEXTO, exigeTamanoDeTexto } from '../quests/escena.js';
import { ESTILOS, resuelveEstilo } from '../render/estilos.js';
import { CRITERIOS } from '../world/aptitud.js';
import { TEXTOS_DE_DESCARTE } from './descartes.js';
import { textoDeRespuestaDeTramo, textoDelGuion } from './guion-de-arranque.js';
import { TOPE_DEL_NOMBRE, ponGenero, ponNombre, sugerenciasDeNombre } from './personaje.js';
import { GENEROS, IDS_DE_GENERO, exigeGenero } from './puestos.js';

/**
 * Los ajustes declarados y **su valor de origen**.
 *
 * `soloDeDia` encendido: no se ofrecen salidas de noche, y cualquiera puede quitarlo.
 * `pasosDelDiaADia` apagado: leer los pasos de la app de salud es opt-in explícito, y
 * el juego es completo sin activarlo (`quests.md` §8).
 */
export const AJUSTES_DE_ORIGEN = congelaHondo({
  soloDeDia: true,
  pasosDelDiaADia: false,
});

/** Los identificadores de ajuste, en orden declarado. Lista cerrada. */
export const IDS_DE_AJUSTE = congelaHondo(Object.keys(AJUSTES_DE_ORIGEN));

/** Los ajustes de una partida recién creada: exactamente los de origen. */
export function estadoDeAjustes() {
  return { ...AJUSTES_DE_ORIGEN };
}

/** Un identificador de ajuste declarado, o un error que enumera los que hay. */
export function exigeAjuste(id) {
  if (!IDS_DE_AJUSTE.includes(id)) {
    throw new Error(`ajuste desconocido ${JSON.stringify(id) ?? String(id)}: los declarados son ${IDS_DE_AJUSTE.join(', ')}`);
  }
  return id;
}

/** Cambia un ajuste. Los dos se pueden cambiar: de origen no significa fijo. */
export function cambiaAjuste(ajustes, id, valor) {
  exigeAjuste(id);
  if (typeof valor !== 'boolean') {
    throw new Error(`el ajuste "${id}" es un interruptor y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  ajustes[id] = valor;
  return ajustes;
}

/**
 * La franja que el casting recibe según el horario diurno.
 *
 * Devuelve la franja y no un booleano porque eso es lo que `casteaAventura` espera:
 * un booleano escondería la hora dentro del motor y el ajuste no podría moverla.
 * Apagado es `null`, que es «cabe cualquiera».
 */
export function franjaPermitidaDe(ajustes) {
  return ajustes?.soloDeDia === false ? null : FRANJA_DIURNA;
}

/** Los ajustes en forma serializable, en el orden declarado. */
export function congelaAjustes(ajustes) {
  const doc = {};
  for (const id of IDS_DE_AJUSTE) doc[id] = ajustes?.[id] ?? AJUSTES_DE_ORIGEN[id];
  return doc;
}

/**
 * Los ajustes de vuelta de su documento.
 *
 * Un ajuste que falta vuelve **en su valor de origen** y no en `false`: una partida
 * guardada antes de que existiera un ajuste tiene que abrirse con el valor que el
 * diseño declara, no con el que salga de leer un `undefined`.
 */
export function levantaAjustes(doc) {
  const ajustes = estadoDeAjustes();
  if (!doc) return ajustes;
  for (const id of IDS_DE_AJUSTE) {
    if (typeof doc[id] === 'boolean') ajustes[id] = doc[id];
  }
  return ajustes;
}

// --- El catálogo de filas de A6P6 --------------------------------------------

/** El sitio del juego en el que vive esta pantalla. Es uno de los dos que hablan como aplicación. */
export const SITIO = 'ajustes';

/** El momento del bucle que declara la pantalla. El mismo que la repisa. */
export const MOMENTO = 'de-consulta';

/** Los localizadores de A6P6. Los consume la pantalla y no se inventa ninguno. */
export const TESTIDS = congelaHondo({
  momento: 'momento',
  lista: 'ajustes-lista',
  grupo: 'ajustes-grupo',
  fila: 'ajustes-fila',
  comoSePinta: 'ajustes-como-se-pinta',
  pasosDeFondo: 'ajustes-pasos-de-fondo',
  nombre: 'ajustes-nombre',
  genero: 'ajustes-genero',
  registro: 'ajustes-registro',
});

/**
 * Los cinco grupos, **en su orden**. Empiezan por el cuerpo de quien juega y acaban por
 * lo que tiene guardado, que es el orden en que alguien busca un ajuste.
 */
export const GRUPOS_DE_AJUSTES = congelaHondo([
  { id: 'como-andas', titulo: 'Cómo andas' },
  { id: 'tu-personaje', titulo: 'Tu personaje' },
  { id: 'el-mapa', titulo: 'El mapa' },
  { id: 'el-mundo', titulo: 'El mundo' },
  { id: 'tus-cosas', titulo: 'Tus cosas' },
]);

/** Los identificadores de grupo, en el orden del catálogo. */
export const IDS_DE_GRUPO = congelaHondo(GRUPOS_DE_AJUSTES.map((g) => g.id));

/**
 * Los tres tipos de fila, y ninguno más.
 *
 * `valor` abre una elección y vuelve; `interruptor` cambia en el sitio; `puerta` lleva a
 * otra pantalla. Ni deslizadores, ni campos libres, ni selectores en línea: el tramo se
 * pregunta en lenguaje de sitios precisamente para que no haya un deslizador de metros
 * (`design-system.md`).
 */
export const TIPOS_DE_FILA = congelaHondo(['valor', 'interruptor', 'puerta']);

/**
 * Lo que los ajustes **no** tienen, nombrado para que la ausencia se pueda poner roja.
 *
 * El oficio es el primero y el que más importa: es la única palanca mecánica del
 * personaje (`personaje.md` §3) y un oficio cambiable en un toque sería una preferencia
 * y no una decisión. Los demás son las filas que una aplicación cualquiera tendría y
 * este juego no puede tener.
 */
export const LO_QUE_LOS_AJUSTES_NO_TIENEN = congelaHondo([
  'oficio',
  'mapa-activo',
  'cuenta',
  'suscripcion',
  'red',
  'analitica',
  'notificaciones-de-marketing',
  'idioma-del-mundo',
]);

/**
 * Lo que ninguna etiqueta ni ningún valor de este catálogo dice.
 *
 * «Caminos que evitar» no es un modo, ni una ayuda, ni una adaptación: es la unidad de
 * medida del juego, y ponerle etiqueta sería inventarse la categoría que
 * `game-design/accesibilidad.md` evita entero. La lista es de palabras y no de
 * conceptos a propósito: comprobar que la palabra no aparece es barato y es exactamente
 * el criterio.
 */
export const PALABRAS_QUE_NINGUNA_FILA_DICE = congelaHondo([
  'accesibilidad', 'accesible', 'modo', 'ayuda', 'adaptación', 'adaptado', 'adaptada',
  'discapacidad', 'asistencia', 'asistido', 'necesidades especiales', 'limitación',
]);

/**
 * Con qué palabra se resume cada criterio de «caminos que evitar».
 *
 * Son sitios por los que no te mandan, dichos como se dicen: escaleras, firme suelto.
 * Ninguna es una categoría sobre quien las elige, que es la mitad de la decisión.
 */
export const PALABRAS_DE_CRITERIO = congelaHondo({
  escalones: 'escaleras',
  firme: 'firme suelto',
  bordillos: 'bordillos altos',
  paso: 'pasos estrechos',
});

/** Cómo se dice cada género gramatical en la fila. En segunda persona, como todo lo de aquí. */
export const PALABRAS_DE_GENERO = congelaHondo({
  [GENEROS.FEMENINO]: 'en femenino',
  [GENEROS.MASCULINO]: 'en masculino',
});

/** Cómo se dice un interruptor. Dos palabras, sin «activado» ni «habilitado». */
export const PALABRAS_DE_INTERRUPTOR = congelaHondo({ si: 'sí', no: 'no' });

/**
 * El catálogo, **cerrado y en el orden en que se lee la pantalla**.
 *
 * `dueña` es la fila del checklist que posee el comportamiento; esta spec posee la
 * pantalla, el catálogo y las dos filas del personaje, y de las demás solo declara el
 * hueco por el que entran. `necesita` nombra la pieza que hay que inyectar para poder
 * derivar el valor: es lo que el error nombra cuando no llega.
 */
export const FILAS_DE_AJUSTES = congelaHondo([
  {
    id: 'tramo',
    grupo: 'como-andas',
    orden: 1,
    tipo: 'valor',
    dueña: 'fila 4 del checklist',
    // La etiqueta **es la pregunta del arranque**, resuelta del guion y no reescrita
    // aquí. Dos motivos, y los dos importan: escribir una segunda formulación de la
    // misma pregunta es cómo se desincronizan, y la media hora —que es la definición
    // del tramo y así la formula `accesibilidad.md` §1— es una excepción declarada del
    // guion, con su motivo escrito al lado. Repetirla aquí la volvería a abrir sin
    // motivo, y «el ajuste no se comenta nunca» dejaría de poder afirmarse sobre el
    // corpus del núcleo.
    etiqueta: null,
    etiquetaDelGuion: { paso: 'tu-tramo', pieza: 'pregunta' },
    necesita: 'personaje.tramo',
  },
  {
    id: 'caminos-que-evitar',
    grupo: 'como-andas',
    orden: 2,
    tipo: 'valor',
    dueña: 'fila 8 del checklist',
    etiqueta: 'Caminos que evitar',
    necesita: 'criterios',
  },
  {
    id: 'nombre',
    grupo: 'tu-personaje',
    orden: 3,
    tipo: 'valor',
    dueña: 'esta fila',
    etiqueta: 'Cómo te llamas',
    testid: 'ajustes-nombre',
    necesita: 'personaje.nombre',
  },
  {
    id: 'genero',
    grupo: 'tu-personaje',
    orden: 4,
    tipo: 'valor',
    dueña: 'esta fila',
    etiqueta: 'Cómo se dirigen a ti',
    testid: 'ajustes-genero',
    necesita: 'personaje.genero',
  },
  {
    id: 'como-se-pinta',
    grupo: 'el-mapa',
    orden: 5,
    tipo: 'valor',
    dueña: 'fila 21 del checklist',
    etiqueta: 'Cómo se pinta',
    testid: 'ajustes-como-se-pinta',
    necesita: 'estilo',
  },
  {
    id: 'tamano-de-letra',
    grupo: 'el-mapa',
    orden: 6,
    tipo: 'valor',
    dueña: 'fila 21 del checklist',
    etiqueta: 'Tamaño de la letra',
    necesita: 'tamanoDeTexto',
  },
  {
    id: 'pasos-del-dia-a-dia',
    grupo: 'el-mundo',
    orden: 7,
    tipo: 'interruptor',
    dueña: 'fila 42 del checklist',
    etiqueta: 'Contar los pasos del día a día',
    testid: 'ajustes-pasos-de-fondo',
    ajuste: 'pasosDelDiaADia',
    necesita: 'ajustes',
  },
  {
    id: 'solo-de-dia',
    grupo: 'el-mundo',
    orden: 8,
    tipo: 'interruptor',
    dueña: 'fila 32 del checklist',
    etiqueta: 'Solo de día',
    ajuste: 'soloDeDia',
    necesita: 'ajustes',
  },
  {
    id: 'sitios-marcados',
    grupo: 'tus-cosas',
    orden: 9,
    tipo: 'valor',
    dueña: 'fila 35 del checklist',
    etiqueta: TEXTOS_DE_DESCARTE.filaDeAjustes,
    necesita: 'sitiosMarcados',
  },
  {
    id: 'copia',
    grupo: 'tus-cosas',
    orden: 10,
    tipo: 'puerta',
    dueña: 'fila 39 del checklist',
    etiqueta: 'Guardar una copia',
    necesita: 'puertas',
  },
  {
    // Última de la última agrupación, y **sin color destructivo aquí**: lo destructivo se
    // declara en su propia pantalla, que es donde hay sitio para explicar
    // (`partida-guardada.md` §4). Pintarlo en rojo en la lista lo convertiría en lo más
    // visible de los ajustes, que es lo contrario de lo que se decidió.
    id: 'empezar-de-nuevo',
    grupo: 'tus-cosas',
    orden: 11,
    tipo: 'puerta',
    dueña: 'fila 40 del checklist',
    etiqueta: 'Empezar de nuevo',
    destructivaEnLaLista: false,
    necesita: 'puertas',
  },
]);

/** Los identificadores de fila, en el orden del catálogo. Lista cerrada. */
export const IDS_DE_FILA = congelaHondo(FILAS_DE_AJUSTES.map((f) => f.id));

/** Los textos propios de la pantalla, **en voz de aplicación**. */
export const TEXTOS_DE_AJUSTES = congelaHondo({
  volver: '‹ Volver',
  titulo: 'Ajustes',
  ningunCriterio: 'ninguno',
  guardar: 'Guardar',
  cancelar: 'Cancelar',
});

/** Una fila del catálogo, o un error que **nombra el identificador** y enumera los que hay. */
export function exigeFilaDeAjustes(id, quien = 'una fila de los ajustes') {
  const fila = FILAS_DE_AJUSTES.find((f) => f.id === id);
  if (!fila) {
    throw new Error(
      `${quien}: el catálogo de ajustes no tiene ninguna fila ${JSON.stringify(id) ?? String(id)}. ` +
      `Las suyas son ${IDS_DE_FILA.join(', ')}, y el catálogo es cerrado a propósito`,
    );
  }
  return fila;
}

/**
 * La etiqueta de una fila. Casi todas la traen escrita; la del tramo sale del guion del
 * arranque, que es donde la pregunta ya está redactada y donde su excepción está declarada.
 */
export function etiquetaDeFila(fila) {
  if (typeof fila.etiqueta === 'string' && fila.etiqueta) return fila.etiqueta;
  const de = fila.etiquetaDelGuion;
  if (!de) {
    throw new Error(`la fila "${fila.id}" de los ajustes no trae etiqueta ni dice de qué pieza del guion sale la suya`);
  }
  return textoDelGuion(de.paso, de.pieza);
}

/** Las filas de un grupo, en orden. Un grupo que el catálogo no tiene falla nombrándolo. */
export function filasDeGrupo(grupo) {
  const filas = FILAS_DE_AJUSTES.filter((f) => f.grupo === grupo);
  if (!filas.length) {
    throw new Error(`el catálogo de ajustes no tiene ningún grupo "${grupo}": los cinco son ${IDS_DE_GRUPO.join(', ')}`);
  }
  return filas;
}

/** El error de una fila sin dueño cableado. Nombra la fila **y la pieza que falta**. */
function faltaCableado(fila) {
  return new Error(
    `la fila "${fila.id}" de los ajustes no se puede componer: falta ${fila.necesita}, que la pone ${fila.dueña}. ` +
    'La pantalla no se compone y lo dice, en lugar de pintarla apagada: una fila gris que no hace nada es exactamente ' +
    'una pieza que, al no estar, no protesta',
  );
}

/**
 * El valor mostrado de una fila, derivado del estado.
 *
 * @param {string} id el identificador de la fila; uno que el catálogo no tenga falla nombrándolo.
 * @param {object} contexto lo que cada fila necesita. Lo que falte hace fallar la fila
 *   nombrando la pieza, nunca devolver un hueco.
 */
export function valorDeFila(id, contexto = {}) {
  const fila = exigeFilaDeAjustes(id, 'el valor de una fila de los ajustes');
  const { personaje, ajustes, estilo, catalogoDeEstilos = ESTILOS, tamanoDeTexto, criterios, sitiosMarcados, puertas } = contexto;

  switch (fila.id) {
    case 'tramo': {
      const tramo = personaje?.tramo ?? null;
      if (!tramo) throw faltaCableado(fila);
      if (typeof tramo.respuesta !== 'string' || !tramo.respuesta) {
        throw new Error(
          `la fila "tramo" enseña la respuesta declarada del catálogo de SPEC-004 y el tramo de esta partida no viene de ninguna ` +
          '(llegó sin respuesta): enseñar los metros sería exactamente la distancia que esta fila no dice nunca',
        );
      }
      // La respuesta declarada, en lenguaje de sitios. Nunca una distancia, un tiempo ni
      // un ritmo, y ninguna insinuación de que últimamente se ande más o menos: el ajuste
      // no se comenta jamás (`accesibilidad.md` §1).
      return textoDeRespuestaDeTramo(tramo.respuesta);
    }
    case 'caminos-que-evitar': {
      if (!Array.isArray(criterios)) throw faltaCableado(fila);
      for (const criterio of criterios) {
        if (!CRITERIOS.includes(criterio)) {
          throw new Error(`la fila "caminos-que-evitar" recibe el criterio ${JSON.stringify(criterio)}, que su dueña no reconoce: los cuatro declarados son ${CRITERIOS.join(', ')}`);
        }
      }
      if (!criterios.length) return TEXTOS_DE_AJUSTES.ningunCriterio;
      // En el orden del catálogo y no en el de llegada: dos partidas con lo mismo elegido
      // tienen que leer lo mismo.
      return CRITERIOS.filter((c) => criterios.includes(c)).map((c) => PALABRAS_DE_CRITERIO[c]).join(', ');
    }
    case 'nombre': {
      const nombre = personaje?.nombre ?? null;
      if (typeof nombre !== 'string' || !nombre) throw faltaCableado(fila);
      return nombre;
    }
    case 'genero':
      return PALABRAS_DE_GENERO[exigeGenero(personaje?.genero, 'el género gramatical de quien juega')];
    case 'como-se-pinta': {
      if (typeof estilo !== 'string' || !estilo) throw faltaCableado(fila);
      // SPEC-021 sustituye y lo declara, en lugar de fallar, porque una partida que no
      // abre por el nombre de un estilo es un precio desproporcionado. Aquí sí se falla:
      // la fila enseñaría «Reino» junto a un estilo guardado que no es Reino, y eso es
      // caer al de por defecto sin decirlo.
      const { estilo: resuelto, sustitucion } = resuelveEstilo(estilo, catalogoDeEstilos);
      if (sustitucion) {
        throw new Error(
          `la fila "como-se-pinta" tiene guardado el estilo "${estilo}", que ya no está en el catálogo de SPEC-021 ` +
          `(los que hay son ${catalogoDeEstilos.map((e) => e.id).join(', ')}): se falla nombrándolo en lugar de enseñar "${sustitucion.usado}" ` +
          'como si fuera el elegido',
        );
      }
      // El nombre visible del estilo, que es `title` y no `label` —esa es la tipografía de
      // los rótulos del mapa, y confundirlas es una trampa documentada del repo—.
      return resuelto.title;
    }
    case 'tamano-de-letra': {
      if (typeof tamanoDeTexto !== 'string' || !tamanoDeTexto) throw faltaCableado(fila);
      // La escala se consume tal cual de SPEC-021 y no se redefine ninguna: el escalón se
      // lee en palabras y el factor no sale nunca a pantalla.
      exigeTamanoDeTexto(tamanoDeTexto, 'el tamaño de letra de la fila de ajustes');
      return tamanoDeTexto.split('-').join(' ');
    }
    case 'pasos-del-dia-a-dia':
    case 'solo-de-dia': {
      if (!ajustes || typeof ajustes[fila.ajuste] !== 'boolean') throw faltaCableado(fila);
      // El valor mostrado es **el real y nunca el pedido**: encender el interruptor de los
      // pasos no lo enciende, lo pide (`seguridad-privacidad.md` §2). El comportamiento es
      // de la fila 42; lo que esta fija es que aquí se lea lo que hay.
      return ajustes[fila.ajuste] ? PALABRAS_DE_INTERRUPTOR.si : PALABRAS_DE_INTERRUPTOR.no;
    }
    case 'sitios-marcados': {
      const cuantos = sitiosMarcados?.cuantos ?? sitiosMarcados;
      if (!Number.isInteger(cuantos) || cuantos < 0) throw faltaCableado(fila);
      return String(cuantos);
    }
    case 'copia':
    case 'empezar-de-nuevo': {
      // Una puerta no enseña valor: lo que se le exige es que lleve a algún sitio. Sin
      // destino cableado se pintaría un chevron que no abre nada, que es la misma forma de
      // fallo que una fila apagada.
      const destinos = Array.isArray(puertas) ? puertas : null;
      if (!destinos || !destinos.includes(fila.id)) throw faltaCableado(fila);
      return null;
    }
    default:
      throw new Error(`la fila "${fila.id}" está en el catálogo y nadie sabe derivar su valor: el catálogo y la derivación se tocan juntos`);
  }
}

/**
 * Compone A6P6 entera: los cinco grupos en orden, con sus filas y sus valores.
 *
 * Cualquier fila sin dueño cableado **impide componer la pantalla**, nombrándola. Es el
 * único sitio del juego donde eso es correcto de decir en voz alta, precisamente porque
 * aquí se habla como aplicación.
 */
export function componeAjustes(contexto = {}) {
  const grupos = GRUPOS_DE_AJUSTES.map((grupo) => ({
    id: grupo.id,
    titulo: grupo.titulo,
    filas: filasDeGrupo(grupo.id).map((fila) => ({
      id: fila.id,
      grupo: fila.grupo,
      orden: fila.orden,
      tipo: fila.tipo,
      dueña: fila.dueña,
      etiqueta: etiquetaDeFila(fila),
      testid: fila.testid ?? TESTIDS.fila,
      chevron: fila.tipo === 'puerta',
      destructivaEnLaLista: fila.destructivaEnLaLista === true,
      valor: valorDeFila(fila.id, contexto),
    })),
  }));

  const filas = grupos.flatMap((g) => g.filas);

  const textos = coloca([
    textoConRegistro({ id: 'volver', registro: REGISTROS.APLICACION, texto: TEXTOS_DE_AJUSTES.volver }),
    textoConRegistro({ id: 'titulo', registro: REGISTROS.APLICACION, texto: TEXTOS_DE_AJUSTES.titulo }),
    ...grupos.map((g) => textoConRegistro({ id: `grupo-${g.id}`, registro: REGISTROS.APLICACION, texto: g.titulo })),
    ...filas.map((f) => textoConRegistro({ id: `fila-${f.id}`, registro: REGISTROS.APLICACION, texto: f.etiqueta })),
  ], { sitio: SITIO, pantalla: 'a6p6' });

  return congelaHondo({
    momento: MOMENTO,
    // La única excepción de todo el juego, declarada en el dato. De aquí sale la
    // tipografía —la sans— sin que la pantalla la elija a mano.
    registro: REGISTROS.APLICACION,
    textos,
    grupos,
    filas,
  });
}

// --- El nombre y el género: se cambian sin tocar el mundo ---------------------
//
// Ninguno de los dos entra en ninguna semilla. Cambiarlos no toca la semilla de la
// partida, no toca la derivación de semillas de fase y no toca el índice de nombres del
// mundo, así que **no puede mover un byte de ningún documento congelado**. Eso es un
// criterio y no una esperanza, y se sostiene por construcción: aquí no hay ni una
// llamada que reciba una semilla ni que escriba en un mundo.

/** El tope del nombre y sus motivos, reexportados desde donde ya viven. */
export { TOPE_DEL_NOMBRE };

/**
 * La edición de «Cómo te llamas»: el nombre actual precargado y las sugerencias, **con
 * las femeninas primero**. No avisa de nada al guardar: se guarda y se vuelve.
 */
export function edicionDelNombre({ personaje, semilla, locale = 'es', paquete = null, ronda = 0 }) {
  if (typeof personaje?.nombre !== 'string' || !personaje.nombre) {
    throw new Error('la edición del nombre precarga el nombre actual y el personaje no tiene ninguno: el arranque siempre deja uno puesto');
  }
  return congelaHondo({
    testid: TESTIDS.nombre,
    registro: REGISTROS.APLICACION,
    actual: personaje.nombre,
    tope: TOPE_DEL_NOMBRE,
    sugerencias: sugerenciasDeNombre({ semilla, locale, paquete, ronda }),
    guardar: TEXTOS_DE_AJUSTES.guardar,
    cancelar: TEXTOS_DE_AJUSTES.cancelar,
  });
}

/**
 * Cambia el nombre desde los ajustes. Un nombre que no pasa **no se guarda** y el
 * anterior sigue, que es lo mismo que hace el arranque.
 *
 * Un nombre igual al de un NPC del mundo se acepta: el índice de nombres únicos es del
 * mundo y el personaje no entra en él.
 */
export function cambiaElNombre(personaje, texto, { filtro, tope = TOPE_DEL_NOMBRE } = {}) {
  return ponNombre(personaje, texto, { filtro, tope });
}

/** La elección de «Cómo se dirigen a ti»: los dos del enumerado, el actual marcado. */
export function eleccionDelGenero(personaje) {
  const actual = exigeGenero(personaje?.genero, 'el género gramatical de quien juega');
  return congelaHondo({
    testid: TESTIDS.genero,
    registro: REGISTROS.APLICACION,
    actual,
    opciones: IDS_DE_GENERO.map((id) => ({ id, texto: PALABRAS_DE_GENERO[id], marcada: id === actual })),
  });
}

/**
 * Cambia el género gramatical. **No siembra nada**: los textos del narrador ya escritos
 * siguen tal cual y ninguno se vuelve a pedir, porque `quests.md` decisión 1 manda no
 * regenerar prosa al vuelo y reescribirlos exigiría red en un momento que no la tiene.
 * Los textos de plantilla que se componen a partir de ahora ya concuerdan con el nuevo.
 */
export function cambiaElGenero(personaje, genero) {
  return ponGenero(personaje, genero);
}

// --- El catálogo se revisa a sí mismo al cargarse -----------------------------

const REGLAS_DE_PALABRA = congelaHondo(PALABRAS_QUE_NINGUNA_FILA_DICE.map(reglaDeFormula));

/** Las palabras prohibidas que dice un texto, como datos. */
export function palabrasProhibidasEn(texto) {
  return REGLAS_DE_PALABRA.filter((r) => r.re.test(String(texto))).map((r) => r.formula);
}

/**
 * Revisa el catálogo entero y devuelve lo que incumple, como datos.
 *
 * Se llama al cargarse el módulo, igual que los dos guiones: una fila del oficio o una
 * etiqueta que dijera «accesibilidad» tienen que fallar aquí y no en la pantalla de
 * alguien.
 */
export function revisaCatalogoDeAjustes() {
  const problemas = [];
  const vistos = new Set();
  let anterior = 0;

  for (const fila of FILAS_DE_AJUSTES) {
    if (vistos.has(fila.id)) problemas.push({ clave: fila.id, que: 'fila repetida' });
    vistos.add(fila.id);
    if (!IDS_DE_GRUPO.includes(fila.grupo)) problemas.push({ clave: fila.id, que: `declara el grupo "${fila.grupo}", que no está entre los cinco` });
    if (!TIPOS_DE_FILA.includes(fila.tipo)) problemas.push({ clave: fila.id, que: `declara el tipo "${fila.tipo}", que no está entre los tres` });
    if (fila.orden !== anterior + 1) problemas.push({ clave: fila.id, que: `declara el orden ${fila.orden} y el catálogo va en orden correlativo` });
    anterior = fila.orden;
    if (typeof fila.dueña !== 'string' || !fila.dueña) problemas.push({ clave: fila.id, que: 'no declara qué fila del checklist la posee' });
    if (typeof fila.necesita !== 'string' || !fila.necesita) problemas.push({ clave: fila.id, que: 'no declara qué pieza hay que inyectarle' });
    for (const palabra of palabrasProhibidasEn(etiquetaDeFila(fila))) {
      problemas.push({ clave: fila.id, que: `su etiqueta dice "${palabra}", y ninguna fila lo dice` });
    }
    for (const prohibida of LO_QUE_LOS_AJUSTES_NO_TIENEN) {
      if (fila.id === prohibida) problemas.push({ clave: fila.id, que: `es una de las filas que los ajustes no tienen: ${LO_QUE_LOS_AJUSTES_NO_TIENEN.join(', ')}` });
    }
  }

  // Los cinco grupos existen y ninguno se queda sin filas.
  for (const grupo of IDS_DE_GRUPO) {
    if (!FILAS_DE_AJUSTES.some((f) => f.grupo === grupo)) problemas.push({ clave: grupo, que: 'es un grupo del catálogo sin ninguna fila' });
  }

  // Las filas de un grupo van seguidas: un grupo partido en dos trozos se pintaría dos veces.
  const orden = FILAS_DE_AJUSTES.map((f) => IDS_DE_GRUPO.indexOf(f.grupo));
  for (let i = 1; i < orden.length; i += 1) {
    if (orden[i] < orden[i - 1]) problemas.push({ clave: FILAS_DE_AJUSTES[i].id, que: 'rompe el orden de los grupos' });
  }

  // «Empezar de nuevo» es la última de todas, y no la acción principal de la pantalla.
  const ultima = FILAS_DE_AJUSTES[FILAS_DE_AJUSTES.length - 1];
  if (ultima.id !== 'empezar-de-nuevo') problemas.push({ clave: ultima.id, que: 'la última fila del catálogo tiene que ser empezar-de-nuevo' });
  if (ultima.destructivaEnLaLista !== false) problemas.push({ clave: ultima.id, que: 'se marca como destructiva dentro de la lista, y lo destructivo se declara en su propia pantalla' });

  // Las dos puertas son las dos últimas, y las únicas.
  const puertas = FILAS_DE_AJUSTES.filter((f) => f.tipo === 'puerta').map((f) => f.id);
  if (puertas.join(',') !== 'copia,empezar-de-nuevo') problemas.push({ clave: puertas.join(',') || '(ninguna)', que: 'las puertas son «guardar una copia» y «empezar de nuevo», y son las dos últimas' });

  // Cada criterio de «caminos que evitar» tiene su palabra, y ninguna dice lo que no se dice.
  for (const criterio of CRITERIOS) {
    const palabra = PALABRAS_DE_CRITERIO[criterio];
    if (typeof palabra !== 'string' || !palabra) {
      problemas.push({ clave: `caminos-que-evitar/${criterio}`, que: 'el criterio no tiene palabra con la que resumirse' });
      continue;
    }
    for (const dicha of palabrasProhibidasEn(palabra)) problemas.push({ clave: `caminos-que-evitar/${criterio}`, que: `dice "${dicha}"` });
  }

  // Y los escalones de tamaño de letra son los de SPEC-021, tal cual: si aquí se
  // redefiniera uno, la fila enseñaría un escalón que la escena no tiene.
  if (IDS_DE_TAMANO_DE_TEXTO.length !== ESCALA_DE_TEXTO.length) {
    problemas.push({ clave: 'tamano-de-letra', que: 'la escala de tamaño de texto no es la que declara la escena' });
  }

  return problemas;
}

{
  const problemas = revisaCatalogoDeAjustes();
  if (problemas.length) {
    throw new Error(
      `el catálogo de ajustes no pasa su propia revisión:\n${problemas.map((p) => `  · ${p.clave}: ${p.que}`).join('\n')}`,
    );
  }
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no hay
// ninguna fila del oficio, no hay ninguna que cambie el mapa activo, no hay ninguna que
// hable de la red, de una cuenta, de una suscripción o de analítica, y no hay manera de
// añadir una fila desde fuera. El catálogo es cerrado, y esa es la pieza.

