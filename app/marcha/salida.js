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

import { creaFuenteDePosiciones, creaTrazaDeSalida } from '../plataforma/posiciones.js';
import { creaSeguidorDeLaSalida } from './seguidor.js';

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
export function creaLaSalida({ nucleo, salidas: areaRecibida, rotulo, suscripcion = null, origen = null, tramo = null, alCambiar = null, pidePermisoDeAviso = null }) {
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

  // La traza y el seguidor viven **lo que dura la salida** y se montan al abrirla: un
  // detector que sobreviviera a un cierre arrastraría la racha de la salida anterior a la
  // siguiente, que es la manera de que un autobús de ayer clasifique lo de hoy.
  let traza = null;
  let seguidor = null;
  let averia = null;

  const montaLaTraza = () => {
    const fuente = creaFuenteDePosiciones({ lee: () => suscripcion.lee() });
    traza = creaTrazaDeSalida({ fuente, detector: nucleo.creaDetectorDeTransporte() });
    seguidor = origen ? creaSeguidorDeLaSalida({ fuente, traza, origen, nucleo }) : null;
  };

  const desmontaLaTraza = () => {
    traza = null;
    seguidor = null;
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
      const segmentos = traza.traza().segmentos;
      const ultimo = segmentos.length ? segmentos[segmentos.length - 1] : null;
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

    /** El último fallo recogido, o `null`. Es lo que la pantalla enseña como motivo literal. */
    averia: () => averia,

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
    async abre({ salida, mapa, destino = null, mundo = null, aventura = null }) {
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

      let punto;
      try {
        punto = await suscripcion.posicionPuntual();
      } catch (e) {
        // Sin permiso el módulo lanza, y aquí se distingue de «no ha dado fijo todavía»:
        // el primero se arregla en los ajustes del sistema y el segundo esperando.
        return noSeAbre('permiso-denegado', `sin una posición no hay punto de partida, y sin punto de partida no hay regreso que detectar — ${mensaje(e)}`);
      }
      if (punto == null) {
        return noSeAbre('sensor-sin-responder', 'el sensor todavía no ha entregado ninguna posición, y una salida sin punto de partida no podría cerrarse nunca por regreso');
      }

      // El servicio se arranca **esperándolo**: `rotulo.pone()` es síncrono por contrato y
      // un fallo aquí se perdería dentro de una promesa. Volver a pedirlo desde `pone()` no
      // abre una segunda suscripción: es la misma tarea con las mismas opciones.
      const compuesto = nucleo.componeRotulo({ destino, mundo });
      try {
        await suscripcion.arranca(compuesto);
      } catch (e) {
        return noSeAbre('rotulo-no-disponible', `el servicio en primer plano no arrancó, y sin él la salida perdería la ubicación a los pocos minutos — ${mensaje(e)}`);
      }

      montaLaTraza();
      let abierta;
      try {
        abierta = nucleo.abreSalida(salidas, {
          salida,
          mapa,
          aventura,
          destino,
          mundo,
          partida: { lat: punto.lat, lon: punto.lon },
          tMs: punto.tMs,
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
      let punto;
      try {
        punto = await suscripcion.posicionPuntual();
      } catch (e) {
        return { retomada: false, motivo: mensaje(e) };
      }
      if (punto == null) return { retomada: false, motivo: 'el sensor todavía no ha entregado ninguna posición con la que retomar el plazo' };

      const enCurso = nucleo.salidaEnCurso(salidas);
      const compuesto = nucleo.componeRotulo({ destino: enCurso?.destino ?? null, mundo: enCurso?.mundo ?? null });
      try {
        await suscripcion.arranca(compuesto);
      } catch (e) {
        return { retomada: false, motivo: mensaje(e) };
      }
      // La traza empieza de cero al retomar, y a propósito: entre el plazo agotado y el
      // «seguir» pudo pasar media tarde, y coser ese hueco contaría como quietud medida lo
      // que fue una comida.
      montaLaTraza();
      const vuelta = nucleo.retomaLaSalida(salidas, { tMs: punto.tMs, rotulo });
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
        avisa();
      }
      return resultado;
    },

    /** Retira la suscripción sin tocar la salida. Es lo que hace desmontar la pantalla. */
    para: paraElSensor,
  };
}
