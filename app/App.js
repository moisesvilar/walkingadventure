// La raíz de la app y **la máquina de estados del recorrido**: qué momento está a la
// vista y qué lleva de uno a otro. Las aristas que encadena no se inventan aquí — son las
// que declara `docs/flujo.md`, que es la fuente normativa, y una transición que no esté
// allí no se cablea sin decidirla antes como cambio de diseño.
//
// Sigue sin haber enrutador, y desde la fila 43 eso es una decisión medida y no una
// inercia: los momentos son cuatro, de una pantalla de consulta solo se vuelve a la
// portada, y una pila de navegación no tendría nada que apilar. Si la fila 44 —la máquina
// de una salida, que sí tiene profundidad— demostrara lo contrario, es esa fila la que lo
// replantea con la medida delante.
//
// Desde esta fila hay una segunda pantalla que **sí es del juego**: el mapa. Aquí
// cuelga de un paso porque todavía no existe el flujo que lleva hasta ella —dónde se
// levanta, con qué permiso, con qué tramo— y sin ese paso no habría manera de
// recorrer el levantamiento de punta a punta ni de medir el minuto.
//
// Y una tercera, la revisión del render, detrás de un paso que solo existe con
// `__DEV__`. Esa no es navegación: es el equivalente del hook `__wa.style()` que el
// prototipo tiene en consola, y es donde se hace la revisión de paridad.
//
// Desde la fila 29 hay además un **cuarto momento encadenado de verdad**: en marcha. No
// cuelga de ningún paso provisional cuando hay partida —se llega andando, que es como se
// llega en el juego: por «salir a andar» de la preparación, por «salir a andar sin más» de
// la portada y de la lista, y por «seguir con ella» de la tarjeta de a medias—. El paso
// provisional existe solo al lado de los otros dos, para poder abrir el momento sin
// recorrer el arranque entero.

import React, { useEffect, useState } from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, Text } from 'react-native';

import { estadoInicial } from '@walkingadventure/nucleo/partida/estado.js';

import { creaAlmacenDuradero, directorioDeLaPartida } from './datos/almacen-duradero.js';
import { creaCopia } from './datos/copia.js';
import { creaEmpezarDeNuevo } from './datos/empezar-de-nuevo.js';
// El área segura de la app. No es el `SafeAreaView` de `react-native`, que en Android es un
// `View` corriente y dejaba la cabecera del arranque bajo la barra de estado: es el que
// respeta los insets en las dos plataformas.
import { AreaSegura } from './plataforma/area-segura.jsx';
import { comparteConElSistema, eligeConElSistema } from './plataforma/copia-del-sistema.js';
import { creaFicherosDelDispositivo, directorioDeDocumentos } from './plataforma/ficheros.js';
import { mundoDeRevision } from './nucleo/mundo-de-revision.js';
import { NUCLEO_DE_EMPEZAR_DE_NUEVO, NUCLEO_DE_LA_COPIA } from './nucleo/piezas.js';
import { MODULOS_DE_PLATAFORMA } from './plataforma/index.js';
import { leeGancho } from './plataforma/gancho.js';
import { mensajeDeError } from './plataforma/capacidades.js';
import { AntesDeSalirMontado } from './pantallas/antes-de-salir-montado.jsx';
import { ArranqueMontado } from './pantallas/arranque-montado.jsx';
import { ConsultaMontada } from './pantallas/consulta-montado.jsx';
import { nombreCortoDeOficio } from './pantallas/arranque.jsx';
import { PantallaAndamiaje } from './pantallas/andamiaje.js';
import { EnMarchaMontado } from './pantallas/en-marcha-montado.jsx';
import { MapaMontado } from './pantallas/mapa-montado.jsx';
import { RevisionMontada } from './pantallas/revision-montada.jsx';

// Referencia estable: si fuera un literal en el cuerpo, cada repintado sería un
// re-sondeo de las cinco capacidades.
const SIN_GANCHO = { ausentes: [], noReconocidos: [] };

// `__DEV__` lo define el empaquetador. En una compilación de producción vale
// false y el gancho queda inerte, que es lo que impide que sea una puerta trasera.
const EN_DESARROLLO = typeof __DEV__ !== 'undefined' && __DEV__;

