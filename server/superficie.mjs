// La superficie de escritura: la declaración cerrada de **todo** lo que el proxy deja
// escrito en cualquier sitio, y la comprobación de arranque contra ella.
//
// Esta es la pieza que convierte «no registramos nada» en algo que se recorre y se
// puede poner en rojo, en vez de prometerse. Seis entradas, y ninguna con una clave
// derivada de quien llama. Cada módulo que escribe declara sus entradas; al arrancar
// se comparan con esta lista y **el proxy no arranca si alguien añadió una escritura
// sin declararla**, nombrándola.
//
// La segunda mitad del mecanismo es que no hay forma de escribir sin pasar por aquí:
// los almacenes se abren por entrada y una entrada desconocida lanza en el momento
// de abrirla, no en el de escribir.

/** Lo que se guarda para siempre: no hay barrido que lo caduque. */
export const INDEFINIDO = 'indefinido';

/**
 * Las seis entradas, enteras. Cada una dice de qué se deriva su clave, qué campos
 * lleva, cuánto vive y qué ventana de tiempo admite.
 *
 * `ventana: null` significa que la entrada no admite **ninguna** marca de tiempo:
 * ni en el registro ni en los metadatos del sistema de ficheros. Solo la métrica
 * tiene ventana, y es el día natural.
 */
export const SUPERFICIE = Object.freeze([
  Object.freeze({
    entrada: 'cache-imagenes',
    claveDerivadaDe: 'resumen del prompt de ficción normalizado y los parámetros de formato',
    deQuienLlama: false,
    campos: Object.freeze(['binario']),
    vive: INDEFINIDO,
    ventana: null,
  }),
  Object.freeze({
    entrada: 'cache-fotos',
    claveDerivadaDe: 'el place_id, y nada más',
    deQuienLlama: false,
    campos: Object.freeze(['binario', 'atribucion']),
    vive: INDEFINIDO,
    ventana: null,
  }),
  Object.freeze({
    entrada: 'cache-generacion',
    claveDerivadaDe: 'resumen de la consulta de celda',
    deQuienLlama: false,
    campos: Object.freeze(['respuesta']),
    vive: INDEFINIDO,
    ventana: null,
    // Apagada por defecto: encendida, el disco contiene un mapa de qué zonas se han
    // generado alguna vez. Ver server/DESPLIEGUE.md, que lo dice con esas palabras.
    apagadaPorDefecto: true,
  }),
  Object.freeze({
    entrada: 'retos-vivos',
    claveDerivadaDe: 'el valor aleatorio del propio reto, que emite el proxy',
    deQuienLlama: false,
    campos: Object.freeze([]),
    vive: 'VIGENCIA_RETO',
    ventana: null,
  }),
  Object.freeze({
    entrada: 'fichas-gastadas',
    claveDerivadaDe: 'la propia ficha',
    deQuienLlama: false,
    campos: Object.freeze([]),
    vive: 'VIGENCIA_TANDA',
    ventana: null,
  }),
  Object.freeze({
    entrada: 'metrica-del-dia',
    claveDerivadaDe: 'el día natural',
    deQuienLlama: false,
    campos: Object.freeze(['contadores', 'histogramas', 'coste']),
    vive: INDEFINIDO,
    ventana: 'dia-natural',
  }),
]);

/** Los identificadores de las seis entradas, en el orden en que están declaradas. */
export const ENTRADAS = Object.freeze(SUPERFICIE.map((e) => e.entrada));

/** Busca una entrada por su identificador. `undefined` si no está declarada. */
export function entradaDeclarada(id) {
  return SUPERFICIE.find((e) => e.entrada === id);
}

/**
 * La comprobación de arranque.
 *
 * @param {Array<{modulo: string, entradas: string[]}>} escrituras lo que cada módulo
 *   declara que escribe. La declaración la hace el módulo, no quien lo cablea: así
 *   una escritura nueva se declara donde se escribe o no arranca.
 * @throws nombrando la entrada no declarada y el módulo que la escribe.
 */
export function compruebaSuperficie(escrituras) {
  const fuera = [];
  for (const { modulo, entradas } of escrituras) {
    for (const id of entradas) {
      if (!entradaDeclarada(id)) fuera.push(`${modulo} escribe "${id}"`);
    }
  }
  if (fuera.length) {
    throw new Error(
      `el proxy no arranca: hay ${fuera.length} escritura(s) fuera de la superficie declarada → ${fuera.join('; ')}. ` +
      `Las entradas declaradas son: ${ENTRADAS.join(', ')}.`,
    );
  }
  return true;
}

/**
 * Un almacén en memoria acotado a una entrada declarada.
 *
 * Es el almacén por defecto y el que se usa en `node --test`: sin almacén inyectado
 * el proxy funciona entero en memoria. Guarda lo que se le da y **nada más**: ni
 * cuándo se escribió, ni cuántas veces se ha leído, ni quién lo pidió. Que no haya
 * contador de aciertos no es un olvido: un contador responde «cuántos han pasado por
 * aquí», que es justo lo que la caché no puede responder.
 */
export function creaAlmacenEnMemoria(entrada) {
  if (!entradaDeclarada(entrada)) {
    throw new Error(`el proxy no arranca: almacén abierto sobre la entrada no declarada "${entrada}"`);
  }
  const datos = new Map();
  return {
    entrada,
    async existe(clave) { return datos.has(clave); },
    async lee(clave) { return datos.has(clave) ? datos.get(clave) : null; },
    async escribe(clave, valor) { datos.set(clave, valor); },
    async borra(clave) { datos.delete(clave); },
    /**
     * Recorrer la superficie es una operación **de quien opera el servidor**, no una
     * ruta: el proxy no expone ningún endpoint que enumere, liste o cuente por zonas.
     */
    async recorre() {
      return [...datos.keys()].sort().map((clave) => ({ entrada, clave, valor: datos.get(clave) }));
    },
  };
}

/**
 * Recorre la superficie entera, entrada por entrada, y devuelve lo que hay escrito.
 *
 * Recién desplegado y sin una sola petición atendida devuelve una lista vacía y no
 * falla: el estado vacío es un estado, no un error.
 */
export async function recorreSuperficie(almacenes) {
  const fuera = Object.keys(almacenes).filter((id) => !entradaDeclarada(id));
  if (fuera.length) throw new Error(`entradas no declaradas en el recorrido: ${fuera.join(', ')}`);

  const salida = [];
  for (const id of ENTRADAS) {
    const almacen = almacenes[id];
    if (!almacen) continue;
    salida.push(...(await almacen.recorre()));
  }
  return salida;
}
