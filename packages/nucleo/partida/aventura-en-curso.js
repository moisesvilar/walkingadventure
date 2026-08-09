// El motor de la aventura en curso: **aceptar, resolver el beat que toca y declarar
// cómo acabó**. Tres transiciones y ninguna más.
//
// Es lo que faltaba entre las dos mitades que ya existían: el paquete sabía castear una
// aventura desde SPEC-010 y sabía cerrarla en progresión desde SPEC-015, y entre esas dos
// cosas no había nada — el área `aventuras` del estado estaba declarada con el registro de
// la salida abierta de SPEC-028 y sus cuatro tipos de hecho se reconocían sin poder
// reproducirse. Es también lo que la verificación a mano del entregable de B2 echó en
// falta (`pipeline/decisiones-orquestador.md` §6r): «aceptar, recorrer y cerrar una
// aventura es orquestación que hoy no existe en el núcleo».
//
// Cuatro decisiones lo gobiernan:
//
//   · **Ninguna transición inventa contenido.** El desenlace, el repuesto, el mote
//     candidato y la declaración de rumor son de la plantilla y viajan tal cual. Este
//     motor los transporta y no redacta ni uno.
//   · **Resolver dos veces el mismo beat es inocuo; resolver el que no toca falla.**
//     Pasar cerca de un beat valida igual y la app puede componer la misma escena dos
//     veces por cerrarse y abrirse, así que la repetición es una situación normal y no un
//     error. Resolver el que **no** toca sí lo es: eso es un cableado mal hecho.
//   · **Nada degrada por falta de cableado** (§6h). El registro de hechos, el reloj de
//     pared de un beat de franja y la vista de tenencia de un beat de objeto se exigen, y
//     su ausencia falla nombrándolos en vez de resolver el beat a medias.
//   · **Esto no es una fase de generación.** Es capa sobre el mundo congelado, como el
//     motor de pasos: no toca la tubería y no puede resembrar nada.
//
// Y lo que **no** hay, que es la mitad de la decisión: no se emite `decision-en-aventura`
// en ninguna transición, no hay campo de opciones y no hay segundo beat siguiente. La
// ramificación es exclusión 9 del PRD y preparar el hueco sería tomar la decisión por la
// vía de los hechos.
//
// Límite declarado de la reproducción: del registro vuelven **qué aventura está en curso y
// cómo acabaron las cerradas**, que es lo que sus cuatro tipos de hecho llevan dentro. El
// avance dentro de la cadena no deja hecho propio —SPEC-016 no declaró ninguno y añadirlo
// ahora rompería el presupuesto por hecho—, así que una partida reconstruida vuelve con la
// aventura en su primer beat. Manda el estado guardado, y la diferencia sale nombrada en
// el diagnóstico de discrepancia en lugar de inventarse.

import { congelaHondo } from '../core/congelar.js';
import { varianteDelBeat } from '../quests/escena.js';
import { anexa, hecho } from './hechos.js';
import { SIN_OBJETOS, exigeTenencia, resuelveBifurcacion } from './objetos.js';
import { exigeMapaId } from './pasos.js';

/** Cómo puede acabar una aventura. Dos maneras y ninguna más. */
export const COMO_ACABO = Object.freeze({ TERMINADA: 'terminada', A_MEDIAS: 'a-medias' });

/** Las dos maneras, en orden estable. */
export const IDS_DE_COMO_ACABO = congelaHondo(Object.values(COMO_ACABO).slice().sort());

/** Los tipos de hecho que este motor emite, uno por transición. */
export const HECHOS_QUE_EMITE = congelaHondo(['aventura-aceptada', 'aventura-cerrada', 'aventura-abandonada']);

/**
 * El tipo declarado que **ninguna transición emite**.
 *
 * Sigue en el catálogo de hechos porque quitarlo rompería la reconstrucción de partidas
 * futuras, y se nombra aquí para que «ninguna aventura del catálogo pide una decisión»
 * se pueda poner rojo en lugar de quedarse en una promesa.
 */
export const HECHO_QUE_NADIE_EMITE = 'decision-en-aventura';

/** El registro de aventuras de una partida recién creada: ninguna en curso y ninguna cerrada. */
export function estadoDeAventuras() {
  return { enCurso: null, cerradas: [] };
}

