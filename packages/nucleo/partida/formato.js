// El formato de los documentos de la partida: la versión, el esquema cerrado de
// cada documento, la validación estructural y la escritura canónica. Es lo que hace
// afirmable «byte a byte»: el texto no sale de recorrer un objeto, sale de recorrer
// el esquema, así que dos documentos con el mismo contenido son el mismo texto
// aunque se hayan construido en otro orden.

/**
 * La versión del formato. **Entero desde 1 y de aquí sale la de todos los
 * documentos**: con dos constantes, un documento escrito por una mitad del código
 * y leído por la otra dejaría de ser comprobable.
 *
 * Migrar de una versión a otra es de la fila 39 y no está aquí a propósito: lo que
 * esta entrega garantiza es que el campo existe desde el primer documento, porque
 * un documento escrito sin versión ya no se puede migrar nunca.
 */
export const VERSION_FORMATO = 1;

/**
 * Con qué versión del generador se escribió un documento. No decide nada hoy:
 * existe porque la reconstrucción de emergencia de `partida-guardada.md` §2 tiene
 * que poder avisar de que el resultado puede diferir, y sin este dato el aviso no
 * se puede fundamentar.
 */
export const VERSION_GENERADOR = '0.1.0';

/**
 * Las clases de documento de la partida.
 *
 * Las dos primeras son el mundo congelado de SPEC-009. **El estado y el registro son
 * dos más de esta misma familia y no una familia nueva**: comparten la constante de
 * versión, el lenguaje de esquemas y la escritura canónica. Dos cadenas de versión
 * sobre ficheros que se guardan y se exportan juntos es la primera puerta por la que
 * entra una migración a medias (SPEC-016).
 */
export const CLASES = Object.freeze({
  INDICE: 'indice-de-mapa',
  CELDA: 'celda',
  ESTADO: 'estado-de-partida',
  REGISTRO: 'registro-de-hechos',
  // El arranque a medio contestar (SPEC-027). Es un documento de esta misma familia y
  // no un fichero aparte por lo mismo que los otros: comparte la constante de versión
  // y la escritura canónica. Existe **antes** de que haya partida —esa es toda su
  // razón de ser: sin él, cerrar la app durante la generación obligaría a repetir el
  // onboarding entero— y desaparece en cuanto la partida se crea.
  ARRANQUE: 'arranque-en-curso',
});

// --- El lenguaje del esquema ------------------------------------------------
//
// Cinco formas y nada más. Son pocas a propósito: un esquema que puede describir
// cualquier cosa no rechaza nada, y el sentido de este es rechazar.

/** Lista homogénea. */
export const lista = (de) => ({ forma: 'lista', de });
/** Tupla de longitud y tipos fijos. Es lo que hace baratas las coordenadas. */
export const tupla = (tipos) => ({ forma: 'tupla', tipos });
/** Objeto **cerrado**: ni un campo de más, ni uno de menos, y en el orden declarado. */
export const campos = (mapa) => ({ forma: 'campos', mapa });
/** Diccionario de claves libres y valores del mismo tipo; se escribe con las claves ordenadas. */
export const dic = (de) => ({ forma: 'dic', de });
/** Unión por forma: gana la primera alternativa que valide. */
export const uno = (alternativas) => ({ forma: 'uno', alternativas });

const PRIMITIVOS = ['entero', 'numero', 'texto', 'booleano', 'nulo'];

function admiteNulo(tipo) {
  return typeof tipo === 'string' && tipo.endsWith('?');
}

function sinInterrogante(tipo) {
  return tipo.slice(0, -1);
}

// --- Escritura canónica -----------------------------------------------------

/**
 * Un número tal como lo escribe JSON, que ya produce la representación más corta
 * que vuelve al mismo valor. **Nada se redondea al volcar**: redondear aquí
 * rompería el ida y vuelta exacto, que es el criterio central de esta capa.
 *
 * El cero negativo es la excepción que hay que escribir a mano: `JSON.stringify(-0)`
 * devuelve `"0"` y perdería el signo en silencio, y `-0` y `0` no son el mismo
 * valor para una comparación estricta.
 */
function numeroCanonico(n) {
  if (Object.is(n, -0)) return '-0';
  return JSON.stringify(n);
}

function falla(ruta, mensaje) {
  throw new Error(`${ruta}: ${mensaje}`);
}

