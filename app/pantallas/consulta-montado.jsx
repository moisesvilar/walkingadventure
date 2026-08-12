// El punto de montaje del momento «de consulta»: el diario, la repisa, los ajustes y
// empezar de nuevo, que son las cuatro pantallas que cuelgan de la portada.
//
// Es el mismo reparto que `arranque-montado.jsx` y `antes-de-salir-montado.jsx`: aquí se
// decide **qué** se monta, y quien quiera un montaje doblado —un almacén sin mapas, una
// partida sin objetos— construye el suyo y llama a la pantalla directamente. Esa frontera
// es lo que permite recorrer las cuatro en `node --test` sin ningún dispositivo.
//
// Y **si algo no se puede cablear, no se dibuja la pantalla**: se enseña la avería con la
// pieza nombrada. En el momento de consulta eso importa especialmente, porque las cuatro
// pantallas son listas y **una lista vacía y una lista que no se pudo leer se ven igual**
// (§6h): un diario en blanco tendría que poder distinguirse de un diario que no abrió.
//
// Lo que hoy no se puede resolver, y por eso se declara por escrito en lugar de suponerse:
// **de quién viene un objeto de la repisa**. La procedencia que guarda la partida es
// `{ desenlace, plantilla, lugar }` y nada del núcleo traduce un desenlace en la cara que
// lo entregó, así que la repisa se monta con `SIN_CARAS` —el valor que el propio núcleo
// obliga a pasar por escrito— y los objetos dicen de qué sitio y de qué día vienen. La
// mitad «de quién» de RF-PROG-007 sigue sin cablear y tiene dueño: la capa de NPCs.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { componeAjustes } from '@walkingadventure/nucleo/partida/ajustes.js';
import { abreCapitulo, abreElDiario } from '@walkingadventure/nucleo/partida/capitulos.js';
import { creaCapaDeDescartes, descartesDeMapa } from '@walkingadventure/nucleo/partida/descartes.js';
import { listaDeMapas } from '@walkingadventure/nucleo/partida/mapas.js';
import { SIN_CARAS, componeRepisa } from '@walkingadventure/nucleo/partida/repisa.js';
import { arbolDeCalzadas } from '@walkingadventure/nucleo/partida/rumores.js';

import { mensajeDeError } from '../plataforma/capacidades.js';
import { PantallaAjustes } from './ajustes.jsx';
import { PantallaDiarioPorDias, PantallaDiarioPorHistorias } from './diario.jsx';
import { PantallaEmpezarDeNuevo } from './empezar-de-nuevo.jsx';
import { PantallaRepisa } from './repisa.jsx';
import { ListaSitiosMarcados } from './sitios-marcados.jsx';

/** Las cinco puertas del momento. Las tres primeras son las de la portada. */
export const PUERTAS_DE_CONSULTA = Object.freeze(['diario', 'repisa', 'ajustes', 'empezar-de-nuevo', 'sitios-marcados']);

/**
 * Las filas de los ajustes que abren otra pantalla del momento.
 *
 * Están aquí y no en la pantalla porque es navegación: `ajustes.jsx` devuelve el
 * identificador de la fila tocada y no sabe a dónde lleva ninguna.
 */
const PUERTA_DE_LA_FILA = Object.freeze({
  'empezar-de-nuevo': 'empezar-de-nuevo',
  // **Deshacer vive en ajustes y no en el sitio** (`seguridad-privacidad.md` §3):
  // deshacerlo desde el sitio obligaría a volver a andar hasta allí, y ese es el único
  // coste que este juego no puede cobrar por un cambio de opinión. Hasta esta fila la lista
  // se contaba en A6P6 y no se podía abrir, así que la mitad reversible de RF-PRIV-004 no
  // tenía camino.
  'sitios-marcados': 'sitios-marcados',
});

/** La avería del momento, con la pieza nombrada. Un identificador propio, como los otros dos. */
function Averia({ mensaje }) {
  return (
    <View style={estilos.aviso} testID="consulta-sin-cablear">
      <Text style={estilos.texto}>{mensaje}</Text>
    </View>
  );
}

/**
 * El diario, con su tira de capítulos.
 *
 * Los mapas de la partida se leen del almacén, así que la pantalla llega después de una
 * lectura: mientras tanto no se pinta un diario vacío, que sería indistinguible de una
 * partida sin nada apuntado.
 */
