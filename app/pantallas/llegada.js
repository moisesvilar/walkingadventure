// El encadenado de una llegada en la app: monta el paso vigente y **no permite saltar**.
//
// No es un enrutador y no lo va a ser. La secuencia es un dato del núcleo —una lista
// ordenada de `{ tipo, modo }` que entrega `partida/secuencia.js`— y aquí solo se mira
// por cuál va y se monta esa pantalla. Tres cosas que eso compra, y son la razón:
//
// - **No hay ruta a la que ir**, así que no hay manera de llegar a A4P5 sin haber llegado
//   al núcleo. Cuatro rutas habrían dejado esa puerta abierta.
// - **Ninguna de las pantallas encadenadas sabe si es la primera visita ni si hay beat**:
//   cada una recibe qué paso es. Sin esto, la regla del orden acabaría escrita cuatro
//   veces, que es exactamente cómo se desincronizan.
// - **La app cerrada a mitad de secuencia continúa donde iba**, porque el paso vigente es
//   estado y no una posición en una pila.
//
// El único control de cada paso es su propia acción de seguir, y la dibuja la fila dueña
// de esa pantalla. Aquí no hay barra, ni flecha de atrás entre pasos, ni manera de saltar
// al siguiente ni de volver al anterior.
//
// Y por eso el paso vigente se monta tal cual llega, sin mirar su modo: **el núcleo no
// entrega nunca un paso a un toque como vigente**. Lo que está a un toque se pinta aquí
// como lo que es —el acceso de arriba, que espera un dedo— y montarlo además como paso
// vigente sería abrirlo solo, que es lo que la segunda visita no puede hacer.
//
// **El visor es una capa y no un paso**, y aquí es donde eso deja de ser una frase: cuando
// el paso vigente es el visor, lo que se monta debajo es ya el paso siguiente —el beat, la
// ficha, lo que aquí se cuenta— y el visor va encima. Cerrarlo no lleva a ningún sitio:
// deja a la vista lo que ya estaba. Por eso cerrar es la única acción que el visor añade,
// y existe igual cuando el visor no está.
//
// La pantalla de la escena (A4P3, A4P4) es de la fila 34 y **no está en disco**: entra
// inyectada por su tipo de paso, y mientras no exista se monta el hueco con el paso
// nombrado, en lugar de saltar el paso en silencio.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MODOS, TIPOS_DE_PASO } from '@walkingadventure/nucleo/partida/secuencia.js';
import { TEXTOS as TEXTOS_DEL_VISOR } from '@walkingadventure/nucleo/partida/visor.js';

import { CapaDescarte } from './descarte.jsx';
import { PantallaFicha } from './ficha.js';
import { PantallaLoQueSeCuenta } from './lo-que-se-cuenta.js';
import { PantallaVisor } from './visor.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/** Lo que se dice de un paso cuya pantalla todavía no existe. Nunca se salta un paso. */
export const TEXTOS = Object.freeze({
  sinPantalla: 'Esto todavía no está dibujado.',
  seguir: 'Seguir',
  nada: 'Aquí no queda nada esperando.',
});

/** La lista de tipos y modos de la secuencia, para poder afirmar el orden de un vistazo. */
export function etiquetaDeSecuencia(secuencia) {
  return secuencia.map((paso) => `${paso.tipo}:${paso.modo}`).join(',');
}

/** El primer paso encadenado desde `desde`, o `null` si por delante no queda ninguno. */
function encadenadoDesde(secuencia, desde) {
  for (let i = desde; i < secuencia.length; i++) {
    if (secuencia[i].modo === MODOS.ENCADENADO) return { ...secuencia[i], indice: i };
  }
  return null;
}

/**
 * @param {object} props
 *   `llegada` la escena que espera, tal cual la entrega `creaLlegadas().espera()`;
 *   `estado` el estado del momento que resuelve `partida/visor.js`, del vocabulario
 *   cerrado `visor` · `visor-sin-foto` · `ficha` · `visor-a-un-toque`;
 *   `visor` la descripción del visor ya compuesta, o `null` si este sitio no tiene;
 *   `ficha` la ficha de texto ya compuesta, o `null`;
 *   `loQueSeCuenta` la parte `pantalla` de `loQueAquiSeCuenta(...)`, que es lo que compone
 *   A4P5 cuando el paso vigente es el suyo;
 *   `pantallas` las de la fila 34, por tipo de paso; `alSeguir` avanzar al siguiente paso
 *   —lo único que mueve la secuencia—; `alVisor` abrir el visor que quedó a un toque, que
 *   **no se abre solo**; `visorAbierto` si esa capa está puesta ahora mismo; `alCerrarVisor`
 *   quitarla; `alDescartar` el sitio donde se toca «Este sitio no pega»; `descarte` la
 *   capa de A4P8 ya compuesta cuando está puesta, o `null` cuando no; `alMarcar` el
 *   segundo y último toque del gesto, que recibe el motivo elegido o `null`;
 *   `alCerrarDescarte` volver a la ficha sin marcar nada.
 *
 * No hay ninguna propiedad para ir a un paso concreto, y su ausencia es la pieza.
 */
