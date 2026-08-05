// Paquete de nombres en gallego/atlántico: mundos generados en Galicia.

import { pick } from '../core/rng.js';

const TOWN_A = ['Vila', 'Castro', 'Ponte', 'Fonte', 'Souto', 'Val', 'Monte', 'Riba', 'Mira', 'Sabre', 'Outei', 'Ferrei', 'Cova', 'Lami', 'Bri'];
const TOWN_B = ['mar', 'longa', 'nova', 'vella', 'doiro', 'eira', 'zán', 'roa', 'boa', 'thar', 'ncelle', 'láns', 'dre', 'ño', 'toño'];
const TOWN_TAIL = ['', '', '', ' do Carballo', ' da Brétema', ' do Corvo', ' de Arriba', ' do Vento', ' da Moura', ' do Dragón', ' a Vella', ' a Branca'];

const FARM_NOUNS = ['os Tres Carballos', 'a Colmea', 'o Espiño', 'a Pedra Gris', 'os Salgueiros', 'o Toxal', 'a Fonte Vella', 'o Muíño Roto', 'as Cabras', 'o Carballo Torto', 'as Maceiras', 'a Néboa', 'o Arado', 'os Vagalumes'];

const NOUNS = [
  { w: 'Xabarín', g: 'm' }, { w: 'Grifo', g: 'm' }, { w: 'Dragón', g: 'm' },
  { w: 'Raposo', g: 'm' }, { w: 'Corvo', g: 'm' }, { w: 'Zafre', g: 'm' },
  { w: 'Caldeiro', g: 'm' }, { w: 'Farol', g: 'm' }, { w: 'Cervo', g: 'm' },
  { w: 'Carballo', g: 'm' }, { w: 'Moucho', g: 'm' }, { w: 'Gato', g: 'm' },
  { w: 'Lúa', g: 'f' }, { w: 'Serea', g: 'f' }, { w: 'Espada', g: 'f' },
  { w: 'Rosa', g: 'f' }, { w: 'Coroa', g: 'f' }, { w: 'Estrela', g: 'f' },
];
const ADJS = [
  { m: 'Dourado', f: 'Dourada' }, { m: 'Errante', f: 'Errante' },
  { m: 'Prateado', f: 'Prateada' }, { m: 'Ledo', f: 'Leda' },
  { m: 'Durmido', f: 'Durmida' }, { m: 'Vermello', f: 'Vermella' },
  { m: 'Feiticeiro', f: 'Feiticeira' }, { m: 'Bailador', f: 'Bailadora' },
  { m: 'Argalleiro', f: 'Argalleira' },
];

function nounPhrase(rng) {
  const n = pick(rng, NOUNS);
  const a = pick(rng, ADJS);
  return `${n.g === 'm' ? 'do' : 'da'} ${n.w} ${n.g === 'm' ? a.m : a.f}`;
}

const POI_TEMPLATES = {
  posada: (rng) => `Pousada ${nounPhrase(rng)}`,
  taberna: (rng) => `Taberna ${nounPhrase(rng)}`,
  boticario: (rng) => `Botica ${nounPhrase(rng)}`,
  armeria: (rng) => `Forxa ${nounPhrase(rng)}`,
  conjureria: (rng) => `Arcana ${nounPhrase(rng)}`,
  mercado: (rng) => `Mercado ${nounPhrase(rng)}`,
};

const DIR_WORDS = [
  ['do Leste', 'do Abrente', 'de Levante'],
  ['do Nordés', 'do Abrente Frío'],
  ['do Norte', 'das Neves'],
  ['do Noroeste', 'dos Ventos'],
  ['do Oeste', 'do Solpor', 'de Poñente'],
  ['do Suroeste', 'das Brétemas'],
  ['do Sur', 'do Mediodía'],
  ['do Sueste', 'da Solaina'],
];

