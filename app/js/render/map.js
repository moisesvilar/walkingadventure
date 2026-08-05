// Pintado del mapa de fantasía en canvas.
// Convención: y en metros crece hacia el norte; en pantalla crece hacia abajo → se invierte.
// Ningún color ni grosor está fijado aquí: todo sale del estilo (app/js/render/styles.js), para
// poder repintar el mismo mundo con otra plantilla sin regenerarlo.

import { makeRng } from '../core/rng.js';
import { pointInPolygon, polygonBBox, polygonArea } from '../core/geo.js';
import { isSea } from '../world/seamask.js';
import { getStyle, DEFAULT_STYLE } from './styles.js';

// Tamaños de rótulo antes de aplicar la escala tipográfica del estilo.
const LABEL_SIZE = { ciudad: 25, pueblo: 19, aldea: 15, granja: 12, paraje: 13, servicio: 18, ruta: 16 };

/**
 * view (opcional): { cx, cy, r, focus, paraje } en metros — centro, radio
 * visible, núcleo enfocado o paraje enfocado. Sin view: mundo completo.
 * style: id de js/render/styles.js (o el objeto de estilo ya resuelto).
 * Devuelve hits [{x,y,r,settlement?|paraje?}] para detección de clics.
 */
export function renderMap(canvas, world, view = null, style = DEFAULT_STYLE) {
  const T = typeof style === 'string' ? getStyle(style) : style;
  const v = view ?? { cx: 0, cy: 0, r: world.radius, focus: null, paraje: null };
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const S = (W / 2 - T.margin) / v.r;
  const R = v.r * S;
  const box = T.shape === 'disc'
    ? { mode: 'disc', cx, cy, R, x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R }
    : { mode: 'rect', cx, cy, R, x0: T.margin, y0: T.margin, x1: W - T.margin, y1: H - T.margin };

  const px = (p) => ({ x: cx + (p.x - v.cx) * S, y: cy - (p.y - v.cy) * S });
  const rng = makeRng(world.seed + ':render');

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = T.outside;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  clipTo(ctx, box);

  const aMetros = (q) => ({ x: v.cx + (q.x - cx) / S, y: v.cy - (q.y - cy) / S });

  drawPaper(ctx, W, H, rng, T);
  if (T.land) drawLand(ctx, W, H, rng, T);
  if (T.compass.behind) drawCompass(ctx, box, T);

  // Sobre el agua no se pinta NADA. Dos medidas que se complementan: bosques y picos
  // descartan lo que cae en el mar según la máscara, y el mar se pinta DESPUÉS de ellos,
  // de modo que lo que se derrame por el borde queda tapado por el agua.
  if (T.capas.bosques) drawForests(ctx, world.geo.forests, px, rng, T, world.seaMask);
  if (T.capas.picos) drawPeaks(ctx, world.geo.peaks, px, rng, T, world.seaMask, aMetros);
  if (world.seaMask) drawSea(ctx, world.seaMask, px, S, T);

  if (T.capas.lagos) drawLakes(ctx, world.geo.lakes, px, T);
  drawRivers(ctx, world.geo.rivers, px, T);
  drawCoastlines(ctx, world.geo.coastlines, px, T);
  if (T.capas.carreteras) drawCarreteras(ctx, world.geo.roads, px, T);
  if (v.focus?.streets) drawStreets(ctx, v.focus.streets, px, T);
  drawRoutes(ctx, world.routes, px, T);

  const hits = [];
  drawParajes(ctx, world.parajes ?? [], px, v.paraje, hits, T);
  drawSettlements(ctx, world.settlements, px, v.focus, hits, T);
  if (v.focus) drawServiceMarkers(ctx, v.focus, px, T);
  if (v.quest) drawQuestOverlay(ctx, v.quest, px, T);

  drawVignette(ctx, W, H, box, T);
  ctx.restore();

  drawFrame(ctx, W, H, box, rng, T);
  if (!T.compass.behind) drawCompass(ctx, box, T);
  drawCartouche(ctx, W, H, box, v.focus ? v.focus.name : v.paraje ? v.paraje.name : world.title, T);
  drawScaleBar(ctx, box, S, v.r, T);

  return hits;
}

function clipTo(ctx, box) {
  ctx.beginPath();
  if (box.mode === 'disc') ctx.arc(box.cx, box.cy, box.R, 0, Math.PI * 2);
  else ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
}

// --- red viaria ---

function tracePolylineScreen(ctx, pts, px) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = px(p);
    i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
  });
}