export function PantallaLlegada({
  llegada,
  estado = null,
  visor = null,
  ficha = null,
  loQueSeCuenta = null,
  pantallas = {},
  alSeguir = null,
  alVisor = null,
  visorAbierto = false,
  alCerrarVisor = null,
  alDescartar = null,
  descarte = null,
  alMarcar = null,
  alCerrarDescarte = null,
}) {
  if (!llegada) {
    return (
      <View style={estilos.raiz} testID="llegada">
        <Text style={estilos.mundo}>{TEXTOS.nada}</Text>
      </View>
    );
  }

  const vigente = llegada.vigente;
  const aUnToque = llegada.secuencia.find((paso) => paso.modo === MODOS.A_UN_TOQUE) ?? null;

  // El visor encadenado no tapa un paso pendiente: el paso de debajo es el siguiente, y
  // ya está montado mientras la capa está puesta. Cerrarla lo deja a la vista.
  const enVisor = !!vigente && vigente.tipo === TIPOS_DE_PASO.VISOR;
  const debajo = enVisor ? encadenadoDesde(llegada.secuencia, vigente.indice + 1) : vigente;
  const capaPuesta = !!visor && (enVisor || visorAbierto);
  const Pantalla = debajo ? pantallas[debajo.tipo] ?? null : null;

  return (
    <View style={estilos.raiz} testID="llegada">
      <View testID="momento-estado" accessibilityLabel="al-parar" style={estilos.marca} />
      <View testID="llegada-estado" accessibilityLabel={estado ?? 'sin-resolver'} style={estilos.marca} />
      <View testID="llegada-secuencia" accessibilityLabel={etiquetaDeSecuencia(llegada.secuencia)} style={estilos.marca} />
      <View testID="llegada-paso" accessibilityLabel={debajo ? debajo.tipo : 'cerrada'} style={estilos.marca} />

      {aUnToque ? (
        <Pressable testID="visor-a-un-toque" onPress={alVisor} style={estilos.aUnToque}>
          <Text testID="visor-abrir" style={estilos.aUnToqueTexto}>{`${TEXTOS_DEL_VISOR.volverAMirar} ${llegada.sitio}`}</Text>
        </Pressable>
      ) : null}

      {debajo && debajo.tipo === TIPOS_DE_PASO.LO_QUE_SE_CUENTA && loQueSeCuenta ? (
        <PantallaLoQueSeCuenta loQueSeCuenta={loQueSeCuenta} alSeguir={alSeguir} />
      ) : debajo && debajo.tipo === TIPOS_DE_PASO.FICHA && ficha ? (
        <PantallaFicha ficha={ficha} alSeguir={alSeguir} alDescartar={alDescartar} />
      ) : debajo && Pantalla ? (
        <Pantalla paso={debajo} sitio={llegada.sitio} alSeguir={alSeguir} />
      ) : debajo ? (
        <View style={estilos.hueco}>
          <Text style={estilos.mundo}>{TEXTOS.sinPantalla}</Text>
          <Pressable testID="llegada-seguir" onPress={alSeguir} style={estilos.accion}>
            <Text style={estilos.accionTexto}>{TEXTOS.seguir}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={estilos.mundo}>{TEXTOS.nada}</Text>
      )}

      {capaPuesta ? <PantallaVisor visor={visor} alCerrar={enVisor ? alSeguir : alCerrarVisor} /> : null}

      {/* A4P8, encima de la ficha y no en su lugar: la ficha sigue montada debajo, así
          que cerrar la capa la devuelve con todo como estaba. */}
      {descarte ? <CapaDescarte capa={descarte} alMarcar={alMarcar} alCerrar={alCerrarDescarte} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: { width: 0, height: 0 },
  hueco: { flex: 1, padding: 28, justifyContent: 'center', gap: 24 },
  mundo: { fontFamily: 'serif', fontSize: 20, lineHeight: 30, color: TINTA },
  aUnToque: { paddingHorizontal: 28, paddingTop: 24 },
  aUnToqueTexto: { fontFamily: 'serif', fontSize: 15, color: LAPIZ },
  accion: { paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
