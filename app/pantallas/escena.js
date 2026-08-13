// A4P3 y A4P4 · La escena de un beat y lo que te llevas. Las dos pantallas que SPEC-034
// entregó compuestas y sin dibujar.
//
// **Aquí no se decide nada y no se redacta ni una línea.** El nombre de fantasía del sitio,
// el titular del tipo de escena, la línea que sitúa, el cuerpo, el cierre por resultado, el
// verbo de la única acción y lo que te llevas los compone `packages/nucleo/quests/escena.js`;
// esta capa los pinta y no añade ninguna palabra suya, tampoco en la avería.
//
// Cuatro reglas de dibujo, y las cuatro son del diseño:
//
// - **Una sola acción, con el verbo de lo que se hace.** Nunca «Continuar»: sería un botón de
//   aplicación y desperdiciaría la única línea de acción que tiene la pantalla (`quests.md`
//   §2, y exclusión 9 del PRD para la ausencia de la segunda).
// - **Ni flecha de volver, ni barra, ni indicador de por dónde vas.** La secuencia encadena y
//   no se navega: una vuelta atrás dejaría un beat a medio resolver, que es un estado que el
//   motor no tiene.
// - **Sin retrato de la cara** (exclusión 6 del PRD): el nombre y el puesto en una línea, y
//   el parlamento entrecomillado debajo. Sin cara el bloque no existe, el cuerpo se pinta como
//   párrafo y ningún otro elemento cambia de sitio.
// - **El único registro de aplicación es el tamaño de letra**, y es un toque cíclico y no un
//   panel: el modo compañía es texto para leerse en voz alta (`personaje.md` §4), y un panel
//   convertiría el único elemento de aplicación tolerado en una pantalla de ajustes dentro del
//   juego. Su etiqueta no menciona accesibilidad, ni dificultad de lectura, ni ningún modo.
//
// Y la franja no se anuncia y el objeto-llave tampoco: lo único que cambia entre una variante
// y otra es qué texto se lee, así que aquí no hay ni reloj, ni candado, ni lista de requisitos
// que dibujar — no llegan.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ESTADOS_DE_ESCENA, TESTIDS, TEXTOS_DEL_TAMANO, factorDeTamano } from '@walkingadventure/nucleo/quests/escena.js';

import { MARCA, capaDeMarcas } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/** El renglón de detalle de lo que se lleva: el objeto si lo hay, y su clase si no. */
function loQueSeLleva(seLleva) {
  return seLleva.objeto ?? seLleva.tipo;
}

/**
 * @param {object} props
 *   `escena` lo que devuelve `componeEscena`, o `null`; `loQueTeLlevas` lo que devuelve
 *   `componeLoQueTeLlevas`, o `null`; `motivo` el motivo literal cuando la escena no se pudo
 *   componer —un beat nulo o recortado, el reloj sin cablear, la tenencia sin cablear—;
 *   `alSeguir` cerrar el paso del beat, que es lo único que mueve la secuencia;
 *   `alCambiarTamano` avanzar un escalón de la escala, que recompone la escena en el sitio;
 *   `enLoQueTeLlevas` en cuál de las dos mitades del paso va, y `alLoQueTeLlevas` pasar a la
 *   segunda. **Las dos son del paso y no de esta pantalla**: A4P3 y A4P4 son el mismo paso de
 *   la secuencia —lo que el estado guarda es el paso, no en qué mitad de él estás— y quien
 *   monta el paso es quien puede garantizar que cambiar el tamaño de letra no lo reinicia.
 */
