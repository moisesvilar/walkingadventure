// El catálogo como **contrato**: qué tiene que traer una plantilla para que los
// mecanismos que ya existen tengan de qué tirar, y la comprobación que lo verifica
// entero al cargarse.
//
// Se comprueba al cargar y no en el primer casteo que use cada plantilla, con el
// precedente de `relacion.js`, `efectos.js` y `puestos.js`: con validación perezosa
// una plantilla mal declarada aparece meses después, en el mundo de alguien y no en
// la batería. Y falla **nombrando la plantilla y el campo**, porque un catálogo de
// treinta entradas con un error sin dirección se depura a ojo.
//
// De aquí sale además el **vocabulario de escenas** que la tubería inyecta al
// generador de parajes (SPEC-006). La dirección importa y es la mitad del diseño:
// el vocabulario sale de aquí hacia fuera y nunca al revés, así que este módulo no
// importa el generador de parajes ni ningún módulo de mundo. Lo que necesita del
// mundo —la taxonomía de tipos de paraje, para comprobar que alguien cubre lo que
// se pide— **entra inyectado**, y quien la tiene la pasa.

import { congelaHondo } from '../core/congelar.js';
import { infraccionesDeTexto, ranurasDeTexto, exigeRanura } from '../names/lenguaje.js';
import { exigeClaseDeObjeto, procedenciaDeObjeto, CLASE_QUE_ABRE } from '../partida/objetos.js';
import { exigeCandidato } from '../partida/motes.js';
import { exigeSignoDeActo, SIGNOS_DE_ACTO } from '../partida/relacion.js';
import { declaracionDeRumor } from '../partida/rumores.js';
import { exigeCantidadDeOro } from '../partida/oro.js';
import { IDS_DE_TAMANO, RANGO_DE_BEATS } from '../partida/salida.js';
import { TIPOS_DE_ROL, validaPlantilla } from './aventura.js';
import { compruebaCoberturaDeMarcos, infraccionesDeLecturaEnVozAlta, infraccionesDeReproche } from './escena.js';
import { OFICIOS, afinidadDePlantilla, exclusivasDeOficio, mediaDeAfinidades } from './oficios.js';
import { TEMPLATES } from './templates.js';

/**
 * Cuántas plantillas tiene que haber. El suelo de RF-QUEST-009 son veinte; el rango
 * arranca en veinticuatro porque con cuatro oficios y afinidad ×1,5 por debajo de
 * veintisiete ningún oficio llega a diez esqueletos ni con casteo perfecto
 * (`personaje.md` §3), y el techo es el treinta con el que aquel documento hace su
 * cuenta.
 */
export const TAMANO_DEL_CATALOGO = congelaHondo({ minimo: 24, maximo: 30 });

/**
 * La media de oficios por plantilla, acotada **por arriba y por abajo**.
 *
 * Por debajo de 1,5 el catálogo que ve cada oficio se queda corto; por encima de 2
 * el oficio deja de filtrar y solo cambia la voz, que es exactamente la
 * contradicción que `personaje.md` §3 pide no volver a cometer.
 */
export const MEDIA_DE_AFINIDADES = congelaHondo({ minima: 1.5, maxima: 2 });

/**
 * Los topes de cada clase de texto, en caracteres. No son estética: son lo que hace
 * que un texto quepa en la pantalla que lo pinta sin recortarse, y un texto
 * recortado a mitad de frase es peor que uno más corto escrito a propósito.
 */
export const TOPES_DE_TEXTO = congelaHondo({
  titulo: 52,
  gancho: 280,
  beat: 220,
  variante: 220,
  alternativa: 240,
  desenlace: 280,
  repuesto: 240,
});

/**
 * El peso con el que una escena se da por cubierta cuando el rol no declara otro.
 *
 * Es el mismo valor que usa `world/escenas.js` al normalizar, y se declara aquí
 * porque este módulo no importa ningún módulo de mundo. Que los dos coincidan no
 * queda a la buena fe: `world/cupos.js` los cruza al cargarse.
 */
export const PESO_MINIMO_POR_DEFECTO = 0.2;

/** Las dos salidas de repuesto que toda plantilla declara, en orden declarado. */
export const REPUESTOS = congelaHondo(['sinTi', 'conLoConseguido']);

/**
 * Lo que una decisión de beat **no** puede ser para disparar un acto de relación.
 *
 * `quests.md` decisión 4 prohíbe penalizar la ausencia, así que un acto feo que se
 * disparase por plantarse, volverse o tardar sería reprochar por la puerta de atrás.
 * Va como lista cerrada para que la prohibición se pueda comprobar y no solo decir.
 */
