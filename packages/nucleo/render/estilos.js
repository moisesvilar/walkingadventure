// Los cinco estilos de pintado, como objetos de datos fusionados sobre unos valores
// por defecto. Añadir un estilo es añadir un objeto aquí y nada más: ni el módulo
// que compone la escena ni el que ejecuta el dibujo saben que existe.
// Portado de `prototipo/js/render/styles.js` clave a clave — la paridad de datos con
// el prototipo es criterio de SPEC-021 y por eso los nombres de clave no se traducen.

const FELL = '"IM Fell English", Georgia, serif';
const CINZEL = '"Cinzel", "IM Fell English", Georgia, serif';
const HAND = '"Caveat", Georgia, cursive';
const MEDIEVAL = '"MedievalSharp", Georgia, serif';

/**
 * Valores comunes: cada estilo solo declara lo que le distingue.
 *
 * Tres trampas que el porte tiene que conservar, y que están documentadas en
 * `CLAUDE.md` porque ya se tropezó con ellas:
 *
 * 1. `label` es la tipografía de los rótulos del mapa; el nombre visible del estilo
 *    es `title`. Si se confunden, la fusión machaca la tipografía con una cadena y
 *    todos los rótulos se pintan con la familia por defecto sin que nada falle.
 * 2. `capas` decide qué se dibuja. Es cómo Reino se queda limpio sin borrar el
 *    código que los otros cuatro estilos usan.
 * 3. La fusión es de **dos niveles**, grupo y clave, y nada anida más hondo. Un
 *    estilo que declara `label: { color }` conserva familia, halo y placa de aquí.
 */
export const POR_DEFECTO = {
  shape: 'rect',        // 'rect' | 'disc' — forma del área pintada
  margin: 46,           // margen del marco, en px de la superficie
  outside: '#cbb98d',   // color fuera del área pintada
  paper: {
    base: '#e9dcb6',
    grain: { count: 2200, dark: 'rgba(160,130,80,0.05)', light: 'rgba(255,250,230,0.05)', rMax: 3 },
    blotches: null,     // manchas de humedad: { count, color, r }
    vignette: { power: 0.18, color: '90,65,30', inner: 0.25, outer: 0.55 },
  },
  land: null,           // relleno de tierra sobre el papel: { fill, stipple: { count, color, r } }
  ink: '#4a3a22',
  inkSoft: 'rgba(74,58,34,0.5)',
  accent: '#7a2e1d',
  water: { rgb: [143, 180, 196], alpha: 255, lake: '#8fb4c4', lakeLine: '#6d97ab', river: '#6d97ab', riverW: 2.2 },
  coast: { mode: 'waves', n: 4, gap: 7, line: '#4a3a22', lineW: 2.4, wave: '109,151,171', waveAlpha: 0.55, islaMin: 0 },
  forest: { fill: 'rgba(168,180,131,0.4)', tree: 'round', crown: '#a8b483', crown2: '#8d9c6a', stroke: '#5d6b3f', size: 4, density: 60000, max: 60 },
  peak: { mode: 'plain', fill: '#d9c896', stroke: '#4a3a22', shade: 'rgba(74,58,34,0.35)', snow: null, lw: 1.6 },
  route: { casing: '#4a3a22', casingW: 5, fill: '#c9a86a', fillW: 2.6, fallback: 'rgba(74,58,34,0.7)' },
  street: { major: 'rgba(122,94,58,0.5)', minor: 'rgba(122,94,58,0.45)' },
  glyph: { fill: '#d9c896', stroke: '#4a3a22', lw: 1.4, roof: null, tower: null, wall: 'rgba(217,200,150,0.9)' },
  // `placa` lista los roles de rótulo que van sobre caja ('nucleo', 'paraje',
  // 'servicio', 'ruta'); vacía, todos se resuelven con halo. `haloPasadas` repite el
  // trazo: con halo opaco una sola pasada deja el borde lavado por el antialiasing.
  label: { family: FELL, italic: true, weight: '', upper: false, tracking: 0, scale: 1, color: '#4a3a22', halo: 'rgba(233,220,182,0.9)', haloW: 4, haloPasadas: 1, placa: [] },
  placa: null,          // caja bajo el rótulo: { fill, border, lw, padX, padY, radio, color, sombra }
  routeLabel: { mode: 'plain' },                       // 'plain' | 'ribbon'
  cartouche: { mode: 'roundrect', pos: 'top', family: MEDIEVAL, size: 30, fill: '#e9dcb6', color: null, border: null, tracking: 0 },
  frame: { mode: 'ticks', color: null, gold: '#8a6d34' },
  compass: { mode: 'needle', corner: 'ne', scale: 1, color: null, behind: false, letters: false },
  fonts: [FELL, MEDIEVAL],
  // Barra de escala. Existe en el estilo y **está apagada en todas las pantallas
  // del juego**: una escala cartográfica es una cifra de distancia y el sistema de
  // diseño las prohíbe. Solo la enciende la pantalla de revisión, pidiéndola en la
  // vista; que el estilo la declare es lo que permite revisar la paridad.
  escala: true,
  // Qué capas de terreno se pintan. Apagarlas es la forma de tener un mapa base limpio
  // sin quitar el código que las dibuja para el resto de estilos.
  capas: { bosques: true, picos: true, carreteras: false, rotulosCamino: true, lagos: true, soloRiosPrincipales: false },
  carretera: null, // red viaria real de OSM: { color, principal, pista, soloPrincipales }
};

