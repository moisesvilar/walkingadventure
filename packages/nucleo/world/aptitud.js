// Qué se puede afirmar de un tramo del viario con lo que trae OSM: escalones,
// firme, bordillos y paso, cada uno con **tres** estados y no dos. El tercero —«no
// se sabe»— es de primera clase a propósito: colapsarlo a dos convierte la ausencia
// de dato en una promesa, y por este mundo se camina de verdad.
//
// Es marca **del mundo**: sale de los tags, no de ningún jugador, y por eso se
// calcula al construir el grafo de la celda y no al trazar. Si dependiera de lo que
// alguien evita, cambiar un ajuste resembraría el mundo, que es justo lo que
// RF-MUNDO-005 prohíbe.

/**
 * Los cuatro criterios. Son cuatro y no seis: `game-design/accesibilidad.md` §2
 * enumera seis **tags**, que son evidencia y no criterio — `smoothness` alimenta el
 * firme y `width` alimenta el paso.
 *
 * Y no hay ninguno de pendiente. No es un olvido: `incline` está poco mapeado y
 * este proyecto no tiene modelo de elevación, así que las cuestas se declaran en la
 * ficha en vez de fingir que están cubiertas (`accesibilidad.md` §2 y pendiente 2).
 */
export const CRITERIOS = Object.freeze(['escalones', 'firme', 'bordillos', 'paso']);

/** Los tres valores de cada criterio. */
export const APTITUDES = Object.freeze({
  APTO: 'apto',
  NO_APTO: 'no-apto',
  /** Ni promete ni niega: el dato no alcanza para afirmar nada. */
  NO_SE_SABE: 'no-se-sabe',
});

export const VALORES_DE_APTITUD = Object.freeze([APTITUDES.APTO, APTITUDES.NO_APTO, APTITUDES.NO_SE_SABE]);

/**
 * El motivo en clave con el que se declara cada criterio. En clave y no redactado:
 * la frase la escribe quien pinta la pantalla, con el paquete de idioma del mundo.
 */
export const MOTIVOS_POR_CRITERIO = Object.freeze({
  escalones: 'escalones',
  firme: 'firme',
  bordillos: 'bordillo',
  paso: 'paso',
});

/** El motivo de lo que nos inventamos nosotros, que nunca se promete transitable. */
export const MOTIVO_DE_SUPOSICION = 'suposicion';

/** Los motivos que esta capa puede entregar, para poder enumerarlos en un sitio. */
export const MOTIVOS = Object.freeze([...Object.values(MOTIVOS_POR_CRITERIO), MOTIVO_DE_SUPOSICION]);

/**
 * Anchura por debajo de la cual el paso queda en no apto. No sale de
 * `game-design/`, que lista `width` entre lo filtrable pero no fija número: se
 * declara aquí para que se pueda corregir en un solo sitio.
 */
export const ANCHURA_MINIMA_M = 0.9;

/** Altura de bordillo que todavía se pasa. Es el corte con el que OSM documenta `kerb=lowered`. */
export const ALTURA_DE_BORDILLO_APTA_M = 0.03;

/**
 * Firmes que sí se pueden afirmar duros. Lo que no está ni aquí ni en la lista
 * blanda —`compacted`, `sett`, un valor raro— **no cae en ninguna de las dos**: no
 * se inventa una aptitud, se queda en «no se sabe».
 */
export const SUPERFICIES_DURAS = Object.freeze([
  'asphalt', 'paved', 'concrete', 'concrete:plates', 'concrete:lanes', 'paving_stones', 'chipseal', 'metal',
]);

/** Firmes que sí se pueden afirmar blandos. */
export const SUPERFICIES_BLANDAS = Object.freeze([
  'ground', 'dirt', 'earth', 'mud', 'sand', 'grass', 'grass_paver', 'gravel', 'fine_gravel',
  'pebblestone', 'woodchips', 'cobblestone', 'unhewn_cobblestone', 'unpaved', 'rock', 'stepping_stones',
]);

/** `smoothness` que afirma buen firme. */
export const SUAVIDAD_BUENA = Object.freeze(['excellent', 'good']);

/**
 * `smoothness` que afirma mal firme. `intermediate` queda fuera a propósito: es
 * exactamente el valor sobre el que dos personas no opinarían igual, y decidir por
 * ellas es lo que este documento prohíbe.
 */
