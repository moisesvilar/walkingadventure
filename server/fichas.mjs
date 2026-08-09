// Las fichas anónimas: emisión, gasto, caducidad y —lo que las hace fichas y no
// identificadores con otro nombre— la **no enlazabilidad**.
//
// Dos fichas de la misma tanda no pueden mostrar que salieron de la misma tanda, y
// ninguna puede señalar la atestación que la produjo. La forma conocida de conseguirlo
// es una firma ciega: el cliente presenta valores cegados, el servidor los firma sin
// verlos, y el cliente los desciega. Es el mecanismo de Privacy Pass, y aquí va sobre
// RSA con BigInt para no meter ninguna dependencia de runtime en un repo que se
// sostiene sobre que la suite arranca sin instalar nada.
//
// La caducidad va en la **clave**, no en la ficha. Una fecha dentro de la ficha sería
// igual para todas las de una tanda y las volvería a enlazar entre sí; una clave por
// época hace que el conjunto de anonimato sea todo lo emitido en esa época, que es
// mucho más grande que una tanda. Como contrapartida, una ficha vive entre una y dos
// veces `VIGENCIA_TANDA` según cuándo se emitió dentro de la época.
//
// El servidor guarda **una sola cosa**: el resumen de las fichas ya gastadas, para que
// no valgan dos veces. No guarda a quién se emitieron, porque no lo sabe.

import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';

/**
 * Lo que este módulo escribe, entrada por entrada **y campo por campo**. Se compara con
 * la superficie declarada al arrancar. `campos: []` es literal: una ficha gastada está
 * entera en la clave y su valor va vacío.
 */
export const ESCRITURAS = Object.freeze([
  Object.freeze({ entrada: 'fichas-gastadas', campos: Object.freeze([]) }),
]);

/** Los motivos por los que una ficha se rechaza. Cerrado: no hay un «otros». */
export const MOTIVOS_DE_RECHAZO = Object.freeze(['ausente', 'malformada', 'caducada', 'falsificada', 'gastada']);

// --- aritmética modular -----------------------------------------------------

function modPow(base, exp, mod) {
  let r = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return r;
}

function inversoModular(a, m) {
  let [viejoR, r] = [((a % m) + m) % m, m];
  let [viejoS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = viejoR / r;
    [viejoR, r] = [r, viejoR - q * r];
    [viejoS, s] = [s, viejoS - q * s];
  }
  if (viejoR !== 1n) return null; // no invertible: hay que sortear otro cegador
  return ((viejoS % m) + m) % m;
}

const aBigInt = (hex) => BigInt('0x' + hex);
const aHex = (n) => { const h = n.toString(16); return h.length % 2 ? '0' + h : h; };
const b64uABuf = (s) => Buffer.from(s, 'base64url');

/**
 * Resumen de dominio completo: expande SHA-256 con MGF1 hasta un byte menos que el
 * módulo y lo reduce. Sin esto, firmar «el hash a secas» deja el esquema abierto a
 * falsificaciones multiplicativas, que es el fallo clásico de RSA sin relleno.
 */
function resumenDeDominio(semilla, n) {
  const bytes = Math.ceil(n.toString(16).length / 2) - 1;
  const trozos = [];
  for (let i = 0; trozos.reduce((s, t) => s + t.length, 0) < bytes; i++) {
    const contador = Buffer.alloc(4);
    contador.writeUInt32BE(i, 0);
    trozos.push(createHash('sha256').update(Buffer.concat([Buffer.from('walking-adventure/fdh'), semilla, contador])).digest());
  }
  return aBigInt(Buffer.concat(trozos).subarray(0, bytes).toString('hex')) % n;
}

// --- la clave de época ------------------------------------------------------

/** Genera una clave RSA nueva y la deja en la forma que este módulo usa. */
export function generaClaveRSA(bits = 2048) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: bits });
  const jwk = privateKey.export({ format: 'jwk' });
  return {
    n: aBigInt(b64uABuf(jwk.n).toString('hex')),
    e: aBigInt(b64uABuf(jwk.e).toString('hex')),
    d: aBigInt(b64uABuf(jwk.d).toString('hex')),
  };
}

// --- la mitad del cliente ---------------------------------------------------
//
// Vive aquí y no en `app/` porque las dos mitades tienen que compartir la primitiva:
// si el cegado y el descegado se escriben dos veces, el día que uno cambie el otro
// deja de verificar y no hay nada que lo ponga en rojo. La app la importa; el proxy
// no la llama nunca.

/**
 * Prepara una tanda: sortea los valores de las fichas y los ciega.
 *
 * @returns {{cegadas: string[], secretos: object[]}} lo cegado se manda al proxy; los
 *   secretos no salen del móvil.
 */
export function preparaTanda(clavePublica, cuantas, aleatorio = randomBytes) {
  const n = aBigInt(clavePublica.n);
  const e = aBigInt(clavePublica.e);
  const cegadas = [];
  const secretos = [];
  for (let i = 0; i < cuantas; i++) {
    const nonce = Buffer.from(aleatorio(32));
    const m = resumenDeDominio(nonce, n);
    let r;
    let inverso = null;
    while (inverso === null) {
      r = aBigInt(Buffer.from(aleatorio(Math.ceil(n.toString(16).length / 2))).toString('hex')) % n;
      if (r < 2n) continue;
      inverso = inversoModular(r, n);
    }
    cegadas.push(aHex((m * modPow(r, e, n)) % n));
    secretos.push({ nonce: nonce.toString('base64url'), inverso: aHex(inverso), kid: clavePublica.kid });
  }
  return { cegadas, secretos };
}

