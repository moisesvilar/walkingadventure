// El calendario de la partida: el día, como entero, inyectado desde fuera.
//
// Existe por una razón y es la de siempre en este paquete: **el núcleo no lee el reloj**
// (RNF-DET-002). La portada dice «día 23», el recado suelto rota por día y la lista de hoy
// se compone para un día concreto, así que el día es una entrada y no una consulta.
//
// Y se exige en lugar de suponerse: una portada sin calendario cableado **falla nombrando
// la pieza**, porque suponer el día uno haría que «nadie cableó el calendario» y «es el
// primer día» fueran indistinguibles, que es exactamente la degradación silenciosa que
// `pipeline/decisiones-orquestador.md` §6h prohíbe.

/** El nombre con el que se pide la pieza cuando falta. Uno solo, para que el error se busque igual siempre. */
export const PIEZA_DEL_CALENDARIO = 'calendario de la partida';

/**
 * El calendario inyectado, o un error que nombra la pieza.
 *
 * Se pide un objeto con `dia()` y no un entero suelto a propósito: un número admite el
 * cero por defecto sin que nadie lo note, y un objeto ausente no.
 */
export function exigeCalendario(calendario, paraQue = 'esta composición') {
  if (!calendario || typeof calendario.dia !== 'function') {
    throw new Error(
      `${paraQue} necesita el ${PIEZA_DEL_CALENDARIO} inyectado, con su método dia(), y llegó ` +
      `${JSON.stringify(calendario) ?? String(calendario)}: sin él se supondría el día uno, y ` +
      'entonces «nadie lo cableó» y «es el primer día» serían la misma cosa',
    );
  }
  return calendario;
}

/**
 * El día de hoy: entero no negativo. El día cero es el de la partida recién empezada.
 *
 * Nunca una fecha: una fecha arrastraría zona horaria y calendario dentro del núcleo, y
 * con ellos dos mundos distintos según dónde se abra la app.
 */
export function diaDe(calendario, paraQue = 'esta composición') {
  const dia = exigeCalendario(calendario, paraQue).dia();
  if (!Number.isInteger(dia) || dia < 0) {
    throw new Error(
      `el ${PIEZA_DEL_CALENDARIO} devolvió ${JSON.stringify(dia) ?? String(dia)} para ${paraQue}: ` +
      'el día es un entero no negativo, y nunca una marca del reloj real',
    );
  }
  return dia;
}