function exigeRegistroDeAventuras(estado) {
  if (!estado || typeof estado !== 'object' || !('enCurso' in estado) || !Array.isArray(estado.cerradas)) {
    throw new Error('el registro de aventuras llega mal formado: se espera lo que devuelve estadoDeAventuras(), un objeto con "enCurso" y "cerradas"');
  }
  return estado;
}

function exigeTexto(valor, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} se declara con su identificador y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  return valor;
}

function exigeRegistroDeHechos(registro, quien) {
  if (!registro || typeof registro !== 'object' || !Array.isArray(registro.hechos)) {
    throw new Error(
      `${quien} necesita el registro de hechos de la partida (registroInicial()) y llegó ${JSON.stringify(registro) ?? String(registro)}: ` +
      'cada cosa que altera el estado deja hecho, y una transición sin registro dejaría el área sin reconstruir',
    );
  }
  return registro;
}

/** La aventura en curso, congelada, o `null`. `null` es una respuesta y no un error. */
export function aventuraEnCurso(estado) {
  const enCurso = exigeRegistroDeAventuras(estado).enCurso;
  return enCurso ? congelaHondo({ ...enCurso, resueltos: enCurso.resueltos.map((r) => ({ ...r })) }) : null;
}

/** Si hay una aventura en curso. */
export function hayAventuraEnCurso(estado) {
  return aventuraEnCurso(estado) !== null;
}

/** Las aventuras ya cerradas de la partida, en el orden en que se cerraron. */
export function aventurasCerradas(estado) {
  return congelaHondo(exigeRegistroDeAventuras(estado).cerradas.map((c) => ({ ...c })));
}

function laUltimaCerrada(estado) {
  const cerradas = exigeRegistroDeAventuras(estado).cerradas;
  return cerradas.length ? cerradas[cerradas.length - 1] : null;
}

function exigeCadena(aventura) {
  const beats = aventura?.beats;
  if (!Array.isArray(beats) || beats.length === 0) {
    throw new Error(`la aventura "${aventura?.id ?? '(sin id)'}" llega sin cadena de beats: se acepta la aventura casteada de SPEC-010, con sus beats`);
  }
  beats.forEach((b, i) => {
    if (b?.n !== i + 1) {
      throw new Error(`la cadena de la aventura "${aventura.id}" numera su beat ${i + 1} como ${JSON.stringify(b?.n) ?? String(b?.n)}: los beats van numerados desde uno y en orden`);
    }
    const siguiente = b?.resultado?.siguienteBeat ?? null;
    const esperado = i === beats.length - 1 ? null : i + 2;
    if (siguiente !== esperado) {
      throw new Error(
        `el beat ${b.n} de la aventura "${aventura.id}" empuja al beat ${JSON.stringify(siguiente)} y la cadena lineal esperaba ${JSON.stringify(esperado)}: ` +
        'cada beat apunta a un único siguiente y solo el último no apunta a ninguno',
      );
    }
  });
  return beats;
}

/**
 * Acepta una aventura casteada: queda en curso, con su beat en curso puesto en el
 * primero y ningún beat resuelto.
 *
 * Con una ya en curso **falla nombrándola**: hay una salida y una aventura, y aceptar la
 * segunda en silencio perdería la primera.
 */
export function acepta(estado, { aventura, mapaId, registro, dia, paso }) {
  const suyo = exigeRegistroDeAventuras(estado);
  const id = exigeTexto(aventura?.id, 'la aventura que se acepta');
  const plantilla = exigeTexto(aventura?.plantilla, `la plantilla de la aventura "${id}"`);
  const mapa = exigeMapaId(mapaId, `la aventura "${id}"`);
  exigeCadena(aventura);
  exigeRegistroDeHechos(registro, `aceptar la aventura "${id}"`);
  if (suyo.enCurso) {
    throw new Error(
      `no se puede aceptar la aventura "${id}" con la aventura "${suyo.enCurso.aventura}" todavía en curso: ` +
      'hay una salida y una aventura, y la anterior se cierra —terminada o a medias— antes de aceptar otra',
    );
  }
  suyo.enCurso = { aventura: id, plantilla, mapa, beatEnCurso: 1, resueltos: [] };
  anexa(registro, [hecho({ tipo: 'aventura-aceptada', mapa, dia, paso, carga: { aventura: id, plantilla } })]);
  return aventuraEnCurso(suyo);
}