/** Desciega las firmas que devolvió el proxy y produce las fichas usables. */
export function desciegaTanda(clavePublica, secretos, firmas) {
  const n = aBigInt(clavePublica.n);
  if (secretos.length !== firmas.length) {
    throw new Error(`llegaron ${firmas.length} firmas para ${secretos.length} valores cegados`);
  }
  return secretos.map((s, i) => ({
    kid: s.kid,
    nonce: s.nonce,
    firma: aHex((aBigInt(firmas[i]) * aBigInt(s.inverso)) % n),
  }));
}

// --- el emisor --------------------------------------------------------------

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {{ahora: () => number}} deps.reloj  solo para caducar; nunca entra en una ficha.
 * @param {object} deps.gastadas  almacén de la entrada `fichas-gastadas`.
 * @param {() => object} [deps.generaClave]  inyectable para que las pruebas no paguen
 *   la generación de una RSA de 2048 bits en cada caso.
 */
export function creaEmisorDeFichas({ config, reloj, gastadas, generaClave = () => generaClaveRSA(2048) }) {
  // Las claves de época, ordenadas de la más nueva a la más vieja. Una clave emite
  // durante VIGENCIA_TANDA y verifica durante el doble: así una ficha emitida el
  // último minuto de su época sigue valiendo los siete días que la spec promete.
  const claves = new Map();
  let ultimoKid = 0;

  const caduca = (ahora) => {
    for (const [kid, c] of [...claves]) {
      if (ahora - c.desde >= 2 * config.VIGENCIA_TANDA) claves.delete(kid);
    }
  };

  const vigente = (ahora) => {
    caduca(ahora);
    for (const c of claves.values()) {
      if (ahora - c.desde < config.VIGENCIA_TANDA) return c;
    }
    const kid = `k${++ultimoKid}`;
    const c = { kid, desde: ahora, ...generaClave() };
    claves.set(kid, c);
    return c;
  };

  const publica = (c) => Object.freeze({ kid: c.kid, n: aHex(c.n), e: aHex(c.e) });

  // El resumen con el que una ficha se marca gastada: la ficha entera, y nada más.
  //
  // La clave lleva delante el identificador de la época **para poder barrerla sin
  // guardar cuándo se escribió**. El identificador de época no es de quien llama: es
  // el mismo para todo lo emitido en esos siete días, y es justamente lo que hace que
  // esta entrada caduque de verdad en lugar de crecer para siempre.
  const huella = (ficha) =>
    `${ficha.kid}.` + createHash('sha256').update(`${ficha.kid}.${ficha.nonce}.${ficha.firma}`).digest('base64url');

  return {
    ESCRITURAS,

    /** La clave pública de la época en curso, para que el cliente ciegue contra ella. */
    clavePublica() { return publica(vigente(reloj.ahora())); },

    /**
     * Firma los valores cegados sin verlos. Es literalmente todo lo que el proxy hace
     * con una tanda: no sabe qué fichas salen de aquí y no puede reconocerlas después.
     */
    firmaCegadas(cegadas) {
      if (!Array.isArray(cegadas) || cegadas.length === 0) throw new Error('la tanda llega sin valores cegados');
      if (cegadas.length > config.FICHAS_POR_TANDA) {
        throw new Error(`la tanda pide ${cegadas.length} fichas y el tope es ${config.FICHAS_POR_TANDA}`);
      }
      const c = vigente(reloj.ahora());
      for (const v of cegadas) {
        if (typeof v !== 'string' || !/^[0-9a-f]+$/.test(v)) throw new Error('un valor cegado no es un entero en hexadecimal');
      }
      return { clave: publica(c), firmas: cegadas.map((v) => aHex(modPow(aBigInt(v) % c.n, c.d, c.n))) };
    },

    /**
     * Verifica una ficha **sin gastarla**. Se usa antes de mirar la caché: un acierto
     * de caché no cuesta nada, así que gastar la ficha para servirlo sería cobrar por
     * lo que ya está pagado.
     */
    comprueba(ficha) {
      if (!ficha) return { valida: false, motivo: 'ausente' };
      if (typeof ficha.kid !== 'string' || typeof ficha.nonce !== 'string' || typeof ficha.firma !== 'string') {
        return { valida: false, motivo: 'malformada' };
      }
      caduca(reloj.ahora());
      const c = claves.get(ficha.kid);
      if (!c) return { valida: false, motivo: 'caducada' };
      let s;
      try { s = aBigInt(ficha.firma); } catch { return { valida: false, motivo: 'malformada' }; }
      const m = resumenDeDominio(b64uABuf(ficha.nonce), c.n);
      if (modPow(s % c.n, c.e, c.n) !== m) return { valida: false, motivo: 'falsificada' };
      return { valida: true, motivo: null };
    },

    /** Verifica y gasta. Una ficha ya gastada se rechaza. */
    async gasta(ficha) {
      const previa = this.comprueba(ficha);
      if (!previa.valida) return previa;
      const clave = huella(ficha);
      if (await gastadas.existe(clave)) return { valida: false, motivo: 'gastada' };
      // Lo único que se escribe: la propia ficha, resumida. Sin cuándo y sin quién.
      await gastadas.escribe(clave, {});
      return { valida: true, motivo: null };
    },

    /**
     * Barre las fichas gastadas que ya no pueden reaparecer. Sin barrido, la entrada
     * crecería para siempre y sería un registro por petición con otro nombre.
     */
    async barre() {
      caduca(reloj.ahora());
      // Las fichas gastadas no llevan fecha —a propósito—, así que no se barren por
      // antigüedad: se barren las de las épocas cuya clave ya no existe, que son
      // exactamente las que ninguna ficha del mundo puede volver a presentar.
      for (const { clave } of await gastadas.recorre()) {
        if (!claves.has(String(clave).split('.')[0])) await gastadas.borra(clave);
      }
    },
  };
}
