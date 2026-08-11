// El rótulo del sistema, implementación de Android: un **servicio en primer plano**
// con notificación persistente. Es lo que hace que la app cuente como «en uso» con la
// pantalla apagada, y por tanto lo que permite no pedir nunca el permiso de ubicación
// permanente (`seguridad-privacidad.md` §2, exclusión 12 del PRD).
//
// Su pareja es `rotulo.ios.js` y exporta exactamente los mismos nombres. Lo que
// difiere entre las dos es el **ciclo de vida**, nunca el texto: los literales de la
// línea y de la única acción los compone `packages/nucleo/partida/rotulo.js` y llegan
// aquí hechos.
//
// La diferencia de Android que hay que tener delante (riesgo 4 del PRD): **al servicio
// lo puede matar el sistema** al recuperar memoria y volver con el proceso. Por eso
// `presente()` no devuelve lo que esta capa recuerda haber hecho, sino lo que se puede
// preguntar de verdad — y por eso quien arranca reconcilia en lugar de dar por buena la
// situación guardada.
//
// El contrato de `creaRotulo` se ejercita en `node --test` contra un doble y el mecanismo
// entra por la firma; lo único que este fichero importa del nativo es lo que su **sonda**
// necesita para poder responder «montada» sin mentir, que es una pregunta que no se puede
// contestar sin mirar la compilación. Sondear no es pedir: aquí no se llama a ningún
// diálogo del sistema.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

/** El mecanismo real de esta plataforma, para que nadie tenga que redescubrirlo. */
export const MECANISMO = 'servicio en primer plano de Android con notificación persistente';

/**
 * Lo que esta plataforma necesita declarado, y que se comprueba contra `app.json`.
 *
 * `tipoDeServicio` es el que Android exige desde el nivel 34 para leer la ubicación en
 * primer plano; el canal va en importancia baja porque el rótulo **no avisa de nada**:
 * es permanente y visible a propósito, que es lo contrario de un aviso. Y
 * `descartable: false` no es una preferencia: una notificación que se puede tirar
 * deslizando deja la app leyendo la ubicación sin decirlo.
 */
export const DECLARACION = Object.freeze({
  servicio: 'servicio en primer plano',
  tipoDeServicio: 'location',
  canal: Object.freeze({ id: 'salida-abierta', nombre: 'Salida abierta', importancia: 'baja' }),
  descartable: false,
  permisos: Object.freeze(['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS']),
  permisoPermanente: false,
  // Lo que el mecanismo de esta compilación **no** entrega de lo que `DECLARACION` pide,
  // medido sobre `expo-location` en SPEC-048 y escrito aquí en vez de disimulado. Las dos
  // ausencias son de la librería y no del diseño, y las dos tienen arreglo conocido.
  loQueNoEntrega: Object.freeze([
    Object.freeze({
      que: 'la única acción del rótulo',
      porque: 'la notificación del servicio en primer plano la compone `expo-location` y sus opciones son título, línea, color y si muere con la app: no hay manera de añadirle una acción',
      haria_falta: 'un servicio en primer plano propio en Kotlin, o que `expo-location` expusiera la categoría de la notificación',
      mientras_tanto: 'tocar el rótulo abre la app, y «dejarlo aquí» sigue entero en la tarjeta de a medias de la portada',
    }),
  ]),
  // Y lo que sí entrega y estaba en duda, medido sobre el dispositivo el 11-ago-2026 con
  // `dumpsys notification`: el canal sale en `IMPORTANCE_LOW` —lo crea así el propio
  // `expo-location`— y la notificación lleva `NO_CLEAR`, o sea que no se tira deslizando.
  // Las dos son condiciones de `seguridad-privacidad.md` §2 y las dos se cumplen.
  medido: Object.freeze({
    importanciaDelCanal: 'baja',
    seDescartaDeslizando: false,
    cifrasEnLaLinea: 0,
  }),
});