export function App() {
  const [gancho, setGancho] = useState(SIN_GANCHO);
  // El almacén duradero, cableado **aquí y una sola vez**: es lo que hace que cerrar la
  // app deje de perder la partida. Si el sistema de ficheros no estuviera, esto lanza y
  // la app no arranca, que es lo que la spec pide en lugar de caer al de memoria: una
  // app que juega perfectamente y pierde la partida al cerrar es la degradación
  // silenciosa más cara posible.
  const [almacen] = useState(() => creaAlmacenDuradero({
    ficheros: creaFicherosDelDispositivo(),
    directorio: directorioDeLaPartida(directorioDeDocumentos()),
  }));
  // Guardar y abrir una copia, con las dos piezas del sistema. La hoja de compartir y el
  // selector no se envuelven en ninguna pantalla nuestra: se usan tal cual.
  const [copia] = useState(() => creaCopia({
    almacen,
    comparte: comparteConElSistema,
    elige: eligeConElSistema,
    nucleo: NUCLEO_DE_LA_COPIA,
  }));
  // Empezar de nuevo, que es borrar. Desde la fila 43 su puerta existe —la fila última de
  // A6P6, que a su vez cuelga de la portada—; lo que además sigue colgando de aquí, porque
  // es del ciclo de vida de la app y no de ninguna pantalla, es **rematar el borrado que un
  // cierre dejó a medias**.
  const [empezarDeNuevo] = useState(() => creaEmpezarDeNuevo({ almacen, copia, nucleo: NUCLEO_DE_EMPEZAR_DE_NUEVO }));
  const [enRevision, setEnRevision] = useState(false);
  const [enMapa, setEnMapa] = useState(false);
  // La app abre en el arranque, que es lo que ve quien la instala. Se sale de él por
  // el botón «Salir a andar» de A1P7, que es la frontera de registro y el único
  // camino: no hay manera de volver a entrar salvo por «empezar de nuevo».
  const [enArranque, setEnArranque] = useState(true);
  // Lo que el arranque dejó: el personaje, el mapa levantado y el estado de la partida. Es lo
  // que la portada necesita, y es de esta fila que exista una portada a la que ir. Mientras no
  // haya partida guardada —que es de otra fila—, vive aquí y solo dura la sesión.
  const [partida, setPartida] = useState(null);
  // La salida que se echó a andar, tal y como la declaró quien salió: con aventura preparada,
  // sin más, o retomando la que estaba a medias. Mientras vale `null` no se anda. No se vuelve
  // desde aquí: se sale de una salida llegando a casa o echando el telón, que es de la fila 36.
  const [salida, setSalida] = useState(null);
  // El paso provisional al momento en marcha, hermano de los otros dos y con su mundo: sin
  // partida no hay mapa levantado, así que se pinta sobre el mundo de revisión —el mismo
  // `__wa.demo()` del prototipo— en lugar de sobre uno inventado aquí.
  const [enMarcha, setEnMarcha] = useState(false);
  const [mundoDelPaso, setMundoDelPaso] = useState({ documento: null, fallo: null });
  // La puerta de consulta abierta, o ninguna. Las tres de la portada más la que cuelga de
  // los ajustes; `docs/flujo.md` las declara colgando de A6P1, que es la portada redibujada,
  // y por eso esto es un valor y no una pila: de una pantalla de consulta solo se vuelve a
  // la portada, nunca a otra.
  const [consulta, setConsulta] = useState(null);

  // El atrás de Android hace lo mismo que el «‹» de la pantalla, y no otra cosa. Que
  // discrepen es un defecto de plataforma y no una decisión: quien pulsa el del sistema
  // espera exactamente lo que promete el de la pantalla que está mirando.
  useEffect(() => {
    if (consulta === null) return undefined;
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      // Desde empezar de nuevo se vuelve a los ajustes, que es «dejarlo como está», y
      // desde las otras tres a la portada.
      setConsulta((abierta) => (abierta === 'empezar-de-nuevo' ? 'ajustes' : null));
      return true;
    });
    return () => suscripcion.remove();
  }, [consulta]);

  // Lo primero de todo, antes de leer nada de la partida: si hay un borrado marcado, se
  // termina. Una interrupción a mitad tiene un único final posible —el borrado acaba y
  // se llega al arranque—, y no una partida con parte de sus documentos que se abre,
  // parece jugable y falla más tarde por una celda que el índice declara y el almacén no
  // tiene (SPEC-040, `decisiones-orquestador.md` §6h).
  useEffect(() => {
    let vivo = true;
    empezarDeNuevo.terminaPendiente()
      .then((remate) => {
        if (!vivo || !remate.habia) return;
        setPartida(null);
        setSalida(null);
        setEnArranque(true);
      })
      // Si el remate falla, la marca sigue puesta y el siguiente arranque vuelve a
      // intentarlo. No se reintenta en bucle y no se abre la partida a medio borrar.
      .catch(() => {});
    return () => { vivo = false; };
  }, [empezarDeNuevo]);

  useEffect(() => {
    let vivo = true;
    const aplica = (url) => {
      const leido = leeGancho(url, EN_DESARROLLO);
      if (!vivo) return;
      if (leido.ausentes.length === 0 && leido.noReconocidos.length === 0) return;
      setGancho(leido);
    };
    Linking.getInitialURL().then(aplica).catch(() => {});
    const suscripcion = Linking.addEventListener('url', (evento) => aplica(evento?.url));
    return () => {
      vivo = false;
      suscripcion.remove();
    };
  }, []);

  // El mundo del paso provisional se levanta la primera vez que se abre el momento y no al
  // arrancar la app: construirlo cuesta, y quien nunca pulsa el paso no tiene por qué pagarlo.
  // Si no se pudiera construir se guarda el motivo, que es lo que la pantalla enseña: un mapa
  // en blanco no distingue «no hay mundo» de «no hay seguidor».
  useEffect(() => {
    if (!enMarcha || mundoDelPaso.documento !== null || mundoDelPaso.fallo !== null) return undefined;
    let vivo = true;
    mundoDeRevision()
      .then((documento) => { if (vivo) setMundoDelPaso({ documento, fallo: null }); })
      .catch((e) => { if (vivo) setMundoDelPaso({ documento: null, fallo: mensajeDeError(e) }); });
    return () => { vivo = false; };
  }, [enMarcha, mundoDelPaso]);

  if (enArranque) {
    return (
      <AreaSegura style={estilos.raiz}>
        <ArranqueMontado
          almacen={almacen}
          copia={copia}
          alSalirAAndar={(cerrado, lista, levantado) => {
            if (cerrado && levantado) {
              setPartida({
                estado: estadoInicial({ semilla: cerrado.semilla }),
                // El oficio viaja dos veces y no es redundancia: la clave es con la que se
                // filtra el catálogo, y la palabra —con género, que por eso vive en la app— es
                // la que se lee bajo el nombre.
                personaje: {
                  ...cerrado.personaje,
                  oficioDicho: nombreCortoDeOficio(cerrado.personaje.oficio, cerrado.personaje.genero),
                },
                mundo: { mapaId: levantado.mapaId, documento: levantado.documento, titulo: levantado.documento?.title ?? null },
                arrancadaEn: Date.now(),
              });
            }
            setEnArranque(false);
          }}
        />
      </AreaSegura>
    );
  }

  // Con la salida echada a andar ya no hay portada: se anda. Es el momento en marcha sobre el
  // mapa que la partida levantó, y **no se dibuja envuelto en la raíz**: la lámina va a sangre,
  // de borde a borde, y el área segura le comería el borde superior.
  if (partida && salida) {
    return (
      <EnMarchaMontado
        mundo={partida.mundo.documento}
        salidas={partida.estado.aventuras}
      />
    );
  }

  // Las pantallas de consulta van por delante de la portada, y **la portada no se
  // recompone al volver**: sigue montada detrás con su estado intacto. Abrir el diario y
  // volver no puede cambiar la miniatura ni la tarjeta de a medias, porque entre una cosa
  // y la otra no ha pasado nada en el juego.
  if (partida && consulta !== null) {
    return (
      <AreaSegura style={estilos.raiz}>
        <ConsultaMontada
          puerta={consulta}
          partida={partida.estado}
          personaje={partida.personaje}
          mundo={partida.mundo}
          almacen={almacen}
          empezarDeNuevo={empezarDeNuevo}
          alVolver={() => setConsulta(consulta === 'empezar-de-nuevo' ? 'ajustes' : null)}
          alAbrirPuerta={(id) => setConsulta(id)}
          // Borrar lleva al arranque y a ningún otro sitio: es lo que distingue borrar de
          // reiniciar, y el destino lo declara el núcleo en `DESTINO_TRAS_BORRAR`.
          alBorrada={() => {
            setConsulta(null);
            setPartida(null);
            setSalida(null);
            setEnArranque(true);
          }}
        />
      </AreaSegura>
    );
  }

  // La portada: lo que se ve al abrir la app cualquier día que no sea el primero. Sin partida
  // —una compilación abierta directamente en el andamiaje— se queda el andamiaje, que es lo
  // que había antes de esta fila.
  if (partida) {
    return (
      <AreaSegura style={estilos.raiz}>
        <AntesDeSalirMontado
          partida={partida.estado}
          personaje={partida.personaje}
          mundo={partida.mundo}
          arrancadaEn={partida.arrancadaEn}
          // Las cuatro maneras de echarse a andar pasan por aquí, y las cuatro llegan al mismo
          // sitio: «salir a andar» de la preparación, «salir a andar sin más» de la portada y de
          // la lista, y «seguir con ella» de la tarjeta de a medias. Que la de a medias no vuelva
          // a preparar nada es el criterio de SPEC-028 que esto cierra.
          alAndar={(echada) => setSalida(echada ?? { conAventura: false })}
          // Las tres puertas del pie de la portada. La composición del núcleo las declara
          // en `PUERTAS` y la pantalla las pinta; lo que faltaba era esto, que llevaran a
          // algún sitio.
          alAbrirPuerta={(id) => setConsulta(id)}
        />
      </AreaSegura>
    );
  }

  return (
    <AreaSegura style={estilos.raiz}>
      {/* El paso al mapa. Existe en todas las compilaciones porque el mapa es del
          juego; lo provisional es el paso, no la pantalla. */}
      {!enRevision && !enMarcha ? (
        <Pressable onPress={() => setEnMapa((estaba) => !estaba)} style={estilos.paso} testID="paso-mapa">
          <Text style={estilos.pasoTexto}>{enMapa ? 'Volver al andamiaje' : 'El mapa'}</Text>
        </Pressable>
      ) : null}

      {/* El paso al momento en marcha, hermano del anterior y por la misma razón: el
          momento es del juego y a él se llega andando desde la portada, pero sin partida
          levantada no hay ninguna manera de abrirlo. Lo sustituye A3P1 con su rótulo del
          sistema, que es de la fila 30; hasta entonces la lámina convive con esta tira. */}
      {!enRevision && !enMapa ? (
        <Pressable onPress={() => setEnMarcha((estaba) => !estaba)} style={estilos.paso} testID="paso-marcha">
          <Text style={estilos.pasoTexto}>{enMarcha ? 'Volver al andamiaje' : 'En marcha'}</Text>
        </Pressable>
      ) : null}

      {/* El paso a la revisión del render. Solo en desarrollo: el flujo de Maestro
          abre la app en el andamiaje y ahí se queda. */}
      {EN_DESARROLLO && !enMapa && !enMarcha ? (
        <Pressable onPress={() => setEnRevision((estaba) => !estaba)} style={estilos.paso} testID="paso-revision-render">
          <Text style={estilos.pasoTexto}>{enRevision ? 'Volver al andamiaje' : 'El render en Skia'}</Text>
        </Pressable>
      ) : null}

      {enMapa ? <MapaMontado almacen={almacen} /> : enMarcha ? (
        <EnMarchaMontado mundo={mundoDelPaso.documento} falloDeCableado={mundoDelPaso.fallo} />
      ) : enRevision ? (
        <RevisionMontada />
      ) : (
        <PantallaAndamiaje
          modulos={MODULOS_DE_PLATAFORMA}
          ausentes={gancho.ausentes}
          noReconocidos={gancho.noReconocidos}
        />
      )}
    </AreaSegura>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#efe3c0' },
  paso: { paddingHorizontal: 24, paddingVertical: 8 },
  pasoTexto: { fontSize: 13, color: '#1e2b18', opacity: 0.7 },
});
