// Salud en iOS: **la pareja declarada**, y no una implementación a medias.
//
// La fuente nativa que la fila 46 monta es Health Connect, que es de Android y solo de
// Android. En iOS la equivalente sería HealthKit, y hoy ningún iPhone de este proyecto puede
// verificar nada: no hay Xcode en la máquina, no hay simulador y ninguna pantalla se ha visto
// nunca en un iPhone. Una implementación que no se puede medir es una promesa, así que aquí
// se dice la verdad de esta plataforma en lugar de escribirla a ciegas.
//
// Exporta **exactamente los mismos nombres** que `salud.android.js`, que es lo que hace que
// el empaquetador pueda elegir por sufijo sin que nadie tenga que acordarse de nada. Lo que
// cambia es lo que responden.
//
// Quién lo cierra: la fila que nombre el módulo de HealthKit, con su decisión del dueño
// delante (`docs/iphone.md`, decisión 1). Las restricciones del lector no cambian de
// plataforma —metros o pasos en ventana, nada con recorrido, zancada constante—, así que lo
// único que hará falta ese día es otra fuente detrás de esta misma interfaz.

/** El mecanismo que esta plataforma tendría, para que nadie tenga que redescubrirlo. */
export const MECANISMO = 'HealthKit, la app de salud del sistema en iOS';

/** Los motivos de la sonda. Uno solo aquí: la fuente de esta fila no es de esta plataforma. */
export const MOTIVOS_DE_LA_SONDA = Object.freeze({
  OTRA_PLATAFORMA: `${MECANISMO}: la fuente de salud que la fila 46 monta es Health Connect y solo Android, así que en iOS no hay de dónde leer los pasos del día a día. Lo cerrará la fila que nombre el módulo de HealthKit`,
});

/**
 * La fuente de salud de esta plataforma: **ninguna, y se dice**.
 *
 * Devolver `null` es lo que el lector traduce a `sin-fuente`, y lo que hace que el
 * interruptor de A6P6 sea imposible de encender por construcción en lugar de encenderse y no
 * leer nada.
 */
export async function creaFuenteDeSalud() {
  return null;
}

/** La capacidad, con el contrato de SPEC-020 sin tocarlo. La sonda no pide ningún permiso. */
export const salud = {
  nombre: 'salud',
  /** No es capa de aviso: salud no avisa de nada, solo aporta pasos. */
  capa: 'ninguna',
  async sonda() {
    return {
      montado: false,
      disponible: false,
      motivo: MOTIVOS_DE_LA_SONDA.OTRA_PLATAFORMA,
    };
  },
};
