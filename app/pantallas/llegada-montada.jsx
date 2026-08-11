// El punto de montaje del momento «al parar»: encadena el paso vigente de la escena que
// espera, pone el visor como capa encima, abre A4P8 sobre la ficha y saca A6P3 cuando la
// llegada a un núcleo enciende la primera coincidencia.
//
// Es el mismo reparto que `en-marcha-montado.jsx` y `consulta-montado.jsx`: aquí se decide
// **qué** se monta y con qué se cablea cada acción, y quien quiera un montaje doblado —una
// capa de llegadas guionizada— llama a `PantallaLlegada` directamente. Esa frontera es lo que
// permite recorrer la secuencia entera en `node --test` sin ningún dispositivo.
//
// Lo único que este fichero decide es **qué capa está puesta ahora mismo**, y son tres cosas
// distintas que se parecen:
//
// - **El visor encadenado no es estado de aquí**: lo dice la secuencia, y cerrarlo avanza.
// - **El visor a un toque sí lo es**: no se abre solo, espera un dedo, y cerrarlo no avanza
//   nada porque no era ningún paso.
// - **El descarte y la primera coincidencia también**: son capas por encima de un paso que
//   sigue montado debajo, no pasos de la secuencia.
//
// Y **no hay ninguna operación que lleve a un paso concreto**. Su ausencia es la pieza: no
// hay ruta a la que ir, así que no hay manera de llegar a A4P5 sin haber llegado al núcleo.

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { mensajeDeError } from '../plataforma/capacidades.js';
import { PantallaLlegada } from './llegada.js';
import { marcaSuperpuesta } from './marca.js';
import { PantallaTriangulacion } from './triangulacion.jsx';

/** La avería del momento, con la pieza nombrada. Un identificador propio, como los otros dos. */
function Averia({ mensaje }) {
  return (
    <View style={estilos.aviso} testID="llegada-sin-cablear">
      <Text style={estilos.texto}>{mensaje}</Text>
    </View>
  );
}

/**
 * @param {object} props
 *   `llegadas` la capa de `app/marcha/llegadas.js`; `textos` el área de textos de la partida,
 *   de donde la escena de la primera coincidencia saca lo que se dijo; `alCambiar` a quién se
 *   avisa cuando la secuencia se movió —es donde la partida se congela, porque cerrar una
 *   llegada es un corte del juego—; `alTerminar` qué ocurre cuando ya no queda ninguna escena
 *   esperando, que es volver al momento en marcha.
 */
export function LlegadaMontada({ llegadas, textos = {}, alCambiar = null, alTerminar = null }) {
  // El visor que quedó a un toque, la capa del descarte y la escena de la primera
  // coincidencia. Ninguna de las tres es un paso, y por eso ninguna vive en el núcleo.
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [descarte, setDescarte] = useState(null);
  const [triangulacion, setTriangulacion] = useState(null);
  // El área que la capa muta no la ve React, así que cada movimiento sube este contador.
  const [paso, repinta] = useState(0);

  const avisa = useCallback(() => {
    repinta((n) => n + 1);
    if (alCambiar) alCambiar();
  }, [alCambiar]);

  /** Avanzar, que es lo único que mueve la secuencia. Cerrada la última, se vuelve a andar. */
  const avanza = useCallback(() => {
    const movido = llegadas.avanza();
    setVisorAbierto(false);
    setDescarte(null);
    avisa();
    if (movido.cerrada && movido.siguiente === null && alTerminar) alTerminar();
    return movido;
  }, [llegadas, avisa, alTerminar]);

  let montaje;
  try {
    montaje = llegadas.montaje();
  } catch (e) {
    return <Averia mensaje={mensajeDeError(e)} />;
  }
  // No queda nada esperando. No es una avería y no se pinta una llegada vacía: quien decide
  // qué momento se monta es `App.js`, y aquí se responde lo que hay.
  if (!montaje) return <Averia mensaje="Aquí no queda nada esperando." />;

  return (
    <View style={estilos.raiz} testID="llegada-montada">
      {/* Cuántas veces se ha movido la secuencia. Sin ella el montaje sería un objeto nuevo
          en cada repintado y no habría manera de saber que se avanzó. */}
      {/* En su propia fila de marcas: vive en otro contenedor que el de la pantalla que
          envuelve, y dos marcas en el mismo punto son dos marcas ilegibles para la
          automatización (§7f, y el arreglo de `marca.js`). */}
      <View testID="llegada-movimientos" accessibilityLabel={String(paso)} style={marcaSuperpuesta(0, { fila: 2 })} />

      <PantallaLlegada
        llegada={montaje.llegada}
        estado={montaje.estado}
        visor={montaje.visor}
        ficha={montaje.ficha}
        loQueSeCuenta={montaje.loQueSeCuenta}
        visorAbierto={visorAbierto}
        alVisor={() => setVisorAbierto(true)}
        alCerrarVisor={() => setVisorAbierto(false)}
        alSeguir={() => {
          // La escena de la primera coincidencia se enseña **al cerrar el paso que la
          // encendió** y no en su lugar: lo que la provoca es que allí te cuenten otra
          // versión, así que primero se lee lo que cuentan.
          if (montaje.triangulacion && triangulacion === null) {
            setTriangulacion(montaje.triangulacion);
            return;
          }
          avanza();
        }}
        alDescartar={() => setDescarte(llegadas.capaDeDescarte(montaje.llegada.sitio))}
        descarte={descarte}
        // El segundo y último toque del gesto: marca y se vuelve a andar. Sin diálogo de
        // confirmación detrás —serían tres toques— y sin línea de gracias.
        alMarcar={(motivo) => {
          llegadas.descarta(montaje.llegada.sitio, motivo ?? null);
          setDescarte(null);
          avanza();
        }}
        // Cerrarla sin marcar devuelve la ficha con todo como estaba, y la elección de
        // motivo se descarta: el que escribe es el segundo toque.
        alCerrarDescarte={() => setDescarte(null)}
      />

      {triangulacion ? (
        <PantallaTriangulacion
          escena={triangulacion}
          textos={textos}
          alApuntarlo={() => {
            llegadas.cierraLaTriangulacion();
            setTriangulacion(null);
            avanza();
          }}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
