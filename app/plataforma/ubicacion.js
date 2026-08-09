// El proveedor de ubicación del arranque: pide el permiso «mientras se usa», dice si
// lo concedieron y, si lo concedieron, entrega una posición.
//
// Es la única pieza de la app que toca la posición de quien juega, y su contrato dice
// tres cosas que no son negociables. **Solo «mientras se usa»**: el permiso permanente
// no se pide nunca, y ninguna pieza del juego lo necesita (`seguridad-privacidad.md`
// §2). **No guarda nada**: la posición que devuelve viaja a la marca de A1P4 y de ahí
// al anclaje redondeado; ni la posición ni ninguna marca de tiempo llegan a escribirse.
// Y **no se vuelve a llamar fuera del arranque**: quien lo necesite en marcha monta lo
// suyo, con su rótulo del sistema y su servicio en primer plano, que son de otra fila.
//
// Aquí no se importa ningún módulo nativo, y es deliberado por lo mismo que en
// `render/enlace-skia.js`: el contrato se ejercita en `node --test` contra un doble, y
// el módulo nativo entra por la firma. Lo que **no** hace este módulo es caer solo a la
// vía de elegir el punto a mano cuando no hay con qué pedir el permiso: eso sería la
// pieza que, al no estar, no protesta (§6h). Denegar es una respuesta; no poder
// preguntar es una avería, y se distinguen.

/** Las dos respuestas posibles a pedir el permiso. Vocabulario cerrado. */
export const RESPUESTAS = Object.freeze(['concedido', 'denegado']);

/**
 * Envuelve el módulo nativo en el contrato que el arranque espera.
 *
 * @param {object} piezas
 * @param {() => Promise<string>} piezas.pidePermiso  dispara el diálogo del sistema para
 *   la ubicación **mientras se usa** y devuelve `'concedido'` o `'denegado'`.
 * @param {() => Promise<{lat:number, lon:number}>} piezas.leePosicion  la posición actual.
 *   Solo se llama si el permiso se concedió.
 */
export function creaProveedorDeUbicacion({ pidePermiso, leePosicion }) {
  if (typeof pidePermiso !== 'function' || typeof leePosicion !== 'function') {
    throw new Error(
      'el proveedor de ubicación se monta con pidePermiso() y leePosicion() y falta alguna: sin ellas no se puede distinguir ' +
      '«han denegado el permiso» de «no hay con qué preguntarlo», y son dos cosas que se arreglan en sitios distintos',
    );
  }

  return {
    montado: true,
    motivo: null,

    /**
     * Pide el permiso y, si lo conceden, la posición. Denegar devuelve `concedido:
     * false` **sin posición y sin error**: denegar es una respuesta prevista y el
     * arranque continúa por la vía de elegir el punto a mano.
     */
    async pide() {
      const respuesta = await pidePermiso();
      if (!RESPUESTAS.includes(respuesta)) {
        throw new Error(`el proveedor de ubicación ha respondido ${JSON.stringify(respuesta) ?? String(respuesta)} y las respuestas son ${RESPUESTAS.join(' y ')}`);
      }
      if (respuesta === 'denegado') return { concedido: false, posicion: null };
      const posicion = await leePosicion();
      if (!posicion || !Number.isFinite(posicion.lat) || !Number.isFinite(posicion.lon)) {
        throw new Error(`el permiso se concedió y la lectura de posición devolvió ${JSON.stringify(posicion) ?? String(posicion)}`);
      }
      // Se copian los dos números y se tira lo demás: lo que devuelve un módulo de
      // ubicación trae precisión, rumbo, altitud y **una marca de tiempo**, y nada de
      // eso tiene por qué seguir vivo un instante más de lo necesario.
      return { concedido: true, posicion: { lat: posicion.lat, lon: posicion.lon } };
    },
  };
}

/**
 * Un proveedor que **no está montado** y lo dice al usarlo.
 *
 * Existe porque esta entrega no trae módulo nativo de ubicación —ninguna spec ha
 * nombrado todavía la dependencia que lo daría— y la alternativa era peor: un
 * proveedor que respondiera «denegado» convertiría una pieza sin cablear en una
 * decisión de quien juega, y entonces la vía manual dejaría de ser una elección para
 * pasar a ser una caída silenciosa. Con este, «Permitir» se enseña apagado y con su
 * motivo a la vista, y la vía manual sigue funcionando entera.
 */
export function proveedorSinMontar(motivo = 'no montado todavía: la app no trae módulo de ubicación, y ninguna spec ha nombrado la dependencia que lo daría') {
  return {
    montado: false,
    motivo,
    async pide() {
      throw new Error(`no se puede pedir el permiso de ubicación: ${motivo}. La vía de elegir el punto a mano sigue abierta y es la que hay que usar`);
    },
  };
}