/**
 * Fusión de dos niveles: grupo y clave. Nada anida más hondo, y es a propósito —
 * fusionar en profundidad o reemplazar el grupo entero cambia los cinco estilos a
 * la vez sin que ningún test de datos lo vea, porque los objetos siguen siendo
 * válidos.
 */
export function fusiona(sobre) {
  const salida = {};
  for (const clave of Object.keys(POR_DEFECTO)) {
    const base = POR_DEFECTO[clave];
    const encima = sobre[clave];
    if (encima === undefined) salida[clave] = base;
    else if (base && typeof base === 'object' && !Array.isArray(base) && encima && typeof encima === 'object' && !Array.isArray(encima)) {
      salida[clave] = { ...base, ...encima };
    } else salida[clave] = encima;
  }
  for (const clave of Object.keys(sobre)) if (!(clave in salida)) salida[clave] = sobre[clave];
  return salida;
}

// --- clásico: el mapa de v0.1, disco recortado sobre pergamino claro ---

const clasico = fusiona({
  id: 'clasico',
  title: 'Clásico',
  hint: 'El mapa de v0.1: disco de pergamino, tinta sepia y trazo limpio.',
  shape: 'disc',
  margin: 70,
});

// --- pergamino: carta antigua manchada, todo a tinta (ref. e08b95cc) ---

const pergamino = fusiona({
  id: 'pergamino',
  title: 'Pergamino',
  hint: 'Carta antigua: papel ocre manchado, viñeteo fuerte y todo resuelto a tinta sepia.',
  margin: 52,
  outside: '#6f5830',
  paper: {
    base: '#d8bf8c',
    grain: { count: 3200, dark: 'rgba(110,80,35,0.07)', light: 'rgba(255,246,214,0.06)', rMax: 4 },
    blotches: { count: 34, color: 'rgba(116,84,38,0.04)', r: 40 },
    vignette: { power: 0.34, color: '78,54,20', inner: 0.3, outer: 0.68 },
  },
  ink: '#3f3019',
  inkSoft: 'rgba(63,48,25,0.5)',
  accent: '#8d2f21',
  water: { rgb: [124, 156, 170], alpha: 145, lake: 'rgba(124,156,170,0.55)', lakeLine: 'rgba(80,110,126,0.8)', river: 'rgba(90,124,142,0.85)', riverW: 2.4 },
  coast: { mode: 'waves', n: 3, gap: 8, line: '#3f3019', lineW: 2.2, wave: '90,124,142', waveAlpha: 0.45 },
  forest: { fill: 'rgba(108,120,70,0.28)', tree: 'round', crown: '#848f5a', crown2: '#6c774a', stroke: '#4c5530', size: 4.5, density: 55000, max: 70 },
  peak: { mode: 'hatch', fill: '#d0b581', stroke: '#3f3019', shade: 'rgba(63,48,25,0.45)', lw: 1.5 },
  route: { casing: '#3f3019', casingW: 4.5, fill: '#cdb489', fillW: 2.4, fallback: 'rgba(63,48,25,0.65)' },
  street: { major: 'rgba(100,76,44,0.55)', minor: 'rgba(100,76,44,0.45)' },
  glyph: { fill: '#d2b785', stroke: '#3f3019', lw: 1.5, wall: 'rgba(210,183,133,0.95)' },
  label: { family: FELL, halo: 'rgba(216,191,140,0.85)', color: '#3f3019' },
  routeLabel: { mode: 'ribbon' },
  cartouche: { mode: 'scroll', pos: 'bottom', family: MEDIEVAL, size: 30, fill: '#e3cfa1', border: '#8d2f21' },
  frame: { mode: 'double', color: '#3f3019' },
  compass: { mode: 'rose', corner: 'sw', scale: 1.15 },
});

