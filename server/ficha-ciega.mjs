// La primitiva de la ficha ciega, **entera y sin importar nada**: cegar, firmar sin
// ver, desciegar. La usan las dos mitades —el proxy en Node y la app en Hermes— y por
// eso este fichero no importa `node:crypto`, no usa `Buffer` y no toca ningún global.
//
// Existe por una frase de `server/fichas.mjs` que era verdad y no se podía cumplir: «si
// el cegado y el descegado se escriben dos veces, el día que uno cambie el otro deja de
// verificar y no hay nada que lo ponga en rojo». La app no puede importar `fichas.mjs`
// —ese módulo abre con `node:crypto` y el empaquetador del móvil no lo resuelve—, así
// que la alternativa real era una copia declarada, como la de `consulta-osm.js`. Aquí
// no vale: una copia de `consultaDeCelda` que diverge cuesta una caché fría, y una copia
// del cegado que diverge cuesta que ninguna ficha del mundo verifique. Se parte el
// módulo en vez de copiarlo.
//
// El precio es un SHA-256 escrito a mano en lugar del del sistema. Es el precio exacto
// de que las dos mitades compartan la primitiva, y se paga sobre 32 bytes por ficha.
//
// Y una salvedad que hay que leer entera: el móvil **no importa este fichero**, porque
// `app/` no puede alcanzar por ruta relativa nada que esté fuera de su directorio. Lo que
// hay en `app/datos/ficha-ciega.js` es la copia declarada de todo lo que sigue, idéntica
// desde la línea del SHA-256. Se tocan las dos o no se toca ninguna, y la versión sube en
// las dos a la vez.

/** La versión de la primitiva. Su pareja es la de `app/datos/ficha-ciega.js`. */
export const VERSION_FICHA_CIEGA = '1';

// --- SHA-256 -----------------------------------------------------------------
//
// Escrito aquí porque es lo único de la primitiva que en Node viene de serie y en
// Hermes no existe. No es criptografía nueva: es FIPS 180-4 tal cual, y lo que lo
// mantiene honesto es que el proxy verifica con esta misma función lo que la app cegó
// con ella.

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const gira = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;

