// La vida de una salida, cableada: abrir con el rótulo puesto, recibir posiciones, dejar
// que el plazo lo retire, reconciliar con lo que de verdad hay en la pantalla de bloqueo y
// cerrar por volver o a mano.
//
// **Aquí no se decide nada del juego.** Las cuatro situaciones, las transiciones, el plazo,
// el regreso y el telón que espera viven en `packages/nucleo/partida/salidas.js` desde
// SPEC-030, y lo único que faltaba era esto: alguien que los llamara. Lo que esta
// orquestación pone es el orden en el que se tocan las piezas de plataforma, que es el
// único sitio donde ese orden se puede equivocar.
//
// **Y el núcleo entra por la puerta** (SPEC-020, §6u): se enumera en `DEL_NUCLEO` y llega
// inyectado desde `app/nucleo/piezas.js`. Citar el paquete por su nombre desde aquí dejaría
// fuera del alcance de `node --test` sin instalación todo lo que de verdad se puede afirmar
// de esta fila —que hay una sola suscripción, que el plazo retira el rótulo sin cerrar la
// salida, que cerrar lo retira en la misma transición—, que es exactamente la regresión que
// las filas 20, 39, 40, 41, 42 y 47 pagaron una a una.
//
// Tres reglas de orden que este módulo existe para sostener:
//
// - **Una sola suscripción por salida**, y de ella cuelgan la fuente, el detector y el
//   seguidor. Dos darían dos series de posiciones con marcas distintas para el mismo
//   instante, y la traza clasificada dejaría de cuadrar con el plazo del rótulo.
// - **El servicio se arranca esperándolo, antes de abrir la salida.** `rotulo.pone()` es
//   síncrono por contrato, así que un fallo al arrancar el servicio se perdería dentro de
//   una promesa y la salida quedaría abierta creyéndose sostenida por nada.
// - **Se lee y se tira.** De cada posición sobreviven cuatro números el tiempo que tardan
//   en llegar al detector; lo que la partida escribe es el punto de partida y dos marcas,
//   que es lo que `AREA_SALIDAS` declara y ni un campo más.

import { CADENCIA_M, cadenciaPorDistancia, creaFuenteDePosiciones, creaTrazaDeSalida } from '../plataforma/posiciones.js';
import { SIN_SEGMENTO_TODAVIA, creaSeguidorDeLaSalida } from './seguidor.js';

/** Lo que esto le pide al generador, enumerado. Ni una función más. */
export const DEL_NUCLEO = Object.freeze([
  'abreSalida',
  'recibePosicion',
  'reconciliaConElRotulo',
  'retomaLaSalida',
  'dejarloAqui',
  'terminaDesdeElRotulo',
  'marcaElTelonComoLeido',
  'queOfreceAlAbrirLaApp',
  'situacionDeSalida',
  'estadoDelRotulo',
  'salidaEnCurso',
  'componeRotulo',
  'disponibilidadDelRotulo',
  'creaDetectorDeTransporte',
  'makeProjector',
  // SPEC-044. La cercanía a un geofence y la cadencia que sale de ella las decide el
  // paquete, y esta capa solo las aplica: son reglas de juego —dónde están los sitios a los
  // que se llega— y no detalle de sensor.
  'sitiosConPosicion',
  'cadenciaDeMuestreo',
  'CADENCIAS',
  // SPEC-048-iter-1. La cota de frescura, el tope de espera y el error máximo admitido se
  // **reciben** en lugar de copiarse: son una sola constante cada una y viven donde está
  // escrito su motivo. Y quién ancla el punto de partida —la puntual o la última
  // conocida— lo decide una función del paquete, con la misma cota para las dos puertas:
  // dos comparaciones parecidas en dos ficheros es exactamente el defecto de fondo con
  // otra cara. **La cota viaja a las dos puertas** desde SPEC-053: la de la última conocida
  // la certifica el módulo nativo y la de la puntual, la capa de plataforma con su reloj.
  'COTA_DE_FRESCURA_MS',
  'TOPE_DE_ESPERA_MS',
  'ERROR_MAXIMO_PARA_ANCLAR_M',
  'decideElPuntoDePartida',
]);

/**
 * Los motivos por los que echar a andar no abre la salida. **Vocabulario cerrado**, y es lo
 * que hace que «no montada» y «montada y no disponible» se puedan ver distintas: son dos
 * problemas que se arreglan en sitios distintos.
 */