export const DECISIONES_PROHIBIDAS = congelaHondo(['no-llegar', 'plantarse', 'volverse', 'tardar', 'abandonar', 'no-ir']);

/** Los tipos de rol a los que puede apuntar un efecto de relación: los sitios con gente. */
const ROLES_CON_GENTE = congelaHondo(['nucleo', 'servicio', 'humano']);

// --- las consultas agregadas ------------------------------------------------

/** Los roles de una plantilla, en el orden de resolución que ella declara. */
export function rolesDePlantilla(plantilla) {
  return plantilla.orden.map((rid) => ({ rid, ...plantilla.roles[rid] }));
}

/** Los tipos de rol que una plantilla pide, sin repetir y en orden declarado. */
export function tiposDeRolDe(plantilla) {
  const out = [];
  for (const rol of rolesDePlantilla(plantilla)) if (!out.includes(rol.tipo)) out.push(rol.tipo);
  return out;
}

/** Cuántos roles de paraje pide una plantilla. */
export function rolesDeParajeDe(plantilla) {
  return rolesDePlantilla(plantilla).filter((r) => r.tipo === 'paraje');
}

/** Los beats de una plantilla que disparan con objeto, con su número. */
export function beatsConObjeto(catalogo = CATALOGO) {
  const out = [];
  for (const plantilla of catalogo) {
    plantilla.beats.forEach((b, i) => {
      if (b.disparador.tipo === 'con_objeto') out.push({ plantilla: plantilla.id, beat: i + 1, objeto: b.disparador.objeto });
    });
  }
  return out;
}

/** Los objetos de clase llave que entregan los desenlaces del catálogo. */
export function llavesQueEntregaElCatalogo(catalogo = CATALOGO) {
  const out = [];
  for (const plantilla of catalogo) {
    for (const objeto of plantilla.desenlace.objetos ?? []) {
      if (objeto.clase === CLASE_QUE_ABRE) out.push({ plantilla: plantilla.id, objeto: objeto.id });
    }
  }
  return out;
}

/** Todos los textos del catálogo, con su plantilla, su clase y dónde vive cada uno. */
export function textosDelCatalogo(catalogo = CATALOGO) {
  const out = [];
  for (const plantilla of catalogo) {
    const mete = (clase, donde, texto) => out.push({ plantilla: plantilla.id, clase, donde, texto });
    mete('titulo', 'titulo', plantilla.titulo);
    mete('gancho', 'gancho', plantilla.gancho);
    plantilla.beats.forEach((b, i) => {
      mete('beat', `beat ${i + 1}`, b.texto);
      if (b.disparador.tipo === 'franja') {
        mete('variante', `beat ${i + 1} · variante de franja`, b.disparador.variante);
        mete('variante', `beat ${i + 1} · variante de fuera de franja`, b.disparador.varianteFuera);
      }
      if (b.disparador.tipo === 'con_objeto') mete('alternativa', `beat ${i + 1} · vía alternativa`, b.disparador.viaAlternativa.texto);
    });
    mete('desenlace', 'desenlace', plantilla.desenlace.texto);
    for (const cual of REPUESTOS) mete('repuesto', `repuesto ${cual}`, plantilla.repuesto[cual]);
  }
  return out;
}

/**
 * Los huecos que una plantilla puede pedirle al narrador, cada uno con su tope y **su
 * texto de fallback**.
 *
 * Es la lista que consume SPEC-018 y la que hace comprobable su exigencia: cada hueco
 * declara un fallback, y una plantilla a la que le falte uno se rechaza **al cargar el
 * catálogo**. Con la declaración opcional, «esta plantilla no necesita fallback» y «se
 * me olvidó» serían indistinguibles, que es el mismo argumento con el que la
 * declaración de rumor se hizo obligatoria.
 *
 * La clave es **local a la plantilla** —`titulo`, `gancho`, `beat:3`— y la clave con la
 * que el texto vive en la partida la compone el narrador, añadiéndole el mapa y el
 * punto de invocación.
 *
 * El `tipo` es el del catálogo cerrado de campos inertes: cinco de los seis salen de
 * aquí, y el sexto —el envoltorio del zurrón— no es de ninguna plantilla.
 */
