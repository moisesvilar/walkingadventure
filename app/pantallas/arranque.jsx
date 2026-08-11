// Las siete pantallas del arranque, de abrir la app por primera vez a salir a andar.
//
// La pantalla **no decide nada**: el orden de los pasos, qué queda precubierto, qué
// admite volver atrás, el sorteo de nombres, el filtro sobre el escrito a mano, la
// permanencia del oficio y la reanudación viven en `partida/onboarding.js` y en
// `partida/personaje.js`, y aquí solo se dibujan. Los textos tampoco son de aquí: los
// trae el guion del núcleo. Es lo que permite que casi todo lo que esta fila entrega se
// pueda poner rojo en `node --test`, en una máquina sin simulador.
//
// Lo que sí es de esta capa: la composición —una acción al pie, cabecera con flecha y
// contador en las cinco primeras y ninguna en las dos últimas—, el gesto de arrastrar
// la marca y el momento en que se pasa de pantalla.
//
// Y una ausencia deliberada: **ninguna barra de progreso, ningún porcentaje, ningún
// contador de segundos**. A1P5 enseña las seis fases del levantamiento y nada más.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';
import { guionDePaso, textoDelGuion } from '@walkingadventure/nucleo/partida/guion-de-arranque.js';
import { IDS_DE_GENERO, MOTIVOS_DEL_NOMBRE } from '@walkingadventure/nucleo/partida/personaje.js';
import { RESPUESTAS_DE_TRAMO } from '@walkingadventure/nucleo/partida/tramo.js';
import { OFICIOS } from '@walkingadventure/nucleo/quests/oficios.js';

import { mensajeDeError } from '../plataforma/capacidades.js';
import { MapaRealSinMontar } from './mapa-real.jsx';
import { PantallaMapa } from './mapa.jsx';
import { marcaSuperpuesta } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';

/**
 * Las cuatro respuestas que A1P3 puede tener, y **solo cuatro**.
 *
 * `denegado` y `no-se-pudo-preguntar` son dos y no una a propósito: la primera es una
 * decisión de quien juega y sigue por la vía manual sin una palabra que la llame problema;
 * la segunda es una avería nuestra, se queda en la pantalla con el motivo literal a la
 * vista y se arregla en otro sitio. Confundirlas convertiría una pieza sin cablear en una
 * elección, que es la forma de fallo que este repo lleva pagada ocho veces (§6h).
 */
export const RESPUESTAS_DEL_PERMISO = Object.freeze(['sin-pedir', 'concedido', 'denegado', 'no-se-pudo-preguntar']);

/**
 * Cuántos grados de latitud son unos metros. La misma constante que la proyección
 * local del núcleo, y aquí solo sirve para traducir un arrastre de dedo a coordenadas
 * mientras no exista capa de teselas con su propia proyección.
 */
const METROS_POR_GRADO = 111320;

/**
 * Cómo se dice cada oficio y a qué manda, en la voz de la aplicación.
 *
 * Vive en la app y no en el núcleo porque son nombres de oficio con género —la palabra
 * concuerda con quien juega— y porque `oficios.js` declara **claves sin género** a
 * propósito: escribir «buhonera» como clave pegaría el estereotipo a la clave.
 */
export const TEXTOS_DE_OFICIO = Object.freeze({
  taberna: {
    femenino: 'Tabernera, de las que oyen de todo',
    masculino: 'Tabernero, de los que oyen de todo',
    cortoFemenino: 'tabernera',
    cortoMasculino: 'tabernero',
    implicacion: 'Te llegarán los encargos que nacen de una conversación: recados de vecindario, líos que alguien cuenta a media voz y noticias que hay que llevar de un sitio a otro.',
  },
  botica: {
    femenino: 'Boticaria, de las que curan lo que se puede',
    masculino: 'Boticario, de los que curan lo que se puede',
    cortoFemenino: 'boticaria',
    cortoMasculino: 'boticario',
    implicacion: 'Te mandarán a por lo que hace falta y a donde hace falta: remedios, plantas y gente a la que hay que llegar antes de que se ponga peor.',
  },
  forja: {
    femenino: 'Herrera, de las que arreglan lo roto',
    masculino: 'Herrero, de los que arreglan lo roto',
    cortoFemenino: 'herrera',
    cortoMasculino: 'herrero',
    implicacion: 'Lo tuyo son las cosas: llevarlas, recuperarlas y devolverlas enteras. Aventuras de objeto, de encargo y de taller.',
  },
  mercado: {
    femenino: 'Mercadera, de las que regatean sin despeinarse',
    masculino: 'Mercader, de los que regatean sin despeinarse',
    cortoFemenino: 'mercadera',
    cortoMasculino: 'mercader',
    implicacion: 'Te tocará cruzar el mapa entero: tratos con quien vive lejos, cargas que van y vienen y ferias que se montan donde menos se espera.',
  },
});