/** SHA-256 de una secuencia de bytes. @param {Uint8Array} mensaje @returns {Uint8Array} */
export function sha256(mensaje) {
  const h = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const largo = mensaje.length;
  const conRelleno = new Uint8Array((((largo + 8) >> 6) + 1) << 6);
  conRelleno.set(mensaje);
  conRelleno[largo] = 0x80;
  const bits = largo * 8;
  // El largo va en 64 bits big-endian. Los 32 altos se escriben con aritmética de
  // punto flotante porque un desplazamiento de JavaScript trunca a 32 bits y un
  // mensaje de más de 512 MB —que aquí no llega, pero la función es general— se
  // resumiría mal en silencio.
  const vista = new DataView(conRelleno.buffer);
  vista.setUint32(conRelleno.length - 8, Math.floor(bits / 0x100000000), false);
  vista.setUint32(conRelleno.length - 4, bits >>> 0, false);

  const w = new Uint32Array(64);
  for (let bloque = 0; bloque < conRelleno.length; bloque += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloque + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = (gira(w[i - 15], 7) ^ gira(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (gira(w[i - 2], 17) ^ gira(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = (gira(e, 6) ^ gira(e, 11) ^ gira(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (gira(a, 2) ^ gira(a, 13) ^ gira(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const salida = new Uint8Array(32);
  const escribe = new DataView(salida.buffer);
  for (let i = 0; i < 8; i++) escribe.setUint32(i * 4, h[i], false);
  return salida;
}

// --- bytes, hexadecimal y base64url ------------------------------------------
//
// Las mismas conversiones que hacía `Buffer`, byte a byte. Que sean idénticas no es
// cosmético: el `nonce` viaja en base64url y el proxy lo vuelve a leer para recomponer
// el resumen de dominio, así que un alfabeto distinto sería una ficha que no verifica.

const HEX = '0123456789abcdef';
const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Bytes → hexadecimal en minúsculas, sin prefijo. */
export function aHexBytes(bytes) {
  let s = '';
  for (const b of bytes) s += HEX[b >> 4] + HEX[b & 15];
  return s;
}

/** Un `BigInt` no negativo → hexadecimal con un número par de dígitos. */
export const aHex = (n) => { const h = n.toString(16); return h.length % 2 ? '0' + h : h; };

/** Hexadecimal → `BigInt`. */
export const aBigInt = (hex) => BigInt('0x' + hex);

/** Bytes → base64url sin relleno, que es lo que devolvía `Buffer.toString('base64url')`. */
export function aBase64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    s += B64U[a >> 2] + B64U[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) s += B64U[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) s += B64U[c & 63];
  }
  return s;
}

/** base64url → bytes. Admite el relleno con `=` aunque nadie lo escriba. */
export function deBase64url(texto) {
  const limpio = String(texto).replace(/=+$/, '');
  const salida = new Uint8Array(Math.floor((limpio.length * 6) / 8));
  let acumulado = 0;
  let bits = 0;
  let n = 0;
  for (const caracter of limpio) {
    const valor = B64U.indexOf(caracter);
    if (valor < 0) throw new Error('el valor no está en base64url');
    acumulado = (acumulado << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      salida[n++] = (acumulado >> bits) & 0xff;
    }
  }
  return salida.subarray(0, n);
}

/** Concatena secuencias de bytes. */
export function concatenaBytes(trozos) {
  let total = 0;
  for (const t of trozos) total += t.length;
  const salida = new Uint8Array(total);
  let n = 0;
  for (const t of trozos) { salida.set(t, n); n += t.length; }
  return salida;
}

/** Los bytes de un texto ASCII. Los dos rótulos de dominio de este módulo lo son. */
export function bytesDeAscii(texto) {
  const salida = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) salida[i] = texto.charCodeAt(i) & 0x7f;
  return salida;
}

// --- aritmética modular -------------------------------------------------------

export function modPow(base, exp, mod) {
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

export function inversoModular(a, m) {
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

/**
 * Los inversos de una lista entera con **una sola** ejecución del algoritmo extendido.
 *
 * Es el truco de Montgomery: se acumulan los productos parciales, se invierte el
 * producto total una vez y se van despejando hacia atrás con tres multiplicaciones por
 * elemento. No es una optimización de manual: sin él, cegar una tanda en el móvil cuesta
 * **decenas de segundos** —el algoritmo extendido son un par de miles de divisiones de
 * dos mil bits, y en Hermes eso se nota—, y esa espera cae dentro del minuto de
 * RNF-PER-001 porque el arranque no puede levantar el mapa sin la primera ficha. Medido:
 * de treinta y tantos segundos a menos de dos.
 *
 * Devuelve `null` si el producto no es invertible, que es cuando alguno de los valores
 * comparte factor con el módulo. Quien llama vuelve a sortear.
 */
export function inversosEnLote(valores, m) {
  const prefijos = [1n];
  for (const v of valores) prefijos.push((prefijos[prefijos.length - 1] * v) % m);
  let acumulado = inversoModular(prefijos[prefijos.length - 1], m);
  if (acumulado === null) return null;
  const inversos = new Array(valores.length);
  for (let i = valores.length - 1; i >= 0; i--) {
    inversos[i] = (acumulado * prefijos[i]) % m;
    acumulado = (acumulado * valores[i]) % m;
  }
  return inversos;
}

const ETIQUETA_FDH = bytesDeAscii('walking-adventure/fdh');

/**
 * Resumen de dominio completo: expande SHA-256 con MGF1 hasta un byte menos que el
 * módulo y lo reduce. Sin esto, firmar «el hash a secas» deja el esquema abierto a
 * falsificaciones multiplicativas, que es el fallo clásico de RSA sin relleno.
 */
export function resumenDeDominio(semilla, n) {
  const bytes = Math.ceil(n.toString(16).length / 2) - 1;
  const trozos = [];
  let acumulados = 0;
  for (let i = 0; acumulados < bytes; i++) {
    const contador = new Uint8Array(4);
    new DataView(contador.buffer).setUint32(0, i, false);
    const trozo = sha256(concatenaBytes([ETIQUETA_FDH, semilla, contador]));
    trozos.push(trozo);
    acumulados += trozo.length;
  }
  return aBigInt(aHexBytes(concatenaBytes(trozos).subarray(0, bytes))) % n;
}

// --- la mitad del cliente -----------------------------------------------------
//
// La app la llama; el proxy no la llama nunca. Está aquí, y no en `app/`, porque las
// dos mitades tienen que compartir la primitiva.

/**
 * Prepara una tanda: sortea los valores de las fichas y los ciega.
 *
 * @param {{kid: string, n: string, e: string}} clavePublica  la de la época, tal y como
 *   la devuelve la ruta de atestación.
 * @param {number} cuantas
 * @param {(n: number) => Uint8Array} aleatorio  el origen de azar, **inyectado y sin
 *   valor por defecto**: el cegador es lo único que impide al servidor reconocer la
 *   ficha que firmó, y un respaldo silencioso a lo que haya en el motor convertiría la
 *   no enlazabilidad en una suposición. Quien no tenga uno bueno, que no atiesta.
 * @returns {{cegadas: string[], secretos: object[]}} lo cegado se manda al proxy; los
 *   secretos no salen del móvil.
 */
export function preparaTanda(clavePublica, cuantas, aleatorio) {
  if (typeof aleatorio !== 'function') {
    throw new Error('preparaTanda necesita el origen de azar inyectado: aleatorio(n) → bytes');
  }
  const n = aBigInt(clavePublica.n);
  const e = aBigInt(clavePublica.e);
  const octetos = Math.ceil(n.toString(16).length / 2);

  // Se sortea la tanda entera primero y se invierte de una vez: los inversos son con
  // diferencia lo más caro de todo esto, y en lote cuestan uno.
  const nonces = [];
  const emes = [];
  const erres = [];
  for (let i = 0; i < cuantas; i++) {
    const nonce = Uint8Array.from(aleatorio(32));
    nonces.push(nonce);
    emes.push(resumenDeDominio(nonce, n));
    let r = 0n;
    while (r < 2n) r = aBigInt(aHexBytes(Uint8Array.from(aleatorio(octetos)))) % n;
    erres.push(r);
  }

  let inversos = inversosEnLote(erres, n);
  if (inversos === null) {
    // El producto no era invertible: alguno de los cegadores comparte factor con el
    // módulo, que es tanto como haber encontrado la factorización por accidente. Se
    // resuelve uno a uno y se resortea el que falle, en vez de tirar la tanda entera.
    inversos = [];
    for (let i = 0; i < erres.length; i++) {
      let inverso = inversoModular(erres[i], n);
      while (inverso === null) {
        let r = 0n;
        while (r < 2n) r = aBigInt(aHexBytes(Uint8Array.from(aleatorio(octetos)))) % n;
        erres[i] = r;
        inverso = inversoModular(r, n);
      }
      inversos.push(inverso);
    }
  }

  const cegadas = [];
  const secretos = [];
  for (let i = 0; i < cuantas; i++) {
    cegadas.push(aHex((emes[i] * modPow(erres[i], e, n)) % n));
    secretos.push({ nonce: aBase64url(nonces[i]), inverso: aHex(inversos[i]), kid: clavePublica.kid });
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
