// El punto de montaje del momento «antes de salir»: junta el calendario, los clientes de las
// rutas de contenido del proxy, el conseguidor de recursos y la preparación, y se los entrega
// ya cableados a las cinco pantallas.
//
// Es el mismo reparto que `arranque-montado.jsx`: aquí se decide **qué** se monta, y quien
// quiera un montaje doblado —un proveedor que nunca responde, un calendario parado en el día
// veintitrés— construye el suyo y llama a `PantallaAntesDeSalir` directamente. Esa frontera es
// lo que permite recorrer las cinco pantallas en `node --test` sin ningún dispositivo.
//
// Y si algo no se puede cablear, **no se dibuja el momento**: se enseña la avería con su
// mensaje. Una portada que se monta con media tubería es indistinguible de una tarde sin
// cobertura, y son dos cosas distintas (§6h).

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PRESUPUESTO_FOTOS_MAPA_MS, PRESUPUESTO_PREPARACION_MS } from '@walkingadventure/nucleo/partida/recursos.js';
import { salidaEnCurso } from '@walkingadventure/nucleo/partida/salidas.js';

import { atestacionDeLaApp } from '../datos/atestacion.js';
import { creaCalendario } from '../datos/calendario.js';
import { creaClienteDeLotes } from '../datos/cliente-de-lotes.js';
import { puertaDeRed } from '../datos/red.js';
import { evidenciaDelSistema, mecanismoDeAtestacion } from '../plataforma/atestacion.js';
import { mensajeDeError } from '../plataforma/capacidades.js';
import { creaAlmacenDeBinarios } from '../recursos/almacen-de-binarios.js';
import { creaConseguidorDeRecursos } from '../recursos/conseguidor.js';
import { NUCLEO_DEL_ZURRON, NUCLEO_DE_LA_PREPARACION } from '../nucleo/piezas.js';
import { creaPreparacion } from '../salida/preparacion.js';
import { creaZurron } from '../salida/zurron.js';
import { PantallaAntesDeSalir } from './antes-de-salir.jsx';
import { DIRECCION_DEL_PROXY } from './mapa-montado.jsx';
import { marcaSuperpuesta } from './marca.js';

/**
 * @param {object} props
 *   `partida` el estado de la partida; `personaje` quien juega; `mundo` el mapa levantado;
 *   `arrancadaEn` cuándo empezó la partida, que es de donde sale el día; `base` la dirección
 *   del proxy; `almacen` dónde viven los binarios de las ilustraciones; `llamada` el cliente
 *   del narrador, que hoy no tiene montaje propio y se declara ausente en lugar de suponerse;
 *   `ofrecimiento` lo que devuelve `componeOfrecimiento` cuando no hay mapa donde estás, con
 *   sus dos acciones. Se pasa tal cual: aquí no se decide si hay mapa, solo se cablea.
 */