function describeValor(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity || v === -Infinity) return String(v);
  if (v instanceof Map) return `un Map de ${v.size} entradas`;
  if (v instanceof Set) return `un Set de ${v.size} elementos`;
  if (ArrayBuffer.isView(v)) return `un ${v.constructor.name}`;
  if (typeof v === 'function') return 'una función';
  if (Array.isArray(v)) return `una lista de ${v.length}`;
  if (typeof v === 'object') return `un objeto {${Object.keys(v).join(', ')}}`;
  return `un ${typeof v} (${String(v)})`;
}

/**
 * Escribe un valor contra su esquema y devuelve el texto JSON canónico.
 *
 * Validar y escribir son **la misma pasada** y no dos: con dos, un documento podría
 * escribirse y no validarse, que es exactamente por donde se cuela un campo que
 * nadie declaró.
 */
export function escribe(valor, esquema, ruta = 'documento') {
  if (typeof esquema === 'string') {
    if (admiteNulo(esquema)) {
      if (valor === null) return 'null';
      return escribe(valor, sinInterrogante(esquema), ruta);
    }
    if (!PRIMITIVOS.includes(esquema)) falla(ruta, `tipo de esquema desconocido "${esquema}"`);
    if (esquema === 'nulo') {
      if (valor !== null) falla(ruta, `se esperaba null y llegó ${describeValor(valor)}`);
      return 'null';
    }
    if (valor === null || valor === undefined) falla(ruta, `se esperaba un ${esquema} y llegó ${describeValor(valor)}`);
    if (esquema === 'entero') {
      if (!Number.isInteger(valor)) falla(ruta, `se esperaba un entero y llegó ${describeValor(valor)}`);
      return numeroCanonico(valor);
    }
    if (esquema === 'numero') {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        falla(ruta, `se esperaba un número que JSON sepa escribir y llegó ${describeValor(valor)}`);
      }
      return numeroCanonico(valor);
    }
    if (esquema === 'texto') {
      if (typeof valor !== 'string') falla(ruta, `se esperaba un texto y llegó ${describeValor(valor)}`);
      return JSON.stringify(valor);
    }
    if (typeof valor !== 'boolean') falla(ruta, `se esperaba un booleano y llegó ${describeValor(valor)}`);
    return valor ? 'true' : 'false';
  }

  if (esquema.forma === 'lista') {
    if (!Array.isArray(valor)) falla(ruta, `se esperaba una lista y llegó ${describeValor(valor)}`);
    exigeArrayLimpio(valor, ruta);
    const partes = valor.map((v, i) => escribe(v, esquema.de, `${ruta}[${i}]`));
    return `[${partes.join(',')}]`;
  }

  if (esquema.forma === 'tupla') {
    if (!Array.isArray(valor)) falla(ruta, `se esperaba una tupla y llegó ${describeValor(valor)}`);
    exigeArrayLimpio(valor, ruta);
    if (valor.length !== esquema.tipos.length) {
      falla(ruta, `se esperaba una tupla de ${esquema.tipos.length} y llegó una de ${valor.length}`);
    }
    return `[${esquema.tipos.map((t, i) => escribe(valor[i], t, `${ruta}[${i}]`)).join(',')}]`;
  }

  if (esquema.forma === 'campos') {
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
      falla(ruta, `se esperaba un objeto y llegó ${describeValor(valor)}`);
    }
    const declarados = Object.keys(esquema.mapa);
    // El esquema es cerrado por los dos lados y esto es todo el mecanismo: un campo
    // que nadie declaró —una posición del jugador, por ejemplo— hace fallar la
    // escritura nombrándolo, en vez de viajar de polizón hasta el disco.
    for (const clave of Object.keys(valor)) {
      if (!declarados.includes(clave)) {
        falla(ruta, `el campo "${clave}" no está declarado en el esquema (los declarados son ${declarados.join(', ')})`);
      }
    }
    const partes = [];
    for (const clave of declarados) {
      if (!Object.prototype.hasOwnProperty.call(valor, clave)) {
        falla(ruta, `falta el campo obligatorio "${clave}"`);
      }
      partes.push(`${JSON.stringify(clave)}:${escribe(valor[clave], esquema.mapa[clave], `${ruta}.${clave}`)}`);
    }
    return `{${partes.join(',')}}`;
  }

  if (esquema.forma === 'dic') {
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
      falla(ruta, `se esperaba un diccionario y llegó ${describeValor(valor)}`);
    }
    // Las claves ordenadas y no las de inserción: es la única forma de que el
    // mismo diccionario construido en otro orden dé el mismo texto.
    const claves = Object.keys(valor).sort();
    const partes = claves.map((k) => `${JSON.stringify(k)}:${escribe(valor[k], esquema.de, `${ruta}.${k}`)}`);
    return `{${partes.join(',')}}`;
  }

  if (esquema.forma === 'uno') {
    let ultimo = null;
    for (const alternativa of esquema.alternativas) {
      try {
        return escribe(valor, alternativa, ruta);
      } catch (e) {
        ultimo = e;
      }
    }
    falla(ruta, `no encaja en ninguna de las ${esquema.alternativas.length} formas declaradas (${ultimo?.message ?? 'sin detalle'})`);
  }

  return falla(ruta, `forma de esquema desconocida "${esquema.forma}"`);
}

