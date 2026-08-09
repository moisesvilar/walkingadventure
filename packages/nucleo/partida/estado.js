// El sobre del estado de la partida: la cabecera, la composición por áreas y su
// validación contra el esquema cerrado.
//
// El estado es **la verdad de la partida** (`partida-guardada.md` §2) y es un
// documento más de la familia de SPEC-009: su versión de formato sale de la
// constante única, su esquema se escribe con el mismo lenguaje y su texto es
// canónico por el mismo mecanismo. Un segundo versionado en paralelo sobre ficheros
// que se guardan y se exportan juntos es exactamente el bug que esta capa existe
// para no cometer.
//
// Y las áreas **se registran en lugar de listarse**: cada una es de la spec que la
// posee —el contador de pasos es de SPEC-011, lo que se cuenta en cada núcleo de
// SPEC-012, las caras con su memoria y su relación de SPEC-014, el rango, el oro y
// los objetos de la fila 15, y el diario de aquí— y ninguna se declara aquí por
// segunda vez. Con un esquema plano, cada fila posterior tendría que iterar esta
// spec y subir el número de formato por algo que no es un cambio de formato.

import { congelaHondo } from '../core/congelar.js';
import { exigeSemilla } from '../core/semilla.js';
import { IDS_DE_AJUSTE, congelaAjustes, estadoDeAjustes, levantaAjustes } from './ajustes.js';
import { congelaArranque, estadoDeArranque, levantaArranque } from './arranque.js';
import { congelaPersonaje, estadoDePersonaje, levantaPersonaje } from './personaje.js';
import {
  ESQUEMA_DIARIO,
  ESQUEMA_TEXTOS,
  congelaDiario,
  congelaTextos,
  estadoDeDiario,
  estadoDeTextos,
  levantaDiario,
  levantaTextos,
} from './diario.js';
import { congelaEntregas, estadoDeEntregas, levantaEntregas } from './entregas.js';
import {
  CLASES,
  VALOR_INERTE,
  VERSION_FORMATO,
  VERSION_GENERADOR,
  campos,
  compruebaVersion,
  declaraEsquema,
  dic,
  escribe,
  lista,
  sinRastroDeUbicacion,
  texto as textoCanonico,
  uno,
} from './formato.js';
import { ESQUEMA_HECHOS_DE_RUMOR, ESQUEMA_PROCEDENCIA_DE_OBJETO, tiposDelArea } from './hechos.js';
import { congelaLlegadas, estadoDeLlegadas, levantaLlegadas } from './llegadas.js';
import { congelaMemorias, estadoDeMemorias, levantaMemorias } from './memoria.js';
import { congelaMotes, estadoDeMotes, levantaMotes } from './motes.js';
import { congelaNpcs, estadoDeNpcs, levantaNpcs } from './npcs.js';
import { congelaNucleos, estadoDeNucleos, levantaNucleos } from './nucleos.js';
import { congelaObjetos, estadoDeObjetos, levantaObjetos } from './objetos.js';
import { congelaOro, estadoDeOro, levantaOro } from './oro.js';
import { congelaPasos, estadoDePasos, levantaPasos } from './pasos.js';
import { congelaRelaciones, estadoDeRelaciones, levantaRelaciones } from './relacion.js';
import { congelaRumores, estadoDeRumores, levantaRumores } from './rumores.js';
import { congelaSalidaAbierta, estadoDeSalidaAbierta, levantaSalidaAbierta } from './salida-abierta.js';
import { congelaSalidas, estadoDeSalidas, levantaSalidas } from './salidas.js';
import { CATEGORIAS_DE_TOPICO, congelaTopicos, estadoDeTopicos, levantaTopicos } from './topicos.js';

// --- Los esquemas de las áreas que ya existen --------------------------------
//
// Los escribe esta capa porque el esquema es del **documento** y los módulos que
// poseen cada área no conocen el formato; lo que no hace es redefinir su contenido:
// cada uno sale campo a campo de la `congela*` de su módulo, y si esa cambia, el
// esquema falla al escribir nombrando el campo en vez de perderlo en silencio.

