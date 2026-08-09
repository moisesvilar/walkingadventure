// El plano de identidad: reto, verificación de App Attest y Play Integrity, y emisión
// de tandas de fichas anónimas. **Una sola ruta**, y no habla con el plano de contenido.
//
// El motivo de que esté partido así es el que sostiene toda la spec: la clave atestada
// de App Attest lleva un identificador estable por instalación, y verificar una aserción
// en cada llamada pondría ese identificador delante del proxy en cada llamada. Da igual
// lo que se prometa después. Aquí se ve durante el tiempo de verificar y **no se guarda**:
// el verificador devuelve si la evidencia vale, y este módulo lee de su respuesta dos
// campos y ninguno más, para que no haya forma de que el identificador se cuele en una
// escritura por descuido.
//
// Lo único que persiste es la lista de retos vivos, para que una evidencia no valga dos
// veces. Un reto es un valor aleatorio que emite el propio proxy: no se deriva de quien
// llama y no dice nada de nadie.

import { randomBytes } from 'node:crypto';

/**
 * Lo que este módulo escribe, entrada por entrada **y campo por campo**. Se compara con
 * la superficie declarada al arrancar: declarar aquí un campo que la entrada no admite
 * impide arrancar, y nombra el campo.
 *
 * `campos: []` es literal: la entrada de retos guarda el reto en la clave y **nada** en
 * el valor. Ni cuándo se emitió: ver `EPOCAS_POR_VIGENCIA`, más abajo.
 */
export const ESCRITURAS = Object.freeze([
  Object.freeze({ entrada: 'retos-vivos', campos: Object.freeze([]) }),
]);

/**
 * En cuántos tramos se parte `VIGENCIA_RETO` para rotar la época del reto.
 *
 * La caducidad va en la **clave de época**, como en las fichas, y por el mismo motivo:
 * el instante de emisión dentro de la entrada es una marca de tiempo al milisegundo en
 * una superficie que declara no admitir ninguna. Lo que sustituye al instante es un
 * identificador de época opaco y correlativo (`e1`, `e2`, …) delante de la clave, cuyo
 * instante vive en memoria y no se escribe.
 *
 * Con cuatro tramos, una época emite durante `VIGENCIA_RETO / 4` y se barre al cumplir
 * `VIGENCIA_RETO`: así un reto vive **como mucho** lo declarado —nunca más, que es lo
 * que el criterio exige— y como poco tres cuartas partes, en vez de morir en el mismo
 * instante en que se emite si le tocara el final de su época. El identificador agrupa lo
 * emitido en un tramo de setenta y cinco segundos, que es menos de lo que ya revela que
 * dos retos estén vivos a la vez.
 */
export const EPOCAS_POR_VIGENCIA = 4;

/** El esquema cerrado de la ruta de atestación. Ni un campo más. */
export const CAMPOS_DE_ATESTACION = Object.freeze(['plataforma', 'reto', 'evidencia', 'cegadas']);

/** Las dos plataformas, y ninguna más. */
export const PLATAFORMAS = Object.freeze(['app-attest', 'play-integrity']);

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {{ahora: () => number}} deps.reloj  para caducar retos, y para nada más.
 * @param {{verifica: (arg: object) => Promise<{valida: boolean, motivo?: string}>}} deps.verificador
 *   la única pieza que en producción habla con Apple y con Google. Inyectada para
 *   poder ejercitar la vía legítima, la falsificada y la ausente sin un dispositivo.
 * @param {object} deps.retos  almacén de la entrada `retos-vivos`.
 * @param {object} deps.emisor  el emisor de fichas.
 * @param {(n: number) => Buffer} [deps.aleatorio]
 */
