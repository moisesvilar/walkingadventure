// Los tres huecos de B3 y B4: las ilustraciones por su prompt de ficción, las fotos
// del lado real por su `place_id`, y los textos ya validados en línea con su origen.
// Aquí está **la forma del hueco y no su contenido**: generar las imágenes es de la
// fila 25 y los textos, de la fila 18. Lo que esta capa responde, y es lo que sostiene
// RF-PERS-002, es qué le falta a una aventura para jugarse sin red.

import { congelaHondo } from '../core/congelar.js';
import { construyePrompt, datosRealesDeMundo, REGLAS_DE_ESCRITURA, sobreDePeticion, TONO } from '../quests/prompt.js';

/** Los dos estados de un recurso binario. No hay un tercero: o está en el móvil o no. */
export const ESTADOS = Object.freeze({ AUSENTE: 'ausente', RESIDENTE: 'residente' });

/** De dónde salió un texto del juego. Se declara siempre, porque decide qué se puede reescribir. */
export const ORIGENES_DE_TEXTO = Object.freeze(['llm', 'plantilla']);

/** Las tres familias de recurso, en el orden en que viven en el documento. */
export const FAMILIAS = Object.freeze(['ilustraciones', 'fotos', 'textos']);

/**
 * Los tres huecos vacíos, que es el estado normal hoy.
 *
 * Un mundo sin ninguna ilustración, ninguna foto y ningún texto del LLM está
 * completo y es jugable: cada hueco **declara** que está vacío en vez de no existir,
 * que es lo que permite preguntar qué falta sin que la respuesta sea un `undefined`.
 */
export function recursosVacios() {
  return { ilustraciones: [], fotos: [], textos: [] };
}

/**
 * La clave de un elemento del mundo dentro de la capa de recursos.
 *
 * Sale del tipo y del nombre de fantasía y de nada más: los nombres son únicos
 * dentro de un mundo —lo garantiza el índice de nombres— y ninguno de los dos dice
 * nada del sitio real, que es la condición de `seguridad-privacidad.md` §1.
 */
export function claveDeElemento(tipo, nombre) {
  if (!tipo || !nombre) throw new Error(`clave de elemento mal formada: llegó tipo="${tipo}" y nombre="${nombre}"`);
  return `${tipo}:${nombre}`;
}

/**
 * La clave con la que se pide y se cachea la ilustración de un prompt de ficción.
 *
 * Es **derivada del prompt** y no inventada, que es lo que fija RF-INFRA-002: el
 * proxy cachea lo inerte por esa misma clave, así que guardar la clave en lugar del
 * binario permite volver a pedir un recurso perdido sin tocar la capa de ficción. El
 * prompt es por construcción un texto sin ningún dato real, así que derivar de él no
 * reintroduce por la puerta de atrás lo que el prompt tenía prohibido llevar.
 *
 * FNV-1a de 32 bits en hexadecimal: no es criptografía, es un identificador estable
 * y el paquete no tiene dependencias con las que hacer otra cosa.
 */