/** El nombre de un oficio en el género de quien juega. */
export function nombreDeOficio(oficio, genero) {
  const textos = TEXTOS_DE_OFICIO[oficio];
  if (!textos) {
    throw new Error(`el oficio "${oficio}" no tiene texto de pantalla: los declarados en el núcleo son ${OFICIOS.join(', ')}`);
  }
  return textos[IDS_DE_GENERO.includes(genero) ? genero : 'femenino'];
}

/**
 * El oficio dicho en una palabra, en el género de quien juega.
 *
 * Es lo que va bajo el nombre en la portada —«Xoana, mercadera»—, donde la frase entera de
 * A1P1 no cabe y además sobra: allí se elegía, y aquí solo se recuerda quién eres.
 */
export function nombreCortoDeOficio(oficio, genero) {
  const textos = TEXTOS_DE_OFICIO[oficio];
  if (!textos) {
    throw new Error(`el oficio "${oficio}" no tiene texto de pantalla: los declarados en el núcleo son ${OFICIOS.join(', ')}`);
  }
  return genero === 'masculino' ? textos.cortoMasculino : textos.cortoFemenino;
}

/** El texto de error del nombre, según el motivo del núcleo. */
export function textoDeMotivo(motivo) {
  if (motivo === MOTIVOS_DEL_NOMBRE.DEMASIADO_LARGO) return textoDelGuion('quien-eres', 'nombre-demasiado-largo');
  if (motivo === MOTIVOS_DEL_NOMBRE.NO_VALE) return textoDelGuion('quien-eres', 'nombre-que-no-vale');
  // El campo vacío no es un error que se lea: vuelve el nombre precargado y ya está.
  return null;
}

/**
 * @param {object} props
 *   `arranque` la máquina del núcleo, ya cableada; `levantamiento` la orquestación del
 *   mapa; `enlace` el enlace con Skia; `cronometro` el que mide el minuto; `tamano` el
 *   hueco de la lámina; `MapaReal` la superficie de A1P4; `componeLista` cómo se
 *   compone lo que se cuenta hoy; `guarda` dónde se escribe el arranque a medias;
 *   `alSalirAAndar` qué ocurre al cruzar la frontera de registro.
 */