// Red viaria real de OSM. No es lo mismo que las calzadas del juego (world.routes, que
// son las que unen núcleos y llevan nombre): esto es el trazado que existe de verdad, y
// pintarlo es lo que hace que el mapa sirva para caminar.
function drawCarreteras(ctx, roads, px, T) {
  if (!roads?.length || !T.carretera) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = T.carretera.color;
  for (const r of roads) {
    if (T.carretera.soloPrincipales && r.level !== 'principal') continue;
    ctx.lineWidth = r.level === 'principal' ? T.carretera.principal : T.carretera.pista;
    tracePolylineScreen(ctx, r.pts, px);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStreets(ctx, streets, px, T) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of streets) {
    tracePolylineScreen(ctx, st.pts, px);
    if (st.level === 'calle') {
      ctx.setLineDash([]);
      ctx.strokeStyle = T.street.major;
      ctx.lineWidth = 2.2;
    } else {
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = T.street.minor;
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawRoutes(ctx, routes, px, T) {
  if (!routes?.length) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const grosor = (r, w) => (r.ramal ? w * 0.62 : w);
  for (const r of routes) {
    if (r.fallback) continue;
    tracePolylineScreen(ctx, r.pts, px);
    ctx.strokeStyle = T.route.casing;
    ctx.lineWidth = grosor(r, T.route.casingW);
    ctx.stroke();
  }
  for (const r of routes) {
    if (r.fallback) continue;
    tracePolylineScreen(ctx, r.pts, px);
    ctx.strokeStyle = T.route.fill;
    ctx.lineWidth = grosor(r, T.route.fillW);
    ctx.stroke();
  }
  for (const r of routes) {
    if (!r.fallback) continue;
    tracePolylineScreen(ctx, r.pts, px);
    ctx.setLineDash([4, 9]);
    ctx.strokeStyle = T.route.fallback;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (T.capas.rotulosCamino) for (const r of routes) drawRouteLabel(ctx, r, px, T);
}

function drawRouteLabel(ctx, r, px, T) {
  if (!r.name) return; // los ramales de acceso no llevan nombre
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
      if (T.routeLabel.mode === 'ribbon') drawRibbon(ctx, r.name, 0, -14, T);
      else drawTextLabel(ctx, T, r.name, 0, -6, LABEL_SIZE.ruta, { baseline: 'bottom', rol: 'ruta' });
      ctx.restore();
      return;
    }
    acc += seg;
  }
}

// Filacteria: cinta de pergamino con los extremos plegados, para los nombres de calzada.
function drawRibbon(ctx, text, x, y, T) {
  ctx.save();
  ctx.font = labelFont(T, LABEL_SIZE.ruta);
  const w = ctx.measureText(text).width + 26;
  const h = 24;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.lineTo(x + w / 2 + 9, y);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2 - 9, y);
  ctx.closePath();
  ctx.fillStyle = T.cartouche.fill;
  ctx.fill();
  ctx.strokeStyle = T.inkSoft;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  drawTextLabel(ctx, T, text, x, y, LABEL_SIZE.ruta, { baseline: 'middle', halo: false });
}

// --- parajes ---

function drawParajes(ctx, parajes, px, focusParaje, hits, T) {
  for (const p of parajes) {
    const q = px(p);
    drawParajeGlyph(ctx, p.type, q, p === focusParaje, T);
    drawTextLabel(ctx, T, p.name, q.x, q.y + 12, LABEL_SIZE.paraje, { rol: 'paraje' });
    hits.push({ x: q.x, y: q.y, r: 16, paraje: p });
  }
}

function drawParajeGlyph(ctx, type, q, highlight, T) {
  if (T.glyph.mode === 'punto') {
    ctx.beginPath();
    ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = highlight ? T.accent : '#fff';
    ctx.fill();
    ctx.strokeStyle = T.glyph.fill;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    return;
  }
  ctx.save();
  ctx.strokeStyle = highlight ? T.accent : T.glyph.stroke;
  ctx.fillStyle = T.glyph.fill;
  ctx.lineWidth = highlight ? T.glyph.lw + 0.8 : T.glyph.lw + 0.2;
  const g = 9; // tamaño base

  if (type === 'ruina') {
    // torre partida con el remate en diagonal
    ctx.beginPath();
    ctx.moveTo(q.x - g * 0.5, q.y);
    ctx.lineTo(q.x - g * 0.5, q.y - g * 1.2);
    ctx.lineTo(q.x + g * 0.1, q.y - g * 0.8);
    ctx.lineTo(q.x + g * 0.5, q.y - g * 1.05);
    ctx.lineTo(q.x + g * 0.5, q.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'piedra') {
    // menhir
    ctx.beginPath();
    ctx.moveTo(q.x - g * 0.35, q.y);
    ctx.lineTo(q.x - g * 0.25, q.y - g * 1.1);
    ctx.lineTo(q.x + g * 0.25, q.y - g * 1.2);
    ctx.lineTo(q.x + g * 0.4, q.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'ermita') {
    // casita con cruz
    ctx.beginPath();
    ctx.rect(q.x - g * 0.5, q.y - g * 0.7, g, g * 0.7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.x - g * 0.6, q.y - g * 0.7);
    ctx.lineTo(q.x, q.y - g * 1.15);
    ctx.lineTo(q.x + g * 0.6, q.y - g * 0.7);
    ctx.closePath();
    ctx.fillStyle = T.glyph.roof ?? T.glyph.fill;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - g * 1.15);
    ctx.lineTo(q.x, q.y - g * 1.6);
    ctx.moveTo(q.x - g * 0.22, q.y - g * 1.42);
    ctx.lineTo(q.x + g * 0.22, q.y - g * 1.42);
    ctx.stroke();
  } else if (type === 'fuente') {
    // brocal con gota
    ctx.beginPath();
    ctx.arc(q.x, q.y - g * 0.4, g * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(q.x, q.y - g * 0.4, g * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = T.water.lakeLine;
    ctx.fill();
  } else if (type === 'atalaya') {
    // torre alta y estrecha con almenas
    ctx.beginPath();
    ctx.rect(q.x - g * 0.3, q.y - g * 1.5, g * 0.6, g * 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.x - g * 0.3, q.y - g * 1.5);
    ctx.lineTo(q.x - g * 0.3, q.y - g * 1.75);
    ctx.moveTo(q.x, q.y - g * 1.5);
    ctx.lineTo(q.x, q.y - g * 1.75);
    ctx.moveTo(q.x + g * 0.3, q.y - g * 1.5);
    ctx.lineTo(q.x + g * 0.3, q.y - g * 1.75);
    ctx.stroke();
  } else if (type === 'cruce') {
    // poste indicador con dos flechas
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x, q.y - g * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(q.x - g * 0.75, q.y - g * 1.45, g * 0.75, g * 0.38);
    ctx.rect(q.x, q.y - g * 0.95, g * 0.75, g * 0.38);
    ctx.fill();
    ctx.stroke();
  } else if (type === 'puente') {
    // arco de puente
    ctx.beginPath();
    ctx.moveTo(q.x - g * 0.9, q.y);
    ctx.quadraticCurveTo(q.x, q.y - g * 1.3, q.x + g * 0.9, q.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.x - g * 0.55, q.y);
    ctx.quadraticCurveTo(q.x, q.y - g * 0.7, q.x + g * 0.55, q.y);
    ctx.stroke();
  } else if (type === 'monasterio') {
    // nave con campanario y cruz
    ctx.beginPath();
    ctx.rect(q.x - g * 0.8, q.y - g * 0.6, g * 1.1, g * 0.6);
    ctx.rect(q.x + g * 0.3, q.y - g * 1.1, g * 0.5, g * 1.1);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.x + g * 0.55, q.y - g * 1.1);
    ctx.lineTo(q.x + g * 0.55, q.y - g * 1.45);
    ctx.moveTo(q.x + g * 0.38, q.y - g * 1.32);
    ctx.lineTo(q.x + g * 0.72, q.y - g * 1.32);
    ctx.stroke();
  }
  ctx.restore();
}

// --- lazo de quest (simulador de casting) ---

// Une los beats en orden con trazo punteado y numera cada parada.
function drawQuestOverlay(ctx, quest, px, T) {
  const pts = quest.beats.map((b) => px(b.lugar));

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([9, 7]);
  ctx.strokeStyle = T.accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  quest.beats.forEach((b, i) => {
    const q = pts[i];
    // el último beat suele volver al primero: desplaza su número para no taparlo
    const dup = quest.beats.findIndex((o) => o.lugar === b.lugar) !== i;
    const oy = dup ? 22 : 0;
    ctx.beginPath();
    ctx.arc(q.x + oy, q.y - oy, 11, 0, Math.PI * 2);
    ctx.fillStyle = T.accent;
    ctx.fill();
    ctx.strokeStyle = T.glyph.fill;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = T.glyph.fill;
    ctx.font = 'bold 13px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.n), q.x + oy, q.y - oy);
  });
  ctx.restore();
}

// --- servicios del núcleo enfocado ---

const SERVICE_LETTER = { posada: 'P', taberna: 'T', boticario: 'B', armeria: 'H', conjureria: 'C', mercado: 'M' };

function drawServiceMarkers(ctx, settlement, px, T) {
  for (const p of settlement.services) {
    if (p.x == null) continue;
    const q = px(p);

    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x, q.y - 18);
    ctx.strokeStyle = T.glyph.stroke;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(q.x, q.y - 30, 14, 0, Math.PI * 2);
    ctx.fillStyle = T.accent;
    ctx.fill();
    ctx.strokeStyle = T.glyph.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = T.glyph.fill;
    ctx.font = 'bold 15px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SERVICE_LETTER[p.kind] ?? '?', q.x, q.y - 29);

    ctx.beginPath();
    ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = T.glyph.stroke;
    ctx.fill();

    drawTextLabel(ctx, T, p.name, q.x, q.y + 6, LABEL_SIZE.servicio, { rol: 'servicio' });
  }
}

// --- rótulos ---

function labelFont(T, size, opts = {}) {
  const italic = opts.italic ?? T.label.italic;
  const weight = opts.weight ?? T.label.weight;
  return `${italic ? 'italic ' : ''}${weight ? weight + ' ' : ''}${Math.round(size * T.label.scale)}px ${opts.family ?? T.label.family}`;
}

function drawTextLabel(ctx, T, text, x, y, size, opts = {}) {
  const t = T.label.upper ? text.toUpperCase() : text;
  if (T.placa && opts.rol && T.label.placa.includes(opts.rol)) {
    drawPlacaLabel(ctx, T, t, x, y, size, opts);
    return;
  }
  ctx.save();
  ctx.font = labelFont(T, size, opts);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${T.label.tracking}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = opts.baseline ?? 'top';
  ctx.lineJoin = 'round';
  if (opts.halo !== false && T.label.haloW > 0) {
    ctx.strokeStyle = T.label.halo;
    ctx.lineWidth = T.label.haloW;
    for (let i = 0; i < T.label.haloPasadas; i++) ctx.strokeText(t, x, y);
  }
  ctx.fillStyle = opts.color ?? T.label.color;
  ctx.fillText(t, x, y);
  ctx.restore();
}

// Placa de pergamino: la cartela del título reducida al tamaño de un nombre.
// `x, y` mantienen el contrato de drawTextLabel —centro horizontal y el borde que
// diga `baseline`—, así que la caja cuelga del punto donde antes iba el texto.
function drawPlacaLabel(ctx, T, t, x, y, size, opts) {
  const P = T.placa;
  ctx.save();
  ctx.font = labelFont(T, size, opts);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${T.label.tracking}px`;
  // measureText incluye el tracking que sobra tras la última letra: descontarlo o
  // la caja sale descentrada hacia la derecha.
  const w = ctx.measureText(t).width - ('letterSpacing' in ctx ? T.label.tracking : 0);
  const h = Math.round(size * T.label.scale) + P.padY * 2;
  const bx = x - w / 2 - P.padX, bw = w + P.padX * 2;
  const baseline = opts.baseline ?? 'top';
  const by = baseline === 'bottom' ? y - h : baseline === 'middle' ? y - h / 2 : y;

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, h, P.radio);
  else ctx.rect(bx, by, bw, h);
  if (P.sombra) {
    ctx.shadowColor = P.sombra;
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1.5;
  }
  ctx.fillStyle = P.fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = P.border;
  ctx.lineWidth = P.lw;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.color ?? P.color ?? T.label.color;
  ctx.fillText(t, x, by + h / 2 + 0.5);
  ctx.restore();
}

// --- papel y terreno ---

function drawPaper(ctx, W, H, rng, T) {
  const p = T.paper;
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < p.grain.count; i++) {
    ctx.fillStyle = rng() < 0.5 ? p.grain.dark : p.grain.light;
    const r = 1 + rng() * p.grain.rMax;
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.blotches) {
    // manchas de humedad: racimo de círculos pequeños por mancha, para que el borde
    // salga irregular — una sola circunferencia grande se lee como un círculo, no como
    // una mancha
    ctx.fillStyle = p.blotches.color;
    for (let i = 0; i < p.blotches.count; i++) {
      const x = rng() * W, y = rng() * H, r = p.blotches.r * (0.5 + rng() * 0.8);
      for (let k = 0; k < 7; k++) {
        const a = rng() * Math.PI * 2, d = rng() * r * 0.8;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.4 + rng() * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// Tierra: color propio sobre el papel. Los estilos que no la declaran usan el papel
// como tierra (el pergamino clásico), y ahí el mar es lo único que se pinta.
function drawLand(ctx, W, H, rng, T) {
  ctx.fillStyle = T.land.fill;
  ctx.fillRect(0, 0, W, H);
  const st = T.land.stipple;
  if (!st) return;
  ctx.fillStyle = st.color;
  for (let i = 0; i < st.count; i++) {
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H, st.r * (0.4 + rng() * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVignette(ctx, W, H, box, T) {
  const vg = T.paper.vignette;
  if (!vg || vg.power <= 0) return;
  const rad = Math.hypot(W, H) / 2;
  const g = ctx.createRadialGradient(box.cx, box.cy, rad * vg.inner, box.cx, box.cy, rad * vg.outer);
  g.addColorStop(0, `rgba(${vg.color},0)`);
  g.addColorStop(1, `rgba(${vg.color},${vg.power})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Deja el mar limpio: sin motas ni islas sueltas. Dos pasadas.
 *
 * La máscara clasifica cada celda por el lado del segmento de costa más cercano, y cerca
 * de los extremos de un segmento ese signo puede mentir. Con colores planos, esas celdas
 * se ven como puntos y manchas verdes flotando en el azul. Primero un filtro de mayoría
 * quita el ruido de una celda, y después se descartan las manchas de tierra pequeñas
 * comparadas con el continente, que es lo que borra islotes y errores en bloque.
 *
 * Es una corrección SOLO de pintado: la máscara original no se toca, porque de ella
 * dependen la colocación de núcleos y el cálculo del radio del mundo.
 */
function despeca(mask) {
  const { n, state } = mask;
  const out = state.slice();
  for (let j = 1; j < n - 1; j++) {
    for (let i = 1; i < n - 1; i++) {
      let mar = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di || dj) mar += state[(j + dj) * n + i + di] === 2 ? 1 : 0;
        }
      }
      if (mar >= 6) out[j * n + i] = 2;
      else if (mar <= 2) out[j * n + i] = 1;
    }
  }

  // Manchas conexas, en los dos sentidos: las de tierra que no llegan al 4 % del
  // continente se hunden (islotes y errores en bloque) y las de mar que no llegan al 4 %
  // del océano se rellenan (charcos azules tierra adentro que no conectan con la costa).
  // Una ría de verdad sobrevive porque está conectada al mar abierto.
  const barre = (esDelTipo, convertirEn) => {
    const comp = new Int32Array(n * n).fill(-1);
    const tam = [];
    for (let k0 = 0; k0 < n * n; k0++) {
      if (!esDelTipo(out[k0]) || comp[k0] >= 0) continue;
      const id = tam.length;
      const pila = [k0];
      comp[k0] = id;
      let cuenta = 0;
      while (pila.length) {
        const k = pila.pop();
        cuenta++;
        const i = k % n, j = (k - i) / n;
        const vecinos = [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, j > 0 ? k - n : -1, j < n - 1 ? k + n : -1];
        for (const v of vecinos) {
          if (v >= 0 && esDelTipo(out[v]) && comp[v] < 0) { comp[v] = id; pila.push(v); }
        }
      }
      tam.push(cuenta);
    }
    const mayor = Math.max(0, ...tam);
    for (let k = 0; k < n * n; k++) {
      if (comp[k] >= 0 && tam[comp[k]] < mayor * 0.04) out[k] = convertirEn;
    }
  };
  barre((s) => s !== 2, 2); // tierra suelta → mar
  barre((s) => s === 2, 1); // mar aislado → tierra
  return out;
}

