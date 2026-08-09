// El reloj de pared: el minuto del día en que se resuelve un beat, y nada más.
//
// No es el reloj del servidor de `reloj.mjs` —aquel es milisegundos de época, para
// caducar fichas— ni el reloj de mundo de `reloj-mundo.mjs`, que avanza por kilómetros
// andados. Este es la entrada nueva que SPEC-034 mete en la frontera del núcleo: el
// paquete no lee la hora del sistema, así que llegar dentro o fuera de una franja es un
// argumento, y sin doble no se podría afirmar en `@nucleo` que llegar fuera resuelve el
// beat igual.
//
// Dos decisiones:
//
//   · **El minuto que se pide se cuenta.** `llamadas` existe para poder afirmar que un
//     beat sin franja no consulta el reloj: si lo consultara, el paquete estaría mirando
//     la hora en un momento en que la hora no decide nada.
//   · **«Fuera» es siempre fuera de una franja concreta, no fuera de todas.** Las cinco
//     franjas del catálogo cubren el día entero, así que un minuto fuera de todas no
//     existe y pedirlo sería inventarse un caso que el juego no tiene.
//
// No importa nada del paquete: la franja entra como dato, con sus dos minutos, tal como
// viaja dentro del beat casteado.

/** Cuántos minutos tiene un día. La escala entera del reloj. */
export const MINUTOS_DEL_DIA = 24 * 60;

/**
 * Un reloj de pared fijo en un minuto del día.
 *
 * @param {number} minuto minutos desde medianoche.
 * @returns {{(): number, minuto: number, llamadas: number[], fija: (m: number) => void}}
 *   La función es lo único que el paquete ve; el resto son mandos de la prueba.
 */
export function relojDePared(minuto) {
  let m = minuto;
  const llamadas = [];
  const reloj = () => {
    llamadas.push(m);
    return m;
  };
  reloj.llamadas = llamadas;
  Object.defineProperty(reloj, 'minuto', { get: () => m });
  reloj.fija = (nuevo) => {
    m = nuevo;
  };
  return reloj;
}

/** Un reloj que devuelve algo que no es un minuto del día, para el caso de la entrada mala. */
export function relojRoto(valor) {
  return () => valor;
}

/**
 * Un minuto **dentro** de una franja: el de su mitad, que es el que no depende de si el
 * extremo entra o no. Vale también para `noche`, que cruza la medianoche.
 */
export function minutoDentroDe(franja) {
  const largo = franja.hastaMin > franja.desdeMin
    ? franja.hastaMin - franja.desdeMin
    : MINUTOS_DEL_DIA - franja.desdeMin + franja.hastaMin;
  return (franja.desdeMin + Math.floor(largo / 2)) % MINUTOS_DEL_DIA;
}

/**
 * Un minuto **fuera** de una franja: la mitad del hueco que la franja deja libre.
 *
 * Se calcula y no se escribe a mano porque escribirlo obligaría a saber de antemano qué
 * franja lleva cada plantilla, y las plantillas cambian.
 */
export function minutoFueraDe(franja) {
  const dentro = (m) => (franja.hastaMin > franja.desdeMin
    ? m >= franja.desdeMin && m < franja.hastaMin
    : m >= franja.desdeMin || m < franja.hastaMin);
  // El hueco empieza donde la franja acaba y dura hasta que vuelve a empezar.
  const largoDelHueco = franja.hastaMin > franja.desdeMin
    ? MINUTOS_DEL_DIA - (franja.hastaMin - franja.desdeMin)
    : franja.desdeMin - franja.hastaMin;
  const m = (franja.hastaMin + Math.floor(largoDelHueco / 2)) % MINUTOS_DEL_DIA;
  if (dentro(m)) {
    throw new Error(`la franja ${JSON.stringify(franja)} no deja ningún minuto fuera: el doble no puede fabricar una llegada tardía`);
  }
  return m;
}
