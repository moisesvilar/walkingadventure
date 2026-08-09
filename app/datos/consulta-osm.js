// La consulta de OpenStreetMap de una celda y el reparto de lo que vuelve.
//
// Vive en la app y no en el paquete compartido por una regla del repositorio que se
// comprueba: en `packages/nucleo/` no puede aparecer ni un texto de consulta de
// Overpass —el núcleo parsea la respuesta, nunca la pide—. Y no se importa de
// `server/` porque ese módulo importa `node:crypto` y el empaquetador del móvil no
// lo resuelve: lo que hay aquí es la **copia declarada** de `consultaDeCelda` de
// `server/aguas-arriba/overpass.mjs`, igual que `conseguidor.js` lleva la copia
// declarada del tope de lote. Las dos tienen que producir el mismo texto para la
// misma celda, porque la clave de caché del proxy es el hash de ese texto: si
// divergen, el móvil deja de acertar en la caché y paga minutos contra los mirrors
// sin que nada se ponga rojo. Por eso `VERSION_CONSULTA` está aquí también y se
// cruza contra la del servidor.
//
// El segundo motivo de que las dos mitades vivan juntas en este fichero es más
// fuerte: **la consulta y el reparto salen de las mismas listas de etiquetas**. El
// texto pide cuatro bloques con cuatro `out`, y Overpass los devuelve fundidos en
// una sola lista de elementos; separarlos otra vez es clasificar por las mismas
// etiquetas que se pidieron. Con dos declaraciones, añadir una etiqueta a la
// consulta y olvidarla en el reparto haría que ese elemento llegara y se tirara —
// un mundo más pobre sin ningún error.

/**
 * La versión del texto de la consulta. Copia declarada de `VERSION_CONSULTA` de
 * `server/aguas-arriba/overpass.mjs`: subirla allí obliga a subirla aquí.
 */
export const VERSION_CONSULTA = '1';

/**
 * Un filtro de Overpass, declarado como dato: de aquí sale la línea de la consulta
 * y de aquí sale la comprobación con la que se clasifica lo que vuelve.
 *
 * `valores` nulo significa «la etiqueta, con el valor que sea» —así se piden los
 * bordillos—; un solo valor se escribe con igualdad y varios con la alternativa
 * anclada, que es exactamente como está escrita la consulta del servidor.
 */
const filtro = (tipo, clave, valores = null) => Object.freeze({ tipo, clave, valores: valores && Object.freeze(valores) });

/** La costa, que va sola y sin tope: si se trunca, la máscara tierra/mar clasifica mal. */
const COSTA = Object.freeze([filtro('way', 'natural', ['coastline'])]);

/** El terreno: agua, cauces, bosque, las carreteras que se pintan y los picos. */
const TERRENO = Object.freeze([
  filtro('way', 'natural', ['water']),
  filtro('way', 'waterway', ['river', 'stream', 'canal']),
  filtro('way', 'landuse', ['forest']),
  filtro('way', 'natural', ['wood']),
  filtro('way', 'highway', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'track']),
  filtro('node', 'natural', ['peak']),
]);

/**
 * Los anclajes aptos para menores. `amenity=drinking_water` sigue fuera a propósito:
 * es mobiliario urbano sin nombre y su volumen monopoliza el sesgo de tipo `fuente`
 * (`game-design/parajes.md`).
 */
const POIS = Object.freeze([
  filtro('nwr', 'amenity', ['place_of_worship']),
  filtro('nwr', 'amenity', ['monastery']),
  filtro('nwr', 'historic', ['monument', 'memorial', 'castle', 'ruins', 'city_gate', 'archaeological_site', 'wayside_cross', 'wayside_shrine', 'monastery']),
  filtro('nwr', 'tourism', ['viewpoint']),
  filtro('nwr', 'man_made', ['tower', 'lighthouse']),
  filtro('nwr', 'natural', ['spring']),
  filtro('nwr', 'amenity', ['fountain']),
  filtro('nwr', 'leisure', ['park']),
  filtro('nwr', 'shop', ['mall']),
  filtro('nwr', 'amenity', ['cafe', 'restaurant', 'ice_cream', 'fast_food', 'library']),
]);

/** El callejero local, que es donde están los huecos cortos que hay que coser. */
const CALLEJERO = Object.freeze([
  filtro('way', 'highway', ['residential', 'living_street', 'pedestrian', 'service', 'unclassified', 'track', 'path', 'footway', 'cycleway', 'steps']),
]);

/** Los bordillos: nodos, y por eso van aparte de las vías. */
const BORDILLOS = Object.freeze([
  filtro('node', 'kerb'),
  filtro('node', 'barrier', ['kerb']),
]);

/** La línea de un filtro dentro del texto de la consulta. */
function linea(f, alrededor) {
  if (f.valores === null) return `${f.tipo}["${f.clave}"]${alrededor}`;
  if (f.valores.length === 1) return `${f.tipo}["${f.clave}"="${f.valores[0]}"]${alrededor}`;
  return `${f.tipo}["${f.clave}"~"^(${f.valores.join('|')})$"]${alrededor}`;
}