// El mar se pinta desde la máscara: rejilla → canvas pequeño → escalado suavizado.
function drawSea(ctx, mask, px, S, T) {
  const off = document.createElement('canvas');
  off.width = mask.n;
  off.height = mask.n;
  const octx = off.getContext('2d');
  const img = octx.createImageData(mask.n, mask.n);
  const [wr, wg, wb] = T.water.rgb;
  const state = despeca(mask);
  for (let j = 0; j < mask.n; j++) {
    for (let i = 0; i < mask.n; i++) {
      if (state[j * mask.n + i] !== 2) continue;
      const k = ((mask.n - 1 - j) * mask.n + i) * 4; // fila 0 del canvas = norte
      img.data[k] = wr; img.data[k + 1] = wg; img.data[k + 2] = wb; img.data[k + 3] = T.water.alpha;
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

function drawLakes(ctx, lakes, px, T) {
  for (const lake of lakes) {
    tracePoly(ctx, lake, px);
    ctx.closePath();
    ctx.fillStyle = T.water.lake;
    ctx.fill();
    ctx.strokeStyle = T.water.lakeLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawRivers(ctx, rivers, px, T) {
  ctx.strokeStyle = T.water.river;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const r of rivers) {
    // solo los cauces principales: los regatos (`stream`) llenan el mapa de hilos azules
    if (T.capas.soloRiosPrincipales && r.kind && r.kind !== 'river') continue;
    ctx.lineWidth = T.water.riverW;
    tracePoly(ctx, r, px);
    ctx.stroke();
  }
}

// Costa OSM: agua a la derecha del sentido de dibujo → olas/halos hacia ese lado.
function drawCoastlines(ctx, coastlines, px, T) {
  const c0 = T.coast;
  for (const c of coastlines) {
    const pts = c.map(px);
    if (pts.length < 2) continue;
    // Islotes: el relleno de tierra ya los descarta al limpiar la máscara, pero su línea
    // de costa seguía dibujándose y quedaban manchas oscuras flotando en el azul. Se mide
    // en píxeles de pantalla a propósito: lo que molesta es lo que se ve pequeño.
    if (c0.islaMin) {
      const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      const cerrada = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 10;
      if (cerrada && Math.max(w, h) < c0.islaMin) continue;
    }

    const normals = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: -dy / len, y: dx / len }; // derecha en coords de pantalla (y invertida)
    });

    const stroke = (off, style, width) => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = { x: p.x + normals[i].x * off, y: p.y + normals[i].y * off };
        i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
      });
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    if (c0.mode === 'halos') {
      // anillos concéntricos que se separan al alejarse: el mar "respira" desde la orilla
      for (let k = c0.n; k >= 1; k--) stroke(k * c0.gap * (1 + k * 0.35), `rgba(${c0.wave},${(c0.waveAlpha * (1 - k / (c0.n + 1))).toFixed(3)})`, 1.2);
      stroke(0, c0.line, c0.lineW);
    } else if (c0.mode === 'waves') {
      for (let k = c0.n - 1; k >= 1; k--) stroke(k * c0.gap, `rgba(${c0.wave},${(c0.waveAlpha - k * 0.12).toFixed(3)})`, 1.4);
      stroke(0, c0.line, c0.lineW);
    } else if (c0.mode === 'line') {
      stroke(c0.gap, `rgba(${c0.wave},${c0.waveAlpha})`, 3);
      stroke(0, c0.line, c0.lineW);
    } else {
      stroke(0, c0.line, c0.lineW);
    }
  }
}

