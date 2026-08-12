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

import { TAMANO_DE_TEXTO_DE_ORIGEN, siguienteTamanoDeTexto } from '@walkingadventure/nucleo/quests/escena.js';
import { TIPOS_DE_PASO } from '@walkingadventure/nucleo/partida/secuencia.js';

import { mensajeDeError } from '../plataforma/capacidades.js';
import { PantallaEscena } from './escena.js';
import { PantallaLlegada } from './llegada.js';
import { MARCA, capaDeMarcas } from './marca.js';
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
  // El escalón de tamaño de letra de la escena. **Vive lo que dura la sesión**: SPEC-034 lo
  // declara para que la pantalla de ajustes (fila 38) lo consuma tal cual, y persistirlo es de
  // aquella fila. Vive aquí y no dentro de la escena porque el criterio es que al salir de una
  // escena y entrar en otra siga puesto, y cada escena se monta de nuevo.
  const [tamanoDeTexto, setTamanoDeTexto] = useState(TAMANO_DE_TEXTO_DE_ORIGEN);
  // En cuál de las dos mitades del paso de beat va: la escena o lo que te llevas. Vive aquí y
  // no dentro de la escena porque la escena se remonta en cada repintado de este montaje —el
  // componente se inyecta por tipo de paso y se compone de nuevo— y el escalón de tamaño de
  // letra provoca uno: con el estado dentro, agrandar el texto habría devuelto a A4P3.
  const [enLoQueTeLlevas, setEnLoQueTeLlevas] = useState(false);

  const avisa = useCallback(() => {
    repinta((n) => n + 1);
    if (alCambiar) alCambiar();
  }, [alCambiar]);

  /** Avanzar, que es lo único que mueve la secuencia. Cerrada la última, se vuelve a andar. */
  const avanza = useCallback(() => {
    const movido = llegadas.avanza();
    setVisorAbierto(false);
    setDescarte(null);
    setEnLoQueTeLlevas(false);
    avisa();
    if (movido.cerrada && movido.siguiente === null && alTerminar) alTerminar();
    return movido;
  }, [llegadas, avisa, alTerminar]);

  let montaje;
  try {
    montaje = llegadas.montaje({ tamanoDeTexto });
  } catch (e) {
    return <Averia mensaje={mensajeDeError(e)} />;
  }
  // No queda nada esperando. No es una avería y no se pinta una llegada vacía: quien decide
  // qué momento se monta es `App.js`, y aquí se responde lo que hay.
  if (!montaje) return <Averia mensaje="Aquí no queda nada esperando." />;

  // La escena, atada a lo que la capa compuso para este paso. Va aquí y no dentro de un
  // `useMemo` de arriba porque depende del montaje, que se rehace en cada repintado.
  const pantallasPorTipoDePaso = {
    [TIPOS_DE_PASO.BEAT]: ({ alSeguir }) => (
      <PantallaEscena
        escena={montaje.escena}
        loQueTeLlevas={montaje.loQueTeLlevas}
        motivo={montaje.motivoDeEscena}
        // El mismo `alSeguir` que la pantalla encadenada le da a cualquier paso: cerrar el
        // paso es lo único que mueve la secuencia, y no hay una segunda vía desde aquí.
        alSeguir={alSeguir}
        enLoQueTeLlevas={enLoQueTeLlevas}
        alLoQueTeLlevas={() => setEnLoQueTeLlevas(true)}
        // Cada toque avanza un escalón y el texto cambia en el sitio: lo que se recompone es
        // la escena, no la pantalla, y no se sale de ella.
        alCambiarTamano={() => setTamanoDeTexto((vigente) => siguienteTamanoDeTexto(vigente))}
      />
    ),
  };

  return (
    <View style={estilos.raiz} testID="llegada-montada">
      {/* Cuántas veces se ha movido la secuencia. Sin ella el montaje sería un objeto nuevo
          en cada repintado y no habría manera de saber que se avanzó. */}
      {/* En su propia fila de marcas: vive en otro contenedor que el de la pantalla que
          envuelve, así que no puede coordinar su sitio con las de dentro. */}
      <View pointerEvents="none" style={capaDeMarcas(2)}>
        <View testID="llegada-movimientos" accessibilityLabel={String(paso)} style={MARCA} />
      </View>

      <PantallaLlegada
        llegada={montaje.llegada}
        estado={montaje.estado}
        visor={montaje.visor}
        ficha={montaje.ficha}
        loQueSeCuenta={montaje.loQueSeCuenta}
        // La escena del beat, **inyectada por su tipo de paso**: es la puerta que
        // `PantallaLlegada` ya tenía abierta y la que la fila 44 dejó nombrada. No hay ruta a
        // la que ir, así que no hay manera de llegar a A4P3 sin haber llegado al sitio.
        pantallas={pantallasPorTipoDePaso}
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
