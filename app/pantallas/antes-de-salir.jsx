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

import { acepta as aceptaLaAventuraEnElMotor } from '@walkingadventure/nucleo/partida/aventura-en-curso.js';
import { vistaDeDescartes } from '@walkingadventure/nucleo/partida/descartes.js';
import { componeFicha, componeLoQueHayHoy, aceptaElEstironDeHoy, aceptaLaEntrada } from '@walkingadventure/nucleo/partida/lo-que-hay-hoy.js';
import { estadoDeMapa } from '@walkingadventure/nucleo/partida/pasos.js';
import { componePortada } from '@walkingadventure/nucleo/partida/portada.js';
import { componePreparacion } from '@walkingadventure/nucleo/partida/preparacion.js';
import { abreSalida, haySalidaAbierta } from '@walkingadventure/nucleo/partida/salida-abierta.js';
import { CATALOGO } from '@walkingadventure/nucleo/quests/catalogo.js';

import { casteadaDelMundo } from '../marcha/llegadas.js';
import { PantallaLoQueHayHoy, PantallaFicha } from './lo-que-hay-hoy.jsx';
import { PantallaPortada } from './portada.jsx';
import { PantallaOfrecimiento } from './ofrecimiento.jsx';
import { PantallaPreparacion } from './preparacion.jsx';

/** Las pantallas del momento, tal como las encadena `docs/flujo.md`. */
export const PANTALLAS = Object.freeze(['portada', 'lista', 'ficha', 'preparacion']);

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
 *   trescientos kilómetros ofrecería salir a andar en un mundo donde no estás;
 *   `registro` el de hechos de la partida, que es lo que aceptar una aventura anexa;
 *   `identidad` la identidad de la salida viva, que la compone **una sola función** y llega
 *   desde la raíz para que las dos áreas escriban la misma (`app/marcha/identidad.js`).
 */
export function PantallaAntesDeSalir({
  calendario,
  personaje,
  mundo,
  estado,
  registro = null,
  identidad = null,
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
    // **La memoria de la lista.** `componeLoQueHayHoy` saca de la lista las plantillas ya
    // vividas leyendo el registro de aventuras, y hasta esta fila la petición no se lo pasaba:
    // llegaba en nulo, `cerradas` salía vacío y los mismos títulos volvían a ofrecerse después
    // de haberlos terminado. Era invisible porque antes de SPEC-049 ninguna aventura podía
    // cerrarse nunca; medido en el emulador el 12-ago-2026, con dos aventuras en `cerradas`
    // —una terminada y otra a medias— la lista de hoy volvía a ofrecer las dos.
    //
    // Va **el área viva y no una copia**: `aventurasCerradas` la lee en el momento de componer
    // la lista, así que cerrar una aventura durante la salida se nota en la lista siguiente sin
    // depender de que este memo se haya vuelto a evaluar.
    aventuras: estado.aventuras,
    // **Los sitios marcados.** Mismo patrón: `componeLoQueHayHoy` declara `descartes` con un
    // valor por defecto inocuo y se lo pasa a `repartoDeAventuras`, que con descartes de verdad
    // vuelve a castear. Sin esto, un anclaje marcado «este sitio no pega» seguía casteando
    // aventuras y RF-PRIV-004 cojeaba en silencio — el propio núcleo lo dice en el error de
    // `exigeDescartes`: «sin ella devolvería candidatos que quien juega ya marcó».
    //
    // Es `vistaDeDescartes` y no `descartesDeMapa`, que se le parece: lo que el contrato pide
    // es la vista con `descartado()`, y la lista pelada no la cumple.
    //
    // La vista es una **instantánea** y se toma aquí a propósito: castear el catálogo entero
    // tiene que ver el mismo conjunto de la primera plantilla a la última. Que no se quede
    // rancia lo sostiene el recorrido y no la suerte — marcar un sitio ocurre dentro de una
    // llegada y deshacerlo dentro de los ajustes, y `App.js` monta otro momento en los dos
    // casos, así que este componente se desmonta y vuelve con la instantánea recién tomada.
    descartes: vistaDeDescartes(estado.anclajes, mapaId),
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

  /**
   * Abre el registro de la salida en el área `aventuras`, con **la identidad de siempre**.
   *
   * La identidad llega de fuera y no se compone aquí: es la misma función que usa la vida de
   * la salida para el área `salidas`, y con dos el cierre no encontraba la salida que tenía
   * abierta (`app/marcha/identidad.js`).
   */
  const abre = useCallback(() => {
    if (haySalidaAbierta(estado.aventuras)) return;
    if (typeof identidad !== 'function') {
      throw new Error(
        'el momento antes de salir se monta con la identidad de la salida inyectada y no llegó ninguna: componerla aquí sería la ' +
        'segunda identidad que impedía echar el telón, porque el cierre compara la que recibe con la que está abierta',
      );
    }
    abreSalida(estado.aventuras, { salida: identidad(), mapaId });
    setRefresco((n) => n + 1);
  }, [estado, mapaId, identidad]);

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

  /**
   * «Dejarlo aquí»: la misma puerta que volver a casa, **y no el sitio donde se cierra el
   * registro de la salida**.
   *
   * Hasta esta fila aquí se llamaba a `cierraLaSalida(estado.aventuras, …)` por su cuenta, y
   * eso hacía imposible echar el telón: `echaElTelon` exige que esa misma salida siga abierta
   * y, si no lo está, falla con «su telón ya se echó». Quien la cierra es el cierre, en su
   * paso 9, y las tres vías entran por la misma puerta (`bucle-jugable.md` §8).
   */
  const cierra = useCallback(() => {
    setRefresco((n) => n + 1);
    setPantalla('portada');
    if (alEcharElTelon) alEcharElTelon();
  }, [alEcharElTelon]);

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
        alDejarloAqui={() => cierra()}
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
          // **Y se acepta en el motor**, que es lo que hasta esta fila no hacía nadie: la
          // entrada quedaba anotada en el registro de la salida abierta y `estado.aventuras.enCurso`
          // seguía siendo `null`, así que `resuelveBeat` era inalcanzable y el telón componía
          // siempre el de un paseo sin aventura. Va aquí y no al salir a andar porque SPEC-034
          // dice que el estado lo escribe la aceptación, y `docs/flujo.md` pone la arista en
          // `A2P4 → A2P5`: aceptarla más tarde dejaría A2P5 preparando una aventura que el
          // motor no conoce.
          //
          // Solo las de clase aventura. Un recado de la cola no trae cadena de beats ni
          // plantilla del catálogo —es una entrada de SPEC-019— y el motor de la aventura en
          // curso recorre cadenas: aceptarlo aquí fallaría nombrando la cadena que no tiene.
          // Queda **declarado** y no tragado, que es la diferencia (§6h).
          const casteada = casteadaDelMundo(mundo?.documento ?? null, elegida.id);
          if (casteada) {
            aceptaLaAventuraEnElMotor(estado.aventuras, {
              aventura: casteada.aventura,
              mapaId,
              registro,
              dia: calendario.dia(),
              paso: estadoDeMapa(estado.pasos, mapaId).n,
            });
          }
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
      //
      // **El reparto casteado ya no viaja con la salida**, y esa es la costura 5: se recupera
      // del mundo congelado y de la plantilla que el estado guarda, así que sobrevive a cerrar
      // la app (§10g). Mandarlo desde aquí era lo que hacía que solo estuviera el primer día.
      alSalirAAndar={() => { void echaAAndar({ conAventura: true, preparado, retomada: true }); }}
    />
  );
}