export function PantallaEscena({
  escena = null,
  loQueTeLlevas = null,
  motivo = null,
  alSeguir = null,
  alCambiarTamano = null,
  enLoQueTeLlevas = false,
  alLoQueTeLlevas = null,
}) {

  // La avería con su motivo literal, **y con la acción que cierra el paso**. Enseñarla sin
  // acción dejaría la app encallada dentro de una salida abierta, y saltar el paso en silencio
  // es justo lo que `pipeline/decisiones-orquestador.md` §6h persigue.
  if (motivo !== null || !escena) {
    return (
      <View style={estilos.raiz} testID="escena-sin-cablear">
        <View pointerEvents="none" style={capaDeMarcas(3)}>
          <View testID={TESTIDS.estado} accessibilityLabel={ESTADOS_DE_ESCENA[2]} style={MARCA} />
        </View>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.averia}>{motivo ?? ''}</Text>
        </ScrollView>
        <Pressable testID={TESTIDS.accion} onPress={alSeguir} style={estilos.accion}>
          <Text style={estilos.accionTexto}>{escena?.accion?.verbo ?? loQueTeLlevas?.accion?.verbo ?? ''}</Text>
        </Pressable>
      </View>
    );
  }

  const factor = factorDeTamano(escena.tamanoDeTexto);
  const escala = (base) => Math.round(base * factor);

  if (enLoQueTeLlevas && loQueTeLlevas) {
    return (
      <View style={estilos.raiz} testID={TESTIDS.loQueTeLlevas}>
        <View pointerEvents="none" style={capaDeMarcas(3)}>
          <View testID={TESTIDS.estado} accessibilityLabel={loQueTeLlevas.estado} style={MARCA} />
        </View>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.rotulo}>{loQueTeLlevas.rotulo}</Text>
          <Text style={[estilos.titular, { fontSize: escala(26), lineHeight: escala(34) }]}>{loQueSeLleva(loQueTeLlevas.seLleva)}</Text>
          {loQueTeLlevas.empuje ? (
            <Text style={[estilos.mundo, { fontSize: escala(20), lineHeight: escala(30) }]}>{loQueTeLlevas.empuje}</Text>
          ) : null}
          {/* El sitio siguiente, con su línea de calzadas y su marca. En el último beat de la
              cadena no existe, y la acción es la misma. Un tramo sin nombre propio simplemente
              no se nombra: aquí no hay ninguna línea que lo llame falta. */}
          {loQueTeLlevas.siguienteSitio ? (
            <View testID={TESTIDS.siguienteSitio} accessibilityLabel={loQueTeLlevas.siguienteSitio.nombre}>
              <Text style={[estilos.siguiente, { fontSize: escala(22), lineHeight: escala(30) }]}>{loQueTeLlevas.siguienteSitio.nombre}</Text>
              {loQueTeLlevas.siguienteSitio.calzadas.filter(Boolean).length ? (
                <Text style={[estilos.calzadas, { fontSize: escala(15) }]}>{loQueTeLlevas.siguienteSitio.calzadas.filter(Boolean).join(' · ')}</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        <Pressable testID={TESTIDS.accion} onPress={alSeguir} style={estilos.accion}>
          <Text style={estilos.accionTexto}>{loQueTeLlevas.accion.verbo}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.raiz} testID={TESTIDS.escena}>
      <View pointerEvents="none" style={capaDeMarcas(3)}>
        <View testID={TESTIDS.estado} accessibilityLabel={escena.estado} style={MARCA} />
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.sitio}>{escena.sitio}</Text>
        <Text style={[estilos.titular, { fontSize: escala(26), lineHeight: escala(34) }]}>{escena.titular}</Text>
        {escena.situacion ? (
          <Text style={[estilos.mundo, { fontSize: escala(20), lineHeight: escala(30) }]}>{escena.situacion}</Text>
        ) : null}

        {/* Quien habla: una línea, en versalitas y **sin retrato**. Sin cara este bloque no
            existe y el cuerpo baja a ocupar su sitio, sin mover nada más.

            El puesto llega ya dicho **con palabras del mundo** —«al frente», «del
            vecindario»— porque lo compone el paquete desde la declaración que vive junto a
            la plantilla de puestos: aquí no se traduce nada, y la clave interna no llega a
            esta línea ni por descuido. Y esta línea **no escala** con el tamaño de letra:
            es un rótulo, no prosa. */}
        {escena.cara ? (
          <Text testID={TESTIDS.cara} style={estilos.cara}>{`${escena.cara.nombre} · ${escena.cara.puesto}`}</Text>
        ) : null}

        <Text
          testID={TESTIDS.texto}
          accessibilityLabel={escena.tamanoDeTexto}
          style={[estilos.mundo, { fontSize: escala(20), lineHeight: escala(30) }]}
        >
          {escena.cuerpo.forma === 'parlamento' ? `«${escena.cuerpo.texto}»` : escena.cuerpo.texto}
        </Text>

        <Text style={[estilos.cierre, { fontSize: escala(17), lineHeight: escala(26) }]}>{escena.cierre}</Text>
      </ScrollView>

      {/* El único control de aplicación de la pantalla, y por eso el único en sans. Cada toque
          avanza un escalón y el texto cambia en el sitio: sin panel, sin recargar nada y sin
          salir de la escena. */}
      <Pressable testID={TESTIDS.tamanoDeTexto} onPress={alCambiarTamano} style={estilos.tamano}>
        <Text style={estilos.tamanoTexto}>{TEXTOS_DEL_TAMANO.etiqueta}</Text>
      </Pressable>

      {/* Sin la segunda mitad compuesta, la acción cierra el paso en lugar de llevar a una
          pantalla que no existe: las dos se componen juntas, así que llegar aquí sin ella es
          imposible, y quedarse encallado por eso no puede pasar. */}
      <Pressable testID={TESTIDS.accion} onPress={loQueTeLlevas ? alLoQueTeLlevas : alSeguir} style={estilos.accion}>
        <Text style={estilos.accionTexto}>{escena.accion.verbo}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  contenido: { padding: 28, paddingTop: 48, gap: 16 },
  sitio: { fontFamily: 'serif', fontSize: 15, color: LAPIZ },
  titular: { fontFamily: 'serif', color: TINTA },
  mundo: { fontFamily: 'serif', color: TINTA },
  cara: { fontFamily: 'serif', fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: LAPIZ },
  cierre: { fontFamily: 'serif', color: LAPIZ },
  rotulo: { fontFamily: 'serif', fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: LAPIZ },
  siguiente: { fontFamily: 'serif', color: TINTA },
  calzadas: { fontFamily: 'serif', color: LAPIZ },
  averia: { fontFamily: 'serif', fontSize: 16, lineHeight: 24, color: TINTA },
  // La sans es de la voz de la aplicación, y este es el único elemento que la tiene.
  tamano: { paddingHorizontal: 28, paddingBottom: 8, alignSelf: 'flex-start' },
  tamanoTexto: { fontFamily: 'sans-serif', fontSize: 13, color: LAPIZ },
  accion: { margin: 24, marginTop: 0, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