/** Un efecto de paso. El catálogo cerrado es de `efectos.js` y ya se aplicó al producirlo. */
const EFECTO = dic(VALOR_INERTE);

const AREA_PASOS = campos({
  mapas: dic(campos({
    n: 'entero',
    restoM: 'numero',
    restoFondoM: 'numero',
    reserva: lista(campos({ n: 'entero', efectos: lista(EFECTO) })),
  })),
});

const VERSION_SEDIMENTADA = campos({
  rumor: 'texto',
  plantilla: 'texto?',
  origen: 'texto?',
  nivel: 'entero',
  signo: 'texto',
  hechos: ESQUEMA_HECHOS_DE_RUMOR,
  ejes: lista('texto'),
  texto: 'texto?',
  oidoEn: 'entero?',
});

const AREA_NUCLEOS = campos({ mapas: dic(dic(lista(VERSION_SEDIMENTADA))) });

const AREA_RUMORES = campos({
  mapas: dic(campos({
    rumores: lista(campos({
      id: 'texto',
      plantilla: 'texto?',
      origen: 'texto',
      signo: 'texto',
      // La semilla estructurada la declara la plantilla y esta capa no la
      // interpreta: se exige que sea inerte, no que tenga una forma.
      semilla: VALOR_INERTE,
      hechos: ESQUEMA_HECHOS_DE_RUMOR,
      nacidoEn: 'entero',
      frentes: lista(campos({ desde: 'texto', hacia: 'texto', avanzadoM: 'numero', saltos: 'entero', monte: 'entero' })),
      alcanzados: dic('entero'),
      agotado: 'booleano',
    })),
  })),
});

const CARA = campos({ sitio: 'texto', puesto: 'texto' });

const AREA_NPCS = campos({ mapas: dic(campos({ despiertas: lista(CARA), conocidas: lista(CARA) })) });

const AREA_MEMORIAS = campos({
  mapas: dic(campos({
    caras: lista(campos({
      sitio: 'texto',
      puesto: 'texto',
      memoria: lista(campos({
        n: 'entero',
        hecho: campos({
          id: 'texto',
          plantilla: 'texto?',
          origen: 'texto?',
          nivel: 'entero',
          signo: 'texto',
          hechos: ESQUEMA_HECHOS_DE_RUMOR,
          caras: lista(CARA),
        }),
      })),
    })),
  })),
});

const AREA_RELACIONES = campos({
  mapas: dic(campos({ caras: lista(campos({ sitio: 'texto', puesto: 'texto', escalon: 'texto', cicatriz: 'booleano' })) })),
});

const AREA_MOTES = campos({
  mapas: dic(campos({ candidatos: lista(campos({ rumor: 'texto', candidato: 'texto' })) })),
});

const AREA_ARRANQUE = campos({
  abierto: 'booleano',
  cerradoPor: 'texto?',
  cerradoEn: 'entero?',
  marcado: 'booleano',
  reglaDePaso: 'booleano',
  par: uno(['nulo', campos({ suceso: 'texto', nucleos: lista('texto'), niveles: dic('entero') })]),
});

/**
 * Quién juega. El esquema es **cerrado y corto**, y esa es media garantía de «nada del
 * personaje afecta al cuerpo»: no hay dónde poner una velocidad ni una resistencia sin
 * declararla aquí, y declararla se ve en el diff.
 *
 * Los cuatro campos llegan nulos en una partida recién creada porque el personaje se
 * rellena en el arranque, que ocurre antes de que la partida exista.
 */
const AREA_PERSONAJE = campos({
  nombre: 'texto?',
  genero: 'texto',
  oficio: 'texto?',
  oficioPermanente: 'booleano',
  tramo: uno(['nulo', campos({ respuesta: 'texto?', declaradoM: 'numero', estimadoM: 'numero', salidasMedidas: 'entero' })]),
});

/**
 * Los ajustes, con su valor de origen puesto por el arranque sin preguntar nada.
 *
 * El esquema se deriva del catálogo cerrado de `ajustes.js` en lugar de repetir los
 * nombres: un ajuste nuevo entra por su módulo y no por dos sitios.
 */
