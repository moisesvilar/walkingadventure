// Componer una escena: de documento de celda + estilo + vista a una lista ordenada
// de primitivas con el color, el grosor y la tipografía **ya resueltos**. Aquí vive
// toda la geometría del pintado y toda la consulta al estilo; el módulo que ejecuta
// el dibujo (`app/render/skia.js`) no vuelve a mirar ni una clave de estilo.
// Esa partición es lo que hace verificable «ningún color vive en el código de
// dibujo» sin simulador, y lo que deja entrar al colocador de rótulos por un
// argumento.

import { makeRng } from '../core/rng.js';
import { pointInPolygon, polygonBBox, polygonArea } from '../core/geo.js';
import { isSea } from '../world/seamask.js';
import { ESTILO_POR_DEFECTO, ESTILOS, resuelveEstilo } from './estilos.js';

/**
 * El sufijo con el que se siembra el azar del pintado —grano del papel, siembra de
 * árboles, zarza del marco—. Va aparte de `SUFIJOS_DE_FASE` a propósito: el render
 * no es una fase de la tubería y no genera nada, solo repinta lo congelado.
 */
export const SUFIJO_DE_RENDER = ':render';

/** Tamaños de rótulo por rol, antes de la escala tipográfica del estilo y del factor de letra. */
export const TAMANO_DE_ROTULO = Object.freeze({ ciudad: 25, pueblo: 19, aldea: 15, granja: 12, paraje: 13, servicio: 18, ruta: 16 });

/** Tamaño del glifo de núcleo por tipo, en px. */
const TAMANO_DE_GLIFO = { ciudad: 26, pueblo: 17, aldea: 12, granja: 9 };

/** Radio del punto de núcleo cuando el estilo pinta marcadores y no casitas. */
const RADIO_DE_PUNTO = { ciudad: 11, pueblo: 8, aldea: 6, granja: 4 };

/** Variaciones tipográficas por tipo de núcleo, como en el prototipo. */
const VARIANTE_DE_ROTULO = { ciudad: { weight: 'bold', italic: false }, pueblo: { italic: false }, aldea: {}, granja: {} };

/** La letra que lleva el marcador de cada servicio. */
const LETRA_DE_SERVICIO = { posada: 'P', taberna: 'T', boticario: 'B', armeria: 'H', conjureria: 'C', mercado: 'M' };

/** Tamaño de la letra del marcador de servicio y del número de parada. */
const TAMANO_DE_LETRA_DE_MARCADOR = 15;

/** Tamaño de la leyenda de la barra de escala, que solo se pinta en la revisión. */
const TAMANO_DE_LEYENDA_DE_ESCALA = 13;

// El verde de la hoja de la zarza. El prototipo lo lleva escrito dentro del dibujo
// y es el único color que no sale del estilo; al portar se queda aquí, que es donde
// se resuelve la pintura, en lugar de colarse en el código que ejecuta el trazo.
const VERDE_DE_HOJA = '#6f8a45';

/**
 * El plan de capas, en orden. Es dato y no código de recorrido: la revisión de
 * paridad tiene una casilla por fila, y la fila 17 se reserva vacía para el
 * entintado por nivel de conocimiento que entrega la fila 36.
 */
export const PLAN_DE_CAPAS = Object.freeze([
  'fuera', 'papel', 'tierra', 'brujula-detras', 'bosques', 'picos', 'mar', 'lagos', 'rios',
  'costa', 'carreteras', 'callejero', 'calzadas', 'glifos-paraje', 'glifos-nucleo',
  'marcadores-servicio', 'entintado', 'rotulos', 'vinneteo', 'marco', 'brujula-delante',
  'cartela', 'escala',
].map((nombre, i) => Object.freeze({ n: i + 1, nombre })));

const INDICE_DE_CAPA = new Map(PLAN_DE_CAPAS.map((capa) => [capa.nombre, capa.n]));

// --- pintura ----------------------------------------------------------------

const PINTURA_VACIA = { relleno: null, trazo: null, grosor: 0, alfa: 1, discontinuo: null, remate: 'butt', union: 'miter', sombra: null };

/** Una pintura completa: el ejecutor no rellena huecos, así que se rellenan aquí. */
function pinta(campos) {
  return { ...PINTURA_VACIA, ...campos };
}

/** La pintura de un texto, con su tipografía resuelta. */
function pintaTexto({ color, familia, tamano, italica = false, peso = '', tracking = 0, halo = null }) {
  return { relleno: color, familia, tamano, italica, peso, tracking, halo };
}

/**
 * Mide un texto con el medidor inyectado y falla nombrando la tipografía si no
 * sabe medirla, en lugar de colocar con una medida inventada.
 */
function mide(medidor, texto, tipografia, donde) {
  let medida;
  try {
    medida = medidor(texto, tipografia);
  } catch (error) {
    throw new Error(`componeEscena: el medidor no sabe medir la tipografía "${tipografia.familia}" (${donde}): ${error.message}`);
  }
  if (!medida || !Number.isFinite(medida.ancho) || !Number.isFinite(medida.alto)) {
    throw new Error(`componeEscena: el medidor no devolvió una medida para la tipografía "${tipografia.familia}" (${donde})`);
  }
  const ascenso = Number.isFinite(medida.ascenso) ? medida.ascenso : medida.alto * 0.8;
  const descenso = Number.isFinite(medida.descenso) ? medida.descenso : medida.alto * 0.2;
  return { ancho: medida.ancho, alto: medida.alto, ascenso, descenso };
}

/**
 * Una primitiva de texto con la posición **ya resuelta**: `x` es el borde
 * izquierdo y `y` la línea base. El módulo que dibuja no calcula ni una posición
 * de rótulo; se limita a poner el texto donde se le dice.
 */
function primitivaDeTexto({ texto, x, y, base, pintura, medida }) {
  const linea = base === 'middle'
    ? y + (medida.ascenso - medida.descenso) / 2
    : base === 'bottom' ? y - medida.descenso : y + medida.ascenso;
  return { tipo: 'texto', texto, x: x - medida.ancho / 2, y: linea, ancho: medida.ancho, pintura };
}

// --- validación del documento -----------------------------------------------

function exige(valor, campo, capa) {
  if (valor === undefined || valor === null) {
    throw new Error(`componeEscena: la capa "${capa}" necesita el campo "${campo}" y el documento de celda no lo trae`);
  }
  return valor;
}

function exigeLista(valor, campo, capa) {
  exige(valor, campo, capa);
  if (!Array.isArray(valor)) throw new Error(`componeEscena: el campo "${campo}" que necesita la capa "${capa}" no es una lista`);
  return valor;
}

// --- geometría del encuadre --------------------------------------------------

function encuadre(estilo, vista, tamano) {
  const { ancho: W, alto: H } = tamano;
  const cx = W / 2;
  const cy = H / 2;
  const escala = (W / 2 - estilo.margin) / vista.r;
  const R = vista.r * escala;
  const caja = estilo.shape === 'disc'
    ? { modo: 'disc', cx, cy, R, x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R }
    : { modo: 'rect', cx, cy, R, x0: estilo.margin, y0: estilo.margin, x1: W - estilo.margin, y1: H - estilo.margin };
  return { W, H, cx, cy, escala, caja };
}

// --- la composición -----------------------------------------------------------

/**
 * Compone la escena de un documento de celda.
 *
 * No ejecuta ninguna fase de generación, no pide nada a la red y no toca la
 * partida: el render pinta lo congelado. Dos entradas se inyectan, con el mismo
 * patrón que `fetchData` en `buildWorld`:
 *
 * @param {object} opciones
 *   `documento` el mundo congelado de la celda; `estilo` el identificador o el
 *   objeto ya resuelto; `catalogo` contra el que se resuelve; `vista`
 *   `{ cx, cy, r, foco, paraje, escala }` en metros; `tamano` `{ ancho, alto }` de
 *   la superficie; `medidor(texto, tipografia) → { ancho, alto }`;
 *   `colocador(rotulos, contexto) → [{ id, x, y }]`; `factorTexto` el ajuste de
 *   tamaño de letra, con «mediana» valiendo 1.
 */
