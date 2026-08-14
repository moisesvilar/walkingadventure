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
// Y aparte del recorrido del juego hay **una puerta de desarrollo**, de la fila 45: el
// enlace `walkingadventure://desarrollo` lleva al andamiaje y a la tira de pasos que cuelga
// de él —el mapa suelto, el momento en marcha sobre el mundo de revisión, la revisión del
// render—. No es navegación y no sale en `docs/flujo.md`: lo que hay detrás son
// herramientas y no pantallas del juego, y la distinción está escrita en §6y. En
// producción no existe.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { creaAlmacenDuradero, directorioDeLaPartida } from './datos/almacen-duradero.js';
import { creaCalendario, relojDePared } from './datos/calendario.js';
import { creaCopia } from './datos/copia.js';
import { creaEmpezarDeNuevo } from './datos/empezar-de-nuevo.js';
import { APERTURAS, creaPartidaGuardada } from './datos/partida-guardada.js';
import { mundoDeLaCelda, mundoDeLaPartida } from './mapa/mundo-guardado.js';
import { creaLaAventuraEnCurso, descartesDeLaAventura } from './marcha/aventura.js';
import { creaElCasting } from './marcha/casting.js';
import { identidadDeLaSalidaViva } from './marcha/identidad.js';
import { creaLasLlegadas, repartoDeLaAventuraEnCurso } from './marcha/llegadas.js';
import { montaLaSalida } from './marcha/salida-montada.js';
// El área segura de la app. No es el `SafeAreaView` de `react-native`, que en Android es un
// `View` corriente y dejaba la cabecera del arranque bajo la barra de estado: es el que
// respeta los insets en las dos plataformas.
import { AreaSegura } from './plataforma/area-segura.jsx';
import { comparteConElSistema, eligeConElSistema, limpiaCopiasDeTrabajo } from './plataforma/copia-del-sistema.js';
import { creaFicherosDelDispositivo, directorioDeDocumentos } from './plataforma/ficheros.js';
import { mundoDeRevision } from './nucleo/mundo-de-revision.js';
import {
  NUCLEO_DEL_MUNDO_GUARDADO,
  NUCLEO_DE_EMPEZAR_DE_NUEVO,
  NUCLEO_DEL_CASTING,
  NUCLEO_DE_LA_AVENTURA_EN_CURSO,
  NUCLEO_DE_LA_COPIA,
  NUCLEO_DE_LAS_LLEGADAS,
  NUCLEO_DEL_MAPA_NUEVO,
  NUCLEO_DEL_MOTOR_DE_LA_PARTIDA,
  NUCLEO_DE_LOS_PASOS_DE_FONDO,
  NUCLEO_DEL_OFRECIMIENTO,
  NUCLEO_DE_LA_PARTIDA_GUARDADA,
} from './nucleo/piezas.js';
import { creaLectorDeSalud, creaMarcaDeAgua } from './plataforma/lector-de-salud.js';
// Sin extensión, como `respaldo` y `rotulo`: es así como Metro elige entre la fuente de
// Health Connect y la pareja declarada de iOS.
import { creaFuenteDeSalud } from './plataforma/salud';
import { creaMotorDelMapaActivo } from './salida/motor.js';
import { creaPasosDeFondo } from './salida/pasos-de-fondo.js';
import { DONDE, levantaElMapaDeAqui, resuelveDondeEstas } from './mapa/donde-estas.js';
import { PUNTO_DEL_ANCLAJE } from './mapa/primera-lista.js';
import { MODULOS_DE_PLATAFORMA } from './plataforma/index.js';
import { leeGancho, leeMetrosDeFondo } from './plataforma/gancho.js';
import { esRazonDePermisos } from './plataforma/razon-de-permisos.js';
import { esPuertaDeDesarrollo } from './plataforma/puerta-de-desarrollo.js';
import { mensajeDeError } from './plataforma/capacidades.js';
import { AntesDeSalirMontado } from './pantallas/antes-de-salir-montado.jsx';
import { ArranqueMontado } from './pantallas/arranque-montado.jsx';
import { DIRECCION_DEL_PROXY } from './pantallas/mapa-montado.jsx';
import { montaElMapaDeLaPartida } from './mapa/montaje.js';
import { creaProveedorDeUbicacionDeExpo, proveedorSinMontar } from './plataforma/ubicacion.js';
import { AbrirCopia } from './pantallas/copia.jsx';
import { ConsultaMontada } from './pantallas/consulta-montado.jsx';
import { nombreCortoDeOficio } from './pantallas/arranque.jsx';
import { PantallaAndamiaje } from './pantallas/andamiaje.js';
import { EnMarchaMontado } from './pantallas/en-marcha-montado.jsx';
import { LlegadaMontada } from './pantallas/llegada-montada.jsx';
import { MapaMontado } from './pantallas/mapa-montado.jsx';
import { RevisionMontada } from './pantallas/revision-montada.jsx';
import { TelonMontado } from './pantallas/telon-montado.jsx';

// Referencia estable: si fuera un literal en el cuerpo, cada repintado sería un
// re-sondeo de las cinco capacidades.
const SIN_GANCHO = { ausentes: [], noReconocidos: [] };

/** Lo mismo para los metros de fondo del gancho: sin ninguno pedido y sin nada que declarar. */
const SIN_METROS_DE_GANCHO = { metros: null, motivo: null };

/**
 * Las puertas de consulta que cuelgan de los ajustes y no de la portada: de ellas se vuelve
 * a A6P6 y no a A6P1. Es un dato y no dos condiciones repartidas, porque el atrás del sistema
 * y el «‹» de la pantalla tienen que hacer exactamente lo mismo.
 */
const VUELVEN_A_AJUSTES = ['empezar-de-nuevo', 'sitios-marcados'];

// `__DEV__` lo define el empaquetador. En una compilación de producción vale
// false y el gancho queda inerte, que es lo que impide que sea una puerta trasera.
const EN_DESARROLLO = typeof __DEV__ !== 'undefined' && __DEV__;

// La referencia al módulo queda dentro de la rama que Metro elimina en producción. No hay
// import estático: con `__DEV__ === false` ni su registro ni sus símbolos entran al bundle.
const creaCuadernoDelDispositivo = EN_DESARROLLO
  ? require('./desarrollo/cuaderno-del-dispositivo.js').creaCuadernoDelDispositivo
  : null;
const CuadernoEnAndamiaje = EN_DESARROLLO
  ? require('./desarrollo/cuaderno-en-andamiaje.jsx').CuadernoEnAndamiaje
  : null;

/**
 * La identidad de la salida viva, con **la única función que la compone**.
 *
 * Hasta esta fila había dos —una aquí para el área `salidas` y otra en `antes-de-salir.jsx`
 * para el área `aventuras`— y el cierre comparaba una con otra: la salida no se podía cerrar
 * nunca. Ahora la decide `app/marcha/identidad.js` y, con una salida ya abierta, se lee de
 * ella en lugar de recalcularse: aceptar una aventura anexa un hecho, así que recalcular
 * entre aceptar y echar a andar volvería a dar dos cadenas distintas.
 */
function identidadDeLaSalida(partida) {
  return identidadDeLaSalidaViva({
    aventuras: partida?.estado?.aventuras ?? null,
    mapaId: partida?.mundo?.mapaId ?? 'sin-mapa',
    hechos: partida?.registro?.hechos?.length ?? 0,
  });
}