export function creaPlanoDeAtestacion({ config, reloj, verificador, retos, emisor, aleatorio = randomBytes }) {
  // Las épocas del reto: identificador → instante en que se abrió. Vive **en memoria** y
  // no es de quien llama: es el mismo para todo lo emitido en su tramo, igual que la
  // época de la clave de firma de las fichas.
  const epocas = new Map();
  let ultimaEpoca = 0;

  const epocaDe = (clave) => String(clave).split('.')[0];

  const barre = async (ahora) => {
    for (const [id, desde] of [...epocas]) {
      if (ahora - desde >= config.VIGENCIA_RETO) epocas.delete(id);
    }
    // Los retos no llevan fecha —a propósito—, así que no se barren por antigüedad: se
    // barren los de las épocas que ya no existen, que son exactamente los caducados.
    for (const { clave } of await retos.recorre()) {
      if (!epocas.has(epocaDe(clave))) await retos.borra(clave);
    }
  };

  const epocaVigente = (ahora) => {
    for (const [id, desde] of epocas) {
      if (ahora - desde < config.VIGENCIA_RETO / EPOCAS_POR_VIGENCIA) return id;
    }
    const id = `e${++ultimaEpoca}`;
    epocas.set(id, ahora);
    return id;
  };

  /** La clave con la que está escrito un reto vivo, o `null`. Son cuatro épocas como mucho. */
  const claveViva = async (reto) => {
    for (const id of epocas.keys()) {
      const clave = `${id}.${reto}`;
      if (await retos.existe(clave)) return clave;
    }
    return null;
  };

  return {
    ESCRITURAS,

    /** La clave pública de la época, para que el cliente ciegue contra ella. */
    clavePublica() { return emisor.clavePublica(); },

    /** Emite un reto y lo deja vivo durante `VIGENCIA_RETO`. */
    async nuevoReto() {
      const ahora = reloj.ahora();
      await barre(ahora);
      const reto = Buffer.from(aleatorio(32)).toString('base64url');
      // La entrada guarda el reto y **nada más**: el valor va vacío y lo que caduca es la
      // época, que va delante en la clave. Un instante aquí sería una marca de tiempo al
      // milisegundo en una entrada declarada sin ninguna, y con un reto en vuelo bastaría
      // para situar en el tiempo la atestación de alguien.
      await retos.escribe(`${epocaVigente(ahora)}.${reto}`, {});
      return { reto, clave: emisor.clavePublica(), vigencia: config.VIGENCIA_RETO };
    },

    /**
     * Verifica la evidencia contra un reto vivo y firma los valores cegados.
     *
     * No devuelve nada que ate la tanda a la instalación, porque no lo tiene: lo que
     * sale de aquí son firmas ciegas que el cliente desciega él solo.
     */
    async emiteTanda(cuerpo) {
      const sobra = Object.keys(cuerpo ?? {}).filter((c) => !CAMPOS_DE_ATESTACION.includes(c));
      if (sobra.length) {
        return { ok: false, motivo: `campo no declarado en la ruta de atestación: ${sobra.join(', ')}` };
      }
      const { plataforma, reto, evidencia, cegadas } = cuerpo ?? {};
      if (!PLATAFORMAS.includes(plataforma)) return { ok: false, motivo: 'plataforma no declarada' };
      if (typeof reto !== 'string') return { ok: false, motivo: 'falta el reto' };

      const ahora = reloj.ahora();
      await barre(ahora);
      const claveDelReto = await claveViva(reto);
      if (!claveDelReto) return { ok: false, motivo: 'el reto no está vivo: hay que volver a atestar' };
      // El reto se consume antes de verificar: si se consumiera después, una evidencia
      // rechazada dejaría el reto en pie y valdría para reintentar sin límite.
      await retos.borra(claveDelReto);

      let veredicto;
      try {
        veredicto = await verificador.verifica({ plataforma, reto, evidencia });
      } catch {
        // El motivo del verificador no se propaga tal cual: puede traer el
        // identificador de la clave atestada, y ese dato no sale de esta función.
        return { ok: false, motivo: 'la evidencia no verifica' };
      }
      // Se leen dos campos y ninguno más. Lo que el verificador devuelva además —el
      // identificador de la clave atestada, el contador de la aserción— se queda en
      // su objeto y no viaja a ninguna escritura.
      if (!veredicto || veredicto.valida !== true) return { ok: false, motivo: 'la evidencia no verifica' };

      try {
        const { clave, firmas } = emisor.firmaCegadas(cegadas);
        return { ok: true, clave, firmas, vigencia: config.VIGENCIA_TANDA };
      } catch (e) {
        return { ok: false, motivo: e.message };
      }
    },

    /**
     * Lo que el plano de identidad guarda, para poder afirmar que no es nada más.
     * No hay contador por instalación ni ningún dato que sobreviva a la vigencia.
     */
    async loQueGuarda() {
      await barre(reloj.ahora());
      return (await retos.recorre()).map(({ entrada, clave }) => ({ entrada, clave }));
    },
  };
}
