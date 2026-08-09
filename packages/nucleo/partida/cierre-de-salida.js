// El cierre de una salida: la operación que coordina, **en una sola escritura y a todo o
// nada**, los ganchos que cinco filas anteriores dejaron puestos sin llamador.
//
// `cierraSalidaDeProgresion` (SPEC-015), el cierre de la cola de entregas (SPEC-019), el
// cierre de la capa de NPCs (SPEC-014), `naceRumor` (SPEC-012) y el apunte del diario
// (SPEC-016) existían los cinco esperando a alguien que los llamara. Ninguna spec los
// coordina; esta lo hace, con la misma forma que todos ellos: **se valida y se calcula
// entero, y solo cuando no queda nada que pueda fallar se escribe.**
//
// Y la manera en que se consigue es la que hace la promesa comprobable en lugar de
// confiada: el cierre entero corre sobre **copias de trabajo** de las áreas que toca —la
// ida y vuelta por su propio esquema, que ya existe y ya valida— y solo al final se vuelca
// lo calculado sobre el estado vivo. Si algo falla a mitad, ni el conocimiento, ni la
// bolsa, ni la repisa, ni los motes, ni el diario, ni los rumores han cambiado: nada de lo
// que se tocó era el estado de la partida.
//
// El orden de escritura es el de SPEC-016 —**registro, estado, marca de aplicación**— y no
// al revés: con el orden invertido, un apagón entre las dos escrituras perdería hechos sin
// que nada se pusiera rojo.
//
// Dos fronteras que conviene decir en voz alta. **Esta fila no decide cuándo se cierra la
// salida**: eso es de SPEC-030, y aquí se decide qué pasa cuando se cierra. Y **nada
// degrada por falta de cableado** (`pipeline/decisiones-orquestador.md` §6h): las seis
// piezas se exigen y su ausencia falla nombrándolas, en vez de cerrar una salida sin que
// salga nada, entregar un desenlace sin oro o echar un telón sin entrada de diario.

import { congelaHondo } from '../core/congelar.js';
import { COMO_ACABO, aventuraEnCurso, cierra as cierraLaAventura } from './aventura-en-curso.js';
import { diaDe } from './calendario.js';
import {
  aplicaElEntintado,
  entintadoDelMundo,
  libroDePendientes,
} from './conocimiento.js';
import { apunta as apuntaEnElDiario, proyeccion } from './diario.js';
import { cierraSalida as cierraLaColaDeEntregas } from './entregas.js';
import { areaDe } from './estado.js';
import { anexa, registroInicial } from './hechos.js';
import { VIAS_DE_CIERRE, cierraLaSalida, salidaAbierta } from './salida-abierta.js';
import { llegaANucleo } from './arranque.js';
import { creaCapaDeNpcs } from './npcs.js';
import { cierraSalidaDeProgresion } from './oro.js';
import { exigeMapaId } from './pasos.js';
import { ESCALON_DE_PARTIDA, rangoEn } from './rango.js';
import { arbolDeCalzadas, naceRumor } from './rumores.js';
import { componeElTelon, hechoDeHoja, hojaDelDia } from './telon.js';

/**
 * Las áreas del estado que el cierre puede tocar. Se copian **todas** antes de empezar,
 * incluso las que esta salida no vaya a mover: el conjunto tiene que ser el mismo pase lo
 * que pase, porque si no «no se ha aplicado ninguno» dependería de por dónde falló.
 */
export const AREAS_QUE_TOCA_EL_CIERRE = congelaHondo([
  'arranque', 'aventuras', 'conocimiento', 'diario', 'entregas', 'memorias', 'motes',
  'npcs', 'nucleos', 'objetos', 'oro', 'relaciones', 'rumores',
]);

/**
 * Las piezas que el cierre necesita cableadas, con el nombre por el que se reclaman.
 *
 * Van inyectadas y no importadas dentro de cada rama para que «sin el nacimiento de rumor
 * cableado, el cierre falla nombrando la pieza» se pueda poner rojo: con la importación
 * directa no habría manera de quitarle una pieza y ver qué pasa.
 */
