// Pintado del mapa de fantasía en canvas.
// Convención: y en metros crece hacia el norte; en pantalla crece hacia abajo → se invierte.

import { makeRng } from './rng.js';
import { pointInPolygon, polygonBBox, polygonArea } from './geo.js';

const PARCHMENT = '#e9dcb6';
const PARCHMENT_DARK = '#d9c896';
const INK = '#4a3a22';
const WATER = '#8fb4c4';
const WATER_DEEP = '#6d97ab';
const FOREST = '#a8b483';

/**
 * view (opcional): { cx, cy, r, focus } en metros — centro, radio visible y
 * núcleo enfocado. Sin view se muestra el mundo completo.
 */
export function renderMap(canvas, world, view = null) {
  const v = view ?? { cx: 0, cy: 0, r: world.radius, focus: null };
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const margin = 70;
  const S = (W / 2 - margin) / v.r; // px por metro
  const R = v.r * S;                // radio visible en px

  const px = (p) => ({ x: cx + (p.x - v.cx) * S, y: cy - (p.y - v.cy) * S });
  const rng = makeRng(world.seed + ':render');

  ctx.clearRect(0, 0, W, H);

  // fondo exterior
  ctx.fillStyle = '#cbb98d';
  ctx.fillRect(0, 0, W, H);

  // recorte circular del mundo
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  drawParchment(ctx, W, H, rng);
  if (world.seaMask) drawSea(ctx, world.seaMask, px, S);
  drawForests(ctx, world.geo.forests, px, S, rng);
  drawLakes(ctx, world.geo.lakes, px);
  drawRivers(ctx, world.geo.rivers, px);
  drawCoastlines(ctx, world.geo.coastlines, px);
  if (v.focus?.streets) drawStreets(ctx, v.focus.streets, px);
  drawRoutes(ctx, world.routes, px);
  drawPeaks(ctx, world.geo.peaks, px, rng);

  const hits = drawSettlements(ctx, world.settlements, px, v.focus);
  if (v.focus) drawServiceMarkers(ctx, v.focus, px);

  ctx.restore();

  drawBorder(ctx, cx, cy, R);
  drawCompass(ctx, cx, cy, R);
  drawCartouche(ctx, W, v.focus ? v.focus.name : world.title);
  drawScaleBar(ctx, W, H, S, v.r);

  return hits; // posiciones en pantalla para detección de clics
}

// --- red viaria ---

function tracePolylineScreen(ctx, pts, px) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = px(p);
    i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
  });
}

