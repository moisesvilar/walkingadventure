// La composición de la portada, A2P1: **qué bloques hay y en qué orden**, sobre un
// vocabulario cerrado.
//
// Que el vocabulario sea cerrado es el punto entero de esta pieza. «No hay panel del estado
// del mundo», «no hay marcador de reputación», «no hay barra de pestañas» y «no hay selector
// de mapas» son ausencias que el diseño defiende por escrito, y una ausencia solo se puede
// afirmar contra una enumeración de lo que sí hay: comprobada a ojo es un criterio que se
// cumple casi siempre y no mide nada (`pipeline/decisiones-orquestador.md` §6o). Con la
// composición como dato, se afirman como igualdades en `node --test`, sin dispositivo — y
// añadir uno de esos bloques obligaría a ampliar la lista, que es exactamente el sitio donde
// se quiere que salte.
//
// Lo que esta capa **no** hace: pintar. Ni un color, ni una tipografía, ni una posición.
// Devuelve qué se monta y con qué contenido; el cómo es de `app/`.

import { congelaHondo } from '../core/congelar.js';
import { diaDe } from './calendario.js';
import { textoDelGuion } from './guion-de-antes-de-salir.js';
import { salidaAbierta } from './salida-abierta.js';

/**
 * Los bloques que la portada puede tener. **Lista cerrada y en el orden en que se leen.**
 *
 * `identidad` va suelto y no dentro de la miniatura aunque el dibujo los junte: el criterio
 * los enumera por separado y lo que se afirma es la enumeración.
 */
export const BLOQUES_DE_PORTADA = congelaHondo([
  'miniatura',
  'identidad',
  'a-medias',
  'acciones-de-salir',
  'puertas',
]);

/**
 * Lo que la portada no tiene, nombrado para que la ausencia se pueda poner roja.
 *
 * No es documentación: es la otra mitad del vocabulario cerrado. Un bloque de esta lista que
 * apareciera en `BLOQUES_DE_PORTADA` sería un rediseño con nombre y apellidos.
 */
export const BLOQUES_QUE_LA_PORTADA_NO_TIENE = congelaHondo([
  'panel-del-mundo',
  'marcador-de-reputacion',
  'barra-de-pestanas',
  'selector-de-mapas',
]);

/** Las tres puertas, en orden. Tres, y cuelgan de la portada. */
export const PUERTAS = congelaHondo(['diario', 'repisa', 'ajustes']);

/**
 * Las dos maneras de salir, **al mismo nivel**.
 *
 * `quests.md` decisión 4: los kilómetros mueven el mundo con aventura o sin ella. Van las dos
 * con el mismo `nivel` porque poner «salir a andar sin más» como enlace pequeño bajo un botón
 * grande diría lo contrario de lo que el diseño decidió, y lo diría más alto que cualquier texto.
 */
export const ACCIONES_DE_SALIR = congelaHondo(['ver-que-se-cuenta', 'salir-sin-mas']);

/** El único nivel que hay en las acciones de salir. Uno solo: no existe el segundo nivel aquí. */
export const NIVEL_DE_LAS_ACCIONES = 'primero';

/** Los dos destinos de «Ver qué se cuenta hoy». El zurrón es de la fila 42; aquí solo la puerta. */
export const DESTINOS_DE_VER = Object.freeze({ ZURRON: 'zurron', LISTA: 'lista-de-hoy' });

/** Las dos acciones de la tarjeta de a medias. Ninguna pide confirmación. */
export const ACCIONES_DE_A_MEDIAS = congelaHondo(['a-medias-seguir', 'a-medias-dejarlo']);

/**
 * Las tintas de la miniatura: lo entintado contra lo que sigue a lápiz. **Ningún porcentaje.**
 *
 * Se enumeran para que la miniatura pueda declarar qué enseña sin que se le pueda colar una
 * cifra de progreso: lo que no sale de aquí no se puede pintar por descuido.
 */
export const TINTAS_DE_LA_MINIATURA = congelaHondo(['de-hoy', 'asentado', 'a-lapiz']);

/** Un bloque del vocabulario, o un error que enumera los que hay y los que no puede haber. */
export function exigeBloqueDePortada(id) {
  if (!BLOQUES_DE_PORTADA.includes(id)) {
    throw new Error(
      `"${id}" no es un bloque de la portada: los que hay son ${BLOQUES_DE_PORTADA.join(', ')}. ` +
      `Y estos no existen a propósito: ${BLOQUES_QUE_LA_PORTADA_NO_TIENE.join(', ')}`,
    );
  }
  return id;
}