export function componeEscena({
  documento,
  estilo: estiloPedido = ESTILO_POR_DEFECTO,
  catalogo = ESTILOS,
  vista = null,
  tamano,
  medidor,
  colocador,
  factorTexto = 1,
}) {
  if (!documento || typeof documento !== 'object') throw new Error('componeEscena necesita el documento de celda');
  if (!tamano || !Number.isFinite(tamano.ancho) || !Number.isFinite(tamano.alto)) {
    throw new Error('componeEscena necesita el tamaño de la superficie: { ancho, alto } en px');
  }
  if (typeof medidor !== 'function') throw new Error('componeEscena necesita que se le inyecte medidor(texto, tipografia) → { ancho, alto }');
  if (typeof colocador !== 'function') throw new Error('componeEscena necesita que se le inyecte colocador(rotulos, contexto) → [{ id, x, y }]');
  if (!Number.isFinite(factorTexto) || factorTexto <= 0) throw new Error(`componeEscena: el factor de tamaño de letra tiene que ser un número positivo; llegó ${factorTexto}`);

  const { estilo, sustitucion } = resuelveEstilo(estiloPedido, catalogo);

  // Una superficie sin área no se pinta y no falla: es lo que ocurre entre que la
  // pantalla se monta y el gestor de ventanas le da tamaño.
  if (tamano.ancho <= 0 || tamano.alto <= 0) {
    return Object.freeze({
      version: 1, estilo: estilo.id, sustitucion, tamano: { ...tamano }, vista: null,
      primitivas: Object.freeze([]), rotulos: Object.freeze([]), capas: PLAN_DE_CAPAS, vacia: true,
    });
  }

  const semilla = exige(documento.seed, 'seed', 'papel');
  const v = vista ?? { cx: 0, cy: 0, r: exige(documento.radius, 'radius', 'fuera'), foco: null, paraje: null, escala: false };
  if (!Number.isFinite(v.r) || v.r <= 0) throw new Error(`componeEscena: la vista tiene que traer un radio positivo en metros; llegó ${v.r}`);

  const marco = encuadre(estilo, v, tamano);
  const { W, H, cx, cy, escala, caja } = marco;
  const px = (p) => ({ x: cx + (p.x - v.cx) * escala, y: cy - (p.y - v.cy) * escala });
  const rng = makeRng(semilla + SUFIJO_DE_RENDER);

  const primitivas = [];
  let capaActual = null;
  const capa = (nombre) => { capaActual = nombre; };
  const mete = (primitiva) => {
    primitiva.capa = capaActual;
    primitiva.n = INDICE_DE_CAPA.get(capaActual);
    primitivas.push(primitiva);
    return primitiva;
  };

  const rect = (x, y, ancho, alto, pintura) => mete({ tipo: 'rect', x, y, ancho, alto, pintura });
  const circulo = (x, y, r, pintura) => mete({ tipo: 'circulo', cx: x, cy: y, r, pintura });
  const elipse = (x, y, rx, ry, rot, pintura) => mete({ tipo: 'elipse', cx: x, cy: y, rx, ry, rot, pintura });
  const camino = (ops, pintura) => mete({ tipo: 'camino', ops, pintura });
  const guarda = () => mete({ tipo: 'guarda' });
  const restaura = () => mete({ tipo: 'restaura' });
  const recorta = (forma) => mete({ tipo: 'recorta', forma });
  const transforma = (tx, ty, rot) => mete({ tipo: 'transforma', tx, ty, rot });

  const texto = ({ texto: cadena, x, y, base, pintura, medida = null, donde = 'texto de la lámina' }) => mete(primitivaDeTexto({
    texto: cadena, x, y, base, pintura,
    medida: medida ?? mide(medidor, cadena, pintura, donde),
  }));

  const linea = (puntos, pintura, cerrada = false) => {
    const ops = [];
    puntos.forEach((p, i) => ops.push(i === 0 ? ['M', p.x, p.y] : ['L', p.x, p.y]));
    if (cerrada) ops.push(['Z']);
    return camino(ops, pintura);
  };
  const lineaEnMetros = (puntos, pintura, cerrada = false) => linea(puntos.map(px), pintura, cerrada);

  // ── 1 · fuera del área y recorte ────────────────────────────────────────────
  capa('fuera');
  rect(0, 0, W, H, pinta({ relleno: estilo.outside }));
  guarda();
  recorta(caja.modo === 'disc' ? { tipo: 'circulo', cx: caja.cx, cy: caja.cy, r: caja.R } : { tipo: 'rect', x: caja.x0, y: caja.y0, ancho: caja.x1 - caja.x0, alto: caja.y1 - caja.y0 });

  // ── 2 · papel ───────────────────────────────────────────────────────────────
  capa('papel');
  const papel = estilo.paper;
  rect(0, 0, W, H, pinta({ relleno: papel.base }));
  for (let i = 0; i < papel.grain.count; i++) {
    const color = rng() < 0.5 ? papel.grain.dark : papel.grain.light;
    const r = 1 + rng() * papel.grain.rMax;
    circulo(rng() * W, rng() * H, r, pinta({ relleno: color }));
  }
  if (papel.blotches) {
    // Racimo de círculos pequeños por mancha: una circunferencia grande se lee como
    // un círculo y no como una mancha de humedad.
    for (let i = 0; i < papel.blotches.count; i++) {
      const x = rng() * W, y = rng() * H, r = papel.blotches.r * (0.5 + rng() * 0.8);
      for (let k = 0; k < 7; k++) {
        const a = rng() * Math.PI * 2, d = rng() * r * 0.8;
        circulo(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.4 + rng() * 0.5), pinta({ relleno: papel.blotches.color }));
      }
    }
  }

  // ── 3 · tierra ──────────────────────────────────────────────────────────────
  capa('tierra');
  if (estilo.land) {
    rect(0, 0, W, H, pinta({ relleno: estilo.land.fill }));
    const st = estilo.land.stipple;
    if (st) for (let i = 0; i < st.count; i++) circulo(rng() * W, rng() * H, st.r * (0.4 + rng() * 0.8), pinta({ relleno: st.color }));
  }

  // ── 4 · brújula detrás ──────────────────────────────────────────────────────
  capa('brujula-detras');
  if (estilo.compass.behind) componeBrujula({ estilo, caja, texto, camino, circulo, guarda, restaura, transforma });

  const geo = exige(documento.geo, 'geo', 'bosques');
  const mascara = documento.seaMask ?? null;

  // Sobre el agua no se pinta NADA. Dos medidas que se complementan: bosques y
  // picos descartan lo que cae en el mar según la máscara, y el mar se pinta
  // DESPUÉS de ellos, de modo que lo que se derrame por el borde queda tapado.

  // ── 5 · bosques ─────────────────────────────────────────────────────────────
  capa('bosques');
  if (estilo.capas.bosques) {
    for (const { pts: bosque } of exigeLista(geo.forests, 'geo.forests', 'bosques')) {
      if (polygonArea(bosque) < 30000) continue;
      const bb0 = polygonBBox(bosque);
      if (isSea(mascara, { x: (bb0.minX + bb0.maxX) / 2, y: (bb0.minY + bb0.maxY) / 2 })) continue;
      lineaEnMetros(bosque, pinta({ relleno: estilo.forest.fill }), true);

      const bb = polygonBBox(bosque);
      const area = polygonArea(bosque);
      const cuantos = Math.min(estilo.forest.max, Math.max(4, Math.floor(area / estilo.forest.density)));
      for (let i = 0; i < cuantos; i++) {
        const p = { x: bb.minX + rng() * (bb.maxX - bb.minX), y: bb.minY + rng() * (bb.maxY - bb.minY) };
        if (!pointInPolygon(p, bosque) || isSea(mascara, p)) continue;
        componeArbol(px(p), rng, estilo, { camino, circulo, elipse });
      }
    }
  }

  // ── 6 · picos y sierras ─────────────────────────────────────────────────────
  capa('picos');
  if (estilo.capas.picos) {
    const picos = exigeLista(geo.peaks, 'geo.peaks', 'picos');
    const enTierra = picos.filter((pk) => !isSea(mascara, pk));
    const muestra = enTierra.length > 120 ? enTierra.filter(() => rng() < 120 / enTierra.length) : enTierra;
    for (const pk of muestra) componePico(px(pk), pk.ele || 300, estilo.peak, { camino, guarda, restaura, recorta });
  }

  // ── 7 · mar desde la máscara ────────────────────────────────────────────────
  capa('mar');
  if (mascara) {
    const esquina = px({ x: -mascara.extent, y: mascara.extent });
    const lado = 2 * mascara.extent * escala;
    mete({ tipo: 'trama', n: mascara.n, pixeles: tramaDelMar(mascara, estilo.water), x: esquina.x, y: esquina.y, ancho: lado, alto: lado });
  }

  // ── 8 · lagos ───────────────────────────────────────────────────────────────
  capa('lagos');
  if (estilo.capas.lagos) {
    for (const { pts: lago } of exigeLista(geo.lakes, 'geo.lakes', 'lagos')) {
      lineaEnMetros(lago, pinta({ relleno: estilo.water.lake, trazo: estilo.water.lakeLine, grosor: 1.5 }), true);
    }
  }

  // ── 9 · ríos ────────────────────────────────────────────────────────────────
  capa('rios');
  for (const rio of exigeLista(geo.rivers, 'geo.rivers', 'rios')) {
    // Solo los cauces principales cuando el estilo lo pide: los regatos llenan el
    // mapa de hilos azules.
    if (estilo.capas.soloRiosPrincipales && rio.kind && rio.kind !== 'river') continue;
    lineaEnMetros(rio.pts, pinta({ trazo: estilo.water.river, grosor: estilo.water.riverW, remate: 'round', union: 'round' }));
  }

  // ── 10 · costa ──────────────────────────────────────────────────────────────
  capa('costa');
  componeCosta(exigeLista(geo.coastlines, 'geo.coastlines', 'costa'), px, estilo.coast, linea);

  // ── 11 · carreteras reales ──────────────────────────────────────────────────
  capa('carreteras');
  if (estilo.capas.carreteras && estilo.carretera) {
    for (const via of exigeLista(geo.roads, 'geo.roads', 'carreteras')) {
      if (estilo.carretera.soloPrincipales && via.level !== 'principal') continue;
      const grosor = via.level === 'principal' ? estilo.carretera.principal : estilo.carretera.pista;
      lineaEnMetros(via.pts, pinta({ trazo: estilo.carretera.color, grosor, remate: 'round', union: 'round' }));
    }
  }

  // ── 12 · callejero del núcleo enfocado ──────────────────────────────────────
  capa('callejero');
  if (v.foco?.streets) {
    for (const calle of v.foco.streets) {
      const esCalle = calle.level === 'calle';
      lineaEnMetros(calle.pts, pinta({
        trazo: esCalle ? estilo.street.major : estilo.street.minor,
        grosor: esCalle ? 2.2 : 1.5,
        discontinuo: esCalle ? null : [5, 6],
        remate: 'round',
        union: 'round',
      }));
    }
  }

  // ── 13 · calzadas y ramales ─────────────────────────────────────────────────
  capa('calzadas');
  const rotulos = [];
  const calzadas = exigeLista(documento.routes, 'routes', 'calzadas');
  const grosorDeRamal = (r, w) => (r.ramal ? w * 0.62 : w);
  for (const r of calzadas) {
    if (r.fallback) continue;
    lineaEnMetros(r.pts, pinta({ trazo: estilo.route.casing, grosor: grosorDeRamal(r, estilo.route.casingW), remate: 'round', union: 'round' }));
  }
  for (const r of calzadas) {
    if (r.fallback) continue;
    lineaEnMetros(r.pts, pinta({ trazo: estilo.route.fill, grosor: grosorDeRamal(r, estilo.route.fillW), remate: 'round', union: 'round' }));
  }
  for (const r of calzadas) {
    if (!r.fallback) continue;
    lineaEnMetros(r.pts, pinta({ trazo: estilo.route.fallback, grosor: 2, discontinuo: [4, 9], remate: 'round', union: 'round' }));
  }
  if (estilo.capas.rotulosCamino) {
    calzadas.forEach((r, i) => {
      const sitio = sitioDelRotuloDeCalzada(r, px);
      if (!sitio) return;
      rotulos.push({ id: `ruta:${i}`, rol: 'ruta', texto: r.name, ancla: sitio.punto, rotacion: sitio.angulo, tamano: TAMANO_DE_ROTULO.ruta, base: 'bottom', dy: -6 });
    });
  }

  // ── 14 · glifos de paraje ───────────────────────────────────────────────────
  capa('glifos-paraje');
  const parajes = exigeLista(documento.parajes, 'parajes', 'glifos-paraje');
  parajes.forEach((p, i) => {
    const q = px(p);
    componeGlifoDeParaje(p.type, q, p === v.paraje, estilo, { camino, circulo });
    rotulos.push({ id: `paraje:${i}`, rol: 'paraje', texto: p.name, ancla: { x: q.x, y: q.y + 12 }, rotacion: 0, tamano: TAMANO_DE_ROTULO.paraje, base: 'top', dy: 0 });
  });

  // ── 15 · glifos de núcleo ───────────────────────────────────────────────────
  capa('glifos-nucleo');
  const orden = ['granja', 'aldea', 'pueblo', 'ciudad'];
  const nucleos = exigeLista(documento.settlements, 'settlements', 'glifos-nucleo')
    .map((s, i) => ({ s, i }))
    .sort((a, b) => orden.indexOf(a.s.type) - orden.indexOf(b.s.type) || a.i - b.i);
  for (const { s, i } of nucleos) {
    const q = px(s);
    const medida = TAMANO_DE_GLIFO[s.type];
    componeGlifoDeNucleo(s.type, q, medida, estilo, { camino, circulo });
    // El núcleo enfocado no lleva rótulo: su nombre está en la cartela y taparía
    // los marcadores de servicio. Las granjas tampoco: son demasiado ruido.
    if (s !== v.foco && s.type !== 'granja') {
      rotulos.push({
        id: `nucleo:${i}`, rol: 'nucleo', texto: s.name,
        ancla: { x: q.x, y: q.y + medida * 0.75 + 3 }, rotacion: 0,
        tamano: TAMANO_DE_ROTULO[s.type], base: 'top', dy: 0, variante: VARIANTE_DE_ROTULO[s.type],
      });
    }
  }

  // ── 16 · marcadores de servicio ─────────────────────────────────────────────
  capa('marcadores-servicio');
  if (v.foco) {
    (v.foco.services ?? []).forEach((p, i) => {
      if (p.x == null) return;
      const q = px(p);
      camino([['M', q.x, q.y], ['L', q.x, q.y - 18]], pinta({ trazo: estilo.glyph.stroke, grosor: 2.4 }));
      circulo(q.x, q.y - 30, 14, pinta({ relleno: estilo.accent, trazo: estilo.glyph.stroke, grosor: 2 }));
      texto({
        texto: LETRA_DE_SERVICIO[p.kind] ?? '?', x: q.x, y: q.y - 29, base: 'middle', donde: 'la letra del marcador de servicio',
        pintura: pintaTexto({ color: estilo.glyph.fill, familia: estilo.cartouche.family, tamano: TAMANO_DE_LETRA_DE_MARCADOR, peso: 'bold' }),
      });
      circulo(q.x, q.y, 3.5, pinta({ relleno: estilo.glyph.stroke }));
      rotulos.push({ id: `servicio:${i}`, rol: 'servicio', texto: p.name, ancla: { x: q.x, y: q.y + 6 }, rotacion: 0, tamano: TAMANO_DE_ROTULO.servicio, base: 'top', dy: 0 });
    });
  }

  // ── 17 · entintado por nivel de conocimiento ────────────────────────────────
  // Reservada vacía a propósito: cuando la fila 36 entregue las tres tintas, añade
  // aquí su capa y sus claves de estilo en lugar de reabrir el orden.
  capa('entintado');

  // ── 18 · rótulos, todos, en una sola pasada ─────────────────────────────────
  capa('rotulos');
  const colocados = colocaRotulos({ rotulos, estilo, factorTexto, medidor, colocador, tamano, caja });
  for (const rotulo of colocados) componeRotulo(rotulo, estilo, { texto, camino, guarda, restaura, transforma });

  // ── 19 · viñeteo ────────────────────────────────────────────────────────────
  capa('vinneteo');
  const vg = estilo.paper.vignette;
  if (vg && vg.power > 0) {
    const radio = Math.hypot(W, H) / 2;
    mete({
      tipo: 'degradadoRadial', x: 0, y: 0, ancho: W, alto: H,
      cx: caja.cx, cy: caja.cy, r0: radio * vg.inner, r1: radio * vg.outer,
      paradas: [{ t: 0, color: `rgba(${vg.color},0)` }, { t: 1, color: `rgba(${vg.color},${vg.power})` }],
    });
  }
  restaura();

  // ── 20 · marco ──────────────────────────────────────────────────────────────
  capa('marco');
  componeMarco({ estilo, caja, camino, rect, circulo, elipse });

  // ── 21 · brújula delante ────────────────────────────────────────────────────
  capa('brujula-delante');
  if (!estilo.compass.behind) componeBrujula({ estilo, caja, texto, camino, circulo, guarda, restaura, transforma });

  // ── 22 · cartela ────────────────────────────────────────────────────────────
  capa('cartela');
  const titulo = v.foco ? v.foco.name : v.paraje ? v.paraje.name : exige(documento.title, 'title', 'cartela');
  componeCartela({ estilo, caja, W, titulo, medidor, texto, camino });

  // ── 23 · barra de escala ────────────────────────────────────────────────────
  // Apagada en todas las pantallas del juego: una cifra de distancia en pantalla
  // está prohibida por el sistema de diseño. Solo la pide la pantalla de revisión.
  capa('escala');
  if (estilo.escala && v.escala === true) componeEscalaCartografica({ estilo, caja, escala, radioM: v.r, camino, texto });

  return Object.freeze({
    version: 1,
    estilo: estilo.id,
    sustitucion,
    documentoId: documento.seed,
    tamano: { ancho: W, alto: H },
    vista: { cx: v.cx, cy: v.cy, r: v.r, escala: v.escala === true },
    factorTexto,
    capas: PLAN_DE_CAPAS,
    rotulos: Object.freeze(colocados.map((r) => Object.freeze({ id: r.id, rol: r.rol, texto: r.texto, x: r.x, y: r.y, caja: r.medida }))),
    primitivas: Object.freeze(primitivas),
    vacia: false,
  });
}