export function App() {
  const [gancho, setGancho] = useState(SIN_GANCHO);
  const [cuaderno] = useState(() => (creaCuadernoDelDispositivo ? creaCuadernoDelDispositivo() : null));
  const [metrosDelGancho, setMetrosDelGancho] = useState(SIN_METROS_DE_GANCHO);
  // Si el sistema ha preguntado por qué se piden los permisos de salud. No es una pantalla:
  // es una entrada que aterriza en una que ya existe, y por eso vive como una petición
  // pendiente de aplicar y no como un momento más de la máquina.
  const [razonDePermisos, setRazonDePermisos] = useState(false);
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
  // La limpieza de la copia de trabajo entra por la puerta como todo lo que toca el
  // sistema de ficheros: `app/datos/` no cita la plataforma, y por eso el borrado puede
  // seguir corriéndose entero en `node --test`.
  const [empezarDeNuevo] = useState(() => creaEmpezarDeNuevo({ almacen, copia, limpiaCopiasDeTrabajo, nucleo: NUCLEO_DE_EMPEZAR_DE_NUEVO }));
  // La partida en disco, de la fila 47: congelarla en los cortes del juego y levantarla al
  // abrir. Antes de esta fila el estado se componía en memoria y se moría al cerrar.
  const [partidaGuardada] = useState(() => creaPartidaGuardada({ almacen, nucleo: NUCLEO_DE_LA_PARTIDA_GUARDADA }));
  // El casting vigente del mapa activo, con su memoria por (mapa, huella de los descartes).
  // Va aquí y no dentro de un momento porque lo consumen tres: la portada con su lista, la
  // capa de llegadas y su recuperación al reabrir la app.
  const [elCasting] = useState(() => creaElCasting({ nucleo: NUCLEO_DEL_CASTING }));
  const [enRevision, setEnRevision] = useState(false);
  const [enMapa, setEnMapa] = useState(false);
  // La app abre en el arranque **solo el primer día**. Desde la fila 47, quien decide por
  // dónde se entra es lo que haya escrito en disco, y hasta saberlo no se pinta ninguna de
  // las dos: enseñar el arranque y sustituirlo medio segundo después haría indistinguibles
  // «no hay partida» y «todavía no se sabe», que es la degradación que SPEC-040 ya cerró
  // para el borrado a medias.
  const [enArranque, setEnArranque] = useState(false);
  // En cuál de las cuatro respuestas de abrir la partida estamos, con el motivo literal
  // cuando no se pudo. Es lo que decide entre la espera, el arranque, la portada y la avería.
  const [apertura, setApertura] = useState({ estado: APERTURAS.ABRIENDO, motivo: null });
  // Lo que hay abierto: el estado de la partida, su registro de hechos, el personaje y el
  // mapa levantado. Desde la fila 47 ya no muere con la sesión.
  const [partida, setPartida] = useState(null);
  // La salida que se echó a andar, tal y como la declaró quien salió: con aventura preparada,
  // sin más, o retomando la que estaba a medias. Mientras vale `null` no se anda. No se vuelve
  // desde aquí: se sale de una salida llegando a casa o echando el telón, que es de la fila 36.
  const [salida, setSalida] = useState(null);
  // Lo mismo, en una referencia: la capa de llegadas se monta dentro de `abre()`, que ocurre
  // en la misma vuelta en la que se declara la salida, así que un estado de React todavía no
  // habría llegado. Es lo que hace que el reparto casteado alcance la capa el mismo día que
  // se acepta la aventura, y no el siguiente.
  const laSalidaEchada = useRef(null);
  // La vida de la salida, de SPEC-030 y cableada en la fila 48: el rótulo del sistema, la
  // única suscripción al sensor y las transiciones. Se monta cuando hay partida abierta y
  // **no antes**: sin mundo levantado no hay origen sobre el que proyectar los metros.
  const [laSalida, setLaSalida] = useState(null);
  // El área de salidas la muta el núcleo en sitio y React no se entera solo, así que cada
  // posición recibida sube este contador. Además viaja al momento en marcha: el seguidor es
  // un objeto estable y sin un valor que cambie la composición no se rehace, que es cómo la
  // marca se quedaría quieta pareciendo que se anda en círculos.
  const [pasoDeSalida, repintaLaSalida] = useState(0);
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
  // La puerta de desarrollo, abierta o no. No se persiste y no se puede abrir en
  // producción: `esPuertaDeDesarrollo` devuelve false sin mirar el enlace siquiera.
  const [enPuertaDeDesarrollo, setEnPuertaDeDesarrollo] = useState(false);
  // En qué mapa de la partida estás, o el ofrecimiento de levantar uno donde no llega
  // ninguno (A2P0). Es la mitad de SPEC-041 que hasta la fila 50 no llegó a la app:
  // `levantamiento.mapaActivo` no tenía consumidor y `antes-de-salir.jsx` esperaba un
  // `ofrecimiento` que nadie le pasaba, así que A2P0 era inalcanzable.
  //
  // Empieza en nulo y **no se supone nada mientras tanto**: hasta saber dónde estás se
  // enseña la portada del mapa que la partida trae, que es lo que había antes de esta
  // fila y no una pantalla en blanco. Lo que cambia al resolver es que, si no hay mapa
  // donde estás, la portada da paso al ofrecimiento.
  const [dondeEstas, setDondeEstas] = useState(null);
  // Rechazar el ofrecimiento. **No se persiste y es la decisión**: volver a abrir la app
  // aquí lo vuelve a ofrecer y no queda ninguna marca, porque recordar la negativa crea un
  // estado invisible que solo se puede explicar como aplicación (SPEC-041).
  const [ofrecimientoDejado, setOfrecimientoDejado] = useState(false);
  // Los pasos del día a día, de la fila 46: el motor del mapa activo y la orquestación que
  // lee la app de salud al abrir. Se montan **juntos y una sola vez por partida y mapa**,
  // dentro de la apertura y antes de que exista ninguna portada — el orden del cableado no
  // es negociable, porque componer la portada antes de leer dejaría la decisión de si hay
  // zurrón tomada con la reserva de ayer.
  //
  // Con `motor` en nulo hay `motivo`, y esa es la diferencia que impide confundir «no hay
  // mapa levantado» con «nadie lo cableó»: sin mapa no se monta motor, no se acredita ni un
  // metro y se dice por qué, en lugar de acreditar pasos a un mapa que no existe.
  const [elFondo, setElFondo] = useState(null);
  // La reserva la muta el núcleo en sitio —`vaciaReserva` sustituye el array entero— y React
  // no se entera solo. Este contador es lo que hace que la portada vuelva a leerla del motor
  // en lugar de quedarse con una referencia tomada antes del vaciado, que seguiría diciendo
  // que hay cinco pasos y volvería a ofrecer el zurrón recién vaciado.
  const [pasoDeFondo, repintaElFondo] = useState(0);
  // Qué capacidades pidió el gancho poner ausentes, en una referencia: ver `cableaElFondo`.
  const ausentesAhora = useRef(SIN_GANCHO.ausentes);
  ausentesAhora.current = gancho.ausentes;

  // Recupera la marca solo en desarrollo. La ausencia del fichero es cuaderno vacío y no
  // participa en la apertura de la partida, incluso si la caché fue purgada por el sistema.
  useEffect(() => {
    if (!cuaderno) return undefined;
    cuaderno.inicia().catch(() => {});
    return undefined;
  }, [cuaderno]);

  // El atrás de Android hace lo mismo que el «‹» de la pantalla, y no otra cosa. Que
  // discrepen es un defecto de plataforma y no una decisión: quien pulsa el del sistema
  // espera exactamente lo que promete el de la pantalla que está mirando.
  useEffect(() => {
    if (consulta === null && !enPuertaDeDesarrollo) return undefined;
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      // La puerta de desarrollo se cierra primero, porque está por encima de todo lo demás:
      // salir de ella devuelve exactamente donde se estaba, que es lo que la hace usable
      // para mirar una avería sin perder el sitio.
      if (enPuertaDeDesarrollo) {
        setEnPuertaDeDesarrollo(false);
        return true;
      }
      // Desde empezar de nuevo y desde la lista de sitios marcados se vuelve a los ajustes,
      // que es de donde cuelgan las dos; desde las otras tres, a la portada.
      setConsulta((abierta) => (VUELVEN_A_AJUSTES.includes(abierta) ? 'ajustes' : null));
      return true;
    });
    return () => suscripcion.remove();
  }, [consulta, enPuertaDeDesarrollo]);

  /**
   * Abrir la partida, que es lo primero que pasa y lo que decide qué se pinta.
   *
   * El orden importa y no es negociable. Primero se remata un borrado marcado: una
   * interrupción a mitad tiene un único final posible —el borrado acaba y se llega al
   * arranque— y no una partida con parte de sus documentos que se abre, parece jugable y
   * falla más tarde (SPEC-040, `decisiones-orquestador.md` §6h). Después se abre lo que
   * haya escrito, migrándolo si viene de una versión anterior. Y si algo no se puede leer
   * **se da la cara**: aquí no se cae nunca a `estadoInicial`, porque una partida que se
   * pierde y se parece a una que empieza es la peor cosa que este proyecto puede hacer.
   */
  const abreLaPartida = useCallback(async () => {
    setApertura({ estado: APERTURAS.ABRIENDO, motivo: null });
    let remate;
    try {
      remate = await empezarDeNuevo.terminaPendiente();
    } catch (e) {
      // La marca sigue puesta y el siguiente arranque vuelve a intentarlo. Lo que no se
      // hace es seguir y abrir una partida a medio borrar.
      return { estado: APERTURAS.NO_SE_PUDO, motivo: mensajeDeError(e) };
    }
    if (remate.habia) return { estado: APERTURAS.SIN_PARTIDA, motivo: null };

    const abierta = await partidaGuardada.abre();
    if (abierta.estado !== APERTURAS.ABIERTA) return abierta;

    // El mundo no está en el estado: se lee del almacén, sin red y sin pintar nada. Que no
    // haya mapa levantado todavía es un estado normal y no una avería.
    let mundo = null;
    try {
      mundo = await mundoDeLaPartida({
        almacen,
        nucleo: NUCLEO_DEL_MUNDO_GUARDADO,
        semilla: abierta.partida.estado.semilla,
      });
    } catch (e) {
      return { estado: APERTURAS.NO_SE_PUDO, motivo: mensajeDeError(e) };
    }
    return { ...abierta, mundo };
  }, [almacen, empezarDeNuevo, partidaGuardada]);

  /**
   * El cableado de los pasos del día a día, **en el orden que la fila 46 fija**.
   *
   * 1. Se arma el motor del mapa activo sobre las áreas vivas de la partida. Sin mapa con
   *    identificador de verdad aquí se para: no hay motor y no se acredita nada.
   * 2. Se monta el lector con la fuente de esta plataforma —Health Connect en Android, la
   *    pareja declarada en iOS— y su marca de agua, que vive **fuera de la partida** y por
   *    eso no viaja en la copia ni en el respaldo.
   * 3. Se lee la app de salud **una vez**, con el modo efectivo —pedido en los ajustes y con
   *    el permiso de verdad concedido— y los metros que salgan se convierten en pasos que
   *    entran en la reserva.
   *
   * Congelar es del llamador, que es quien tiene el registro: la reserva es estado, y
   * perderla al cerrar sería perder lo único que el mundo hizo mientras nadie miraba.
   *
   * Las ventanas de salida activa viajan **vacías y por escrito**: `lector.lee({ salidas })`
   * las restaría para no contar dos veces los mismos metros, y hoy nadie las guarda —no
   * pueden vivir en el estado, que no lleva marcas del reloj real—. Hoy eso no produce doble
   * conteo porque los metros de una salida activa no mueven el mundo por ningún camino;
   * la fila que cablee esa conversión traerá también las ventanas.
   */
  const cableaElFondo = useCallback(async ({ estado, mundo }) => {
    const armado = creaMotorDelMapaActivo({ nucleo: NUCLEO_DEL_MOTOR_DE_LA_PARTIDA, estado, mundo });
    // El gancho de capacidad ausente entra por aquí y no por un camino propio: pedir «salud»
    // ausente tiene que dar exactamente lo mismo que una compilación sin fuente.
    let fuente = null;
    if (!ausentesAhora.current.includes('salud')) {
      fuente = await creaFuenteDeSalud().catch(() => null);
    }
    const pasos = creaPasosDeFondo({
      nucleo: NUCLEO_DE_LOS_PASOS_DE_FONDO,
      lector: creaLectorDeSalud({ fuente, marca: creaMarcaDeAgua(almacen) }),
      ajustes: estado.ajustes,
    });
    let lectura = null;
    if (armado.motor) {
      lectura = await pasos.alAbrirLaApp({
        motor: armado.motor,
        tramo: estado.personaje?.tramo ?? null,
        salidas: [],
      });
    }
    return { ...armado, pasos, lectura };
    // El gancho se lee de una referencia y no de la dependencia a propósito: llega por un
    // enlace y por tanto **después** de que la apertura haya empezado, y meterlo en las
    // dependencias volvería a abrir la partida entera cada vez que cambiara.
  }, [almacen]);

  /** Lo que la portada necesita del personaje, con la palabra que se lee bajo el nombre. */
  const componePersonaje = useCallback((delEstado) => ({
    ...delEstado,
    // El oficio viaja dos veces y no es redundancia: la clave es con la que se filtra el
    // catálogo, y la palabra —con género, que por eso vive en la app— es la que se lee.
    oficioDicho: nombreCortoDeOficio(delEstado?.oficio, delEstado?.genero),
  }), []);

  /** Lo que se hace con cada una de las tres respuestas de abrir. Un solo sitio, no tres. */
  const aplicaApertura = useCallback((resultado) => {
    if (resultado.estado === APERTURAS.ABIERTA) {
      setPartida({
        estado: resultado.partida.estado,
        registro: resultado.partida.registro,
        personaje: componePersonaje(resultado.partida.estado.personaje),
        mundo: resultado.mundo ?? { mapaId: null, documento: null, titulo: null },
        arrancadaEn: Date.now(),
      });
      setSalida(null);
      setEnArranque(false);
    } else if (resultado.estado === APERTURAS.SIN_PARTIDA) {
      setPartida(null);
      setSalida(null);
      setEnArranque(true);
    }
    setApertura({ estado: resultado.estado, motivo: resultado.motivo ?? null });
  }, [componePersonaje]);

  /**
   * Abrir la partida **y cablear los pasos del día a día antes de aplicarla**.
   *
   * El orden es la pieza: con la apertura aplicada ya hay portada, y componerla antes de
   * leer dejaría la decisión de si hay zurrón tomada con la reserva de ayer, que es
   * exactamente el desfase de un día que nadie sabría explicar.
   *
   * Va en un solo sitio porque hay dos caminos que abren —el arranque de la app y la vuelta
   * tras importar una copia— y el segundo sustituye el estado entero: con el motor montado
   * sobre el estado anterior, acreditaría pasos a unas áreas que ya no son las de nadie.
   */
  const abreYCablea = useCallback(async () => {
    const resultado = await abreLaPartida();
    if (resultado.estado !== APERTURAS.ABIERTA) {
      setElFondo(null);
      return resultado;
    }
    const fondo = await cableaElFondo({ estado: resultado.partida.estado, mundo: resultado.mundo })
      // Que la app de salud no se pueda cablear no tumba la app: se declara y el juego sigue
      // igual, que es lo que su propia spec pide.
      .catch((e) => ({ motor: null, propagacion: null, cola: null, mapaId: null, pasos: null, lectura: null, motivo: mensajeDeError(e) }));
    // La reserva es estado: se congela aquí y no en el siguiente corte del juego, porque
    // perderla al cerrar sería perder lo único que el mundo hizo mientras nadie miraba.
    if (fondo.lectura?.pasos?.length) {
      await partidaGuardada.congela({ estado: resultado.partida.estado, registro: resultado.partida.registro }).catch(() => ({ escrito: false }));
    }
    setElFondo(fondo);
    return resultado;
  }, [abreLaPartida, cableaElFondo, partidaGuardada]);

  useEffect(() => {
    let vivo = true;
    abreYCablea()
      .then((resultado) => { if (vivo) aplicaApertura(resultado); })
      .catch((e) => { if (vivo) setApertura({ estado: APERTURAS.NO_SE_PUDO, motivo: mensajeDeError(e) }); });
    return () => { vivo = false; };
  }, [abreYCablea, aplicaApertura]);

  /**
   * Volver a abrir la partida después de que una copia haya sustituido lo que había.
   *
   * El sello se olvida a propósito: lo que hay en disco ya no es lo que esta sesión
   * congeló, y comparar con el sello viejo haría que la primera congelación de la partida
   * importada se saltara por «no ha cambiado nada».
   */
  const reabreTrasLaCopia = useCallback(() => {
    partidaGuardada.olvidaElSello();
    return abreYCablea()
      .then(aplicaApertura)
      .catch((e) => setApertura({ estado: APERTURAS.NO_SE_PUDO, motivo: mensajeDeError(e) }));
  }, [abreYCablea, aplicaApertura, partidaGuardada]);

  /**
   * Congelar lo que hay abierto. Se llama en los cortes del juego y no en cada cambio.
   *
   * Es idempotente: si el texto canónico del estado no ha cambiado desde la última
   * congelación no se reescribe nada, y por eso puede colgar de tantos sitios. Un fallo al
   * escribir no se traga —el sello no se mueve y el siguiente corte vuelve a intentarlo—
   * pero tampoco tiene todavía dónde enseñarse: decírselo a quien juega pide una superficie
   * que el diseño no tiene (pendiente 3 de `game-design/partida-guardada.md`).
   */
  const congelaLaPartida = useCallback((abierta) => {
    const viva = abierta ?? partida;
    if (!viva?.estado || !viva?.registro) return Promise.resolve({ escrito: false });
    return partidaGuardada.congela({ estado: viva.estado, registro: viva.registro })
      .catch((e) => ({ escrito: false, fallo: mensajeDeError(e) }));
  }, [partida, partidaGuardada]);

  /**
   * El mapa activo **con su casting vigente dentro**, que es la única fuente de la cadena.
   *
   * Desde que la lista de hoy recibe los sitios marcados, `repartoDeAventuras` vuelve a castear
   * cuando hay descartes, y `mundo.casting` dejó de ser lo que quien juega ve en la ficha:
   * medido sobre `costero` marcando un solo sitio, 24 de 29 aventuras seguían ofreciéndose con
   * otra cadena. Aquí se resuelve **una vez** y de aquí lo cogen todos —la portada y su lista,
   * la aceptación en el motor, la preparación, la capa de llegadas y su recuperación al reabrir
   * la app—, así que no hay dos caminos que se parezcan.
   *
   * Sin ningún sitio marcado devuelve el mismo objeto que trae la partida, así que el camino
   * normal no recompone nada y no cuesta nada.
   */
  const elMundo = useMemo(() => {
    if (!partida) return null;
    const documento = elCasting.mundoVigente({
      mundo: partida.mundo.documento ?? null,
      anclajes: partida.estado.anclajes,
      mapaId: partida.mundo.mapaId ?? 'sin-mapa',
    });
    // La misma referencia mientras el casting vigente no cambie: la petición de la lista y la
    // lámina memoizan por identidad, y un objeto nuevo en cada repintado las recompondría.
    return documento === partida.mundo.documento ? partida.mundo : { ...partida.mundo, documento };
  }, [partida, elCasting]);

  /**
   * El mapa **con el casting de la aventura en curso**: el que sale de los sitios que estaban
   * marcados cuando se aceptó, y no de los de ahora.
   *
   * Son dos mundos y la diferencia es la novena costura, así que conviene decirla en voz alta:
   * `elMundo` lleva lo marcado **ahora** y de él salen la lista de hoy y lo que se acepta;
   * este lleva lo marcado **cuando se aceptó** y de él salen la cadena que se recorre y la que
   * se recupera al reabrir la app. En el momento de aceptar son el mismo, porque la huella se
   * congela ahí; solo se separan si alguien marca un sitio a mitad de camino, que es
   * exactamente lo que no puede cambiarle el lazo a lo que ya se está andando.
   */
  const elMundoDeLaAventura = useMemo(() => {
    if (!partida || !elMundo) return null;
    return elCasting.mundoDeLaAventura({
      mundo: partida.mundo.documento ?? null,
      marcados: descartesDeLaAventura(partida.estado.aventuras),
    });
  }, [partida, elMundo, elCasting]);

  /**
   * El modo de pasos de fondo y la reserva del mapa activo, que es lo que decide si «Ver qué
   * se cuenta hoy» lleva al zurrón o a la lista.
   *
   * `pasoDeFondo` está en las dependencias a propósito y es la pieza entera: la reserva la
   * muta el núcleo en sitio y vaciarla sustituye el array, así que sin él esto se quedaría
   * con la lista de antes del vaciado y el zurrón se ofrecería recién vaciado. Y es un memo
   * y no un literal en el cuerpo porque el montaje del momento depende de su identidad:
   * un objeto nuevo en cada repintado reharía el conseguidor de recursos.
   */
  const loDeLaReserva = useMemo(() => ({
    modoDeFondo: partida?.estado?.ajustes?.pasosDelDiaADia === true,
    reserva: elFondo?.motor ? elFondo.motor.registro().reserva : [],
  }), [partida, elFondo, pasoDeFondo]);

  /** La partida con ese mismo mapa dentro. Una sola verdad viaja a las pantallas. */
  const laPartida = useMemo(
    () => (partida && elMundo ? { ...partida, mundo: elMundo } : partida),
    [partida, elMundo],
  );

  /**
   * Monta la vida de la salida en cuanto hay partida, y **reconcilia al arrancar**.
   *
   * Reconciliar es lo primero que se hace y no lo último: en Android el sistema puede
   * matar el servicio en primer plano y devolver el proceso, así que la situación guardada
   * puede estar diciendo que hay rótulo puesto cuando en la pantalla de bloqueo no hay
   * nada. Es el riesgo 4 del PRD, y por eso `presente()` existe.
   */
  useEffect(() => {
    if (!partida) {
      setLaSalida(null);
      return undefined;
    }
    let vivo = true;
    montaLaSalida({
      salidas: partida.estado.salidas,
      origen: elMundoDeLaAventura?.origin ?? null,
      // El documento del mundo, del que salen los geofences: de ellos cuelgan la cadencia
      // del muestreo y el sitio bajo la marca de posición.
      mundo: elMundoDeLaAventura ?? null,
      tramo: partida.estado.personaje?.tramo ?? null,
      alCambiar: () => repintaLaSalida((n) => n + 1),
      observa: cuaderno ? cuaderno.observa : null,
      // La capa de llegadas de la salida, montada sobre **su** detector. Se monta aquí y no
      // dentro de la vida de la salida porque necesita la partida entera —el área de sitios
      // pisados, la cola, el diario, los descartes— y esa la tiene esta raíz.
      //
      // Va **siempre y sin condición**: sin mundo levantado la fábrica falla nombrando lo que
      // falta y la salida no se abre con su motivo, que es la verdad —no se puede andar por un
      // mapa que no existe—. Condicionarla a que hubiera documento era la puerta por la que se
      // coló que nadie la pasara.
      montaLlegadas: ({ detector, salida: laQueSeAbre, mapaId }) => creaLasLlegadas({
        nucleo: NUCLEO_DE_LAS_LLEGADAS,
        // El motor de la aventura en curso, montado sobre el mismo reparto que la capa. Es lo
        // que resuelve el beat al cerrar su paso y lo que compone A4P3 y A4P4.
        aventura: creaLaAventuraEnCurso({
          nucleo: NUCLEO_DE_LA_AVENTURA_EN_CURSO,
          mundo: elMundoDeLaAventura,
          estado: partida.estado,
          reparto: repartoDeLaAventuraEnCurso({
            mundo: elMundoDeLaAventura,
            aventuras: partida.estado.aventuras,
          }),
          // El reloj de pared, que es la única entrada de la escena que no puede salir del
          // estado: es la hora del sistema, y `packages/nucleo/` no la lee. **Sin valor por
          // defecto**: el núcleo falla nombrándolo, que es lo que impide resolver una llegada
          // de franja como si fuera dentro sin saberlo (§6h).
          reloj: relojDePared(),
        }),
        mundo: elMundoDeLaAventura,
        cupos: elMundo.cupos ?? null,
        mapaId: mapaId ?? elMundo.mapaId,
        salida: laQueSeAbre,
        estado: partida.estado,
        registro: partida.registro,
        detector,
        // El reparto casteado **se recupera del mundo congelado**, y esa es la costura 5:
        // hasta esta fila viajaba con la salida que se echó a andar y al reabrir la app se
        // caía a `REPARTO_SIN_AVENTURA`, así que el paso de beat de una secuencia guardada
        // llegaba con el beat dentro en nulo (§10g). La cadena no se persiste: el casting es
        // determinista sobre el documento y el estado ya guarda de qué plantilla es.
        reparto: repartoDeLaAventuraEnCurso({
          mundo: elMundoDeLaAventura,
          aventuras: partida.estado.aventuras,
        }),
        dia: creaCalendario({ arrancadaEn: partida.arrancadaEn }).dia(),
      }),
    })
      .then(async (montada) => {
        if (!vivo) return;
        await montada.reconcilia();
        if (!vivo) return;
        setLaSalida(montada);
        repintaLaSalida((n) => n + 1);
      })
      // Que la vida de la salida no se monte no tumba la app: la portada sigue entera y
      // echar a andar responderá que no con su motivo, que es lo que hay que enseñar.
      .catch(() => { if (vivo) setLaSalida(null); });
    return () => { vivo = false; };
  }, [partida]);

  /**
   * El mapa de la partida y el traedor de topónimos, montados **una vez** y solo con
   * partida abierta: sin partida no hay mapas que resolver ni sitio donde levantar uno.
   */
  const elMapaDeLaPartida = useMemo(
    () => (partida ? montaElMapaDeLaPartida({ almacen, base: DIRECCION_DEL_PROXY }) : null),
    [partida, almacen],
  );

  /**
   * Resuelve en qué mapa estás, y compone el ofrecimiento cuando no estás en ninguno.
   *
   * Ocurre **al abrir la app con partida**, que es cuando el diseño lo pide: el mapa activo
   * lo decide dónde estás, y llegar a un sitio nuevo ofrece levantar uno. No se repite al
   * volver de una pantalla de consulta ni al cerrar una salida — entre esas cosas no te has
   * movido trescientos kilómetros, y volver a preguntar la posición sería mirar dónde está
   * quien juega sin ninguna razón de juego.
   */
  useEffect(() => {
    if (!partida || !elMapaDeLaPartida?.levantamiento) return undefined;
    let vivo = true;
    resuelveDondeEstas(
      {
        levantamiento: elMapaDeLaPartida.levantamiento,
        ubicacion: creaProveedorDeUbicacionDeExpo(Location) ?? proveedorSinMontar(),
        toponimos: elMapaDeLaPartida.toponimos,
        nucleo: NUCLEO_DEL_OFRECIMIENTO,
      },
      { semilla: partida.estado.semilla, tramoM: partida.estado.personaje?.tramo?.declaradoM ?? null },
    )
      .then((resuelto) => { if (vivo) setDondeEstas(resuelto); })
      // No saber dónde estás deja la portada del mapa que la partida trae, que es lo que
      // había: lo que no se hace es enseñar el ofrecimiento por no haber podido preguntar.
      .catch((e) => { if (vivo) setDondeEstas({ donde: DONDE.NO_SE_SABE, resolucion: null, ofrecimiento: null, motivo: mensajeDeError(e) }); });
    return () => { vivo = false; };
  }, [partida, elMapaDeLaPartida]);

  /**
   * «Levantar un mapa aquí», la acción principal de A2P0.
   *
   * Levanta el mapa donde estás **ahora** —se vuelve a preguntar la posición, porque entre
   * ver el ofrecimiento y decidirte puedes haber andado— y le corre su prólogo, que es lo
   * que le da pasado: rumores sedimentados, algo que contar en sus núcleos y su cola de
   * entregas. Hasta SPEC-050 `levanta()` no corría ninguno, así que el segundo mapa de una
   * partida nacía mudo y sin cola.
   *
   * El prólogo va con `primerMapa: false` y no es un detalle: la puesta en escena —el par
   * compuesto y la regla de la primera aventura— es del arranque y solo del arranque
   * (`arranque.md` §2), así que un mapa de vacaciones no puede pisar el par de casa.
   */
  const levantaUnMapaAqui = useCallback(async () => {
    if (!partida || !elMapaDeLaPartida?.levantamiento) return;
    try {
      const { levantado } = await levantaElMapaDeAqui(
        {
          levantamiento: elMapaDeLaPartida.levantamiento,
          ubicacion: creaProveedorDeUbicacionDeExpo(Location) ?? proveedorSinMontar(),
          nucleo: NUCLEO_DEL_MAPA_NUEVO,
        },
        {
          estado: partida.estado,
          tramoM: partida.estado.personaje?.tramo?.declaradoM ?? null,
          // La lámina se compone al tamaño real de la pantalla, que es donde se va a ver.
          tamano: { ancho: Math.round(Dimensions.get('window').width), alto: Math.round(Dimensions.get('window').height) },
          anclaje: PUNTO_DEL_ANCLAJE,
        },
      );
      // El mapa nuevo pasa a ser el de la partida por la **misma puerta** que el primero, y
      // no por una composición propia: ese camino ya se dejó `cupos` fuera una vez y el
      // descarte de un anclaje murió en toda instalación nueva.
      const mundoNuevo = mundoDeLaCelda({ mapaId: levantado.mapaId, registro: levantado.registro });
      setPartida((viva) => (viva ? { ...viva, mundo: mundoNuevo } : viva));
      // Y el motor se vuelve a armar **sobre el mapa que pasa a ser el activo**: la reserva
      // es por mapa, y seguir con el motor del anterior acreditaría los kilómetros de aquí
      // al mapa de donde ya no estás.
      cableaElFondo({ estado: partida.estado, mundo: mundoNuevo })
        .then((fondo) => setElFondo(fondo))
        .catch(() => setElFondo(null));
      // Se vuelve a resolver dónde estás: ahora sí hay mapa aquí, y lo que toca es su portada.
      setDondeEstas(null);
      setOfrecimientoDejado(false);
      congelaLaPartida();
    } catch (e) {
      // Levantar es lo único de esta pantalla que puede no poder: se dice con su motivo por
      // la misma puerta que la avería de apertura, y no se deja media partida montada.
      setApertura({ estado: APERTURAS.NO_SE_PUDO, motivo: mensajeDeError(e) });
    }
  }, [partida, elMapaDeLaPartida, congelaLaPartida, cableaElFondo]);

  /**
   * La red que cubre lo que ningún corte del juego cubre: **a una app la mata el sistema
   * sin avisar**, y no hay ningún evento de «me van a matar». `inactive` entra igual que
   * `background` porque en iOS es el que llega primero y a veces el único.
   */
  useEffect(() => {
    if (!partida) return undefined;
    const suscripcion = AppState.addEventListener('change', (siguiente) => {
      if (siguiente === 'background' || siguiente === 'inactive') congelaLaPartida();
      // Y al volver al primer plano se reconcilia otra vez: entre medias el sistema pudo
      // matar el servicio, y la salida no puede seguir creyéndose sostenida por él.
      if (siguiente === 'active' && laSalida) void laSalida.reconcilia();
    });
    return () => suscripcion.remove();
  }, [partida, congelaLaPartida, laSalida]);

  useEffect(() => {
    let vivo = true;
    const aplica = (url) => {
      // La puerta de desarrollo primero, y es independiente del gancho de capacidades: son
      // dos enlaces con anfitriones distintos y se pueden usar por separado o encadenados
      // —abrir la puerta y después poner una capacidad en rojo—, que es como se usa.
      if (esPuertaDeDesarrollo(url, EN_DESARROLLO) && vivo) setEnPuertaDeDesarrollo(true);
      // «¿Por qué me pides esto?». Llega como enlace profundo porque el plugin traduce el
      // intento del sistema —la acción a secas no llega a JavaScript—, y a partir de aquí es
      // navegación de la app y se decide **aquí**, que es donde las guardas lo ven. Se
      // guarda y lo aplica el efecto de abajo: el enlace puede llegar antes de que se sepa
      // si hay partida, y A6P6 presupone una.
      if (esRazonDePermisos(url) && vivo) setRazonDePermisos(true);
      // Los metros de fondo del gancho, que **no son navegación**: son una fuente de metros
      // y entran por el mismo camino que los de una lectura real, con el mismo tope y
      // respetando el interruptor. Se guardan aquí y los acredita el efecto de abajo, que es
      // el que puede esperar a que haya motor: el enlace llega antes de que la partida esté
      // abierta y acreditarlos en este mismo sitio sería acreditarlos a nada.
      const conMetros = leeMetrosDeFondo(url, EN_DESARROLLO);
      if (conMetros.metros !== null || conMetros.motivo !== null) setMetrosDelGancho(conMetros);
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

  /**
   * Lleva la pregunta del sistema a A6P6, **con su guarda**.
   *
   * La guarda es la mitad de la decisión y no un detalle de implementación: el sistema puede
   * disparar esto con la app recién instalada o con el arranque a medias, y A6P6 presupone
   * partida. Sin ella no se monta nada sobre una partida que no existe y se cae al arranque
   * de siempre, que es lo que la arista de `docs/flujo.md` declara.
   *
   * Se espera a que la apertura resuelva: mientras no se sabe si hay partida, decidir sería
   * decidir a cara o cruz.
   */
  useEffect(() => {
    if (!razonDePermisos || apertura.estado === APERTURAS.ABRIENDO) return;
    if (partida) setConsulta('ajustes');
    setRazonDePermisos(false);
  }, [razonDePermisos, apertura, partida]);

  /**
   * Acredita los metros que pidió el gancho, **por el camino de siempre**.
   *
   * Va aparte del enlace porque el enlace puede llegar antes de que haya partida abierta y
   * motor armado. Un valor que no es un número finito y no negativo no acredita nada y se
   * declara —`leeMetrosDeFondo` lo trae con su motivo—, en lugar de acreditar cero como si
   * se hubiera leído.
   */
  useEffect(() => {
    if (metrosDelGancho.metros === null || !partida || !elFondo?.motor || !elFondo?.pasos) return undefined;
    let vivo = true;
    elFondo.pasos
      .alAbrirLaApp({ motor: elFondo.motor, tramo: partida.estado.personaje?.tramo ?? null, metrosDeMas: metrosDelGancho.metros })
      .then(() => {
        if (!vivo) return;
        setMetrosDelGancho(SIN_METROS_DE_GANCHO);
        congelaLaPartida();
        repintaElFondo((n) => n + 1);
      })
      .catch(() => { if (vivo) setMetrosDelGancho(SIN_METROS_DE_GANCHO); });
    return () => { vivo = false; };
  }, [metrosDelGancho, partida, elFondo, congelaLaPartida]);

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

  // El andamiaje y su tira de pasos, en dos piezas para que la puerta de desarrollo y el
  // caso de «no hay partida» monten exactamente lo mismo. Se dibujaba solo en el segundo, y
  // duplicarlo habría sido dos andamiajes que se desincronizan en cuanto alguien toque uno.
  const laTiraDePasos = (
    <>
      {/* El paso al mapa. Existe en todas las compilaciones porque el mapa es del
          juego; lo provisional es el paso, no la pantalla. */}
      {!enRevision && !enMarcha ? (
        <Pressable onPress={() => setEnMapa((estaba) => !estaba)} style={estilos.paso} testID="paso-mapa">
          <Text style={estilos.pasoTexto}>{enMapa ? 'Volver al andamiaje' : 'El mapa'}</Text>
        </Pressable>
      ) : null}

      {/* El paso al momento en marcha, hermano del anterior y por la misma razón: el
          momento es del juego y a él se llega andando desde la portada, pero sin partida
          levantada no hay ninguna manera de abrirlo. */}
      {!enRevision && !enMapa ? (
        <Pressable onPress={() => setEnMarcha((estaba) => !estaba)} style={estilos.paso} testID="paso-marcha">
          <Text style={estilos.pasoTexto}>{enMarcha ? 'Volver al andamiaje' : 'En marcha'}</Text>
        </Pressable>
      ) : null}

      {/* El paso a la revisión del render. Solo en desarrollo, igual que la puerta por la
          que se llega hasta aquí. */}
      {EN_DESARROLLO && !enMapa && !enMarcha ? (
        <Pressable onPress={() => setEnRevision((estaba) => !estaba)} style={estilos.paso} testID="paso-revision-render">
          <Text style={estilos.pasoTexto}>{enRevision ? 'Volver al andamiaje' : 'El render en Skia'}</Text>
        </Pressable>
      ) : null}
    </>
  );

  const elMomentoDeDesarrollo = enMapa ? <MapaMontado almacen={almacen} /> : enMarcha ? (
    <EnMarchaMontado mundo={mundoDelPaso.documento} falloDeCableado={mundoDelPaso.fallo} />
  ) : enRevision ? (
    <RevisionMontada />
  ) : (
    <PantallaAndamiaje
      modulos={MODULOS_DE_PLATAFORMA}
      ausentes={gancho.ausentes}
      noReconocidos={gancho.noReconocidos}
      herramienta={cuaderno && CuadernoEnAndamiaje ? <CuadernoEnAndamiaje cuaderno={cuaderno} /> : null}
    />
  );

  // La puerta de desarrollo gana a todo lo demás, y a propósito: se abre para mirar por qué
  // algo va mal, y lo que va mal casi siempre va mal en medio de otra cosa. No toca la
  // partida ni la borra —queda montada detrás—, y se sale con el atrás del sistema.
  if (enPuertaDeDesarrollo) {
    return (
      <AreaSegura style={estilos.raiz}>
        {laTiraDePasos}
        {elMomentoDeDesarrollo}
      </AreaSegura>
    );
  }

  // Mientras no se sabe si hay partida no se pinta ninguna de las dos entradas: el papel
  // quieto y nada más. Sin texto y sin indicador a propósito —leer dos documentos tarda lo
  // que tarda un fichero, y un rótulo que aparece y desaparece en un fotograma es peor.
  if (apertura.estado === APERTURAS.ABRIENDO) {
    return <AreaSegura style={estilos.raiz}><View style={estilos.espera} testID="partida-abriendo" /></AreaSegura>;
  }

  // La avería: la partida guardada está y no se ha podido abrir. **No se cae al estado
  // inicial y no se ofrece continuar**, que sería lo mismo con otro nombre. Lo único que se
  // ofrece es abrir una copia, que es la salida real que la fila 39 dejó puesta.
  //
  // No es una pantalla del juego y no sale en `docs/flujo.md`: es la app confesando un
  // fallo, que es el único registro donde `lenguaje.md` deja hablar como aplicación. Su
  // texto definitivo sigue siendo el pendiente 3 de `game-design/partida-guardada.md`.
  if (apertura.estado === APERTURAS.NO_SE_PUDO) {
    return (
      <AreaSegura style={estilos.raiz}>
        <ScrollView contentContainerStyle={estilos.averia} testID="partida-averiada">
          <Text style={estilos.averiaTitular}>Tu partida guardada no se ha podido abrir.</Text>
          <Text style={estilos.averiaMotivo} testID="partida-averiada-motivo">{apertura.motivo ?? ''}</Text>
          <Text style={estilos.averiaCuerpo}>Nada se ha borrado. Si tienes una copia, ábrela.</Text>
          <AbrirCopia copia={copia} alAbrir={reabreTrasLaCopia} />
        </ScrollView>
      </AreaSegura>
    );
  }

  if (enArranque) {
    return (
      <AreaSegura style={estilos.raiz}>
        <ArranqueMontado
          almacen={almacen}
          copia={copia}
          // Importar una copia desde A1P1 sustituye la partida del almacén, y hasta esta
          // fila nadie volvía a leerla: se importaba y se seguía en el arranque como si
          // nada. Ahora se vuelve a abrir, que es lo que la fila 39 prometió.
          alAbrirCopia={reabreTrasLaCopia}
          alSalirAAndar={(cerrado, lista, levantado) => {
            if (!cerrado || !levantado) {
              setEnArranque(false);
              return;
            }
            // La partida **nace en disco**, no en memoria: se escribe su estado inicial con
            // el personaje que cerró el arranque dentro del área —el área es lo que se
            // congela y lo que se exporta— y su registro de hechos vacío. Antes de esta fila
            // esto se componía aquí mismo y se moría al cerrar la app.
            //
            // Y nace **con el prólogo dentro**, que es la costura de SPEC-050. Hasta esa
            // fila este parámetro se llamaba `lista` y no se usaba en ninguna línea: el
            // prólogo se componía entero —rumores sedimentados, lo que se cuenta en cada
            // núcleo, el par del arranque y las entradas de la cola— y se tiraba. El mundo
            // nacía sin pasado, `estado.nucleos` estaba siempre vacío y en un teléfono no
            // podía saltar ni un micro-encuentro. Sin lista compuesta no hay prólogo que
            // guardar y la partida nace igual, que es el caso de la celda sin contenido
            // jugable.
            partidaGuardada.nace({
              semilla: cerrado.semilla,
              personaje: cerrado.personaje,
              prologo: lista?.prologo ?? null,
            })
              .then(async (nacida) => {
                // Por la misma puerta que la partida abierta de disco, y no por una
                // composición propia: este camino se dejaba `cupos` fuera y el descarte
                // de un anclaje moría en toda instalación nueva.
                const mundoNuevo = mundoDeLaCelda({ mapaId: levantado.mapaId, registro: levantado.registro });
                // El motor del mapa activo se arma también aquí, y no solo al abrir una
                // partida de disco: sin él, el primer día no habría dónde acreditar nada y
                // el zurrón sería inalcanzable hasta el segundo arranque. No lee nada —el
                // modo viene apagado de origen— y por eso no hay que congelar detrás.
                const fondo = await cableaElFondo({ estado: nacida.estado, mundo: mundoNuevo })
                  .catch((e) => ({ motor: null, propagacion: null, cola: null, mapaId: null, pasos: null, lectura: null, motivo: mensajeDeError(e) }));
                setElFondo(fondo);
                setPartida({
                  estado: nacida.estado,
                  registro: nacida.registro,
                  personaje: componePersonaje({ ...nacida.estado.personaje, ...cerrado.personaje }),
                  mundo: mundoNuevo,
                  arrancadaEn: Date.now(),
                });
                setEnArranque(false);
              })
              // Si la partida no se puede escribir, se dice y no se juega: seguir sería
              // jugar una partida que se va a perder entera sin que nada proteste.
              .catch((e) => setApertura({ estado: APERTURAS.NO_SE_PUDO, motivo: mensajeDeError(e) }));
          }}
        />
      </AreaSegura>
    );
  }

  // **La escena que espera manda sobre todo lo demás**, y esa es la máquina entera: quien
  // decide qué se ve es el estado y no la puerta por la que se entró. Da igual que la app se
  // acabe de abrir o que se lleve media hora andando — si hay una llegada validada sin
  // cerrar, lo que se ve es su paso vigente (`bucle-jugable.md` §9). Y no se pone delante
  // sola: la llegada validó en silencio y esperó, sin encender la pantalla y sin avisar.
  const laEscenaQueEspera = partida && laSalida ? (laSalida.llegadas()?.espera() ?? null) : null;
  if (laEscenaQueEspera) {
    return (
      <LlegadaMontada
        llegadas={laSalida.llegadas()}
        textos={partida.estado.textos?.textos ?? {}}
        // Cerrar una llegada es un corte del juego y se congela: si la app muriera entre el
        // paso leído y el siguiente, la secuencia volvería por donde iba.
        alCambiar={() => {
          congelaLaPartida();
          repintaLaSalida((n) => n + 1);
        }}
        alTerminar={() => repintaLaSalida((n) => n + 1)}
      />
    );
  }

  // Con la salida echada a andar ya no hay portada: se anda. Es el momento en marcha sobre el
  // mapa que la partida levantó, y **no se dibuja envuelto en la raíz**: la lámina va a sangre,
  // de borde a borde, y el área segura le comería el borde superior.
  //
  // Las dos condiciones dicen cosas distintas y hacen falta las dos. `salida` es «se echó a
  // andar **en esta sesión**», que es lo que distingue andar de abrir la app con una salida a
  // medias de ayer —esa se ofrece desde la tarjeta de la portada y no metiéndote en el mapa—.
  // Y `enCurso()` es «y sigue andando», que es lo que faltaba: de las tres puertas de cierre,
  // las dos que se tocan devuelven el flag a nulo ellas mismas, pero **el regreso no lo toca
  // nadie** porque no lo dispara ningún toque —lo dispara una posición dentro de
  // `recibeLaPosicion`—. Medido el 13-ago-2026 en el aparato, la primera vez que el telón por
  // regreso fue alcanzable: la salida se cerraba bien, el flag se quedaba puesto y lo que se
  // veía era esta rama con el sensor ya parado, o sea el aviso de «no sé por dónde andas». El
  // telón solo aparecía reabriendo la app. Quien decide qué se ve es el estado, y esta línea
  // es donde eso se cumple o no.
  if (partida && salida && laSalida?.enCurso()) {
    return (
      <EnMarchaMontado
        mundo={elMundo.documento}
        salidas={partida.estado.aventuras}
        // El seguidor cuelga de la única suscripción de la salida. Sin él no se dibuja un
        // mapa con la marca quieta: se enseña la avería con su motivo del vocabulario
        // cerrado, que es lo que distingue «no sé por dónde andas» de «andas en círculos».
        seguidor={laSalida?.seguidor() ?? null}
        motivoSinUbicacion={laSalida?.seguidor() ? null : 'sensor-sin-responder'}
        // Sin capa de llegadas no se pinta el mapa: se dice por qué. Un mapa con la marca
        // moviéndose y ninguna escena posible es indistinguible de un mundo donde todavía no
        // has llegado a nada, y esa confusión es la que costó dos horas de emulador.
        falloDeCableado={laSalida?.llegadasSinCablear() ?? null}
        // La cadencia vigente de la suscripción, que no se pinta y solo se puede afirmar.
        // **Acercarse a un geofence no se dibuja**: si se dibujara sería el medidor de
        // progreso que `design-system.md` prohíbe, y un motivo para mirar el móvil andando.
        cadencia={laSalida?.cadencia() ?? null}
        // El último fallo recogido al recibir una posición, que hasta la fila 53 **no lo
        // consumía nadie**. Una posición que revienta al entrar en el núcleo deja la salida
        // sorda —no avanza el regreso, no avanza el plazo— y desde el aparato se veía
        // exactamente igual que una salida sana: mapa pintado, marca moviéndose y ningún
        // telón. Va a una marca y no a la pantalla porque no es del juego: es la
        // instrumentación que hace que la próxima vez se vea sin logcat.
        averia={laSalida?.averia() ?? null}
        paso={pasoDeSalida}
      />
    );
  }

  // El telón pendiente manda sobre la portada: una salida cerrada sin leer se lee antes de
  // abrir otra, y esa regla es de SPEC-030. El hueco que dejó la fila 48 ya no está: lo
  // sustituye su pantalla, que **echa el telón al montarse** y lo recorre entero.
  //
  // No va envuelto en el área segura: dos de sus seis pantallas llevan lámina a sangre, y el
  // área le comería el borde superior.
  if (partida && laSalida && laSalida.queOfrece() === 'telon') {
    return (
      <TelonMontado
        partida={laPartida}
        calendario={creaCalendario({ arrancadaEn: partida.arrancadaEn })}
        situacion={laSalida.situacion()}
        // Echar el telón es un corte del juego —entinta el mapa, ingresa el oro y apunta la
        // hoja del diario— y se congela en ese mismo corte.
        alEchado={() => congelaLaPartida()}
        // Las **dos** salidas de la última pantalla marcan el telón como leído, y ninguna otra
        // cosa lo marca. Si alguna no marcara, la app quedaría sin poder abrir ninguna salida,
        // que es el fallo silencioso con forma de app muerta de §10h.
        alLeido={() => {
          laSalida.marcaElTelonComoLeido();
          congelaLaPartida();
        }}
        alDiario={() => {
          laSalida.marcaElTelonComoLeido();
          congelaLaPartida();
          setConsulta('diario');
        }}
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
          mundo={elMundo}
          almacen={almacen}
          empezarDeNuevo={empezarDeNuevo}
          // La orquestación del interruptor de los pasos del día a día. Sin ella la fila no
          // cambia de valor, que es lo correcto: encenderla sin poder leer nada sería el
          // interruptor que miente.
          pasosDeFondo={elFondo?.pasos ?? null}
          // Tocar el interruptor cambia un ajuste de la partida, que es estado: se congela
          // en ese mismo corte y se repinta, porque el núcleo muta el área en sitio y una
          // aplicación que no repinta lo que acabas de tocar está rota.
          alCambiarAjuste={() => {
            congelaLaPartida();
            repintaElFondo((n) => n + 1);
          }}
          // El registro y el día, que es lo que deshacer un descarte necesita para dejar su
          // hecho: el deshacer es una transición más y no un borrado del registro.
          registro={partida.registro}
          dia={creaCalendario({ arrancadaEn: partida.arrancadaEn }).dia()}
          // Al volver se congela: es el sitio donde el estado puede cambiar sin que haya una
          // salida de por medio —los interruptores de ajustes cuando la fila 46 los conecte,
          // el estilo y el tamaño de letra cuando la 38 les dé pantalla de elección—. Ponerlo
          // después, cuando alguno empiece a escribir, es cómo se pierde un ajuste sin que
          // nada proteste; y como congelar es idempotente, hoy no escribe nada.
          alVolver={() => {
            congelaLaPartida();
            setConsulta(VUELVEN_A_AJUSTES.includes(consulta) ? 'ajustes' : null);
          }}
          alAbrirPuerta={(id) => setConsulta(id)}
          // Borrar lleva al arranque y a ningún otro sitio: es lo que distingue borrar de
          // reiniciar, y el destino lo declara el núcleo en `DESTINO_TRAS_BORRAR`. El sello
          // se olvida porque en disco ya no queda nada con lo que compararse.
          alBorrada={() => {
            partidaGuardada.olvidaElSello();
            setConsulta(null);
            setPartida(null);
            // El motor y la orquestación del fondo mueren con la partida: dejarlos montados
            // sobre un estado que ya no existe sería acreditar pasos a un mundo borrado.
            setElFondo(null);
            setSalida(null);
            setEnArranque(true);
            setApertura({ estado: APERTURAS.SIN_PARTIDA, motivo: null });
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
          // El registro de hechos y la identidad de la salida. La segunda es **la misma
          // función** que usa `alAndar` unas líneas más abajo: con dos, el cierre comparaba
          // una identidad contra otra y la salida no se podía cerrar nunca.
          registro={partida.registro}
          identidad={() => identidadDeLaSalida(partida)}
          personaje={partida.personaje}
          // **El mapa con su casting vigente**, que es de donde salen la lista de hoy, la
          // cadena que se acepta en el motor y los beats que se le piden a la preparación.
          mundo={elMundo}
          arrancadaEn={partida.arrancadaEn}
          // El modo y la reserva, que son lo que decide si «Ver qué se cuenta hoy» lleva al
          // zurrón o a la lista. El modo llega **como dato de la partida** —el núcleo no
          // consulta ninguna capa de la plataforma— y la reserva **se relee del motor en
          // cada composición**: vaciarla sustituye el array entero, así que una referencia
          // tomada antes seguiría diciendo que hay cinco pasos.
          zurron={loDeLaReserva}
          motor={elFondo?.motor ?? null}
          // Confirmar el zurrón escribe dos cosas —el hecho y la reserva vacía— y las dos
          // son estado: se congela en ese mismo corte, y se repinta porque el núcleo mutó
          // el área en sitio.
          alZurronVaciado={() => {
            congelaLaPartida();
            repintaElFondo((n) => n + 1);
          }}
          // Las cuatro maneras de echarse a andar pasan por aquí, y las cuatro llegan al mismo
          // sitio: «salir a andar» de la preparación, «salir a andar sin más» de la portada y de
          // la lista, y «seguir con ella» de la tarjeta de a medias. Que la de a medias no vuelva
          // a preparar nada es el criterio de SPEC-028 que esto cierra.
          // Echarse a andar es un corte del juego y se congela: es el punto de enganche que
          // la fila 44 encontrará puesto cuando cablee la máquina de una salida, junto con el
          // del telón. Hoy la salida todavía no cambia nada del estado, así que no escribe.
          // La vida de la salida, aquí. Las cuatro maneras de echarse a andar llegan a
          // este sitio, y **este sitio puede decir que no**: sin rótulo, sin permiso o sin
          // posición la salida no se abre y se devuelve el motivo literal, que la portada
          // enseña debajo de la acción que no pudo. Abrirla igual significaría o perder la
          // ubicación a los pocos minutos o pedir el permiso permanente.
          alAndar={async (echada) => {
            // Antes de abrir, porque abrir es lo que monta la capa de llegadas y el reparto
            // tiene que estar puesto cuando lo haga.
            laSalidaEchada.current = echada ?? { conAventura: false };
            if (!laSalida) {
              return { abierta: false, motivo: 'la vida de la salida no se ha podido montar en esta compilación, y sin ella el rótulo del sistema no sostiene nada' };
            }
            // «Seguir con ella» retoma la que ya estaba: vuelve a poner el rótulo y el
            // plazo cuenta de nuevo. No se abre otra, que es lo que SPEC-028 pedía.
            const respuesta = laSalida.situacion() === 'abierta-sin-rotulo'
              ? await laSalida.retoma().then((r) => ({ abierta: r.retomada, motivo: r.motivo }))
              : laSalida.situacion() === 'abierta-con-rotulo'
                ? { abierta: true, motivo: null }
                : await laSalida.abre({
                  salida: identidadDeLaSalida(partida),
                  mapa: partida.mundo.mapaId ?? 'sin-mapa',
                  destino: null,
                  mundo: partida.mundo.titulo ?? null,
                });
            congelaLaPartida();
            if (respuesta.abierta === false) return respuesta;
            setSalida(echada ?? { conAventura: false });
            return respuesta;
          }}
          // «Dejarlo aquí» de la tarjeta de a medias: la misma puerta que volver a casa,
          // con otro motivo anotado. Cierra la salida de verdad y retira el rótulo en la
          // misma transición, no en una posterior.
          alEcharElTelon={() => {
            if (!laSalida) return;
            void laSalida.dejarloAqui().then(() => {
              setSalida(null);
              congelaLaPartida();
            });
          }}
          situacionDeSalida={laSalida ? laSalida.situacion() : 'sin-salida'}
          estadoDelRotulo={laSalida ? laSalida.estadoDelRotulo() : 'no-disponible'}
          // A2P0, el ofrecimiento de levantar un mapa donde no llega ninguno de los tuyos.
          // Llega como propiedad y **sustituye a la portada** dentro de la pantalla, que es
          // lo que `antes-de-salir.jsx` hace desde SPEC-041 esperando a que alguien se la
          // pasara. Solo se ofrece con la resolución hecha: mientras no se sabe dónde estás
          // se enseña la portada del mapa que la partida trae.
          ofrecimiento={dondeEstas?.donde === DONDE.SIN_MAPA && !ofrecimientoDejado ? dondeEstas.ofrecimiento : null}
          alLevantarMapa={levantaUnMapaAqui}
          // «Dejarlo estar» cierra el ofrecimiento y **no escribe nada en ninguna parte**:
          // volver a abrir la app aquí lo vuelve a ofrecer.
          alDejarloEstar={() => setOfrecimientoDejado(true)}
          // Las tres puertas del pie de la portada. La composición del núcleo las declara
          // en `PUERTAS` y la pantalla las pinta; lo que faltaba era esto, que llevaran a
          // algún sitio.
          alAbrirPuerta={(id) => setConsulta(id)}
        />
      </AreaSegura>
    );
  }

  // Sin partida —una compilación que sale del arranque sin levantar nada— se queda el
  // andamiaje, que es lo que había antes de la fila 45. La puerta de desarrollo monta
  // exactamente esto mismo, y por eso las dos piezas están arriba y no aquí dentro.
  return (
    <AreaSegura style={estilos.raiz}>
      {laTiraDePasos}
      {elMomentoDeDesarrollo}
    </AreaSegura>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#efe3c0' },
  paso: { paddingHorizontal: 24, paddingVertical: 8 },
  pasoTexto: { fontSize: 13, color: '#1e2b18', opacity: 0.7 },
  // La espera ocupa la pantalla entera: una marca de 0×0 no existe para la automatización,
  // y esta tiene que poder afirmarse.
  espera: { flex: 1 },
  averia: { padding: 24, gap: 16 },
  averiaTitular: { fontSize: 20, color: '#1e2b18' },
  averiaMotivo: { fontSize: 13, lineHeight: 19, color: '#1e2b18', opacity: 0.75 },
  averiaCuerpo: { fontSize: 15, lineHeight: 22, color: '#1e2b18' },
});
