// Paquete de nombres en castellano fantástico.

import { pick } from '../core/rng.js';

const TOWN_A = ['Val', 'Mon', 'Riba', 'Torre', 'Fuen', 'Peña', 'Vega', 'Mira', 'Alba', 'Cala', 'Soto', 'Villa', 'Castro', 'Ponte', 'Naval', 'Sala', 'Hoz', 'Bru', 'Esca', 'Ferra'];
const TOWN_B = ['mora', 'luna', 'frida', 'seca', 'verde', 'clara', 'negra', 'dora', 'lira', 'vento', 'briga', 'cades', 'miel', 'rosa', 'zán', 'dún', 'cez', 'thar', 'lor', 'mbria'];
const TOWN_TAIL = ['', '', '', ' del Roble', ' de la Bruma', ' del Cuervo', ' la Vieja', ' de Arriba', ' del Alba', ' de los Vientos', ' del Dragón', ' la Blanca'];

const FARM_NOUNS = ['los Tres Robles', 'la Colmena', 'el Trigal', 'los Cuervos', 'el Espino', 'la Piedra Gris', 'los Sauces', 'el Brezal', 'la Fuente Vieja', 'el Molino Roto', 'las Cabras', 'la Encina Torcida', 'los Manzanos', 'la Niebla', 'el Arado', 'las Luciérnagas'];

// Sustantivos con género para nombres de locales sin discordancias.
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
  return `${n.g === 'm' ? 'del' : 'de la'} ${n.w} ${n.g === 'm' ? a.m : a.f}`;
}

const POI_TEMPLATES = {
  posada: (rng) => `Posada ${nounPhrase(rng)}`,
  taberna: (rng) => `Taberna ${nounPhrase(rng)}`,
  boticario: (rng) => `Botica ${nounPhrase(rng)}`,
  armeria: (rng) => `Forja ${nounPhrase(rng)}`,
  conjureria: (rng) => `Arcana ${nounPhrase(rng)}`,
  mercado: (rng) => `Mercado ${nounPhrase(rng)}`,
};

const DIR_WORDS = [
  ['del Este', 'del Alba', 'de Levante'],
  ['del Nordeste', 'del Alba Fría'],
  ['del Norte', 'de las Nieves'],
  ['del Noroeste', 'de los Vientos'],
  ['del Oeste', 'de Poniente', 'del Ocaso'],
  ['del Suroeste', 'de las Brumas'],
  ['del Sur', 'del Mediodía'],
  ['del Sureste', 'de la Solana'],
];

// Parajes: base + epíteto por tipo (artículo + sustantivo + epíteto).
const PARAJE_PARTS = {
  ruina: [['La Torre', 'El Torreón', 'La Fortaleza', 'La Muralla', 'El Caserón'], ['Rota', 'Caída', 'Olvidada', 'del Rey Viejo', 'de los Ecos', 'Quemada'], { 'El Torreón': ['Roto', 'Caído', 'Olvidado', 'del Rey Viejo', 'de los Ecos', 'Quemado'], 'El Caserón': ['Roto', 'Caído', 'Olvidado', 'del Rey Viejo', 'de los Ecos', 'Quemado'] }],
  piedra: [['El Dolmen', 'El Menhir', 'La Piedra', 'Las Lajas', 'El Altar'], ['del Alba', 'de los Antiguos', 'de la Mora', 'Cantora', 'del Trueno', 'de las Runas'], { 'El Dolmen': ['del Alba', 'de los Antiguos', 'de la Mora', 'Cantor', 'del Trueno', 'de las Runas'], 'El Menhir': ['del Alba', 'de los Antiguos', 'de la Mora', 'Cantor', 'del Trueno', 'de las Runas'], 'El Altar': ['del Alba', 'de los Antiguos', 'de la Mora', 'Cantor', 'del Trueno', 'de las Runas'] }],
  ermita: [['La Ermita', 'El Santuario', 'La Capilla', 'El Crucero'], ['del Peregrino', 'Blanca', 'del Silencio', 'de la Vela', 'del Monte'], { 'El Santuario': ['del Peregrino', 'Blanco', 'del Silencio', 'de la Vela', 'del Monte'], 'El Crucero': ['del Peregrino', 'Blanco', 'del Silencio', 'de la Vela', 'del Monte'] }],
  fuente: [['La Fuente', 'El Manantial', 'El Pozo', 'La Poza'], ['de la Doncella', 'Clara', 'de los Deseos', 'Helada', 'del Susurro'], { 'El Manantial': ['de la Doncella', 'Claro', 'de los Deseos', 'Helado', 'del Susurro'], 'El Pozo': ['de la Doncella', 'Claro', 'de los Deseos', 'Helado', 'del Susurro'] }],
  atalaya: [['La Atalaya', 'El Faro', 'La Torre Vigía'], ['del Cuervo', 'del Ocaso', 'de las Señales', 'del Fin', 'de la Espera'], {}],
  cruce: [['El Cruce', 'La Encrucijada'], ['del Ahorcado', 'de las Brujas', 'del Mercader', 'de los Juramentos', 'del Perro Negro'], {}],
  puente: [['El Puente', 'El Vado', 'El Paso'], ['de Piedra', 'del Peaje', 'Viejo', 'del Troll', 'de la Última Moneda'], { 'El Puente': ['de Piedra', 'del Peaje', 'Viejo', 'del Troll', 'de la Última Moneda'] }],
  monasterio: [['El Monasterio', 'El Priorato', 'La Abadía'], ['Gris', 'del Alba', 'de los Callados', 'de la Vid', 'del Eco'], {}],
};

export const es = {
  locale: 'es',

  townName(rng) {
    return pick(rng, TOWN_A) + pick(rng, TOWN_B) + pick(rng, TOWN_TAIL);
  },

  farmName(rng) {
    return `Granja de ${pick(rng, FARM_NOUNS)}`.replace('de el ', 'del ');
  },

  poiName(rng, kind) {
    return POI_TEMPLATES[kind](rng);
  },

  directionWord(rng, dx, dy) {
    const ang = Math.atan2(dy, dx);
    const oct = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    return pick(rng, DIR_WORDS[oct]);
  },

  roadName(rng, dirWord, toName) {
    const forms = [`El Camino ${dirWord}`, `La Calzada ${dirWord}`, `La Vieja Ruta ${dirWord}`, `El Paso ${dirWord}`];
    if (toName) forms.push(`El Camino de ${toName}`, `La Senda de ${toName}`);
    return pick(rng, forms);
  },

  parajeName(rng, type) {
    const [bases, epithets, overrides] = PARAJE_PARTS[type];
    const base = pick(rng, bases);
    return `${base} ${pick(rng, overrides[base] ?? epithets)}`;
  },

  worldTitle(rng) {
    const A = ['Tierras', 'Reinos', 'Marcas', 'Dominios', 'Comarcas'];
    const B = ['de', 'de', 'del', 'de la'];
    const C = { de: ['Eldoria', 'Vaeloria', 'Anduril', 'Nharem', 'Kaelun', 'Miradia'], del: ['Alba Gris', 'Roble Eterno', 'Viento Norte', 'Sol Poniente'], 'de la': ['Bruma', 'Luna Rota', 'Piedra Antigua', 'Marea Verde'] };
    const b = pick(rng, B);
    return `${pick(rng, A)} ${b} ${pick(rng, C[b])}`;
  },
};