// --- el mar -------------------------------------------------------------------

/**
 * Deja el mar limpio: sin motas ni islas sueltas. Corrección **solo de pintado**;
 * la máscara original no se toca, porque de ella dependen la colocación de núcleos
 * y el radio del mundo.
 */
function despeca(mascara) {
  const { n, state } = mascara;
  const salida = state.slice();
  for (let j = 1; j < n - 1; j++) {
    for (let i = 1; i < n - 1; i++) {
      let mar = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) if (di || dj) mar += state[(j + dj) * n + i + di] === 2 ? 1 : 0;
      }
      if (mar >= 6) salida[j * n + i] = 2;
      else if (mar <= 2) salida[j * n + i] = 1;
    }
  }

  // Manchas conexas en los dos sentidos: la tierra que no llega al 4 % del
  // continente se hunde y el mar aislado que no llega al 4 % del océano se rellena.
  // Una ría de verdad sobrevive porque conecta con el mar abierto.
  const barre = (esDelTipo, convertirEn) => {
    const comp = new Int32Array(n * n).fill(-1);
    const tam = [];
    for (let k0 = 0; k0 < n * n; k0++) {
      if (!esDelTipo(salida[k0]) || comp[k0] >= 0) continue;
      const id = tam.length;
      const pila = [k0];
      comp[k0] = id;
      let cuenta = 0;
      while (pila.length) {
        const k = pila.pop();
        cuenta++;
        const i = k % n, j = (k - i) / n;
        const vecinos = [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, j > 0 ? k - n : -1, j < n - 1 ? k + n : -1];
        for (const vecino of vecinos) {
          if (vecino >= 0 && esDelTipo(salida[vecino]) && comp[vecino] < 0) { comp[vecino] = id; pila.push(vecino); }
        }
      }
      tam.push(cuenta);
    }
    const mayor = Math.max(0, ...tam);
    for (let k = 0; k < n * n; k++) if (comp[k] >= 0 && tam[comp[k]] < mayor * 0.04) salida[k] = convertirEn;
  };
  barre((s) => s !== 2, 2);
  barre((s) => s === 2, 1);
  return salida;
}