// --- cuento: ilustración de libro infantil, prado verde y línea a lápiz (ref. 40753efe) ---

const cuento = fusiona({
  id: 'cuento',
  title: 'Cuento',
  hint: 'Ilustración de cuento: prado verde, casitas de tejado rojo y marco de zarza en flor.',
  margin: 58,
  outside: '#e3d6ae',
  paper: {
    base: '#efe4c4',
    grain: { count: 1400, dark: 'rgba(150,120,70,0.04)', light: 'rgba(255,252,238,0.05)', rMax: 3 },
    vignette: { power: 0.1, color: '110,90,50', inner: 0.35, outer: 0.6 },
  },
  land: { fill: '#b3c67f', stipple: { count: 2600, color: 'rgba(120,148,80,0.22)', r: 2.6 } },
  ink: '#5b4326',
  inkSoft: 'rgba(91,67,38,0.5)',
  accent: '#b8543f',
  water: { rgb: [154, 196, 212], alpha: 255, lake: '#a8d0e0', lakeLine: '#6f9db2', river: '#83b3c8', riverW: 3.2 },
  coast: { mode: 'ink', n: 1, gap: 6, line: '#5b4326', lineW: 2, wave: '111,157,178', waveAlpha: 0.5 },
  forest: { fill: 'rgba(122,150,80,0.3)', tree: 'leafy', crown: '#7ba055', crown2: '#a0c274', stroke: '#4d6b34', size: 6, density: 42000, max: 95 },
  peak: { mode: 'range', fill: '#8fa07a', stroke: '#4e5c3c', shade: 'rgba(60,74,46,0.4)', lw: 1.5 },
  route: { casing: '#6b4f2c', casingW: 4.5, fill: '#efdfb4', fillW: 2.2, fallback: 'rgba(107,79,44,0.6)' },
  street: { major: 'rgba(120,92,54,0.55)', minor: 'rgba(120,92,54,0.4)' },
  glyph: { fill: '#f5ead0', stroke: '#5b4326', lw: 1.5, roof: '#b8543f', tower: '#8ca0c4', wall: '#f5ead0' },
  label: { family: HAND, italic: false, weight: '', scale: 1.3, color: '#4a3520', halo: 'rgba(240,235,208,0.85)', haloW: 5 },
  cartouche: { mode: 'banner', pos: 'bottom', family: HAND, size: 40, fill: '#f3e7c6', border: '#5b4326' },
  frame: { mode: 'vine', color: '#5b4326' },
  compass: { mode: 'star', corner: 'sw', scale: 0.95 },
  fonts: [HAND],
});

// --- atlas: cartografía pastel a sangre, sin marco (ref. 994492cb) ---

const atlas = fusiona({
  id: 'atlas',
  title: 'Atlas',
  hint: 'Cartografía pastel a sangre: mar de menta, halos de costa y versalitas espaciadas.',
  margin: 0,
  outside: '#e2eee2',
  paper: {
    base: '#e2eee2',
    grain: { count: 900, dark: 'rgba(140,150,120,0.04)', light: 'rgba(255,255,250,0.05)', rMax: 3 },
    vignette: { power: 0.06, color: '110,120,90', inner: 0.4, outer: 0.7 },
  },
  land: { fill: '#c3ce93', stipple: { count: 5200, color: 'rgba(146,150,88,0.18)', r: 2 } },
  ink: '#6a6144',
  inkSoft: 'rgba(106,97,68,0.45)',
  accent: '#9a6a3c',
  water: { rgb: [226, 238, 226], alpha: 255, lake: '#dcebdd', lakeLine: 'rgba(130,150,125,0.7)', river: 'rgba(140,164,140,0.85)', riverW: 2 },
  coast: { mode: 'halos', n: 3, gap: 11, line: 'rgba(122,124,86,0.55)', lineW: 1.5, wave: '150,168,140', waveAlpha: 0.5 },
  forest: { fill: 'rgba(140,160,110,0.18)', tree: 'conifer', crown: '#83936b', crown2: '#6f8058', stroke: '#6b7d56', size: 5, density: 34000, max: 120 },
  peak: { mode: 'soft', fill: '#e0d3ac', stroke: '#8c7f5e', shade: 'rgba(140,120,80,0.3)', lw: 1.2 },
  route: { casing: 'rgba(150,140,100,0.45)', casingW: 3.4, fill: '#efe9d2', fillW: 1.7, fallback: 'rgba(150,140,100,0.5)' },
  street: { major: 'rgba(150,140,100,0.45)', minor: 'rgba(150,140,100,0.3)' },
  glyph: { fill: '#f0ead2', stroke: '#6b5c3a', lw: 1.2, roof: '#a3543f', wall: '#f0ead2' },
  label: { family: CINZEL, italic: false, upper: true, tracking: 2.4, scale: 0.82, color: '#57503a', halo: 'rgba(226,234,219,0.8)', haloW: 4 },
  cartouche: { mode: 'plain', pos: 'top', family: CINZEL, size: 27, tracking: 5, color: '#57503a' },
  frame: { mode: 'none' },
  compass: { mode: 'thin', corner: 'nw', scale: 3.4, behind: true, color: 'rgba(150,140,105,0.5)' },
  fonts: [CINZEL],
});

