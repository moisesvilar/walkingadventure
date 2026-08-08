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

// Nombres de persona, con **repertorio equilibrado**: el mismo número en cada
// género (`game-design/lenguaje.md`, «reparto equilibrado por generación, no por
// casualidad»). Que las dos listas midan lo mismo no es cosmético: el reparto de
// la capa de NPCs se estratifica por puesto, y un repertorio corto en un género
// haría que sus caras se repitieran mucho antes que las del otro.
const NOMBRES_DE_PERSONA = {
  femenino: ['Elvira', 'Ainara', 'Sancha', 'Berta', 'Xiomara', 'Urraca', 'Leonor', 'Marina', 'Aldara', 'Rosenda', 'Ginebra', 'Tecla', 'Fermina', 'Onega', 'Casilda', 'Mencía', 'Ilduara', 'Brígida', 'Nunila', 'Dulce'],
  masculino: ['Bermudo', 'Rodrigo', 'Anselmo', 'Fruela', 'Nuño', 'Osorio', 'Gonzalo', 'Aldarico', 'Teodoro', 'Serapio', 'Bruno', 'Mendo', 'Suero', 'Ramiro', 'Vitorio', 'Cándido', 'Ordoño', 'Fabián', 'Blas', 'Lupo'],
};

// Epítetos de persona, concordados. Son de carácter y de rasgo, nunca de oficio:
// el oficio ya lo dice el puesto, y meterlo aquí volvería a pegar el estereotipo al
// nombre por la puerta de atrás. Sirven para dos cosas —agrandar el repertorio y
// desempatar dos nombres iguales—, y por eso hay los mismos en cada género.
const EPITETOS_DE_PERSONA = {
  femenino: ['la Zurda', 'la Callada', 'la Templada', 'la Roja', 'la Menuda', 'la del Norte', 'la Risueña', 'la Sorda', 'la Vieja', 'la Ligera', 'la Áspera', 'la Madrugadora'],
  masculino: ['el Zurdo', 'el Callado', 'el Templado', 'el Rojo', 'el Menudo', 'el del Norte', 'el Risueño', 'el Sordo', 'el Viejo', 'el Ligero', 'el Áspero', 'el Madrugador'],
};