function exigeTexto(valor, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)} y la portada lo necesita escrito`);
  }
  return valor;
}

/**
 * Si la puerta del zurrón existe: **con el modo de pasos de fondo encendido y algo que vaciar**.
 *
 * Las dos condiciones, y no una: con el modo apagado no hay reserva que llenar, y con el modo
 * encendido y la reserva vacía la pantalla enseñaría un resumen de nada. De origen el modo está
 * apagado (SPEC-027), así que de fábrica esta puerta no aparece nunca.
 */
export function hayZurronQueVaciar({ modoDeFondo = false, reserva = 0 } = {}) {
  const cuantos = Array.isArray(reserva) ? reserva.length : reserva;
  if (!Number.isInteger(cuantos) || cuantos < 0) {
    throw new Error(`la reserva del zurrón se cuenta en pasos guardados y llegó ${JSON.stringify(reserva) ?? String(reserva)}`);
  }
  return modoDeFondo === true && cuantos > 0;
}

/**
 * Compone la portada.
 *
 * @param {object} opciones
 *   `calendario` el de la partida, inyectado —su ausencia es avería y no día uno—; `personaje`
 *   con su nombre y su oficio; `mundo` con su título y su identificador de mapa; `salidas` el
 *   registro de la salida abierta; `zurron` el modo de pasos de fondo y lo que haya en reserva.
 * @returns `{ bloques, dia, miniatura, identidad, aMedias, acciones, puertas }`, congelado.
 *   `bloques` es la enumeración sobre la que se afirma todo lo demás.
 */
export function componePortada({ calendario, personaje, mundo, salidas, zurron = {} }) {
  const dia = diaDe(calendario, 'la portada');
  if (!personaje || typeof personaje !== 'object') {
    throw new Error('la portada se compone sobre el personaje de la partida y no llegó ninguno');
  }
  const nombre = exigeTexto(personaje.nombre, 'el nombre del personaje');
  // El oficio se lee dicho si viene dicho: la palabra concuerda con quien juega y por eso vive
  // en la app —`oficios.js` declara claves sin género a propósito—. Sin ella se enseña la
  // clave, que es fea pero cierta, y nunca nada inventado.
  const oficio = exigeTexto(personaje.oficioDicho ?? personaje.oficio, 'el oficio del personaje');
  if (!mundo || typeof mundo !== 'object') {
    throw new Error('la portada se compone sobre el mapa levantado y no llegó ninguno');
  }
  const abierta = salidas ? salidaAbierta(salidas) : null;

  const bloques = ['miniatura', 'identidad'];
  if (abierta) bloques.push('a-medias');
  bloques.push('acciones-de-salir', 'puertas');
  bloques.forEach(exigeBloqueDePortada);

  const alZurron = hayZurronQueVaciar(zurron);

  return congelaHondo({
    bloques,
    // El día va al lado del encabezado y no dentro de ningún texto: es la única cifra de la
    // portada y no es una cifra de esfuerzo.
    dia,
    miniatura: {
      encabezado: textoDelGuion('a2p1', 'encabezado'),
      dia,
      mapa: mundo.mapaId ?? mundo.id ?? null,
      titulo: mundo.titulo ?? null,
      // Lo entintado contra lo que sigue a lápiz, y ni un porcentaje: la miniatura declara
      // qué tintas enseña, no cuánto llevas.
      tintas: [...TINTAS_DE_LA_MINIATURA],
      // Ni se toca: la lámina entera se lee desde el diario, que es de la fila 37.
      tocable: false,
    },
    // Nombre y oficio, y **ninguna cifra**: ni oro, ni rango, ni pasos. El rango se nota en
    // cómo te hablan, y bajo el nombre sería un medidor con otro nombre.
    identidad: { nombre, oficio },
    aMedias: abierta
      ? {
        titulo: textoDelGuion('a2p1', 'a-medias-titulo'),
        aventura: abierta.aventura,
        // Dónde se quedó, dicho con el nombre del mundo. Sin sitio anotado no se inventa uno.
        donde: abierta.sitio,
        salida: abierta.salida,
        acciones: [
          { id: 'a-medias-seguir', texto: textoDelGuion('a2p1', 'a-medias-seguir'), nivel: NIVEL_DE_LAS_ACCIONES },
          { id: 'a-medias-dejarlo', texto: textoDelGuion('a2p1', 'a-medias-dejarlo'), nivel: 'segundo' },
        ],
        // No es una pantalla: lo de debajo sigue estando entero.
        secuestraLaPortada: false,
        // Y no pregunta «¿seguro?»: cerrar una salida no destruye nada, produce un desenlace.
        pideConfirmacion: false,
      }
      : null,
    acciones: [
      {
        id: 'ver-que-se-cuenta',
        texto: textoDelGuion('a2p1', 'ver-que-se-cuenta'),
        nivel: NIVEL_DE_LAS_ACCIONES,
        destino: alZurron ? DESTINOS_DE_VER.ZURRON : DESTINOS_DE_VER.LISTA,
      },
      {
        id: 'salir-sin-mas',
        texto: textoDelGuion('a2p1', 'salir-sin-mas'),
        nivel: NIVEL_DE_LAS_ACCIONES,
        destino: null,
      },
    ],
    // Fila al pie, no barra de pestañas: cuelgan de la portada y no compiten con ella.
    puertas: PUERTAS.map((id) => ({ id, texto: textoDelGuion('a2p1', `puerta-${id}`) })),
    enBarraDePestanas: false,
  });
}