/**
 * Una lista sin propiedades colgadas.
 *
 * Es la trampa que SPEC-002 pagó una vez: una propiedad puesta sobre un array no
 * sobrevive a la serialización y desaparece **sin que nada se ponga rojo**. Aquí se
 * caza al escribir, que es el único momento en que se puede nombrar el campo antes
 * de perderlo.
 */
function exigeArrayLimpio(valor, ruta) {
  for (const clave of Object.keys(valor)) {
    if (!/^\d+$/.test(clave)) {
      falla(ruta, `la lista lleva la propiedad "${clave}" colgada: una propiedad sobre un array no sobrevive a JSON y se perdería en silencio`);
    }
  }
}

// --- Validación estructural del lado del mundo ------------------------------

/**
 * Recorre un valor **antes** de codificarlo y falla nombrando el campo si lleva
 * algo que JSON no sabe escribir.
 *
 * El esquema caza lo que llega al documento; esto caza lo que hay en el mundo y no
 * llegaría nunca, que es la mitad silenciosa del mismo problema: un `undefined`, un
 * `NaN`, un `Map`, un `Set`, una función o una propiedad colgada de un array.
 */
export function exigeSerializable(valor, ruta = 'mundo', vistos = new Set()) {
  if (valor === undefined) falla(ruta, 'vale undefined, que JSON no sabe escribir');
  if (valor === null) return valor;
  const t = typeof valor;
  if (t === 'number') {
    if (!Number.isFinite(valor)) falla(ruta, `vale ${String(valor)}, que JSON no sabe escribir`);
    return valor;
  }
  if (t === 'string' || t === 'boolean') return valor;
  if (t === 'function') falla(ruta, 'es una función, que JSON no sabe escribir');
  if (t === 'symbol' || t === 'bigint') falla(ruta, `es un ${t}, que JSON no sabe escribir`);
  if (valor instanceof Map) falla(ruta, 'es un Map, que JSON escribe como {} y vaciaría el dato en silencio');
  if (valor instanceof Set) falla(ruta, 'es un Set, que JSON escribe como {} y vaciaría el dato en silencio');
  if (valor instanceof Date) falla(ruta, 'es una Date: las marcas de tiempo viajan como texto declarado, no como objeto');
  if (ArrayBuffer.isView(valor)) falla(ruta, `es un ${valor.constructor.name}: las vistas sobre ArrayBuffer necesitan su propia codificación`);
  if (vistos.has(valor)) return valor; // ya recorrido: un mundo comparte objetos entre familias
  vistos.add(valor);
  if (Array.isArray(valor)) {
    exigeArrayLimpio(valor, ruta);
    valor.forEach((v, i) => exigeSerializable(v, `${ruta}[${i}]`, vistos));
    return valor;
  }
  for (const clave of Object.keys(valor)) exigeSerializable(valor[clave], `${ruta}.${clave}`, vistos);
  return valor;
}

// --- Ni un rastro de ubicación ni un reloj real ------------------------------
//
// Los nombres por los que se colaría una posición de quien juega o una marca del
// reloj. El esquema cerrado ya rechaza un campo que nadie declare, pero un nombre
// así dentro de un valor inerte —donde el esquema no fija la forma a propósito—
// pasaría. Es la segunda red del mismo argumento de `efectos.js`: el campo ya
// fallaría por otro sitio, pero el error diría «campo desconocido» y no lo que de
// verdad ocurre, que es que alguien intentó guardar por dónde fue alguien.

const NOMBRES_DE_POSICION = /^(lat|lon|lng|latitud|longitud|coord|coords|coordenada|coordenadas|posicion|posiciones|gps|rastro|traza|trayecto|recorrido)$/i;
const NOMBRES_DE_RELOJ = /^(timestamp|epoch|reloj|hora|ahora|now|fechaReal|capturado|capturadoEn|capturadaEn|utc)$/i;