/** El mar como trama RGBA, fila 0 al norte, con el color y la opacidad ya resueltos. */
function tramaDelMar(mascara, agua) {
  const n = mascara.n;
  const pixeles = new Uint8ClampedArray(n * n * 4);
  const [r, g, b] = agua.rgb;
  const estado = despeca(mascara);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (estado[j * n + i] !== 2) continue;
      const k = ((n - 1 - j) * n + i) * 4;
      pixeles[k] = r; pixeles[k + 1] = g; pixeles[k + 2] = b; pixeles[k + 3] = agua.alpha;
    }
  }
  return pixeles;
}

// --- costa ---------------------------------------------------------------------

// Costa de OSM: el agua queda a la derecha del sentido de dibujo, así que las olas
// y los halos salen hacia ese lado.
function componeCosta(costas, px, c0, linea) {
  for (const costa of costas) {
    const pts = costa.pts.map(px);
    if (pts.length < 2) continue;
    // Islotes: el relleno ya los descarta al limpiar la máscara, pero su línea
    // seguía dibujándose y quedaban manchas oscuras flotando en el azul. Se mide en
    // píxeles a propósito: lo que molesta es lo que se ve pequeño.
    if (c0.islaMin) {
      const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
      const ancho = Math.max(...xs) - Math.min(...xs), alto = Math.max(...ys) - Math.min(...ys);
      const cerrada = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 10;
      if (cerrada && Math.max(ancho, alto) < c0.islaMin) continue;
    }

    const normales = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const largo = Math.hypot(dx, dy) || 1;
      return { x: -dy / largo, y: dx / largo };
    });

    const traza = (desplazamiento, color, grosor) => {
      const puntos = pts.map((p, i) => ({ x: p.x + normales[i].x * desplazamiento, y: p.y + normales[i].y * desplazamiento }));
      linea(puntos, pinta({ trazo: color, grosor }));
    };

    if (c0.mode === 'halos') {
      // Anillos concéntricos que se separan al alejarse: el mar «respira».
      for (let k = c0.n; k >= 1; k--) traza(k * c0.gap * (1 + k * 0.35), `rgba(${c0.wave},${(c0.waveAlpha * (1 - k / (c0.n + 1))).toFixed(3)})`, 1.2);
      traza(0, c0.line, c0.lineW);
    } else if (c0.mode === 'waves') {
      for (let k = c0.n - 1; k >= 1; k--) traza(k * c0.gap, `rgba(${c0.wave},${(c0.waveAlpha - k * 0.12).toFixed(3)})`, 1.4);
      traza(0, c0.line, c0.lineW);
    } else if (c0.mode === 'line') {
      traza(c0.gap, `rgba(${c0.wave},${c0.waveAlpha})`, 3);
      traza(0, c0.line, c0.lineW);
    } else {
      traza(0, c0.line, c0.lineW);
    }
  }
}