// --- reino: el mapa base, verde y azul planos con marco dorado (ref. b03241c5) ---

const reino = fusiona({
  id: 'reino',
  title: 'Reino',
  hint: 'Mapa base: tierra verde, mar azul, costa y ríos muy marcados, carreteras y puntos rojos.',
  margin: 54,
  outside: '#2f4d5c',
  // Colores planos: sin grano y sin viñeteo. El papel solo se ve si el mundo
  // no tiene costa; en cuanto la hay, la tierra lo cubre y el mar se pinta desde la máscara.
  paper: {
    base: '#3f7fa8',
    grain: { count: 0, dark: 'rgba(0,0,0,0)', light: 'rgba(0,0,0,0)', rMax: 1 },
    vignette: { power: 0, color: '0,0,0', inner: 1, outer: 1 },
  },
  land: { fill: '#7fae5a', stipple: null },
  ink: '#1e2b18',
  inkSoft: 'rgba(30,43,24,0.5)',
  accent: '#c62828',
  water: { rgb: [63, 127, 168], alpha: 255, lake: '#3f7fa8', lakeLine: '#1e2b18', river: '#1f6f9e', riverW: 7 },
  // costa y ríos muy marcados: son la referencia con la que se camina
  coast: { mode: 'ink', n: 1, gap: 0, line: '#12321f', lineW: 9, wave: '0,0,0', waveAlpha: 0, islaMin: 48 },
  route: { casing: 'rgba(30,43,24,0.75)', casingW: 6, fill: '#f2e7c8', fillW: 3, fallback: 'rgba(30,43,24,0.55)' },
  carretera: { color: 'rgba(45,38,26,0.7)', principal: 3.5, pista: 1.4, soloPrincipales: true },
  street: { major: 'rgba(60,50,35,0.5)', minor: 'rgba(60,50,35,0.3)' },
  // marcadores provisionales: un punto rojo por núcleo, del tamaño de su rango
  glyph: { mode: 'punto', fill: '#c62828', stroke: '#7d1414', lw: 1.6 },
  // Jerarquía de rótulo: el núcleo va sobre placa de pergamino —la misma cartela del
  // título en pequeño—, el paraje solo con halo. Además de legibilidad da lo que el
  // halo blanco no daba: pueblo y paraje se distinguen sin leer el nombre.
  label: { family: CINZEL, italic: false, upper: true, tracking: 1.4, scale: 0.92, color: '#14200f', halo: '#efe3c0', haloW: 6, haloPasadas: 2, placa: ['nucleo'] },
  placa: { fill: '#efe3c0', border: '#8a6d34', lw: 1.2, padX: 9, padY: 5, radio: 3, color: '#1e2b18', sombra: 'rgba(18,30,14,0.32)' },
  cartouche: { mode: 'banner', pos: 'top', family: CINZEL, size: 28, fill: '#efe3c0', border: '#8a6d34', tracking: 3 },
  frame: { mode: 'ornate', color: '#8a6d34', gold: '#c8a24a' },
  compass: { mode: 'rose', corner: 'se', scale: 1.25, letters: true },
  // capas apagadas: el mapa base no dibuja relieve ni vegetación
  capas: { bosques: false, picos: false, carreteras: false, rotulosCamino: false, lagos: false, soloRiosPrincipales: true },
  fonts: [CINZEL],
});