/** La capacidad, con el contrato de SPEC-020 sin tocarlo. La sonda no pide ningún permiso. */
export const rotulo = {
  nombre: 'rotulo',
  // `ninguna` porque el rótulo no es una capa de aviso: es permanente y visible a
  // propósito, y meterlo en el par de capas de `accesibilidad.md` §3 lo pondría a
  // competir con los avisos, donde no pinta nada.
  capa: 'ninguna',
  async sonda() {
    // Se mira lo que la compilación trae, no lo que el proyecto declara: un `app.json`
    // con el plugin puesto y un binario sin el módulo dentro son la misma cosa para quien
    // abre una salida, y solo esta pregunta los distingue.
    if (typeof Location?.startLocationUpdatesAsync !== 'function') {
      return { montado: false, disponible: false, motivo: `${MECANISMO}: expo-location no está en esta compilación` };
    }
    if (typeof TaskManager?.defineTask !== 'function') {
      return { montado: false, disponible: false, motivo: `${MECANISMO}: expo-task-manager no está en esta compilación, y sin él no hay tarea a la que el servicio entregue las posiciones` };
    }
    // Montado y disponible **sin pedir nada**: si el permiso está denegado, quien lo
    // descubre es abrir la salida, y eso es otra respuesta con otro motivo. Sondear no es
    // pedir, y una sonda que pidiera dispararía un diálogo del sistema al abrir la app.
    return { montado: true, disponible: true, motivo: null };
  },
};

/**
 * Envuelve el módulo nativo en el contrato que la salida espera.
 *
 * Cuatro operaciones y ninguna opcional. `presente()` es la que permite comparar la
 * situación guardada con lo que hay de verdad en la pantalla de bloqueo, que es lo que
 * impide que una salida se crea sostenida sin estarlo.
 *
 * @param {object} piezas
 * @param {(rotulo:{linea:string, accion:object}) => void} piezas.arranca  arranca el
 *   servicio con su notificación.
 * @param {(rotulo:{linea:string}) => void} piezas.actualiza  cambia la línea.
 * @param {(motivo:string) => void} piezas.para  para el servicio, con el motivo.
 * @param {() => boolean} piezas.corriendo  si el servicio está corriendo **ahora**.
 */
export function creaRotulo({ arranca, actualiza, para, corriendo }) {
  for (const [nombre, pieza] of Object.entries({ arranca, actualiza, para, corriendo })) {
    if (typeof pieza !== 'function') {
      throw new Error(
        `el rótulo de Android se monta con ${nombre}() y no llegó ninguna: sin las cuatro, una salida podría quedarse creyéndose sostenida ` +
        'por un servicio que el sistema ya mató, que es la forma de fallo que este proyecto ya ha pagado cinco veces',
      );
    }
  }
  return {
    montado: true,
    disponible: true,
    motivo: null,
    mecanismo: MECANISMO,
    pone(compuesto) { arranca(compuesto); },
    actualiza(compuesto) { actualiza(compuesto); },
    retira(motivo) { para(motivo); },
    presente() { return corriendo() === true; },
  };
}

/**
 * Un rótulo que **no está montado** y lo dice al usarlo.
 *
 * Es el estado real de esta compilación, y devolverlo es la mitad de la fila: con él,
 * abrir una salida responde que no se abre y nombra la capacidad que falta, en lugar de
 * abrirla y perder la ubicación a los pocos minutos sin que nada proteste.
 */
export function rotuloSinMontar(motivo = `${MECANISMO}: no montado todavía, y ninguna spec ha nombrado la dependencia que lo daría`) {
  return {
    montado: false,
    disponible: false,
    motivo,
    mecanismo: MECANISMO,
    pone() { throw new Error(`no se puede poner el rótulo del sistema: ${motivo}`); },
    actualiza() { throw new Error(`no se puede actualizar el rótulo del sistema: ${motivo}`); },
    retira() { throw new Error(`no se puede retirar el rótulo del sistema: ${motivo}`); },
    presente() { return false; },
  };
}
