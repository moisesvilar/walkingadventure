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
 *
 * `campos` son los **nombres literales** que el valor de la entrada admite en su primer
 * nivel, no una descripción: es lo que permite que `compruebaCampos` rechace un campo de
 * más en el momento de escribirlo en lugar de que aparezca meses después recorriendo el
 * disco. Que sean literales tiene un límite declarado: se comprueba el primer nivel, así
 * que un campo colado **dentro** de otro no lo caza esto sino el validador del cliente de
 * aguas arriba que produce ese sobre.
 */
export const SUPERFICIE = Object.freeze([
  Object.freeze({
    entrada: 'cache-imagenes',
    claveDerivadaDe: 'resumen del prompt de ficción normalizado y los parámetros de formato',
    deQuienLlama: false,
    // El binario y sus dimensiones, que es lo que devuelve el cliente de imagen.
    campos: Object.freeze(['formato', 'ancho', 'alto', 'datos_base64']),
    vive: INDEFINIDO,
    ventana: null,
  }),
  Object.freeze({
    entrada: 'cache-fotos',
    claveDerivadaDe: 'el place_id, y nada más',
    deQuienLlama: false,
    // El sobre `foto` del cliente de Places: referencia, atribución y dimensiones.
    campos: Object.freeze(['foto']),
    vive: INDEFINIDO,
    ventana: null,
  }),
  Object.freeze({
    entrada: 'cache-generacion',
    claveDerivadaDe: 'resumen de la consulta de celda',
    deQuienLlama: false,
    // Los elementos de OSM tal cual, que es la respuesta entera de Overpass.
    campos: Object.freeze(['elements']),
    vive: INDEFINIDO,
    ventana: null,
    // Apagada por defecto: encendida, el disco contiene un mapa de qué zonas se han
    // generado alguna vez. Ver server/DESPLIEGUE.md, que lo dice con esas palabras.
    apagadaPorDefecto: true,
  }),
  Object.freeze({
    entrada: 'retos-vivos',
    claveDerivadaDe: 'el valor aleatorio del propio reto, que emite el proxy, precedido de su época',
    deQuienLlama: false,
    // Ninguno: el reto está entero en la clave y el valor va vacío. La caducidad va en
    // la época que precede a la clave, nunca en un instante dentro de la entrada.
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
    // Contadores agregados, volumen del día y los histogramas por tipo de lote. `dia` es
    // el día natural, que ya está en la clave: es la única resolución temporal escrita.
    // `eslabones` es el recuento de generaciones servidas por cada origen de datos
    // (SPEC-024): cuántas, nunca dónde. Es lo que hace visible que el respaldo esté
    // trabajando, que si no se nota solo en que todo va lento.
    campos: Object.freeze(['dia', 'contadores', 'peticiones', 'degradadas', 'coste', 'lotes', 'eslabones']),
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
 * Comprueba un valor contra los campos que su entrada declara. Es la mitad de la
 * comprobación que ocurre **al escribir**, y la que caza un campo de más en el momento
 * en que alguien lo añade en lugar de meses después recorriendo el disco.
 *
 * Se mira el primer nivel del valor, que es donde se cuela un campo por descuido. Un
 * valor que no es un objeto —una lista, un número— no tiene campos que comprobar.
 *
 * @throws nombrando la entrada y el campo no declarado.
 */
export function compruebaCampos(entrada, valor) {
  const declarada = entradaDeclarada(entrada);
  if (!declarada) throw new Error(`el proxy no arranca: escritura sobre la entrada no declarada "${entrada}"`);
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return true;
  const fuera = Object.keys(valor).filter((c) => !declarada.campos.includes(c));
  if (fuera.length) {
    throw new Error(
      `escritura fuera de la superficie declarada: la entrada "${entrada}" no admite el campo ` +
      `${fuera.map((c) => `"${c}"`).join(', ')}. Sus campos declarados son: ` +
      `${declarada.campos.length ? declarada.campos.join(', ') : '(ninguno)'}.`,
    );
  }
  return true;
}

/**
 * La comprobación de arranque.
 *
 * Valida **la entrada y sus campos**. Que solo mirase el nombre de la entrada es lo que
 * dejó pasar un instante en milisegundos dentro de `retos-vivos`, declarada sin ningún
 * campo: la entrada estaba en la lista, así que nada protestó. Un módulo declara qué
 * escribe y con qué campos, y declarar un campo que su entrada no admite impide arrancar
 * igual que declarar una entrada que no existe.
 *
 * @param {Array<{modulo: string, entradas: Array<string|{entrada: string, campos?: string[]}>}>} escrituras
 *   lo que cada módulo declara que escribe. La declaración la hace el módulo, no quien lo
 *   cablea: así una escritura nueva se declara donde se escribe o no arranca. Un elemento
 *   en texto es una entrada sin campos propios que declarar —el caso de un almacén
 *   inyectado, que no decide qué se guarda dentro—.
 * @throws nombrando el módulo, la entrada y, si es el caso, el campo no declarado.
 */
export function compruebaSuperficie(escrituras) {
  const fuera = [];
  for (const { modulo, entradas } of escrituras) {
    for (const declarada of entradas) {
      const id = typeof declarada === 'string' ? declarada : declarada.entrada;
      const entrada = entradaDeclarada(id);
      if (!entrada) {
        fuera.push(`${modulo} escribe "${id}"`);
        continue;
      }
      const campos = typeof declarada === 'string' ? [] : (declarada.campos ?? []);
      for (const campo of campos) {
        if (!entrada.campos.includes(campo)) {
          fuera.push(`${modulo} escribe el campo "${campo}" en la entrada "${id}", que no lo declara`);
        }
      }
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
 *
 * Y guarda menos de lo que se le da si se le da de más: escribir un campo que la entrada
 * no declara lanza aquí, en el momento de la escritura.
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
    async escribe(clave, valor) { compruebaCampos(entrada, valor); datos.set(clave, valor); },
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