/** El catálogo: cinco entradas, Reino primero porque es el de por defecto. */
export const ESTILOS = [reino, clasico, pergamino, cuento, atlas];

/** El estilo con el que se pinta si nadie dice otra cosa. */
export const ESTILO_POR_DEFECTO = 'reino';

// --- la escala de la lámina --------------------------------------------------------
// Las métricas de rótulo de los cinco estilos son las del prototipo **tal cual**, y el
// prototipo pinta sobre un lienzo de 1300 px (`prototipo/index.html`). La lámina del
// móvil tiene 390. Sin escalar, una placa de núcleo mide 213-322 px contra 254 de marco
// útil, 21 candidatos son más anchos que el marco entero y se retiran ocho de cada diez
// nombres: el algoritmo de colocación hace lo correcto —antes retirar que cortar— sobre
// unos números que no son de esta pantalla.
//
// Lo que se escala es **el estilo para el dispositivo**, una vez y para todos los
// rótulos a la vez. No es un apaño por rótulo: ninguno se encoge para caber, que es lo
// que SPEC-022 prohíbe, y la jerarquía se conserva entera porque lo que se multiplica
// es la escala tipográfica del estilo y no el tamaño de un rol suelto.

/** El ancho de lámina para el que están escritas las métricas del prototipo: su lienzo. */
export const ANCHO_DEL_PROTOTIPO = 1300;

/**
 * El suelo de la escala, y por qué existe.
 *
 * La razón cruda —390/1300 = 0,30— deja el nombre de una ciudad en 7 px y el de un
 * paraje en 4: un mapa cuyos nombres no se leen es el mismo mapa sin nombres que se
 * quería arreglar, así que la escala se detiene antes y el mapa muestra menos nombres
 * en lugar de nombres ilegibles.
 *
 * El valor sale de medir, no de elegirlo: sobre los cuatro mundos de referencia por sus
 * cinco estilos, **0,65 es la escala más grande a la que no se retira ni un rótulo por
 * no caber en el marco** (61 lo hacían) y a la que 69 de los 70 núcleos conservan su
 * nombre (lo hacían 26). Por encima vuelven a caerse núcleos; por debajo ya no se gana
 * casi nada y la jerarquía empieza a aplastarse —ciudad y pueblo se juntan— porque los
 * tamaños se redondean a píxeles enteros.
 */
export const SUELO_DE_ESCALA_DE_LAMINA = 0.65;

/**
 * Qué claves están escritas en píxeles de lámina y por tanto escalan con ella.
 *
 * `margin` va aquí y no es una métrica de rótulo: es la que fija el marco útil, y con
 * 46 px por lado de una lámina de 390 el marco se queda con el 65 % del ancho, contra
 * el 91 % que tiene en el prototipo. Ninguna escala tipográfica arregla eso —un nombre
 * de pueblo que cabe de sobra se sigue retirando porque su caja no cabe entre los dos
 * márgenes—, así que el margen escala con lo demás.
 */
const METRICAS_DE_LAMINA = Object.freeze({
  // `scale` es la escala tipográfica del estilo, por la que se multiplica el tamaño de
  // cada rol: multiplicarla aquí es lo que conserva la jerarquía entera —una ciudad
  // sigue siendo mayor que un pueblo y que un paraje— en lugar de recortar rótulo a
  // rótulo. `haloW` y `tracking` son lo que el halo y el interletraje añaden a la caja.
  label: ['scale', 'haloW', 'tracking'],
  // Los márgenes de la placa, su filete y su redondeo: si no escalaran con la letra, la
  // caja de un nombre de 15 px llevaría el acolchado de uno de 23, y la placa dejaría
  // de leerse como la cartela pequeña que es.
  placa: ['padX', 'padY', 'lw', 'radio'],
});

/** Las claves sueltas, fuera de grupo, que también están en píxeles de lámina. */
const METRICAS_SUELTAS_DE_LAMINA = Object.freeze(['margin']);

/**
 * Lo que hay que encoger las métricas de una lámina de este ancho.
 *
 * Es continua y monótona, y a 1300 px vale 1: una lámina del tamaño del lienzo del
 * prototipo pinta exactamente lo que pinta el prototipo, que es lo que mantiene con
 * sentido la revisión de paridad visual.
 */