export const SUAVIDAD_MALA = Object.freeze(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable']);

/** Bordillos que se pasan y bordillos que no. `kerb=yes` no dice altura: no se sabe. */
export const BORDILLOS_APTOS = Object.freeze(['flush', 'lowered']);
export const BORDILLOS_NO_APTOS = Object.freeze(['raised']);

/** `wheelchair` que afirma paso. `limited` no está: es «con condiciones», y eso es no saberlo. */
export const PASO_AFIRMADO = Object.freeze(['yes', 'designated']);

/** Los tags de los que sale la marca. Es lo que la consulta de callejero tiene que traer. */
export const TAGS_QUE_HACEN_FALTA = Object.freeze(['highway', 'surface', 'smoothness', 'width', 'kerb', 'wheelchair']);

/** La marca de lo que nos inventamos: tres estados, y el tercero en los cuatro criterios. */
export const APTITUD_SUPUESTA = Object.freeze({
  escalones: APTITUDES.NO_SE_SABE,
  firme: APTITUDES.NO_SE_SABE,
  bordillos: APTITUDES.NO_SE_SABE,
  paso: APTITUDES.NO_SE_SABE,
});

/**
 * Los metros de una medida de OSM, o null si no hay número que interpretar.
 *
 * `width` llega tal cual lo tecleó quien mapeó: `0.9`, `0,9 m`, `90 cm`. Con unidad
 * se convierte; sin unidad son metros, que es lo que OSM documenta. Lo que no es un
 * número interpretable —`narrow`, `1;2`, un pie en comillas— se trata como si el
 * tag no viniera, que es distinto de tratarlo como estrecho.
 */
export function interpretaMetros(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) && valor > 0 ? valor : null;
  if (typeof valor !== 'string') return null;
  const m = valor.trim().match(/^(\d+(?:[.,]\d+)?)\s*(m|metre|metres|meter|meters|cm|mm)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unidad = (m[2] ?? 'm').toLowerCase();
  if (unidad === 'cm') return n / 100;
  if (unidad === 'mm') return n / 1000;
  return n;
}

// La evidencia negativa gana a la positiva, y las dos a la ausencia: un firme
// declarado malo sobre un asfalto declarado es alguien que ha estado allí
// contándolo, y prometerlo apto porque el otro tag dice asfalto sería exactamente
// fingir cobertura.
function combina(...valores) {
  if (valores.includes(APTITUDES.NO_APTO)) return APTITUDES.NO_APTO;
  if (valores.includes(APTITUDES.APTO)) return APTITUDES.APTO;
  return APTITUDES.NO_SE_SABE;
}

/**
 * Dos afirmaciones sobre el mismo bordillo, en una. Se exporta porque un nodo de
 * OSM puede llegar dos veces con valores distintos y quien indexa los bordillos
 * tiene que resolverlo igual que se resuelve aquí; y porque la operación es
 * conmutativa, que es lo que hace que el orden de llegada no cambie el resultado.
 */
export function combinaBordillos(...valores) {
  return combina(...valores.filter((v) => v != null));
}

/**
 * La aptitud que afirma un valor de bordillo, venga del nodo del cruce o del tag de
 * la vía. `null` cuando no hay ni tag de bordillo ni altura.
 */
export function bordilloDeTags(tags) {
  if (!tags) return null;
  const altura = interpretaMetros(tags['kerb:height']);
  const porAltura = altura == null ? null : altura <= ALTURA_DE_BORDILLO_APTA_M ? APTITUDES.APTO : APTITUDES.NO_APTO;
  const kerb = typeof tags.kerb === 'string' ? tags.kerb : null;
  const porValor = kerb == null
    ? null
    : BORDILLOS_APTOS.includes(kerb)
      ? APTITUDES.APTO
      : BORDILLOS_NO_APTOS.includes(kerb)
        ? APTITUDES.NO_APTO
        : APTITUDES.NO_SE_SABE;
  // Un `barrier=kerb` sin más dice que hay bordillo y calla su altura, que es el
  // caso masivo: no se sabe, y sobre todo no se da por apto.
  const hayBordillo = porValor != null || porAltura != null || tags.barrier === 'kerb';
  if (!hayBordillo) return null;
  const conocidos = [porAltura, porValor].filter((v) => v != null);
  return conocidos.length ? combina(...conocidos) : APTITUDES.NO_SE_SABE;
}

/**
 * La marca de una vía a partir de sus tags.
 *
 * La ausencia de tag **no es aptitud**, salvo en escalones: `highway` viene siempre
 * y una vía que no es `steps` no tiene escalones, así que ahí la ausencia sí
 * afirma. En firme, bordillos y paso, no saberlo se dice.
 */
export function aptitudDeVia(tags) {
  const t = tags ?? {};

  const escalones = typeof t.highway !== 'string' || t.highway === ''
    ? APTITUDES.NO_SE_SABE
    : t.highway === 'steps'
      ? APTITUDES.NO_APTO
      : APTITUDES.APTO;

  const porSuperficie = typeof t.surface !== 'string'
    ? null
    : SUPERFICIES_DURAS.includes(t.surface)
      ? APTITUDES.APTO
      : SUPERFICIES_BLANDAS.includes(t.surface)
        ? APTITUDES.NO_APTO
        : null;
  const porSuavidad = typeof t.smoothness !== 'string'
    ? null
    : SUAVIDAD_BUENA.includes(t.smoothness)
      ? APTITUDES.APTO
      : SUAVIDAD_MALA.includes(t.smoothness)
        ? APTITUDES.NO_APTO
        : null;
  const firme = combina(...[porSuperficie, porSuavidad].filter((v) => v != null));

  const bordillos = bordilloDeTags(t) ?? APTITUDES.NO_SE_SABE;

  const anchura = interpretaMetros(t.width);
  const porAnchura = anchura == null ? null : anchura < ANCHURA_MINIMA_M ? APTITUDES.NO_APTO : APTITUDES.APTO;
  const porSilla = typeof t.wheelchair !== 'string'
    ? null
    // `limited` es «con condiciones», y convertirlo en negativa decide por quien
    // juega: tú sabes de tu barrio más que OSM (`accesibilidad.md` §2).
    : t.wheelchair === 'no'
      ? APTITUDES.NO_APTO
      : PASO_AFIRMADO.includes(t.wheelchair)
        ? APTITUDES.APTO
        : null;
  const paso = combina(...[porAnchura, porSilla].filter((v) => v != null));

  return Object.freeze({ escalones, firme, bordillos, paso });
}

/**
 * La misma marca con los bordillos de los nodos de sus extremos incorporados.
 *
 * En OSM el bordillo vive en el **nodo** del cruce, no en la vía: pedir solo ways
 * deja este criterio permanentemente en «no se sabe», que es cumplir la spec sin
 * servir de nada.
 */
export function conBordillos(marca, valores) {
  const conocidos = (valores ?? []).filter((v) => v != null);
  if (!conocidos.length) return marca;
  return Object.freeze({ ...marca, bordillos: combina(marca.bordillos, ...conocidos) });
}

/**
 * Comprueba que una marca declara los cuatro criterios con uno de los tres valores.
 * Falla nombrando lo que falta: una marca a medias es un error de construcción, no
 * un «no lo sé», y con un campo opcional perderla y no haberla tenido nunca son
 * indistinguibles.
 */
export function validaAptitud(marca, quien = 'el tramo') {
  if (!marca || typeof marca !== 'object') {
    throw new Error(`${quien} no declara su marca de aptitud (llegó ${JSON.stringify(marca) ?? String(marca)})`);
  }
  for (const criterio of CRITERIOS) {
    const v = marca[criterio];
    if (v === undefined) throw new Error(`${quien} no declara el criterio "${criterio}" de su marca de aptitud`);
    if (!VALORES_DE_APTITUD.includes(v)) {
      throw new Error(`${quien} declara "${criterio}" con un valor desconocido: ${JSON.stringify(v)} (los tres son ${VALORES_DE_APTITUD.join(', ')})`);
    }
  }
  return marca;
}

/**
 * El reparto de la marca sobre un conjunto de tramos: cuántos apto, cuántos no apto
 * y cuántos en «no se sabe» por cada criterio. Es lo que deja medir de un vistazo
 * cuánto del mundo es dato y cuánto es silencio de OSM.
 */
export function cuentaAptitudes(marcas) {
  const out = {};
  for (const criterio of CRITERIOS) out[criterio] = { apto: 0, noApto: 0, noSeSabe: 0 };
  for (const marca of marcas ?? []) {
    for (const criterio of CRITERIOS) {
      const v = marca?.[criterio];
      if (v === APTITUDES.APTO) out[criterio].apto++;
      else if (v === APTITUDES.NO_APTO) out[criterio].noApto++;
      else out[criterio].noSeSabe++;
    }
  }
  return out;
}