export const MOTIVOS_DE_NO_ABRIR = Object.freeze([
  'rotulo-no-montado',
  'rotulo-no-disponible',
  'permiso-denegado',
  'permiso-no-preguntable',
  'sensor-sin-responder',
  'ya-hay-salida',
  'telon-pendiente',
  // La capa de llegadas no se pudo montar. Abrir igual dejaría andando a quien no puede
  // llegar a ningún sitio: el mapa se pintaría, la marca se movería y ninguna escena
  // aparecería nunca. Es una respuesta con motivo literal, no una avería que se traga.
  'llegadas-sin-cablear',
]);

function mensaje(e) {
  if (e && typeof e.message === 'string' && e.message) return e.message;
  return String(e);
}

/**
 * Una copia mutable de un área congelada. Devuelve **la misma referencia** si ya lo era, que
 * es el caso normal y el que no se puede tocar: el área que se muta tiene que seguir siendo
 * la que la partida congela y exporta.
 *
 * Existe como red y no como camino. `cargaPartida` devuelve lo suyo con `congelaHondo`, y
 * quien abra la partida sin deshelarla —hasta el 11-ago-2026, `app/datos/partida-guardada.js`—
 * le pasaría a esta orquestación un área que `abreSalida` no puede mutar. Lo que se llevaba
 * puesto era un `TypeError` del intérprete enseñado bajo «Salir a andar», que no es ni una
 * respuesta del vocabulario cerrado ni algo que nadie pueda arreglar leyéndolo. Con la red,
 * lo peor que pasa es lo declarado en `areaPropia()`; sin ella, la app se rompía el segundo
 * día. El arreglo de verdad está en quien abre la partida, y esto es lo que impide que el
 * mismo descuido vuelva a salir por la peor puerta posible.
 */
function descongelaElArea(salidas) {
  if (!Object.isFrozen(salidas)) return { area: salidas, descongelada: false };
  const copia = (valor) => {
    if (Array.isArray(valor)) return valor.map(copia);
    if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, copia(v)]));
    return valor;
  };
  return { area: copia(salidas), descongelada: true };
}

/**
 * La respuesta de «no se abre», con su marca comprobada contra el vocabulario cerrado. Una
 * marca inventada falla aquí y no en la pantalla, que es donde nadie la miraría.
 */
function noSeAbre(marca, motivo) {
  if (!MOTIVOS_DE_NO_ABRIR.includes(marca)) {
    throw new Error(`"${marca}" no es un motivo por el que una salida no se abra: los declarados son ${MOTIVOS_DE_NO_ABRIR.join(', ')}`);
  }
  return { abierta: false, marca, motivo };
}

/**
 * Monta la vida de una salida.
 *
 * @param {object} piezas
 *   `nucleo` el generador con lo que enumera `DEL_NUCLEO`; `salidas` el área de la partida,
 *   que es lo que se muta y se congela; `rotulo` la capacidad de plataforma ya resuelta —el
 *   sin montar cuenta y su motivo se enseña—; `suscripcion` la única del sensor, o `null` si
 *   esta compilación no la trae; `origen` el `{lat, lon}` del mundo congelado; `tramo` el de
 *   quien juega, del que sale la distancia de alejamiento del regreso; `alCambiar` a quién
 *   se avisa cuando algo se movió, que es cómo la pantalla se entera sin sondear.
 */