function drawForests(ctx, forests, px, rng, T, mask) {
  for (const f of forests) {
    if (polygonArea(f) < 30000) continue;
    // nada se dibuja sobre el agua: los bosques que caen en el mar son islas que la
    // máscara no distingue, y flotando en el azul se ven como manchas verdes sueltas
    const bb0 = polygonBBox(f);
    if (isSea(mask, { x: (bb0.minX + bb0.maxX) / 2, y: (bb0.minY + bb0.maxY) / 2 })) continue;
    tracePoly(ctx, f, px);
    ctx.closePath();
    ctx.fillStyle = T.forest.fill;
    ctx.fill();

    const bb = polygonBBox(f);
    const area = polygonArea(f);
    const n = Math.min(T.forest.max, Math.max(4, Math.floor(area / T.forest.density)));
    for (let i = 0; i < n; i++) {
      const p = { x: bb.minX + rng() * (bb.maxX - bb.minX), y: bb.minY + rng() * (bb.maxY - bb.minY) };
      if (!pointInPolygon(p, f) || isSea(mask, p)) continue;
      drawTree(ctx, px(p), rng, T);
    }
  }
}

function drawTree(ctx, q, rng, T) {
  const F = T.forest;
  const s = F.size * (0.85 + rng() * 0.3);
  ctx.lineWidth = 1;
  ctx.strokeStyle = F.stroke;

  if (F.tree === 'leafy') {
    // copa frondosa de tres lóbulos, con una luz arriba: aire de ilustración a mano
    ctx.fillStyle = F.crown;
    ctx.beginPath();
    ctx.arc(q.x - s * 0.55, q.y - s * 0.7, s * 0.7, 0, Math.PI * 2);
    ctx.arc(q.x + s * 0.55, q.y - s * 0.7, s * 0.7, 0, Math.PI * 2);
    ctx.arc(q.x, q.y - s * 1.3, s * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = F.crown2;
    ctx.beginPath();
    ctx.arc(q.x - s * 0.15, q.y - s * 1.5, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x, q.y - s * 0.6);
    ctx.stroke();
  } else if (F.tree === 'conifer') {
    // abeto de trazo fino: eje vertical y ramas cortas descendentes
    ctx.fillStyle = F.crown;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - s * 2.1);
    ctx.lineTo(q.x + s * 0.6, q.y);
    ctx.lineTo(q.x - s * 0.6, q.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (F.tree === 'canopy') {
    // masa compacta de copa: relleno oscuro y remate claro, para bosques densos
    ctx.fillStyle = F.crown;
    ctx.beginPath();
    ctx.ellipse(q.x, q.y - s * 0.9, s * 1.05, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = F.crown2;
    ctx.beginPath();
    ctx.ellipse(q.x - s * 0.25, q.y - s * 1.15, s * 0.5, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = F.crown;
    ctx.beginPath();
    ctx.arc(q.x, q.y - s, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x, q.y - s * 0.5);
    ctx.stroke();
  }
}

function drawPeaks(ctx, peaks, px, rng, T, mask, aMetros) {
  const enTierra = peaks.filter((pk) => !isSea(mask, pk));
  const sample = enTierra.length > 120 ? enTierra.filter(() => rng() < 120 / enTierra.length) : enTierra;
  const P = T.peak;

  if (P.mode === 'sierra') return drawSierras(ctx, sample, px, rng, P, mask, aMetros);

  for (const pk of sample) {
    const q = px(pk);
    const h = 10 + Math.min(10, (pk.ele || 300) / 250);
    const w = h * 0.9;

    if (P.mode === 'range') {
      // loma redondeada en vez de pico: el estilo de cuento no tiene aristas
      ctx.beginPath();
      ctx.moveTo(q.x - w * 1.15, q.y);
      ctx.quadraticCurveTo(q.x - w * 0.5, q.y - h * 1.15, q.x + w * 0.1, q.y);
      ctx.quadraticCurveTo(q.x + w * 0.55, q.y - h * 0.85, q.x + w * 1.2, q.y);
      ctx.closePath();
      ctx.fillStyle = P.fill;
      ctx.fill();
      ctx.strokeStyle = P.stroke;
      ctx.lineWidth = P.lw;
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(q.x - w, q.y);
    ctx.lineTo(q.x, q.y - h);
    ctx.lineTo(q.x + w, q.y);
    ctx.closePath();
    ctx.fillStyle = P.fill;
    ctx.fill();
    ctx.strokeStyle = P.stroke;
    ctx.lineWidth = P.lw;
    ctx.stroke();

    if (P.mode === 'hatch') {
      // ladera sombreada a rayas, como en el grabado antiguo
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - h);
      ctx.lineTo(q.x + w, q.y);
      ctx.lineTo(q.x + w * 0.15, q.y);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = P.shade;
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(q.x + w * 0.1 * i, q.y - h);
        ctx.lineTo(q.x + w * 0.1 * i + w * 0.5, q.y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (P.mode !== 'soft') {
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - h);
      ctx.lineTo(q.x + w, q.y);
      ctx.lineTo(q.x + w * 0.3, q.y);
      ctx.closePath();
      ctx.fillStyle = P.shade;
      ctx.fill();
    }
  }
}

// Sierras al modo del mapa ilustrado (ref. b03241c5). La unidad de dibujo NO es el pico:
// es la sierra entera. Un pico suelto de OSM pintado como un triangulito se lee como un
// pegote sobre la hierba; lo que hace "montaña" en la referencia es un macizo de muchas
// cumbres solapadas, las de atrás más altas y las de delante tapándoles la base.
// Por eso los picos se agrupan por cercanía, cada grupo se puebla con cumbres satélite y
// el conjunto se pinta de atrás hacia delante.

// Agrupación por enlace simple: dos picos caen en la misma sierra si hay una cadena de
// picos entre ellos con saltos menores que `join`. Determinista: el orden de entrada ya
// viene ordenado y el recorrido es en anchura.
function clusterPeaks(pts, join) {
  const seen = new Array(pts.length).fill(false);
  const groups = [];
  for (let i = 0; i < pts.length; i++) {
    if (seen[i]) continue;
    const group = [pts[i]];
    seen[i] = true;
    for (let g = 0; g < group.length; g++) {
      for (let k = 0; k < pts.length; k++) {
        if (seen[k]) continue;
        if (Math.hypot(pts[k].x - group[g].x, pts[k].y - group[g].y) <= join) {
          seen[k] = true;
          group.push(pts[k]);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

// Esqueleto de la sierra: árbol de recubrimiento mínimo entre los picos del grupo (Prim).
// Es lo que convierte un puñado de cumbres sueltas en una cordillera: las cumbres de
// relleno se siembran a lo largo de estas aristas, no alrededor de cada pico por separado.
function ridgeEdges(nodes, maxLen) {
  if (nodes.length < 2) return [];
  const inTree = [0];
  const rest = nodes.map((_, i) => i).slice(1);
  const edges = [];
  while (rest.length) {
    let best = null;
    for (const a of inTree) {
      for (let ri = 0; ri < rest.length; ri++) {
        const b = rest[ri];
        const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
        if (!best || d < best.d) best = { a, b, ri, d };
      }
    }
    if (best.d <= maxLen) edges.push([nodes[best.a], nodes[best.b], best.d]);
    inTree.push(best.b);
    rest.splice(best.ri, 1);
  }
  return edges;
}

function drawSierras(ctx, peaks, px, rng, P, mask, aMetros) {
  const pts = peaks
    .map((pk) => ({ ...px(pk), ele: pk.ele || 300 }))
    .sort((a, b) => a.x - b.x || a.y - b.y); // orden estable antes de agrupar
  if (!pts.length) return;

  const groups = clusterPeaks(pts, P.join);
  // cuantos más picos reales, menos satélites por pico: la sierra se densifica sola
  const sat = pts.length > 60 ? 2 : pts.length > 25 ? 3 : 4;
  const ancho = 0.52;

  for (const group of groups) {
    const cones = [];
    const cumbres = group.map((p) => ({ x: p.x, y: p.y, h: P.h0 + Math.min(P.hMax, p.ele / P.hDiv) }));

    for (const p of cumbres) {
      const w = p.h * ancho;
      cones.push({ x: p.x, y: p.y, h: p.h });
      // satélites pegados al pico real: dos a los lados, a distancia de solape, y los
      // demás por delante y más bajos, que es lo que tapa las bases y convierte el
      // montón de cumbres en una sierra
      for (let s = 0; s < sat; s++) {
        const side = s % 2 ? 1 : -1;
        const front = s >= 2;
        cones.push({
          x: p.x + side * w * (0.58 + rng() * 0.42) + (front ? (rng() - 0.5) * w : 0),
          y: p.y + (front ? p.h * (0.14 + rng() * 0.18) : (rng() - 0.5) * p.h * 0.12),
          h: p.h * (front ? 0.48 + rng() * 0.22 : 0.62 + rng() * 0.3),
        });
      }
    }

    // cordal: cumbres encadenadas de pico a pico, bajando hacia el collado del medio
    for (const [a, b, d] of ridgeEdges(cumbres, P.join)) {
      const w = ((a.h + b.h) / 2) * ancho;
      const steps = Math.max(2, Math.round(d / (w * 1.15)));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const collado = 0.52 + 0.3 * Math.abs(2 * t - 1); // hunde el centro del tramo
        const cx0 = a.x + (b.x - a.x) * t + (rng() - 0.5) * w * 0.7;
        const cy0 = a.y + (b.y - a.y) * t + (rng() - 0.5) * w * 0.5;
        const ch = (a.h * (1 - t) + b.h * t) * collado * (0.85 + rng() * 0.3);
        cones.push({ x: cx0, y: cy0, h: ch });
        // segunda fila por delante en tramos alternos: da grosor a la sierra, que si no
        // sale en fila india
        if (i % 2) cones.push({ x: cx0 + (rng() - 0.5) * w * 1.2, y: cy0 + ch * (0.16 + rng() * 0.16), h: ch * (0.55 + rng() * 0.25) });
      }
    }

    // perspectiva: las cumbres del fondo (norte) más altas, las del frente más bajas,
    // y se pintan en ese orden para que las de delante tapen la base de las de detrás
    const ys = cones.map((c) => c.y);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (const c of cones) c.h *= 1.18 - 0.4 * ((c.y - y0) / (y1 - y0 || 1));
    cones.sort((a, b) => a.y - b.y);
    for (const c of cones) {
      // los satélites y el cordal se siembran a ciegas alrededor de los picos reales:
      // si a alguno le toca caer en el mar, no se pinta
      if (mask && aMetros && isSea(mask, aMetros(c))) continue;
      drawCone(ctx, c.x, c.y, c.h, rng, P);
    }
  }
}

// Una cumbre: perfil quebrado y afilado, cara al sol casi blanca, cara en sombra gris,
// arista entintada y aristas secundarias en abanico. El contorno recorre solo el perfil:
// cerrarlo por la base dibujaría una raya horizontal que delata el recorte.
function drawCone(ctx, x, y, h, rng, P) {
  // si hay cumbres dibujadas, se usa una variante elegida por el rng (determinista);
  // la composición de la sierra la sigue calculando el código
  const w = h * 0.52; // afilada: en la referencia son más altas que anchas
  const j = (a) => (rng() - 0.5) * a;
  const apex = { x: x + j(w * 0.3), y: y - h };

  const profile = [
    { x: x - w, y },
    { x: x - w * (0.74 + j(0.14)), y: y - h * 0.3 },
    { x: x - w * (0.46 + j(0.12)), y: y - h * 0.62 },
    { x: x - w * 0.18, y: y - h * 0.88 },
    apex,
    { x: apex.x + w * 0.2, y: y - h * 0.86 },
    { x: x + w * (0.44 + j(0.12)), y: y - h * 0.58 },
    { x: x + w * (0.72 + j(0.14)), y: y - h * 0.26 },
    { x: x + w, y },
  ];

  const trace = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  };

  trace(profile);
  ctx.closePath();
  ctx.fillStyle = P.snow;
  ctx.fill();

  ctx.save();
  ctx.clip();

  // cara en sombra, a la derecha de la arista
  const ridge = [apex, { x: apex.x + w * 0.16, y: y - h * 0.55 }, { x: apex.x + w * 0.06, y: y - h * 0.26 }, { x: apex.x + w * 0.24, y }];
  trace([...ridge, { x: x + w * 3, y }, { x: x + w * 3, y: y - h * 2 }]);
  ctx.closePath();
  ctx.fillStyle = P.fill;
  ctx.fill();

  // roca al pie: la nieve no llega abajo del todo, y el borde sube y baja en dientes
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x - w * 1.1 + t * w * 2.2, y: y - h * (i % 2 ? 0.24 : 0.11) - j(h * 0.05) });
  }
  trace([...pts, { x: x + w * 1.2, y: y + h }, { x: x - w * 1.2, y: y + h }]);
  ctx.closePath();
  ctx.fillStyle = P.shade;
  ctx.fill();

  // aristas secundarias: abanico corto desde la cima
  ctx.strokeStyle = P.line ?? P.stroke;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) / 1.5;
    ctx.beginPath();
    ctx.moveTo(apex.x + spread * w * 0.05, apex.y + h * 0.06);
    ctx.quadraticCurveTo(apex.x + spread * w * 0.45, y - h * 0.5, apex.x + spread * w * 0.9, y - h * (0.12 + rng() * 0.2));
    ctx.stroke();
  }
  ctx.strokeStyle = P.stroke;
  ctx.lineWidth = P.lw * 0.65;
  trace(ridge);
  ctx.stroke();
  ctx.restore();

  trace(profile);
  ctx.strokeStyle = P.stroke;
  ctx.lineWidth = P.lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

// --- núcleos ---

const GLYPH_SIZE = { ciudad: 26, pueblo: 17, aldea: 12, granja: 9 };

function drawSettlements(ctx, settlements, px, focus, hits, T) {
  const order = ['granja', 'aldea', 'pueblo', 'ciudad'];
  const sorted = settlements.slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  for (const s of sorted) {
    const q = px(s);
    const size = GLYPH_SIZE[s.type];
    drawGlyph(ctx, s.type, q, size, T);
    // el núcleo enfocado no lleva etiqueta: su nombre está en la cartela y
    // taparía los marcadores de servicios
    if (s !== focus) drawLabel(ctx, s, q, size, T);
    hits.push({ x: q.x, y: q.y, r: size + 8, settlement: s });
  }
}

function house(ctx, x, y, w, T) {
  const h = w * 0.8;
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h, w, h);
  ctx.fillStyle = T.glyph.fill;
  ctx.fill();
  ctx.strokeStyle = T.glyph.stroke;
  ctx.lineWidth = T.glyph.lw;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 1, y - h);
  ctx.lineTo(x, y - h - w * 0.55);
  ctx.lineTo(x + w / 2 + 1, y - h);
  ctx.closePath();
  ctx.fillStyle = T.glyph.roof ?? T.glyph.fill;
  ctx.fill();
  ctx.stroke();
}

function tower(ctx, x, y, w, h, T) {
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h, w, h);
  ctx.fillStyle = T.glyph.fill;
  ctx.fill();
  ctx.strokeStyle = T.glyph.stroke;
  ctx.lineWidth = T.glyph.lw;
  ctx.stroke();
  if (T.glyph.tower) {
    // chapitel en color: los estilos ilustrados rematan las torres en punta
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 1.5, y - h);
    ctx.lineTo(x, y - h - w * 1.1);
    ctx.lineTo(x + w / 2 + 1.5, y - h);
    ctx.closePath();
    ctx.fillStyle = T.glyph.tower;
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h);
    ctx.lineTo(x - w / 2, y - h - 3);
    ctx.moveTo(x, y - h);
    ctx.lineTo(x, y - h - 3);
    ctx.moveTo(x + w / 2, y - h);
    ctx.lineTo(x + w / 2, y - h - 3);
    ctx.stroke();
  }
}

