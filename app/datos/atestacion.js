// El cliente de atestación: la mitad de SPEC-023 que vive en el móvil. Pide una tanda
// de fichas anónimas a `/atestacion` y se las va dando al cliente del proxy, que es lo
// que hace que las rutas de contenido puedan servir algo que no esté ya en la caché.
//
// Sin esto la app no está rota de una forma que se vea: el proxy toma la vía sin
// atestación, que **solo sirve caché**, y en el arranque la caché de esa celda está fría
// por definición (SPEC-026), así que el mundo no se llega a generar nunca. Era el hueco
// entre SPEC-020 —que no la nombra— y SPEC-023 §18 —que la coloca aquí—.
//
// Cinco reglas lo gobiernan, y son la mitad del asunto:
//
// 1. **Ningún identificador persistente de instalación, ni siquiera anónimo.** Las
//    fichas viven en memoria y **no se escriben en el almacén**: guardarlas sería un
//    valor estable en el disco del móvil que sobrevive a la sesión, y aunque el proxy no
//    sepa de quién es, es exactamente la forma que RNF-PRIV-001 descarta. Cerrar la app
//    cuesta volver a atestar, que es una llamada.
// 2. **Sin atestación se juega igual.** Que no haya fichas no es una avería: es la vía
//    declarada del proxy. Nada de lo que pasa aquí llega a ninguna pantalla, ni con un
//    aviso, ni con un icono, ni con un texto distinto — el cliente no distingue esto de
//    estar sin cobertura, y así tiene que seguir.
// 3. **Nada de degradación silenciosa del código.** Si falta el cableado —la puerta de
//    red, la dirección del proxy, el origen de azar— esto **no se construye** y lo dice
//    nombrando la pieza. Que la atestación no valga es caso normal; que no esté
//    cableada, no.
// 4. **Y lo que hoy no se cumple del todo, dicho aquí y no escondido.** La no
//    enlazabilidad de una ficha se apoya en que el factor de cegado sea impredecible
//    para el servidor. Esta compilación **no tiene generador criptográfico**: ni Hermes
//    ni React Native ni el SDK de Expo traen `crypto.getRandomValues`, y ninguna spec ha
//    nombrado la dependencia que lo daría. `bytesDelDispositivo` cae entonces al azar del
//    motor y lo declara con `origen: 'math'`, que este cliente arrastra hasta `estado()`.
//    La alternativa —no atestar sin generador criptográfico— dejaría hoy a **todos** los
//    dispositivos sin poder levantar un mapa, porque en el arranque no hay caché. Se
//    elige la que se puede mirar y poner roja el día que haya con qué compararla.
// 5. **Sin dependencias que ninguna spec nombre.** No hay App Attest ni Play Integrity
//    en esta compilación: ninguna spec ha nombrado el módulo nativo. La evidencia real
//    se **inyecta** por la firma, y en su ausencia se declara en el cuerpo —«no traigo
//    evidencia de plataforma»— en lugar de inventarse una. Quién la acepta es el
//    verificador del servidor, y eso es asunto suyo: en producción la rechaza y se juega
//    por la vía sin atestación; en la máquina de pruebas el verificador local acepta
//    todo y por eso el mundo se genera.

import { bytesDelDispositivo } from './entropia.js';
import { desciegaTanda, preparaTanda } from './ficha-ciega.js';

/** La ruta del plano de identidad. Es la única que este cliente conoce. */
export const RUTA_DE_ATESTACION = '/atestacion';

/** Las dos plataformas que declara `server/atestacion.mjs`. Cerrada. */
export const PLATAFORMAS = Object.freeze(['app-attest', 'play-integrity']);

/**
 * Cuántas fichas se piden de una vez.
 *
 * El tope del proxy es `FICHAS_POR_TANDA` (200) y pedirlo entero sería lo natural si el
 * cegado fuera barato; no lo es —una exponenciación modular de 2048 bits por ficha, en
 * BigInt puro sobre Hermes— y la primera tanda cae **dentro del minuto de RNF-PER-001**,
 * porque el arranque no puede generar el mundo sin ella. Veinticuatro cubre el lote de
 * generación del mapa y sus fotos con margen, y volver a atestar cuesta una llamada.
 */
export const FICHAS_POR_TANDA = 24;

/**
 * Cuántos intentos **seguidos** en falso antes de dejar de pedir tandas.
 *
 * Seguidos, no en total: una tanda que llega pone el contador a cero, porque gastar las
 * veinticuatro fichas y pedir otras es el curso normal de una partida larga y no un
 * síntoma de nada. Ni un solo intento —un corte de red al abrir la app dejaría la sesión
 * entera sin fichas— ni sin tope: la vía sin atestación es un modo diseñado, así que
 * insistir en cada petición convertiría un servidor caído en una tormenta de llamadas
 * que no arregla nada.
 */