function DiarioMontado({ partida, mapaActivo, almacen, alVolver }) {
  const [mapas, setMapas] = useState(null);
  const [fallo, setFallo] = useState(null);
  const [abiertoId, setAbiertoId] = useState(mapaActivo);
  const [porHistorias, setPorHistorias] = useState(false);

  useEffect(() => {
    let vivo = true;
    listaDeMapas({ almacen, pasos: partida.pasos })
      .then((leidos) => { if (vivo) setMapas(leidos); })
      .catch((e) => { if (vivo) setFallo(mensajeDeError(e)); });
    return () => { vivo = false; };
  }, [almacen, partida]);

  const montaje = useMemo(() => {
    if (!mapas) return null;
    try {
      const diario = abreElDiario({ diario: partida.diario, mapas, mapaActivo });
      // El capítulo abierto puede fallar por sí solo —un mapa cuyo índice no cuadra— sin
      // que la tira se caiga: eso es una línea de fallo dentro del diario y no una avería.
      let capitulo = null;
      let falloDelCapitulo = null;
      try {
        capitulo = abreCapitulo({ diario: partida.diario, mapas, mapaActivo, mapaId: abiertoId });
      } catch (e) {
        falloDelCapitulo = mensajeDeError(e);
      }
      return { diario, capitulo, falloDelCapitulo, fallo: null };
    } catch (e) {
      return { diario: null, capitulo: null, falloDelCapitulo: null, fallo: mensajeDeError(e) };
    }
  }, [mapas, partida, mapaActivo, abiertoId]);

  if (fallo !== null) return <Averia mensaje={fallo} />;
  // Sin los mapas leídos todavía no hay diario que pintar. No es un estado vacío: es que
  // aún no se sabe qué hay.
  if (!montaje) return <View style={estilos.aviso} testID="diario-abriendo" />;
  if (montaje.fallo !== null) return <Averia mensaje={montaje.fallo} />;

  if (porHistorias) {
    return (
      <PantallaDiarioPorHistorias
        capitulo={montaje.capitulo}
        textos={partida.textos?.textos ?? {}}
        alVerPorDias={() => setPorHistorias(false)}
      />
    );
  }

  return (
    <PantallaDiarioPorDias
      diario={montaje.diario}
      capitulo={montaje.capitulo}
      textos={partida.textos?.textos ?? {}}
      fallo={montaje.falloDelCapitulo}
      alVolver={alVolver}
      alAbrirCapitulo={(id) => setAbiertoId(id)}
      alVerPorHistorias={() => setPorHistorias(true)}
    />
  );
}

/** La repisa: los objetos, los motes del mapa activo y la línea del oro. */
function RepisaMontada({ partida, mundo, alVolver }) {
  const montaje = useMemo(() => {
    try {
      return {
        repisa: componeRepisa({
          objetos: partida.objetos,
          oro: partida.oro,
          motes: partida.motes,
          nucleos: partida.nucleos,
          mapaId: mundo?.mapaId ?? null,
          mapa: arbolDeCalzadas(mundo?.documento ?? null),
          // Declarado y no supuesto: ver la nota de la cabecera.
          caras: SIN_CARAS,
        }),
        fallo: null,
      };
    } catch (e) {
      return { repisa: null, fallo: mensajeDeError(e) };
    }
  }, [partida, mundo]);

  if (montaje.fallo !== null) return <Averia mensaje={montaje.fallo} />;
  return <PantallaRepisa repisa={montaje.repisa} alVolver={alVolver} />;
}

/**
 * Los ajustes.
 *
 * El contexto se arma aquí porque cada fila lo pide de un sitio distinto de la partida, y
 * lo que falte hace fallar la composición nombrando la pieza: es exactamente lo que la
 * pantalla quiere en lugar de pintar una fila apagada.
 */
