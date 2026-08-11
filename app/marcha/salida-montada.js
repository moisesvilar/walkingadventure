// El punto de montaje de la vida de una salida: junta los dos módulos nativos, la única
// suscripción al sensor, el rótulo del sistema de la plataforma que toque y el generador, y
// entrega la orquestación ya cableada.
//
// Es el mismo reparto que `arranque-montado.jsx` y `en-marcha-montado.jsx`: aquí se decide
// **qué** se monta, y quien quiera un montaje doblado —una suscripción guionizada, un
// rótulo que registra— llama a `creaLaSalida` directamente. Esa frontera es lo que permite
// recorrer la vida entera de una salida en `node --test` sin ningún dispositivo, y es la
// razón de que este fichero sea lo único de la fila que importa de Expo.
//
// El rótulo se resuelve **preguntándole a su sonda** y no mirando el sistema operativo: la
// pareja `rotulo.ios.js` / `rotulo.android.js` la elige Metro por el sufijo, y cada una sabe
// si lo suyo está en esta compilación. En iOS responde que no y la salida no se abre, con el
// motivo del rótulo a la vista; bifurcar aquí por sistema operativo sería mover la partición
// fuera de `app/plataforma/`, que es donde `CLAUDE.md` la encierra.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { NUCLEO_DE_LA_SALIDA } from '../nucleo/piezas.js';
import { exigeTareaDeclarada } from '../plataforma/permisos.js';
import { creaSuscripcionDeUbicacion } from '../plataforma/posiciones.js';
// Sin extensión a propósito: es así como Metro elige entre las dos implementaciones del
// rótulo. Es la misma razón por la que `plataforma/index.js` importa `./rotulo`.
import { creaRotulo, rotulo as capacidadDelRotulo, rotuloSinMontar } from '../plataforma/rotulo';
import { creaLaSalida } from './salida.js';

/**
 * Un rótulo **montado y sin poder usarse**, que es un estado distinto de «no montado» y se
 * arregla en otro sitio. `rotuloSinMontar` no lo puede expresar —siempre dice no montado— y
 * añadirle un tercer constructor rompería la simetría de exportaciones de la pareja, que es
 * lo que garantiza que las dos plataformas ofrezcan lo mismo.
 */
function rotuloSinPoderUsarse(motivo) {
  return { ...rotuloSinMontar(motivo), montado: true };
}

/**
 * Monta la vida de una salida sobre esta compilación.
 *
 * @param {object} piezas
 *   `salidas` el área de la partida; `origen` el `{lat, lon}` del mundo congelado, que es el
 *   cero de sus metros; `tramo` el de quien juega; `alCambiar` a quién se avisa cuando algo
 *   se movió.
 * @returns la orquestación de `creaLaSalida`, siempre: sin rótulo o sin sensor **también se
 *   monta**, y lo que cambia es que abrir responde que no con su motivo. Devolver `null`
 *   dejaría a quien la usa sin nadie a quien preguntar por qué.
 */
export async function montaLaSalida({ salidas, origen = null, tramo = null, alCambiar = null }) {
  // La orquestación se referencia antes de existir porque la suscripción necesita a quién
  // empujar cada posición: es un empujón y no un sondeo por reloj, que es lo que evita un
  // temporizador corriendo mientras alguien anda.
  let laSalida = null;

  const suscripcion = creaSuscripcionDeUbicacion({
    Location,
    TaskManager,
    declaraTarea: exigeTareaDeclarada,
    alRecibir: () => {
      if (laSalida) void laSalida.recibeLaPosicion();
    },
  });

  const respuesta = await capacidadDelRotulo.sonda().catch((e) => ({
    montado: true,
    disponible: false,
    motivo: `la sonda del rótulo falló: ${e?.message ?? String(e)}`,
  }));

  let rotulo;
  if (respuesta?.montado !== true) {
    rotulo = rotuloSinMontar(respuesta?.motivo ?? undefined);
  } else if (respuesta?.disponible !== true) {
    rotulo = rotuloSinPoderUsarse(respuesta?.motivo ?? 'la sonda no dijo por qué');
  } else if (!suscripcion) {
    rotulo = rotuloSinPoderUsarse('el rótulo está montado y la suscripción al sensor no: sin ella el servicio en primer plano no tendría nada que sostener');
  } else {
    // Las cuatro operaciones del contrato sobre la única suscripción. Las tres primeras son
    // síncronas por contrato y aquí disparan una promesa: lo que no puede perderse dentro de
    // ella es el arranque, y por eso `creaLaSalida` lo espera aparte antes de abrir.
    rotulo = creaRotulo({
      arranca: (compuesto) => { void suscripcion.arranca(compuesto); },
      actualiza: (compuesto) => { void suscripcion.actualiza(compuesto); },
      para: () => { void suscripcion.para(); },
      // Lo que se puede preguntar de verdad, refrescado por `reconcilia()`: creer sin
      // comprobar es lo que deja una salida sostenida por un servicio que el sistema mató.
      corriendo: () => suscripcion.corriendo(),
    });
  }

  laSalida = creaLaSalida({
    nucleo: NUCLEO_DE_LA_SALIDA,
    salidas,
    rotulo,
    suscripcion,
    origen,
    tramo,
    alCambiar,
    // El permiso de las notificaciones, pedido al abrir la primera salida y no antes: es
    // lo que `permisos.js` declara y lo que hace que el rótulo se vea. Sin él el servicio
    // corre igual y Android lo enseña entre las apps activas, así que denegarlo no impide
    // andar. Medido en el emulador: con el permiso bloqueado el servicio sigue en primer
    // plano y su notificación queda suprimida.
    pidePermisoDeAviso: async () => {
      if (typeof Notifications?.getPermissionsAsync !== 'function') return;
      const concedido = await Notifications.getPermissionsAsync();
      if (concedido?.granted === true || concedido?.canAskAgain === false) return;
      await Notifications.requestPermissionsAsync();
    },
  });
  return laSalida;
}