const AREA_AJUSTES = campos(Object.fromEntries(IDS_DE_AJUSTE.map((id) => [id, 'booleano'])));

const AREA_ORO = campos({ saldo: 'entero' });

// La procedencia sale estructurada de `objetos.js` y el día es el del calendario de
// la partida, entero: el esquema lo dice igual que la carga del hecho equivalente,
// desde la misma declaración. Que aquí pusiera `texto?` y allí un objeto es lo que
// impedía congelar una partida en la que un desenlace había entregado algo.
const AREA_OBJETOS = campos({
  objetos: lista(campos({ id: 'texto', clase: 'texto', procedencia: ESQUEMA_PROCEDENCIA_DE_OBJETO, dia: 'entero' })),
});

/**
 * Los sitios pisados, por mapa: **el identificador del sitio y nada más**.
 *
 * `partida-guardada.md` §2 los incluye por escrito en su lista cerrada de hechos, y
 * eso no contradice RF-PRIV-002: lo que aquella prohíbe es el histórico de
 * **posiciones**, y aquí se guarda el nombre de un sitio del mundo congelado, nunca
 * una coordenada, nunca el camino entre dos sitios y nunca una lectura de sensor.
 * Vive en esta capa porque ninguna fila anterior lo posee todavía; el día que una lo
 * haga, se muda con su esquema y esta declaración desaparece.
 */
const AREA_SITIOS = campos({ mapas: dic(lista('texto')) });

/**
 * El registro de tópicos, **por semilla de mundo** y con sus cinco categorías cerradas.
 *
 * Su contenido depende de lo que devolviera el modelo, así que no es reproducible, y eso
 * no rompe RNF-DET-002: es **estado inerte**, ninguna regla bifurca por él fuera de la
 * construcción del prompt, y la estructura de una aventura no cambia con lo que
 * contenga. Se guarda con la partida porque sin guardarlo no cumpliría su función entre
 * salidas, que es no repetirse.
 */
const AREA_TOPICOS = campos({ mundos: dic(campos(Object.fromEntries(CATEGORIAS_DE_TOPICO.map((c) => [c, lista('texto')])))) });

/**
 * La cola de entregas, por mapa: lo que el mundo debe y todavía no ha entregado.
 *
 * Va por mapa como el contador de pasos, y **nunca dentro del documento congelado de
 * una celda**: el mundo no cambia porque a alguien le deban un recado. Cada entrada
 * lleva su ciclo entero —estado, ofertas con su salida, su sitio y su paso— porque
 * es exactamente lo que tiene que sobrevivir a guardar y volver a abrir para que la
 * segunda oferta siga exigiendo otra salida y otro sitio.
 */
const AREA_ENTREGAS = campos({
  mapas: dic(campos({
    entradas: lista(campos({
      id: 'texto',
      tipo: 'texto',
      asunto: 'texto',
      clase: 'texto?',
      escena: 'texto?',
      origen: 'texto?',
      procedencia: campos({ mapa: 'texto', paso: 'entero' }),
      estado: 'texto',
      sitio: 'texto?',
      aceptadaEn: 'texto?',
      apariciones: 'entero',
      ultimaLista: 'entero?',
      ofertas: lista(campos({ salida: 'texto', sitio: 'texto?', paso: 'entero', via: 'texto' })),
    })),
  })),
});

/**
 * La salida abierta, si la hay: identidad, mapa, aventura aceptada y dónde se quedó.
 *
 * **Ninguna coordenada y ninguna marca de tiempo** (RF-PRIV-002): el sitio va con el
 * nombre del mundo, y sin marca de tiempo una salida abierta desde hace días se lee
 * exactamente igual que la de hace un rato, que es lo que pide `bucle-jugable.md` §4.
 */
const AREA_AVENTURAS = campos({
  abierta: uno(['nulo', campos({ salida: 'texto', mapa: 'texto', aventura: 'texto?', sitio: 'texto?' })]),
});

