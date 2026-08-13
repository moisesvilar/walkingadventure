// La escena de un beat y lo que te llevas: las dos pantallas de un beat resuelto
// (A4P3 y A4P4), compuestas **como dato** desde el beat casteado entero.
//
// Vive en el paquete y no en la app por lo mismo que la secuencia de una llegada: así
// «hay exactamente una acción que avanza», «no hay ningún retrato» y «no aparece
// ninguna cifra» se pueden poner rojos en `node --test` sobre los ocho mundos de
// referencia, sin simulador y sin dispositivo. Lo que la app hace con esto es pintarlo.
//
// Tres decisiones gobiernan lo de aquí abajo:
//
//   · **Un solo botón, con el verbo de lo que se hace.** `quests.md` §2 deja la cadena
//     lineal de inicio y la ramificación es exclusión 9 del PRD, así que aquí no hay
//     una lista de acciones con un elemento: hay **una** acción, y no cabe otra.
//   · **La franja no se anuncia nunca.** Llegar fuera de ella resuelve el beat igual y
//     lo único que cambia es qué variante se lee. Ni «llegaste tarde», ni un reloj en
//     pantalla, ni una marca de que hubiera franja: quien juega no tiene por qué
//     enterarse de que la había.
//   · **El único registro de aplicación es el tamaño de letra.** Todo lo demás es voz
//     del mundo. El modo compañía es texto escrito para leerse en voz alta
//     (`personaje.md` §4), y dos personas leyendo de un móvil necesitan poder agrandarlo
//     sin salir de la escena.

import { congelaHondo } from '../core/congelar.js';
import { infraccionesDeTexto, reglaDeFormula } from '../names/lenguaje.js';
import { SIN_OBJETOS, exigeTenencia, resuelveBifurcacion } from '../partida/objetos.js';
import { rotuloDePuesto } from '../partida/puestos.js';
import { dentroDeFranja, exigeMinutoDelDia } from './aventura.js';

// --- El estado del momento y los identificadores de la pantalla ---------------

/** Los tres estados que la escena puede declarar. Vocabulario cerrado. */
export const ESTADOS_DE_ESCENA = congelaHondo(['escena', 'lo-que-te-llevas', 'sin-escena']);

/**
 * Los identificadores con los que se afirma la composición desde fuera.
 *
 * `design-system.md` pide siempre el estado del momento y el mapa; el mapa no está en
 * esta pantalla, así que de ella cuelga el estado y nada más.
 */
export const TESTIDS = congelaHondo({
  estado: 'escena-estado',
  escena: 'escena',
  cara: 'escena-cara',
  accion: 'escena-accion',
  tamanoDeTexto: 'escena-tamano-texto',
  texto: 'escena-texto',
  loQueTeLlevas: 'lo-que-te-llevas',
  siguienteSitio: 'siguiente-sitio',
});

/**
 * Lo que esta pantalla **no** tiene, nombrado para que su ausencia se pueda poner roja
 * igual que la de un botón.
 *
 * El retrato es exclusión 6 del PRD; la flecha de volver convertiría la secuencia en un
 * menú y dejaría un beat a medio resolver, que es un estado que el motor no tiene; y la
 * segunda acción sería prometer una ramificación que el diseño aplazó a propósito.
 */
export const LO_QUE_LA_ESCENA_NO_LLEVA = congelaHondo([
  'retrato-de-la-cara',
  'flecha-de-volver',
  'segunda-accion',
  'aviso-de-franja',
  'reloj-en-pantalla',
  'lista-de-requisitos',
  'cuantos-beats-quedan',
]);

// --- La escala de tamaño de texto ---------------------------------------------

/**
 * Los escalones de tamaño de texto: **tres, con nombre y sin cifras**.
 *
 * Tres es el mínimo que hace la diferencia visible a un brazo de distancia y el máximo
 * que cabe en un toque cíclico sin que haya que contar cuántas veces se ha tocado. El
 * nombre es lo que viaja; el factor es para quien pinta y no sale a pantalla, que es lo
 * mismo que se hace con los metros del presupuesto de una aventura.
 *
 * Se declara aquí porque es aquí donde se usa por primera vez, y la pantalla de ajustes
 * (fila 38) la consume tal cual en vez de declarar la suya.
 */
