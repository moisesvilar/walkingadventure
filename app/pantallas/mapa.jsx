// La pantalla del mapa: la lámina a pantalla completa y los cuatro momentos que
// puede atravesar —sin mapa, levantando, pintado y no se pudo—.
//
// Lo que esta fila decide de la composición es **que no hay nada más en la
// pantalla**: ni barra de pestañas, ni cabecera, ni botones flotantes, ni control de
// zoom, ni botón de centrar, ni leyenda. Acercar y arrastrar son gestos, y el resto
// vive fuera. La composición definitiva de los momentos de antes y de durante es de
// A1P4 y A1P5, de la fila 27; aquí existen en su forma mínima para que el flujo se
// pueda recorrer entero de punta a punta y se pueda medir el minuto.
//
// La pantalla no genera, no consulta y no guarda por su cuenta: todo eso se lo pide
// a la orquestación, que llega inyectada. Lo único suyo son los gestos y el momento
// en el que está.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';

import { mensajeDeError } from '../plataforma/capacidades.js';
import { acerca, arrastra, normaliza, vistaDe } from '../mapa/camara.js';
import { FASES } from '../mapa/fases.js';
import { Lamina } from '../render/lamina.jsx';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';

/**
 * Los literales de los momentos que no son la lámina. Van en voz de mundo y
 * **ninguno nombra la red, ni el servidor, ni un código de error**: eso no es
 * registro, es información que nadie puede usar.
 */
export const TEXTOS = Object.freeze({
  sinMapa: 'Aquí todavía no hay nada dibujado.',
  levantar: 'Levantar el mapa aquí',
  levantando: 'El mundo se está poniendo en su sitio.',
  noSePudo: 'Hoy no se puede levantar el mapa aquí.',
  otraVez: 'Probar otra vez',
});

