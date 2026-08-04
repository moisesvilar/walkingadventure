// Generador de nombres de fantasía con sabor castellano.

import { pick, randInt } from './rng.js';

const TOWN_A = ['Val', 'Mon', 'Riba', 'Torre', 'Fuen', 'Peña', 'Vega', 'Mira', 'Alba', 'Cala', 'Soto', 'Villa', 'Castro', 'Ponte', 'Naval', 'Sala', 'Hoz', 'Bru', 'Esca', 'Ferra'];
const TOWN_B = ['mora', 'luna', 'frida', 'seca', 'verde', 'clara', 'negra', 'dora', 'lira', 'vento', 'briga', 'cades', 'miel', 'rosa', 'zán', 'dún', 'cez', 'thar', 'lor', 'mbria'];
const TOWN_TAIL = ['', '', '', ' del Roble', ' de la Bruma', ' del Cuervo', ' la Vieja', ' de Arriba', ' del Alba', ' de los Vientos', ' del Dragón', ' la Blanca'];

const FARM_NOUNS = ['los Tres Robles', 'la Colmena', 'el Trigal', 'los Cuervos', 'el Espino', 'la Piedra Gris', 'los Sauces', 'el Brezal', 'la Fuente Vieja', 'el Molino Roto', 'las Cabras', 'la Encina Torcida', 'los Manzanos', 'la Niebla', 'el Arado', 'las Luciérnagas'];

// Sustantivos con género para componer nombres de locales sin discordancias.
const NOUNS = [
  { w: 'Jabalí', g: 'm' }, { w: 'Grifo', g: 'm' }, { w: 'Dragón', g: 'm' },
  { w: 'Zorro', g: 'm' }, { w: 'Cuervo', g: 'm' }, { w: 'Yunque', g: 'm' },
  { w: 'Caldero', g: 'm' }, { w: 'Farol', g: 'm' }, { w: 'Ciervo', g: 'm' },
  { w: 'Roble', g: 'm' }, { w: 'Búho', g: 'm' }, { w: 'Gato', g: 'm' },
  { w: 'Luna', g: 'f' }, { w: 'Sirena', g: 'f' }, { w: 'Espada', g: 'f' },
  { w: 'Rosa', g: 'f' }, { w: 'Corona', g: 'f' }, { w: 'Estrella', g: 'f' },
];
const ADJS = [
  { m: 'Dorado', f: 'Dorada' }, { m: 'Errante', f: 'Errante' },
  { m: 'Plateado', f: 'Plateada' }, { m: 'Risueño', f: 'Risueña' },
  { m: 'Dormido', f: 'Dormida' }, { m: 'Rojo', f: 'Roja' },
  { m: 'Alegre', f: 'Alegre' }, { m: 'Encantado', f: 'Encantada' },
  { m: 'Danzarín', f: 'Danzarina' }, { m: 'Astuto', f: 'Astuta' },
];

function nounPhrase(rng) {
  const n = pick(rng, NOUNS);
  const a = pick(rng, ADJS);
  const art = n.g === 'm' ? 'del' : 'de la';
  return `${art} ${n.w} ${n.g === 'm' ? a.m : a.f}`;
}

export function townName(rng) {
  return pick(rng, TOWN_A) + pick(rng, TOWN_B) + pick(rng, TOWN_TAIL);
}

export function farmName(rng) {
  return `Granja de ${pick(rng, FARM_NOUNS)}`.replace('de el ', 'del ');
}

const POI_TEMPLATES = {
  posada: (rng) => `Posada ${nounPhrase(rng)}`,
  taberna: (rng) => `Taberna ${nounPhrase(rng)}`,
  boticario: (rng) => `Botica ${nounPhrase(rng)}`,
  armeria: (rng) => `Forja ${nounPhrase(rng)}`,
  conjureria: (rng) => `Arcana ${nounPhrase(rng)}`,
  mercado: (rng) => `Mercado ${nounPhrase(rng)}`,
};

export const POI_LABELS = {
  posada: 'Posada — descansar y pasar la noche',
  taberna: 'Taberna — hablar con aldeanos y obtener trabajos',
  boticario: 'Boticario — plantas curativas y remedios',
  armeria: 'Armería y herrero — armas y armaduras',
  conjureria: 'Conjurería — libros y pergaminos mágicos',
  mercado: 'Mercado — provisiones y objetos varios',
};

export function poiName(rng, kind) {
  return POI_TEMPLATES[kind](rng);
}

// Nombre de una dirección (vector dx,dy con y hacia el norte) con sabor antiguo.
const DIR_WORDS = [
  ['del Este', 'del Alba', 'de Levante'],      // E
  ['del Nordeste', 'del Alba Fría'],           // NE
  ['del Norte', 'de las Nieves'],              // N
  ['del Noroeste', 'de los Vientos'],          // NW
  ['del Oeste', 'de Poniente', 'del Ocaso'],   // W
  ['del Suroeste', 'de las Brumas'],           // SW
  ['del Sur', 'del Mediodía'],                 // S
  ['del Sureste', 'de la Solana'],             // SE
];

export function directionWord(rng, dx, dy) {
  const ang = Math.atan2(dy, dx);
  const oct = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return pick(rng, DIR_WORDS[oct]);
}

export function roadName(rng, dirWord, toName) {
  const forms = [
    `El Camino ${dirWord}`,
    `La Calzada ${dirWord}`,
    `La Vieja Ruta ${dirWord}`,
    `El Paso ${dirWord}`,
  ];
  if (toName) forms.push(`El Camino de ${toName}`, `La Senda de ${toName}`);
  return pick(rng, forms);
}

export function worldTitle(rng) {
  const A = ['Tierras', 'Reinos', 'Marcas', 'Dominios', 'Comarcas'];
  const B = ['de', 'de', 'del', 'de la'];
  const C = { de: ['Eldoria', 'Vaeloria', 'Anduril', 'Nharem', 'Kaelun', 'Miradia'], del: ['Alba Gris', 'Roble Eterno', 'Viento Norte', 'Sol Poniente'], 'de la': ['Bruma', 'Luna Rota', 'Piedra Antigua', 'Marea Verde'] };
  const b = pick(rng, B);
  return `${pick(rng, A)} ${b} ${pick(rng, C[b])}`;
}
