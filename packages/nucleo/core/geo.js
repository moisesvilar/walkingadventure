// Geometría: proyección local equirrectangular (metros, y hacia el norte) y utilidades.
// Aquí nacen todos los metros del generador, y por eso aquí vive la única constante
// de precisión con la que se guardan: la rejilla a la que se cuantiza al proyectar.

const M_PER_DEG_LAT = 111320;

/**
 * El paso de la rejilla con la que se guardan los metros. **Un metro, y es la única
 * constante de precisión del paquete**: ninguna fase redondea por su cuenta.
 *
 * Por qué un metro y no un decímetro: el documento de una celda urbana densa sin
 * cuantizar pesa 2953 KB frente a los 2048 de presupuesto, con el decímetro se queda
 * en 2080 —sigue sin caber— y con el metro en 1961. Y por debajo del metro no hay
 * nada que el juego distinga: el geofence de una llegada son 30-50 m, el mapa se
 * pinta a unos 10 m por píxel y una calle de cuatro carriles mide 15 m de ancha.
 *
 * **No se inyecta, y es deliberado**: cuantizar con otro valor produciría mundos
 * distintos con la misma semilla, que es lo que RNF-DET-001 prohíbe. Y gobierna los
 * metros y solo los metros: los grados de la cabecera de un documento —el anclaje,
 * el centro, las esquinas, los extremos de una costura— no se tocan, porque
 * redondear el anclaje movería el identificador del mapa que fija SPEC-003.
 *
 * Se cuantiza **en la generación y nunca al volcar**: redondear al escribir rompería
 * el ida y vuelta exacto, que es el criterio central de la capa de congelado.
 */
export const PRECISION_M = 1;

/** Un valor en metros, llevado a la rejilla de `PRECISION_M`. */
export function cuantizaM(v) {
  const q = Math.round(v / PRECISION_M) * PRECISION_M;
  // El cero negativo se normaliza aquí: `-0` y `0` se escriben distinto en el
  // documento —el volcado conserva el signo a propósito— y de una cuantización no
  // puede salir un signo que el valor original no tenía.
  return q === 0 ? 0 : q;
}

/** Un punto en metros, llevado a la rejilla de `PRECISION_M`. */
export function cuantizaPunto(p) {
  return { x: cuantizaM(p.x), y: cuantizaM(p.y) };
}

export function makeProjector(lat0, lon0) {
  const kx = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  return {
    // Las coordenadas se cuantizan **al proyectar**, que es donde nacen: a partir de
    // aquí todo lo que se mida sobre ellas ya está en la rejilla.
    toXY(lat, lon) {
      return cuantizaPunto({ x: (lon - lon0) * kx, y: (lat - lat0) * M_PER_DEG_LAT });
    },
    toLatLon(p) {
      return { lat: lat0 + p.y / M_PER_DEG_LAT, lon: lon0 + p.x / kx };
    },
  };
}

/**
 * Distancia en metros, cuantizada.
 *
 * Las longitudes se cuantizan **después** de las coordenadas y sobre ellas, y ese
 * orden importa: dos puntos distintos de la rejilla están siempre a un metro o más,
 * así que ninguna longitud entre puntos distintos puede salir cero. Solo dos puntos
 * coincidentes dan cero, que es la verdad a esta resolución.
 */
export function dist(a, b) {
  return cuantizaM(Math.hypot(a.x - b.x, a.y - b.y));
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonBBox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function polygonArea(poly) {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(s / 2);
}

// Distancia de un punto a un segmento.
export function pointSegDist(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

// Distancia de un punto a una polilínea.
export function pointPolylineDist(p, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointSegDist(p, pts[i], pts[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

// Intersección de segmentos ab × cd → punto o null.
export function segIntersect(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}