export const PIEZAS_DEL_CIERRE = congelaHondo({
  conocimiento: 'el entintado del conocimiento',
  rumor: 'el nacimiento de rumor',
  progresion: 'la progresión de la salida',
  npcs: 'la capa de NPCs',
  entregas: 'la cola de entregas',
  diario: 'el apunte del diario',
});

/** Los identificadores de pieza, en orden estable. */
export const IDS_DE_PIEZA = congelaHondo(Object.keys(PIEZAS_DEL_CIERRE).slice().sort());

/**
 * El cableado de serie: las cinco implementaciones que ya existen, más el entintado.
 *
 * Existe para que la app no tenga que reconstruir la tubería a mano —el mismo criterio con
 * el que SPEC-007 exporta `viasDelGrafo`— sin que eso convierta las piezas en opcionales:
 * quien quiera comprobar qué pasa sin una, la quita de aquí.
 */
export function piezasDeSerie() {
  return congelaHondo({
    conocimiento: aplicaElEntintado,
    rumor: naceRumor,
    progresion: cierraSalidaDeProgresion,
    npcs: creaCapaDeNpcs,
    entregas: cierraLaColaDeEntregas,
    diario: apuntaEnElDiario,
  });
}

function exigePieza(piezas, id) {
  const pieza = piezas?.[id];
  if (typeof pieza !== 'function') {
    throw new Error(
      `el cierre de la salida no tiene cableado ${PIEZAS_DEL_CIERRE[id]}: llegó ${JSON.stringify(pieza) ?? String(pieza)}. ` +
      'Las seis piezas se exigen porque cerrar sin una de ellas no falla, solo entrega un telón al que le falta algo, ' +
      `y las que hay son ${IDS_DE_PIEZA.join(', ')}`,
    );
  }
  return pieza;
}