/**
 * **La única posición de quien juega que la partida guarda**, declarada aquí y no
 * dentro del área que la escribe, para que ampliarla se vea en este diff y no en otro.
 *
 * Es el punto de partida de la salida en curso: **un punto, no un histórico**. Lo que
 * RF-PRIV-002 prohíbe es el rastro —«no se guarda histórico de posiciones»—, y sin
 * este ancla la salida no se puede cerrar por regreso después de que el sistema haya
 * matado el proceso, que es exactamente el caso de Android del riesgo 4 del PRD: se
 * vuelve a casa andando y el telón no cae. Vive mientras la salida vive y desaparece
 * con ella; el esquema del área lo cierra a dos números y nada más cuelga de él.
 *
 * Todo lo demás sigue fallando, incluidas las posiciones de esa misma área que no sean
 * esta: la excepción es una ruta exacta, no un permiso para el área.
 */
export const POSICIONES_DECLARADAS = Object.freeze([
  'areas.salidas.salida.partida',
]);

const RUTA_DECLARADA = new RegExp(`(^|\\.)(${POSICIONES_DECLARADAS.map((r) => r.replace(/\./g, '\\.')).join('|')})$`);

/**
 * Recorre un documento de la partida y falla **nombrando el campo** si lleva un
 * rastro de ubicación o una marca del reloj real.
 *
 * Es bloqueante (RF-PRIV-002, `@privacidad`) y por eso se llama al escribir el
 * estado y el registro, no solo desde las pruebas: una guarda que nadie invoca es
 * decoración. **No se aplica a los documentos del mundo**, que sí llevan coordenadas
 * por definición: lo que RF-PRIV-002 prohíbe es el histórico de posiciones de quien
 * juega, y ese solo cabría aquí.
 *
 * La única ruta exenta es la de `POSICIONES_DECLARADAS`, y está escrita arriba con su
 * motivo: un punto no es un histórico, y sin él la salida no se puede cerrar por
 * regreso tras un reinicio del proceso.
 */
export function sinRastroDeUbicacion(valor, ruta = 'documento') {
  if (valor === null || typeof valor !== 'object') return valor;
  if (RUTA_DECLARADA.test(ruta)) return valor;
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => sinRastroDeUbicacion(v, `${ruta}[${i}]`));
    return valor;
  }
  for (const clave of Object.keys(valor)) {
    if (NOMBRES_DE_POSICION.test(clave)) {
      throw new Error(`${ruta}.${clave}: el estado y el registro de la partida no guardan ninguna posición de quien juega, y "${clave}" es una (RF-PRIV-002)`);
    }
    if (NOMBRES_DE_RELOJ.test(clave)) {
      throw new Error(`${ruta}.${clave}: el momento de la partida es el día de diario y el paso del mundo, nunca una marca del reloj real`);
    }
    sinRastroDeUbicacion(valor[clave], `${ruta}.${clave}`);
  }
  return valor;
}

// --- Base64, a mano ---------------------------------------------------------
//
// El paquete no tiene dependencias y `btoa`/`Buffer` no están garantizados en las
// dos plataformas en que corre. Son veinte líneas y quitan la duda.

const ALFABETO_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes → base64. */
export function aBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += ALFABETO_B64[a >> 2];
    out += ALFABETO_B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? ALFABETO_B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? ALFABETO_B64[c & 63] : '=';
  }
  return out;
}