const PUNTO = { ciudad: 11, pueblo: 8, aldea: 6, granja: 4 };

function drawGlyph(ctx, type, q, size, T) {
  // marcador provisional: punto rojo, del tamaño del rango del núcleo
  if (T.glyph.mode === 'punto') {
    ctx.beginPath();
    ctx.arc(q.x, q.y, PUNTO[type], 0, Math.PI * 2);
    ctx.fillStyle = T.glyph.fill;
    ctx.fill();
    ctx.strokeStyle = T.glyph.stroke;
    ctx.lineWidth = T.glyph.lw;
    ctx.stroke();
    return;
  }
  if (type === 'granja') {
    house(ctx, q.x, q.y + 3, size, T);
    ctx.strokeStyle = T.inkSoft;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(q.x + size * 0.8, q.y + 1 + i * 3);
      ctx.lineTo(q.x + size * 1.7, q.y + 1 + i * 3);
      ctx.stroke();
    }
  } else if (type === 'aldea') {
    house(ctx, q.x - size * 0.45, q.y + 4, size * 0.8, T);
    house(ctx, q.x + size * 0.5, q.y + 4, size * 0.9, T);
  } else if (type === 'pueblo') {
    house(ctx, q.x - size * 0.6, q.y + 5, size * 0.65, T);
    house(ctx, q.x + size * 0.55, q.y + 5, size * 0.7, T);
    tower(ctx, q.x, q.y + 5, size * 0.45, size * 1.1, T);
  } else {
    // ciudad: muralla con torres + torreón central + banderín
    ctx.beginPath();
    ctx.arc(q.x, q.y, size * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = T.glyph.wall;
    ctx.fill();
    ctx.strokeStyle = T.glyph.stroke;
    ctx.lineWidth = T.glyph.lw + 0.6;
    ctx.stroke();
    tower(ctx, q.x - size * 0.55, q.y + size * 0.35, size * 0.3, size * 0.7, T);
    tower(ctx, q.x + size * 0.55, q.y + size * 0.35, size * 0.3, size * 0.7, T);
    tower(ctx, q.x, q.y + size * 0.5, size * 0.42, size * 1.15, T);
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - size * 0.65);
    ctx.lineTo(q.x, q.y - size * 0.95);
    ctx.lineTo(q.x + size * 0.32, q.y - size * 0.85);
    ctx.lineTo(q.x, q.y - size * 0.75);
    ctx.strokeStyle = T.accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

const LABEL_OPTS = {
  ciudad: { weight: 'bold', italic: false },
  pueblo: { italic: false },
  aldea: {},
  granja: {},
};

function drawLabel(ctx, s, q, size, T) {
  if (s.type === 'granja') return; // demasiado ruido; se ven en el panel lateral
  drawTextLabel(ctx, T, s.name, q.x, q.y + size * 0.75 + 3, LABEL_SIZE[s.type], { ...LABEL_OPTS[s.type], rol: 'nucleo' });
}

// --- marco ---

function drawFrame(ctx, W, H, box, rng, T) {
  const color = T.frame.color ?? T.ink;
  if (T.frame.mode === 'none') return;
  if (box.mode === 'disc') return drawDiscFrame(ctx, box, color);

  const { x0, y0, x1, y1 } = box;
  ctx.save();
  if (T.frame.mode === 'vine') drawVineFrame(ctx, box, rng, T, color);
  else if (T.frame.mode === 'ornate') drawOrnateFrame(ctx, box, T);
  else {
    // 'double' / 'ticks': banda gruesa exterior y filete interior
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + 9, y0 + 9, x1 - x0 - 18, y1 - y0 - 18);
    if (T.frame.mode === 'double') {
      // cuadraditos en las esquinas: remate de carta antigua
      ctx.fillStyle = color;
      for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) ctx.fillRect(x - 7, y - 7, 14, 14);
    }
  }
  ctx.restore();
}

