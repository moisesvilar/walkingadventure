// La semilla de la partida: el dato sin el cual el mundo de un jugador no se
// puede reconstruir. Se crea con entropía inyectada —el núcleo no fabrica azar—,
// se normaliza y valida para que se pueda pasar de viva voz, y de ella cuelgan
// las semillas de cada celda y de cada fase de la tubería.

// Alfabeto de Crockford: los diez dígitos y las letras salvo I, L, O y U. Las
// tres primeras se confunden al leer con 1 y 0 y por eso se aceptan al normalizar
// en lugar de ocupar sitio; la U se excluye para no formar palabras
// desafortunadas por azar (`alcance-del-mundo.md` §1 pide una semilla que se diga
// en voz alta).
export const ALFABETO_SEMILLA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Símbolos de dato. Quince por cinco bits son 75 bits: la colisión es irrelevante. */
export const SIMBOLOS_DE_DATO = 15;

/** Longitud canónica: los quince de dato más el de control. */
export const LONGITUD_SEMILLA = SIMBOLOS_DE_DATO + 1;

/** Tamaño del grupo en la forma de presentación, `K3M7-9QTX-2BVR-5FHZ`. */
const GRUPO = 4;

// Confusiones clásicas al copiar a mano. Se aceptan en lugar de rechazarse porque
// una semilla mal tecleada que se acepta en silencio genera otro mundo, y ese es
// el peor fallo posible aquí: el jugador no tiene con qué darse cuenta.
const CONFUSIONES = { I: '1', L: '1', O: '0' };

/**
 * Dígito de control de los quince símbolos de dato.
 *
 * Suma ponderada módulo 32 con pesos impares. El peso impar no es un detalle: es
 * lo que hace que cualquier cambio de un solo símbolo altere el resultado, porque
 * los impares son invertibles módulo 32. Con pesos pares, cambiar un símbolo por
 * el que está dieciséis posiciones más allá pasaría el control sin protestar.
 */
export function digitoDeControl(datos) {
  let suma = 0;
  for (let i = 0; i < datos.length; i++) {
    const v = ALFABETO_SEMILLA.indexOf(datos[i]);
    suma = (suma + v * (2 * i + 1)) % 32;
  }
  return ALFABETO_SEMILLA[suma];
}

/**
 * Crea la semilla de una partida a partir de entropía **inyectada**.
 *
 * Es el único punto legítimo de azar del proyecto y por eso entra por la firma:
 * dentro de la generación sigue prohibido (RNF-DET-001), y con la fuente fuera una
 * prueba puede fijar la semilla sin tocar el generador.
 *
 * @param {(() => number) | ArrayLike<number>} entropia  función que devuelve
 *   números en [0,1) —se llama quince veces— o una secuencia de al menos quince
 *   números enteros (bytes, por ejemplo). No se acepta nada más: el núcleo no
 *   sabe de dónde sale el azar y no debe adivinarlo.
 * @returns {string} la semilla canónica, dieciséis símbolos sin separadores.
 */
export function creaSemilla(entropia) {
  const valores = [];
  if (typeof entropia === 'function') {
    for (let i = 0; i < SIMBOLOS_DE_DATO; i++) {
      const v = entropia();
      if (!Number.isFinite(v) || v < 0 || v >= 1) {
        throw new Error(`creaSemilla: la fuente de entropía tiene que devolver números en [0,1); devolvió ${v}`);
      }
      valores.push(Math.floor(v * 32));
    }
  } else if (entropia && typeof entropia.length === 'number') {
    if (entropia.length < SIMBOLOS_DE_DATO) {
      throw new Error(`creaSemilla: la entropía inyectada trae ${entropia.length} valores y hacen falta ${SIMBOLOS_DE_DATO}`);
    }
    for (let i = 0; i < SIMBOLOS_DE_DATO; i++) {
      const v = entropia[i];
      if (!Number.isFinite(v)) throw new Error(`creaSemilla: la entropía inyectada trae un valor que no es un número en la posición ${i}`);
      valores.push(((Math.trunc(v) % 32) + 32) % 32);
    }
  } else {
    throw new Error('creaSemilla necesita entropía inyectada: una función que devuelva números en [0,1) o una secuencia de quince números');
  }

  const datos = valores.map((v) => ALFABETO_SEMILLA[v]).join('');
  return datos + digitoDeControl(datos);
}

/**
 * Deja una semilla en su forma canónica: mayúsculas, sin guiones ni espacios y
 * con las confusiones clásicas resueltas. No valida nada — para eso está
 * `validaSemilla`—: normalizar y juzgar son dos cosas distintas y mezclarlas
 * obliga a quien teclea a acertar a la primera.
 */
export function normalizaSemilla(texto) {
  if (typeof texto !== 'string') return '';
  let out = '';
  for (const c of texto.toUpperCase()) {
    if (c === '-' || /\s/.test(c)) continue;
    out += CONFUSIONES[c] ?? c;
  }
  return out;
}