function AjustesMontados({ partida, personaje, mundo, criterios, pasosDeFondo, alCambiarAjuste, alVolver, alAbrirPuerta }) {
  // Cuántas veces ha cambiado un interruptor. El área de ajustes la muta el núcleo en sitio
  // y React no se entera solo: sin esto, tocar la fila no repintaría su valor hasta salir y
  // volver a entrar, y una aplicación que no repinta lo que acabas de tocar está rota
  // (`design-system.md`). Es el mismo patrón que la lista de sitios marcados.
  const [movimientos, repinta] = useState(0);
  // La línea que aparece **solo** cuando el permiso se deniega o se revoca, con su
  // localizador. Vive aquí y no en el estado del juego porque no es del juego: es lo que hay
  // que leer bajo la fila que no se pudo encender.
  const [avisoDelFondo, setAvisoDelFondo] = useState(null);

  // Al abrir los ajustes se lee el valor **efectivo** del interruptor, no el pedido: un
  // permiso revocado desde fuera lo apaga aquí y lo dice, en lugar de seguir en «sí» sin
  // leer nada. Consultar no es preguntar: esto no pide ningún permiso.
  useEffect(() => {
    if (!pasosDeFondo) return undefined;
    let vivo = true;
    pasosDeFondo.efectivo()
      .then((estado) => {
        if (!vivo) return;
        setAvisoDelFondo(estado.aviso ? { texto: estado.aviso, testid: estado.testid, fila: pasosDeFondo.fila } : null);
        repinta((n) => n + 1);
      })
      .catch(() => { if (vivo) setAvisoDelFondo(null); });
    return () => { vivo = false; };
  }, [pasosDeFondo]);

  const montaje = useMemo(() => {
    try {
      const marcados = descartesDeMapa(partida.anclajes, mundo?.mapaId ?? null);
      return {
        ajustes: componeAjustes({
          personaje,
          criterios,
          estilo: partida.pintado?.estilo ?? null,
          tamanoDeTexto: partida.pintado?.tamanoDeTexto ?? null,
          ajustes: partida.ajustes,
          sitiosMarcados: { cuantos: marcados.length },
          // Las dos puertas de la lista, declaradas: sin destino cableado el núcleo se
          // niega a pintar un chevron que no abre nada.
          puertas: ['copia', 'empezar-de-nuevo'],
        }),
        fallo: null,
      };
    } catch (e) {
      return { ajustes: null, fallo: mensajeDeError(e) };
    }
  }, [partida, personaje, mundo, criterios, movimientos]);

  if (montaje.fallo !== null) return <Averia mensaje={montaje.fallo} />;
  return (
    <PantallaAjustes
      ajustes={montaje.ajustes}
      aviso={avisoDelFondo}
      alVolver={alVolver}
      alAbrirFila={(id) => (PUERTA_DE_LA_FILA[id] ? alAbrirPuerta(PUERTA_DE_LA_FILA[id]) : null)}
      // El interruptor no se enciende por tocarlo: lo pide. Quien sabe pedirlo es la
      // orquestación de los pasos de fondo, y sin ella la fila no cambia de valor —que es
      // lo correcto, porque encenderla sin poder leer nada sería el interruptor que miente.
      //
      // Y **atiende su fila y solo la suya**: lo que no atiende vuelve declarado y sin haber
      // tocado nada, que es lo que impide que el toque de un interruptor de otra fila del
      // checklist cambie un ajuste que nadie ha decidido cambiar aquí.
      alCambiarInterruptor={pasosDeFondo ? (id, quiere) => {
        void pasosDeFondo.pide(id, quiere).then((respuesta) => {
          if (!respuesta.atendida) return;
          setAvisoDelFondo(respuesta.aviso ? { texto: respuesta.aviso, testid: respuesta.testid, fila: pasosDeFondo.fila } : null);
          repinta((n) => n + 1);
          if (alCambiarAjuste) alCambiarAjuste();
        });
      } : null}
    />
  );
}

/**
 * «Sitios que marcaste», con su deshacer.
 *
 * **Deshacer no resiembra nada**, igual que marcar: el sitio conserva su nombre y su
 * posición, el documento del mapa no cambia ni un byte y lo único que se mueve es si el
 * anclaje vuelve a recibir casting. Y no sale nada del móvil, ni al marcar ni al deshacer:
 * aquí no hay a quién.
 */
function SitiosMarcadosMontado({ partida, mundo, registro, dia }) {
  const [movimientos, repinta] = useState(0);

  const montaje = useMemo(() => {
    try {
      return {
        capa: creaCapaDeDescartes({
          mundo: mundo?.documento ?? null,
          cupos: mundo?.cupos ?? null,
          estado: partida.anclajes,
          mapaId: mundo?.mapaId ?? null,
          registro,
        }),
        fallo: null,
      };
    } catch (e) {
      return { capa: null, fallo: mensajeDeError(e) };
    }
  }, [partida, mundo, registro]);

  if (montaje.fallo !== null) return <Averia mensaje={montaje.fallo} />;
  return (
    <ListaSitiosMarcados
      sitios={montaje.capa.sitiosMarcados()}
      alDeshacer={(anclaje) => {
        // El paso del mundo no se toca desde aquí: deshacer es una anotación del registro y
        // no un paso, así que se anexa en el paso que hubiera. El día entra inyectado porque
        // dentro del núcleo leer el reloj está prohibido.
        montaje.capa.deshaz({ anclaje, dia, paso: partida.pasos?.mapas?.[mundo?.mapaId]?.n ?? 0 });
        repinta((n) => n + 1);
      }}
      // Cuántas veces se ha deshecho algo. El área la muta el núcleo en sitio y React no se
      // entera solo; sin esto la lista se quedaría con el sitio que ya no está.
      key={movimientos}
    />
  );
}