// --- bosques y picos -----------------------------------------------------------

function componeArbol(q, rng, estilo, { camino, circulo, elipse }) {
  const F = estilo.forest;
  const s = F.size * (0.85 + rng() * 0.3);
  const contorno = pinta({ relleno: F.crown, trazo: F.stroke, grosor: 1 });
  const tronco = pinta({ trazo: F.stroke, grosor: 1 });

  if (F.tree === 'leafy') {
    // Copa frondosa de tres lóbulos con una luz arriba: aire de ilustración a mano.
    camino([
      ['C', q.x - s * 0.55, q.y - s * 0.7, s * 0.7],
      ['C', q.x + s * 0.55, q.y - s * 0.7, s * 0.7],
      ['C', q.x, q.y - s * 1.3, s * 0.85],
    ], contorno);
    circulo(q.x - s * 0.15, q.y - s * 1.5, s * 0.42, pinta({ relleno: F.crown2 }));
    camino([['M', q.x, q.y], ['L', q.x, q.y - s * 0.6]], tronco);
  } else if (F.tree === 'conifer') {
    camino([['M', q.x, q.y - s * 2.1], ['L', q.x + s * 0.6, q.y], ['L', q.x - s * 0.6, q.y], ['Z']], contorno);
  } else if (F.tree === 'canopy') {
    elipse(q.x, q.y - s * 0.9, s * 1.05, s * 0.85, 0, contorno);
    elipse(q.x - s * 0.25, q.y - s * 1.15, s * 0.5, s * 0.38, 0, pinta({ relleno: F.crown2 }));
  } else {
    circulo(q.x, q.y - s, s, contorno);
    camino([['M', q.x, q.y], ['L', q.x, q.y - s * 0.5]], tronco);
  }
}

function componePico(q, ele, P, { camino, guarda, restaura, recorta }) {
  const h = 10 + Math.min(10, ele / 250);
  const w = h * 0.9;
  const cuerpo = pinta({ relleno: P.fill, trazo: P.stroke, grosor: P.lw });

  if (P.mode === 'range') {
    // Loma redondeada en vez de pico: el estilo de cuento no tiene aristas.
    camino([
      ['M', q.x - w * 1.15, q.y],
      ['Q', q.x - w * 0.5, q.y - h * 1.15, q.x + w * 0.1, q.y],
      ['Q', q.x + w * 0.55, q.y - h * 0.85, q.x + w * 1.2, q.y],
      ['Z'],
    ], cuerpo);
    return;
  }

  camino([['M', q.x - w, q.y], ['L', q.x, q.y - h], ['L', q.x + w, q.y], ['Z']], cuerpo);

  if (P.mode === 'hatch') {
    // Ladera sombreada a rayas, como en el grabado antiguo.
    guarda();
    recorta({ tipo: 'camino', ops: [['M', q.x, q.y - h], ['L', q.x + w, q.y], ['L', q.x + w * 0.15, q.y], ['Z']] });
    for (let i = 0; i < 8; i++) {
      camino([['M', q.x + w * 0.1 * i, q.y - h], ['L', q.x + w * 0.1 * i + w * 0.5, q.y]], pinta({ trazo: P.shade, grosor: 1 }));
    }
    restaura();
  } else if (P.mode !== 'soft') {
    camino([['M', q.x, q.y - h], ['L', q.x + w, q.y], ['L', q.x + w * 0.3, q.y], ['Z']], pinta({ relleno: P.shade }));
  }
}

// --- glifos --------------------------------------------------------------------

function componeGlifoDeParaje(tipo, q, resaltado, estilo, { camino, circulo }) {
  if (estilo.glyph.mode === 'punto') {
    circulo(q.x, q.y, 4.5, pinta({ relleno: resaltado ? estilo.accent : estilo.glyph.fill, trazo: estilo.glyph.fill, grosor: 2.2 }));
    return;
  }
  const trazo = resaltado ? estilo.accent : estilo.glyph.stroke;
  const grosor = resaltado ? estilo.glyph.lw + 0.8 : estilo.glyph.lw + 0.2;
  const cuerpo = pinta({ relleno: estilo.glyph.fill, trazo, grosor });
  const soloLinea = pinta({ trazo, grosor });
  const g = 9;

  if (tipo === 'ruina') {
    camino([
      ['M', q.x - g * 0.5, q.y], ['L', q.x - g * 0.5, q.y - g * 1.2], ['L', q.x + g * 0.1, q.y - g * 0.8],
      ['L', q.x + g * 0.5, q.y - g * 1.05], ['L', q.x + g * 0.5, q.y], ['Z'],
    ], cuerpo);
  } else if (tipo === 'piedra') {
    camino([
      ['M', q.x - g * 0.35, q.y], ['L', q.x - g * 0.25, q.y - g * 1.1],
      ['L', q.x + g * 0.25, q.y - g * 1.2], ['L', q.x + g * 0.4, q.y], ['Z'],
    ], cuerpo);
  } else if (tipo === 'ermita') {
    camino([['R', q.x - g * 0.5, q.y - g * 0.7, g, g * 0.7]], cuerpo);
    camino([['M', q.x - g * 0.6, q.y - g * 0.7], ['L', q.x, q.y - g * 1.15], ['L', q.x + g * 0.6, q.y - g * 0.7], ['Z']],
      pinta({ relleno: estilo.glyph.roof ?? estilo.glyph.fill, trazo, grosor }));
    camino([
      ['M', q.x, q.y - g * 1.15], ['L', q.x, q.y - g * 1.6],
      ['M', q.x - g * 0.22, q.y - g * 1.42], ['L', q.x + g * 0.22, q.y - g * 1.42],
    ], soloLinea);
  } else if (tipo === 'fuente') {
    circulo(q.x, q.y - g * 0.4, g * 0.55, cuerpo);
    circulo(q.x, q.y - g * 0.4, g * 0.2, pinta({ relleno: estilo.water.lakeLine }));
  } else if (tipo === 'atalaya') {
    camino([['R', q.x - g * 0.3, q.y - g * 1.5, g * 0.6, g * 1.5]], cuerpo);
    camino([
      ['M', q.x - g * 0.3, q.y - g * 1.5], ['L', q.x - g * 0.3, q.y - g * 1.75],
      ['M', q.x, q.y - g * 1.5], ['L', q.x, q.y - g * 1.75],
      ['M', q.x + g * 0.3, q.y - g * 1.5], ['L', q.x + g * 0.3, q.y - g * 1.75],
    ], soloLinea);
  } else if (tipo === 'cruce') {
    camino([['M', q.x, q.y], ['L', q.x, q.y - g * 1.5]], soloLinea);
    camino([['R', q.x - g * 0.75, q.y - g * 1.45, g * 0.75, g * 0.38], ['R', q.x, q.y - g * 0.95, g * 0.75, g * 0.38]], cuerpo);
  } else if (tipo === 'puente') {
    camino([['M', q.x - g * 0.9, q.y], ['Q', q.x, q.y - g * 1.3, q.x + g * 0.9, q.y]], soloLinea);
    camino([['M', q.x - g * 0.55, q.y], ['Q', q.x, q.y - g * 0.7, q.x + g * 0.55, q.y]], soloLinea);
  } else if (tipo === 'monasterio') {
    camino([['R', q.x - g * 0.8, q.y - g * 0.6, g * 1.1, g * 0.6], ['R', q.x + g * 0.3, q.y - g * 1.1, g * 0.5, g * 1.1]], cuerpo);
    camino([
      ['M', q.x + g * 0.55, q.y - g * 1.1], ['L', q.x + g * 0.55, q.y - g * 1.45],
      ['M', q.x + g * 0.38, q.y - g * 1.32], ['L', q.x + g * 0.72, q.y - g * 1.32],
    ], soloLinea);
  }
}