/**
 * Valida una semilla tecleada o pegada.
 *
 * @returns {{ ok: boolean, semilla: string|null, motivo: string|null }} el motivo
 *   nombra siempre qué falla: el símbolo que sobra, la longitud esperada o que
 *   está mal copiada. Un «no vale» sin motivo no se puede enseñar en una pantalla.
 */
export function validaSemilla(texto) {
  const semilla = normalizaSemilla(texto);
  if (!semilla) return { ok: false, semilla: null, motivo: 'la semilla está vacía' };

  for (const c of semilla) {
    if (!ALFABETO_SEMILLA.includes(c)) {
      return { ok: false, semilla: null, motivo: `el símbolo "${c}" no está en el alfabeto de la semilla (${ALFABETO_SEMILLA})` };
    }
  }
  if (semilla.length !== LONGITUD_SEMILLA) {
    return {
      ok: false,
      semilla: null,
      motivo: `la semilla tiene ${semilla.length} símbolos y tiene que tener ${LONGITUD_SEMILLA}`,
    };
  }
  const datos = semilla.slice(0, SIMBOLOS_DE_DATO);
  if (digitoDeControl(datos) !== semilla[SIMBOLOS_DE_DATO]) {
    return { ok: false, semilla: null, motivo: 'la semilla está mal copiada: el dígito de control no cuadra' };
  }
  return { ok: true, semilla, motivo: null };
}

/** La semilla canónica o un error que dice por qué no lo es. Lo que usa el generador. */
export function exigeSemilla(texto) {
  if (texto === undefined || texto === null || texto === '') {
    throw new Error('falta la semilla de la partida: sin ella el mundo no se puede generar, y no hay semilla por defecto');
  }
  const r = validaSemilla(texto);
  if (!r.ok) throw new Error(`semilla inválida: ${r.motivo}`);
  return r.semilla;
}

/** La forma de presentación: cuatro grupos de cuatro separados por guiones. */
export function formateaSemilla(semilla) {
  const canonica = normalizaSemilla(semilla);
  const grupos = [];
  for (let i = 0; i < canonica.length; i += GRUPO) grupos.push(canonica.slice(i, i + GRUPO));
  return grupos.join('-');
}

/**
 * Los sufijos de azar de la tubería, declarados una sola vez.
 *
 * Cada fase deriva su generador de la semilla más su sufijo para que tocar una
 * fase no desplace el azar de las demás (RNF-DET-001). Viven aquí y no repartidos
 * por los módulos porque dos fases con el mismo sufijo comparten flujo de azar sin
 * que nadie lo note, y esa es una manera silenciosa de romper el determinismo.
 *
 * `costura` está reservado aunque hoy la costura del borde no sortee nada: el día
 * que lo haga, no desplazará a ninguna otra fase.
 */
export const SUFIJOS_DE_FASE = {
  anclajes: ':anclajes',
  nucleos: ':nucleos',
  calzadas: ':routes',
  // Los ramales a parajes nombran aparte de las calzadas y por eso tienen sufijo
  // propio: cambiar cómo se nombra una senda no puede renombrar el reino entero.
  ramales: ':ramales',
  // Los tramos difíciles del callejero que OSM deja sin nombre se nombran al
  // construir el grafo, antes que nada: sufijo propio para que ensanchar el
  // repertorio de una senda no mueva ni un núcleo ni una calzada de sitio.
  tramos: ':tramos',
  parajes: ':parajes',
  titulo: ':title',
  casting: ':cast',
  costura: ':costura',
  acontecimiento: ':acontecimiento',
};

/**
 * La semilla de un mapa de la partida. El identificador del mapa es su anclaje
 * redondeado: es estable, ya está guardado y no revela más que el redondeo. Entra
 * en la derivación para que dos partidas con la misma semilla en sitios distintos
 * sigan viendo mundos distintos.
 */
export function semillaDeMapa(semilla, mapaId) {
  return `${semilla}@${mapaId}`;
}

/**
 * El sufijo del paso del mundo, declarado una sola vez como los de fase.
 *
 * Va **aparte** de `SUFIJOS_DE_FASE` a propósito: un paso no es una fase de la
 * tubería y no cuelga de ninguna celda —es una capa sobre el mundo ya generado
 * (`quests.md` decisión 4)—, así que meterlo en aquel catálogo haría que
 * `semillasDeFase` prometiera una semilla de paso por celda que nadie debe usar.
 * Lo que sí comparte con ellos es el mecanismo y el motivo: un sufijo propio para
 * que el azar de los pasos no desplace el de nada más.
 */
export const SUFIJO_DE_PASO = ':tick:';

/**
 * La semilla del paso `n` de un mapa.
 *
 * Cuelga de la semilla del mapa —no de la de una celda— porque el contador es del
 * mapa entero, y **no entra ninguna fecha ni ninguna hora**: el contenido de un
 * paso lo decide su número, que es lo que hace que volver tras tres meses enseñe lo
 * mismo que volver tras tres días.
 */