/**
 * La vida de una salida, de SPEC-030: en cuál de sus cuatro situaciones está, dónde
 * está su rótulo, por qué se cerró y si se cerró en corto.
 *
 * Guarda **también las cerradas sin leer**, y va en la misma área a propósito: «el
 * telón espera a que lo leas» exige que un cierre sobreviva a días con la app cerrada,
 * y partir la salida en curso y el telón pendiente en dos áreas es cómo se
 * desincronizan.
 *
 * Lleva la única posición de quien juega que la partida guarda —el punto de partida,
 * uno y no un histórico— y las marcas del sensor con las que se miden el plazo y el
 * regreso. Las dos cosas están declaradas en `formato.js`: sin el punto, volver a casa
 * andando no cerraría la salida después de que el sistema haya matado el proceso.
 */
const AREA_SALIDAS = campos({
  salida: uno(['nulo', campos({
    salida: 'texto',
    mapa: 'texto',
    aventura: 'texto?',
    aventuraTerminada: 'booleano',
    destino: 'texto?',
    mundo: 'texto?',
    situacion: 'texto',
    rotulo: 'texto',
    partida: campos({ lat: 'numero', lon: 'numero' }),
    regreso: campos({ seAlejo: 'booleano', dentroDesdeMs: 'entero?' }),
    ultimoPropioMs: 'entero',
    ultimaMarcaMs: 'entero',
    motivo: 'texto?',
    cierreEnCorto: 'booleano',
  })]),
});

/**
 * Las llegadas validadas de la salida en curso, de SPEC-032: por cuál va su secuencia y
 * cuáles siguen esperando.
 *
 * Va al estado guardado y no a la memoria de la salida porque la escena **espera**: una
 * escena que se pierde al cerrar la app rompe a la vez «pararse en un semáforo… sigue
 * disponible para cuando vuelva» y «la aventura sigue abierta hasta volver o cerrar a
 * mano». Guarda la secuencia entera —que es lo único que no se puede recalcular sin
 * volver a preguntar si era la primera visita— y **ni una coordenada ni una marca de
 * tiempo**: el sitio va con su nombre del mundo, y el reloj de permanencia es una medida
 * de sensor de veinte segundos, no un hecho de la partida.
 */
const AREA_LLEGADAS = campos({
  salida: 'texto?',
  llegadas: lista(campos({
    mapa: 'texto',
    sitio: 'texto',
    secuencia: lista(campos({ tipo: 'texto', modo: 'texto' })),
    paso: 'entero',
    cerrada: 'booleano',
  })),
});

// --- El registro de áreas -----------------------------------------------------

const AREAS = [];
const POR_ID = {};

/**
 * Declara un área del estado: su esquema cerrado, su estado inicial y su ida y
 * vuelta. Un área **sin esquema** solo aporta tipos de hecho al registro y no ocupa
 * ningún campo del estado, que es el sitio de las filas que todavía no han entregado
 * el suyo.
 *
 * `reproduce` dice si sus hechos se pueden reproducir sobre el estado. Por defecto
 * es «sí cuando tiene estado», que es lo que era antes de existir el campo; se pone
 * a `false` cuando el hecho **no lleva dentro lo que haría falta** para reconstruir
 * el área, porque entonces reproducirlo sería inventárselo y saltárselo en silencio
 * sería peor. Declararlo es lo que permite reconocerlo sin perderlo.
 */
export function declaraArea({ id, esquema = null, inicial = null, congela = null, levanta = null, reproduce = null }) {
  if (typeof id !== 'string' || !id) {
    throw new Error(`un área del estado se declara con su identificador y llegó ${JSON.stringify(id) ?? String(id)}`);
  }
  if (POR_ID[id]) throw new Error(`el área "${id}" ya está declarada: dos declaraciones de la misma área escribirían el campo dos veces`);
  const area = congelaHondo({ id, esquema, inicial, congela, levanta, reproduce: reproduce ?? !!esquema, tipos: tiposDelArea(id) });
  POR_ID[id] = area;
  AREAS.push(area);
  return area;
}