// Callejero local del núcleo enfocado: calles finas y sendas punteadas.
function drawStreets(ctx, streets, px) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of streets) {
    tracePolylineScreen(ctx, st.pts, px);
    if (st.level === 'calle') {
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(122,94,58,0.5)';
      ctx.lineWidth = 2.2;
    } else {
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(122,94,58,0.45)';
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// Rutas entre núcleos: calzada de trazo doble; fallback en punteado recto.
function drawRoutes(ctx, routes, px) {
  if (!routes?.length) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const r of routes) {
    if (r.fallback) continue;
    tracePolylineScreen(ctx, r.pts, px);
    ctx.strokeStyle = '#4a3a22';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  for (const r of routes) {
    if (r.fallback) continue;
    tracePolylineScreen(ctx, r.pts, px);
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  for (const r of routes) {
    if (!r.fallback) continue;
    tracePolylineScreen(ctx, r.pts, px);
    ctx.setLineDash([4, 9]);
    ctx.strokeStyle = 'rgba(74,58,34,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const r of routes) drawRouteLabel(ctx, r, px);
}

// Nombre de la ruta, rotado sobre su punto medio (solo si hay sitio).
function drawRouteLabel(ctx, r, px) {
  const pts = r.pts.map(px);
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  if (total < 150) return;

  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (acc + seg >= total / 2) {
      const t = (total / 2 - acc) / seg;
      const mx = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
      const my = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
      let ang = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI; // texto siempre derecho
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.font = 'italic 16px "IM Fell English", Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(233,220,182,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(r.name, 0, -6);
      ctx.fillStyle = INK;
      ctx.fillText(r.name, 0, -6);
      ctx.restore();
      return;
    }
    acc += seg;
  }
}

// Marcadores de los servicios del núcleo enfocado, sobre su POI real.
const SERVICE_LETTER = { posada: 'P', taberna: 'T', boticario: 'B', armeria: 'H', conjureria: 'C', mercado: 'M' };

function drawServiceMarkers(ctx, settlement, px) {
  for (const p of settlement.services) {
    if (p.x == null) continue;
    const q = px(p);

    // varilla + medallón con la inicial del servicio
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x, q.y - 18);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(q.x, q.y - 30, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#7a2e1d';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PARCHMENT;
    ctx.font = 'bold 15px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SERVICE_LETTER[p.kind] ?? '?', q.x, q.y - 29);

    // punto exacto del lugar real
    ctx.beginPath();
    ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();

    // etiqueta con el nombre de fantasía
    ctx.font = 'italic 18px "IM Fell English", Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(233,220,182,0.9)';
    ctx.lineWidth = 5;
    ctx.strokeText(p.name, q.x, q.y + 6);
    ctx.fillStyle = INK;
    ctx.fillText(p.name, q.x, q.y + 6);
  }
}

function drawParchment(ctx, W, H, rng) {
  ctx.fillStyle = PARCHMENT;
  ctx.fillRect(0, 0, W, H);
  // moteado sutil
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(160,130,80,0.05)' : 'rgba(255,250,230,0.05)';
    const r = 1 + rng() * 3;
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // viñeta
  const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.55);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(90,65,30,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// El mar se pinta desde la máscara tierra/mar: se vuelca la rejilla a un canvas
// pequeño y se escala con suavizado; el trazo de costa por encima disimula el borde.
function drawSea(ctx, mask, px, S) {
  const off = document.createElement('canvas');
  off.width = mask.n;
  off.height = mask.n;
  const octx = off.getContext('2d');
  const img = octx.createImageData(mask.n, mask.n);
  for (let j = 0; j < mask.n; j++) {
    for (let i = 0; i < mask.n; i++) {
      if (mask.state[j * mask.n + i] !== 2) continue;
      const k = ((mask.n - 1 - j) * mask.n + i) * 4; // fila 0 del canvas = norte
      img.data[k] = 143; img.data[k + 1] = 180; img.data[k + 2] = 196; img.data[k + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  const tl = px({ x: -mask.extent, y: mask.extent });
  const side = 2 * mask.extent * S;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, tl.x, tl.y, side, side);
  ctx.restore();
}

function tracePoly(ctx, pts, px) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = px(p);
    i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
  });
}

function drawLakes(ctx, lakes, px) {
  for (const lake of lakes) {
    tracePoly(ctx, lake, px);
    ctx.closePath();
    ctx.fillStyle = WATER;
    ctx.fill();
    ctx.strokeStyle = WATER_DEEP;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawRivers(ctx, rivers, px) {
  ctx.strokeStyle = WATER_DEEP;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const r of rivers) {
    ctx.lineWidth = 2.2;
    tracePoly(ctx, r, px);
    ctx.stroke();
  }
}

// Las líneas de costa OSM llevan el agua a la derecha del sentido de dibujo:
// pintamos la línea y "olas" desplazadas hacia ese lado.
function drawCoastlines(ctx, coastlines, px) {
  for (const c of coastlines) {
    const pts = c.map(px);
    if (pts.length < 2) continue;

    // normales promediadas por punto (lado derecho de la dirección de avance)
    const normals = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: -dy / len, y: dx / len }; // derecha en coords de pantalla (y invertida)
    });

    for (let wave = 3; wave >= 0; wave--) {
      const off = wave * 7;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = { x: p.x + normals[i].x * off, y: p.y + normals[i].y * off };
        i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
      });
      if (wave === 0) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.4;
      } else {
        ctx.strokeStyle = `rgba(109,151,171,${0.55 - wave * 0.12})`;
        ctx.lineWidth = 1.4;
      }
      ctx.stroke();
    }
  }
}