/** La separación entre dos dedos. El ángulo no se calcula: la cámara no tiene rotación. */
function separacion(toques) {
  const [a, b] = toques;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * @param {object} props
 *   `levantamiento` la orquestación, ya cableada; `enlace` el enlace con Skia;
 *   `cronometro` el que mide el minuto; `tamano` el hueco de la lámina; `punto` la
 *   coordenada confirmada; `semilla` la de la partida; `tramoM` el tramo declarado;
 *   `estilo` cómo se pinta; `mapaId` el mapa ya levantado que hay que abrir, si lo hay.
 */
export function PantallaMapa({
  levantamiento,
  enlace,
  cronometro,
  tamano,
  punto,
  semilla,
  tramoM,
  estilo = ESTILO_POR_DEFECTO,
  factorTexto = 1,
  mapaId = null,
}) {
  const [momento, setMomento] = useState(mapaId ? 'levantando' : 'sin-mapa');
  const [resultado, setResultado] = useState(null);
  const [camara, setCamara] = useState(null);
  const [seguimiento, setSeguimiento] = useState({ enCurso: null, completadas: [] });
  const [medida, setMedida] = useState(null);
  const [fallo, setFallo] = useState(null);

  // La cámara se lee desde el gesto, que corre fuera del ciclo de repintado: sin la
  // referencia, cada arrastre partiría del encuadre con el que se montó el gesto.
  const camaraRef = useRef(null);
  camaraRef.current = camara;
  const documento = resultado ? resultado.documento : null;

  /** Abrir un mapa ya levantado: **no toca la red**, y la orquestación no le da con qué. */
  useEffect(() => {
    if (!mapaId) return undefined;
    let vivo = true;
    levantamiento.abre({ id: mapaId, semilla, tamano, estilo, factorTexto })
      .then((abierto) => {
        if (!vivo) return;
        setResultado(abierto);
        setCamara(abierto.camara);
        setMomento('pintado');
      })
      .catch((e) => {
        if (!vivo) return;
        setFallo(mensajeDeError(e));
        setMomento('no-se-pudo');
      });
    return () => { vivo = false; };
  }, [mapaId, semilla, tamano, estilo, factorTexto, levantamiento]);

  const levanta = useCallback(async () => {
    setFallo(null);
    setMedida(null);
    setSeguimiento({ enCurso: null, completadas: [] });
    setMomento('levantando');
    try {
      const levantado = await levantamiento.levanta({
        lat: punto.lat, lon: punto.lon, semilla, tramoM, tamano, estilo, factorTexto,
        onFases: (estado) => setSeguimiento({ enCurso: estado.enCurso, completadas: estado.completadas }),
      });
      setResultado(levantado);
      setCamara(levantado.camara);
      setMomento('pintado');
    } catch (e) {
      // El motivo del fallo se guarda para el diagnóstico y **no se enseña**: lo que
      // se lee es la línea en voz de mundo, y la misma acción para volver a intentarlo.
      setFallo(mensajeDeError(e));
      setMomento('no-se-pudo');
    }
  }, [levantamiento, punto, semilla, tramoM, tamano, estilo, factorTexto]);

  /**
   * El enlace con el pintado medido. Se envuelve `creaCuadro` y nada más: es la
   * llamada que graba el cuadro de Skia, o sea el pintado de verdad, y medirla ahí
   * es lo que hace que el reparto del minuto acuse a la fila 21 solo de lo suyo.
   *
   * Fuera de un levantamiento no hay minuto que medir —abrir un mapa que ya estaba
   * no gasta presupuesto— y entonces se pinta sin cronometrar, que es distinto de
   * cronometrar mal.
   */
  const enlaceMedido = useMemo(() => ({
    ...enlace,
    creaCuadro: (pintaCuadro) => (cronometro.enMarcha()
      ? cronometro.mideSincrono('pintado', () => enlace.creaCuadro(pintaCuadro))
      : enlace.creaCuadro(pintaCuadro)),
  }), [enlace, cronometro]);

  // El minuto se cierra cuando la lámina está pintada, no cuando el documento existe.
  useEffect(() => {
    if (momento !== 'pintado' || !resultado || !resultado.generada || medida || !cronometro.enMarcha()) return;
    cronometro.para();
    setMedida(cronometro.medida({ coordenada: `${punto.lat},${punto.lon}`, cacheFria: null }));
  }, [momento, resultado, medida, cronometro, punto]);

  /**
   * Los gestos. Arrastrar mueve la cámara y acercar cambia la escala; **el gesto de
   * rotación no encuentra nada que mover y no ocurre nada**, sin animación de
   * rechazo, porque una animación de rechazo es la app hablando.
   */
  const gesto = useRef({ base: null, sep: 0 });
  const gestos = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { gesto.current = { base: camaraRef.current, sep: 0 }; },
    onPanResponderMove: (evento, estado) => {
      const base = gesto.current.base;
      if (!base || !documento) return;
      const toques = evento.nativeEvent.touches ?? [];
      if (toques.length >= 2) {
        const ahora = separacion(toques);
        if (!gesto.current.sep) {
          gesto.current = { base: camaraRef.current, sep: ahora };
          return;
        }
        setCamara(acerca(gesto.current.base, ahora / gesto.current.sep, documento));
        return;
      }
      setCamara(arrastra(base, { dxPx: estado.dx, dyPx: estado.dy, tamano, documento }));
    },
    onPanResponderRelease: () => {
      gesto.current = { base: null, sep: 0 };
      if (resultado && camaraRef.current) {
        // La cámara se guarda **fuera** de los documentos del mapa: mover el encuadre
        // no puede tocar ni un byte del mundo congelado.
        levantamiento.guardaCamara({ mapaId: resultado.mapaId, clave: resultado.clave, camara: camaraRef.current }).catch(() => {});
      }
    },
  }), [documento, tamano, resultado, levantamiento]);

  const camaraNormal = camara && documento ? normaliza(camara, documento) : null;
  const vista = camaraNormal ? vistaDe(camaraNormal) : null;

  return (
    <View style={estilos.raiz} testID="mapa-pantalla">
      <View testID="mapa-estado" accessibilityLabel={momento} style={estilos.marca} />

      {momento === 'sin-mapa' ? (
        <View style={estilos.momento}>
          <Text style={estilos.frase}>{TEXTOS.sinMapa}</Text>
          <Pressable testID="levantar-mapa" onPress={levanta} style={estilos.accion}>
            <Text style={estilos.accionTexto}>{TEXTOS.levantar}</Text>
          </Pressable>
        </View>
      ) : null}

      {momento === 'levantando' ? (
        <View style={estilos.momento}>
          <Text style={estilos.frase}>{TEXTOS.levantando}</Text>
          {/* Una línea por fase, con marca de completada. Ni barra, ni porcentaje, ni
              contador, ni estimación de segundos. */}
          <View testID="generacion-fases">
            {FASES.map((fase) => (
              <Text
                key={fase.id}
                testID={`fase-${fase.id}`}
                accessibilityLabel={seguimiento.completadas.includes(fase.id) ? 'completada' : fase.id === seguimiento.enCurso ? 'en-curso' : 'pendiente'}
                style={[estilos.fase, seguimiento.completadas.includes(fase.id) && estilos.faseHecha]}
              >
                {fase.texto}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {momento === 'no-se-pudo' ? (
        <View style={estilos.momento} testID="mapa-no-se-pudo">
          <Text style={estilos.frase}>{TEXTOS.noSePudo}</Text>
          <Pressable testID="levantar-mapa" onPress={levanta} style={estilos.accion}>
            <Text style={estilos.accionTexto}>{TEXTOS.otraVez}</Text>
          </Pressable>
          {/* El motivo no se pinta: viaja como marca para el diagnóstico y para la
              batería, y lo que se lee sigue sin nombrar la red. */}
          <View testID="mapa-motivo" accessibilityLabel={fallo ?? ''} style={estilos.marca} />
        </View>
      ) : null}

      {momento === 'pintado' && documento && vista ? (
        // El contenedor de los gestos: de borde a borde y sin nada encima. La lámina
        // vuelve a componer la escena que la orquestación ya compuso para medirla —es
        // pura y memoizada, así que repetirla no cambia ni un píxel—.
        <View style={estilos.lamina} testID="mapa-lamina" {...gestos.panHandlers}>
          <Lamina
            documento={documento}
            estilo={estilo}
            vista={vista}
            tamano={tamano}
            factorTexto={factorTexto}
            enlace={enlaceMedido}
          />
          <View testID="mapa-camara" accessibilityLabel={`${camaraNormal.cx},${camaraNormal.cy},${camaraNormal.r},${tamano.ancho}x${tamano.alto}`} style={estilos.marca} />
          <View testID="mapa-jugable" accessibilityLabel={resultado.jugable ? 'jugable' : resultado.carencias.join(' ')} style={estilos.marca} />
          {medida ? (
            <View testID="mapa-minuto" accessibilityLabel={JSON.stringify(medida)} style={estilos.marca} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  lamina: { flex: 1 },
  momento: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  frase: { fontFamily: 'serif', fontSize: 20, color: TINTA, lineHeight: 28 },
  accion: { marginTop: 24, alignSelf: 'flex-start' },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA, textDecorationLine: 'underline' },
  fase: { fontFamily: 'serif', fontSize: 17, color: TINTA, opacity: 0.5, marginTop: 10 },
  faseHecha: { opacity: 1 },
  // Marcas de estado para la batería: ocupan cero y no se ven.
  marca: { position: 'absolute', width: 0, height: 0 },
});