declaraArea({ id: 'pasos', esquema: AREA_PASOS, inicial: estadoDePasos, congela: congelaPasos, levanta: levantaPasos });
declaraArea({ id: 'sitios', esquema: AREA_SITIOS, inicial: () => ({ mapas: {} }), congela: congelaSitios, levanta: levantaSitios });
declaraArea({ id: 'nucleos', esquema: AREA_NUCLEOS, inicial: estadoDeNucleos, congela: congelaNucleos, levanta: levantaNucleos });
declaraArea({ id: 'rumores', esquema: AREA_RUMORES, inicial: estadoDeRumores, congela: congelaRumores, levanta: levantaRumores });
declaraArea({ id: 'npcs', esquema: AREA_NPCS, inicial: estadoDeNpcs, congela: congelaNpcs, levanta: levantaNpcs });
declaraArea({ id: 'memorias', esquema: AREA_MEMORIAS, inicial: estadoDeMemorias, congela: congelaMemorias, levanta: levantaMemorias });
declaraArea({ id: 'relaciones', esquema: AREA_RELACIONES, inicial: estadoDeRelaciones, congela: congelaRelaciones, levanta: levantaRelaciones });
declaraArea({ id: 'motes', esquema: AREA_MOTES, inicial: estadoDeMotes, congela: congelaMotes, levanta: levantaMotes });
declaraArea({ id: 'arranque', esquema: AREA_ARRANQUE, inicial: estadoDeArranque, congela: congelaArranque, levanta: levantaArranque });
// El personaje y los ajustes son de SPEC-027. No reproducen desde el registro y se
// declara: sus hechos —si algún día los hay— dirían que alguien cambió su nombre, no
// cuál era el anterior, y reproducirlos sería inventárselo.
declaraArea({ id: 'personaje', esquema: AREA_PERSONAJE, inicial: estadoDePersonaje, congela: congelaPersonaje, levanta: levantaPersonaje, reproduce: false });
declaraArea({ id: 'ajustes', esquema: AREA_AJUSTES, inicial: estadoDeAjustes, congela: congelaAjustes, levanta: levantaAjustes, reproduce: false });
declaraArea({ id: 'oro', esquema: AREA_ORO, inicial: estadoDeOro, congela: congelaOro, levanta: levantaOro });
declaraArea({ id: 'objetos', esquema: AREA_OBJETOS, inicial: estadoDeObjetos, congela: congelaObjetos, levanta: levantaObjetos });
declaraArea({ id: 'diario', esquema: ESQUEMA_DIARIO, inicial: estadoDeDiario, congela: congelaDiario, levanta: levantaDiario });
declaraArea({ id: 'textos', esquema: ESQUEMA_TEXTOS, inicial: estadoDeTextos, congela: congelaTextos, levanta: levantaTextos });
declaraArea({ id: 'topicos', esquema: AREA_TOPICOS, inicial: estadoDeTopicos, congela: congelaTopicos, levanta: levantaTopicos });

// La cola de entregas de SPEC-019: tiene estado y **no se reproduce desde el
// registro**, que son dos cosas distintas. Sus hechos dicen qué entrada se atendió,
// no qué contenía; reproducir la cola a partir de ellos sería inventarse las
// entradas, así que se reconocen y se declaran en lugar de aplicarse.
declaraArea({ id: 'entregas', esquema: AREA_ENTREGAS, inicial: estadoDeEntregas, congela: congelaEntregas, levanta: levantaEntregas, reproduce: false });

// El registro de la salida abierta, de SPEC-028. Es el estado del área de aventuras, que
// hasta esta fila solo aportaba tipos de hecho. **No se reproduce desde el registro**: sus
// hechos dicen qué aventura se aceptó y cuál se cerró, no dónde se quedó quien la llevaba, y
// reconstruir la tarjeta de a medias a partir de ellos sería inventarse el sitio.
declaraArea({
  id: 'aventuras',
  esquema: AREA_AVENTURAS,
  inicial: estadoDeSalidaAbierta,
  congela: congelaSalidaAbierta,
  levanta: levantaSalidaAbierta,
  reproduce: false,
});

// La vida de una salida, de SPEC-030. **No se reproduce desde el registro**: sus hechos
// dicen que una salida se abrió y que otra se cerró, no dónde empezó ni cuándo fue el
// último metro propio, y reconstruir el punto de partida a partir de ellos sería
// inventárselo — que es peor que declararlo irreproducible.
declaraArea({
  id: 'salidas',
  esquema: AREA_SALIDAS,
  inicial: estadoDeSalidas,
  congela: congelaSalidas,
  levanta: levantaSalidas,
  reproduce: false,
});