export function huecosDePlantilla(plantilla) {
  const huecos = [];
  const mete = (clave, tipo, clase, texto) => huecos.push({ clave, tipo, clase, tope: TOPES_DE_TEXTO[clase], fallback: texto });
  mete('titulo', 'titulo', 'titulo', plantilla.titulo);
  mete('gancho', 'gancho', 'gancho', plantilla.gancho);
  plantilla.beats.forEach((b, i) => {
    mete(`beat:${i + 1}`, 'escena', 'beat', b.texto);
    if (b.disparador.tipo === 'franja') {
      mete(`beat:${i + 1}:variante`, 'escena', 'variante', b.disparador.variante);
      mete(`beat:${i + 1}:varianteFuera`, 'escena', 'variante', b.disparador.varianteFuera);
    }
    if (b.disparador.tipo === 'con_objeto') mete(`beat:${i + 1}:alternativa`, 'escena', 'alternativa', b.disparador.viaAlternativa?.texto);
  });
  mete('desenlace', 'escena', 'desenlace', plantilla.desenlace?.texto);
  for (const cual of REPUESTOS) mete(`repuesto:${cual}`, 'escena', 'repuesto', plantilla.repuesto?.[cual]);
  return huecos;
}

/**
 * El vocabulario de escenas de paraje que pide un catálogo, con **el peso mínimo más
 * exigente** de cada escena y ordenado por escena.
 *
 * Un rol que admite alternativas (`['vigilancia', 'revelación']`) aporta **las dos**:
 * son dos escenas distintas que el mundo tiene que saber decir, y contar solo una
 * dejaría medio vocabulario sin cubrir el día que el casting eligiera la otra.
 *
 * Ordenado antes de salir porque de esta lista cuelga un número de generación: un
 * vocabulario que llegara en otro orden daría otro mundo.
 */
export function vocabularioDeEscenas(catalogo = CATALOGO) {
  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    throw new Error('el catálogo de plantillas está vacío: sin plantillas no hay escenas que contar y el suelo de parajes no se puede derivar');
  }
  const pesos = new Map();
  for (const plantilla of catalogo) {
    for (const rid of Object.keys(plantilla?.roles ?? {}).sort()) {
      const rol = plantilla.roles[rid];
      if (rol?.tipo !== 'paraje' || !rol.escena) continue;
      const pedido = rol.minPeso ?? PESO_MINIMO_POR_DEFECTO;
      for (const escena of Array.isArray(rol.escena) ? rol.escena : [rol.escena]) {
        pesos.set(escena, Math.max(pesos.get(escena) ?? 0, pedido));
      }
    }
  }
  return congelaHondo([...pesos.keys()].sort().map((escena) => ({ escena, pesoMinimo: pesos.get(escena) })));
}

/**
 * Comprueba que la taxonomía de tipos de paraje **cubre** todo lo que el catálogo
 * pide, y falla nombrando la plantilla, el rol y la escena.
 *
 * La taxonomía entra inyectada —`{ tipo: { escena: peso } }`— porque este módulo no
 * importa ningún módulo de mundo. Quien la tiene la pasa, y lo hace al cargarse: una
 * escena que ningún tipo cubre no puede aparecer como un hueco de cobertura en cada
 * celda generada, en silencio y para siempre.
 */
export function compruebaCoberturaDeEscenas({ catalogo = CATALOGO, taxonomia }) {
  if (!taxonomia || typeof taxonomia !== 'object') {
    throw new Error(`la comprobación de cobertura necesita la taxonomía de tipos de paraje y llegó ${JSON.stringify(taxonomia) ?? String(taxonomia)}`);
  }
  const tipos = Object.keys(taxonomia).sort();
  for (const plantilla of catalogo) {
    for (const rid of Object.keys(plantilla.roles).sort()) {
      const rol = plantilla.roles[rid];
      if (rol?.tipo !== 'paraje') continue;
      const pedido = rol.minPeso ?? PESO_MINIMO_POR_DEFECTO;
      for (const escena of Array.isArray(rol.escena) ? rol.escena : [rol.escena]) {
        const cubre = tipos.some((t) => (taxonomia[t]?.scenes?.[escena] ?? taxonomia[t]?.[escena] ?? 0) >= pedido);
        if (!cubre) {
          throw new Error(
            `la plantilla "${plantilla.id}" pide en su rol "${rid}" la escena "${escena}" con peso ${pedido}, y ningún tipo de paraje la cubre: ` +
            `los declarados son ${tipos.join(', ')}. Una escena sin tipo que la sostenga sale como hueco de cobertura en cada celda, en silencio`,
          );
        }
      }
    }
  }
  return true;
}

// --- la comprobación del catálogo entero ------------------------------------