export function semillaDePaso(semilla, mapaId, n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`número de paso inválido ${JSON.stringify(n) ?? String(n)}: la semilla de un paso se deriva de su número, un entero no negativo`);
  }
  return `${semillaDeMapa(semilla, mapaId)}${SUFIJO_DE_PASO}${n}`;
}

/**
 * El sufijo del prólogo del mundo, declarado aquí por lo mismo que el del paso: un
 * sufijo propio para que su azar no desplace el de nada más.
 *
 * Va **aparte de `SUFIJOS_DE_FASE`** porque el prólogo no es una fase de la tubería
 * —es una capa sobre el mundo ya generado, igual que el motor de pasos— y meterlo
 * allí haría que `semillasDeFase` prometiera una semilla de prólogo por celda que
 * nadie debe usar.
 */
export const SUFIJO_DE_PROLOGO = ':prologo:';

/**
 * La semilla del intento `intento` del prólogo de un mapa.
 *
 * Cuelga de la semilla del **mapa**, que es lo mismo de lo que cuelga el mundo, y
 * no del estado de la partida: `game-design/arranque.md` §1 dice que dos personas
 * con la misma semilla oirían el mismo pasado, «es una propiedad del lugar, como
 * los nombres». Por eso aquí no entra ni el oficio, ni el nombre, ni una fecha.
 *
 * El número de intento entra en la derivación porque **resembrar el prólogo tiene
 * que dar otro prólogo**: sin él, los ocho intentos del tope saldrían idénticos y
 * el bucle de composición no compondría nada.
 */
export function semillaDePrologo(semilla, mapaId, intento) {
  if (!Number.isInteger(intento) || intento < 1) {
    throw new Error(`número de intento de prólogo inválido ${JSON.stringify(intento) ?? String(intento)}: los intentos se numeran desde uno con enteros positivos`);
  }
  return `${semillaDeMapa(semilla, mapaId)}${SUFIJO_DE_PROLOGO}${intento}`;
}

/**
 * La semilla del paso `n` del intento `intento` del prólogo.
 *
 * Es lo que se le inyecta al motor de SPEC-011 como base de siembra propia: mismo
 * mecanismo que `semillaDePaso`, otra rama del azar, y el contador de la partida
 * intacto en cero.
 */
export function semillaDePasoDePrologo(semilla, mapaId, intento, n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`número de paso de prólogo inválido ${JSON.stringify(n) ?? String(n)}: la semilla de un paso se deriva de su número, un entero no negativo`);
  }
  return `${semillaDePrologo(semilla, mapaId, intento)}${SUFIJO_DE_PASO}${n}`;
}

/**
 * El sufijo del sorteo de sugerencias de nombre del arranque, declarado aquí por lo
 * mismo que los del paso y el prólogo: un sufijo propio para que su azar no desplace
 * el de nada más.
 *
 * Va **aparte de `SUFIJOS_DE_FASE`** porque sortear cuatro nombres no es una fase de
 * la tubería y no cuelga de ninguna celda: ocurre antes de que exista ningún mapa, y
 * de hecho antes de que se sepa dónde se va a levantar.
 */
export const SUFIJO_DE_SUGERENCIAS = ':nombres:';

/**
 * La semilla de la ronda `ronda` de sugerencias de nombre.
 *
 * Cuelga de la semilla de la **partida** y no de la de un mapa, que todavía no
 * existe. La ronda entra en la derivación porque «↻ otro» tiene que dar otras
 * cuatro: sin ella, resortear devolvería siempre las mismas y el botón sería un
 * adorno.
 */
export function semillaDeSugerencias(semilla, ronda) {
  if (!Number.isInteger(ronda) || ronda < 0) {
    throw new Error(`ronda de sugerencias inválida ${JSON.stringify(ronda) ?? String(ronda)}: las rondas se numeran desde cero con enteros no negativos`);
  }
  return `${semilla}${SUFIJO_DE_SUGERENCIAS}${ronda}`;
}

/** La semilla de una celda concreta de un mapa. */
export function semillaDeCelda(semilla, mapaId, celda) {
  return `${semillaDeMapa(semilla, mapaId)}#${celda.i},${celda.j}`;
}

/** La semilla de una fase dentro de una celda, que es la que llega a `makeRng`. */
export function semillaDeFase(semilla, mapaId, celda, fase) {
  const sufijo = SUFIJOS_DE_FASE[fase];
  if (!sufijo) throw new Error(`fase desconocida "${fase}": las declaradas son ${Object.keys(SUFIJOS_DE_FASE).join(', ')}`);
  return semillaDeCelda(semilla, mapaId, celda) + sufijo;
}

/** Todas las semillas de fase de una celda, por si el llamante las quiere de una vez. */
export function semillasDeFase(semilla, mapaId, celda) {
  const out = {};
  for (const fase of Object.keys(SUFIJOS_DE_FASE)) out[fase] = semillaDeFase(semilla, mapaId, celda, fase);
  return out;
}
