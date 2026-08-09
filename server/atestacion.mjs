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

/** Lo que este módulo escribe. Se compara con la superficie declarada al arrancar. */
export const ESCRITURAS = Object.freeze(['retos-vivos']);

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
  const barre = async (ahora) => {
    for (const { clave, valor } of await retos.recorre()) {
      if (ahora - valor.desde >= config.VIGENCIA_RETO) await retos.borra(clave);
    }
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
      // El instante se guarda **dentro** de la entrada de retos y no en ninguna otra:
      // es lo mínimo para caducar, vive cinco minutos y su clave es el propio reto.
      await retos.escribe(reto, { desde: ahora });
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
      const vivo = await retos.lee(reto);
      if (!vivo) return { ok: false, motivo: 'el reto no está vivo: hay que volver a atestar' };
      // El reto se consume antes de verificar: si se consumiera después, una evidencia
      // rechazada dejaría el reto en pie y valdría para reintentar sin límite.
      await retos.borra(reto);

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