function drawDiscFrame(ctx, box, color) {
  const { cx, cy, R } = box;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r1 = R + 4, r2 = R + (i % 6 === 0 ? 14 : 9);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
}

// Zarza en flor recorriendo el marco: hojas alternadas y flores de cinco pétalos.
function drawVineFrame(ctx, box, rng, T, color) {
  const { x0, y0, x1, y1 } = box;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x0 - 16, y0 - 16, x1 - x0 + 32, y1 - y0 + 32);

  // recorrido del rectángulo intermedio, punto a punto
  const m = 8;
  const path = [];
  const step = 13;
  const segs = [
    [x0 - m, y0 - m, x1 + m, y0 - m], [x1 + m, y0 - m, x1 + m, y1 + m],
    [x1 + m, y1 + m, x0 - m, y1 + m], [x0 - m, y1 + m, x0 - m, y0 - m],
  ];
  for (const [ax, ay, bx, by] of segs) {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.floor(len / step);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      path.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx: (by - ay) / len, ny: -(bx - ax) / len });
    }
  }

  path.forEach((p, i) => {
    const side = i % 2 ? 1 : -1;
    const ox = p.nx * side * 7, oy = p.ny * side * 7;
    if (i % 7 === 3) {
      // flor
      ctx.fillStyle = T.accent;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(p.x + ox + Math.cos(a) * 3.4, p.y + oy + Math.sin(a) * 3.4, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = T.cartouche.fill;
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // hoja
      ctx.fillStyle = '#6f8a45';
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy, 6.5, 3.2, Math.atan2(p.ny * side, p.nx * side), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  });
}

// Marco dorado: banda gruesa, filete interior y rombos en las esquinas.
function drawOrnateFrame(ctx, box, T) {
  const { x0, y0, x1, y1 } = box;
  ctx.strokeStyle = T.frame.color;
  ctx.lineWidth = 14;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = T.frame.gold;
  ctx.lineWidth = 5;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = T.frame.color;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24);

  const diamond = (x, y, r) => {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = T.frame.gold;
    ctx.fill();
    ctx.strokeStyle = T.frame.color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  };
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) diamond(x, y, 13);
  for (let i = 1; i < 8; i++) {
    diamond(x0 + ((x1 - x0) * i) / 8, y0, 6);
    diamond(x0 + ((x1 - x0) * i) / 8, y1, 6);
    diamond(x0, y0 + ((y1 - y0) * i) / 8, 6);
    diamond(x1, y0 + ((y1 - y0) * i) / 8, 6);
  }
}