/**
 * Resuelve el beat que toca.
 *
 * El beat entra **entero**, tal como lo dejó el casting: de él salen por qué vía se
 * atraviesa —la del objeto o la alternativa, que resuelven el mismo beat y empujan al
 * mismo siguiente— y qué variante de escena se lee, que es lo único que decide el reloj
 * de pared. **El minuto no se guarda**: lo que queda anotado es la variante.
 *
 * Resolverlo dos veces no cambia nada. Resolver otro falla nombrando el que llegó y el
 * que se esperaba, y no avanza.
 */
export function resuelveBeat(estado, { beat, reloj = null, tenencia = null }) {
  const suyo = exigeRegistroDeAventuras(estado);
  const enCurso = suyo.enCurso;
  if (!enCurso) {
    const ultima = laUltimaCerrada(suyo);
    if (ultima) {
      throw new Error(
        `la aventura "${ultima.aventura}" ya está cerrada (${ultima.comoAcabo}) y no admite resolver ningún beat: ` +
        'una aventura cerrada no vuelve a abrirse, y la siguiente se acepta desde la lista',
      );
    }
    throw new Error('no hay ninguna aventura en curso en la que resolver un beat: la aventura se acepta antes de recorrerla');
  }
  if (!Number.isInteger(beat?.n)) {
    throw new Error(`el beat que se resuelve llega sin número: se espera el beat casteado entero de SPEC-010 y llegó ${JSON.stringify(beat) ?? String(beat)}`);
  }

  const yaResuelto = enCurso.resueltos.find((r) => r.n === beat.n);
  if (yaResuelto) {
    // Inocuo: ni se avanza, ni se anota otra vez, ni se emite ningún hecho. Se devuelve
    // lo mismo que la primera vez, que es lo que la app necesita para volver a pintar la
    // escena después de cerrarse y abrirse.
    return congelaHondo({
      aventura: enCurso.aventura,
      beat: beat.n,
      via: yaResuelto.via,
      variante: yaResuelto.variante,
      objeto: yaResuelto.objeto,
      siguienteBeat: enCurso.beatEnCurso,
      resueltos: enCurso.resueltos.length,
      terminada: enCurso.beatEnCurso === null,
      yaEstaba: true,
    });
  }
  if (beat.n !== enCurso.beatEnCurso) {
    throw new Error(
      `llegó el beat ${beat.n} de la aventura "${enCurso.aventura}" y el que toca es el ${JSON.stringify(enCurso.beatEnCurso)}: ` +
      'la cadena es lineal y se recorre en orden, así que resolver otro sería saltarse el que falta',
    );
  }

  const franja = varianteDelBeat({ beat, reloj });
  const via = resuelveBifurcacion({
    beat,
    tenencia: beat.disparador?.tipo === 'con_objeto'
      ? exigeTenencia(tenencia, `resolver el beat ${beat.n} de la aventura "${enCurso.aventura}", que dispara con objeto,`)
      : SIN_OBJETOS,
  });

  const anotado = {
    n: beat.n,
    via: via.conObjeto ? via.via : 'llegada',
    variante: franja.conFranja ? franja.variante : null,
    objeto: beat.resultado?.objeto ?? null,
  };
  enCurso.resueltos = [...enCurso.resueltos, anotado];
  enCurso.beatEnCurso = beat.resultado?.siguienteBeat ?? null;

  return congelaHondo({
    aventura: enCurso.aventura,
    beat: beat.n,
    via: anotado.via,
    variante: anotado.variante,
    objeto: anotado.objeto,
    siguienteBeat: enCurso.beatEnCurso,
    resueltos: enCurso.resueltos.length,
    // La cadena se acabó: la aventura queda lista para cerrarse como terminada.
    terminada: enCurso.beatEnCurso === null,
    yaEstaba: false,
  });
}

/**
 * Cierra la aventura en curso y declara **cómo acabó**.
 *
 * Con el último beat resuelto queda **terminada**, con el desenlace de su plantilla; con
 * beats sin resolver queda **a medias**, con cuántos se resolvieron y qué se llegó a
 * conseguir. Cerrar con cero beats resueltos la declara a medias y **no la borra**: el
 * cierre en corto da un final digno también a quien no llegó a empezar, y borrarla
 * dejaría el hilo colgando que la decisión existe para evitar.
 *
 * `desenlace` y `motivo` son de la plantilla y viajan tal cual: aquí no se redacta nada.
 */
