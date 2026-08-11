// El encadenado de las cinco pantallas del momento «antes de salir»: portada → lista → ficha
// → preparación, y de ahí a andar. A2P2, el zurrón, es de la fila 42: aquí existe la arista
// que lleva a ella y la condición que la hace existir, y nada más.
//
// Como en el arranque, **esta capa no decide nada del juego**. Qué bloques hay, qué entradas
// trae la lista, si se ofrece el estirón, si se puede aceptar y qué dice cada texto sale del
// núcleo; lo de aquí es en qué pantalla estás y qué se guarda al cambiar.
//
// Y **la preparación se exige cableada**: sin ella no se monta esto. Montarlo igual dejaría
// una salida que llega a A2P5, no pide nada a nadie y sale a andar, que es indistinguible de
// una salida sin cobertura (`pipeline/decisiones-orquestador.md` §6h).

import React, { useCallback, useMemo, useState } from 'react';

import { componeFicha, componeLoQueHayHoy, aceptaElEstironDeHoy, aceptaLaEntrada } from '@walkingadventure/nucleo/partida/lo-que-hay-hoy.js';
import { componePortada } from '@walkingadventure/nucleo/partida/portada.js';
import { componePreparacion } from '@walkingadventure/nucleo/partida/preparacion.js';
import { VIAS_DE_CIERRE, abreSalida, cierraLaSalida, haySalidaAbierta } from '@walkingadventure/nucleo/partida/salida-abierta.js';
import { CATALOGO } from '@walkingadventure/nucleo/quests/catalogo.js';

import { PantallaLoQueHayHoy, PantallaFicha } from './lo-que-hay-hoy.jsx';
import { PantallaPortada } from './portada.jsx';
import { PantallaOfrecimiento } from './ofrecimiento.jsx';
import { PantallaPreparacion } from './preparacion.jsx';

/** Las pantallas del momento, tal como las encadena `docs/flujo.md`. */
export const PANTALLAS = Object.freeze(['portada', 'lista', 'ficha', 'preparacion']);

/**
 * La identidad de una salida.
 *
 * Sale del mapa y del día y de nada más: **ninguna marca de tiempo del reloj**, que es lo que
 * RF-PRIV-002 prohíbe guardar. Dos salidas el mismo día se distinguen por el contador, que la
 * partida ya lleva.
 */
export function identidadDeSalida({ mapaId, dia, n = 1 }) {
  return `${mapaId}/d${dia}/s${n}`;
}

/** La plantilla del catálogo de una entrada de la lista, o un error que la nombra. */
function plantillaDe(id) {
  const plantilla = CATALOGO.find((p) => p.id === id);
  if (!plantilla) {
    throw new Error(`la entrada "${id}" no está en el catálogo, y sin plantilla no hay huecos que pedirle al narrador`);
  }
  return plantilla;
}

/**
 * @param {object} props
 *   `calendario` el de la partida, inyectado; `personaje` quien juega; `mundo` el mapa
 *   levantado con su documento y su título; `estado` el estado de la partida, del que se usan
 *   el área de aventuras y la cola de entregas; `preparacion` la orquestación de A2P5;
 *   `zurron` el modo de pasos de fondo y lo que haya en reserva; `alAndar` qué ocurre al salir;
 *   `alEcharElTelon` qué ocurre al cerrar una salida —es de la fila 36 y aquí solo se avisa—;
 *   `alAbrirPuerta` el diario, la repisa y los ajustes, que son de las filas 37 y 38;
 *   `ofrecimiento` lo que devuelve `componeOfrecimiento` cuando **no hay mapa activo**, que
 *   es el caso de estar lejos de todos los mapas de la partida. Sustituye a la portada y no
 *   se superpone a ella: sin mapa no hay portada que enseñar, y enseñar la de casa a
 *   trescientos kilómetros ofrecería salir a andar en un mundo donde no estás.
 */