function exigeTexto(plantilla, clase, donde, texto) {
  if (typeof texto !== 'string' || texto.trim().length === 0) {
    throw new Error(`la plantilla "${plantilla.id}" tiene vacío el texto de ${donde}: ningún texto del catálogo puede quedar en blanco ni en un marcador de posición`);
  }
  const tope = TOPES_DE_TEXTO[clase];
  if (texto.length > tope) {
    throw new Error(
      `el texto de ${donde} de la plantilla "${plantilla.id}" ocupa ${texto.length} caracteres y el tope de la clase "${clase}" es ${tope}: ` +
      'un texto que no cabe se recorta a mitad de frase, y eso se lee peor que uno escrito corto a propósito',
    );
  }
  for (const ranura of ranurasDeTexto(texto)) {
    exigeRanura(ranura, `el texto de ${donde} de la plantilla "${plantilla.id}" usa la ranura`);
  }
  const infracciones = infraccionesDeTexto(texto, { locale: 'es' });
  if (infracciones.length) {
    const detalle = infracciones.map((i) => `${i.familia}: "${i.fragmento}"`).join('; ');
    throw new Error(`el texto de ${donde} de la plantilla "${plantilla.id}" rompe las reglas de lenguaje — ${detalle}`);
  }
  // Y **escrito para leerse en voz alta** (`personaje.md` §4): las cifras ya las cazan
  // las reglas de lenguaje de arriba y esto añade lo que no es cifra —siglas, símbolos,
  // barras, paréntesis y abreviaturas—. El modo compañía es la razón: alguien lee esto
  // en alto a otra persona, y un paréntesis de aclaración no se lee.
  const sinVoz = infraccionesDeLecturaEnVozAlta(texto, { locale: 'es' }).filter((i) => i.familia === 'sinVoz');
  if (sinVoz.length) {
    const detalle = sinVoz.map((i) => `${i.formula}: "${i.fragmento}"`).join('; ');
    throw new Error(`el texto de ${donde} de la plantilla "${plantilla.id}" no se puede leer en voz alta — ${detalle}`);
  }
}