export function cierra(estado, { registro, dia, paso, desenlace = null, motivo = null }) {
  const suyo = exigeRegistroDeAventuras(estado);
  const enCurso = suyo.enCurso;
  if (!enCurso) {
    throw new Error('no hay ninguna aventura en curso que cerrar: cerrarla dos veces la declararía acabada dos veces');
  }
  exigeRegistroDeHechos(registro, `cerrar la aventura "${enCurso.aventura}"`);
  const comoAcabo = enCurso.beatEnCurso === null ? COMO_ACABO.TERMINADA : COMO_ACABO.A_MEDIAS;
  const cerrada = {
    aventura: enCurso.aventura,
    plantilla: enCurso.plantilla,
    mapa: enCurso.mapa,
    comoAcabo,
    desenlace: comoAcabo === COMO_ACABO.TERMINADA ? desenlace ?? null : null,
    motivo: comoAcabo === COMO_ACABO.A_MEDIAS ? motivo ?? null : null,
  };
  const conseguido = enCurso.resueltos.filter((r) => r.objeto).map((r) => r.objeto);
  const resueltos = enCurso.resueltos.length;

  anexa(registro, [comoAcabo === COMO_ACABO.TERMINADA
    ? hecho({ tipo: 'aventura-cerrada', mapa: enCurso.mapa, dia, paso, carga: { aventura: enCurso.aventura, desenlace: cerrada.desenlace } })
    : hecho({ tipo: 'aventura-abandonada', mapa: enCurso.mapa, dia, paso, carga: { aventura: enCurso.aventura, motivo: cerrada.motivo } })]);

  suyo.cerradas = [...suyo.cerradas, cerrada];
  suyo.enCurso = null;
  return congelaHondo({ ...cerrada, resueltos, conseguido });
}

// --- Serialización -------------------------------------------------------------

/** El registro en documento. Sin aventura en curso escribe `null`, que es su estado normal. */
export function congelaAventuras(estado) {
  const suyo = exigeRegistroDeAventuras(estado);
  const enCurso = suyo.enCurso;
  return {
    enCurso: enCurso
      ? {
        aventura: enCurso.aventura,
        plantilla: enCurso.plantilla,
        mapa: enCurso.mapa,
        beatEnCurso: enCurso.beatEnCurso ?? null,
        resueltos: enCurso.resueltos.map((r) => ({ n: r.n, via: r.via, variante: r.variante ?? null, objeto: r.objeto ?? null })),
      }
      : null,
    cerradas: suyo.cerradas.map((c) => ({
      aventura: c.aventura,
      plantilla: c.plantilla ?? null,
      mapa: c.mapa,
      comoAcabo: c.comoAcabo,
      desenlace: c.desenlace ?? null,
      motivo: c.motivo ?? null,
    })),
  };
}

/** El registro de vuelta de su documento. */
export function levantaAventuras(doc) {
  const estado = estadoDeAventuras();
  const enCurso = doc?.enCurso ?? null;
  if (enCurso) {
    estado.enCurso = {
      aventura: exigeTexto(enCurso.aventura, 'la aventura en curso guardada'),
      plantilla: exigeTexto(enCurso.plantilla, 'la plantilla de la aventura en curso guardada'),
      mapa: exigeMapaId(enCurso.mapa, 'la aventura en curso guardada'),
      beatEnCurso: enCurso.beatEnCurso ?? null,
      resueltos: (enCurso.resueltos ?? []).map((r) => ({ n: r.n, via: r.via, variante: r.variante ?? null, objeto: r.objeto ?? null })),
    };
  }
  estado.cerradas = (doc?.cerradas ?? []).map((c) => ({
    aventura: exigeTexto(c.aventura, 'una aventura cerrada guardada'),
    plantilla: c.plantilla ?? null,
    mapa: exigeMapaId(c.mapa, 'una aventura cerrada guardada'),
    comoAcabo: c.comoAcabo,
    desenlace: c.desenlace ?? null,
    motivo: c.motivo ?? null,
  }));
  return estado;
}