/** base64 → `Uint8Array`. Falla nombrando el símbolo que sobra en lugar de saltárselo. */
export function deBase64(texto) {
  const limpio = texto.replace(/=+$/, '');
  const n = Math.floor((limpio.length * 6) / 8);
  const out = new Uint8Array(n);
  let acc = 0;
  let bits = 0;
  let k = 0;
  for (const c of limpio) {
    const v = ALFABETO_B64.indexOf(c);
    if (v < 0) throw new Error(`base64 mal formado: el símbolo "${c}" no está en el alfabeto`);
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[k++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

// --- La versión, que se lee antes que nada ----------------------------------

/**
 * Comprueba la versión del formato **antes de interpretar ningún otro campo**.
 *
 * Tres respuestas cerradas y ninguna más: es la mía y se abre; es mayor y no se
 * abre en absoluto, declarando las dos versiones; es menor y se declara que hay que
 * migrarlo, sin intentar leerlo con las reglas nuevas. Abrir a medias un documento
 * escrito por una versión futura es disimular, y con el mundo congelado un dato mal
 * interpretado no se puede regenerar.
 */
export function compruebaVersion(doc, donde = 'el documento') {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error(`${donde} no es un documento: llegó ${describeValor(doc)}`);
  }
  if (!Object.prototype.hasOwnProperty.call(doc, 'version')) {
    throw new Error(`${donde} no declara el campo "version": sin él no se puede saber con qué reglas se escribió y no se abre`);
  }
  const v = doc.version;
  if (!Number.isInteger(v)) {
    throw new Error(`${donde} declara una versión de formato que no es un entero: ${describeValor(v)}`);
  }
  if (v > VERSION_FORMATO) {
    throw new Error(
      `${donde} está escrito en la versión de formato ${v} y esta versión del juego entiende la ${VERSION_FORMATO}: no se abre`,
    );
  }
  if (v < VERSION_FORMATO) {
    throw new Error(
      `${donde} está escrito en la versión de formato ${v} y esta versión del juego usa la ${VERSION_FORMATO}: hay que migrarlo antes de abrirlo`,
    );
  }
  return v;
}

// --- Esquemas ---------------------------------------------------------------

const LATLON = campos({ lat: 'numero', lon: 'numero' });
const PUNTO = tupla(['numero', 'numero']);
/** Polilínea en metros, aplanada: la mitad de llaves y la mitad de bytes. */
const POLILINEA = lista('numero');

const FICHA_REAL = campos({
  name: 'texto?',
  kind: 'texto',
  osmId: 'texto?',
  // Solo para los anclajes de Places: lo único suyo que se puede guardar es el
  // identificador, así que el nombre y la coordenada viajan marcados como
  // refrescables y con la fecha en que se capturaron.
  placeId: 'texto?',
  refrescable: uno(['nulo', campos({ nombre: 'texto?', lat: 'numero', lon: 'numero', capturado: 'texto?' })]),
});

const APTITUD = campos({ escalones: 'texto', firme: 'texto', bordillos: 'texto', paso: 'texto' });
const CUENTA_APTITUD = campos({ apto: 'entero', noApto: 'entero', noSeSabe: 'entero' });

const INFORME_GRAFO = campos({
  nodos: 'entero',
  aristas: 'entero',
  componentes: 'entero',
  cosidas: 'entero',
  metrosCosidos: lista('numero'),
  componentesAisladas: lista(campos({ nodos: 'entero' })),
  aptitud: campos({ escalones: CUENTA_APTITUD, firme: CUENTA_APTITUD, bordillos: CUENTA_APTITUD, paso: CUENTA_APTITUD }),
  bordillosDeNodo: 'entero',
  separacionMinimaSinCoserM: 'numero?',
  alcanceDeBusquedaM: 'numero',
  umbralM: 'numero',
});

const VIA = campos({
  osmId: 'texto?',
  nodes: uno(['nulo', lista('entero')]),
  level: 'texto',
  layer: 'entero',
  rasgo: 'texto?',
  filtrables: dic('texto'),
  name: 'texto?',
  pts: POLILINEA,
});

const TRAMO = campos({
  // Los nodos del grafo por su índice, que es lo que hace que un tramo **cite** el
  // callejero en lugar de copiarlo. Vacío en el tramo recto, que no recorre ninguno.
  nodos: lista('entero'),
  // Nulos cuando los extremos son exactamente las coordenadas de esos dos nodos,
  // que es el caso normal: se leen del grafo y no se repiten.
  desde: uno(['nulo', PUNTO]),
  hasta: uno(['nulo', PUNTO]),
  metros: 'numero',
  suposicion: 'texto?',
  rasgo: 'texto?',
  nombre: 'texto?',
  aptitud: APTITUD,
});

const RUTA = campos({
  name: 'texto?',
  ramal: 'booleano',
  // Origen y destino se citan por su sitio en el mundo y no se copian: `from` es un
  // núcleo entero con sus servicios dentro, y copiarlo multiplicaba el documento.
  desde: uno(['nulo', tupla(['texto', 'entero'])]),
  hasta: uno(['nulo', tupla(['texto', 'entero'])]),
  // Cada punto del trazado es o el índice de un nodo del grafo o un par literal.
  pts: lista(uno(['entero', PUNTO])),
  nodos: lista('entero'),
  tramos: lista(TRAMO),
  suposiciones: campos({ cosida: 'booleano', fallback: 'booleano', ninguna: 'booleano' }),
});

const SERVICIO = campos({
  kind: 'texto',
  label: 'texto?',
  name: 'texto',
  x: 'numero',
  y: 'numero',
  real: uno(['nulo', FICHA_REAL]),
});

const NUCLEO = campos({
  type: 'texto',
  x: 'numero',
  y: 'numero',
  name: 'texto',
  anchor: uno(['nulo', FICHA_REAL]),
  services: lista(SERVICIO),
});

const PARAJE = campos({
  type: 'texto',
  x: 'numero',
  y: 'numero',
  name: 'texto',
  label: 'texto?',
  origin: 'texto',
  real: uno(['nulo', FICHA_REAL]),
  scenes: dic('numero'),
});

const VIARIO = campos({
  umbralM: 'numero',
  mayor: 'entero',
  // Los nodos, en el orden canónico del grafo. Todo lo demás los cita por su índice
  // en esta lista, que es lo que evita repetir el identificador de OSM mil veces.
  nodos: lista(uno(['entero', 'texto'])),
  // La coordenada de cada nodo **se cita y no se copia**: es un punto que ya está
  // en el documento, dentro de la vía de la que nació, y repetirlo eran cuatrocientos
  // kilobytes de dobles en el mundo urbano denso. `[familia, vía, punto]` cuando se
  // encuentra —0 son las carreteras y 1 el callejero—, y el par literal cuando no.
  coord: lista(uno([tupla(['entero', 'entero', 'entero']), tupla(['numero', 'numero'])])),
  capas: lista(lista('entero')),
  de: lista('entero'),
  // Tablas de internado: el nombre de la vía y la marca de aptitud se repiten en
  // miles de aristas, y guardarlos una vez es la diferencia entre un documento
  // asumible y uno que no lo es.
  nombres: lista('texto'),
  rasgos: lista('texto'),
  aptitudes: lista(APTITUD),
  // Las adyacencias de cada nodo, en el mismo orden en que las construyó el grafo:
  // el orden decide los empates de Dijkstra, así que reordenarlas cambiaría el
  // trazado de un lazo sin cambiar ni un dato.
  adj: lista(lista(tupla(['entero', 'numero', 'entero', 'entero', 'entero', 'entero']))),
  informe: INFORME_GRAFO,
});

const POOL = campos({
  admitidos: 'entero',
  deOsm: 'entero',
  dePlaces: 'entero',
  demanda: campos({ total: 'entero', suelo: 'entero' }),
  deficit: 'entero',
  relleno: uno(['nulo', campos({ fuente: 'texto?', admitidos: 'entero', sinRelleno: 'booleano' })]),
  porEtiqueta: lista(campos({ clave: 'texto', n: 'entero' })),
  porKind: lista(campos({ clave: 'texto', n: 'entero' })),
  tomados: lista(campos({ osmId: 'texto', rol: 'texto', nombre: 'texto?' })),
  excluidos: lista('texto'),
  descartes: campos({
    problematicos: dic('entero'),
    etiquetasSinNombre: lista(campos({ etiqueta: 'texto', entradas: 'entero', nombradas: 'entero' })),
    // El resto son contadores y llegan por nombre: se declaran como diccionario de
    // enteros para que añadir un motivo de descarte no obligue a subir la versión
    // del formato, y como enteros para que por ahí no quepa nada que no sea contar.
    contadores: dic('entero'),
  }),
});

/** El hueco de una ilustración: el prompt de ficción, su clave, y dónde está o que no está. */
const ILUSTRACION = campos({
  elemento: 'texto',
  prompt: 'texto',
  clave: 'texto',
  recurso: 'texto?',
  estado: 'texto',
});

/** El hueco de una foto del lado real: el `place_id`, el recurso local y la fecha de captura. */
const FOTO = campos({
  anclaje: 'texto',
  placeId: 'texto',
  recurso: 'texto?',
  capturadaEn: 'texto?',
  estado: 'texto',
});

/** Un texto ya validado, en línea, con su clave y su origen declarado. */
const TEXTO_DE_JUEGO = campos({ clave: 'texto', texto: 'texto', origen: 'texto' });

const RECURSOS = campos({
  ilustraciones: lista(ILUSTRACION),
  fotos: lista(FOTO),
  textos: lista(TEXTO_DE_JUEGO),
});

const MUNDO = campos({
  radius: 'numero',
  baseRadius: 'numero',
  locale: 'texto',
  title: 'texto',
  geo: campos({
    coastlines: lista(campos({ osmId: 'texto?', pts: POLILINEA })),
    lakes: lista(campos({ osmId: 'texto?', pts: POLILINEA })),
    rivers: lista(campos({ osmId: 'texto?', kind: 'texto', pts: POLILINEA })),
    forests: lista(campos({ osmId: 'texto?', pts: POLILINEA })),
    peaks: lista(campos({ osmId: 'texto?', name: 'texto?', ele: 'numero', x: 'numero', y: 'numero' })),
    roads: lista(VIA),
    callejero: lista(VIA),
    bordillos: lista(campos({ osmId: 'texto?', nodo: 'entero', aptitud: 'texto', x: 'numero', y: 'numero' })),
  }),
  // La máscara tierra/mar **se congela y no se recalcula**: el mar pintado es parte
  // del mapa, y recalcularlo ataría el aspecto de un mapa ya generado a la versión
  // de `seamask.js` que tenga instalada quien juega. Va en rejilla de bits, que es
  // la forma que lo hace asumible: un bit por celda en vez de un byte.
  seaMask: uno(['nulo', campos({ n: 'entero', cell: 'numero', extent: 'numero', bits: 'texto' })]),
  settlements: lista(NUCLEO),
  parajes: lista(PARAJE),
  routes: lista(RUTA),
  viario: VIARIO,
  // El registro de uso único de los anclajes sí se congela: es lo que hace
  // afirmable sobre un mundo levantado que ningún anclaje real aparece dos veces.
  // Lo que se queda fuera es la auditoría de **cómo** se generó —qué se movió hasta
  // el viario, qué topes hubo que relajar, qué escenas quedaron sin cubrir—, que es
  // diagnóstico de generación y no mundo.
  pool: POOL,
});

const CUPOS = campos({
  radioEnTramos: 'numero',
  ladoEnTramos: 'numero',
  nucleos: dic('entero'),
  servicios: dic('entero'),
  parajes: campos({
    cupo: 'entero',
    suelo: 'entero',
    techo: 'entero',
    escenasPedidas: 'entero',
    escenasPorParaje: 'entero',
    vocabulario: lista(campos({ escena: 'texto', pesoMinimo: 'numero' })),
  }),
});

/**
 * El documento de una celda.
 *
 * La cabecera va primero y la versión antes que la cabecera, a propósito: es lo que
 * permite rechazar un documento de una versión futura sin haber interpretado nada.
 *
 * **Ni la semilla de la partida ni ninguna posición de quien juega aparecen aquí**,
 * y el esquema cerrado es lo que lo hace comprobable: un campo con una posición del
 * jugador no se puede añadir sin declararlo, y declararlo se ve en el diff.
 */
export const ESQUEMA_CELDA = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  mapa: campos({ id: 'texto', anclaje: LATLON, idioma: 'texto' }),
  celda: campos({
    i: 'entero',
    j: 'entero',
    clave: 'texto',
    motivo: 'texto',
    ladoM: 'numero',
    radioInscritoM: 'numero',
    tramoM: 'numero',
    sinContenidoJugable: 'booleano',
    centro: LATLON,
    esquinas: lista(LATLON),
    metros: campos({ minX: 'numero', minY: 'numero', maxX: 'numero', maxY: 'numero' }),
  }),
  // El marco métrico del documento: todas sus coordenadas son metros, y este es el
  // desplazamiento que las lleva al anclaje del mapa. Ningún punto del documento es
  // por sí solo una coordenada del mundo real.
  marco: campos({ unidad: 'texto', relativoA: 'texto', origenM: PUNTO }),
  cupos: CUPOS,
  mundo: MUNDO,
  recursos: RECURSOS,
});