/** Un grupo de filtros entre paréntesis, uno por línea y con dos espacios de sangría. */
function grupo(filtros, alrededor) {
  return `(\n${filtros.map((f) => `  ${linea(f, alrededor)};`).join('\n')}\n);`;
}

/**
 * La consulta de una celda, **entera y en un solo lote**.
 *
 * Un lote y no tres esperas encadenadas: tres plazos de 8 s se comen el presupuesto
 * de datos entero y dejan el minuto de RNF-PER-001 en manos del azar.
 *
 * @param {{lat: number, lon: number, radio_m: number}} celda
 */
export function consultaDeCelda({ lat, lon, radio_m: radio }) {
  const a = `(around:${radio},${lat},${lon})`;
  return `
[out:json][timeout:180];
${linea(COSTA[0], a)};
out geom;
${grupo(TERRENO, a)}
out geom 8000;
${grupo(POIS, a)}
out center 6000;
${linea(CALLEJERO[0], a)};
out geom 3000;
${grupo(BORDILLOS, a)}
out geom 3000;`;
}

/** Si un elemento de la respuesta encaja con un filtro declarado. */
function encaja(el, f) {
  if (f.tipo !== 'nwr' && el.type !== f.tipo) return false;
  const valor = (el.tags ?? {})[f.clave];
  if (typeof valor !== 'string') return false;
  return f.valores === null ? true : f.valores.includes(valor);
}

const alguno = (el, filtros) => filtros.some((f) => encaja(el, f));

/**
 * Reparte la respuesta fundida en los tres bloques que consume el núcleo.
 *
 * Overpass devuelve los cuatro `out` en una sola lista, así que separarlos otra vez
 * es clasificar por las mismas etiquetas con las que se pidieron. **Un elemento
 * puede caer en dos bloques y eso es correcto**: `unclassified` y `track` se piden
 * como terreno y como callejero, y la tubería los deduplica por su clave estable de
 * OSM al construir el grafo. Lo que no puede pasar es lo contrario —dar la lista
 * entera a los tres parseos—: `parseStreets` acepta cualquier vía, y un río o una
 * costa acabarían pintados como senda.
 *
 * @param {{elements?: object[]}} respuesta la de Overpass, tal cual llega.
 * @returns {{geoJson: object, poiJson: object, callejeroJson: object}}
 */
export function reparteRespuesta(respuesta) {
  if (!respuesta || typeof respuesta !== 'object' || !Array.isArray(respuesta.elements)) {
    throw new Error(
      'la respuesta de OSM no trae la lista "elements" que se pidió: llegó ' +
      `${respuesta === null || respuesta === undefined ? String(respuesta) : typeof respuesta}. ` +
      'No se genera un mundo pobre con lo que haya: sin datos no hay mapa que levantar',
    );
  }
  const geo = [];
  const pois = [];
  const callejero = [];
  for (const el of respuesta.elements) {
    if (!el || typeof el !== 'object') continue;
    if (alguno(el, COSTA) || alguno(el, TERRENO)) geo.push(el);
    if (alguno(el, POIS)) pois.push(el);
    if (alguno(el, CALLEJERO) || alguno(el, BORDILLOS)) callejero.push(el);
  }
  return { geoJson: { elements: geo }, poiJson: { elements: pois }, callejeroJson: { elements: callejero } };
}

/**
 * Cuántos decimales de coordenada viajan en la consulta.
 *
 * Seis son unos diez centímetros, muy por debajo de lo que cualquier dato de OSM
 * distingue, y son los que hacen la clave de caché estable: el centro de una celda
 * sale de una proyección, y sin recortar arrastraría los últimos bits de la coma
 * flotante hasta el hash con el que se cachea.
 */
export const DECIMALES_DE_CONSULTA = 6;

/** Los parámetros con los que se pide una celda: su centro y el radio que la cubre. */
export function celdaDeLimites(limites, margenM) {
  if (!limites || !limites.centro || !Number.isFinite(limites.ladoM)) {
    throw new Error('la consulta de una celda necesita sus límites, con su centro y su lado en metros');
  }
  if (!Number.isFinite(margenM) || margenM < 0) {
    throw new Error(`la consulta de una celda necesita el margen de borde en metros y llegó ${margenM}`);
  }
  const recorta = (g) => Number(g.toFixed(DECIMALES_DE_CONSULTA));
  return {
    lat: recorta(limites.centro.lat),
    lon: recorta(limites.centro.lon),
    // El radio inscrito de la celda más el margen. Inscrito y no circunscrito porque
    // la tubería genera sobre el círculo inscrito: pedir hasta las esquinas sería
    // pedir un 41 % más de datos que nadie mira.
    radio_m: Math.round(limites.ladoM / 2 + margenM),
  };
}