export function PantallaAntesDeSalir({
  calendario,
  personaje,
  mundo,
  estado,
  preparacion,
  zurron = {},
  criterios = [],
  tamano = 'aventura',
  ofrecimiento = null,
  alLevantarMapa = null,
  alDejarloEstar = null,
  alAndar = null,
  alEcharElTelon = null,
  alAbrirPuerta = null,
  alZurron = null,
}) {
  if (!preparacion || typeof preparacion.prepara !== 'function') {
    throw new Error(
      'el momento antes de salir se monta con la preparación cableada, y no arranca sin ella: ' +
      'una salida que llega a la preparación sin nada que preparar es indistinguible de una salida sin cobertura',
    );
  }

  const [pantalla, setPantalla] = useState('portada');
  const [elegida, setElegida] = useState(null);
  const [lista, setLista] = useState(null);
  const [preparado, setPreparado] = useState(null);
  const [refresco, setRefresco] = useState(0);

  const mapaId = mundo?.mapaId ?? null;
  const peticion = useMemo(() => ({
    mundo: mundo?.documento ?? null,
    oficio: personaje.oficio,
    tramo: personaje.tramo?.declaradoM ?? personaje.tramoM,
    criterios,
    tamano,
    entregas: estado.entregas,
    mapaId,
    calendario,
  }), [mundo, personaje, criterios, tamano, estado, mapaId, calendario]);

  const portada = useMemo(
    // `refresco` está en las dependencias a propósito: abrir o cerrar una salida cambia el
    // registro en sitio, y sin él la tarjeta de a medias se quedaría como estaba.
    //
    // Sin mapa activo no se compone ninguna: una portada necesita un mapa dentro, y
    // componerla con el último visitado sería enseñar un sitio en el que no se puede jugar.
    () => (ofrecimiento ? null : componePortada({ calendario, personaje, mundo, salidas: estado.aventuras, zurron })),
    [calendario, personaje, mundo, estado, zurron, refresco, ofrecimiento],
  );

  // El ofrecimiento manda sobre todo lo demás y no es un paso de esta máquina: no se
  // llega a él desde ninguna pantalla, se está en él porque no hay mapa donde estás.
  if (ofrecimiento) {
    return (
      <PantallaOfrecimiento
        ofrecimiento={ofrecimiento}
        alLevantar={alLevantarMapa}
        alDejarlo={alDejarloEstar}
        alAbrirPuerta={alAbrirPuerta}
      />
    );
  }

  const abre = useCallback(() => {
    if (haySalidaAbierta(estado.aventuras)) return;
    abreSalida(estado.aventuras, { salida: identidadDeSalida({ mapaId, dia: calendario.dia() }), mapaId });
    setRefresco((n) => n + 1);
  }, [estado, mapaId, calendario]);

  /**
   * Echarse a andar, que desde SPEC-048 **puede no poder**.
   *
   * El orden importa: primero se pregunta si la salida se abre de verdad —hay rótulo, hay
   * permiso, hay posición— y solo entonces se anota la aventura en curso. Al revés, una
   * salida que no se abre dejaría la tarjeta de a medias puesta sin nada detrás.
   */
  const echaAAndar = useCallback(async (echada) => {
    const respuesta = alAndar ? await alAndar(echada) : null;
    if (respuesta && respuesta.abierta === false) return respuesta;
    if (!echada?.retomada) abre();
    return respuesta;
  }, [alAndar, abre]);

  const cierra = useCallback((via) => {
    const cerrada = cierraLaSalida(estado.aventuras, { via });
    setRefresco((n) => n + 1);
    setPantalla('portada');
    // El telón, con su cierre en corto, es de la fila 36: aquí se le entrega lo cerrado y no
    // se inventa ningún desenlace.
    if (alEcharElTelon) alEcharElTelon(cerrada);
  }, [estado, alEcharElTelon]);

  if (pantalla === 'portada') {
    return (
      <PantallaPortada
        portada={portada}
        alVerQueSeCuenta={() => {
          const accion = portada.acciones.find((a) => a.id === 'ver-que-se-cuenta');
          if (accion.destino === 'zurron' && alZurron) return alZurron();
          setLista(componeLoQueHayHoy(peticion));
          setPantalla('lista');
        }}
        alSalirSinMas={() => { void echaAAndar({ conAventura: false }); }}
        alSeguir={() => { void echaAAndar({ conAventura: true, retomada: true }); }}
        // La misma puerta en otro sitio: dispara el mismo cierre que llegar a casa.
        alDejarloAqui={() => cierra(VIAS_DE_CIERRE.DEJARLO_AQUI)}
        alAbrirPuerta={alAbrirPuerta}
      />
    );
  }

  if (pantalla === 'lista') {
    return (
      <PantallaLoQueHayHoy
        lista={lista}
        alAbrirFicha={(entrada) => { setElegida(entrada); setPantalla('ficha'); }}
        // Se compone otra lista con un tramo más. El mundo no se toca: el estirón alarga hasta
        // dónde te mandan y nunca resiembra qué existe. Y no se encadena solo: la segunda
        // falta llega sin oferta, así que este botón deja de existir.
        alEstiron={() => setLista(aceptaElEstironDeHoy({ ...peticion, tramosDeMas: lista.tramosDeMas }))}
        alAndarSinNada={() => { void echaAAndar({ conAventura: false }); }}
      />
    );
  }

  if (pantalla === 'ficha') {
    const ficha = componeFicha({ entrada: elegida });
    return (
      <PantallaFicha
        ficha={ficha}
        alOtraCosa={() => { setElegida(null); setPantalla('lista'); }}
        alAceptar={async () => {
          abre();
          aceptaLaEntrada({ lista, id: elegida.id, salidas: estado.aventuras, entregas: estado.entregas, mapaId });
          setPantalla('preparacion');
          const hecho = await preparacion.prepara({
            // La aventura para el narrador y para las ilustraciones es su reparto casteado, no
            // la tarjeta: lo que se ilustra son los lugares del lazo.
            aventura: { id: elegida.id, tamano: elegida.tamano, beats: elegida.beats },
            plantilla: plantillaDe(elegida.id),
            mundo: mundo?.documento ?? null,
          });
          setPreparado(hecho);
        }}
      />
    );
  }

  return (
    <PantallaPreparacion
      // Con la preparación todavía en marcha se pinta la misma pantalla: lo que cambia es que
      // el botón espera, no lo que dice ninguna línea.
      preparacion={preparado?.pantalla ?? componePreparacion()}
      lista={preparado !== null}
      // La aventura ya quedó anotada al aceptarla en la ficha, así que aquí solo se
      // pregunta si la salida se abre: `retomada` evita anotarla dos veces.
      alSalirAAndar={() => { void echaAAndar({ conAventura: true, preparado, retomada: true }); }}
    />
  );
}