/**
 * El índice de un mapa: pequeño, se lee siempre, y con él se responde «¿en qué mapa
 * estoy?» sin cargar ni una celda.
 */
export const ESQUEMA_INDICE = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  id: 'texto',
  anclaje: LATLON,
  titulo: 'texto?',
  idioma: 'texto?',
  ladoM: 'numero',
  tramoM: 'numero',
  tramoPedidoM: 'numero',
  tramoRecortadoAlSuelo: 'booleano',
  tramoSueloM: 'numero',
  ladoEnTramos: 'numero',
  radioInscritoM: 'numero',
  celdas: lista(campos({ clave: 'texto', i: 'entero', j: 'entero', motivo: 'texto', sinContenidoJugable: 'booleano' })),
  costuras: lista(campos({
    celdas: tupla(['texto', 'texto']),
    contiguas: 'booleano',
    umbralM: 'numero',
    borde: uno(['nulo', campos({ eje: 'texto', en: 'numero' })]),
    aristas: lista(campos({
      desde: campos({ celda: 'texto', clave: 'texto', lat: 'numero', lon: 'numero' }),
      hasta: campos({ celda: 'texto', clave: 'texto', lat: 'numero', lon: 'numero' }),
      metros: 'numero',
      suposicion: 'booleano',
    })),
  })),
});