function casa(x, y, w, estilo, { camino }) {
  const h = w * 0.8;
  camino([['R', x - w / 2, y - h, w, h]], pinta({ relleno: estilo.glyph.fill, trazo: estilo.glyph.stroke, grosor: estilo.glyph.lw }));
  camino([['M', x - w / 2 - 1, y - h], ['L', x, y - h - w * 0.55], ['L', x + w / 2 + 1, y - h], ['Z']],
    pinta({ relleno: estilo.glyph.roof ?? estilo.glyph.fill, trazo: estilo.glyph.stroke, grosor: estilo.glyph.lw }));
}

function torre(x, y, w, h, estilo, { camino }) {
  camino([['R', x - w / 2, y - h, w, h]], pinta({ relleno: estilo.glyph.fill, trazo: estilo.glyph.stroke, grosor: estilo.glyph.lw }));
  if (estilo.glyph.tower) {
    // Chapitel en color: los estilos ilustrados rematan las torres en punta.
    camino([['M', x - w / 2 - 1.5, y - h], ['L', x, y - h - w * 1.1], ['L', x + w / 2 + 1.5, y - h], ['Z']],
      pinta({ relleno: estilo.glyph.tower, trazo: estilo.glyph.stroke, grosor: estilo.glyph.lw }));
  } else {
    camino([
      ['M', x - w / 2, y - h], ['L', x - w / 2, y - h - 3],
      ['M', x, y - h], ['L', x, y - h - 3],
      ['M', x + w / 2, y - h], ['L', x + w / 2, y - h - 3],
    ], pinta({ trazo: estilo.glyph.stroke, grosor: estilo.glyph.lw }));
  }
}

function componeGlifoDeNucleo(tipo, q, medida, estilo, { camino, circulo }) {
  if (estilo.glyph.mode === 'punto') {
    circulo(q.x, q.y, RADIO_DE_PUNTO[tipo], pinta({ relleno: estilo.glyph.fill, trazo: estilo.glyph.stroke, grosor: estilo.glyph.lw }));
    return;
  }
  if (tipo === 'granja') {
    casa(q.x, q.y + 3, medida, estilo, { camino });
    for (let i = 0; i < 3; i++) {
      camino([['M', q.x + medida * 0.8, q.y + 1 + i * 3], ['L', q.x + medida * 1.7, q.y + 1 + i * 3]], pinta({ trazo: estilo.inkSoft, grosor: 1 }));
    }
  } else if (tipo === 'aldea') {
    casa(q.x - medida * 0.45, q.y + 4, medida * 0.8, estilo, { camino });
    casa(q.x + medida * 0.5, q.y + 4, medida * 0.9, estilo, { camino });
  } else if (tipo === 'pueblo') {
    casa(q.x - medida * 0.6, q.y + 5, medida * 0.65, estilo, { camino });
    casa(q.x + medida * 0.55, q.y + 5, medida * 0.7, estilo, { camino });
    torre(q.x, q.y + 5, medida * 0.45, medida * 1.1, estilo, { camino });
  } else {
    // Ciudad: muralla con torres, torreón central y banderín.
    circulo(q.x, q.y, medida * 0.75, pinta({ relleno: estilo.glyph.wall, trazo: estilo.glyph.stroke, grosor: estilo.glyph.lw + 0.6 }));
    torre(q.x - medida * 0.55, q.y + medida * 0.35, medida * 0.3, medida * 0.7, estilo, { camino });
    torre(q.x + medida * 0.55, q.y + medida * 0.35, medida * 0.3, medida * 0.7, estilo, { camino });
    torre(q.x, q.y + medida * 0.5, medida * 0.42, medida * 1.15, estilo, { camino });
    camino([
      ['M', q.x, q.y - medida * 0.65], ['L', q.x, q.y - medida * 0.95],
      ['L', q.x + medida * 0.32, q.y - medida * 0.85], ['L', q.x, q.y - medida * 0.75],
    ], pinta({ trazo: estilo.accent, grosor: 1.6 }));
  }
}

// --- rótulos --------------------------------------------------------------------

/** El punto medio de una calzada y el ángulo del tramo, o `null` si no cabe el rótulo. */
function sitioDelRotuloDeCalzada(calzada, px) {
  if (!calzada.name) return null; // los ramales de acceso no llevan nombre
  const pts = calzada.pts.map(px);
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  if (total < 150) return null;

  let acumulado = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const tramo = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (acumulado + tramo >= total / 2) {
      const t = (total / 2 - acumulado) / tramo;
      const x = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
      const y = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
      let angulo = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) angulo += Math.PI; // texto siempre derecho
      return { punto: { x, y }, angulo };
    }
    acumulado += tramo;
  }
  return null;
}

/** La tipografía de un rótulo, con la escala del estilo y el factor de letra ya aplicados. */
function tipografiaDeRotulo(estilo, rotulo, factorTexto) {
  const variante = rotulo.variante ?? {};
  return {
    familia: estilo.label.family,
    tamano: Math.round(rotulo.tamano * estilo.label.scale) * factorTexto,
    italica: variante.italic ?? estilo.label.italic,
    peso: variante.weight ?? estilo.label.weight,
    tracking: estilo.label.tracking,
  };
}

/**
 * Mide todos los rótulos y se los da **de golpe** al colocador, que devuelve la
 * posición de todos antes de que se pinte nada. El colocador de esta spec es el
 * provisional y puede solapar; el de la fila 22 entra por aquí sin tocar ni este
 * módulo ni el que dibuja.
 */
function colocaRotulos({ rotulos, estilo, factorTexto, medidor, colocador, tamano, caja }) {
  const conMedida = rotulos.map((rotulo) => {
    const tipografia = tipografiaDeRotulo(estilo, rotulo, factorTexto);
    const cadena = estilo.label.upper ? rotulo.texto.toUpperCase() : rotulo.texto;
    return { ...rotulo, texto: cadena, tipografia, medida: mide(medidor, cadena, tipografia, `rótulo ${rotulo.id}`) };
  });

  const puestos = colocador(
    conMedida.map((r) => ({ id: r.id, rol: r.rol, texto: r.texto, ancla: { ...r.ancla }, rotacion: r.rotacion, base: r.base, medida: { ...r.medida } })),
    { tamano: { ...tamano }, caja: { ...caja }, factorTexto },
  );
  if (!Array.isArray(puestos)) throw new Error('componeEscena: el colocador tiene que devolver una lista de posiciones');

  const porId = new Map();
  for (const puesto of puestos) {
    if (!puesto || typeof puesto.id !== 'string' || !Number.isFinite(puesto.x) || !Number.isFinite(puesto.y)) {
      throw new Error(`componeEscena: el colocador devolvió una posición mal formada: ${JSON.stringify(puesto)}`);
    }
    porId.set(puesto.id, puesto);
  }
  const faltan = conMedida.filter((r) => !porId.has(r.id)).map((r) => r.id);
  if (faltan.length) throw new Error(`componeEscena: el colocador devolvió menos rótulos de los que se le dieron; faltan ${faltan.join(', ')}`);

  return conMedida.map((r) => ({ ...r, x: porId.get(r.id).x, y: porId.get(r.id).y }));
}