function drawForests(ctx, forests, px, S, rng) {
  for (const f of forests) {
    if (polygonArea(f) < 30000) continue;
    tracePoly(ctx, f, px);
    ctx.closePath();
    ctx.fillStyle = 'rgba(168,180,131,0.4)';
    ctx.fill();

    // arbolitos dispersos dentro del polígono
    const bb = polygonBBox(f);
    const area = polygonArea(f);
    const n = Math.min(60, Math.max(4, Math.floor(area / 60000)));
    for (let i = 0; i < n; i++) {
      const p = { x: bb.minX + rng() * (bb.maxX - bb.minX), y: bb.minY + rng() * (bb.maxY - bb.minY) };
      if (!pointInPolygon(p, f)) continue;
      drawTree(ctx, px(p));
    }
  }
}

function drawTree(ctx, q) {
  ctx.strokeStyle = '#5d6b3f';
  ctx.fillStyle = FOREST;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(q.x, q.y - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(q.x, q.y);
  ctx.lineTo(q.x, q.y - 2);
  ctx.stroke();
}

function drawPeaks(ctx, peaks, px, rng) {
  // limita densidad: si hay cientos de picos, muestrea
  const sample = peaks.length > 120 ? peaks.filter(() => rng() < 120 / peaks.length) : peaks;
  for (const pk of sample) {
    const q = px(pk);
    const h = 10 + Math.min(10, (pk.ele || 300) / 250);
    ctx.beginPath();
    ctx.moveTo(q.x - h * 0.9, q.y);
    ctx.lineTo(q.x, q.y - h);
    ctx.lineTo(q.x + h * 0.9, q.y);
    ctx.closePath();
    ctx.fillStyle = PARCHMENT_DARK;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // sombra del flanco derecho
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - h);
    ctx.lineTo(q.x + h * 0.9, q.y);
    ctx.lineTo(q.x + h * 0.3, q.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(74,58,34,0.35)';
    ctx.fill();
  }
}

const GLYPH_SIZE = { ciudad: 26, pueblo: 17, aldea: 12, granja: 9 };

function drawSettlements(ctx, settlements, px, focus = null) {
  const hits = [];
  const order = ['granja', 'aldea', 'pueblo', 'ciudad'];
  const sorted = settlements.slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  for (const s of sorted) {
    const q = px(s);
    const size = GLYPH_SIZE[s.type];
    drawGlyph(ctx, s.type, q, size);
    // el núcleo enfocado no lleva etiqueta: su nombre está en la cartela y
    // taparía los marcadores de servicios
    if (s !== focus) drawLabel(ctx, s, q, size);
    hits.push({ x: q.x, y: q.y, r: size + 8, settlement: s });
  }
  return hits;
}

function house(ctx, x, y, w) {
  const h = w * 0.8;
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h, w, h);
  ctx.moveTo(x - w / 2 - 1, y - h);
  ctx.lineTo(x, y - h - w * 0.55);
  ctx.lineTo(x + w / 2 + 1, y - h);
  ctx.closePath();
  ctx.fillStyle = PARCHMENT_DARK;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function tower(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h, w, h);
  ctx.fillStyle = PARCHMENT_DARK;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // almenas
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h);
  ctx.lineTo(x - w / 2, y - h - 3);
  ctx.moveTo(x, y - h);
  ctx.lineTo(x, y - h - 3);
  ctx.moveTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y - h - 3);
  ctx.stroke();
}