export function PantallaArranque({
  arranque,
  levantamiento,
  enlace,
  cronometro,
  tamano,
  MapaReal = MapaRealSinMontar,
  componeLista = null,
  guarda = null,
  alSalirAAndar = null,
  estilo = ESTILO_POR_DEFECTO,
  factorTexto = 1,
}) {
  const [vista, setVista] = useState(() => arranque.empieza());
  const [escrito, setEscrito] = useState(null);
  const [errorDelNombre, setErrorDelNombre] = useState(null);
  const [lista, setLista] = useState(null);
  const [fallo, setFallo] = useState(null);
  // La respuesta del permiso, del vocabulario cerrado de arriba. Vive en la pantalla y no
  // en el arranque porque el núcleo no distingue «denegado» de «no se pudo preguntar»: para
  // él las dos acaban en la vía manual, y lo que se arregla en sitios distintos es lo que
  // hay que poder leer aquí.
  const [respuestaDelPermiso, setRespuestaDelPermiso] = useState('sin-pedir');

  const paso = vista.paso;
  const refresca = useCallback((siguiente) => setVista(siguiente ?? arranque.vista()), [arranque]);

  // El arranque a medias se guarda tras cada cambio: es lo que hace que cerrar la app
  // durante la generación no obligue a repetir ninguna pregunta. Lo que se escribe es
  // el documento del núcleo, o sea el anclaje redondeado y ninguna posición exacta.
  useEffect(() => {
    if (!guarda) return;
    Promise.resolve(guarda(arranque.texto())).catch(() => {});
  }, [guarda, arranque, vista]);

  const marca = vista.marca;

  /** El gesto de arrastrar la marca sobre el mapa real. */
  const gesto = useRef({ desde: null });
  const gestos = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { gesto.current = { desde: arranque.marca() }; },
    onPanResponderMove: (_evento, estado) => {
      const desde = gesto.current.desde;
      if (!desde || !tamano) return;
      // Un desplazamiento de pantalla se traduce a grados con la escala del círculo:
      // el círculo cubre el alcance del tramo, así que arrastrarlo de borde a borde
      // mueve la marca exactamente ese alcance. Sin librería de mapa no hay
      // proyección que consultar, y esta relación es la que la pantalla promete.
      const gradosPorPixel = (arranque.radioDeAlcanceM() / METROS_POR_GRADO) / Math.max(1, Math.min(tamano.ancho, tamano.alto) / 2);
      refresca(arranque.mueveLaMarca(
        desde.lat - estado.dy * gradosPorPixel,
        desde.lon + estado.dx * gradosPorPixel / Math.max(0.2, Math.cos((desde.lat * Math.PI) / 180)),
      ));
    },
    onPanResponderRelease: () => { gesto.current = { desde: null }; },
  }), [arranque, tamano, refresca]);

  // Lo que el levantamiento entregó. Se guarda porque A1P7 compone su lista sobre el
  // documento congelado, y no volviendo a preguntarle a nadie.
  const levantado = useRef(null);

  const alMomentoDelMapa = useCallback((momento, resultado) => {
    if (resultado) levantado.current = resultado;
    if (momento === 'pintado' && arranque.vista().paso === 'la-generacion') refresca(arranque.mapaPintado());
    if (momento === 'no-se-pudo') {
      setFallo(momento);
      refresca(arranque.noSePudoLevantar());
    }
  }, [arranque, refresca]);

  // La lista del día uno se compone una sola vez, sobre el mundo ya congelado.
  useEffect(() => {
    if (paso !== 'la-primera-aventura' || lista || !componeLista || !levantado.current) return;
    try {
      setLista(componeLista(levantado.current, arranque.estado().personaje));
    } catch (e) {
      setFallo(mensajeDeError(e));
    }
  }, [paso, lista, componeLista, arranque]);

  const cabecera = vista.contador ? (
    <View style={estilos.cabecera}>
      <Pressable testID="arranque-atras" onPress={() => refresca(arranque.atras())} style={estilos.atras}>
        <Text style={estilos.atrasTexto}>{'‹'}</Text>
      </Pressable>
      <Text testID="arranque-contador" style={estilos.contador}>{`${vista.contador.n}/${vista.contador.de}`}</Text>
    </View>
  ) : null;

  return (
    <View style={estilos.raiz} testID="arranque">
      {/* Los dos que el sistema de diseño manda declarar siempre. */}
      <View testID="momento-antes-de-salir" style={marcaSuperpuesta(0)} />
      <View testID="arranque-paso" accessibilityLabel={paso} style={marcaSuperpuesta(1)} />

      {cabecera}

      {paso === 'quien-eres' ? (
        <QuienEres
          arranque={arranque}
          vista={vista}
          escrito={escrito}
          errorDelNombre={errorDelNombre}
          alEscribir={(texto) => {
            setEscrito(texto);
            setErrorDelNombre(null);
          }}
          alResortear={() => {
            setEscrito(null);
            setErrorDelNombre(null);
            refresca(arranque.resortea());
          }}
          alGenero={(g) => refresca(arranque.eligeGenero(g))}
          alOficio={(o) => refresca(arranque.eligeOficio(o))}
        />
      ) : null}

      {paso === 'tu-tramo' ? (
        <TuTramo vista={vista} alResponder={(id) => refresca(arranque.respondeTramo(id))} />
      ) : null}

      {/* La acción única de las dos primeras pantallas. Va aquí y no dentro de cada una
          porque la composición es común: una sola acción, al pie, pegada al borde. */}
      {paso === 'quien-eres' || paso === 'tu-tramo' ? (
        <View style={estilos.pieAccion}>
          <Accion
            testID="arranque-seguir"
            texto={textoDelGuion(paso, 'seguir')}
            apagada={paso === 'quien-eres' && !vista.precubierto.oficio}
            motivo={paso === 'quien-eres' && !vista.precubierto.oficio ? 'falta marcar el oficio, que es lo único de esta pantalla que no viene puesto' : null}
            onPress={() => {
              if (paso === 'quien-eres') {
                // El nombre se valida al seguir y no mientras se teclea: corregir a
                // alguien letra a letra mientras escribe su nombre es de formulario.
                const veredicto = arranque.escribeNombre(escrito ?? vista.precubierto.nombre);
                const aviso = veredicto.ok ? null : textoDeMotivo(veredicto.motivo);
                setErrorDelNombre(aviso);
                // Lo escrito se descarta pase lo que pase: si valía, ya está guardado;
                // si no, vuelve el precargado, que es lo que la pantalla promete.
                setEscrito(null);
                if (aviso) return;
              }
              if (paso === 'tu-tramo' && !vista.precubierto.respuestaDeTramo) {
                // La preseleccionada del catálogo, sin obligar a tocarla.
                refresca(arranque.respondeTramo((RESPUESTAS_DE_TRAMO.find((r) => r.preseleccionada) ?? RESPUESTAS_DE_TRAMO[0]).id));
              }
              refresca(arranque.avanza());
            }}
          />
        </View>
      ) : null}

      {paso === 'el-permiso' ? (
        <ElPermiso
          arranque={arranque}
          respuesta={respuestaDelPermiso}
          alPermitir={async () => {
            setFallo(null);
            try {
              const vistaNueva = await arranque.pideElPermiso();
              // Concedido o denegado se leen de por dónde llegó el punto, que es lo que el
              // núcleo sí distingue: con permiso concedido el origen es `permiso`, y
              // denegarlo deja la marca en el punto por defecto por la vía manual.
              setRespuestaDelPermiso(vistaNueva.precubierto.origenDelPunto === 'permiso' ? 'concedido' : 'denegado');
              refresca(vistaNueva);
            } catch (e) {
              // No poder preguntar no es haber denegado: se dice, y la vía manual
              // sigue ahí abajo, que es la que resuelve el momento.
              setRespuestaDelPermiso('no-se-pudo-preguntar');
              setFallo(mensajeDeError(e));
            }
          }}
          alAMano={() => refresca(arranque.eligeAMano())}
        />
      ) : null}

      {paso === 'donde-se-levanta' ? (
        <DondeSeLevanta
          arranque={arranque}
          marca={marca}
          tamano={tamano}
          MapaReal={MapaReal}
          gestos={gestos}
          fallo={fallo}
          alGenerar={() => {
            setFallo(null);
            refresca(arranque.confirmaElPunto());
          }}
        />
      ) : null}

      {paso === 'la-generacion' || paso === 'tu-mapa' ? (
        <View style={estilos.cuerpo}>
          {paso === 'la-generacion' ? (
            <View style={estilos.encabezado}>
              <Text style={estilos.titulo}>{textoDelGuion('la-generacion', 'titulo')}</Text>
              <Text style={estilos.linea}>{textoDelGuion('la-generacion', 'espera')}</Text>
            </View>
          ) : (
            <Text style={estilos.seccion}>{textoDelGuion('tu-mapa', 'seccion')}</Text>
          )}

          <View style={estilos.hueco}>
            <PantallaMapa
              levantamiento={levantamiento}
              enlace={enlace}
              cronometro={cronometro}
              tamano={tamano}
              punto={marca ?? { lat: 0, lon: 0 }}
              semilla={arranque.semilla()}
              tramoM={arranque.estado().personaje.tramo.declaradoM}
              estilo={estilo}
              factorTexto={factorTexto}
              arrancaSolo
              alMomento={alMomentoDelMapa}
            />
          </View>

          {paso === 'la-generacion' ? (
            <Text testID="generacion-prologo" style={estilos.prologo}>{`«${textoDelGuion('la-generacion', 'prologo')}»`}</Text>
          ) : (
            <View style={estilos.pie}>
              <Text testID="trato" style={estilos.linea}>{textoDelGuion('tu-mapa', 'trato')}</Text>
              <Accion testID="arranque-seguir" texto={textoDelGuion('tu-mapa', 'seguir')} onPress={() => refresca(arranque.avanza())} />
            </View>
          )}
        </View>
      ) : null}

      {paso === 'la-primera-aventura' ? (
        <LaPrimeraAventura
          lista={lista}
          alSalir={() => {
            const cerrado = arranque.cierra();
            refresca();
            // El mapa levantado viaja con lo cerrado: la portada del día siguiente se compone
            // sobre él, y volver a preguntárselo a nadie sería levantarlo dos veces.
            if (alSalirAAndar) alSalirAAndar(cerrado, lista, levantado.current);
          }}
        />
      ) : null}

      {/* El motivo de un fallo viaja como marca y no se pinta: lo que se lee sigue sin
          nombrar la red ni ningún código. */}
      <View testID="arranque-motivo" accessibilityLabel={fallo ?? ''} style={marcaSuperpuesta(2)} />
    </View>
  );
}