// Epítetos de sitio para desempatar nombres repetidos. Todos son sintagmas
// preposicionales y no adjetivos: valen igual para «El Pozo» y para «La Fuente»,
// sin discordancias de género.
const VARIANT_TAILS = ['de Arriba', 'de Abajo', 'del Alba', 'del Ocaso', 'de la Umbría', 'de la Solana', 'del Norte', 'del Sur', 'de Levante', 'de Poniente', 'del Camino', 'del Valle'];

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

  /**
   * El nombre de un ramal: la senda que lleva a un paraje.
   *
   * No es `roadName` y no puede serlo: `roadName` produce calzadas del reino —«El
   * Camino del Este»— y un desvío de doscientos metros anunciado así miente sobre
   * lo que hay. Aquí el registro es el de la senda, la vereda y la escalinata.
   *
   * `rasgo` (`'escalones'`, `'tierra'`, `'estrecho'` o nada) **sesga** la forma
   * base, no la determina: si el dato no está, el nombre sale igual.
   *
   * **Sin `rng` devuelve la forma construida sobre `hastaName`**, que es la caída
   * garantizada de la unicidad: es única porque el nombre del paraje lo es y cada
   * paraje recibe como mucho un ramal.
   */
  ramalName(rng, dirWord, hastaName, rasgo) {
    if (!rng) return `La Senda de ${hastaName}`;
    const forms = [`La Senda ${dirWord}`, `La Vereda ${dirWord}`, `El Sendero ${dirWord}`, `La Trocha ${dirWord}`];
    if (rasgo === 'escalones') forms.push(`La Escalinata ${dirWord}`, `Los Peldaños ${dirWord}`);
    if (rasgo === 'tierra') forms.push(`El Camino de Tierra ${dirWord}`, `La Carrilada ${dirWord}`);
    if (rasgo === 'estrecho') forms.push(`El Paso Angosto ${dirWord}`, `La Callejuela ${dirWord}`);
    if (hastaName) forms.push(`La Senda de ${hastaName}`, `La Vereda de ${hastaName}`);
    return pick(rng, forms);
  },

  parajeName(rng, type) {
    const [bases, epithets, overrides] = PARAJE_PARTS[type];
    const base = pick(rng, bases);
    return `${base} ${pick(rng, overrides[base] ?? epithets)}`;
  },

  // Regla de desempate de la interfaz común: el nombre que sale de aquí sigue
  // siendo un nombre del idioma del mundo, y no un identificador técnico pegado al
  // final —un «(2)» en el rótulo de un mapa rompe la ficción—. No recibe rng a
  // propósito: es función del nombre y del intento, así que dos generaciones con
  // la misma semilla desambiguan igual sin consumir el azar de ninguna fase. Con
  // el repertorio agotado encadena epítetos, de modo que siempre hay uno libre.
  variantName(base, intento) {
    let nombre = base;
    let k = Math.max(0, Math.floor(intento) || 0);
    do {
      nombre += ` ${VARIANT_TAILS[k % VARIANT_TAILS.length]}`;
      k = Math.floor(k / VARIANT_TAILS.length);
    } while (k > 0);
    return nombre;
  },

  /**
   * El nombre propio de una cara, con su género.
   *
   * Es la ampliación de la interfaz común que pide la capa de NPCs (SPEC-014): sin
   * ella no hay nombres de persona, y un idioma nuevo nacería sin caras. Un paquete
   * que no la implemente deja de cumplir la interfaz.
   *
   * **Un género sin repertorio falla nombrando el idioma y el género**, en lugar de
   * caer en el otro: el equilibrio del reparto es un requisito y una degradación
   * silenciosa lo rompería sin que ninguna prueba lo viera.
   *
   * **Sin `rng` devuelve la forma de desempate**, igual que `ramalName`: encadena
   * epítetos sobre `base`, así que siempre hay un nombre libre por más caras que
   * tenga el mapa. Se resuelve sin azar a propósito, para que desempatar no consuma
   * el azar de la cara y dos generaciones desempaten igual.
   */
  personName(rng, genero, { base = null, intento = 0 } = {}) {
    const nombres = NOMBRES_DE_PERSONA[genero];
    const epitetos = EPITETOS_DE_PERSONA[genero];
    if (!nombres || !epitetos) {
      throw new Error(
        `el paquete de idioma "es" no tiene repertorio de nombres de persona para el género ${JSON.stringify(genero) ?? String(genero)}: ` +
        `los que declara son ${Object.keys(NOMBRES_DE_PERSONA).join(', ')}`,
      );
    }
    if (!rng) {
      if (typeof base !== 'string' || !base) {
        throw new Error('el desempate de un nombre de persona necesita el nombre base sobre el que encadenar el epíteto');
      }
      let nombre = base;
      let k = Math.max(0, Math.floor(intento) || 0);
      do {
        nombre += ` ${epitetos[k % epitetos.length]}`;
        k = Math.floor(k / epitetos.length);
      } while (k > 0);
      return nombre;
    }
    const nombre = pick(rng, nombres);
    const epiteto = pick(rng, epitetos);
    // El nombre a secas sale menos que el nombre con epíteto: en un reparto de nueve
    // personas, «Elvira» y «Elvira la Zurda» se distinguen mejor que dos Elviras.
    return pick(rng, [nombre, `${nombre} ${epiteto}`, `${nombre} ${epiteto}`]);
  },

  worldTitle(rng) {
    const A = ['Tierras', 'Reinos', 'Marcas', 'Dominios', 'Comarcas'];
    const B = ['de', 'de', 'del', 'de la'];
    const C = { de: ['Eldoria', 'Vaeloria', 'Anduril', 'Nharem', 'Kaelun', 'Miradia'], del: ['Alba Gris', 'Roble Eterno', 'Viento Norte', 'Sol Poniente'], 'de la': ['Bruma', 'Luna Rota', 'Piedra Antigua', 'Marea Verde'] };
    const b = pick(rng, B);
    return `${pick(rng, A)} ${b} ${pick(rng, C[b])}`;
  },
};