// --- brújula ---

function compassCenter(box, T) {
  const inset = box.mode === 'disc' ? box.R * 0.78 : 0;
  if (box.mode === 'disc') {
    const dx = T.compass.corner.includes('e') ? inset : -inset;
    const dy = T.compass.corner.startsWith('n') ? -inset : inset;
    return { x: box.cx + dx, y: box.cy + dy };
  }
  const pad = 74 * T.compass.scale;
  return {
    x: T.compass.corner.includes('e') ? box.x1 - pad : box.x0 + pad,
    y: T.compass.corner.startsWith('n') ? box.y0 + pad : box.y1 - pad,
  };
}

function drawCompass(ctx, box, T) {
  if (T.compass.mode === 'none') return; // capa de terreno sola, para el experimento de ráster
  const { x, y } = compassCenter(box, T);
  const color = T.compass.color ?? T.ink;
  const k = T.compass.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  if (T.compass.mode === 'rose' || T.compass.mode === 'thin') {
    const R = 26 * k;
    const thin = T.compass.mode === 'thin';
    ctx.lineWidth = thin ? 1 : 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const long = i % 2 === 0;
      const r = long ? R * (thin ? 2.4 : 1.5) : R * (thin ? 1.5 : 0.95);
      const w = long ? R * 0.17 : R * 0.11;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w);
      ctx.lineTo(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w);
      ctx.closePath();
      if (thin) ctx.stroke();
      else {
        ctx.fillStyle = i % 4 === 0 ? color : T.cartouche.fill;
        ctx.fill();
        ctx.stroke();
      }
    }
    if (T.compass.letters) {
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(16 * k)}px ${T.cartouche.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const d = R * 1.85;
      ctx.fillText('N', 0, -d);
      ctx.fillText('S', 0, d);
      ctx.fillText('E', d, 0);
      ctx.fillText('O', -d, 0);
    }
  } else if (T.compass.mode === 'star') {
    // estrella sencilla de cuatro puntas, dibujada como a mano
    const R = 30 * k;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.lineTo(Math.cos(a + Math.PI / 2) * R * 0.22, Math.sin(a + Math.PI / 2) * R * 0.22);
      ctx.lineTo(Math.cos(a - Math.PI / 2) * R * 0.22, Math.sin(a - Math.PI / 2) * R * 0.22);
      ctx.closePath();
      ctx.fillStyle = i === 0 ? T.accent : T.cartouche.fill;
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.font = `${Math.round(20 * k)}px ${T.cartouche.family}`;
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -R - 8);
  } else {
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
  }
  ctx.restore();
}