const ESQUEMAS = { [CLASES.CELDA]: ESQUEMA_CELDA, [CLASES.INDICE]: ESQUEMA_INDICE };

/**
 * Un valor inerte cualquiera: nulo, texto, número, booleano, lista de inertes o
 * diccionario de inertes. **Se define por recursión sobre sí mismo**, que es lo que
 * permite describir una carga que este módulo no interpreta —la semilla estructurada
 * que declara una plantilla, por ejemplo— sin abrir el esquema a cualquier cosa.
 *
 * Sigue rechazando lo que de verdad importa rechazar: `undefined`, `NaN`, un `Map`,
 * un `Set`, una `Date`, una función y una propiedad colgada de un array. Lo que no
 * hace es fijar la forma, y por eso solo se usa donde la forma es de otro.
 */
export const VALOR_INERTE = { forma: 'uno', alternativas: ['nulo', 'texto', 'numero', 'booleano'] };
VALOR_INERTE.alternativas.push(lista(VALOR_INERTE), dic(VALOR_INERTE));
Object.freeze(VALOR_INERTE.alternativas);
Object.freeze(VALOR_INERTE);

/**
 * Declara el esquema de una clase de documento desde el módulo que la posee.
 *
 * Existe para que el estado y el registro de SPEC-016 sean documentos de esta misma
 * familia **sin que este módulo tenga que importarlos**: si los esquemas vivieran
 * aquí, `formato.js` importaría media partida y el ciclo de imports sería inmediato.
 * Redeclarar una clase con otro esquema es un error y no un reemplazo: dos esquemas
 * para la misma clase es exactamente el bug que la constante única evita.
 */