// --- A1P1 ----------------------------------------------------------------------

function QuienEres({ arranque, vista, escrito, errorDelNombre, alEscribir, alResortear, alGenero, alOficio }) {
  const puesto = vista.precubierto;
  const enPantalla = escrito === null ? puesto.nombre ?? '' : escrito;

  return (
    <ScrollView style={estilos.cuerpo} contentContainerStyle={estilos.cuerpoDentro}>
      <Text style={estilos.seccion}>{textoDelGuion('quien-eres', 'seccion-personaje')}</Text>
      <Text style={estilos.titulo}>{textoDelGuion('quien-eres', 'pregunta')}</Text>
      <Text style={estilos.linea}>{textoDelGuion('quien-eres', 'de-quien-es-el-nombre')}</Text>

      <View style={estilos.fila}>
        <Campo testID="nombre-campo" valor={enPantalla} alCambiar={alEscribir} />
        <Pressable testID="nombre-resortear" onPress={alResortear} style={estilos.accionMenor}>
          <Text style={estilos.accionMenorTexto}>{textoDelGuion('quien-eres', 'resortear')}</Text>
        </Pressable>
      </View>

      <View testID="nombre-sugerencias" style={estilos.fila}>
        {vista.sugerencias.map((nombre) => (
          <Pressable key={nombre} testID={`nombre-sugerencia-${nombre}`} onPress={() => alEscribir(nombre)} style={estilos.sugerencia}>
            <Text style={estilos.sugerenciaTexto}>{nombre}</Text>
          </Pressable>
        ))}
      </View>

      {errorDelNombre ? <Text testID="nombre-error" style={estilos.error}>{errorDelNombre}</Text> : null}

      <View style={estilos.fila}>
        <Opcion
          testID="genero-femenino"
          marcada={puesto.genero === 'femenino'}
          texto={textoDelGuion('quien-eres', 'genero-femenino')}
          onPress={() => alGenero('femenino')}
        />
        <Opcion
          testID="genero-masculino"
          marcada={puesto.genero === 'masculino'}
          texto={textoDelGuion('quien-eres', 'genero-masculino')}
          onPress={() => alGenero('masculino')}
        />
      </View>

      <Text style={estilos.seccion}>{textoDelGuion('quien-eres', 'seccion-oficio')}</Text>
      <Text style={estilos.linea}>{textoDelGuion('quien-eres', 'implicacion-del-oficio')}</Text>

      {/* La lista desplaza y la pantalla no cambia de forma: los oficios son tres o
          cuatro, y el desplazamiento está para que crecer no rompa el diseño. */}
      <View testID="oficios">
        {OFICIOS.map((oficio) => (
          <Pressable key={oficio} testID={`oficio-${oficio}`} onPress={() => alOficio(oficio)} style={estilos.oficio}>
            <Text style={[estilos.oficioNombre, puesto.oficio === oficio && estilos.oficioMarcado]}>
              {nombreDeOficio(oficio, puesto.genero)}
            </Text>
            {/* El marcado se despliega en su sitio y explica qué implica: una pantalla
                de detalle por oficio convertiría una decisión permanente en una
                navegación. */}
            {puesto.oficio === oficio ? (
              <Text testID="oficio-implicacion" style={estilos.implicacion}>{TEXTOS_DE_OFICIO[oficio].implicacion}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// --- A1P2 ----------------------------------------------------------------------

function TuTramo({ vista, alResponder }) {
  const marcada = vista.precubierto.respuestaDeTramo
    ?? (RESPUESTAS_DE_TRAMO.find((r) => r.preseleccionada) ?? RESPUESTAS_DE_TRAMO[0]).id;
  return (
    <View style={estilos.cuerpo}>
      <Text style={estilos.seccion}>{textoDelGuion('tu-tramo', 'seccion')}</Text>
      <Text style={estilos.titulo}>{textoDelGuion('tu-tramo', 'pregunta')}</Text>
      <View testID="tramo-respuestas">
        {RESPUESTAS_DE_TRAMO.map((respuesta) => (
          <Opcion
            key={respuesta.id}
            testID={`tramo-${respuesta.id}`}
            marcada={marcada === respuesta.id}
            texto={textoDelGuion('tu-tramo', `respuesta-${respuesta.id}`)}
            onPress={() => alResponder(respuesta.id)}
          />
        ))}
      </View>
      <Text style={estilos.linea}>{textoDelGuion('tu-tramo', 'se-ajusta-solo')}</Text>
    </View>
  );
}

// --- A1P3 ----------------------------------------------------------------------

function ElPermiso({ arranque, alPermitir, alAMano, respuesta = 'sin-pedir' }) {
  const proveedor = arranque.proveedorDeUbicacion ? arranque.proveedorDeUbicacion() : null;
  const sinMontar = proveedor ? proveedor.montado === false : false;
  return (
    <View style={estilos.cuerpo}>
      {/* La respuesta del permiso y si hay con qué pedirlo. Las dos son marcas y no texto:
          lo que se lee en A1P3 no cambia por haber denegado, que es media pantalla. */}
      <View testID="permiso-respuesta" accessibilityLabel={respuesta} style={marcaSuperpuesta(0, { fila: 1 })} />
      <View testID="ubicacion-estado" accessibilityLabel={sinMontar ? 'sin-montar' : 'montado'} style={marcaSuperpuesta(1, { fila: 1 })} />

      <Text style={estilos.seccion}>{textoDelGuion('el-permiso', 'seccion')}</Text>
      <Text style={estilos.titulo}>{textoDelGuion('el-permiso', 'titulo')}</Text>
      <Text style={estilos.linea}>{textoDelGuion('el-permiso', 'razon')}</Text>

      <View testID="permiso-alcance" style={estilos.tarjeta}>
        <Text style={estilos.tarjetaTitulo}>{textoDelGuion('el-permiso', 'alcance')}</Text>
        <Text style={estilos.linea}>{textoDelGuion('el-permiso', 'alcance-nota')}</Text>
      </View>

      {/* Las dos acciones van apiladas y con peso distinto. Es el único sitio del
          arranque con dos, y es precisamente la que impide que denegar sea una puerta
          cerrada. */}
      <Accion
        testID="permiso-permitir"
        texto={textoDelGuion('el-permiso', 'permitir')}
        onPress={alPermitir}
        apagada={sinMontar}
        motivo={sinMontar ? proveedor.motivo : null}
      />
      <Pressable testID="permiso-a-mano" onPress={alAMano} style={estilos.accionMenor}>
        <Text style={estilos.accionMenorTexto}>{textoDelGuion('el-permiso', 'a-mano')}</Text>
      </Pressable>
    </View>
  );
}

// --- A1P4 ----------------------------------------------------------------------

function DondeSeLevanta({ arranque, marca, tamano, MapaReal, gestos, fallo, alGenerar }) {
  const radioM = arranque.radioDeAlcanceM();
  const lado = tamano ? Math.min(tamano.ancho, tamano.alto) : 0;
  return (
    <View style={estilos.cuerpo}>
      <Text style={estilos.titulo}>{textoDelGuion('donde-se-levanta', 'titulo')}</Text>

      <View style={estilos.hueco} {...gestos.panHandlers}>
        <MapaReal centro={marca} tamano={tamano} />
        {/* El círculo sale del tramo y de nada más: no hay control de tamaño porque no
            es una perilla, es una consecuencia. */}
        <View
          testID="punto-circulo"
          accessibilityLabel={`${Math.round(radioM)}`}
          pointerEvents="none"
          style={[estilos.circulo, { width: lado * 0.8, height: lado * 0.8, borderRadius: (lado * 0.8) / 2 }]}
        />
        <View testID="punto-pin" accessibilityLabel={marca ? `${marca.lat},${marca.lon}` : ''} pointerEvents="none" style={estilos.pin} />
      </View>

      <Text style={estilos.linea}>{textoDelGuion('donde-se-levanta', 'arrastra')}</Text>
      <Text style={estilos.linea}>{textoDelGuion('donde-se-levanta', 'circulo')}</Text>

      {fallo ? (
        <Text testID="generacion-no-se-pudo" style={estilos.linea}>{textoDelGuion('donde-se-levanta', 'no-se-pudo')}</Text>
      ) : null}

      <Text testID="punto-irreversible" style={estilos.linea}>{textoDelGuion('donde-se-levanta', 'irreversible')}</Text>
      <Accion testID="punto-generar" texto={textoDelGuion('donde-se-levanta', 'generar')} onPress={alGenerar} />
    </View>
  );
}

// --- A1P7 ----------------------------------------------------------------------

function LaPrimeraAventura({ lista, alSalir }) {
  return (
    <ScrollView style={estilos.cuerpo} contentContainerStyle={estilos.cuerpoDentro}>
      <Text style={estilos.titulo}>{textoDelGuion('la-primera-aventura', 'titulo')}</Text>
      <Text style={estilos.linea}>{textoDelGuion('la-primera-aventura', 'subtitulo')}</Text>

      <View testID="primera-lista">
        {(lista?.aventuras ?? []).map((aventura) => (
          <View key={aventura.id} testID={`aventura-${aventura.id}`} style={estilos.tarjeta}>
            <Text style={estilos.tarjetaTitulo}>{aventura.titulo}</Text>
            <Text style={estilos.linea}>{aventura.gancho}</Text>
            <Text testID="aventura-medida" style={estilos.medida}>{aventura.medida}</Text>
          </View>
        ))}
      </View>

      <Text style={estilos.linea}>{textoDelGuion('la-primera-aventura', 'regla-del-reloj')}</Text>
      <Text testID="andar-sin-nada" style={estilos.linea}>{textoDelGuion('la-primera-aventura', 'andar-sin-nada')}</Text>
      <Accion testID="arranque-seguir" texto={textoDelGuion('la-primera-aventura', 'salir')} onPress={alSalir} />
    </ScrollView>
  );
}

// --- Piezas comunes ---------------------------------------------------------------

/** La acción única del pie. Una por pantalla: con dos compitiendo, elegir deja de ser un paso. */
function Accion({ testID, texto, onPress, apagada = false, motivo = null }) {
  return (
    <View>
      <Pressable testID={testID} onPress={apagada ? undefined : onPress} disabled={apagada} style={[estilos.accion, apagada && estilos.accionApagada]}>
        <Text style={estilos.accionTexto}>{texto}</Text>
      </Pressable>
      {/* Una acción apagada dice por qué, y lo dice donde se puede leer con un lector
          de pantalla: un botón que no responde y no explica nada es peor que no estar. */}
      {apagada ? <View testID={`${testID}-motivo`} accessibilityLabel={motivo ?? ''} style={marcaSuperpuesta(0, { fila: 2 })} /> : null}
    </View>
  );
}

/** Una opción marcable de una lista. Ni desplegable ni interruptor: se ve entera sin tocar. */
function Opcion({ testID, marcada, texto, onPress }) {
  return (
    <Pressable testID={testID} accessibilityState={{ selected: !!marcada }} onPress={onPress} style={estilos.opcion}>
      <Text style={[estilos.opcionTexto, marcada && estilos.opcionMarcada]}>{texto}</Text>
    </Pressable>
  );
}

/**
 * El campo de texto del nombre.
 *
 * Se monta con `Pressable` y `Text` y no con `TextInput` porque el teclado real es de
 * la plataforma y lo que esta fila necesita afirmar es el valor precargado y el
 * veredicto del filtro. `alCambiar` es la puerta por la que el flujo de dispositivo
 * escribe, y es la misma que usa una sugerencia al tocarse.
 */
function Campo({ testID, valor, alCambiar }) {
  return (
    <Pressable testID={testID} accessibilityLabel={valor} onPress={() => alCambiar(valor)} style={estilos.campo}>
      <Text style={estilos.campoTexto}>{valor}</Text>
    </Pressable>
  );
}

/** Las piezas del guion de una pantalla, por si quien la monta quiere enumerarlas. */
export function piezasDe(paso) {
  return guionDePaso(paso);
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  cabecera: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  atras: { paddingRight: 16 },
  atrasTexto: { fontSize: 26, color: TINTA },
  contador: { fontSize: 13, color: TINTA, opacity: 0.6 },
  cuerpo: { flex: 1, paddingHorizontal: 24 },
  cuerpoDentro: { paddingBottom: 32 },
  encabezado: { paddingBottom: 8 },
  seccion: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: TINTA, opacity: 0.6, marginTop: 16 },
  titulo: { fontFamily: 'serif', fontSize: 24, color: TINTA, marginTop: 6, marginBottom: 8 },
  linea: { fontSize: 15, lineHeight: 22, color: TINTA, marginTop: 6 },
  prologo: { fontFamily: 'serif', fontSize: 17, fontStyle: 'italic', color: TINTA, marginVertical: 16 },
  fila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
  campo: { flexGrow: 1, borderBottomWidth: 1, borderBottomColor: TINTA, paddingVertical: 6 },
  campoTexto: { fontFamily: 'serif', fontSize: 20, color: TINTA },
  sugerencia: { paddingVertical: 6, paddingRight: 14 },
  sugerenciaTexto: { fontSize: 15, color: TINTA, textDecorationLine: 'underline' },
  error: { fontSize: 14, color: '#8a2b12', marginTop: 8 },
  opcion: { paddingVertical: 10, paddingRight: 14 },
  opcionTexto: { fontSize: 16, color: TINTA, opacity: 0.7 },
  opcionMarcada: { opacity: 1, fontWeight: '600' },
  oficio: { paddingVertical: 10 },
  oficioNombre: { fontSize: 16, color: TINTA, opacity: 0.75 },
  oficioMarcado: { opacity: 1, fontWeight: '600' },
  implicacion: { fontSize: 14, lineHeight: 20, color: TINTA, marginTop: 6, opacity: 0.9 },
  tarjeta: { borderWidth: 1, borderColor: TINTA, padding: 14, marginTop: 14 },
  tarjetaTitulo: { fontFamily: 'serif', fontSize: 18, color: TINTA },
  medida: { fontSize: 13, color: TINTA, opacity: 0.7, marginTop: 8 },
  hueco: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  circulo: { position: 'absolute', borderWidth: 2, borderColor: '#8a2b12' },
  pin: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#8a2b12' },
  pie: { paddingBottom: 12 },
  pieAccion: { paddingHorizontal: 24, paddingBottom: 20 },
  accion: { marginTop: 20, alignSelf: 'flex-start' },
  accionApagada: { opacity: 0.4 },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA, textDecorationLine: 'underline' },
  accionMenor: { marginTop: 14, alignSelf: 'flex-start' },
  accionMenorTexto: { fontSize: 15, color: TINTA, opacity: 0.8 },
});