/** Un rótulo ya colocado, resuelto con placa o con halo según lo diga el estilo. */
function componeRotulo(rotulo, estilo, { texto, camino, guarda, restaura, transforma }) {
  const rotado = rotulo.rotacion !== 0;
  if (rotado) {
    guarda();
    transforma(rotulo.x, rotulo.y, rotulo.rotacion);
  }
  const x = rotado ? 0 : rotulo.x;
  const y = (rotado ? 0 : rotulo.y) + (rotulo.dy ?? 0);

  const conPlaca = Boolean(estilo.placa) && estilo.label.placa.includes(rotulo.rol);
  const esFilacteria = rotulo.rol === 'ruta' && estilo.routeLabel.mode === 'ribbon';

  if (esFilacteria) {
    // Filacteria: cinta de pergamino con los extremos plegados, para los nombres de
    // calzada. Va a −14 del eje, como en el prototipo.
    const w = rotulo.medida.ancho + 26;
    const h = 24;
    const cy = -14;
    camino([
      ['M', x - w / 2, cy - h / 2], ['L', x + w / 2, cy - h / 2], ['L', x + w / 2 + 9, cy],
      ['L', x + w / 2, cy + h / 2], ['L', x - w / 2, cy + h / 2], ['L', x - w / 2 - 9, cy], ['Z'],
    ], pinta({ relleno: estilo.cartouche.fill, trazo: estilo.inkSoft, grosor: 1.2 }));
    texto({
      texto: rotulo.texto, x, y: cy, base: 'middle', medida: rotulo.medida,
      pintura: pintaTexto({ ...rotulo.tipografia, color: estilo.label.color, halo: null }),
    });
  } else if (conPlaca) {
    // Placa de pergamino: la cartela del título reducida al tamaño de un nombre. La
    // caja cuelga del punto donde iría el texto, para conservar el contrato de base.
    const P = estilo.placa;
    const w = rotulo.medida.ancho;
    const h = rotulo.tipografia.tamano + P.padY * 2;
    const bx = x - w / 2 - P.padX;
    const by = rotulo.base === 'bottom' ? y - h : rotulo.base === 'middle' ? y - h / 2 : y;
    camino([['RR', bx, by, w + P.padX * 2, h, P.radio]], pinta({
      relleno: P.fill, trazo: P.border, grosor: P.lw,
      sombra: P.sombra ? { color: P.sombra, difuminado: 5, dy: 1.5 } : null,
    }));
    texto({
      texto: rotulo.texto, x, y: by + h / 2 + 0.5, base: 'middle', medida: rotulo.medida,
      pintura: pintaTexto({ ...rotulo.tipografia, color: P.color ?? estilo.label.color, halo: null }),
    });
  } else {
    texto({
      texto: rotulo.texto, x, y, base: rotulo.base, medida: rotulo.medida,
      pintura: pintaTexto({
        ...rotulo.tipografia,
        color: estilo.label.color,
        halo: estilo.label.haloW > 0 ? { color: estilo.label.halo, grosor: estilo.label.haloW, pasadas: estilo.label.haloPasadas } : null,
      }),
    });
  }
  if (rotado) restaura();
}

// --- marco ----------------------------------------------------------------------

function componeMarco({ estilo, caja, camino, rect, circulo, elipse }) {
  if (estilo.frame.mode === 'none') return;
  const color = estilo.frame.color ?? estilo.ink;
  if (caja.modo === 'disc') return componeAroDeDisco(caja, color, { camino, circulo });

  const { x0, y0, x1, y1 } = caja;
  if (estilo.frame.mode === 'vine') return componeZarza(caja, estilo, color, { camino, elipse, circulo });
  if (estilo.frame.mode === 'ornate') return componeMarcoDorado(caja, estilo, { camino });

  // 'double' / 'ticks': banda gruesa exterior y filete interior.
  camino([['R', x0, y0, x1 - x0, y1 - y0]], pinta({ trazo: color, grosor: 6 }));
  camino([['R', x0 + 9, y0 + 9, x1 - x0 - 18, y1 - y0 - 18]], pinta({ trazo: color, grosor: 1.5 }));
  if (estilo.frame.mode === 'double') {
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) rect(x - 7, y - 7, 14, 14, pinta({ relleno: color }));
  }
}

function componeAroDeDisco(caja, color, { camino, circulo }) {
  const { cx, cy, R } = caja;
  circulo(cx, cy, R + 4, pinta({ trazo: color, grosor: 5 }));
  circulo(cx, cy, R + 14, pinta({ trazo: color, grosor: 1.5 }));
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r1 = R + 4, r2 = R + (i % 6 === 0 ? 14 : 9);
    camino([['M', cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], ['L', cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]], pinta({ trazo: color, grosor: 1.5 }));
  }
}

// Zarza en flor recorriendo el marco: hojas alternadas y flores de cinco pétalos.
function componeZarza(caja, estilo, color, { camino, elipse, circulo }) {
  const { x0, y0, x1, y1 } = caja;
  camino([['R', x0, y0, x1 - x0, y1 - y0]], pinta({ trazo: color, grosor: 2 }));
  camino([['R', x0 - 16, y0 - 16, x1 - x0 + 32, y1 - y0 + 32]], pinta({ trazo: color, grosor: 1.2 }));

  const m = 8;
  const paso = 13;
  const recorrido = [];
  const tramos = [
    [x0 - m, y0 - m, x1 + m, y0 - m], [x1 + m, y0 - m, x1 + m, y1 + m],
    [x1 + m, y1 + m, x0 - m, y1 + m], [x0 - m, y1 + m, x0 - m, y0 - m],
  ];
  for (const [ax, ay, bx, by] of tramos) {
    const largo = Math.hypot(bx - ax, by - ay);
    const cuantos = Math.floor(largo / paso);
    for (let i = 0; i < cuantos; i++) {
      const t = i / cuantos;
      recorrido.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx: (by - ay) / largo, ny: -(bx - ax) / largo });
    }
  }

  recorrido.forEach((p, i) => {
    const lado = i % 2 ? 1 : -1;
    const ox = p.nx * lado * 7, oy = p.ny * lado * 7;
    if (i % 7 === 3) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        circulo(p.x + ox + Math.cos(a) * 3.4, p.y + oy + Math.sin(a) * 3.4, 2.6, pinta({ relleno: estilo.accent }));
      }
      circulo(p.x + ox, p.y + oy, 2.2, pinta({ relleno: estilo.cartouche.fill }));
    } else {
      elipse(p.x + ox, p.y + oy, 6.5, 3.2, Math.atan2(p.ny * lado, p.nx * lado), pinta({ relleno: VERDE_DE_HOJA, trazo: color, grosor: 0.8 }));
    }
  });
}

// Marco dorado: banda gruesa, filete interior y rombos en las esquinas.
function componeMarcoDorado(caja, estilo, { camino }) {
  const { x0, y0, x1, y1 } = caja;
  camino([['R', x0, y0, x1 - x0, y1 - y0]], pinta({ trazo: estilo.frame.color, grosor: 14 }));
  camino([['R', x0, y0, x1 - x0, y1 - y0]], pinta({ trazo: estilo.frame.gold, grosor: 5 }));
  camino([['R', x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24]], pinta({ trazo: estilo.frame.color, grosor: 1.6 }));

  const rombo = (x, y, r) => camino(
    [['M', x, y - r], ['L', x + r, y], ['L', x, y + r], ['L', x - r, y], ['Z']],
    pinta({ relleno: estilo.frame.gold, trazo: estilo.frame.color, grosor: 1.4 }),
  );
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) rombo(x, y, 13);
  for (let i = 1; i < 8; i++) {
    rombo(x0 + ((x1 - x0) * i) / 8, y0, 6);
    rombo(x0 + ((x1 - x0) * i) / 8, y1, 6);
    rombo(x0, y0 + ((y1 - y0) * i) / 8, 6);
    rombo(x1, y0 + ((y1 - y0) * i) / 8, 6);
  }
}

// --- brújula ---------------------------------------------------------------------

function centroDeBrujula(caja, estilo) {
  if (caja.modo === 'disc') {
    const dentro = caja.R * 0.78;
    const dx = estilo.compass.corner.includes('e') ? dentro : -dentro;
    const dy = estilo.compass.corner.startsWith('n') ? -dentro : dentro;
    return { x: caja.cx + dx, y: caja.cy + dy };
  }
  const margen = 74 * estilo.compass.scale;
  return {
    x: estilo.compass.corner.includes('e') ? caja.x1 - margen : caja.x0 + margen,
    y: estilo.compass.corner.startsWith('n') ? caja.y0 + margen : caja.y1 - margen,
  };
}

