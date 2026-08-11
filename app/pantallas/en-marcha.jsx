// A3P2, A3P3, A3P5 y A3P6 · En marcha: la lámina a sangre, la marca roja de la posición,
// las marcas de aviso y el zócalo. Es la pantalla que está diseñada para no mirarse.
//
// La pantalla **no decide nada y sobre todo no añade nada**: qué elementos hay, qué dice
// el zócalo, qué marcas se ponen y qué sitios van rotulados sale entero de
// `partida/en-marcha.js`. Aquí solo se dibuja lo que esa composición declara, y por eso
// las ausencias que este momento defiende —ni un control tocable, ni una cifra de
// esfuerzo, ni un botón de aceptar— se afirman contra el vocabulario cerrado del núcleo y
// no mirando un simulador que no existe (`pipeline/decisiones-orquestador.md` §6o).
//
// Tres cosas de esta capa que sí son decisiones de dibujo, y las tres son ausencias:
//
// - **Ni un `Pressable`.** No hay uno escondido ni uno desactivado: no se importa. Lo
//   único tocable en marcha vive en la pantalla de bloqueo y es del sistema.
// - **Acercar y arrastrar siguen aquí.** Un gesto no es un control —no hay nada que
//   pulsar por error y nada que se pueda aceptar—, y quitarlos sería una excepción
//   respecto a SPEC-026 que habría que explicar dentro del juego.
// - **La lámina ocupa la pantalla entera**, sin cabecera, sin pie y sin nada encima.

import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';

import { acerca, arrastra, normaliza, pixelDeMundo, vistaDe } from '../mapa/camara.js';
import { marcaSuperpuesta } from './marca.js';

/** El tamaño de la marca de posición, en px. La marca de aviso es algo menor. */
const MARCA_POSICION_PX = 14;
const MARCA_AVISO_PX = 10;

/**
 * Desde qué número de orden se apartan las marcas del aviso.
 *
 * Las marcas superpuestas de esta pantalla se numeran 0..4 y luego una por sitio rotulado,
 * que son tantas como sitios tenga la aventura. Las dos del aviso empiezan por encima de
 * cualquier lazo imaginable para no tener que contar sitios: dos marcas en el mismo punto
 * son dos marcas que Maestro no puede leer, y esa cuenta no puede depender del mundo.
 */
const MARCA_DEL_AVISO = 64;

/**
 * Dónde se pinta la marca, en píxeles de la lámina. Se recorta al borde de la pantalla en
 * lugar de dejarla salir: quien arrastra el mapa lejos sigue viendo por qué lado queda, y
 * una marca fuera del hueco es indistinguible de una marca que no está.
 */
function enPantalla(camara, tamano, punto) {
  const p = pixelDeMundo(camara, tamano, punto);
  const dentro = (v, tope) => Math.max(0, Math.min(tope - MARCA_POSICION_PX, v - MARCA_POSICION_PX / 2));
  return { left: dentro(p.x, tamano.ancho), top: dentro(p.y, tamano.alto) };
}