function exigeEntero(valor, quien) {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)}: es un entero no negativo`);
  }
  return valor;
}

/** Una copia de trabajo de un área, por su propio esquema: la ida y la vuelta ya validan. */
function copiaDeArea(estado, id) {
  const area = areaDe(id);
  return area.levanta(area.congela(estado[id]));
}

/**
 * Vuelca una copia de trabajo sobre el área viva **sin cambiar el objeto**: quien tuviera
 * una referencia al área —una capa de NPCs montada fuera, por ejemplo— la sigue teniendo
 * apuntando a lo mismo. Sustituir la referencia dejaría dos verdades a la vez.
 */
function vuelca(destino, origen) {
  for (const clave of Object.keys(destino)) delete destino[clave];
  Object.assign(destino, origen);
}

/** El rango de cada núcleo del mapa, para poder decir después cuáles se movieron. */
function rangosDe(nucleos, { mapaId, arbol }) {
  const salida = {};
  for (const nucleo of arbol.nucleos) salida[nucleo] = rangoEn(nucleos, { mapaId, nucleo, mapa: arbol }).escalon;
  return salida;
}

/**
 * Echa el telón sobre una salida: aplica el conocimiento pendiente, resuelve cómo acabó la
 * aventura, hace nacer el rumor si procede, ingresa la progresión, cierra la capa de NPCs y
 * la cola de entregas, apunta la hoja del diario y cierra el arranque si toca.
 *
 * Una nota de orden, porque se aparta de cómo lo cuenta la spec en prosa: **el rumor nace
 * antes que la progresión**. No es una preferencia: `cierraSalidaDeProgresion` recibe la
 * identidad del rumor para colgar de ella el mote candidato (`personaje.md` §2), así que
 * ingresar primero obligaría a escribir el mote en un segundo paso, que es justo lo que el
 * cierre a todo o nada no admite.
 *
 * @param {object} opciones
 *   `estado` el estado vivo de la partida; `registro` su registro de hechos; `calendario`
 *   el de la partida, inyectado; `mundo` el congelado del mapa activo; `mapaId`; `salida`
 *   la identidad de la salida que se cierra; `paso` el paso del mundo en el que se cierra;
 *   `via` por dónde se cerró —volver o dejarlo aquí—; `pendientes` el libro de pendientes
 *   de conocimiento de la salida; `lugar` el sitio del mundo donde se cierra el día, que es
 *   dónde se apunta la hoja; `aventura` la casteada, con su título, o `null`; `desenlace`
 *   lo que la plantilla declara al terminarla, o `null`; `repuesto` sus dos textos de
 *   repuesto; `nucleo` el núcleo al que se llegó, para la condición del hito; `idioma` el
 *   paquete de idioma del mapa; `piezas` el cableado.
 */
export function echaElTelon({
  estado,
  registro,
  calendario,
  mundo,
  mapaId,
  salida,
  paso,
  via = VIAS_DE_CIERRE.VOLVER,
  pendientes = libroDePendientes(),
  lugar,
  aventura = null,
  desenlace = null,
  repuesto = null,
  nucleo = null,
  idioma,
  porDondeSePaso = [],
  piezas,
}) {
  if (!estado || typeof estado !== 'object' || typeof estado.semilla !== 'string') {
    throw new Error('el cierre de la salida necesita el estado vivo de la partida (estadoInicial({ semilla })) y llegó otra cosa');
  }
  if (!registro || !Array.isArray(registro.hechos)) {
    throw new Error('el cierre de la salida necesita el registro de hechos de la partida: el registro se anexa antes que el estado, y sin él el telón no se podría reconstruir');
  }
  if (typeof aventura === 'boolean') {
    throw new Error(
      'el cierre de la salida recibe la aventura en curso con su declaración de cómo acabó, y no un booleano de «terminada»: ' +
      'terminada y a medias es lo que declara el motor de SPEC-034 al cerrarla, no algo que se le diga desde fuera',
    );
  }
  const id = exigeMapaId(mapaId, 'el cierre de la salida');
  exigeEntero(paso, 'el paso en el que se cierra la salida');
  if (typeof salida !== 'string' || !salida) {
    throw new Error(`el cierre de la salida se hace sobre su identidad y llegó ${JSON.stringify(salida) ?? String(salida)}`);
  }
  for (const pieza of IDS_DE_PIEZA) exigePieza(piezas, pieza);

  // El calendario, lo primero que se pide: sin él se supondría el día uno y «nadie lo
  // cableó» y «es el primer día» serían la misma cosa.
  const dia = diaDe(calendario, 'el cierre de la salida');

  // Cerrar dos veces la misma salida **falla nombrando la salida y su estado**, y no
  // entinta otra vez ni ingresa el oro dos veces.
  const abierta = salidaAbierta(estado.aventuras);
  if (!abierta) {
    throw new Error(
      `la salida "${salida}" no está abierta, así que su telón ya se echó: el telón se echa una sola vez, ` +
      'y echarlo dos veces entintaría dos veces e ingresaría el oro dos veces',
    );
  }
  if (abierta.salida !== salida) {
    throw new Error(`se pide echar el telón de la salida "${salida}" y la que está abierta es "${abierta.salida}": hay una salida y una aventura`);
  }

  const arbol = arbolDeCalzadas(mundo);

  // --- Todo lo que sigue ocurre sobre copias, y nada de esto es la partida -------

  const trabajo = {};
  for (const area of AREAS_QUE_TOCA_EL_CIERRE) trabajo[area] = copiaDeArea(estado, area);
  const loApuntado = registroInicial();

  // 1 · El conocimiento pendiente, **de una vez**. Es lo primero porque el mapa se entinta
  // se haya vuelto entera o a mitad: volverse a mitad no anula lo andado.
  const ascensos = piezas.conocimiento(trabajo.conocimiento, { mapaId: id, libro: pendientes });
  for (const a of ascensos) {
    loApuntado.hechos.push({
      tipo: 'conocimiento-subido', mapa: id, dia, paso,
      carga: { elemento: a.clave, via: a.via, escalon: a.escalon },
    });
  }

  // 2 · Cómo acabó la aventura. Lo declara el motor y no quien llama: con el último beat
  // resuelto queda terminada y con beats sin resolver, a medias, aunque sean cero.
  const enCurso = aventuraEnCurso(trabajo.aventuras);
  let cerrada = null;
  if (enCurso) {
    cerrada = cierraLaAventura(trabajo.aventuras, {
      registro: loApuntado,
      dia,
      paso,
      desenlace: desenlace?.id ?? null,
      motivo: via,
    });
  }
  const aMedias = cerrada?.comoAcabo === COMO_ACABO.A_MEDIAS;
  const terminada = cerrada?.comoAcabo === COMO_ACABO.TERMINADA;

  // El desenlace solo existe si la aventura se terminó. Si se cerró en corto, en su sitio
  // va el texto de repuesto: el de cómo acabó sin ti cuando no se consiguió nada, y el que
  // cierra con lo conseguido cuando sí. **Se elige por si se consiguió algo y no por
  // cuántos beats se resolvieron**: un umbral inventaría una cifra que la plantilla no
  // declara (`bucle-jugable.md` §4).
  const elDesenlace = terminada && desenlace ? desenlace : null;
  const conseguido = cerrada?.conseguido ?? [];
  const elCierreEnCorto = aMedias
    ? { texto: conseguido.length ? repuesto?.conLoConseguido ?? null : repuesto?.sinTi ?? null, conseguido: conseguido.slice() }
    : null;
  if (aMedias && !elCierreEnCorto.texto) {
    throw new Error(
      `la aventura "${cerrada.aventura}" se cierra en corto y no ha llegado su desenlace de repuesto ` +
      `(${conseguido.length ? 'conLoConseguido' : 'sinTi'}): las treinta plantillas del catálogo traen los dos, ` +
      'y echar el telón sin él dejaría el hilo colgando que el cierre en corto existe para evitar',
    );
  }

  // 3 · El rumor, si procede. Se le entrega la marca del cierre en corto **dentro del
  // desenlace**, y no una rama de aquí: así manda la regla de SPEC-012 —que ya mira el
  // cierre en corto antes que la declaración de la plantilla— y no se puede romper por
  // este lado.
  const rangosAntes = rangosDe(trabajo.nucleos, { mapaId: id, arbol });
  const rumor = elDesenlace || aMedias
    ? piezas.rumor({
      estado: trabajo.rumores,
      nucleos: trabajo.nucleos,
      mapaId: id,
      arbol,
      desenlace: elDesenlace ? { ...elDesenlace, cierreEnCorto: false } : { ...(desenlace ?? {}), cierreEnCorto: true },
      n: paso,
    })
    : null;
  const rangosDespues = rangosDe(trabajo.nucleos, { mapaId: id, arbol });
  const subidasDeRango = arbol.nucleos
    .filter((n) => rangosAntes[n] !== rangosDespues[n] && rangosDespues[n] !== ESCALON_DE_PARTIDA)
    .map((n) => ({ nucleo: n, escalon: rangosDespues[n] }));

  // 4 · La progresión: el oro, los objetos que quedan y el mote, los tres declarados.
  const progresion = elDesenlace
    ? piezas.progresion({
      oro: trabajo.oro,
      objetos: trabajo.objetos,
      motes: trabajo.motes,
      mapaId: id,
      desenlace: elDesenlace,
      rumor: rumor?.id ?? null,
      dia,
    })
    : null;
  for (const objeto of progresion?.objetos ?? []) {
    loApuntado.hechos.push({
      tipo: 'objeto-obtenido', mapa: id, dia, paso,
      carga: {
        id: objeto.id,
        clase: objeto.clase,
        procedencia: { desenlace: elDesenlace.id ?? null, plantilla: elDesenlace.plantilla?.id ?? elDesenlace.plantilla ?? null, lugar: elDesenlace.lugar?.id ?? null },
        diaDeRepisa: objeto.dia,
      },
    });
  }

  // 5 · La capa de NPCs: las memorias de quienes fueron rol y las relaciones que los actos
  // declarados mueven. Se monta sobre las copias de trabajo, que es lo que la deja dentro
  // del todo o nada.
  if (elDesenlace) {
    const capa = piezas.npcs({
      semilla: estado.semilla,
      mapaId: id,
      mundo,
      idioma,
      estado: trabajo.npcs,
      memorias: trabajo.memorias,
      relaciones: trabajo.relaciones,
    });
    capa.cierraSalida({ desenlace: elDesenlace, n: paso });
  }

  // 6 · La cola de entregas: lo aceptado y no atendido consume su oferta, y lo que llega
  // al tope sedimenta. Sin efecto de paso y sin reproche.
  piezas.entregas(trabajo.entregas, { mapaId: id, salida, paso });

  // 7 · La hoja de hoy, que **es la clase «lo propio» y la escribe esta capa y solo esta**.
  // Existe también en un paseo sin nada oído ni hecho: el diario es la otra cara del mapa,
  // así que un día sin hoja sería un día que no pasó.
  const hoja = hojaDelDia({
    mapaId: id,
    hoja: `salida:${salida}`,
    asunto: aventura?.id ?? cerrada?.aventura ?? `salida:${salida}`,
    lugar: lugar ?? abierta.sitio ?? nucleo,
    dia,
    paso,
    signo: elDesenlace?.signo ?? desenlace?.signo ?? undefined,
  });
  const entradaDelDiario = piezas.diario(trabajo.diario, hoja);
  loApuntado.hechos.push(hechoDeHoja(entradaDelDiario));

  // 8 · El hito de fin de arranque, **una sola vez**, cuando se llega a un núcleo donde lo
  // que se cuenta eres tú. Es del mundo y no del desempeño: coincide igual con un cierre en
  // corto, porque dice que el mundo cambió y no que quien juega aprobó.
  let hito = false;
  if (nucleo != null && trabajo.arranque.abierto) {
    const veredicto = llegaANucleo({ arranque: trabajo.arranque, rumores: trabajo.rumores, nucleos: trabajo.nucleos, mapaId: id, nucleo, n: paso });
    hito = veredicto.marca === true;
    if (hito) {
      loApuntado.hechos.push({
        tipo: 'arranque-cerrado', mapa: id, dia, paso,
        carga: { via: veredicto.cerradoPor, marcado: true },
      });
    }
  }

  // 9 · Y la salida abierta se cierra. Va la última porque es lo único cuya ausencia deja
  // el resto sin sentido: hasta aquí, cualquier fallo ha dejado la salida abierta y el
  // telón se puede volver a echar.
  cierraLaSalida(trabajo.aventuras, { via });

  // --- Y solo entonces la escritura, que ya no puede fallar ----------------------
  //
  // Primero el registro, entero o nada; después el estado; y la marca de aplicación al
  // final, apuntando al último hecho anexado.
  anexa(registro, loApuntado.hechos);
  for (const area of AREAS_QUE_TOCA_EL_CIERRE) vuelca(estado[area], trabajo[area]);
  estado.aplicadoHasta = registro.hechos.length - 1;

  const entintado = entintadoDelMundo(estado.conocimiento, { mapaId: id, mundo, ascensos });
  const telon = componeElTelon({
    mapaId: id,
    dia,
    ascensos,
    entintado,
    porDondeSePaso,
    aventura: aventura ? { id: aventura.id, titulo: aventura.titulo ?? aventura.id } : null,
    desenlace: elDesenlace,
    cierreEnCorto: elCierreEnCorto,
    progresion,
    rango: subidasDeRango,
    rumor: rumor ? { id: rumor.id, origen: rumor.origen } : null,
    entradaDelDiario,
    oido: proyeccion(estado.diario.entradas.filter((e) => e.dia === dia && e.clase === 'lo-oido')),
    hito,
    nucleos: arbol.nucleos,
  });

  return congelaHondo({
    salida,
    mapa: id,
    dia,
    paso,
    via,
    // Cómo acabó, tal como lo declaró el motor. Nunca un booleano.
    aventura: cerrada,
    ascensos,
    entintado,
    rumor: rumor ? { id: rumor.id, origen: rumor.origen } : null,
    progresion,
    rango: subidasDeRango,
    entrada: entradaDelDiario.id,
    hito,
    hechos: loApuntado.hechos.length,
    telon,
  });
}

// Y lo que este módulo **no** hace, dicho en voz alta porque es la frontera:
//
//   · No decide **cuándo** se cierra la salida. Volver al punto de partida, el rótulo del
//     sistema y «dejarlo aquí» son de SPEC-030; aquí llega el momento ya decidido.
//   · No lanza ninguna notificación ni pone la app delante. El telón ocurre; lo que espera
//     es que lo leas, y al abrir la app es lo primero que hay (`salidas.js`).
//   · No marca el telón como leído: eso es una acción explícita de quien lo lee.
