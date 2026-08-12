// El motor de pasos **del mapa activo**, armado una vez por partida y por mapa.
//
// Existe porque `creaMotorDeLaPartida` estaba escrito, probado y sin llamador: el paquete
// sabía colgar la propagación de rumores y la cola de entregas de un motor, y desde `app/`
// no lo armaba nadie. Sin él no hay dónde acreditar los metros del día a día, así que la
// reserva no se llenaba nunca y el zurrón no podía existir.
//
// Aquí no hay ni una regla de juego: el motor, sus productores y su orden los declara el
// paquete, y esta capa solo le pasa **las áreas vivas de la partida** —las mismas que se
// congelan y se cargan con ella— para que lo que un paso produzca sobreviva a cerrar la app.
// El generador entra por la puerta (SPEC-020, §6u) y no por un import.
//
// Dos decisiones que están aquí porque son las que se rompen solas:
//
// - **Se monta en la raíz y una sola vez.** Dos motores sobre el mismo estado son
//   equivalentes hasta que dejan de serlo, y esconder el montaje dentro de cada consumidor
//   es cómo acaban discrepando. Quien lo necesita lo recibe.
// - **Sin mapa levantado no se monta ninguno.** No se acredita a un identificador de
//   relleno: `exigeMapaId` lo dice en su propio error, y avanzar un contador por defecto
//   movería el mundo de casa mientras andas fuera.

/** Lo que esta orquestación le pide al núcleo, enumerado. */
export const DEL_NUCLEO = Object.freeze(['creaMotorDeLaPartida', 'PRODUCTORES_DE_LA_PARTIDA']);

/** Los motivos por los que no hay motor. Claves, nunca frases. */
export const MOTIVOS_SIN_MOTOR = Object.freeze({
  SIN_MAPA: 'sin-mapa-levantado',
  SIN_PARTIDA: 'sin-partida-abierta',
});

/**
 * Arma el motor del mapa activo, o declara por qué no hay.
 *
 * @param {object} piezas
 *   `nucleo` el generador, con lo que enumera `DEL_NUCLEO`; `estado` el de la partida, de
 *   donde salen la semilla y las cuatro áreas vivas; `mundo` el mapa levantado, con su
 *   identificador y su documento.
 * @returns `{ motor, propagacion, cola, mapaId, motivo }`. Con `motor` en nulo, `motivo`
 *   dice por qué, que es lo que impide confundir «no hay mapa» con «nadie lo cableó».
 */
export function creaMotorDelMapaActivo({ nucleo, estado, mundo }) {
  if (!nucleo) {
    throw new Error(
      'el motor del mapa activo se cablea sin el núcleo, y no arranca sin él: es quien declara el motor y sus dos productores. ' +
      'Salir adelante sin la pieza haría que «nadie lo cableó» y «no hay mapa levantado» dieran el mismo resultado',
    );
  }
  for (const nombre of DEL_NUCLEO) {
    if (nucleo[nombre] == null) throw new Error(`al núcleo inyectado le falta "${nombre}", que es de lo que se compone el motor del mapa activo`);
  }
  const sinMotor = (motivo) => Object.freeze({ motor: null, propagacion: null, cola: null, mapaId: null, motivo });

  if (!estado || typeof estado.semilla !== 'string' || !estado.semilla) return sinMotor(MOTIVOS_SIN_MOTOR.SIN_PARTIDA);
  const mapaId = mundo?.mapaId ?? null;
  // Un identificador de verdad y no uno de relleno: `'sin-mapa'` es lo que la raíz usa
  // mientras no hay mapa, y acreditarle pasos sería moverle el mundo a un mapa que no existe.
  if (typeof mapaId !== 'string' || !mapaId || mapaId === 'sin-mapa') return sinMotor(MOTIVOS_SIN_MOTOR.SIN_MAPA);
  if (!mundo?.documento) return sinMotor(MOTIVOS_SIN_MOTOR.SIN_MAPA);

  const { motor, propagacion, cola } = nucleo.creaMotorDeLaPartida({
    semilla: estado.semilla,
    mapaId,
    mundo: mundo.documento,
    tramo: estado.personaje?.tramo ?? null,
    // Las áreas **vivas** de la partida, no copias: el motor las muta en sitio y son las
    // mismas que se congelan, que es lo que hace que un paso sobreviva a cerrar la app.
    rumores: estado.rumores,
    nucleos: estado.nucleos,
    entregas: estado.entregas,
    pasos: estado.pasos,
    // **Declarado en nulo y no olvidado**: la cola no inventa entradas en un paso sin fuente
    // de producciones, y «lo que el mundo produce en un paso» es de otra fila del checklist.
    // Lo que la cola tiene sembrado viene del prólogo, que ya está cableado.
    producciones: null,
  });

  return Object.freeze({
    motor,
    propagacion,
    cola,
    mapaId,
    /** Los dos productores que el paquete declara, en su orden. Se leen, no se eligen. */
    productores: nucleo.PRODUCTORES_DE_LA_PARTIDA,
    motivo: null,
  });
}
