// La caché de lo inerte: derivación de claves **desde el contenido**, escritura con la
// marca de tiempo normalizada y coalescencia de peticiones iguales.
//
// Dos reglas que parecen detalles y son la mitad de la promesa:
//
// 1. **La clave la deriva el proxy, nunca el cliente.** Una clave elegida por quien
//    llama permite envenenar la caché y, peor para lo que aquí importa, permite meter
//    en la clave lo que a uno le apetezca —que es justo lo que la superficie de
//    escritura declarada intenta impedir—.
// 2. **La entrada no lleva cuándo, ni dentro ni fuera.** Sin normalizar la marca del
//    sistema de ficheros, «no registramos cuándo» es falso y lo desmiente un `ls -l`.
//    Es la diferencia entre un oráculo de un bit y un registro con fecha.
//
// Y lo que no hay, dicho a propósito: no hay contador de aciertos, no hay entradas
// negativas y no hay ninguna función que enumere desde una ruta. Recorrer la caché es
// una operación de quien opera el servidor, no un endpoint.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, writeFileSync, unlinkSync, utimesSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Lo que este módulo escribe. Se compara con la superficie declarada al arrancar. */
export const ESCRITURAS = Object.freeze(['cache-imagenes', 'cache-fotos', 'cache-generacion']);

/**
 * Normaliza un prompt de ficción antes de resumirlo: espacios colapsados y extremos
 * recortados, sin tocar mayúsculas ni acentos. Se normaliza poco a propósito — dos
 * prompts que difieren en una palabra son dos imágenes distintas.
 */
export function normalizaPrompt(prompt) {
  return String(prompt).replace(/\s+/g, ' ').trim();
}

/** Serialización estable: sin ella, el orden de las claves cambiaría la clave de caché. */
function estable(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor) ?? 'null';
  if (Array.isArray(valor)) return `[${valor.map(estable).join(',')}]`;
  return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${estable(valor[k])}`).join(',')}}`;
}

const resumen = (texto) => createHash('sha256').update(texto).digest('hex');

/** Del resumen del prompt normalizado y de los parámetros de formato. De nada más. */
export function claveDeImagen({ prompt, formato }) {
  return resumen(`imagen ${normalizaPrompt(prompt)} ${estable(formato ?? {})}`);
}

/** El `place_id`, y nada más. Va literal porque es exactamente lo que la spec declara. */
export function claveDeFoto({ place_id }) {
  return String(place_id);
}

/** Del resumen de la consulta de celda. */
export function claveDeGeneracion({ consulta }) {
  return resumen(`generacion ${estable(consulta)}`);
}

/**
 * El texto **no se cachea**, y aun así tiene clave derivada: es lo que hace que dos
 * peticiones idénticas simultáneas se coalescan en una sola llamada de pago. La clave
 * vive en memoria mientras la petición está en vuelo y no llega a ningún almacén.
 */
export function claveDeTexto({ prompt, idioma, tono }) {
  return resumen(`texto ${normalizaPrompt(prompt)} ${estable({ idioma, tono })}`);
}

/**
 * Un almacén en disco con la marca de tiempo normalizada.
 *
 * Limitación que se declara en lugar de disimularse: `utimes` fija acceso y
 * modificación, que es lo que responde un `ls -l`, pero el cambio de inodo (`ctime`)
 * no se puede fijar desde el espacio de usuario en POSIX. Quien despliegue esto sobre
 * un sistema de ficheros que lo exponga tiene ahí un «cuándo» que el proxy no puede
 * borrar; está escrito en server/DESPLIEGUE.md.
 */
export function creaAlmacenEnDisco({ entrada, raiz, config }) {
  mkdirSync(raiz, { recursive: true });
  const segundos = config.MTIME_CONSTANTE / 1000;
  const fichero = (clave) => join(raiz, `${Buffer.from(String(clave)).toString('base64url')}.json`);
  const normaliza = (ruta) => { try { utimesSync(ruta, segundos, segundos); } catch { /* el sistema de ficheros no lo permite */ } };

  return {
    entrada,
    async existe(clave) { return existsSync(fichero(clave)); },
    async lee(clave) {
      const f = fichero(clave);
      if (!existsSync(f)) return null;
      return JSON.parse(readFileSync(f, 'utf8'));
    },
    async escribe(clave, valor) {
      const f = fichero(clave);
      writeFileSync(f, JSON.stringify(valor));
      normaliza(f);
      // También el directorio: su mtime cambia con cada entrada nueva y delataría
      // cuándo se escribió la última.
      normaliza(raiz);
    },
    async borra(clave) {
      const f = fichero(clave);
      if (existsSync(f)) { unlinkSync(f); normaliza(raiz); }
    },
    async recorre() {
      return readdirSync(raiz).sort().map((nombre) => ({
        entrada,
        clave: Buffer.from(nombre.replace(/\.json$/, ''), 'base64url').toString('utf8'),
        valor: JSON.parse(readFileSync(join(raiz, nombre), 'utf8')),
      }));
    },
  };
}

/**
 * La caché sobre un almacén ya abierto en una entrada declarada.
 *
 * `sirveOPide` es la coalescencia: dos peticiones simultáneas del mismo prompt sin
 * acierto de caché hacen **una sola** llamada de pago y reciben las dos el mismo
 * contenido. Vive en memoria y muere con la petición, así que no añade nada a la
 * superficie de escritura.
 */
export function creaCache({ almacen = null, activa = true }) {
  const enVuelo = new Map();
  const encendida = activa && Boolean(almacen);

  return {
    // Sin almacén no hay entrada: es el caso del texto, que no se cachea y que aun así
    // pasa por aquí para heredar la coalescencia, que vive en memoria y no escribe.
    entrada: almacen ? almacen.entrada : null,
    activa: encendida,

    async lee(clave) {
      if (!encendida) return null;
      return almacen.lee(clave);
    },

    async escribe(clave, valor) {
      // Con la caché apagada no se escribe nada: es lo que hace que la caché de
      // generación por defecto no deje ni una entrada en el disco.
      if (!encendida) return;
      await almacen.escribe(clave, valor);
    },

    /**
     * @param {string} clave
     * @param {() => Promise<any|null>} produce  la llamada de pago. Si devuelve `null`
     *   —aguas arriba caído, respuesta que no encaja, plazo agotado— **no se escribe
     *   nada**: no hay entradas negativas que se puedan enumerar.
     */
    async sirveOPide(clave, produce) {
      const cacheado = await this.lee(clave);
      if (cacheado !== null && cacheado !== undefined) return { contenido: cacheado, deCache: true };

      if (enVuelo.has(clave)) return { contenido: await enVuelo.get(clave), deCache: true, coalescida: true };

      const promesa = (async () => {
        const contenido = await produce();
        if (contenido !== null && contenido !== undefined) await this.escribe(clave, contenido);
        return contenido ?? null;
      })();
      enVuelo.set(clave, promesa);
      try {
        return { contenido: await promesa, deCache: false };
      } finally {
        enVuelo.delete(clave);
      }
    },
  };
}