export function declaraEsquema(clase, esquema) {
  if (typeof clase !== 'string' || !clase) {
    throw new Error(`una clase de documento se declara con su nombre y llegó ${describeValor(clase)}`);
  }
  if (ESQUEMAS[clase] && ESQUEMAS[clase] !== esquema) {
    throw new Error(`la clase de documento "${clase}" ya tiene un esquema declarado: dos esquemas para la misma clase escribirían dos documentos distintos con el mismo nombre`);
  }
  ESQUEMAS[clase] = esquema;
  return esquema;
}

/** El esquema de una clase de documento, o un error que nombra las declaradas. */
export function esquemaDe(clase) {
  const e = ESQUEMAS[clase];
  if (!e) throw new Error(`clase de documento desconocida "${clase}": las declaradas son ${Object.keys(ESQUEMAS).join(' y ')}`);
  return e;
}

/** El texto canónico de un documento, validado contra el esquema de su clase. */
export function texto(doc) {
  if (doc === null || typeof doc !== 'object') throw new Error(`no es un documento: llegó ${describeValor(doc)}`);
  return escribe(doc, esquemaDe(doc.clase), `documento ${doc.clase ?? 'sin clase'}`);
}

/**
 * Lee un documento desde su texto: se parsea, **se comprueba la versión antes que
 * cualquier otro campo** y después se valida contra el esquema cerrado.
 *
 * Un documento truncado falla aquí nombrando el documento y no devuelve un mundo a
 * medias, que es el único comportamiento aceptable con un mundo que ya no se puede
 * regenerar.
 */
export function lee(cadena, donde = 'el documento') {
  if (typeof cadena !== 'string') throw new Error(`${donde}: se esperaba el texto del documento y llegó ${describeValor(cadena)}`);
  let doc;
  try {
    doc = JSON.parse(cadena);
  } catch (e) {
    throw new Error(`${donde} no se puede leer: está roto o truncado (${e.message})`);
  }
  compruebaVersion(doc, donde);
  // Validar releyendo con el mismo escritor: si el documento pasa, es además su
  // propia forma canónica, y eso es lo que hace afirmable el ida y vuelta.
  escribe(doc, esquemaDe(doc.clase), donde);
  return doc;
}