export const ESCALA_DE_TEXTO = congelaHondo([
  { id: 'normal', factor: 1 },
  { id: 'grande', factor: 1.25 },
  { id: 'muy-grande', factor: 1.5 },
]);

/** Los escalones, en el orden en que los recorre el toque cíclico. */
export const IDS_DE_TAMANO_DE_TEXTO = congelaHondo(ESCALA_DE_TEXTO.map((e) => e.id));

/** El escalón con el que se empieza. Nadie tiene que elegir nada para leer. */
export const TAMANO_DE_TEXTO_DE_ORIGEN = ESCALA_DE_TEXTO[0].id;

/**
 * La etiqueta y la ayuda del control. **Ni accesibilidad, ni dificultad de lectura, ni
 * modo alguno**: es un ajuste del momento para leerle a alguien, no una declaración
 * sobre quien lo toca.
 */
export const TEXTOS_DEL_TAMANO = congelaHondo({
  etiqueta: 'Tamaño del texto',
  ayuda: 'Toca para agrandarlo.',
});

/** Un escalón declarado, o un error que nombra el valor y la escala entera. */
export function exigeTamanoDeTexto(id, quien = 'el tamaño de letra de la escena') {
  if (!IDS_DE_TAMANO_DE_TEXTO.includes(id)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(id) ?? String(id)}, que no está en la escala declarada: ` +
      `los escalones son ${IDS_DE_TAMANO_DE_TEXTO.join(', ')}`,
    );
  }
  return id;
}

/** El factor de un escalón. Lo usa quien pinta y no sale nunca a pantalla. */
export function factorDeTamano(id) {
  exigeTamanoDeTexto(id);
  return ESCALA_DE_TEXTO.find((e) => e.id === id).factor;
}

/**
 * El escalón siguiente: **cíclico**, y vuelve al principio al pasarse.
 *
 * Cada toque avanza uno y el texto cambia en el sitio. Ni panel, ni deslizador, ni
 * previsualización: un control con panel convertiría el único elemento de aplicación
 * tolerado en una pantalla de ajustes dentro del juego.
 */
export function siguienteTamanoDeTexto(id) {
  exigeTamanoDeTexto(id);
  const i = IDS_DE_TAMANO_DE_TEXTO.indexOf(id);
  return IDS_DE_TAMANO_DE_TEXTO[(i + 1) % IDS_DE_TAMANO_DE_TEXTO.length];
}

// --- Los dos vocabularios que convierten dos reglas de tono en criterios -------

/**
 * El vocabulario de **reproche**, para las variantes de fuera de franja.
 *
 * La variante de fuera cuenta lo que pasó mientras tanto, nunca lo que quien juega dejó
 * de hacer: reprochar llegar tarde es penalizar la ausencia con otras palabras, y eso es
 * lo que `quests.md` decisión 4 prohíbe. Va como lista cerrada para que la regla se
 * pueda poner roja en lugar de quedarse en una intención escrita en una spec.
 */
export const VOCABULARIO_DE_REPROCHE = congelaHondo([
  'tarde', 'no llegaste', 'te has retrasado', 'ya no', 'podrías haber', 'si hubieras', 'has perdido',
]);

const REGLAS_DE_REPROCHE = VOCABULARIO_DE_REPROCHE.map(reglaDeFormula);

/** Qué palabras de reproche usa un texto, como datos: la fórmula y el fragmento. */
export function infraccionesDeReproche(texto) {
  if (typeof texto !== 'string') {
    throw new Error(`la revisión de reproche necesita un texto y llegó ${JSON.stringify(texto) ?? String(texto)}`);
  }
  const out = [];
  for (const regla of REGLAS_DE_REPROCHE) {
    const casa = texto.match(regla.re);
    if (casa) out.push(Object.freeze({ formula: regla.formula, fragmento: casa[0] }));
  }
  return congelaHondo(out);
}

/**
 * Las **abreviaturas** que no se leen en voz alta. Lista cerrada y no una forma: una
 * regla por terminación se llevaría por delante cualquier palabra corta al final de una
 * frase, y un criterio con falsos positivos se acaba desactivando.
 */
export const ABREVIATURAS = congelaHondo([
  'etc.', 'ej.', 'núm.', 'pág.', 'aprox.', 'vs.', 'Sr.', 'Sra.', 'Srta.',
  'Dr.', 'Dra.', 'Dña.', 'Ud.', 'Uds.', 'cap.', 'fig.', 'ss.', 'op.',
]);

/**
 * Las abreviaturas de unidad, que son las que de verdad aparecerían: **nunca la letra
 * suelta**. Una regla que cazara la `m` o la `s` sueltas se llevaría por delante media
 * prosa, y un criterio con falsos positivos se acaba desactivando.
 */
export const UNIDADES_ABREVIADAS = congelaHondo(['km', 'kms', 'kg', 'cm', 'mm', 'ml', 'min', 'seg']);

const LETRA = 'a-zA-ZáéíóúüñÁÉÍÓÚÜÑ';

/**
 * Las formas que rompen la lectura en voz alta y que no son cifras.
 *
 * Las cifras **se heredan de SPEC-017** en lugar de reabrirse: `infraccionesDeTexto` ya
 * prohíbe el dígito y los numerales dentro de la prosa, y declarar aquí una segunda
 * lista de números sería tener dos reglas que acabarían diciendo cosas distintas.
 */
const escapa = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FORMAS_DE_VOZ_ALTA = Object.freeze([
  Object.freeze({ formula: 'símbolo de porcentaje', re: /%/ }),
  Object.freeze({ formula: 'barra', re: /\// }),
  Object.freeze({ formula: 'paréntesis de aclaración', re: /[()]/ }),
  Object.freeze({ formula: 'sigla en mayúsculas', re: new RegExp(`(?<![${LETRA}])[A-ZÁÉÍÓÚÜÑ]{2,}(?![${LETRA}])`) }),
  ...UNIDADES_ABREVIADAS.map((u) => Object.freeze({
    formula: `abreviatura de unidad "${u}"`,
    re: new RegExp(`(?<![${LETRA}])${u}(?![${LETRA}])`),
  })),
  ...ABREVIATURAS.map((a) => Object.freeze({
    formula: `abreviatura "${a}"`,
    re: new RegExp(`(?<![${LETRA}])${escapa(a)}`),
  })),
]);

/**
 * Qué le impide a un texto leerse en voz alta: cifras, símbolos, siglas y abreviaturas.
 *
 * Es la forma comprobable de «escrito para leerse en voz alta» (`personaje.md` §4). Sale
 * como datos —familia, fórmula y fragmento— por lo mismo que las reglas de lenguaje: lo
 * que se cuenta se agrega, y una frase redactada no se agrega.
 */
export function infraccionesDeLecturaEnVozAlta(texto, { locale = 'es' } = {}) {
  if (typeof texto !== 'string') {
    throw new Error(`la revisión de lectura en voz alta necesita un texto y llegó ${JSON.stringify(texto) ?? String(texto)}`);
  }
  const out = infraccionesDeTexto(texto, { locale })
    .filter((i) => i.familia === 'cifras')
    .map((i) => ({ familia: 'cifras', formula: i.formula, fragmento: i.fragmento }));
  for (const regla of FORMAS_DE_VOZ_ALTA) {
    const casa = texto.match(regla.re);
    if (casa) out.push({ familia: 'sinVoz', formula: regla.formula, fragmento: casa[0] });
  }
  return congelaHondo(out);
}

// --- El titular y el verbo de cada escena -------------------------------------

/**
 * Qué pasa aquí y qué se hace, por tipo de escena.
 *
 * Es **el marco de la escena y no su contenido**: el titular dice qué clase de momento
 * es este y el verbo escribe la única acción, que nunca es «Continuar» —sería un botón
 * de aplicación y desperdiciaría la única línea de acción que tiene la pantalla—. Lo que
 * se cuenta lo sigue escribiendo la plantilla, o el modelo cuando lo hay.
 *
 * El catálogo es cerrado y se comprueba contra el vocabulario de escenas del catálogo de
 * plantillas: una escena nueva sin marco pone el módulo rojo, en lugar de dejar la
 * pantalla con un hueco (`pipeline/decisiones-orquestador.md` §6h).
 */
export const MARCOS_DE_ESCENA = congelaHondo({
  acarreo: { titular: 'Hay algo que cargar', verbo: 'Cargar con ello' },
  acuerdo: { titular: 'Aquí se cierra un trato', verbo: 'Dar la mano' },
  arreglo: { titular: 'Algo se puede arreglar', verbo: 'Arreglarlo' },
  aviso: { titular: 'Alguien quiere avisar', verbo: 'Escuchar el aviso' },
  'búsqueda': { titular: 'Aquí hay que buscar', verbo: 'Buscar' },
  'celebración': { titular: 'Aquí se celebra algo', verbo: 'Quedarse un rato' },
  cierre: { titular: 'Esto se cierra aquí', verbo: 'Cerrarlo' },
  'comprobación': { titular: 'Hay algo que comprobar', verbo: 'Comprobarlo' },
  'conversación': { titular: 'Hay quien quiere hablar', verbo: 'Escuchar' },
  curas: { titular: 'Aquí se curan cosas', verbo: 'Dejar que te curen' },
  'decisión': { titular: 'Aquí hay que decidirse', verbo: 'Decidirse' },
  descanso: { titular: 'Aquí se para', verbo: 'Descansar' },
  desmentido: { titular: 'Aquí desmienten algo', verbo: 'Oír el desmentido' },
  despedida: { titular: 'Aquí se despide alguien', verbo: 'Despedirse' },
  'discusión': { titular: 'Aquí se discute', verbo: 'Poner paz' },
  emboscada: { titular: 'Alguien sale al paso', verbo: 'Seguir adelante' },
  encargo: { titular: 'Hay un encargo', verbo: 'Aceptar el encargo' },
  encuentro: { titular: 'Hay alguien esperando', verbo: 'Acercarse' },
  entrega: { titular: 'Aquí se entrega', verbo: 'Entregarlo' },
  espera: { titular: 'Aquí toca esperar', verbo: 'Esperar' },
  'gestión': { titular: 'Hay algo que resolver', verbo: 'Resolverlo' },
  guarida: { titular: 'Aquí se guarece alguien', verbo: 'Asomarse' },
  hallazgo: { titular: 'Aquí hay algo', verbo: 'Cogerlo' },
  informe: { titular: 'Aquí se cuenta lo que pasó', verbo: 'Contarlo' },
  misterio: { titular: 'Aquí no cuadra algo', verbo: 'Mirar de cerca' },
  negativa: { titular: 'Aquí alguien se niega', verbo: 'Encajarlo' },
  ofrenda: { titular: 'Aquí se deja algo', verbo: 'Dejarlo' },
  peaje: { titular: 'Por aquí hay que pagar', verbo: 'Pasar' },
  pesquisa: { titular: 'Aquí se pregunta', verbo: 'Preguntar' },
  problema: { titular: 'Aquí hay un problema', verbo: 'Meterse en ello' },
  prueba: { titular: 'Aquí te ponen a prueba', verbo: 'Intentarlo' },
  rastro: { titular: 'Aquí queda un rastro', verbo: 'Seguir el rastro' },
  recarga: { titular: 'Aquí se repone lo que falta', verbo: 'Reponerlo' },
  reclamo: { titular: 'Aquí reclaman algo', verbo: 'Oír la reclamación' },
  recompensa: { titular: 'Aquí se paga lo hecho', verbo: 'Cobrar' },
  recuento: { titular: 'Aquí se echan las cuentas', verbo: 'Echar cuentas' },
  refugio: { titular: 'Aquí se está a cubierto', verbo: 'Ponerse a cubierto' },
  regreso: { titular: 'Aquí se vuelve', verbo: 'Volver' },
  relevo: { titular: 'Aquí alguien toma el relevo', verbo: 'Ceder el sitio' },
  reparto: { titular: 'Aquí se reparte', verbo: 'Repartir' },
  rescate: { titular: 'Aquí hace falta ayuda', verbo: 'Echar una mano' },
  'resolución': { titular: 'Aquí se resuelve', verbo: 'Resolverlo' },
  'reunión': { titular: 'Aquí se junta la gente', verbo: 'Juntarse' },
  ritual: { titular: 'Aquí se hace lo de siempre', verbo: 'Hacerlo' },
  saber: { titular: 'Aquí se guarda lo escrito', verbo: 'Leerlo' },
  saldo: { titular: 'Aquí se salda una cuenta', verbo: 'Saldarla' },
  'súplica': { titular: 'Aquí alguien pide algo', verbo: 'Escuchar lo que pide' },
  testigo: { titular: 'Aquí hay quien lo vio', verbo: 'Preguntar a quien lo vio' },
  trato: { titular: 'Aquí se trata algo', verbo: 'Tratarlo' },
  vela: { titular: 'Aquí se hace guardia', verbo: 'Hacer guardia' },
  venia: { titular: 'Aquí hay que pedir permiso', verbo: 'Pedir permiso' },
  veredicto: { titular: 'Aquí se dictamina', verbo: 'Oír el dictamen' },
  'verificación': { titular: 'Aquí se verifica', verbo: 'Verificarlo' },
  vigilancia: { titular: 'Desde aquí se ve todo', verbo: 'Mirar desde aquí' },
  visita: { titular: 'Aquí se visita a alguien', verbo: 'Entrar' },
  vuelta: { titular: 'Aquí se da la vuelta', verbo: 'Dar la vuelta' },
});

/**
 * El renglón que remata el gesto, por lo que el beat deja.
 *
 * Va por **resultado** y no por escena porque es el gesto de lo que te llevas lo que
 * cierra el momento, y los resultados son tres y están cerrados desde SPEC-010.
 */
export const CIERRES_POR_RESULTADO = congelaHondo({
  informacion: 'Te lo cuentan de corrido, como quien se lo quita de encima.',
  objeto: 'Te lo dan con las manos, que es más de lo que hacía falta.',
  estado: 'Nadie dice nada más, y aun así algo ha quedado distinto.',
});

/** El cierre de un resultado, o un error que nombra el tipo. */
export function cierreDeResultado(tipo) {
  const cierre = Object.prototype.hasOwnProperty.call(CIERRES_POR_RESULTADO, tipo) ? CIERRES_POR_RESULTADO[tipo] : null;
  if (!cierre) {
    throw new Error(
      `el resultado "${tipo}" no declara con qué se remata la escena: los declarados son ${Object.keys(CIERRES_POR_RESULTADO).sort().join(', ')}`,
    );
  }
  return cierre;
}

/** Los tipos de escena con marco declarado, en orden estable. */
export const ESCENAS_CON_MARCO = congelaHondo(Object.keys(MARCOS_DE_ESCENA).slice().sort());

/** El marco de un tipo de escena, o un error que nombra el tipo. */
export function marcoDeEscena(tipo) {
  const marco = Object.prototype.hasOwnProperty.call(MARCOS_DE_ESCENA, tipo) ? MARCOS_DE_ESCENA[tipo] : null;
  if (!marco) {
    throw new Error(
      `la escena "${tipo}" no declara ni titular ni verbo de acción: el catálogo de marcos es cerrado y los declarados son ` +
      `${ESCENAS_CON_MARCO.join(', ')}. Una escena sin marco deja la pantalla con un hueco y el botón sin nada escrito`,
    );
  }
  return marco;
}

/**
 * Comprueba que todo tipo de escena que el catálogo de plantillas usa tiene marco.
 *
 * El catálogo entra inyectado por la misma razón que la taxonomía de parajes: la
 * dirección es de las plantillas hacia aquí, y este módulo no importa el catálogo.
 */
export function compruebaCoberturaDeMarcos(catalogo) {
  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    throw new Error(`la comprobación de marcos de escena necesita el catálogo de plantillas y llegó ${JSON.stringify(catalogo) ?? String(catalogo)}`);
  }
  for (const plantilla of catalogo) {
    (plantilla.beats ?? []).forEach((b, i) => {
      try {
        marcoDeEscena(b.escena);
      } catch (e) {
        throw new Error(`el beat ${i + 1} de la plantilla "${plantilla.id}": ${e.message}`);
      }
    });
  }
  return true;
}

// --- La escena ----------------------------------------------------------------

function exigeBeatCasteado(beat) {
  const falta = ['n', 'lugar', 'disparador', 'escena', 'resultado', 'guiado'].filter((c) => beat?.[c] == null);
  if (falta.length) {
    throw new Error(
      `la escena se compone sobre el beat casteado entero de SPEC-010 y le faltan ${falta.join(', ')}: ` +
      'una copia recortada de su texto no lleva ni el lugar, ni el disparador, ni el guiado del siguiente',
    );
  }
  return beat;
}

/**
 * Qué variante de escena se lee: la de dentro o la de fuera de la franja.
 *
 * El reloj de pared **se exige** cuando el beat tiene franja: sin él, resolver todas las
 * llegadas como si fueran dentro es exactamente la degradación silenciosa de §6h, y
 * además haría que la mitad de RF-QUEST-004 no se pudiera poner roja. El minuto se usa
 * aquí y **no se guarda en ninguna parte** (RF-PRIV-002).
 */
export function varianteDelBeat({ beat, reloj = null }) {
  exigeBeatCasteado(beat);
  if (beat.disparador.tipo !== 'franja') return congelaHondo({ conFranja: false, variante: null, texto: null });
  if (typeof reloj !== 'function') {
    throw new Error(
      `el beat ${beat.n} dispara en la franja "${beat.disparador.franja.id}" y no se ha cableado el reloj de pared: ` +
      'sin él todas las llegadas se resolverían como si fueran dentro de la franja, que es decidirlo sin saberlo. ' +
      'El reloj entra inyectado y devuelve el minuto del día',
    );
  }
  const minuto = exigeMinutoDelDia(reloj(), 'el minuto que devuelve el reloj de pared');
  const dentro = dentroDeFranja(beat.disparador.franja, minuto);
  const variante = dentro ? 'dentro' : 'fuera';
  const texto = beat.disparador.variantes?.[variante] ?? null;
  if (typeof texto !== 'string' || !texto) {
    throw new Error(
      `el beat ${beat.n} no trae escrita su variante de ${variante} de la franja "${beat.disparador.franja.id}": ` +
      'las dos se escriben, porque llegar fuera resuelve el beat igual y contarlo con el texto de dentro hablaría de una hora que no es',
    );
  }
  // El minuto muere aquí: lo que sale es qué variante se lee, nunca cuándo se llegó.
  return congelaHondo({ conFranja: true, variante, texto });
}

/**
 * La escena de un beat — A4P3.
 *
 * @param {object} peticion
 *   `beat` el beat casteado entero; `cara` quien habla, con su nombre y su puesto **en
 *   clave**, o `null` cuando la escena no tiene a nadie —lo que sale compuesto es el
 *   rótulo de mundo del puesto—; `texto` el del modelo cuando está
 *   residente, con `origenDelTexto`; `reloj` el reloj de pared inyectado; `tenencia` la
 *   vista de solo lectura de los objetos; `tamanoDeTexto` el escalón vigente.
 * @returns la escena congelada. **Una sola acción**, ningún retrato y ninguna cifra.
 */
export function componeEscena({
  beat,
  cara = null,
  texto = null,
  origenDelTexto = null,
  reloj = null,
  tenencia = null,
  tamanoDeTexto = TAMANO_DE_TEXTO_DE_ORIGEN,
}) {
  exigeBeatCasteado(beat);
  exigeTamanoDeTexto(tamanoDeTexto);
  const marco = marcoDeEscena(beat.escena.tipo);
  const franja = varianteDelBeat({ beat, reloj });
  // La tenencia **se exige** en un beat de objeto y no cae a «no lleva nada»: caer
  // elegiría la vía alternativa por defecto, que es contar otra escena sin saberlo.
  const via = resuelveBifurcacion({
    beat,
    tenencia: beat.disparador.tipo === 'con_objeto'
      ? exigeTenencia(tenencia, `la escena del beat ${beat.n}, que dispara con objeto,`)
      : SIN_OBJETOS,
  });

  // El cuerpo y la línea que sitúa, **sin repetir nunca el mismo párrafo dos veces**.
  // La prosa de la plantilla sitúa cuando hay otra cosa que decir encima —la variante de
  // franja, la vía por la que se pasó, el texto del modelo— y es el cuerpo cuando no la
  // hay. Con modelo y sin él la composición es la misma y **ningún texto de la pantalla
  // menciona que falte nada** (RNF-RED-001).
  let situacion = beat.escena.texto ?? null;
  let cuerpo = null;
  let origen = null;
  if (franja.conFranja) {
    cuerpo = franja.texto;
    origen = 'plantilla';
  } else if (via.conObjeto && via.via === 'alternativa' && typeof via.texto === 'string' && via.texto) {
    cuerpo = via.texto;
    origen = 'plantilla';
  }
  if (typeof texto === 'string' && texto) {
    cuerpo = texto;
    origen = origenDelTexto ?? 'modelo';
  }
  if (cuerpo == null) {
    cuerpo = situacion;
    origen = 'plantilla';
    situacion = null;
  }

  return congelaHondo({
    estado: ESTADOS_DE_ESCENA[0],
    beat: beat.n,
    // El nombre de fantasía del sitio, que sitúa sin encabezar. Nunca su nombre real:
    // eso vive en el visor y detrás de un gesto (SPEC-033).
    sitio: beat.lugar.nombre,
    titular: marco.titular,
    situacion,
    cara: cara ? exigeCara(cara) : null,
    cuerpo: congelaHondo({
      // Con cara es parlamento y sin cara es párrafo. Es el único elemento que cambia
      // de forma, y ninguno de los demás cambia de sitio.
      forma: cara ? 'parlamento' : 'parrafo',
      texto: cuerpo,
      origen,
    }),
    cierre: cierreDeResultado(beat.resultado.tipo),
    accion: congelaHondo({ verbo: marco.verbo, avanza: true }),
    tamanoDeTexto,
    // Por qué vía se atravesó, para quien anote el beat resuelto. **No se anuncia**: no
    // hay «necesitas X», ni candado, ni lista de requisitos, porque las dos vías
    // resuelven el mismo beat y empujan al mismo siguiente.
    via: via.conObjeto ? via.via : 'llegada',
    variante: franja.conFranja ? franja.variante : null,
  });
}

function exigeCara(cara) {
  if (typeof cara?.nombre !== 'string' || !cara.nombre || typeof cara.puesto !== 'string' || !cara.puesto) {
    throw new Error(
      `quien habla en la escena se nombra con su nombre y su puesto y llegó ${JSON.stringify(cara) ?? String(cara)}: ` +
      'una cara sin puesto no se puede presentar, y un retrato no lo hay (exclusión 6 del PRD)',
    );
  }
  // El puesto sale de aquí **con palabras del mundo**: la cara llega con su clave interna,
  // que es la de la partida y la de la memoria, y lo que se compone es el rótulo. La clave
  // no sale a pantalla jamás —`ANXO O DO NORTE · REGENCIA` es una etiqueta de catálogo, no
  // una presentación—, y se traduce aquí y no en quien pinta para que no haya una segunda
  // traducción el día que otra pantalla enseñe el puesto de alguien.
  return congelaHondo({ nombre: cara.nombre, puesto: rotuloDePuesto(cara.puesto) });
}

/**
 * Lo que te llevas — A4P4.
 *
 * Lleva lo que se lleva, la información que empuja al siguiente y **el nombre** del
 * sitio siguiente con su marca en el mapa. Ni una cifra: ni cuánto falta, ni cuántos
 * beats quedan, ni cuánto oro se lleva. En el último beat de la cadena no hay bloque de
 * sitio siguiente y la acción es la misma.
 */
export function componeLoQueTeLlevas({ beat, siguiente = null }) {
  exigeBeatCasteado(beat);
  const esElUltimo = beat.resultado.siguienteBeat == null;
  if (!esElUltimo && siguiente != null) exigeBeatCasteado(siguiente);
  const marcaDe = (b) => congelaHondo({ ...b.guiado.marca });
  return congelaHondo({
    estado: ESTADOS_DE_ESCENA[1],
    beat: beat.n,
    rotulo: 'Llevas encima',
    // Qué se lleva: el tipo de resultado y el objeto si lo hay. La cantidad de oro la
    // pone el desenlace al cerrar la salida y **no se enseña aquí**.
    seLleva: congelaHondo({
      tipo: beat.resultado.tipo,
      objeto: beat.resultado.objeto ?? null,
    }),
    // El párrafo que empuja al siguiente sitio es el del beat: este módulo transporta
    // textos y no redacta ninguno.
    empuje: beat.escena.texto ?? null,
    siguienteSitio: esElUltimo || !siguiente
      ? null
      : congelaHondo({
        nombre: siguiente.guiado.destino,
        // La línea de guiado va por nombres de calzada, y un tramo sin nombre propio
        // simplemente no se nombra.
        calzadas: [...siguiente.guiado.calzadas],
        marca: marcaDe(siguiente),
      }),
    accion: congelaHondo({ verbo: 'Seguir andando', avanza: true }),
    ultimo: esElUltimo,
  });
}

/** La pantalla cuando en este sitio no hay ninguna escena que montar. */
export function sinEscena() {
  return congelaHondo({ estado: ESTADOS_DE_ESCENA[2], beat: null, accion: null });
}