export function AntesDeSalirMontado({
  partida,
  registro = null,
  identidad = null,
  personaje,
  mundo,
  arrancadaEn,
  base = DIRECCION_DEL_PROXY,
  almacen = null,
  llamada = null,
  zurron = {},
  motor = null,
  alZurronVaciado = null,
  ofrecimiento = null,
  alLevantarMapa = null,
  alDejarloEstar = null,
  alAndar = null,
  alAbrirPuerta = null,
  alEcharElTelon = null,
  situacionDeSalida = 'sin-salida',
  estadoDelRotulo = 'no-disponible',
}) {
  // El motivo literal de la última vez que echar a andar no pudo abrir la salida. Vive
  // aquí y no en el estado del juego porque no es del juego: es lo que hay que enseñar
  // debajo de la acción que no pudo, en el mismo sitio desde el que se intentó.
  const [noSeAbre, setNoSeAbre] = useState(null);
  // Si se está buscando la posición ahora mismo. Vive aquí, en un solo sitio, y baja hasta
  // A2P1 y A2P5 como propiedad: la marca que lo declara y la línea que lo dice tienen que
  // salir del mismo estado, porque dos estados paralelos es cómo una marca acaba diciendo
  // que se busca mientras la pantalla ya enseñó otra cosa.
  const [buscando, setBuscando] = useState(false);

  const andar = useCallback(async (echada) => {
    // **Se dice de inmediato y desaparece siempre**, gane o pierda la búsqueda. Pedir la
    // posición con precisión alta enciende el GPS y eso cuesta segundos; la elección real
    // no es entre rápido y lento sino entre espera muda y espera dicha, y una espera muda
    // de diez segundos se lee como una app colgada. El `finally` es la mitad que importa:
    // una línea de espera que se queda puesta es peor que no tenerla.
    setBuscando(true);
    try {
      const respuesta = alAndar ? await alAndar(echada) : null;
      setNoSeAbre(respuesta && respuesta.abierta === false ? (respuesta.motivo ?? 'no se pudo abrir la salida y nadie dijo por qué') : null);
      return respuesta;
    } finally {
      setBuscando(false);
    }
  }, [alAndar]);

  // De qué puerta salió el punto de partida de la salida abierta y si se re-ancló. Se leen
  // del área **viva** y no de una propiedad: la orquestación de la salida la muta en sitio,
  // así que una copia tomada antes seguiría diciendo «sin reanclar» con el ancla ya movida.
  const laSalida = salidaEnCurso(partida?.salidas ?? { salida: null });

  const montaje = useMemo(() => {
    try {
      const pide = puertaDeRed();
      // La misma tanda que gastan el arranque y el mapa: las ilustraciones y las fotos
      // son llamadas de pago, y sin ficha el proxy solo devuelve lo que ya está pagado.
      const atestacion = atestacionDeLaApp({
        pide,
        base,
        plataforma: mecanismoDeAtestacion(),
        evidencia: evidenciaDelSistema(),
      });
      const ficha = () => atestacion.ficha();
      const conseguidor = creaConseguidorDeRecursos({
        clienteDeImagenes: creaClienteDeLotes({ pide, base, ruta: 'imagen', ficha }),
        clienteDeFotos: creaClienteDeLotes({ pide, base, ruta: 'places', ficha }),
        almacen: almacen ?? creaAlmacenDeBinarios(),
        presupuestoIlustracionesMs: PRESUPUESTO_PREPARACION_MS,
        presupuestoFotosMs: PRESUPUESTO_FOTOS_MAPA_MS,
      });
      // El zurrón se cablea aquí, **con la misma llamada y el mismo presupuesto que la
      // preparación** y no con uno propio: SPEC-042 lo decidió así, y dos montajes serían
      // dos sitios donde declarar «sin narrador».
      //
      // Y sus piezas se exigen **solo cuando hay zurrón que enseñar**: sin mapa levantado no
      // hay motor y lo que se ve es el ofrecimiento de A2P0, que no necesita ninguna. Con
      // reserva sin vaciar sí, y entonces la pieza que falte se dice por su nombre en lugar
      // de enseñar una portada que lleva a una pantalla vacía.
      const hayQueVaciar = zurron?.modoDeFondo === true && (zurron?.reserva?.length ?? 0) > 0;
      if (hayQueVaciar) {
        if (!motor) throw new Error('el zurrón se monta sin el motor de pasos del mapa activo, y la reserva es la de ese mapa: sin él no hay nada que vaciar ni dónde vaciarlo');
        if (!registro) throw new Error('el zurrón se monta sin el registro de hechos de la partida: el vaciado anexa su hecho antes de vaciar, y sin registro no se puede escribir');
      }
      return {
        calendario: creaCalendario({ arrancadaEn }),
        // Sin cliente de narrador montado todavía, y **declarado**: los textos salen de
        // plantilla porque alguien lo decidió, no porque se olvidara una pieza.
        preparacion: creaPreparacion({
          nucleo: NUCLEO_DE_LA_PREPARACION,
          conseguidor,
          llamada,
          sinNarrador: !llamada,
          locale: mundo?.locale ?? 'es',
        }),
        zurron: creaZurron({
          nucleo: NUCLEO_DEL_ZURRON,
          llamada,
          sinNarrador: !llamada,
          locale: mundo?.locale ?? 'es',
          presupuestoMs: PRESUPUESTO_PREPARACION_MS,
        }),
        fallo: null,
      };
    } catch (e) {
      return { calendario: null, preparacion: null, zurron: null, fallo: mensajeDeError(e) };
    }
  }, [base, almacen, llamada, arrancadaEn, mundo, zurron, motor, registro]);

  /**
   * Abre el zurrón: la decisión, la única llamada agrupada y la composición.
   *
   * La reserva se lee **de lo que llega ahora** y nunca de una referencia guardada: vaciarla
   * sustituye el array entero, así que una tomada antes seguiría trayendo los cinco pasos y
   * el zurrón volvería a ofrecerse recién vaciado.
   */
  const abreElZurron = useCallback(() => montaje.zurron.abre({
    mundo: mundo?.documento ?? null,
    modoDeFondo: zurron?.modoDeFondo === true,
    reserva: zurron?.reserva ?? [],
    semillaDeMundo: partida?.semilla ?? null,
  }), [montaje, mundo, zurron, partida]);

  /**
   * Confirma «Seguir»: **el hecho primero y la reserva después**, y solo entonces se congela.
   *
   * `narrados` es cuántas entradas se llegaron a enseñar, que es lo que el hecho apunta.
   * Confirmar dos veces el mismo zurrón no anexa un segundo hecho: el núcleo lo declara con
   * `yaEstaba` y no escribe nada.
   */
  const confirmaElZurron = useCallback((narrados) => {
    const vaciado = montaje.zurron.confirma({
      motor,
      registro,
      mapa: mundo?.mapaId ?? null,
      dia: montaje.calendario.dia(),
      narrados,
    });
    if (alZurronVaciado) alZurronVaciado(vaciado);
    return vaciado;
  }, [montaje, motor, registro, mundo, alZurronVaciado]);

  if (montaje.fallo !== null) {
    return (
      <View style={estilos.aviso} testID="antes-de-salir-sin-cablear">
        <Text style={estilos.texto}>{montaje.fallo}</Text>
      </View>
    );
  }

  return (
    <View style={estilos.pila}>
      {/* En qué situación está la salida, dónde está su rótulo y —cuando la hubo— por qué
          no se pudo abrir. Las tres son marcas: lo que se lee en la portada no cambia por
          tener o no tener rótulo, y el motivo literal se lee con un lector de pantalla. */}
      <View testID="salida-situacion" accessibilityLabel={situacionDeSalida} style={marcaSuperpuesta(0, { fila: 1 })} />
      <View testID="rotulo-estado" accessibilityLabel={estadoDelRotulo} style={marcaSuperpuesta(1, { fila: 1 })} />
      {noSeAbre ? <View testID="salida-no-se-abre" accessibilityLabel={noSeAbre} style={marcaSuperpuesta(2, { fila: 1 })} /> : null}
      {/* Y las tres del anclaje. `salida-buscando` está solo mientras se busca —que es lo
          que hace afirmable que la espera aparece al instante y desaparece siempre, en vez
          de leerse como una app lenta—; las otras dos declaran de qué puerta salió el punto
          de partida y si se re-ancló, que sobre la función pura se puede afirmar y sobre el
          aparato no, y es sobre el aparato donde nacieron los dos rojos. */}
      {buscando ? <View testID="salida-buscando" accessibilityLabel="buscando" style={marcaSuperpuesta(3, { fila: 1 })} /> : null}
      {laSalida ? <View testID="salida-punto-origen" accessibilityLabel={laSalida.origenDelPunto ?? 'sin-declarar'} style={marcaSuperpuesta(0, { fila: 2 })} /> : null}
      {laSalida ? <View testID="salida-reanclaje" accessibilityLabel={laSalida.reanclada ? 'reanclada' : 'sin-reanclar'} style={marcaSuperpuesta(1, { fila: 2 })} /> : null}

      <PantallaAntesDeSalir
        calendario={montaje.calendario}
        personaje={personaje}
        mundo={mundo}
        estado={partida}
        // El registro de hechos y la identidad de la salida: lo primero es lo que aceptar una
        // aventura anexa, y lo segundo la compone una sola función para las dos áreas.
        registro={registro}
        identidad={identidad}
        preparacion={montaje.preparacion}
        zurron={zurron}
        // A2P2, cableada: abrirla y confirmarla. La pantalla decide **cuándo** —lo dice el
        // destino que ya trae la portada— y aquí se decide **con qué**.
        alZurron={abreElZurron}
        alSeguirDelZurron={confirmaElZurron}
        // A2P0. Llega hasta aquí y no se compone aquí: quien sabe si hay mapa donde estás es
        // la raíz, que es la que tiene el levantamiento y la posición. Con ofrecimiento la
        // pantalla **sustituye la portada por él**, que es lo que hace desde SPEC-041
        // esperando a que alguien se lo pasara.
        ofrecimiento={ofrecimiento}
        alLevantarMapa={alLevantarMapa}
        alDejarloEstar={alDejarloEstar}
        alAndar={andar}
        // El estado de espera baja como dato y no se vuelve a decidir abajo: la marca de
        // arriba y la línea que se lee en A2P1 y A2P5 salen del mismo booleano.
        buscando={buscando}
        alAbrirPuerta={alAbrirPuerta}
        alEcharElTelon={alEcharElTelon}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pila: { flex: 1 },
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