export function escalaDeLamina(ancho) {
  if (!Number.isFinite(ancho) || ancho <= 0) {
    throw new Error(`escalaDeLamina: el ancho de la lámina tiene que ser positivo; llegó ${ancho}`);
  }
  return Math.min(1, Math.max(SUELO_DE_ESCALA_DE_LAMINA, ancho / ANCHO_DEL_PROTOTIPO));
}

/**
 * El estilo escalado para una lámina de este ancho.
 *
 * Devuelve **otro objeto de datos**, con la misma forma y las mismas claves: quien pinta
 * y quien coloca siguen leyendo del estilo, y ninguno de los dos sabe que ha habido un
 * escalado ni tiene un tamaño escrito dentro. Lo que no toca es todo lo que no está en
 * píxeles de lámina —colores, tipografías, modos, capas— ni lo que es grosor de tinta:
 * el filete del marco mide lo que mide en cualquier pantalla.
 *
 * El catálogo no se muta: `ESTILOS` sigue siendo clave a clave el del prototipo, que es
 * lo que la revisión de paridad de SPEC-021 compara.
 */
export function estiloParaLamina(estilo, ancho) {
  const k = escalaDeLamina(ancho);
  if (k === 1) return estilo;
  const salida = { ...estilo };
  for (const clave of METRICAS_SUELTAS_DE_LAMINA) {
    if (Number.isFinite(estilo[clave])) salida[clave] = estilo[clave] * k;
  }
  for (const [grupo, claves] of Object.entries(METRICAS_DE_LAMINA)) {
    const original = estilo[grupo];
    if (!original || typeof original !== 'object') continue; // `placa: null` en los estilos sin caja
    const escalado = { ...original };
    for (const clave of claves) if (Number.isFinite(original[clave])) escalado[clave] = original[clave] * k;
    salida[grupo] = escalado;
  }
  return salida;
}

/**
 * Un catálogo con estilos añadidos.
 *
 * Es lo que hace literal el criterio «añadir un estilo es añadir un objeto»: quien
 * añade uno no toca ni este módulo ni el que compone la escena ni el que dibuja.
 */
export function creaCatalogo(extras = []) {
  const salida = ESTILOS.slice();
  for (const extra of extras) {
    if (!extra || typeof extra !== 'object') throw new Error('creaCatalogo: un estilo tiene que ser un objeto de datos');
    if (!extra.id) throw new Error('creaCatalogo: un estilo tiene que declarar su id');
    if (!extra.title) throw new Error(`creaCatalogo: el estilo "${extra.id}" no declara su nombre visible (title)`);
    // Se fusiona siempre: un estilo nuevo declara solo lo que lo distingue y todo
    // lo demás le llega de los valores por defecto.
    salida.push(fusiona(extra));
  }
  return salida;
}

/**
 * Resuelve un identificador de estilo contra un catálogo.
 *
 * Un identificador desconocido **cae a Reino y lo declara**, en lugar de fallar: el
 * estilo es una preferencia de pintado guardada en la partida, no un dato del
 * mundo, y una partida que no abre porque cambió el nombre de un estilo es un
 * precio desproporcionado. La sustitución se devuelve para que no sea silenciosa.
 *
 * @returns {{ estilo: object, sustitucion: { pedido: string, usado: string } | null }}
 */
export function resuelveEstilo(id, catalogo = ESTILOS) {
  if (id && typeof id === 'object') return { estilo: id, sustitucion: null };
  const encontrado = catalogo.find((estilo) => estilo.id === id);
  if (encontrado) return { estilo: encontrado, sustitucion: null };
  const defecto = catalogo.find((estilo) => estilo.id === ESTILO_POR_DEFECTO) ?? catalogo[0];
  return { estilo: defecto, sustitucion: { pedido: id ?? null, usado: defecto.id } };
}

/** Las tipografías que un estilo necesita tener cargadas antes de pintar. */
export function tipografiasDeEstilo(estilo) {
  const salida = [];
  for (const familia of estilo.fonts) if (!salida.includes(familia)) salida.push(familia);
  if (!salida.includes(estilo.cartouche.family)) salida.push(estilo.cartouche.family);
  if (!salida.includes(estilo.label.family)) salida.push(estilo.label.family);
  return salida;
}

/** Las tipografías de todo un catálogo, sin repetir y en orden estable. */
export function tipografiasDeCatalogo(catalogo = ESTILOS) {
  const salida = [];
  for (const estilo of catalogo) for (const familia of tipografiasDeEstilo(estilo)) if (!salida.includes(familia)) salida.push(familia);
  return salida;
}