/** Empezar de nuevo. La composición es una lectura del almacén, así que llega después. */
function EmpezarDeNuevoMontado({ partida, empezarDeNuevo, alVolver, alBorrada }) {
  const [pantalla, setPantalla] = useState(null);
  const [fallo, setFallo] = useState(null);

  useEffect(() => {
    let vivo = true;
    empezarDeNuevo.pregunta({ estado: partida })
      .then((compuesta) => { if (vivo) setPantalla(compuesta); })
      .catch((e) => { if (vivo) setFallo(mensajeDeError(e)); });
    return () => { vivo = false; };
  }, [empezarDeNuevo, partida]);

  if (fallo !== null) return <Averia mensaje={fallo} />;
  if (!pantalla) return <View style={estilos.aviso} testID="empezar-de-nuevo-abriendo" />;
  return (
    <PantallaEmpezarDeNuevo
      pantalla={pantalla}
      empezarDeNuevo={empezarDeNuevo}
      alVolver={alVolver}
      alBorrada={alBorrada}
    />
  );
}

/**
 * @param {object} props
 *   `puerta` cuál de las cuatro; `partida` el estado; `personaje` quien juega; `mundo` el
 *   mapa activo con su documento; `almacen` de donde salen los mapas de la partida;
 *   `empezarDeNuevo` la orquestación del borrado; `pasosDeFondo` la del interruptor de
 *   salud, que hoy puede no estar; `criterios` los caminos que evitar; `alVolver` la
 *   vuelta a la portada; `alAbrirPuerta` el salto de los ajustes a empezar de nuevo;
 *   `alBorrada` qué ocurre cuando ya no hay partida, que es ir al arranque y a ningún
 *   otro sitio.
 *
 * `criterios` llega por la firma y hoy llega siempre vacío, y eso **no es un valor por
 * defecto tragado**: ninguna área del estado de la partida los guarda todavía. Quien los
 * persista los pasará por aquí sin tocar nada más; mientras tanto la fila de A6P6 dice
 * «ninguno», que es lo que hay.
 */
export function ConsultaMontada({
  puerta,
  partida,
  personaje,
  mundo,
  almacen,
  empezarDeNuevo,
  pasosDeFondo = null,
  alCambiarAjuste = null,
  criterios = [],
  registro = null,
  dia = 0,
  alVolver = null,
  alAbrirPuerta = null,
  alBorrada = null,
}) {
  if (!PUERTAS_DE_CONSULTA.includes(puerta)) {
    return <Averia mensaje={`el momento de consulta no tiene ninguna puerta "${puerta}": las suyas son ${PUERTAS_DE_CONSULTA.join(', ')}`} />;
  }

  if (puerta === 'diario') {
    return <DiarioMontado partida={partida} mapaActivo={mundo?.mapaId ?? null} almacen={almacen} alVolver={alVolver} />;
  }
  if (puerta === 'repisa') {
    return <RepisaMontada partida={partida} mundo={mundo} alVolver={alVolver} />;
  }
  if (puerta === 'sitios-marcados') {
    // La lista no dibuja vuelta propia y no se le añade una aquí: su composición es de la
    // fila 38 y esta fila la monta, no la rediseña. Se sale con el atrás del sistema, que
    // `App.js` lleva de vuelta a los ajustes igual que desde empezar de nuevo.
    return <SitiosMarcadosMontado partida={partida} mundo={mundo} registro={registro} dia={dia} />;
  }
  if (puerta === 'ajustes') {
    return (
      <AjustesMontados
        partida={partida}
        personaje={personaje}
        mundo={mundo}
        criterios={criterios}
        pasosDeFondo={pasosDeFondo}
        alCambiarAjuste={alCambiarAjuste}
        alVolver={alVolver}
        alAbrirPuerta={alAbrirPuerta}
      />
    );
  }
  return (
    <EmpezarDeNuevoMontado
      partida={partida}
      empezarDeNuevo={empezarDeNuevo}
      alVolver={alVolver}
      alBorrada={alBorrada}
    />
  );
}

const estilos = StyleSheet.create({
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