/** La separación entre dos dedos. El ángulo no se calcula: la cámara no tiene rotación. */
function separacion(toques) {
  const [a, b] = toques;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * @param {object} props
 *   `momento` lo que devuelve `componeEnMarcha`; `documento` el mundo congelado de la
 *   celda; `camara` el encuadre inicial, con el norte arriba; `tamano` el hueco entero de
 *   la pantalla; `Lamina` la lámina inyectada, para que esta pantalla se pueda montar sin
 *   Skia; `aviso` el último aviso emitido, con sus capas, tal y como lo dejó el emisor.
 */
export function PantallaEnMarcha({
  momento,
  documento,
  camara: camaraInicial = null,
  tamano,
  estilo = ESTILO_POR_DEFECTO,
  factorTexto = 1,
  enlace = null,
  Lamina = null,
  aviso = null,
}) {
  const [camara, setCamara] = useState(camaraInicial);
  const camaraRef = useRef(camaraInicial);
  camaraRef.current = camara;

  /**
   * Los gestos, heredados de SPEC-026. **No hay ninguno que acepte nada**: arrastrar
   * mueve el encuadre, acercar cambia la escala, y el gesto de rotación no encuentra
   * nada que mover porque el norte va arriba siempre.
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
    onPanResponderRelease: () => { gesto.current = { base: null, sep: 0 }; },
    onPanResponderTerminate: () => { gesto.current = { base: null, sep: 0 }; },
  }), [documento, tamano]);

  const zocalo = momento.zocalo;
  // La cámara se normaliza antes de mirarla: el encuadre no se sale del mundo por
  // arrastrar, y sigue sin rotación porque el norte va arriba siempre.
  const camaraNormal = camara && documento ? normaliza(camara, documento) : null;
  const vista = camaraNormal ? vistaDe(camaraNormal) : null;

  return (
    <View style={estilos.raiz} testID="en-marcha" {...gestos.panHandlers}>
      {/* El estado del momento y sus dos enumeraciones. `en-marcha-tocables` existe para
          poder afirmar que está vacío: es el criterio más importante de esta pantalla. */}
      <View testID="momento-en-marcha" style={marcaSuperpuesta(0)} />
      <View testID="en-marcha-elementos" accessibilityLabel={momento.elementos.join(',')} style={marcaSuperpuesta(1)} />
      <View testID="en-marcha-tocables" accessibilityLabel={momento.tocables.join(',')} style={marcaSuperpuesta(2)} />
      <View testID="en-marcha-orientacion" accessibilityLabel={momento.orientacion} style={marcaSuperpuesta(3)} />

      {/* La lámina a sangre, de borde a borde y sin nada encima. El envoltorio existe solo
          para llevar el identificador que la spec declara: es el mismo `mapa-lamina` de
          SPEC-026, y desde el dispositivo es lo único de esta fila que no se puede afirmar
          sin él, porque «de borde a borde» es propiedad del hueco real. */}
      {Lamina && documento ? (
        <View testID="mapa-lamina">
          <Lamina
            documento={documento}
            estilo={estilo}
            vista={vista}
            tamano={tamano}
            factorTexto={factorTexto}
            enlace={enlace}
          />
        </View>
      ) : null}
      {camaraNormal ? (
        <View testID="mapa-camara" accessibilityLabel={`${camaraNormal.cx},${camaraNormal.cy},${camaraNormal.r},${tamano.ancho}x${tamano.alto}`} style={marcaSuperpuesta(4)} />
      ) : null}

      {/* La marca de posición: roja, del propio mapa, y no un punto de sistema. Sin
          posición legible no se pinta y el mapa se queda como estaba; ninguna línea lo
          cuenta como avería del mundo.
          **Va en el sitio del mundo donde estás y no en el centro de la pantalla**: lo que
          se mueve durante una salida es la marca, y una marca clavada en el centro haría
          que moverse se viera igual que estar quieta. La etiqueta lleva el punto en metros
          del mundo para poder leerlo moverse sin mirar la pantalla. */}
      {momento.marcaPosicion.punto && camaraNormal ? (
        <View
          testID="marca-posicion"
          accessibilityLabel={`${momento.marcaPosicion.delMapa ? 'del-mapa' : 'de-sistema'}:${Math.round(momento.marcaPosicion.punto.x)},${Math.round(momento.marcaPosicion.punto.y)}:${momento.marcaPosicion.clasificacion ?? 'sin-clasificar'}`}
          style={[
            estilos.marcaPosicion,
            enPantalla(camaraNormal, tamano, momento.marcaPosicion.punto),
            { backgroundColor: momento.marcaPosicion.color },
          ]}
        />
      ) : null}

      {/* Una marca por aviso, sobre su sitio y solo ahí. Sigue puesta si no se mira. */}
      {momento.marcasDeAviso.map((marca) => (
        <View
          key={`${marca.tipo ?? 'aviso'}:${marca.sitio}`}
          testID="marca-aviso"
          accessibilityLabel={`${marca.tipo ?? 'aviso'}:${marca.sitio}`}
          style={[estilos.marcaAviso, { backgroundColor: momento.marcaPosicion.color }]}
        />
      ))}

      {/* Los sitios a los que la aventura manda, rotulados aunque no se hayan pisado. */}
      {momento.rotulados.map((sitio, i) => (
        <View key={sitio.nombre} testID="sitio-rotulado" accessibilityLabel={`${sitio.nombre}:${sitio.encargado ? 'encargado' : 'pisado'}`} style={marcaSuperpuesta(5 + i)} />
      ))}

      {/* El último aviso emitido y las capas por las que salió, con las que faltaron.
          Va en el dato y **no se cuenta en pantalla**: una capa caída no es una línea que
          leer andando, es algo que hay que poder inspeccionar después. */}
      {aviso ? (
        <>
          <View testID="aviso-emitido" accessibilityLabel={`${aviso.tipo}:${aviso.emitido ? 'si' : 'no'}`} style={marcaSuperpuesta(MARCA_DEL_AVISO)} />
          <View
            testID="aviso-capas"
            accessibilityLabel={`salieron=${aviso.capas.salieron.join('|')};faltaron=${aviso.capas.faltaron.map((f) => `${f.capa}:${f.motivo}`).join('|')}`}
            style={marcaSuperpuesta(MARCA_DEL_AVISO + 1)}
          />
        </>
      ) : null}

      {/* El zócalo: dos líneas al pie y un solo contenido a la vez. Cuando no hay nada
          que decir no está, que es la salida sin aventura aceptada. */}
      {zocalo ? (
        <View testID="zocalo" accessibilityLabel={zocalo.clase} style={estilos.zocalo}>
          {/* En la noticia la línea pequeña va debajo de la grande; en las demás, encima.
              Es lo único que esta pantalla decide del zócalo, y es pintado. */}
          {zocalo.clase === 'noticia' ? (
            <>
              <Text testID="zocalo-texto" style={estilos.zocaloTexto}>{zocalo.texto}</Text>
              <Text testID="zocalo-antetitulo" style={estilos.zocaloAntetitulo}>{zocalo.antetitulo}</Text>
            </>
          ) : (
            <>
              <Text testID="zocalo-antetitulo" style={estilos.zocaloAntetitulo}>{zocalo.antetitulo}</Text>
              <Text testID="zocalo-texto" style={estilos.zocaloTexto}>{zocalo.texto}</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#6b6250';

const estilos = StyleSheet.create({
  // A sangre: la lámina ocupa la pantalla entera y no hay cabecera ni pie que la recorte.
  raiz: { flex: 1, backgroundColor: TINTA },
  // Sin `left`/`top` aquí: los pone `enPantalla` con el punto del mundo de cada momento.
  marcaPosicion: {
    position: 'absolute',
    width: MARCA_POSICION_PX,
    height: MARCA_POSICION_PX,
    borderRadius: MARCA_POSICION_PX / 2,
    borderWidth: 2,
    borderColor: PLACA,
  },
  marcaAviso: {
    position: 'absolute',
    width: MARCA_AVISO_PX,
    height: MARCA_AVISO_PX,
    borderRadius: MARCA_AVISO_PX / 2,
    opacity: 0.9,
  },
  // Dos líneas al pie, sobre placa de pergamino. Sin acciones, sin icono y sin flecha.
  zocalo: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: PLACA, paddingHorizontal: 20, paddingVertical: 14 },
  zocaloAntetitulo: { fontSize: 13, color: LAPIZ, letterSpacing: 0.6 },
  zocaloTexto: { fontSize: 21, color: TINTA, lineHeight: 27 },
});