// Las llegadas validadas, de SPEC-032. **No se reproducen desde el registro**: sus hechos
// dirían que se llegó a un sitio, no por qué paso de la secuencia iba quien llegó, y
// reconstruir la escena que espera a partir de ellos sería inventársela.
declaraArea({
  id: 'llegadas',
  esquema: AREA_LLEGADAS,
  inicial: estadoDeLlegadas,
  congela: congelaLlegadas,
  levanta: levantaLlegadas,
  reproduce: false,
});

// La que todavía solo aporta tipos de hecho. Su estado es de la fila que la posee y **se
// declara igual**, para que sus hechos entren en el registro desde hoy: sin ellos, «cada cosa
// que altera el estado deja hecho» sería falso el día que esa fila llegue, y el registro de
// las partidas anteriores ya no se podría completar.
declaraArea({ id: 'anclajes' });

/** Las áreas declaradas, en el orden en que se escriben. */
export const IDS_DE_AREA = congelaHondo(AREAS.map((a) => a.id));

/** Las áreas que ocupan un campo del estado, en orden estable. */
export const AREAS_CON_ESTADO = congelaHondo(AREAS.filter((a) => a.esquema).map((a) => a.id));

/** Las áreas que solo aportan tipos de hecho, en orden estable. */
export const AREAS_SIN_ESTADO = congelaHondo(AREAS.filter((a) => !a.esquema).map((a) => a.id));

/**
 * Las áreas cuyos hechos **se reconocen pero no se reproducen**: las que todavía no
 * tienen estado, y las que lo tienen pero cuyo hecho no lleva dentro con qué
 * reconstruirlo. La reconstrucción de emergencia las declara en su resultado.
 */
export const AREAS_QUE_NO_REPRODUCEN = congelaHondo(AREAS.filter((a) => !a.reproduce).map((a) => a.id));

/** El área declarada con ese identificador, o un error que nombra las declaradas. */
export function areaDe(id) {
  const area = POR_ID[id];
  if (!area) throw new Error(`el área "${id}" no está declarada: las declaradas son ${IDS_DE_AREA.join(', ')}`);
  return area;
}

// --- Los sitios pisados, que son de esta capa hasta que una fila los reclame ---

function congelaSitios(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(estado?.mapas ?? {}).sort()) mapas[mapaId] = estado.mapas[mapaId].slice().sort();
  return { mapas };
}

function levantaSitios(doc) {
  const estado = { mapas: {} };
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const sitios = doc.mapas[mapaId] ?? [];
    for (const sitio of sitios) {
      if (typeof sitio !== 'string' || !sitio) {
        throw new Error(`un sitio pisado guardado del mapa ${mapaId} vuelve como ${JSON.stringify(sitio) ?? String(sitio)}: es el identificador de un sitio del mundo congelado`);
      }
    }
    estado.mapas[mapaId] = sitios.slice().sort();
  }
  return estado;
}

/** Registra que se ha pisado un sitio. Pisarlo dos veces deja una sola anotación. */
export function pisaSitio(estado, { mapaId, sitio }) {
  if (!estado?.mapas) throw new Error('el área de sitios pisados llega mal formada: se espera un objeto con "mapas"');
  if (typeof sitio !== 'string' || !sitio) {
    throw new Error(`un sitio pisado se anota por su identificador y llegó ${JSON.stringify(sitio) ?? String(sitio)}: nunca por su coordenada`);
  }
  if (!estado.mapas[mapaId]) estado.mapas[mapaId] = [];
  if (!estado.mapas[mapaId].includes(sitio)) estado.mapas[mapaId] = [...estado.mapas[mapaId], sitio].sort();
  return estado.mapas[mapaId];
}

// --- El sobre -----------------------------------------------------------------

