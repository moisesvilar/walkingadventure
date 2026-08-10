// Lo que el **sistema operativo** pone en la atestación del proxy: qué mecanismo le
// toca a esta compilación y de dónde saldría la evidencia. Vive aquí porque es el único
// sitio de la app donde se puede mirar en qué sistema se está corriendo (RNF-COM-001), y
// porque lo que hay debajo son dos módulos nativos distintos.
//
// **Hoy no hay ninguno de los dos.** App Attest y Play Integrity son dependencias que
// ninguna spec ha nombrado, así que esta compilación no puede producir una evidencia de
// verdad. Eso no se disimula y no se inventa una: se declara, igual que hacen
// `ubicacion.js` con el proveedor sin montar y `rotulo.*.js` con la capacidad ausente. Y
// no es una avería, es un modo diseñado — sin evidencia válida el proxy sirve solo lo
// que ya está en su caché, la aventura sigue con textos de plantilla y **ninguna
// pantalla lo menciona** (`POLITICA_SIN_ATESTACION = solo-cache`, SPEC-023).
//
// La partición por sistema no se hace con dos ficheros con sufijo porque aquí no hay dos
// ciclos de vida que separar: hay un rótulo distinto y el mismo hueco debajo. El día que
// entre el módulo nativo, esto se parte en `atestacion.ios.js` y `atestacion.android.js`
// como el rótulo, y quien llama no se entera.

import { Platform } from 'react-native';

/**
 * Cómo se llama el mecanismo de cada sistema en `server/atestacion.mjs`.
 *
 * Copia declarada de `PLATAFORMAS` del servidor: mandar un rótulo que el proxy no
 * declara se rechaza con «plataforma no declarada», y el móvil se quedaría sin fichas
 * sin que nada dijera por qué.
 */
export const MECANISMO_POR_SISTEMA = Object.freeze({ ios: 'app-attest', android: 'play-integrity' });

/** El que le toca a esta compilación, o `null` si el sistema no tiene ninguno declarado. */
export function mecanismoDeAtestacion(os = Platform.OS) {
  return MECANISMO_POR_SISTEMA[os] ?? null;
}

/**
 * De dónde sale la evidencia de plataforma. Hoy, de ningún sitio, **y se dice**.
 *
 * Devolver `null` aquí es lo que hace que el cliente declare la ausencia en el cuerpo de
 * la llamada en lugar de fabricar algo que parezca una atestación. Cuando exista el
 * módulo nativo, esto pasa a ser la función que se lo pide y nada más cambia de sitio.
 */
export function evidenciaDelSistema() {
  return null;
}

/** Por qué no la hay, para quien tenga que diagnosticarlo. No lo lee ninguna pantalla. */
export const MOTIVO_SIN_EVIDENCIA =
  'esta compilación no trae App Attest ni Play Integrity: ninguna spec ha nombrado la dependencia que los daría';