export function creaLaSalida({
  nucleo,
  salidas: areaRecibida,
  rotulo,
  suscripcion = null,
  origen = null,
  mundo = null,
  tramo = null,
  alCambiar = null,
  pidePermisoDeAviso = null,
  montaLlegadas = null,
}) {
  if (!nucleo) throw new Error('la vida de una salida necesita el núcleo inyectado: es quien decide las transiciones, el plazo y el regreso');
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] == null);
  if (faltan.length) {
    throw new Error(`al núcleo inyectado le faltan ${faltan.length} pieza(s) de la vida de una salida: ${faltan.join(', ')}`);
  }
  if (!areaRecibida || typeof areaRecibida !== 'object' || !('salida' in areaRecibida)) {
    throw new Error('la vida de una salida se monta sobre el área de salidas de la partida y llegó otra cosa');
  }
  // El área sobre la que se trabaja de verdad. Con una mutable —el caso normal— es la misma
  // que llegó, y por eso lo que se abre acaba en la partida que se congela.
  const { area: salidas, descongelada } = descongelaElArea(areaRecibida);
  if (!rotulo) {
    throw new Error(
      'la vida de una salida se monta con el rótulo del sistema, aunque sea el que dice que no está: sin él, abrir una salida ' +
      'no podría responder cuál es la capacidad que falta y se abriría en silencio',
    );
  }

  // El índice de geofences del mapa activo, del que cuelgan la cadencia del muestreo y el
  // sitio que el seguidor nombra. **Con origen tiene que haber mundo**: el origen sale del
  // documento del mundo levantado, así que uno sin el otro es un cableado a medias y no un
  // estado del juego. Sin mapa levantado no hay geofences y tampoco hay seguidor.
  if (origen && !mundo) {
    throw new Error(
      'la vida de una salida recibe el origen del mundo congelado y no su documento: sin él no hay índice de geofences, ' +
      'y sin índice ni el sitio del seguidor ni la cadencia del muestreo se pueden resolver',
    );
  }
  const sitios = mundo ? nucleo.sitiosConPosicion(mundo) : null;
  const proyector = origen ? nucleo.makeProjector(origen.lat, origen.lon) : null;

  // La traza y el seguidor viven **lo que dura la salida** y se montan al abrirla: un
  // detector que sobreviviera a un cierre arrastraría la racha de la salida anterior a la
  // siguiente, que es la manera de que un autobús de ayer clasifique lo de hoy.
  let traza = null;
  let seguidor = null;
  let averia = null;
  // El detector de esta salida y la capa de llegadas que cuelga de él. Van juntos y mueren
  // juntos: una capa de llegadas que sobreviviera a un cierre ofrecería la escena de otro
  // día, y `creaLlegadas` ya la vacía al cambiar de salida.
  let detector = null;
  let llegadas = null;
  // Por qué la capa de llegadas no está montada, cuando debería estarlo. Va aparte de
  // `averia` porque tiene consumidor propio: sin capa no hay ninguna llegada posible, así
  // que se dice en la portada al no poder abrir y en el momento en marcha si aparece después.
  let sinCablear = null;
  // La cadencia puesta, que es lo que la histéresis necesita saber para no cambiarla en cada
  // muestra del borde. Arranca por distancia porque es lo que declara SPEC-048.
  let cadencia = cadenciaPorDistancia(CADENCIA_M);

  const montaLaTraza = () => {
    const fuente = creaFuenteDePosiciones({ lee: () => suscripcion.lee() });
    detector = nucleo.creaDetectorDeTransporte();
    traza = creaTrazaDeSalida({ fuente, detector });
    seguidor = origen ? creaSeguidorDeLaSalida({ fuente, traza, origen, nucleo, sitios }) : null;
    llegadas = null;
  };

  /**
   * Monta la capa de llegadas sobre **el detector de esta salida**, que es el mismo que
   * clasifica la traza: montarla con uno propio daría dos clasificaciones distintas para la
   * misma posición, y el vehículo se apartaría en un sitio y en el otro no.
   *
   * Devuelve el motivo por el que no se pudo, o `null`. **Se devuelve y no solo se anota**:
   * hasta que `wa-qa-dev` lo midió en el emulador, esto recogía la excepción en `averia` y
   * ahí se quedaba —nadie consumía `averia()` en toda la app—, así que la salida se abría,
   * el mapa se pintaba y ninguna llegada podía validar jamás **sin que nada protestara**. Es
   * la forma de fallo que esta fila vino a cerrar, cometida por la propia fila.
   */
  const montaLasLlegadas = ({ salida = null, mapa = null } = {}) => {
    if (!montaLlegadas || !detector) return null;
    const enCurso = nucleo.salidaEnCurso(salidas);
    const cual = salida ?? enCurso?.salida ?? null;
    const suMapa = mapa ?? enCurso?.mapa ?? null;
    if (!cual) return null;
    try {
      llegadas = montaLlegadas({ detector, salida: cual, mapaId: suMapa });
      sinCablear = null;
      return null;
    } catch (e) {
      llegadas = null;
      sinCablear = mensaje(e);
      averia = sinCablear;
      return sinCablear;
    }
  };

  /** El punto de una posición cruda en metros del mundo, o `null` sin mapa levantado. */
  const enMetros = (cruda) => (proyector && cruda ? proyector.toXY(cruda.lat, cruda.lon) : null);

  /**
   * El punto de partida de la salida abierta, en metros del mundo, o `null` si no hay
   * ninguna. Va a la decisión de cadencia **por la firma** y no al índice de geofences: el
   * índice alimenta a la vez la cadencia y las llegadas, y meterlo ahí convertiría el
   * portal de casa en un sitio al que se llega.
   */
  const casaEnMetros = () => {
    const enCurso = nucleo.salidaEnCurso(salidas);
    return enCurso ? enMetros(enCurso.partida) : null;
  };

  /**
   * Decide la cadencia con la última posición conocida y la aplica **sin parar el
   * servicio**. Devuelve si cambió, que es lo único que hace falta saber fuera.
   *
   * Sin mapa levantado no hay geofences, así que no hay nada que decidir: la de distancia se
   * queda puesta, que es la de SPEC-048.
   */
  const ajustaLaCadencia = async (punto, puntoDePartida = casaEnMetros()) => {
    if (!sitios || !punto) return false;
    cadencia = nucleo.cadenciaDeMuestreo({
      posicion: punto,
      sitios,
      vigente: cadencia.modo,
      metrosPorDistancia: CADENCIA_M,
      puntoDePartida,
    });
    if (!suscripcion || typeof suscripcion.aplicaCadencia !== 'function') return false;
    return suscripcion.aplicaCadencia(cadencia);
  };

  /**
   * Busca con qué anclar el punto de partida: la puntual **con tope y con cota**, y si no
   * trae nada dentro de ella, la última conocida por la misma regla.
   *
   * Las dos puertas se prueban siempre, **las dos se piden con la misma cota** y decide el
   * paquete, que es lo que hace imposible que a una se le aplique un rasero y a la otra
   * otro. Quién certifica la frescura es lo que cambió en SPEC-053: la de la última conocida
   * la certifica el módulo nativo con su `maxAge` y la de la puntual la certifica la capa de
   * plataforma con el reloj del sistema, porque la puntual no admite edad máxima. Antes lo
   * decidía el paquete comparando las dos marcas entre sí, y sin última conocida —el estado
   * de `wa-pixel`, con su último fijo de 25 h 24 min— se caía con ella una puntual fresca. Y **lo que decide el motivo cuando
   * no hay nada es el estado del permiso**, no el texto de la excepción: hasta esta fila
   * cualquier fallo de la posición se archivaba como `permiso-denegado` con el permiso
   * concedido, y el motivo que se enseñaba mandaba a quien juega a arreglar algo que no
   * estaba roto.
   *
   * @returns `{ ancla, origen, marca, motivo }`. Con `ancla` en nulo, `marca` es la del
   *   vocabulario cerrado que hay que enseñar.
   */
  const buscaConQueAnclar = async () => {
    let puntual = null;
    let fallo = null;
    try {
      puntual = await suscripcion.posicionPuntual({ topeMs: nucleo.TOPE_DE_ESPERA_MS, cotaMs: nucleo.COTA_DE_FRESCURA_MS });
    } catch (e) {
      fallo = mensaje(e);
    }
    let ultimaConocida = null;
    try {
      ultimaConocida = typeof suscripcion.ultimaConocida === 'function'
        ? await suscripcion.ultimaConocida({ cotaMs: nucleo.COTA_DE_FRESCURA_MS, precisionM: nucleo.ERROR_MAXIMO_PARA_ANCLAR_M })
        : null;
    } catch (e) {
      fallo = fallo ?? mensaje(e);
    }

    const elegido = nucleo.decideElPuntoDePartida({ puntual, ultimaConocida });
    if (elegido.ancla) return { ...elegido, marca: null };

    const permiso = typeof suscripcion.estadoDelPermiso === 'function' ? await suscripcion.estadoDelPermiso() : 'no-se-sabe';
    const detalle = fallo ? ` — ${fallo}` : '';
    if (permiso === 'denegado') {
      return { ancla: null, origen: null, marca: 'permiso-denegado', motivo: `sin una posición no hay punto de partida, y sin punto de partida no hay regreso que detectar${detalle}` };
    }
    if (permiso === 'no-preguntable') {
      return { ancla: null, origen: null, marca: 'permiso-no-preguntable', motivo: `no se ha podido preguntar por el permiso de ubicación, y sin una posición no hay punto de partida${detalle}` };
    }
    // Concedido, o sin poder preguntar por el estado: el permiso no es el problema y
    // decirlo lo sería. Lo que pasa es que no hay ninguna posición con la que anclar.
    return { ancla: null, origen: null, marca: 'sensor-sin-responder', motivo: `${elegido.motivo}: sin punto de partida no hay regreso que detectar${detalle}` };
  };

  const desmontaLaTraza = () => {
    traza = null;
    seguidor = null;
    detector = null;
    llegadas = null;
  };

  const avisa = () => {
    if (alCambiar) alCambiar();
  };

  const paraElSensor = async () => {
    desmontaLaTraza();
    if (!suscripcion) return;
    try {
      await suscripcion.para();
    } catch (e) {
      // Que el sistema ya hubiera parado el servicio no es un fallo: se anota y se sigue,
      // porque lo que importa —que no queda nadie leyendo— es cierto en los dos casos.
      averia = mensaje(e);
    }
  };

  /**
   * Lo que hace cada posición que entrega el sensor. **Una sola llamada al núcleo**, que
   * mira primero el regreso —que cierra— y solo si no ha vuelto el plazo —que retira el
   * rótulo—: partirla en dos e invertir el orden dejaría abierta una salida que ha vuelto
   * a casa.
   */
  const recibeLaPosicion = async () => {
    if (!traza) return null;
    if (nucleo.situacionDeSalida(salidas) !== 'abierta-con-rotulo') return null;
    let paso = null;
    try {
      const cruda = traza.muestrea();
      if (cruda == null) return null;
      // La cadencia se ajusta **con cada posición y antes de nada**: es lo que hace que
      // pararse dentro de un geofence siga entregando fijos, y sin fijos no hay permanencia
      // que contar. Fuera de un geofence esto no cambia nada y no vuelve a pedir la
      // suscripción, porque la respuesta es la misma que ya estaba puesta.
      const punto = enMetros(cruda);
      await ajustaLaCadencia(punto);
      const segmentos = traza.traza().segmentos;
      const ultimo = segmentos.length ? segmentos[segmentos.length - 1] : null;
      // La capa de llegadas se alimenta **posición a posición y con la precisión declarada
      // dentro**: la precisión elige la ventana de parada y se tira ahí mismo, sin guardarse
      // en ninguna parte, igual que el rumbo y la altitud. Va antes del regreso porque una
      // llegada validada en la última posición de la salida sigue siendo una llegada.
      if (llegadas && punto) {
        llegadas.comprueba([{
          x: punto.x,
          y: punto.y,
          tMs: cruda.tMs,
          precisionM: cruda.precisionM ?? null,
          clasificacion: ultimo ? ultimo.clasificacion : SIN_SEGMENTO_TODAVIA,
        }]);
      }
      paso = nucleo.recibePosicion(salidas, {
        // La clasificación la produce el detector del núcleo y **no** esta capa. Sin
        // segmento todavía viaja `null`, que para el plazo es «no cuenta como metro
        // propio»: la marca con la que se abrió la salida ya cubre ese arranque.
        posicion: { ...cruda, clasificacion: ultimo ? ultimo.clasificacion : null },
        tramo,
        rotulo,
      });
    } catch (e) {
      // Una posición con la marca hacia atrás falla nombrándola, y aquí se recoge en vez
      // de morir dentro de una devolución de llamada del sistema, donde nadie la vería.
      averia = mensaje(e);
      avisa();
      return null;
    }
    if (paso.cierre || paso.retirada) await paraElSensor();
    avisa();
    return paso;
  };

  return {
    /**
     * El área que esta orquestación muta de verdad, y si tuvo que descongelarla.
     *
     * Se publica porque una copia es una degradación y las degradaciones se declaran (§6h):
     * si `descongelada` sale `true`, lo que se abra **no está en la partida que se congela**
     * y hay que arreglarlo en quien abrió la partida, no aquí. Con la partida abierta como
     * es debido sale `false` y el área es la misma que llegó.
     */
    areaPropia: () => ({ area: salidas, descongelada }),

    /** La traza clasificada de la salida en curso, o `null`. No se guarda en ningún sitio. */
    traza: () => traza,

    /** El seguidor del momento en marcha, o `null` si no hay salida abierta con sensor. */
    seguidor: () => seguidor,

    /**
     * La capa de llegadas de esta salida, o `null`. De ella cuelga toda la máquina del
     * momento «al parar»: la escena que espera, su paso vigente y el descarte del anclaje.
     */
    llegadas: () => llegadas,

    /** El último fallo recogido, o `null`. Es lo que la pantalla enseña como motivo literal. */
    averia: () => averia,

    /**
     * Por qué no hay capa de llegadas, o `null` cuando la hay.
     *
     * Tiene consumidor, y esa es toda su razón de ser: el momento en marcha lo enseña como
     * avería en vez de pintar un mapa donde nunca va a pasar nada. Una salida abierta sin
     * esta capa no es una salida degradada, es una salida en la que el juego no ocurre.
     */
    llegadasSinCablear: () => (llegadas ? null : sinCablear),

    /**
     * La cadencia con la que se está pidiendo posición, del vocabulario cerrado del paquete.
     *
     * Se publica porque es lo único que hace afirmable **desde el aparato** que el muestreo
     * cambia al entrar en un geofence: sobre la función pura se puede afirmar la decisión,
     * nunca que la suscripción la haya aplicado.
     */
    cadencia: () => cadencia.modo,

    /** El índice de geofences del mapa activo, o `null` sin mapa levantado. */
    geofences: () => sitios,

    /** La situación de la salida: una de las cuatro, o la nada. */
    situacion: () => nucleo.situacionDeSalida(salidas),

    /** El estado del rótulo, con el vocabulario cerrado que declara `salidas.js`. */
    estadoDelRotulo: () => nucleo.estadoDelRotulo(salidas, { rotulo }),

    /** Qué se ofrece al abrir la app: el telón, la salida a medias o la portada. */
    queOfrece: () => nucleo.queOfreceAlAbrirLaApp(salidas),

    /** La salida en curso, o `null`. */
    enCurso: () => nucleo.salidaEnCurso(salidas),

    /** Lo que llega del sensor. Se publica para que quien monta la suscripción lo enganche. */
    recibeLaPosicion,

    /**
     * Abre una salida.
     *
     * El orden es el que sostiene la promesa: **rótulo, permiso, posición, y solo entonces
     * la transición**. Los tres primeros pueden decir que no, y decir que no es una
     * respuesta que la portada enseña con su motivo; nada de esto se abre en silencio.
     */
    // `nombreDelMundo` es el título que se lee en el rótulo, no el documento del mundo: el
    // documento entra al montar la salida y el título viaja por aquí. Se llamaban los dos
    // `mundo` y uno tapaba al otro, que es la clase de confusión que §8c describe.
    async abre({ salida, mapa, destino = null, mundo: nombreDelMundo = null, aventura = null }) {
      averia = null;
      const disponible = nucleo.disponibilidadDelRotulo(rotulo);
      if (!disponible.hay) {
        return noSeAbre(rotulo.montado === true ? 'rotulo-no-disponible' : 'rotulo-no-montado', disponible.motivo);
      }
      if (!suscripcion) {
        return noSeAbre('sensor-sin-responder', 'esta compilación no trae el módulo de ubicación en marcha, y sin posiciones una salida no podría cerrarse nunca por regreso');
      }

      // El permiso de notificaciones se pide **aquí y no antes**: `permisos.js` lo declara
      // «al abrir la primera salida, con el rótulo del sistema», y A1P3 tiene que enseñar
      // un solo diálogo. Denegarlo **no impide abrir**: el servicio corre igual y la
      // ubicación se sigue leyendo; lo que se pierde es que el rótulo se vea, y eso se
      // arregla en los ajustes del sistema. Tratarlo como avería dejaría sin jugar a quien
      // dijo que no a una notificación.
      if (pidePermisoDeAviso) {
        try {
          await pidePermisoDeAviso();
        } catch (e) {
          averia = mensaje(e);
        }
      }

      const conQueAnclar = await buscaConQueAnclar();
      if (!conQueAnclar.ancla) return noSeAbre(conQueAnclar.marca, conQueAnclar.motivo);
      const punto = conQueAnclar.ancla;

      // La cadencia se decide **con el punto de partida y antes de arrancar**: quien abre
      // la salida ya parada dentro de un geofence no puede esperar al fijo que la cambiaría,
      // porque ese fijo es justo el que la cadencia por distancia no va a entregar. Y el
      // punto de partida entra además como razón por sí mismo: abrir la salida en casa
      // arranca ya por tiempo, que es lo que hace que al volver la permanencia acumule.
      const punto0 = enMetros(punto);
      if (sitios && punto0) {
        cadencia = nucleo.cadenciaDeMuestreo({ posicion: punto0, sitios, vigente: null, metrosPorDistancia: CADENCIA_M, puntoDePartida: punto0 });
      }

      // El servicio se arranca **esperándolo**: `rotulo.pone()` es síncrono por contrato y
      // un fallo aquí se perdería dentro de una promesa. Volver a pedirlo desde `pone()` no
      // abre una segunda suscripción: es la misma tarea con las mismas opciones.
      const compuesto = nucleo.componeRotulo({ destino, mundo: nombreDelMundo });
      try {
        await suscripcion.arranca(compuesto, cadencia);
      } catch (e) {
        return noSeAbre('rotulo-no-disponible', `el servicio en primer plano no arrancó, y sin él la salida perdería la ubicación a los pocos minutos — ${mensaje(e)}`);
      }

      montaLaTraza();
      // La capa de llegadas **antes de abrir**, no después: si no se puede montar, lo que
      // hay que hacer es no abrir, y para eso el estado tiene que seguir intacto. Montarla
      // después dejaría una salida abierta con el sensor parado, que no es ninguno de los
      // cuatro estados que `salidas.js` declara.
      const falta = montaLasLlegadas({ salida, mapa });
      if (falta) {
        await paraElSensor();
        return noSeAbre('llegadas-sin-cablear', falta);
      }

      let abierta;
      try {
        abierta = nucleo.abreSalida(salidas, {
          salida,
          mapa,
          aventura,
          destino,
          mundo: nombreDelMundo,
          partida: { lat: punto.lat, lon: punto.lon },
          tMs: punto.tMs,
          // De qué puerta salió el ancla. Se anota **al abrir** porque después no hay
          // manera de saberlo, y es lo que hace afirmable que la apertura se respaldó sin
          // tener que deducirlo de que la salida se abrió.
          origenDelPunto: conQueAnclar.origen,
          rotulo,
          fuente: { posicion: () => suscripcion.lee() },
        });
      } catch (e) {
        // Una salida ya abierta o un telón sin leer son avería y no decisión: el núcleo
        // lanza nombrando la que estaba, y aquí no se abre nada ni se deja el servicio
        // corriendo sin salida que lo sostenga.
        await paraElSensor();
        return noSeAbre(nucleo.queOfreceAlAbrirLaApp(salidas) === 'telon' ? 'telon-pendiente' : 'ya-hay-salida', mensaje(e));
      }
      if (!abierta.abierta) {
        await paraElSensor();
        return noSeAbre('rotulo-no-disponible', abierta.motivo);
      }
      avisa();
      return { abierta: true, motivo: null, marca: null, salida: abierta.salida };
    },

    /**
     * «Seguir con ella»: vuelve a poner el rótulo y el plazo cuenta de nuevo. **Es una
     * acción explícita y nunca una detección**: retirado el rótulo no hay permiso «mientras
     * se usa» que sostenga enterarse de que alguien ha vuelto a andar.
     */
    async retoma() {
      averia = null;
      if (!suscripcion) return { retomada: false, motivo: 'esta compilación no trae el módulo de ubicación en marcha' };
      // Retomar pasa por **la misma puerta que abrir**: la puntual con su tope y, si no
      // trae nada dentro de la cota, la última conocida por la misma regla. Lo que no se
      // toca aquí es el punto de partida: retomar reinicia el plazo del rótulo, no mueve
      // el sitio al que hay que volver.
      const conQueRetomar = await buscaConQueAnclar();
      if (!conQueRetomar.ancla) return { retomada: false, motivo: conQueRetomar.motivo };
      const punto = conQueRetomar.ancla;

      const enCurso = nucleo.salidaEnCurso(salidas);
      const compuesto = nucleo.componeRotulo({ destino: enCurso?.destino ?? null, mundo: enCurso?.mundo ?? null });
      // Retomar decide la cadencia otra vez y desde cero: entre el plazo agotado y el
      // «seguir» se pudo andar media tarde, así que la de antes no dice nada de dónde se
      // está ahora.
      const punto0 = enMetros(punto);
      if (sitios && punto0) {
        cadencia = nucleo.cadenciaDeMuestreo({
          posicion: punto0,
          sitios,
          vigente: null,
          metrosPorDistancia: CADENCIA_M,
          puntoDePartida: enCurso ? enMetros(enCurso.partida) : null,
        });
      }
      try {
        await suscripcion.arranca(compuesto, cadencia);
      } catch (e) {
        return { retomada: false, motivo: mensaje(e) };
      }
      // La traza empieza de cero al retomar, y a propósito: entre el plazo agotado y el
      // «seguir» pudo pasar media tarde, y coser ese hueco contaría como quietud medida lo
      // que fue una comida.
      montaLaTraza();
      const vuelta = nucleo.retomaLaSalida(salidas, { tMs: punto.tMs, rotulo });
      if (vuelta.retomada) montaLasLlegadas();
      if (!vuelta.retomada) await paraElSensor();
      avisa();
      return { retomada: vuelta.retomada, motivo: vuelta.motivo };
    },

    /** «Dejarlo aquí» desde la portada. La misma puerta que volver, con otro motivo anotado. */
    async dejarloAqui() {
      const cerrada = nucleo.dejarloAqui(salidas, { rotulo });
      await paraElSensor();
      avisa();
      return cerrada;
    },

    /** «Dar la salida por terminada» desde el rótulo del sistema. */
    async terminaDesdeElRotulo() {
      const cerrada = nucleo.terminaDesdeElRotulo(salidas, { rotulo });
      await paraElSensor();
      avisa();
      return cerrada;
    },

    /** Marca el telón como leído. Es un toque de quien lo lee, nunca el paso de nada. */
    marcaElTelonComoLeido() {
      const leida = nucleo.marcaElTelonComoLeido(salidas);
      avisa();
      return leida;
    },

    /**
     * Compara lo que el estado cree con la presencia real del rótulo, y corrige.
     *
     * Se pregunta al sistema antes de comparar: en Android el servicio lo puede matar la
     * memoria y devolver el proceso, y lo que esta capa recordaba haber hecho no vale nada
     * (riesgo 4 del PRD). Se llama al arrancar y no solo en las transiciones.
     */
    async reconcilia() {
      if (suscripcion && typeof suscripcion.sondeaPresencia === 'function') {
        try {
          const registrada = await suscripcion.sondeaPresencia();
          // Lo que se puede preguntar y lo que no, medido en el emulador el 11-ago-2026:
          // `hasStartedLocationUpdatesAsync` dice si la **tarea sigue registrada**, no si el
          // servicio está vivo — tras reiniciar el móvil devolvía `true` con el servicio
          // muerto—. Así que la tarea registrada no basta: si este proceso no lo arrancó, se
          // vuelve a pedir. Arrancar de nuevo es idempotente y es lo honesto: la salida está
          // abierta y la app delante, así que el rótulo tiene que volver a estar. Y si no se
          // puede arrancar, entonces sí está retirado de verdad y el núcleo lo anota con su
          // motivo, que es lo que impide que una salida se crea sostenida por nada.
          const enCurso = nucleo.salidaEnCurso(salidas);
          if (registrada && !suscripcion.corriendo() && enCurso && enCurso.situacion === 'abierta-con-rotulo') {
            await suscripcion.arranca(nucleo.componeRotulo({ destino: enCurso.destino, mundo: enCurso.mundo }));
          }
        } catch (e) {
          averia = mensaje(e);
        }
      }
      const resultado = nucleo.reconciliaConElRotulo(salidas, { rotulo });
      if (resultado.corregido) {
        // El sistema ya paró el servicio: lo que queda es tirar la traza, que sin
        // suscripción detrás mediría un hueco como si fuera quietud.
        desmontaLaTraza();
        avisa();
        return resultado;
      }
      // Y la otra mitad, que es la que se descubre al reabrir la app con una salida ya
      // abierta: **el servicio sigue puesto y la traza no existe**, porque murió con el
      // proceso anterior. Sin volver a montarla el momento en marcha enseñaría la avería
      // del seguidor sin montar teniendo el sensor entero detrás. La traza empieza de cero
      // a propósito: lo andado antes del cierre del proceso no le pertenece a nadie, y
      // coserlo contaría como quietud medida lo que fue una app cerrada.
      if (suscripcion && !traza && nucleo.situacionDeSalida(salidas) === 'abierta-con-rotulo') {
        montaLaTraza();
        // Y con ella la capa de llegadas, que es lo que hace que al reabrir la app con una
        // salida ya abierta la escena que espera se pueda ofrecer: **la llegada vive en el
        // estado guardado**, así que lo que faltaba era la capa que la lee.
        montaLasLlegadas();
        avisa();
      }
      return resultado;
    },

    /** Retira la suscripción sin tocar la salida. Es lo que hace desmontar la pantalla. */
    para: paraElSensor,
  };
}
