// Cómo se llama el sitio donde estás, para poder ofrecer levantar un mapa aquí (A2P0).
//
// Existe porque el guion del ofrecimiento pide **el sitio dicho como lugar y no como
// coordenada** (`partida/mapas.js`, pieza `sitio`) y la app no tenía de dónde sacarlo.
// De las tres vías posibles el dueño eligió ésta, y las otras dos se descartaron con su
// motivo: la geocodificación inversa del sistema manda la coordenada exacta a un tercero,
// y el proxy ciego de SPEC-023 existe justamente para que la ubicación no toque a nadie
// más; y una frase fija siempre contradiría el guion, que es decisión cerrada.
//
// **Nada nuevo sale del móvil.** Viaja por `pideGeneracion` del cliente del proxy —la
// misma ruta, la misma ficha anónima y el mismo sobre con los que ya se levanta un mapa—,
// así que lo que se manda es lo que ya se mandaba: un texto de consulta con un recuadro.
//
// Vive en `app/` y no en el paquete por la misma regla que `consulta-osm.js`: en
// `packages/nucleo/` no puede aparecer ni un texto de consulta de Overpass.
//
// Y ojo con la caché: **un texto de consulta nuevo es una clave de caché nueva**, así que
// la primera vez que esto corre paga el minuto frío contra los mirrors. No es un cuelgue.

/** Cuánto se mira alrededor, en metros. Lo justo para que un sitio habitado caiga dentro. */
export const RADIO_DEL_TOPONIMO_M = 2000;

/**
 * Los lugares que se piden, **de mayor a menor**, y este orden es el desempate.
 *
 * No es una preferencia estética: quien está en un pueblo espera leer el nombre del
 * pueblo, no el de la aldea de al lado; y quien está en el campo agradece el nombre de
 * lo más cercano que tenga nombre. Un `place` de OSM sin `name` no sirve para nada aquí
 * y se descarta, que es lo que impide que salga una cadena vacía.
 */
export const LUGARES = Object.freeze(['city', 'town', 'village', 'hamlet', 'suburb', 'locality']);

/**
 * La consulta. Un solo recuadro y un solo `out`, que es todo lo que hace falta: esto no
 * genera nada, solo pregunta cómo se llama esto.
 */
export function consultaDeToponimo({ lat, lon, radioM = RADIO_DEL_TOPONIMO_M }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`la consulta del topónimo necesita una posición y llegó lat=${lat} lon=${lon}`);
  }
  const alrededor = `(around:${radioM},${lat},${lon})`;
  const lineas = LUGARES.map((v) => `  node["place"="${v}"]["name"]${alrededor};`).join('\n');
  return `[out:json][timeout:20];\n(\n${lineas}\n);\nout body 60;`;
}

/**
 * El nombre elegido de entre lo que vino, o `null`.
 *
 * **El orden es declarado y no el de llegada**: primero la categoría de lugar por su
 * puesto en `LUGARES`, después el nombre en orden de texto. Nunca el orden de `elements`,
 * que Overpass no garantiza — con él, dos ejecuciones sobre la misma respuesta podrían
 * dar sitios distintos y A2P0 dejaría de ser reproducible.
 *
 * No se elige por cercanía a propósito: pedir la distancia obligaría a proyectar la
 * coordenada exacta contra cada candidato, y lo que se busca es cómo se llama esto, no
 * cuál cae más cerca del punto donde se soltó la marca.
 */
export function eligeToponimo(elements) {
  if (!Array.isArray(elements)) return null;
  const candidatos = [];
  for (const e of elements) {
    const nombre = e?.tags?.name;
    const clase = e?.tags?.place;
    if (typeof nombre !== 'string' || !nombre) continue;
    const puesto = LUGARES.indexOf(clase);
    if (puesto === -1) continue;
    candidatos.push({ puesto, nombre });
  }
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => (
    a.puesto !== b.puesto ? a.puesto - b.puesto
      : a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0
  ));
  return candidatos[0].nombre;
}

/**
 * Monta el traedor.
 *
 * @param {object} deps
 * @param {{pideGeneracion: (consulta: {ql: string}) => Promise<{elements: object[]}>}} deps.cliente
 *   el cliente del proxy ciego, inyectado. Sin él esto no se construye: un traedor que se
 *   monta sin transporte y falla al primer ofrecimiento es la pieza que, al no estar, no
 *   protesta (§6h).
 * @returns `{ nombreDe({ lat, lon }) }`, que devuelve el nombre o `null`. **Nunca lanza**:
 *   que no se sepa cómo se llama esto no es una avería, es el caso que el respaldo del
 *   guion cubre, y convertirlo en excepción dejaría A2P0 sin poder pintarse.
 */
export function creaTraedorDeToponimos({ cliente, radioM = RADIO_DEL_TOPONIMO_M } = {}) {
  if (!cliente || typeof cliente.pideGeneracion !== 'function') {
    throw new Error('el traedor de topónimos necesita el cliente del proxy inyectado: es quien habla por la ruta ciega');
  }
  return {
    async nombreDe({ lat, lon }) {
      try {
        const respuesta = await cliente.pideGeneracion({ ql: consultaDeToponimo({ lat, lon, radioM }) });
        return eligeToponimo(respuesta?.elements);
      } catch {
        // Un fallo de transporte y un sitio sin nombre llevan al mismo sitio, y a
        // propósito: los dos significan «hoy no sé cómo se llama esto», que es lo que el
        // respaldo dice. El motivo no se enseña nunca — la pantalla habla en voz de mundo.
        return null;
      }
    },
  };
}