export const INTENTOS_DE_TANDA = 3;

/** Lo que se manda cuando el sistema no da evidencia. Se declara; no se inventa. */
export const SIN_EVIDENCIA_DE_PLATAFORMA = Object.freeze({
  presente: false,
  motivo: 'no llega ninguna evidencia del sistema operativo, y quien la trae lo declara en app/plataforma/atestacion.js',
});

/**
 * Monta el cliente de atestación.
 *
 * @param {object} deps
 * @param {(url: string, opciones: object) => Promise<object>} deps.pide  la puerta de
 *   red, inyectada, igual que en el cliente del proxy.
 * @param {string} deps.base  la dirección del proxy.
 * @param {string} deps.plataforma  cuál de las dos declara `server/atestacion.mjs`.
 * @param {(cuantos: number) => {origen: string, bytes: Uint8Array}} [deps.azar]  de dónde
 *   salen el nonce y el factor de cegado.
 * @param {(arg: {plataforma: string, reto: string}) => Promise<object>} [deps.evidencia]
 *   la evidencia real del sistema operativo. Sin ella se declara la ausencia.
 * @param {number} [deps.cuantas]
 */
export function creaClienteDeAtestacion({
  pide,
  base,
  plataforma,
  azar = bytesDelDispositivo,
  evidencia = null,
  cuantas = FICHAS_POR_TANDA,
}) {
  if (typeof pide !== 'function') {
    throw new Error('el cliente de atestación necesita la puerta de red inyectada: pide(url, opciones) → respuesta');
  }
  if (typeof base !== 'string' || !base) {
    throw new Error('el cliente de atestación necesita la dirección del proxy, y no la adivina');
  }
  if (!PLATAFORMAS.includes(plataforma)) {
    throw new Error(`la plataforma "${plataforma}" no es una de las que el proxy declara: ${PLATAFORMAS.join(', ')}`);
  }
  if (typeof azar !== 'function') {
    throw new Error('el cliente de atestación necesita el origen de azar: azar(n) → { origen, bytes }');
  }
  if (evidencia !== null && typeof evidencia !== 'function') {
    throw new Error('la evidencia de plataforma se pide con una función: evidencia({ plataforma, reto }) → evidencia');
  }
  const url = `${base.replace(/\/+$/, '')}${RUTA_DE_ATESTACION}`;

  // La tanda viva. En memoria y solo en memoria: ver la regla 1 de la cabecera.
  let sinGastar = [];
  let intentos = 0; // seguidos en falso; una tanda que llega lo pone a cero
  let ultimoMotivo = null;
  let origenDelAzar = null;
  let enVuelo = null;

  /** El origen de azar, con su procedencia anotada para poder mirarla. */
  const aleatorio = (cuantos) => {
    const { origen, bytes } = azar(cuantos);
    origenDelAzar = origen;
    return bytes;
  };

  /** Una llamada al plano de identidad. Devuelve el sobre, o `null` si no se pudo. */
  async function llama(cuerpo) {
    let respuesta;
    try {
      respuesta = await pide(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
    } catch (e) {
      // Lo que dijo el transporte se descarta entero: no viaja a ninguna pantalla.
      ultimoMotivo = `no se pudo llamar a la atestación: ${e && e.message ? e.message : String(e)}`;
      return null;
    }
    if (!respuesta || typeof respuesta.status !== 'number' || typeof respuesta.json !== 'function') {
      ultimoMotivo = 'la puerta de red no devolvió una respuesta con estado y cuerpo';
      return null;
    }
    let sobre;
    try {
      sobre = await respuesta.json();
    } catch (e) {
      ultimoMotivo = `la respuesta de la atestación no es JSON: ${e && e.message ? e.message : String(e)}`;
      return null;
    }
    if (!sobre || sobre.tipo !== 'atestacion') {
      ultimoMotivo = `el sobre no es del plano de identidad (tipo "${sobre && sobre.tipo}")`;
      return null;
    }
    if (sobre.ok !== true) {
      // El motivo es para el diagnóstico y nunca para la pantalla. Que la atestación
      // no valga —emulador, sistema viejo, dispositivo rooteado— es el caso normal.
      ultimoMotivo = sobre.error ? String(sobre.error) : 'la atestación no valió';
      return null;
    }
    return sobre;
  }

  /**
   * Consigue una tanda entera: reto, cegado, evidencia, descegado.
   *
   * No lanza nunca. Quedarse sin fichas es un modo diseñado del juego y no una avería:
   * lo que devuelve es cuántas consiguió.
   */
  async function consigueTanda() {
    intentos += 1;
    const primera = await llama({});
    if (!primera || typeof primera.reto !== 'string' || !primera.clave) {
      if (!ultimoMotivo) ultimoMotivo = 'la atestación no devolvió reto ni clave';
      return 0;
    }

    let cegadas;
    let secretos;
    try {
      ({ cegadas, secretos } = preparaTanda(primera.clave, cuantas, aleatorio));
    } catch (e) {
      ultimoMotivo = `no se pudo cegar la tanda: ${e && e.message ? e.message : String(e)}`;
      return 0;
    }

    let laEvidencia = SIN_EVIDENCIA_DE_PLATAFORMA;
    if (evidencia) {
      try {
        laEvidencia = await evidencia({ plataforma, reto: primera.reto });
      } catch (e) {
        // Que el sistema operativo no dé evidencia no cancela la llamada: se declara
        // igual que su ausencia, y decide el verificador del servidor.
        ultimoMotivo = `el sistema no dio evidencia: ${e && e.message ? e.message : String(e)}`;
        laEvidencia = SIN_EVIDENCIA_DE_PLATAFORMA;
      }
    }

    const segunda = await llama({ plataforma, reto: primera.reto, evidencia: laEvidencia, cegadas });
    if (!segunda || !Array.isArray(segunda.firmas) || !segunda.clave) {
      if (!ultimoMotivo) ultimoMotivo = 'la atestación no devolvió firmas';
      return 0;
    }

    try {
      sinGastar = desciegaTanda(segunda.clave, secretos, segunda.firmas);
    } catch (e) {
      ultimoMotivo = `no se pudieron desciegar las firmas: ${e && e.message ? e.message : String(e)}`;
      return 0;
    }
    ultimoMotivo = null;
    intentos = 0;
    return sinGastar.length;
  }

  return {
    url,

    /**
     * La siguiente ficha sin gastar, o `null`.
     *
     * `null` **no es un error**: es la vía sin atestación del proxy, que sirve lo ya
     * cacheado y juega entero con textos de plantilla. Por eso esto no lanza nunca y
     * por eso nadie lo enseña.
     */
    async ficha() {
      if (sinGastar.length === 0 && intentos < INTENTOS_DE_TANDA) {
        // Una sola tanda en vuelo: sin esto, las tres pantallas que montan un cliente a
        // la vez pedirían tres tandas y gastarían tres atestaciones para nada.
        if (!enVuelo) enVuelo = consigueTanda().finally(() => { enVuelo = null; });
        await enVuelo;
      }
      return sinGastar.length ? sinGastar.shift() : null;
    },

    /**
     * Qué le ha pasado a la atestación, para diagnóstico. **No lo pinta nadie**: no hay
     * ninguna pantalla que hable de la red ni de la atestación, y esta no va a ser la
     * primera. Existe para poder mirarlo desde una prueba.
     */
    estado() {
      return {
        plataforma,
        origenDelAzar,
        sinGastar: sinGastar.length,
        intentos,
        conEvidenciaDePlataforma: evidencia !== null,
        ultimoMotivo,
      };
    },
  };
}

// La atestación de la app, una sola para todo el proceso.
//
// Va aquí y no en cada punto de montaje porque una tanda es de la app entera: el
// arranque, el mapa y la preparación de la salida gastan fichas de la misma, y montar
// una por pantalla significaría atestar tres veces y tirar dos tandas. Se guarda por
// dirección de proxy —lo único que la distingue— y **no sobrevive al proceso**, que es
// lo que la separa de un identificador de instalación.
const montadas = new Map();

/**
 * La atestación de esta compilación, montada una sola vez.
 *
 * La plataforma y la evidencia entran **por la firma** y no se leen aquí: quien sabe en
 * qué sistema se está corriendo es `app/plataforma/atestacion.js`, y ese es el único
 * módulo de la app que puede mirarlo (RNF-COM-001). De paso, es lo que deja este fichero
 * ejercitable en `node --test` sin React Native delante.
 *
 * **Protesta en vez de devolver nada.** Un montaje que se queda callado cuando le falta
 * el sistema es indistinguible de una atestación que no vale, y son cosas distintas: la
 * segunda es el modo diseñado y la primera es una pieza sin cablear. Quien llama ya
 * envuelve esto en su `try`, así que la avería sale por la pantalla de cableado y no por
 * un mundo que no se genera sin decir por qué.
 */
export function atestacionDeLaApp({ pide, base, plataforma, evidencia = null }) {
  if (!PLATAFORMAS.includes(plataforma)) {
    throw new Error(`este sistema no tiene atestación declarada en el proxy: las que hay son ${PLATAFORMAS.join(', ')}`);
  }
  const llave = `${plataforma}|${base}`;
  if (!montadas.has(llave)) {
    montadas.set(llave, creaClienteDeAtestacion({ pide, base, plataforma, evidencia }));
  }
  return montadas.get(llave);
}