export function claveDeIlustracion(prompt) {
  if (typeof prompt !== 'string' || !prompt) {
    throw new Error('claveDeIlustracion necesita el prompt de ficción: sin él no hay clave con la que pedir ni cachear la imagen');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `il_${h.toString(16).padStart(8, '0')}`;
}

/**
 * Declara la ilustración de un elemento.
 *
 * El documento guarda el prompt, su clave y la referencia al recurso local, o la
 * declaración de que no lo hay. **El binario no entra**, ni en línea ni codificado:
 * un JSON con imágenes dentro deja de poder compararse y de poder leerse por partes.
 */
export function declaraIlustracion({ elemento, prompt, recurso = null }) {
  if (!elemento) throw new Error('declaraIlustracion necesita el elemento del mundo al que ilustra');
  return {
    elemento,
    prompt,
    clave: claveDeIlustracion(prompt),
    recurso: recurso ?? null,
    estado: recurso ? ESTADOS.RESIDENTE : ESTADOS.AUSENTE,
  };
}

/**
 * Declara la foto del lado real de un anclaje.
 *
 * Se guardan el `place_id`, la referencia local y la fecha de captura, y **ninguna
 * URL de Places**, que caduca. La fecha es la única marca de reloj de todo el
 * documento y llega de un reloj **inyectado**: dentro del núcleo leer el reloj del
 * sistema está prohibido, y con el reloj fuera una prueba puede fijarla y el
 * documento sigue siendo comparable byte a byte.
 */
export function declaraFoto({ anclaje, placeId, recurso = null, capturadaEn = null, reloj = null }) {
  if (!placeId) throw new Error('declaraFoto necesita el place_id: es lo único de Places que se puede guardar');
  let fecha = capturadaEn;
  if (fecha == null && recurso != null) {
    if (typeof reloj !== 'function') {
      throw new Error(
        `la foto de ${placeId} está residente y no declara fecha de captura: pásale "capturadaEn", o inyecta un reloj — ` +
        'el núcleo no lee el reloj del sistema y sin fecha no se puede saber cuándo hay que refrescarla',
      );
    }
    fecha = reloj();
  }
  if (fecha != null && typeof fecha !== 'string') {
    throw new Error(`la fecha de captura de ${placeId} tiene que ser texto y llegó ${typeof fecha}`);
  }
  return {
    anclaje: anclaje ?? `places:${placeId}`,
    placeId,
    recurso: recurso ?? null,
    capturadaEn: fecha ?? null,
    estado: recurso ? ESTADOS.RESIDENTE : ESTADOS.AUSENTE,
  };
}

/**
 * Declara un texto ya validado.
 *
 * Los textos **sí** van en línea: `quests.md` decisión 1 manda guardarlos con la
 * partida, son texto y no mueven la aguja del tamaño, y sacarlos fuera añadiría una
 * indirección por cada frase del juego. El origen se declara siempre.
 */
export function declaraTexto({ clave, texto, origen }) {
  if (!clave) throw new Error('declaraTexto necesita la clave con la que se recupera el texto');
  if (typeof texto !== 'string') throw new Error(`el texto de "${clave}" tiene que ser texto y llegó ${typeof texto}`);
  if (!ORIGENES_DE_TEXTO.includes(origen)) {
    throw new Error(`origen de texto desconocido "${origen}" en "${clave}": los declarados son ${ORIGENES_DE_TEXTO.join(' y ')}`);
  }
  return { clave, texto, origen };
}

/**
 * La capa de recursos en su forma canónica: las tres listas, cada una ordenada por
 * su clave estable y sin repetidos.
 *
 * El orden es declarado y no el de inserción, que es lo que permite afirmar que dos
 * congelaciones del mismo mundo dan el mismo texto aunque los recursos se hayan ido
 * declarando en otro orden.
 */
export function ordenaRecursos(recursos) {
  const r = recursos ?? recursosVacios();
  const por = (clave) => (a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0);
  return {
    ilustraciones: (r.ilustraciones ?? []).slice().sort(por((x) => x.elemento)),
    fotos: (r.fotos ?? []).slice().sort(por((x) => x.anclaje)),
    textos: (r.textos ?? []).slice().sort(por((x) => x.clave)),
  };
}

/** Los recursos residentes, indexados. Se responde con esto y no recorriendo listas. */
export function inventario(recursos) {
  const r = ordenaRecursos(recursos);
  return congelaHondo({
    ilustraciones: r.ilustraciones.filter((i) => i.estado === ESTADOS.RESIDENTE).map((i) => i.elemento),
    fotos: r.fotos.filter((f) => f.estado === ESTADOS.RESIDENTE).map((f) => f.anclaje),
    textos: r.textos.map((t) => t.clave),
  });
}

/** La clave con la que se guarda el texto de un beat de una aventura. */
export function claveDeTextoDeBeat(plantilla, n) {
  return `${plantilla}:beat:${n}`;
}

/**
 * Qué le falta a una aventura para poder jugarse **sin una sola petición de red**.
 *
 * Se responde sin salir a ningún sitio, y esa es toda la frontera: conseguir lo que
 * falte es de la preparación de la salida (fila 28) y generarlo, de las filas 18 y
 * 25. `packages/nucleo/` no habla con la red (RF-INFRA-001), así que esta capa
 * enumera y no consigue.
 *
 * Lo que falta **no impide jugar**: un paraje sin ilustración cae al material de
 * plantilla y un anclaje sin foto abre su visor con la cartela sobre fondo liso. Por
 * eso la respuesta enumera, y no rechaza.
 */
export function queFaltaParaJugarSinRed({ aventura, recursos }) {
  if (!aventura || !Array.isArray(aventura.beats)) {
    throw new Error('queFaltaParaJugarSinRed necesita una aventura con sus beats: sin ellos no hay nada que enumerar');
  }
  const inv = inventario(recursos);
  const faltan = [];
  const visto = new Set();
  const anota = (familia, clave, de) => {
    const id = `${familia}|${clave}`;
    if (visto.has(id)) return;
    visto.add(id);
    faltan.push({ familia, clave, de });
  };

  for (const beat of aventura.beats) {
    const lugar = beat.lugar ?? null;
    if (lugar) {
      const elemento = claveDeElemento(lugar.tipo, lugar.nombre);
      if (!inv.ilustraciones.includes(elemento)) anota('ilustracion', elemento, `beat ${beat.n}`);
      const placeId = lugar.real?.placeId ?? null;
      if (placeId && !inv.fotos.includes(`places:${placeId}`)) anota('foto', `places:${placeId}`, `beat ${beat.n}`);
    }
    const claveTexto = claveDeTextoDeBeat(aventura.plantilla, beat.n);
    if (!inv.textos.includes(claveTexto)) anota('texto', claveTexto, `beat ${beat.n}`);
  }

  return congelaHondo({ completo: faltan.length === 0, faltan });
}

// --- Los parámetros declarados de SPEC-025 --------------------------------------
//
// Van aquí, en el núcleo y con nombre, y no escondidos en la app: los cuatro deciden
// cuánto se pide, cuánto se espera y qué pasa si los términos de Places bloquean, que
// son decisiones de producto y no detalles de cableado.

/**
 * El interruptor de Places, encendido por defecto.
 *
 * Es la mitigación del riesgo 1 del PRD §8 convertida en algo comprobable hoy: si los
 * términos bloquean se apaga y **no cambia ni un texto del juego** — el visor degrada a
 * cartela sin foto y el pool se queda en OSM, que son dos degradaciones ya diseñadas.
 */
export const PLACES_ACTIVO = true;

/** Los lugares del reparto que se ilustran por salida (RF-BUCLE-003, «los 3-5 lugares»). */
export const TOPE_ILUSTRACIONES_SALIDA = 5;

/** La pared de la preparación: al agotarse se cierra con lo que haya (RNF-PER-002). */
export const PRESUPUESTO_PREPARACION_MS = 20000;

/** La rebanada del minuto de RNF-PER-001 que el lote de fotos del mapa puede gastar. */
export const PRESUPUESTO_FOTOS_MAPA_MS = 15000;

// --- Por qué un recurso no está --------------------------------------------------

/**
 * El vocabulario **cerrado** de la ausencia, que es §6h aplicado a esta capa.
 *
 * Con un solo estado `ausente`, «Places no tiene foto de ese sitio» y «nadie cableó el
 * cliente de fotos» son indistinguibles, que es exactamente la forma de fallo que ya
 * salió cinco veces en este repositorio. Cinco motivos y ni uno más: una causa nueva se
 * añade aquí, no se entrega con una clave genérica.
 */
export const MOTIVOS_DE_AUSENCIA = Object.freeze({
  /** El anclaje no tiene sitio de Places: es de OSM y no lleva `place_id`. */
  SIN_SITIO: 'sin-sitio',
  /** El sitio existe y Places dice que no tiene foto. Es un «no hay», no un fallo. */
  SIN_FOTO: 'sin-foto',
  /** No se llegó a preguntar, o lo que volvió no se pudo interpretar. */
  NO_SE_PUDO_PEDIR: 'no-se-pudo-pedir',
  /** Cabía preguntarlo pero no cabía en el tope: del lote de la salida o del de pago. */
  TOPE: 'tope',
  /** El interruptor de Places está apagado. No es un fallo de red y no se cuenta como tal. */
  INTERRUPTOR: 'interruptor',
});

/** Las claves válidas, en orden declarado. Es lo que enumera el recuento. */
export const CLAVES_DE_AUSENCIA = congelaHondo(Object.values(MOTIVOS_DE_AUSENCIA));

/** Las familias que pueden faltar como binario. Los textos no: van en línea. */
export const FAMILIAS_DE_AUSENCIA = congelaHondo(['ilustracion', 'foto']);

/** Un motivo del catálogo, o un error que nombra el recibido y enumera los cinco. */
export function exigeMotivoDeAusencia(motivo) {
  if (!CLAVES_DE_AUSENCIA.includes(motivo)) {
    throw new Error(
      `motivo de ausencia desconocido ${JSON.stringify(motivo) ?? String(motivo)}: el vocabulario cerrado es ${CLAVES_DE_AUSENCIA.join(', ')}. ` +
      'Contar juntos «no había» y «no se pudo pedir» esconde el cableado roto, así que una causa nueva se añade al catálogo',
    );
  }
  return motivo;
}

/** Declara que un recurso no está, y **por qué**. La familia y el motivo se validan. */
export function declaraAusencia({ familia, clave, motivo }) {
  if (!FAMILIAS_DE_AUSENCIA.includes(familia)) {
    throw new Error(`familia de recurso desconocida ${JSON.stringify(familia) ?? String(familia)}: las que pueden faltar como binario son ${FAMILIAS_DE_AUSENCIA.join(' y ')}`);
  }
  if (typeof clave !== 'string' || !clave) {
    throw new Error(`una ausencia de ${familia} llega sin la clave del recurso que falta: llegó ${JSON.stringify(clave) ?? String(clave)}`);
  }
  return congelaHondo({ familia, clave, motivo: exigeMotivoDeAusencia(motivo), estado: ESTADOS.AUSENTE });
}

/**
 * El recuento de ausencias por motivo, con los cinco declarados aunque valgan cero.
 *
 * `sinMotivo` cuenta las declaraciones que llegaron sin decir por qué. Va a la vista y
 * no se suma a ningún motivo: si algún día vale más que cero, lo que hay es una
 * ausencia que nadie explicó, y eso tiene que verse en vez de repartirse.
 */
export function cuentaAusencias(ausencias) {
  const cuenta = {};
  for (const clave of CLAVES_DE_AUSENCIA) cuenta[clave] = 0;
  let sinMotivo = 0;
  for (const a of ausencias ?? []) {
    const motivo = a?.motivo ?? null;
    if (motivo == null) { sinMotivo += 1; continue; }
    cuenta[exigeMotivoDeAusencia(motivo)] += 1;
  }
  return congelaHondo({ porMotivo: cuenta, sinMotivo, total: (ausencias ?? []).length });
}

// --- El prompt de ficción de una ilustración -------------------------------------

/**
 * El punto de invocación de una ilustración.
 *
 * No es ninguno de los dos del narrador y no lo pretende: aquel catálogo es de textos y
 * este viaja dentro del prompt para decir de qué se pide una imagen.
 */
export const PUNTO_DE_ILUSTRACION = 'ilustrar-lugar';

/** El formato con el que se piden las ilustraciones. Es parámetro de la petición, no del prompt. */
export const FORMATO_DE_ILUSTRACION = congelaHondo({ tipo: 'webp', ancho: 768, alto: 1024 });

/**
 * Los campos que admite la petición de imagen del proxy, y ningún otro.
 *
 * Es la copia declarada de `ESQUEMAS.imagen` de `server/proxy.mjs`, que el núcleo no
 * puede importar —el proxy es un servidor de Node y esto corre también en el móvil—. Se
 * escribe aquí para que un caso pueda comparar las dos listas y ponerse rojo el día que
 * una se mueva sin la otra.
 */
export const CAMPOS_DE_PETICION_DE_IMAGEN = congelaHondo(['prompt', 'formato']);

/** Lo mismo para la ruta de fotos: un `place_id` y ningún campo más. */
export const CAMPOS_DE_PETICION_DE_FOTO = congelaHondo(['place_id']);

/** La escena dominante de un elemento, sin sortear nada: la de más peso, y el empate por clave. */
function escenaDominante(scenes) {
  const claves = Object.keys(scenes ?? {}).sort();
  if (!claves.length) return null;
  return claves.reduce((mejor, c) => ((scenes[c] ?? 0) > (scenes[mejor] ?? 0) ? c : mejor), claves[0]);
}

/**
 * El elemento tal como lo ve una ilustración: **solo capa de ficción**.
 *
 * Lo que entra es lo que el código produjo desde la semilla —el tipo del vocabulario del
 * juego, el nombre de fantasía, la escena de más peso y el rótulo del tipo—. Lo que
 * nunca entra es la ficha del lado real, y no por vigilancia: es que no se lee.
 *
 * @throws nombrando el elemento si no trae nombre de fantasía. Un prompt genérico daría
 *   la misma imagen para dos sitios distintos y, peor, ocultaría que falta el nombre.
 */
export function fichaDeIlustracion(elemento) {
  if (!elemento || typeof elemento !== 'object') {
    throw new Error(`la ilustración necesita el elemento del mundo y llegó ${JSON.stringify(elemento) ?? String(elemento)}`);
  }
  const tipo = elemento.type ?? elemento.tipo ?? null;
  const nombre = elemento.name ?? elemento.nombre ?? null;
  if (typeof nombre !== 'string' || !nombre.trim()) {
    throw new Error(
      `el elemento de tipo "${tipo ?? 'sin tipo'}" no tiene nombre de fantasía, así que no se le puede construir un prompt de ilustración: ` +
      'un prompt genérico daría la misma imagen para dos sitios y escondería que el nombre falta',
    );
  }
  if (typeof tipo !== 'string' || !tipo.trim()) {
    throw new Error(`el elemento "${nombre}" no declara su tipo, y el tipo es parte del prompt de su ilustración`);
  }
  return congelaHondo({
    tipo,
    nombre,
    escena: escenaDominante(elemento.scenes ?? elemento.escenas),
    rasgo: elemento.label ?? null,
  });
}

/**
 * El prompt de ficción de un elemento. **Puro, determinista y sin red.**
 *
 * El sobre pasa por la lista blanca de `quests/prompt.js` y el prompt construido se criba
 * contra los datos reales del mundo: el cribado de SPEC-018 se reutiliza entero en vez de
 * duplicarse, que es lo que hace que la afirmación de privacidad se pueda poner en rojo —
 * un nombre de fantasía que coincida con el real **hace fallar la construcción**.
 *
 * @returns `{ elemento, sobre, texto, clave }`, congelado. `clave` es la de caché, que se
 *   deriva del propio prompt y por tanto tampoco puede llevar nada real dentro.
 */
export function promptDeIlustracion({ elemento, locale, datosReales = [] }) {
  const ficha = fichaDeIlustracion(elemento);
  if (typeof locale !== 'string' || !locale) {
    throw new Error(`el prompt de la ilustración de "${ficha.nombre}" necesita el idioma del mundo y llegó ${JSON.stringify(locale) ?? String(locale)}`);
  }
  const sobre = sobreDePeticion({
    locale,
    tono: TONO,
    reglas: REGLAS_DE_ESCRITURA,
    punto: PUNTO_DE_ILUSTRACION,
    // Vocabulario del juego, nunca de OSM: `aldea`, `ruina`, `atalaya`.
    tipos: [ficha.tipo],
    nombres: [ficha.nombre],
    ...(ficha.escena ? { escena: [ficha.escena] } : {}),
    // El rasgo del sitio va como hecho ya fijado: es el rótulo del tipo de paraje, que
    // lo escribió el catálogo y no el lugar real.
    ...(ficha.rasgo ? { hechos: [ficha.rasgo] } : {}),
  }, { datosReales });
  const { texto } = construyePrompt({ sobre, datosReales });
  return congelaHondo({
    elemento: claveDeElemento(ficha.tipo, ficha.nombre),
    sobre,
    texto,
    clave: claveDeIlustracion(texto),
  });
}

/** La petición de imagen tal como viaja: el prompt de ficción, el formato, y nada más. */
export function peticionDeImagen({ prompt, formato = FORMATO_DE_ILUSTRACION }) {
  if (typeof prompt !== 'string' || !prompt) {
    throw new Error(`la petición de imagen necesita el prompt de ficción ya construido y llegó ${JSON.stringify(prompt) ?? String(prompt)}`);
  }
  return congelaHondo({ prompt, formato });
}

/** La petición de foto tal como viaja: un `place_id`, y ningún campo más. */
export function peticionDeFoto({ placeId }) {
  if (typeof placeId !== 'string' || !placeId) {
    throw new Error(`la petición de foto necesita el place_id y llegó ${JSON.stringify(placeId) ?? String(placeId)}`);
  }
  return congelaHondo({ place_id: placeId });
}

/** Los elementos del mundo que se pueden ilustrar, en el orden declarado: núcleos y parajes. */
export function elementosIlustrables(mundo) {
  if (!mundo || typeof mundo !== 'object') {
    throw new Error(`los elementos ilustrables salen del mundo congelado y llegó ${JSON.stringify(mundo) ?? String(mundo)}`);
  }
  return [...(mundo.settlements ?? []), ...(mundo.parajes ?? [])];
}

// --- Qué hace falta, y en qué momento --------------------------------------------

/**
 * Los lugares de una aventura que hay que ilustrar **al preparar la salida**.
 *
 * Uno por lugar distinto y no uno por beat, en orden de aparición, sin los que ya están
 * residentes de una salida anterior, y hasta el tope. Lo que pasa del tope no se pierde
 * de vista: sale declarado ausente con el motivo `tope`, y en la pantalla no se nota
 * porque cae a la ficha de texto, que es fallback digno ya diseñado.
 */
export function lugaresParaIlustrar({ aventura, recursos = null, tope = TOPE_ILUSTRACIONES_SALIDA }) {
  if (!aventura || !Array.isArray(aventura.beats)) {
    throw new Error('lugaresParaIlustrar necesita una aventura con sus beats: sin ellos no hay reparto del que sacar lugares');
  }
  if (!Number.isInteger(tope) || tope <= 0) {
    throw new Error(`el tope de ilustraciones por salida tiene que ser un entero positivo y llegó ${JSON.stringify(tope) ?? String(tope)}`);
  }
  const inv = inventario(recursos);
  const lote = [];
  const ausentes = [];
  const visto = new Set();
  for (const beat of aventura.beats) {
    const lugar = beat?.lugar ?? null;
    if (!lugar) continue;
    const clave = claveDeElemento(lugar.tipo, lugar.nombre);
    if (visto.has(clave)) continue;
    visto.add(clave);
    // Lo residente no se vuelve a pedir: dos aventuras por el mismo paraje comparten
    // ilustración, que es la mitad de por qué el tope de pago aguanta.
    if (inv.ilustraciones.includes(clave)) continue;
    if (lote.length >= tope) {
      ausentes.push(declaraAusencia({ familia: 'ilustracion', clave, motivo: MOTIVOS_DE_AUSENCIA.TOPE }));
      continue;
    }
    lote.push({ clave, tipo: lugar.tipo, nombre: lugar.nombre });
  }
  return congelaHondo({ familia: 'ilustracion', lote, ausentes, tope, motivos: MOTIVOS_DE_AUSENCIA });
}

/**
 * El plan de ilustraciones de una salida: los lugares que faltan, ya con su prompt de
 * ficción y su petición construidos.
 *
 * Existe para que quien consigue **no tenga que saber nada del mundo**: recibe peticiones
 * ya cribadas y las manda. Es la misma frontera de siempre —el núcleo decide qué hace
 * falta y no habla con nadie, la app consigue— llevada hasta el final, y de paso es lo
 * que permite construir y auditar el lote entero sin una sola conexión.
 */
export function planDeIlustraciones({ aventura, mundo, locale, recursos = null, tope = TOPE_ILUSTRACIONES_SALIDA, formato = FORMATO_DE_ILUSTRACION, datosReales = null }) {
  const plan = lugaresParaIlustrar({ aventura, recursos, tope });
  const reales = datosReales ?? datosRealesDeMundo(mundo);
  // El índice va **por nombre de fantasía** y no por la clave del reparto, y no es un
  // detalle: la clave del reparto lleva el rol del casting —`paraje`, `nucleo`— y el
  // elemento del mundo lleva su tipo del vocabulario del juego —`ruina`, `aldea`—, así
  // que un índice por `tipo:nombre` no acierta **nunca** y todos los prompts saldrían del
  // elemento de repuesto, sin escena y sin rasgo. Indexar por nombre es legítimo por la
  // misma razón que lo es `claveDeElemento`: los nombres son únicos dentro de un mundo, y
  // lo garantiza el índice de nombres.
  const porNombre = new Map();
  for (const e of elementosIlustrables(mundo)) {
    const nombre = e.name ?? e.nombre ?? null;
    if (nombre && !porNombre.has(nombre)) porNombre.set(nombre, e);
  }
  const lote = plan.lote.map((entrada) => {
    // El repuesto es para los lugares que no están en este mundo —un reparto sintético, o
    // una aventura de otra celda—: sale con el rol por tipo y sin escena, que es lo poco
    // que se puede decir de un lugar del que no se tiene el elemento.
    const elemento = porNombre.get(entrada.nombre) ?? { type: entrada.tipo, name: entrada.nombre };
    const prompt = promptDeIlustracion({ elemento, locale, datosReales: reales });
    return {
      clave: entrada.clave,
      prompt: prompt.texto,
      claveDeCache: prompt.clave,
      peticion: peticionDeImagen({ prompt: prompt.texto, formato }),
    };
  });
  return congelaHondo({ familia: 'ilustracion', lote, ausentes: plan.ausentes, tope, motivos: MOTIVOS_DE_AUSENCIA });
}

/**
 * Los anclajes reales que **acabaron siendo algo**, en el orden declarado.
 *
 * Núcleos, sus servicios y parajes. Lo que se quedó en el pool sin llegar a ser nada no
 * está en el mundo congelado, así que no puede colarse aquí: es la propiedad la que
 * garantiza «solo los consumidos», no un filtro que haya que recordar aplicar.
 */
export function anclajesConsumidos(mundo) {
  if (!mundo || typeof mundo !== 'object') {
    throw new Error(`los anclajes consumidos salen del mundo congelado y llegó ${JSON.stringify(mundo) ?? String(mundo)}`);
  }
  const out = [];
  for (const s of mundo.settlements ?? []) {
    const ficha = s.anchor ?? s.real ?? null;
    if (ficha) out.push({ rol: 'nucleo', nombre: s.name, ficha });
    for (const v of s.services ?? []) if (v.real) out.push({ rol: 'servicio', nombre: v.name, ficha: v.real });
  }
  for (const p of mundo.parajes ?? []) if (p.real) out.push({ rol: 'paraje', nombre: p.name, ficha: p.real });
  return out;
}

/**
 * Los sitios de una celda recién generada de los que se pide foto, **en un solo lote y
 * al terminar de generar**.
 *
 * El momento no es un detalle de implementación: pedirlas al aceptar una aventura le
 * contaría al proxy qué sitios reales tienes cerca y cuándo, y pedirlas aquí no añade
 * ninguna revelación sobre la que ya hizo la consulta del mapa (`bucle-jugable.md` §2).
 *
 * Con el interruptor apagado el lote sale vacío y **todos** los anclajes salen ausentes
 * con el motivo `interruptor`: preguntar por qué no hay fotos tiene que responder el
 * interruptor y no un fallo de red.
 */
export function sitiosParaFotografiar({ mundo, recursos = null, placesActivo = PLACES_ACTIVO } = {}) {
  const consumidos = anclajesConsumidos(mundo);
  const inv = inventario(recursos);
  const lote = [];
  const ausentes = [];
  const visto = new Set();

  for (const { rol, nombre, ficha } of consumidos) {
    const placeId = ficha?.placeId ?? null;
    const clave = placeId ? `places:${placeId}` : `${rol}:${nombre}`;
    if (visto.has(clave)) continue;
    visto.add(clave);
    if (!placesActivo) {
      ausentes.push(declaraAusencia({ familia: 'foto', clave, motivo: MOTIVOS_DE_AUSENCIA.INTERRUPTOR }));
      continue;
    }
    // Un anclaje de OSM sin `place_id` se queda sin foto. Resolverle uno preguntándole a
    // Places por cada sitio queda **fuera de alcance** y es hueco declarado: multiplicaría
    // el lote y sacaría del móvil sitios que hoy no salen.
    if (!placeId) {
      ausentes.push(declaraAusencia({ familia: 'foto', clave, motivo: MOTIVOS_DE_AUSENCIA.SIN_SITIO }));
      continue;
    }
    if (inv.fotos.includes(clave)) continue;
    lote.push({ clave, placeId, rol, peticion: peticionDeFoto({ placeId }) });
  }
  return congelaHondo({ familia: 'foto', lote, ausentes, placesActivo, motivos: MOTIVOS_DE_AUSENCIA });
}

/**
 * Comprueba que todo lo declarado residente está de verdad en el almacén.
 *
 * «Perderlo» y «no haberlo tenido nunca» tienen que ser distinguibles: un documento que
 * promete una foto cuyo binario no está no puede levantarse en silencio con la cartela
 * sobre fondo liso, porque eso es exactamente lo que hace un mundo que nunca la tuvo.
 *
 * @param {(referencia: string) => boolean} tiene  el almacén, **inyectado**: el núcleo no
 *   abre ficheros. Su ausencia es error de construcción y no un mundo sin recursos.
 */
export function exigeResidentes({ recursos, tiene }) {
  if (typeof tiene !== 'function') {
    throw new Error(
      'exigeResidentes necesita el almacén de recursos binarios inyectado: sin él no se puede distinguir un recurso perdido de uno que nunca se tuvo, ' +
      'y devolver «está todo» sin haber mirado es la degradación silenciosa que esto viene a impedir',
    );
  }
  const r = ordenaRecursos(recursos);
  for (const i of r.ilustraciones) {
    if (i.estado !== ESTADOS.RESIDENTE) continue;
    if (!tiene(i.recurso)) {
      throw new Error(`la ilustración de "${i.elemento}" está declarada residente y su recurso "${i.recurso}" no está en el almacén: se ha perdido, que no es lo mismo que no haberla tenido nunca`);
    }
  }
  for (const f of r.fotos) {
    if (f.estado !== ESTADOS.RESIDENTE) continue;
    if (!tiene(f.recurso)) {
      throw new Error(`la foto de "${f.anclaje}" está declarada residente y su recurso "${f.recurso}" no está en el almacén: se ha perdido, que no es lo mismo que no haberla tenido nunca`);
    }
  }
  return true;
}
