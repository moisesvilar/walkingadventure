// Máscara tierra/mar sobre una rejilla, construida desde las líneas de costa OSM.
// Convención OSM: el agua queda a la DERECHA del sentido de dibujo del way de costa.
// Usos: no colocar núcleos/parajes en el mar, pintar el mar, calcular el radio dinámico.

const LAND = 1;
const SEA = 2;

function segSideDist(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = p.x - a.x, wy = p.y - a.y;
  const L2 = vx * vx + vy * vy || 1;
  const tRaw = (wx * vx + wy * vy) / L2;
  const t = Math.max(0, Math.min(1, tRaw));
  const d = Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
  const cross = vx * wy - vy * wx; // >0 izquierda (tierra), <0 derecha (mar)
  // El lado solo es fiable si la proyección cae dentro del segmento; en los
  // extremos el signo respecto a la recta infinita puede mentir.
  const interior = tRaw > 0.02 && tRaw < 0.98;
  return { d, sea: cross < 0, interior };
}

/**
 * coastlines: tramos de costa {pts: [{x,y},...], osmId} en metros. extent:
 * semi-lado del cuadrado cubierto. cell: tamaño de celda. Cada celda se clasifica
 * por el LADO del segmento de costa más cercano (índice espacial por cubos):
 * robusto frente a huecos en los ways de costa, al contrario que un relleno por
 * inundación.
 */
export function buildSeaMask(coastlines, extent, cell = 200) {
  const segs = [];
  for (const { pts: line } of coastlines) {
    for (let s = 0; s < line.length - 1; s++) segs.push([line[s], line[s + 1]]);
  }
  if (!segs.length) return null;

  const bucket = 1000;
  const bn = Math.ceil((2 * extent) / bucket);
  const buckets = Array.from({ length: bn * bn }, () => []);
  const bIdx = (v) => Math.max(0, Math.min(bn - 1, Math.floor((v + extent) / bucket)));
  segs.forEach(([a, b], si) => {
    for (let bj = bIdx(Math.min(a.y, b.y)); bj <= bIdx(Math.max(a.y, b.y)); bj++) {
      for (let bi = bIdx(Math.min(a.x, b.x)); bi <= bIdx(Math.max(a.x, b.x)); bi++) {
        buckets[bj * bn + bi].push(si);
      }
    }
  });

  const n = Math.ceil((2 * extent) / cell);
  const state = new Uint8Array(n * n);
  const center = (i) => -extent + (i + 0.5) * cell;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p = { x: center(i), y: center(j) };
      const cbi = bIdx(p.x), cbj = bIdx(p.y);
      let bestD = Infinity, bestSea = false, foundRing = -1;

      for (let r = 0; r < bn; r++) {
        if (foundRing >= 0 && r > foundRing + 1) break; // un anillo extra de seguridad
        for (let bj = Math.max(0, cbj - r); bj <= Math.min(bn - 1, cbj + r); bj++) {
          for (let bi = Math.max(0, cbi - r); bi <= Math.min(bn - 1, cbi + r); bi++) {
            if (Math.max(Math.abs(bi - cbi), Math.abs(bj - cbj)) !== r) continue;
            for (const si of buckets[bj * bn + bi]) {
              const [a, b] = segs[si];
              const res = segSideDist(p, a, b);
              // penaliza extremos de segmento: a igualdad práctica de distancia
              // gana un segmento con proyección interior (lado fiable)
              const dAdj = res.d + (res.interior ? 0 : cell * 0.75);
              if (dAdj < bestD) { bestD = dAdj; bestSea = res.sea; }
            }
          }
        }
        if (bestD < Infinity && foundRing < 0) foundRing = r;
      }

      state[j * n + i] = bestSea ? SEA : LAND;
    }
  }

  return { state, n, cell, extent };
}

export function isSea(mask, p) {
  if (!mask) return false;
  const i = Math.floor((p.x + mask.extent) / mask.cell);
  const j = Math.floor((p.y + mask.extent) / mask.cell);
  if (i < 0 || j < 0 || i >= mask.n || j >= mask.n) return false;
  return mask.state[j * mask.n + i] === SEA;
}

/**
 * Radio dinámico: amplía desde rBase hasta que el borde del círculo solo corte
 * agua de océano abierto (inevitable), nunca bahías/rías, y añade un margen.
 */
export function computeDisplayRadius(mask, { rBase = 20000, rMax = 26000, rOceanTest = 27500, margin = 4000, step = 500, samples = 720 } = {}) {
  const seaAt = (theta, R) => isSea(mask, { x: Math.cos(theta) * R, y: Math.sin(theta) * R });
  const angles = Array.from({ length: samples }, (_, k) => (k / samples) * Math.PI * 2);
  // océano = sigue siendo agua incluso en el radio máximo de test
  const ocean = angles.map((t) => seaAt(t, rOceanTest));

  const enclosedCount = (R) => {
    let c = 0;
    for (let k = 0; k < samples; k++) if (!ocean[k] && seaAt(angles[k], R)) c++;
    return c;
  };

  if (enclosedCount(rBase) === 0) return rBase;

  let bestR = rMax, bestC = Infinity;
  for (let R = rBase; R <= rMax; R += step) {
    const c = enclosedCount(R);
    if (c === 0) { bestR = R; break; }
    if (c < bestC) { bestC = c; bestR = R; }
  }
  return Math.min(bestR + margin, rMax);
}