/** La fórmula con la que abre un gancho: sus primeras palabras, normalizadas. */
export function aperturaDeGancho(gancho) {
  return gancho
    .toLowerCase()
    .replace(/[«»"'¡!¿?.,;:—-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}

function compruebaPlantilla(plantilla, indice) {
  const id = plantilla?.id;
  if (typeof id !== 'string' || !id) {
    throw new Error(`la plantilla en la posición ${indice + 1} del catálogo no tiene identificador`);
  }
  // Lo que ya comprobaba el motor —roles con tipo, orden declarado, cadena de beats,
  // disparadores y resultados del enumerado— no se reescribe: se llama.
  validaPlantilla(plantilla);
  afinidadDePlantilla(plantilla);

  // 1 · El tamaño, y los beats que caben en él. El casting lo comprueba también,
  // pero allí es un motivo de fallo del mundo y aquí es un error de escritura.
  const rango = RANGO_DE_BEATS[plantilla.tamano];
  if (plantilla.beats.length < rango.minimo || plantilla.beats.length > rango.maximo) {
    throw new Error(
      `la plantilla "${id}" declara el tamaño "${plantilla.tamano}" y escribe ${plantilla.beats.length} beats: ese tamaño admite entre ${rango.minimo} y ${rango.maximo}`,
    );
  }
  // 2 · El lazo, por el lado que es de la plantilla: el primero y el último beat
  // comparten rol, o caen los dos en un rol del mismo tipo. Lo demás —que estén
  // cerca de verdad— lo mide el casting sobre el grafo.
  const primero = plantilla.beats[0].rol;
  const ultimo = plantilla.beats[plantilla.beats.length - 1].rol;
  if (primero !== ultimo && plantilla.roles[primero].tipo !== plantilla.roles[ultimo].tipo) {
    throw new Error(
      `la plantilla "${id}" empieza en el rol "${primero}" y termina en "${ultimo}", que no comparten ni rol ni tipo de sitio: ` +
      'una aventura se cierra donde se abrió, y el precedente de «tres pistas» es que el defecto es de la plantilla',
    );
  }

  // 3 · La declaración de rumor, con la forma que SPEC-012 ya valida al nacer.
  const rumor = declaracionDeRumor(plantilla);
  if (rumor.notable) {
    const semilla = plantilla.rumor.semilla;
    if (!semilla || typeof semilla !== 'object') {
      throw new Error(`la plantilla "${id}" declara su desenlace notable y no trae semilla de rumor: sin ella el rumor nacería sin hechos que contar`);
    }
    for (const campo of ['asunto', 'escala', 'detalle']) {
      if (semilla[campo] === undefined || semilla[campo] === null) {
        throw new Error(`la semilla de rumor de la plantilla "${id}" no declara "${campo}": la semilla son hechos estructurados —asunto, escala y detalle— y ninguno es prosa`);
      }
    }
    if (typeof semilla.asunto !== 'string' || !semilla.asunto) {
      throw new Error(`el asunto de la semilla de rumor de la plantilla "${id}" tiene que ser un identificador y llegó ${JSON.stringify(semilla.asunto)}`);
    }
    if (typeof semilla.escala !== 'object' || typeof semilla.detalle !== 'object') {
      throw new Error(`la escala y el detalle de la semilla de rumor de la plantilla "${id}" son hechos estructurados, no prosa`);
    }
  }

  // 4 · El mote candidato: **clave**, y solo si hay rumor del que colgarlo.
  if (rumor.notable) {
    exigeCandidato(plantilla.mote, `el mote candidato de la plantilla "${id}"`);
    if (/\s/.test(plantilla.mote)) {
      throw new Error(`el mote candidato de la plantilla "${id}" está redactado ("${plantilla.mote}"): es una clave, y las palabras con que se dice las pone quien escribe`);
    }
  } else if (plantilla.mote != null) {
    throw new Error(
      `la plantilla "${id}" declara el mote candidato "${plantilla.mote}" y su desenlace no es notable: el mote nace del rumor, ` +
      'así que un desenlace que nadie cuenta no puede pegar ninguno',
    );
  }

  // 5 · Lo que entrega el desenlace: oro entero no negativo —cero es una
  // declaración legítima— y objetos con clase y procedencia estructurada.
  const desenlace = plantilla.desenlace;
  if (!desenlace || typeof desenlace !== 'object') {
    throw new Error(`la plantilla "${id}" no declara desenlace: sin él no hay ni qué se cuenta ni qué se entrega al terminar`);
  }
  exigeCantidadDeOro(desenlace.oro, `el oro que declara el desenlace de la plantilla "${id}"`);
  const objetos = desenlace.objetos ?? [];
  if (!Array.isArray(objetos)) {
    throw new Error(`el desenlace de la plantilla "${id}" declara sus objetos como ${JSON.stringify(objetos)}: se espera una lista, aunque esté vacía`);
  }
  for (const objeto of objetos) {
    if (typeof objeto?.id !== 'string' || !objeto.id) {
      throw new Error(`el desenlace de la plantilla "${id}" entrega un objeto sin identidad: ${JSON.stringify(objeto)}`);
    }
    exigeClaseDeObjeto(objeto.clase, `la clase del objeto "${objeto.id}" que entrega la plantilla "${id}"`);
    procedenciaDeObjeto(objeto.procedencia ?? null, `la procedencia del objeto "${objeto.id}" de la plantilla "${id}"`);
  }

  // 6 · Los dos desenlaces de repuesto. Dos y no uno: `bucle-jugable.md` §4 describe
  // dos salidas distintas —cómo acabó sin quien juega, o cerrar con lo que sí
  // consiguió— y uno solo mentiría en la mitad de los cortes.
  const repuesto = plantilla.repuesto;
  if (!repuesto || typeof repuesto !== 'object') {
    throw new Error(`la plantilla "${id}" no declara desenlaces de repuesto: son los dos textos con los que se echa el telón a mitad de camino`);
  }
  for (const cual of REPUESTOS) {
    if (typeof repuesto[cual] !== 'string' || !repuesto[cual].trim()) {
      throw new Error(`la plantilla "${id}" no declara el desenlace de repuesto "${cual}": los dos son obligatorios (${REPUESTOS.join(' y ')})`);
    }
  }

  // 7 · Los actos que rompen y los que reparan. Cada uno nombra el rol de la cara
  // afectada, trae su signo del enumerado y **cuelga de una decisión de un beat**:
  // colgarlo de no haber llegado sería reprochar la ausencia por la puerta de atrás.
  const efectos = plantilla.relacion ?? [];
  if (!Array.isArray(efectos)) {
    throw new Error(`la plantilla "${id}" declara sus efectos de relación como ${JSON.stringify(efectos)}: se espera una lista, y estar vacía es legítimo`);
  }
  for (const efecto of efectos) {
    const rol = plantilla.roles[efecto?.rol];
    if (!rol) {
      throw new Error(`la plantilla "${id}" declara un efecto de relación sobre el rol huérfano ${JSON.stringify(efecto?.rol)}, que no está entre sus roles`);
    }
    if (!ROLES_CON_GENTE.includes(rol.tipo)) {
      throw new Error(
        `la plantilla "${id}" declara un efecto de relación sobre el rol "${efecto.rol}", que es de tipo "${rol.tipo}": ` +
        `una relación es con una cara, y las caras pertenecen a sitios con gente (${ROLES_CON_GENTE.join(', ')})`,
      );
    }
    exigeSignoDeActo(efecto?.signo, `el signo del acto que la plantilla "${id}" declara sobre el rol "${efecto.rol}"`);
    if (!Number.isInteger(efecto.beat) || efecto.beat < 1 || efecto.beat > plantilla.beats.length) {
      throw new Error(
        `el acto que la plantilla "${id}" declara sobre el rol "${efecto.rol}" dice colgar del beat ${JSON.stringify(efecto.beat)}, que no existe: ` +
        `la cadena tiene ${plantilla.beats.length} beats y un acto se dispara dentro de uno`,
      );
    }
    if (typeof efecto.decision !== 'string' || !efecto.decision) {
      throw new Error(`el acto que la plantilla "${id}" declara sobre el rol "${efecto.rol}" no dice qué decisión lo dispara`);
    }
    if (DECISIONES_PROHIBIDAS.includes(efecto.decision)) {
      throw new Error(
        `el acto que la plantilla "${id}" declara sobre el rol "${efecto.rol}" se dispara con "${efecto.decision}", que no es una decisión: ` +
        `${DECISIONES_PROHIBIDAS.join(', ')} son maneras de no llegar, y aquí no se penaliza la ausencia (quests.md decisión 4)`,
      );
    }
  }

  // 8 · La revisión a mano, con una fila por plantilla. Una plantilla sin revisar no
  // entra: es la mitad de «el chiste nunca es a costa del sitio real» que ninguna
  // aserción captura, y dejarla como intención es como se pierde.
  if (typeof plantilla.revision !== 'string' || plantilla.revision.trim().length === 0) {
    throw new Error(
      `la plantilla "${id}" no trae su fila de revisión: la mitad del tono que no se puede afirmar va a mano, ` +
      'y una plantilla sin revisar no entra en el catálogo',
    );
  }

  // 9 · Los textos, uno por uno: no vacíos, dentro de su tope, con ranuras del
  // catálogo cerrado y sin ninguna de las fórmulas que el paquete de idioma prohíbe.
  for (const t of textosDelCatalogo([plantilla])) exigeTexto(plantilla, t.clase, t.donde, t.texto);

  // 10 · Cada hueco que la plantilla puede pedirle al narrador, con su fallback. Sin
  // uno de ellos la plantilla se rechaza **aquí**, al cargar el catálogo, y no la
  // primera vez que alguien se quede sin cobertura: el fallback es el camino normal.
  for (const hueco of huecosDePlantilla(plantilla)) {
    if (typeof hueco.fallback !== 'string' || !hueco.fallback.trim()) {
      throw new Error(
        `el hueco "${hueco.clave}" de la plantilla "${id}" no declara texto de fallback: ` +
        'todo hueco que se le puede pedir al narrador tiene el suyo, porque sin red la aventura se juega entera igual',
      );
    }
    if (hueco.fallback.length > hueco.tope) {
      throw new Error(`el fallback del hueco "${hueco.clave}" de la plantilla "${id}" ocupa ${hueco.fallback.length} caracteres y su tope es ${hueco.tope}`);
    }
  }

  // 11 · Los disparadores que traen texto propio.
  plantilla.beats.forEach((b, i) => {
    if (b.disparador.tipo === 'franja' && !b.disparador.variante) {
      throw new Error(`el beat ${i + 1} de la plantilla "${id}" dispara en franja y no trae la variante de escena de llegar dentro de ella`);
    }
    // La de fuera la exige ya `validaPlantilla`, que es estructura; aquí se comprueba
    // lo que es **tono**: que cuente lo que pasó mientras tanto y no lo que quien juega
    // dejó de hacer. Un reproche por llegar tarde es penalizar la ausencia con otras
    // palabras, y eso es lo que `quests.md` decisión 4 prohíbe.
    if (b.disparador.tipo === 'franja') {
      const reproches = infraccionesDeReproche(b.disparador.varianteFuera);
      if (reproches.length) {
        throw new Error(
          `la variante de fuera de franja del beat ${i + 1} de la plantilla "${id}" reprocha llegar tarde ` +
          `(${reproches.map((r) => `"${r.fragmento}"`).join(', ')}): cuenta lo que pasó mientras tanto, nunca lo que no se hizo`,
        );
      }
    }
    if (b.disparador.tipo === 'con_objeto' && !b.disparador.viaAlternativa?.texto) {
      throw new Error(`el beat ${i + 1} de la plantilla "${id}" dispara con objeto y su vía alternativa no trae texto: sin él la aventura se queda muda por ese lado`);
    }
  });
}

/**
 * Comprueba el catálogo entero y devuelve la lista tal cual. Falla nombrando la
 * plantilla y el campo, o —cuando lo que falla es una propiedad del conjunto— el
 * número que hay y el que se pedía.
 */
export function compruebaCatalogo(catalogo) {
  if (!Array.isArray(catalogo)) {
    throw new Error(`el catálogo de plantillas tiene que ser una lista y llegó ${typeof catalogo}`);
  }
  if (catalogo.length < TAMANO_DEL_CATALOGO.minimo || catalogo.length > TAMANO_DEL_CATALOGO.maximo) {
    throw new Error(
      `el catálogo trae ${catalogo.length} plantillas y el rango declarado es de ${TAMANO_DEL_CATALOGO.minimo} a ${TAMANO_DEL_CATALOGO.maximo}: ` +
      'por debajo ningún oficio llega a diez esqueletos jugables, y por encima el catálogo deja de caber en una revisión a mano',
    );
  }
  const vistos = new Set();
  catalogo.forEach((plantilla, i) => {
    compruebaPlantilla(plantilla, i);
    if (vistos.has(plantilla.id)) {
      throw new Error(`el catálogo repite el identificador "${plantilla.id}": los identificadores viven en partidas guardadas y en el informe, así que son únicos`);
    }
    vistos.add(plantilla.id);
  });

  // --- las propiedades del conjunto ---

  // Los tres tamaños representados: un catálogo sin jornadas ofrece paseos y llama
  // jornada a lo que nunca sale.
  for (const tamano of IDS_DE_TAMANO) {
    if (!catalogo.some((p) => p.tamano === tamano)) {
      throw new Error(`ninguna plantilla del catálogo declara el tamaño "${tamano}": los tres tamaños de salida se ofrecen, así que los tres se escriben`);
    }
  }

  // La afinidad, con sus dos cotas y sus exclusivas.
  const media = mediaDeAfinidades(catalogo);
  if (media < MEDIA_DE_AFINIDADES.minima || media > MEDIA_DE_AFINIDADES.maxima) {
    throw new Error(
      `la media de oficios por plantilla es ${media.toFixed(2)} y tiene que estar entre ${MEDIA_DE_AFINIDADES.minima} y ${MEDIA_DE_AFINIDADES.maxima}: ` +
      'por debajo el catálogo por oficio se queda corto y por encima el oficio deja de filtrar',
    );
  }
  let exclusivas = 0;
  for (const oficio of OFICIOS) {
    const suyas = exclusivasDeOficio(oficio, catalogo);
    if (suyas.length === 0) {
      throw new Error(
        `el oficio "${oficio}" no tiene ninguna plantilla exclusiva: sin exclusivas el oficio deja de filtrar y solo cambia la voz, ` +
        'que es la opción que `personaje.md` §3 descartó',
      );
    }
    exclusivas += suyas.length;
  }
  const topeDeExclusivas = Math.floor(catalogo.length / 3);
  if (exclusivas > topeDeExclusivas) {
    throw new Error(
      `el catálogo declara ${exclusivas} plantillas exclusivas y el tope es ${topeDeExclusivas}, un tercio: ` +
      'con más, cada oficio acaba con su rincón privado y el catálogo compartido se vacía',
    );
  }

  // Variar los roles, que es lo que ataca el cuello de botella medido: el barrio.
  const sinParaje = catalogo.filter((p) => rolesDeParajeDe(p).length === 0);
  const sueloSinParaje = Math.ceil(catalogo.length / 3);
  if (sinParaje.length < sueloSinParaje) {
    throw new Error(
      `solo ${sinParaje.length} plantillas del catálogo no piden ningún paraje y hacen falta ${sueloSinParaje}, un tercio: ` +
      'los fallos medidos dicen todos lo mismo —sin candidatos para un paraje con escena X—, así que crecer sin variar los roles es crecer en el mismo sitio',
    );
  }
  const conMuchosParajes = catalogo.filter((p) => rolesDeParajeDe(p).length > 2);
  const topeDeMuchosParajes = Math.floor(catalogo.length / 4);
  if (conMuchosParajes.length > topeDeMuchosParajes) {
    throw new Error(
      `${conMuchosParajes.length} plantillas piden más de dos parajes y el tope es ${topeDeMuchosParajes}, un cuarto: ` +
      `${conMuchosParajes.map((p) => p.id).join(', ')}`,
    );
  }
  for (const tipo of TIPOS_DE_ROL) {
    if (!catalogo.some((p) => tiposDeRolDe(p).includes(tipo))) {
      throw new Error(`ninguna plantilla del catálogo pide un rol de tipo "${tipo}": los cuatro tipos existen para usarse, y uno sin usar es un tipo que nadie prueba`);
    }
  }
  const porCombinacion = new Map();
  for (const p of catalogo) {
    const clave = [...tiposDeRolDe(p)].sort().join('+');
    porCombinacion.set(clave, (porCombinacion.get(clave) ?? 0) + 1);
  }
  const topeDeCombinacion = Math.floor(catalogo.length / 3);
  for (const clave of [...porCombinacion.keys()].sort()) {
    if (porCombinacion.get(clave) > topeDeCombinacion) {
      throw new Error(
        `${porCombinacion.get(clave)} plantillas piden la misma combinación de tipos de rol (${clave}) y el tope es ${topeDeCombinacion}, un tercio: ` +
        'un catálogo que crece repitiendo la forma falla en los mismos barrios por la misma razón',
      );
    }
  }

  // Los desenlaces que nadie cuenta, que son los que le dan volumen al mundo.
  const noNotables = catalogo.filter((p) => p.rumor.notable === false);
  if (noNotables.length < 2) {
    throw new Error(
      `solo ${noNotables.length} plantillas del catálogo tienen desenlace no notable y hacen falta dos: ` +
      'un mundo donde todo lo que haces se cuenta por los caminos es un mundo sin volumen, y con una sola, retirarla deja el caso sin cubrir',
    );
  }

  // Los motes: una clave no puede significar dos cosas.
  const asuntoPorMote = new Map();
  for (const p of catalogo) {
    if (!p.mote) continue;
    const asunto = p.rumor.semilla?.asunto ?? null;
    const ya = asuntoPorMote.get(p.mote);
    if (ya !== undefined && ya.asunto !== asunto) {
      throw new Error(
        `el mote candidato "${p.mote}" lo declaran "${ya.plantilla}" y "${p.id}" con asuntos distintos ("${ya.asunto}" y "${asunto}"): ` +
        'un mote es lo que se cuenta de ti, y dos historias distintas con el mismo nombre lo vuelven ruido',
      );
    }
    if (ya === undefined) asuntoPorMote.set(p.mote, { plantilla: p.id, asunto });
  }

  // Las llaves: ninguna puerta declarada sin nadie que entregue una llave.
  const puertas = beatsConObjeto(catalogo);
  const llaves = llavesQueEntregaElCatalogo(catalogo);
  if (llaves.length < puertas.length) {
    throw new Error(
      `el catálogo declara ${puertas.length} beats que disparan con objeto y solo ${llaves.length} objetos de clase ${CLASE_QUE_ABRE} que alguien entregue: ` +
      'una llave declarada que no entrega nadie es una puerta que solo se abre por la vía alternativa, siempre',
    );
  }

  // Los actos, por los dos lados. Sin actos feos escritos no hay nada que romper;
  // sin reparadores, lo roto se queda roto y la escalera de SPEC-014 solo baja.
  const conActo = (signo) => catalogo.filter((p) => (p.relacion ?? []).some((e) => e.signo === signo));
  for (const [signo, suelo] of [[SIGNOS_DE_ACTO.FEO, 3], [SIGNOS_DE_ACTO.REPARADOR, 3]]) {
    const cuantas = conActo(signo).length;
    if (cuantas < suelo) {
      throw new Error(`solo ${cuantas} plantillas declaran algún acto "${signo}" y hacen falta ${suelo}: con menos, la mitad de la escalera de relación no la mueve nada de lo escrito`);
    }
  }

  // Los marcos de escena: ninguna escena del catálogo se queda sin titular ni sin verbo
  // para su única acción. Se comprueba aquí y no en la primera pantalla que la monte,
  // por lo mismo que la cobertura de escenas de paraje.
  compruebaCoberturaDeMarcos(catalogo);

  // Las aperturas de gancho: dos plantillas que empiezan igual se leen como la misma.
  const aperturas = new Map();
  for (const p of catalogo) {
    const apertura = aperturaDeGancho(p.gancho);
    if (aperturas.has(apertura)) {
      throw new Error(`las plantillas "${aperturas.get(apertura)}" y "${p.id}" abren su gancho con la misma fórmula ("${apertura}"): en voz alta suenan a la misma aventura`);
    }
    aperturas.set(apertura, p.id);
  }

  return catalogo;
}

/**
 * El catálogo, ya comprobado. Es lo que castea SPEC-010 y lo que filtra el oficio, y
 * **se recorre en el orden declarado de la lista**: nunca el de una estructura con
 * orden de inserción.
 */
export const CATALOGO = compruebaCatalogo(TEMPLATES);