// --- cartela ---

function drawCartouche(ctx, W, H, box, title, T) {
  const C = T.cartouche;
  if (C.mode === 'none') return;
  const x = W / 2;
  const y = C.pos === 'bottom' ? box.y1 - 46 : box.y0 + 42;

  ctx.save();
  ctx.font = `${C.size}px ${C.family}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${C.tracking}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = T.label.upper ? title.toUpperCase() : title;
  const tw = ctx.measureText(text).width;
  const color = C.color ?? T.ink;
  const border = C.border ?? T.ink;
  const h = C.size + 20;

  if (C.mode === 'plain') {
    ctx.strokeStyle = T.paper.base;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  } else if (C.mode === 'banner') {
    // banderola con los extremos en cola de golondrina
    const w = tw + 70;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath();
    ctx.fillStyle = C.fill;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + (s * w) / 2, y - h / 2);
      ctx.lineTo(x + s * (w / 2 + 30), y - h / 2 - 7);
      ctx.lineTo(x + s * (w / 2 + 16), y);
      ctx.lineTo(x + s * (w / 2 + 30), y + h / 2 + 7);
      ctx.lineTo(x + (s * w) / 2, y + h / 2);
      ctx.closePath();
      ctx.fillStyle = C.fill;
      ctx.fill();
      ctx.stroke();
    }
  } else if (C.mode === 'scroll') {
    // pergamino enrollado por los lados
    const w = tw + 56;
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
    ctx.fillStyle = C.fill;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    roundRect(ctx, x - w / 2 + 7, y - h / 2 + 6, w - 14, h - 12, 3);
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * (w / 2 + 9), y, h / 2, 0, Math.PI * 2);
      ctx.fillStyle = C.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * (w / 2 + 9), y, h / 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = C.fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    roundRect(ctx, x - tw / 2 - 22, y - 24, tw + 44, 48, 8);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 2);
  ctx.restore();
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

function drawScaleBar(ctx, box, S, radiusM, T) {
  if (T.escala === false) return; // capa de terreno sola
  const options = [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];
  let lenM = options[0];
  for (const o of options) if (o <= radiusM / 2.5) lenM = o;
  const label = lenM >= 1000 ? `${lenM / 1000} ${lenM === 1000 ? 'legua' : 'leguas'} (${lenM / 1000} km)` : `${lenM} varas (${lenM} m)`;

  const len = lenM * S;
  // la escala se va a la esquina inferior libre: si la brújula ocupa la izquierda, a la derecha
  const right = T.compass.corner === 'sw' && box.mode !== 'disc';
  const x = box.mode === 'disc' ? 40 : right ? box.x1 - 28 - len : box.x0 + 28;
  const y = box.mode === 'disc' ? box.y1 + 40 : box.y1 - 26;
  ctx.save();
  ctx.strokeStyle = T.ink;
  ctx.fillStyle = T.ink;
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
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = T.label.halo;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeText(label, x + len / 2, y - 10);
  ctx.fillText(label, x + len / 2, y - 10);
  ctx.restore();
}
