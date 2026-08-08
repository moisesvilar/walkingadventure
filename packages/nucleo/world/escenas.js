// El vocabulario de escenas que un mundo tiene que saber decir, y la aritmética
// del suelo de parajes que sale de contarlo.
//
// Vive aparte del catálogo de plantillas a propósito: el generador de parajes
// recibe el vocabulario **inyectado** y no puede depender de quién lo declara
// (SPEC-006, «La dependencia circular, declarada»). Este módulo no importa nada.

/**
 * Escenas que se le pueden pedir a un paraje al derivar el suelo: dos.
 *
 * Es el mínimo garantizado que declara `game-design/parajes.md` («cada paraje
 * lleva dos o más»), no el mínimo que hoy tiene la tabla de tipos. Contar los de
 * hoy daría un suelo más bajo y optimista, y el documento manda.
 */
export const ESCENAS_POR_PARAJE = 2;

/**
 * Peso mínimo con el que una escena se da por cubierta cuando el rol no declara
 * otro. Es el mismo que exige el casting: si aquí fuera más laxo, el mundo se
 * daría por cubierto con parajes que el casting luego rechaza.
 */
export const PESO_MINIMO_DE_ESCENA = 0.2;

/**
 * Normaliza el vocabulario recibido a `[{ escena, pesoMinimo }]`, ordenado por
 * escena y sin repetidas.
 *
 * Acepta nombres sueltos (`'guarida'`) o entradas con peso (`{ escena, pesoMinimo }`).
 * Cuando dos roles piden la misma escena con pesos distintos manda el mayor: es la
 * exigencia más dura, y cubrirla cubre también la otra.
 *
 * Ordenado antes de salir porque de esta lista cuelga un número de generación: un
 * vocabulario que llegara en otro orden daría otro mundo.
 */
export function normalizaVocabulario(vocabulario) {
  if (vocabulario == null) return [];
  if (!Array.isArray(vocabulario)) {
    throw new Error(`el vocabulario de escenas tiene que ser una lista de escenas y llegó ${typeof vocabulario}`);
  }
  const pesos = new Map();
  for (const entrada of vocabulario) {
    const escena = typeof entrada === 'string' ? entrada : entrada?.escena;
    if (typeof escena !== 'string' || escena.length === 0) {
      throw new Error(`el vocabulario de escenas trae una entrada sin nombre de escena: ${JSON.stringify(entrada)}`);
    }
    const pedido = typeof entrada === 'string' ? PESO_MINIMO_DE_ESCENA : entrada.pesoMinimo ?? PESO_MINIMO_DE_ESCENA;
    if (!Number.isFinite(pedido) || pedido <= 0) {
      throw new Error(`la escena "${escena}" declara un peso mínimo que no es un número positivo: ${pedido}`);
    }
    pesos.set(escena, Math.max(pesos.get(escena) ?? 0, pedido));
  }
  return [...pesos.keys()]
    .sort()
    .map((escena) => Object.freeze({ escena, pesoMinimo: pesos.get(escena) }));
}

/**
 * El suelo de parajes de cualquier celda: escenas distintas del vocabulario entre
 * las que lleva un paraje, hacia arriba.
 *
 * **Es una regla viva**: si el catálogo se ensancha, el suelo sube solo, sin tocar
 * ninguna constante. Aquí no hay ninguna cifra de suelo escrita a mano.
 */
export function sueloDeVocabulario(vocabulario) {
  return Math.ceil(normalizaVocabulario(vocabulario).length / ESCENAS_POR_PARAJE);
}

/**
 * Las escenas de un vocabulario que un tipo de paraje cubre, mirando sus pesos.
 *
 * `escenasDelTipo` es el objeto `{ escena: peso }` de la taxonomía. Una escena
 * cuenta como cubierta solo si el peso del tipo alcanza el mínimo que pide el rol:
 * un paraje que roza la escena no sirve para castear la quest que la pide.
 */
export function escenasQueCubre(escenasDelTipo, vocabulario) {
  if (!escenasDelTipo || typeof escenasDelTipo !== 'object') {
    throw new Error('un tipo de paraje sin escenas con pesos no puede cubrir nada: revisa la taxonomía');
  }
  return normalizaVocabulario(vocabulario)
    .filter(({ escena, pesoMinimo }) => (escenasDelTipo[escena] ?? 0) >= pesoMinimo)
    .map(({ escena }) => escena);
}