/**
 * El esquema del estado de partida.
 *
 * La cabecera lleva cuatro cosas y no más: la **versión de formato** (de la
 * constante única de SPEC-009), la **semilla de la partida** (de SPEC-003 — es el
 * único sitio donde vive, porque SPEC-009 la dejó fuera de los documentos del
 * mundo), la **versión de las reglas** con la que se escribió, y la **marca de
 * aplicación**. Debajo, un campo por área, y el esquema es cerrado por los dos
 * lados: un campo que ninguna área declara —una posición de quien juega, por
 * ejemplo— hace fallar la escritura nombrándolo, en vez de viajar de polizón hasta
 * el disco.
 */
export const ESQUEMA_ESTADO = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  semilla: 'texto',
  aplicadoHasta: 'entero',
  // Lo que declara que este estado salió de una reconstrucción de emergencia, con
  // qué reglas se hizo y sobre cuántos hechos. Nulo en un estado normal.
  reconstruido: uno(['nulo', campos({ reglasDelRegistro: 'texto', reglasDeLaReproduccion: 'texto', hechos: 'entero' })]),
  areas: campos(Object.fromEntries(AREAS.filter((a) => a.esquema).map((a) => [a.id, a.esquema]))),
});

declaraEsquema(CLASES.ESTADO, ESQUEMA_ESTADO);

/**
 * El estado de una partida recién creada: cada área en su estado inicial, ningún
 * hecho aplicado y ninguna reconstrucción detrás.
 *
 * La semilla se exige y no se supone: es lo único de la cabecera que no se puede
 * derivar, y una partida sin ella no se podría volver a abrir.
 */
export function estadoInicial({ semilla }) {
  const partida = { semilla: exigeSemilla(semilla), aplicadoHasta: -1, reconstruido: null };
  for (const area of AREAS) if (area.esquema) partida[area.id] = area.inicial();
  return partida;
}

function exigeEstado(vivo) {
  if (!vivo || typeof vivo !== 'object' || typeof vivo.semilla !== 'string') {
    throw new Error('el estado de la partida llega mal formado: se espera lo que devuelve estadoInicial({ semilla })');
  }
  return vivo;
}

/** El estado en documento, validado contra el esquema cerrado al escribirlo. */
export function congelaEstado(vivo) {
  exigeEstado(vivo);
  const areas = {};
  for (const area of AREAS) if (area.esquema) areas[area.id] = area.congela(vivo[area.id]);
  const doc = {
    version: VERSION_FORMATO,
    generador: VERSION_GENERADOR,
    clase: CLASES.ESTADO,
    semilla: vivo.semilla,
    aplicadoHasta: Number.isInteger(vivo.aplicadoHasta) ? vivo.aplicadoHasta : -1,
    reconstruido: vivo.reconstruido ?? null,
    areas,
  };
  escribe(doc, ESQUEMA_ESTADO, 'documento estado-de-partida');
  sinRastroDeUbicacion(doc, 'documento estado-de-partida');
  return congelaHondo(doc);
}

/** El texto canónico del estado. Dos escrituras del mismo estado dan el mismo texto. */
export function textoDeEstado(vivo) {
  return textoCanonico(congelaEstado(vivo));
}

/**
 * El estado de vuelta de su documento.
 *
 * **La versión se comprueba antes que cualquier otro campo**, con las tres
 * respuestas cerradas de SPEC-009: es la mía y se abre; es mayor y no se abre en
 * absoluto; es menor y se declara que hay que migrarlo. Un campo que ninguna área
 * declara falla nombrándolo.
 */
export function levantaEstado(doc, donde = 'el estado de la partida') {
  compruebaVersion(doc, donde);
  escribe(doc, ESQUEMA_ESTADO, donde);
  const vivo = {
    semilla: exigeSemilla(doc.semilla),
    aplicadoHasta: doc.aplicadoHasta,
    reconstruido: doc.reconstruido ?? null,
  };
  for (const area of AREAS) if (area.esquema) vivo[area.id] = area.levanta(doc.areas[area.id]);
  return vivo;
}

// La guarda de privacidad se reexporta desde aquí porque es sobre **estos dos
// documentos** sobre los que RF-PRIV-002 se afirma, aunque viva en `formato.js` para
// que el registro pueda llamarla sin importar el sobre. `congelaEstado` ya la aplica.
export { sinRastroDeUbicacion };