// El norte queda arriba siempre: la brújula se pinta sin rotación y la lámina no
// expone ninguna manera de girarla.
function componeBrujula({ estilo, caja, texto, camino, circulo, guarda, restaura, transforma }) {
  if (estilo.compass.mode === 'none') return;
  const { x, y } = centroDeBrujula(caja, estilo);
  const color = estilo.compass.color ?? estilo.ink;
  const k = estilo.compass.scale;
  guarda();
  transforma(x, y, 0);

  if (estilo.compass.mode === 'rose' || estilo.compass.mode === 'thin') {
    const R = 26 * k;
    const fino = estilo.compass.mode === 'thin';
    const grosor = fino ? 1 : 1.5;
    circulo(0, 0, R, pinta({ trazo: color, grosor }));
    circulo(0, 0, R * 0.82, pinta({ trazo: color, grosor }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const larga = i % 2 === 0;
      const r = larga ? R * (fino ? 2.4 : 1.5) : R * (fino ? 1.5 : 0.95);
      const w = larga ? R * 0.17 : R * 0.11;
      const ops = [
        ['M', Math.cos(a) * r, Math.sin(a) * r],
        ['L', Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w],
        ['L', Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w],
        ['Z'],
      ];
      camino(ops, fino
        ? pinta({ trazo: color, grosor })
        : pinta({ relleno: i % 4 === 0 ? color : estilo.cartouche.fill, trazo: color, grosor }));
    }
    if (estilo.compass.letters) {
      const d = R * 1.85;
      const tipografia = pintaTexto({ color, familia: estilo.cartouche.family, tamano: Math.round(16 * k), peso: 'bold' });
      for (const [letra, lx, ly] of [['N', 0, -d], ['S', 0, d], ['E', d, 0], ['O', -d, 0]]) {
        texto({ texto: letra, x: lx, y: ly, base: 'middle', pintura: tipografia, donde: 'las letras de la brújula' });
      }
    }
  } else if (estilo.compass.mode === 'star') {
    const R = 30 * k;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      camino([
        ['M', Math.cos(a) * R, Math.sin(a) * R],
        ['L', Math.cos(a + Math.PI / 2) * R * 0.22, Math.sin(a + Math.PI / 2) * R * 0.22],
        ['L', Math.cos(a - Math.PI / 2) * R * 0.22, Math.sin(a - Math.PI / 2) * R * 0.22],
        ['Z'],
      ], pinta({ relleno: i === 0 ? estilo.accent : estilo.cartouche.fill, trazo: color, grosor: 1.5 }));
    }
    texto({ texto: 'N', x: 0, y: -R - 8, base: 'bottom', donde: 'el norte de la brújula', pintura: pintaTexto({ color, familia: estilo.cartouche.family, tamano: Math.round(20 * k) }) });
  } else {
    circulo(0, 0, 26, pinta({ trazo: color, grosor: 1.5 }));
    camino([['M', 0, -22], ['L', 6, 6], ['L', 0, 2], ['L', -6, 6], ['Z']], pinta({ relleno: color }));
    texto({ texto: 'N', x: 0, y: -32, base: 'bottom', donde: 'el norte de la brújula', pintura: pintaTexto({ color, familia: estilo.label.family, tamano: 14, peso: 'bold' }) });
  }
  restaura();
}

// --- cartela ----------------------------------------------------------------------

function componeCartela({ estilo, caja, W, titulo, medidor, texto, camino }) {
  const C = estilo.cartouche;
  if (C.mode === 'none') return;
  const x = W / 2;
  const y = C.pos === 'bottom' ? caja.y1 - 46 : caja.y0 + 42;
  const cadena = estilo.label.upper ? titulo.toUpperCase() : titulo;
  const tipografia = { familia: C.family, tamano: C.size, italica: false, peso: '', tracking: C.tracking };
  const medida = mide(medidor, cadena, tipografia, 'la cartela');
  const anchoTexto = medida.ancho;
  const color = C.color ?? estilo.ink;
  const borde = C.border ?? estilo.ink;
  const h = C.size + 20;

  if (C.mode === 'plain') {
    // Sin caja: el propio papel hace de halo.
    texto({
      texto: cadena, x, y, base: 'middle', medida,
      pintura: pintaTexto({ ...tipografia, color, halo: { color: estilo.paper.base, grosor: 6, pasadas: 1 } }),
    });
    return;
  }

  if (C.mode === 'banner') {
    const w = anchoTexto + 70;
    const relleno = pinta({ relleno: C.fill, trazo: borde, grosor: 2.5 });
    camino([['R', x - w / 2, y - h / 2, w, h]], relleno);
    for (const s of [-1, 1]) {
      camino([
        ['M', x + (s * w) / 2, y - h / 2], ['L', x + s * (w / 2 + 30), y - h / 2 - 7],
        ['L', x + s * (w / 2 + 16), y], ['L', x + s * (w / 2 + 30), y + h / 2 + 7],
        ['L', x + (s * w) / 2, y + h / 2], ['Z'],
      ], relleno);
    }
  } else if (C.mode === 'scroll') {
    const w = anchoTexto + 56;
    camino([['RR', x - w / 2, y - h / 2, w, h, 5]], pinta({ relleno: C.fill, trazo: borde, grosor: 2.5 }));
    camino([['RR', x - w / 2 + 7, y - h / 2 + 6, w - 14, h - 12, 3]], pinta({ trazo: borde, grosor: 1 }));
    for (const s of [-1, 1]) {
      camino([['C', x + s * (w / 2 + 9), y, h / 2]], pinta({ relleno: C.fill, trazo: borde, grosor: 2 }));
      camino([['C', x + s * (w / 2 + 9), y, h / 6]], pinta({ trazo: borde, grosor: 2 }));
    }
  } else {
    camino([['RR', x - anchoTexto / 2 - 22, y - 24, anchoTexto + 44, 48, 8]], pinta({ relleno: C.fill, trazo: borde, grosor: 2 }));
  }

  texto({ texto: cadena, x, y: y + 2, base: 'middle', medida, pintura: pintaTexto({ ...tipografia, color }) });
}

// --- barra de escala -----------------------------------------------------------------

const PASOS_DE_ESCALA = [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];

function componeEscalaCartografica({ estilo, caja, escala, radioM, camino, texto }) {
  let metros = PASOS_DE_ESCALA[0];
  for (const paso of PASOS_DE_ESCALA) if (paso <= radioM / 2.5) metros = paso;
  const leyenda = metros >= 1000
    ? `${metros / 1000} ${metros === 1000 ? 'legua' : 'leguas'} (${metros / 1000} km)`
    : `${metros} varas (${metros} m)`;

  const largo = metros * escala;
  // La barra se va a la esquina inferior libre: si la brújula ocupa la izquierda, a la derecha.
  const derecha = estilo.compass.corner === 'sw' && caja.modo !== 'disc';
  const x = caja.modo === 'disc' ? 40 : derecha ? caja.x1 - 28 - largo : caja.x0 + 28;
  const y = caja.modo === 'disc' ? caja.y1 + 40 : caja.y1 - 26;
  camino([
    ['M', x, y], ['L', x + largo, y],
    ['M', x, y - 5], ['L', x, y + 5],
    ['M', x + largo, y - 5], ['L', x + largo, y + 5],
  ], pinta({ trazo: estilo.ink, grosor: 2 }));
  texto({
    texto: leyenda, x: x + largo / 2, y: y - 10, base: 'bottom', donde: 'la leyenda de la barra de escala',
    pintura: pintaTexto({
      color: estilo.ink, familia: estilo.label.family, tamano: TAMANO_DE_LEYENDA_DE_ESCALA,
      halo: { color: estilo.label.halo, grosor: 4, pasadas: 1 },
    }),
  });
}