const PARAJE_PARTS = {
  ruina: [['A Torre', 'O Torreón', 'A Fortaleza', 'O Pazo', 'A Muralla'], ['Rota', 'Caída', 'Esquecida', 'do Rei Vello', 'dos Ecos', 'Queimada'], { 'O Torreón': ['Roto', 'Caído', 'Esquecido', 'do Rei Vello', 'dos Ecos', 'Queimado'], 'O Pazo': ['Roto', 'Caído', 'Esquecido', 'do Rei Vello', 'dos Ecos', 'Queimado'] }],
  piedra: [['A Anta', 'O Menhir', 'A Pedra', 'As Laxes', 'O Altar'], ['da Moura', 'dos Antigos', 'do Abrente', 'Cantora', 'do Trono', 'das Runas'], { 'O Menhir': ['da Moura', 'dos Antigos', 'do Abrente', 'Cantor', 'do Trono', 'das Runas'], 'O Altar': ['da Moura', 'dos Antigos', 'do Abrente', 'Cantor', 'do Trono', 'das Runas'] }],
  ermita: [['A Ermida', 'O Santuario', 'A Capela', 'O Cruceiro'], ['do Peregrino', 'Branca', 'do Silencio', 'da Candea', 'do Monte'], { 'O Santuario': ['do Peregrino', 'Branco', 'do Silencio', 'da Candea', 'do Monte'], 'O Cruceiro': ['do Peregrino', 'Branco', 'do Silencio', 'da Candea', 'Vello'] }],
  fuente: [['A Fonte', 'O Manancial', 'O Pozo', 'A Poza'], ['da Santa', 'Clara', 'dos Desexos', 'Xeada', 'do Marmurio'], { 'O Manancial': ['da Santa', 'Claro', 'dos Desexos', 'Xeado', 'do Marmurio'], 'O Pozo': ['da Santa', 'Claro', 'dos Desexos', 'Xeado', 'do Marmurio'] }],
  atalaya: [['A Atalaia', 'O Faro', 'A Torre Vixía'], ['do Corvo', 'do Solpor', 'dos Sinais', 'da Fin', 'da Espera'], { 'O Faro': ['do Corvo', 'do Solpor', 'dos Sinais', 'da Fin', 'da Espera'] }],
  cruce: [['O Cruce', 'A Encrucillada'], ['do Aforcado', 'das Meigas', 'do Mercador', 'dos Xuramentos', 'do Can Negro'], { 'A Encrucillada': ['do Aforcado', 'das Meigas', 'do Mercador', 'dos Xuramentos', 'do Can Negro'] }],
  puente: [['A Ponte', 'O Vao', 'O Paso'], ['de Pedra', 'da Peaxe', 'Vella', 'do Demo', 'da Derradeira Moeda'], { 'O Vao': ['de Pedra', 'da Peaxe', 'Vello', 'do Demo', 'da Derradeira Moeda'], 'O Paso': ['de Pedra', 'da Peaxe', 'Vello', 'do Demo', 'da Derradeira Moeda'] }],
  monasterio: [['O Mosteiro', 'O Priorado', 'A Abadía'], ['Gris', 'do Abrente', 'dos Calados', 'da Vide', 'do Eco'], { 'A Abadía': ['Gris', 'do Abrente', 'dos Calados', 'da Vide', 'do Eco'] }],
};

export const gl = {
  locale: 'gl',

  townName(rng) {
    return pick(rng, TOWN_A) + pick(rng, TOWN_B) + pick(rng, TOWN_TAIL);
  },

  farmName(rng) {
    return `Casal de ${pick(rng, FARM_NOUNS)}`.replace('de o ', 'do ').replace('de a ', 'da ').replace('de os ', 'dos ').replace('de as ', 'das ');
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
    const forms = [`O Camiño ${dirWord}`, `A Calzada ${dirWord}`, `A Vella Ruta ${dirWord}`, `A Corredoira ${dirWord}`];
    if (toName) forms.push(`O Camiño de ${toName}`, `A Senda de ${toName}`);
    return pick(rng, forms);
  },

  parajeName(rng, type) {
    const [bases, epithets, overrides] = PARAJE_PARTS[type];
    const base = pick(rng, bases);
    return `${base} ${pick(rng, overrides[base] ?? epithets)}`;
  },

  worldTitle(rng) {
    const A = ['Terras', 'Reinos', 'Marcas', 'Dominios', 'Comarcas'];
    const B = ['de', 'de', 'do', 'da'];
    const C = { de: ['Eldoria', 'Vaeloria', 'Anduril', 'Nharem', 'Kaelun', 'Miradia'], do: ['Abrente Gris', 'Carballo Eterno', 'Vento Norte', 'Solpor'], da: ['Brétema', 'Lúa Rota', 'Pedra Antiga', 'Marea Verde'] };
    const b = pick(rng, B);
    return `${pick(rng, A)} ${b} ${pick(rng, C[b])}`;
  },
};