function drawGlyph(ctx, type, q, size) {
  if (type === 'granja') {
    house(ctx, q.x, q.y + 3, size);
    ctx.strokeStyle = 'rgba(74,58,34,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(q.x + size * 0.8, q.y + 1 + i * 3);
      ctx.lineTo(q.x + size * 1.7, q.y + 1 + i * 3);
      ctx.stroke();
    }
  } else if (type === 'aldea') {
    house(ctx, q.x - size * 0.45, q.y + 4, size * 0.8);
    house(ctx, q.x + size * 0.5, q.y + 4, size * 0.9);
  } else if (type === 'pueblo') {
    house(ctx, q.x - size * 0.6, q.y + 5, size * 0.65);
    house(ctx, q.x + size * 0.55, q.y + 5, size * 0.7);
    tower(ctx, q.x, q.y + 5, size * 0.45, size * 1.1);
  } else {
    // ciudad: muralla con torres + torreón central
    ctx.beginPath();
    ctx.arc(q.x, q.y, size * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217,200,150,0.9)';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    tower(ctx, q.x - size * 0.55, q.y + size * 0.35, size * 0.3, size * 0.7);
    tower(ctx, q.x + size * 0.55, q.y + size * 0.35, size * 0.3, size * 0.7);
    tower(ctx, q.x, q.y + size * 0.5, size * 0.42, size * 1.15);
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - size * 0.65);
    ctx.lineTo(q.x, q.y - size * 0.95);
    ctx.lineTo(q.x + size * 0.32, q.y - size * 0.85);
    ctx.lineTo(q.x, q.y - size * 0.75);
    ctx.strokeStyle = '#7a2e1d';
    ctx.lineWidth = 1.6;
    ctx.stroke(); // banderín
  }
}

const LABEL_FONT = { ciudad: 'bold 25px "IM Fell English", Georgia', pueblo: '19px "IM Fell English", Georgia', aldea: 'italic 15px "IM Fell English", Georgia', granja: 'italic 12px "IM Fell English", Georgia' };

function drawLabel(ctx, s, q, size) {
  if (s.type === 'granja') return; // demasiado ruido; se ven en el panel lateral
  ctx.font = LABEL_FONT[s.type];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const y = q.y + size * 0.75 + 3;
  ctx.strokeStyle = 'rgba(233,220,182,0.85)';
  ctx.lineWidth = 4;
  ctx.strokeText(s.name, q.x, y);
  ctx.fillStyle = INK;
  ctx.fillText(s.name, q.x, y);
}

function drawBorder(ctx, cx, cy, R) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
  ctx.stroke();
  // marcas de grados
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r1 = R + 4, r2 = R + (i % 6 === 0 ? 14 : 9);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
}

function drawCompass(ctx, cx, cy, R) {
  const x = cx + R * 0.78, y = cy - R * 0.78;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 2);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 14px "IM Fell English", Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -32);
  ctx.restore();
}

function drawCartouche(ctx, W, title) {
  ctx.font = '30px "MedievalSharp", Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(title).width;
  const x = W / 2, y = 38;
  ctx.fillStyle = PARCHMENT;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  roundRect(ctx, x - tw / 2 - 22, y - 24, tw + 44, 48, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillText(title, x, y + 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawScaleBar(ctx, W, H, S, radiusM) {
  // longitud "bonita" adaptada al tamaño del mundo
  const options = [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];
  let lenM = options[0];
  for (const o of options) if (o <= radiusM / 2.5) lenM = o;
  const label = lenM >= 1000 ? `${lenM / 1000} ${lenM === 1000 ? 'legua' : 'leguas'} (${lenM / 1000} km)` : `${lenM} varas (${lenM} m)`;

  const len = lenM * S;
  const x = 40, y = H - 34;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.moveTo(x + len, y - 5);
  ctx.lineTo(x + len, y + 5);
  ctx.stroke();
  ctx.font = '13px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + len / 2, y - 10);
}
