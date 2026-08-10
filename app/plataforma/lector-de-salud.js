// El lector de la app de salud: **el permiso, la ventana, los metros y la marca de agua**.
//
// Vive en `app/` entero y a propósito. Lo que cruza la frontera hacia el núcleo son
// **metros ya acotados**, un número; el reloj real, la ventana leída y la marca de hasta
// dónde se leyó se quedan de este lado. SPEC-016 afirma que ni el estado ni el registro de
// la partida llevan ninguna marca del reloj real, y ese criterio es lo que hace la partida
// comparable byte a byte y reproducible en `node --test`.
//
// **Precio declarado de esa decisión:** la marca no entra en la copia del sistema ni en el
// fichero exportado, así que restaurar una partida en un móvil nuevo empieza a contar desde
// la primera lectura de ese móvil y no recupera los kilómetros del anterior. Es aceptable
// —un paso es tiempo del mundo, no una recompensa, y que la reserva se desborde no le quita
// nada a nadie— y es preferible a meter la vida real de quien juega dentro de la partida.
// Por eso la clave cuelga de un prefijo que las reglas de respaldo ya excluyen: perderla
// cuesta exactamente lo mismo que estrenar móvil, que es el precio que ya está declarado.
//
// Qué se pide y qué no, que es la mitad de privacidad de esta pieza:
//
// - **Metros caminados en una ventana**, porque el motor de SPEC-011 convierte metros con
//   el tramo personal y no cuenta zancadas. Si la fuente solo tiene pasos, se convierten
//   con una zancada **constante y no personalizable**: personalizarla exigiría datos del
//   cuerpo, y `docs/testing.md` afirma que nada del personaje afecta al cuerpo.
// - **Nada con recorrido**: ni entrenamientos con ruta, ni ubicaciones, ni sesiones con
//   mapa. Lo que se pide es lo mínimo que hace falta para mover un contador.
//
// Y no hay nada que corra con la app cerrada: se lee al abrir, una vez.

/** Dónde vive la marca de agua. **Fuera de la partida**, y por eso fuera de la copia. */
export const CLAVE_DE_LA_MARCA = 'cache/salud/marca-de-agua.json';

/**
 * La zancada con la que se convierten pasos en metros cuando la fuente no da metros.
 *
 * Constante, única y **no personalizable**: pedir la altura o la longitud de zancada de
 * quien juega sería pedir datos del cuerpo para mover un contador, que es justo lo que
 * `seguridad-privacidad.md` §1 no hace.
 */
export const ZANCADA_M = 0.72;

/**
 * Cuánto se mira hacia atrás la primera vez, sin marca previa.
 *
 * Un día y no tres meses: sin marca no se sabe qué se contó ya, y mirar atrás sin límite
 * regalaría de golpe el mundo de un trimestre. El tope de la reserva lo acotaría igual,
 * pero acotarlo aquí también es lo que hace que estrenar móvil y volver tras tres meses
 * enseñen lo mismo.
 */
export const VENTANA_INICIAL_MS = 24 * 60 * 60 * 1000;

/** Los motivos por los que una lectura no trae metros. Claves, nunca frases. */
export const MOTIVOS_DE_LECTURA = Object.freeze({
  MODO_APAGADO: 'modo-apagado',
  SIN_PERMISO: 'sin-permiso',
  SIN_FUENTE: 'sin-fuente',
  NO_RESPONDE: 'no-responde',
  SIN_VENTANA: 'sin-ventana',
});

/** Los estados que puede tener el permiso de salud. Lista cerrada. */
export const ESTADOS_DE_PERMISO = Object.freeze(['concedido', 'denegado', 'sin-preguntar', 'no-disponible']);

/** Un estado de permiso del enumerado, o un error que nombra el recibido. */
export function exigeEstadoDePermiso(estado, quien = 'el permiso de salud') {
  if (!ESTADOS_DE_PERMISO.includes(estado)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(estado) ?? String(estado)}: los declarados son ${ESTADOS_DE_PERMISO.join(', ')}. ` +
      'Un estado que no se reconoce se dice, en lugar de tratarse como concedido',
    );
  }
  return estado;
}

/** Un instante del reloj real, o un error que lo nombra. Aquí sí hay reloj: es la app. */
function exigeInstante(valor, quien) {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)}: se espera un instante en milisegundos, finito y no negativo`);
  }
  return valor;
}

/** Una ventana `{ desde, hasta }` bien formada, o un error que dice qué le pasa. */
export function exigeVentana(ventana, quien = 'la ventana de lectura de salud') {
  if (!ventana || typeof ventana !== 'object') {
    throw new Error(`${quien} llega como ${JSON.stringify(ventana) ?? String(ventana)}: se espera { desde, hasta } en milisegundos`);
  }
  const desde = exigeInstante(ventana.desde, `el principio de ${quien}`);
  const hasta = exigeInstante(ventana.hasta, `el final de ${quien}`);
  if (hasta < desde) {
    throw new Error(`${quien} termina antes de empezar (desde ${desde}, hasta ${hasta}): una ventana al revés no se lee, se dice`);
  }
  return Object.freeze({ desde, hasta });
}

/**
 * Los metros de una lectura, validados. **Falla nombrando el valor recibido.**
 *
 * Un número negativo o no numérico es un defecto de la fuente, no una condición de
 * funcionamiento: tratarlo como cero dejaría el contador quieto sin que nadie se enterara.
 */
export function metrosDeLaLectura(valor, quien = 'la lectura de la app de salud') {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error(`${quien} devolvió ${JSON.stringify(valor) ?? String(valor)} metros: hacen falta metros finitos y no negativos, y con eso no se ejecuta ningún paso`);
  }
  return valor;
}

/** Los metros que corresponden a un número de pasos, con la zancada constante. */
export function metrosDePasos(pasos, quien = 'la lectura de pasos de la app de salud') {
  if (!Number.isFinite(pasos) || pasos < 0) {
    throw new Error(`${quien} devolvió ${JSON.stringify(pasos) ?? String(pasos)} pasos: hacen falta pasos finitos y no negativos`);
  }
  return pasos * ZANCADA_M;
}

/**
 * Lo que solapa una ventana con otra, en milisegundos. Cero si no se tocan.
 *
 * Es lo que resta las ventanas de salida activa: los metros que ya movieron el mundo
 * andando no lo mueven otra vez como pasos de fondo.
 */
export function solapeDeVentanas(a, b) {
  const desde = Math.max(a.desde, b.desde);
  const hasta = Math.min(a.hasta, b.hasta);
  return hasta > desde ? hasta - desde : 0;
}

/**
 * Los trozos de una ventana que **no** están cubiertos por ninguna salida activa.
 *
 * Se resta por tiempo y no por metros porque es lo único que se puede hacer sin pedirle a
 * la app de salud nada con recorrido: lo que se lee después es cada trozo por separado.
 */
export function ventanaSinSalidas(ventana, salidas = []) {
  const cortes = (salidas ?? [])
    .map((s) => exigeVentana(s, 'una ventana de salida activa'))
    .filter((s) => solapeDeVentanas(ventana, s) > 0)
    .sort((x, y) => x.desde - y.desde);

  const trozos = [];
  let desde = ventana.desde;
  for (const corte of cortes) {
    if (corte.desde > desde) trozos.push(Object.freeze({ desde, hasta: Math.min(corte.desde, ventana.hasta) }));
    desde = Math.max(desde, corte.hasta);
    if (desde >= ventana.hasta) break;
  }
  if (desde < ventana.hasta) trozos.push(Object.freeze({ desde, hasta: ventana.hasta }));
  return Object.freeze(trozos.filter((t) => t.hasta > t.desde));
}

/**
 * La marca de agua, sobre el almacén inyectado. Vive fuera de la partida y no viaja.
 */
export function creaMarcaDeAgua(almacen) {
  if (!almacen || typeof almacen.lee !== 'function' || typeof almacen.escribe !== 'function') {
    throw new Error('la marca de agua de la lectura de salud necesita un almacén con lee(clave) y escribe(clave, texto): sin ella se contarían dos veces los mismos metros');
  }
  return {
    clave: CLAVE_DE_LA_MARCA,
    async lee() {
      const texto = await almacen.lee(CLAVE_DE_LA_MARCA);
      if (texto == null) return null;
      let doc = null;
      try {
        doc = JSON.parse(texto);
      } catch {
        // Una marca ilegible se trata como no haberla: el precio es contar desde ahora,
        // que es el mismo que estrenar móvil y ya está declarado.
        return null;
      }
      return Number.isFinite(doc?.leidoHasta) && doc.leidoHasta >= 0 ? doc.leidoHasta : null;
    },
    async escribe(instante) {
      exigeInstante(instante, 'la marca de la última lectura de salud');
      await almacen.escribe(CLAVE_DE_LA_MARCA, JSON.stringify({ leidoHasta: instante }));
      return instante;
    },
    /**
     * Deja la marca **sin lectura previa**, que es lo que hace que el tiempo con el modo
     * apagado no se pueda leer hacia atrás cuando se vuelva a encender.
     *
     * Se escribe un documento sin `leidoHasta` en lugar de borrar la clave: el almacén
     * inyectado solo promete `lee` y `escribe`, y una marca que se lee como «no hay» es
     * exactamente lo mismo que no tenerla.
     */
    async olvida() {
      await almacen.escribe(CLAVE_DE_LA_MARCA, JSON.stringify({ leidoHasta: null }));
      return null;
    },
  };
}

/**
 * El lector, ya cableado.
 *
 * @param {object} opciones
 *   `fuente` la app de salud del sistema: `estadoDelPermiso()`, `pideElPermiso()` y
 *   `metrosEnVentana({ desde, hasta })` —o `pasosEnVentana`—; `marca` la marca de agua;
 *   `ahora` el reloj real, inyectado para que la lectura se pueda comprobar sin esperar.
 *
 * **Sin fuente no se degrada en silencio**: se declara `sin-fuente`, que es distinto de
 * que la app de salud no responda y distinto de no tener permiso.
 */
export function creaLectorDeSalud({ fuente = null, marca, ahora = () => Date.now(), ventanaInicialMs = VENTANA_INICIAL_MS }) {
  if (!marca || typeof marca.lee !== 'function' || typeof marca.escribe !== 'function' || typeof marca.olvida !== 'function') {
    throw new Error('el lector de salud necesita su marca de agua completa (lee, escribe, olvida): sin ella, dos aperturas seguidas contarían dos veces los mismos metros');
  }

  // Se pide **crudo** y se valida fuera del `try`: así un fallo de la fuente y unos
  // metros inválidos no comparten camino. El primero es una condición de funcionamiento
  // —la app de salud no responde— y el segundo es un defecto que se dice en voz alta.
  const pideElTrozo = async (trozo) => {
    if (typeof fuente.metrosEnVentana === 'function') {
      return { clase: 'metros', valor: await fuente.metrosEnVentana(trozo) };
    }
    if (typeof fuente.pasosEnVentana === 'function') {
      return { clase: 'pasos', valor: await fuente.pasosEnVentana(trozo) };
    }
    throw new Error(
      'la fuente de salud no expone ni metrosEnVentana ni pasosEnVentana: se piden metros caminados o pasos en una ventana, ' +
      'y nunca posiciones, rutas ni ejercicios con recorrido',
    );
  };

  /** El estado del permiso, **leído y nunca pedido**. Consultar no es preguntar. */
  const permisoActual = async () => {
    if (!fuente || typeof fuente.estadoDelPermiso !== 'function') return 'no-disponible';
    let leido;
    try {
      leido = await fuente.estadoDelPermiso();
    } catch {
      // Una fuente que no contesta no es un permiso denegado: decirlo así apagaría el
      // interruptor por un fallo de lectura.
      return 'no-disponible';
    }
    return exigeEstadoDePermiso(leido);
  };

  return {
    permiso: permisoActual,

    /**
     * Cierra la cuenta **sin leer nada**: lo que venga a partir de ahora no se contará
     * hacia atrás. Lo llama el interruptor al apagarse, que es el momento en que se decide
     * que ese tiempo no ocurre para el juego.
     */
    async dejaDeContar() {
      return marca.olvida();
    },

    /**
     * Pide el permiso. **Solo desde aquí**, y solo lo llama el interruptor al encenderse:
     * en contexto, explicando para qué, y nunca al instalar ni al abrir.
     */
    async pideElPermiso() {
      if (!fuente || typeof fuente.pideElPermiso !== 'function') return 'no-disponible';
      return exigeEstadoDePermiso(await fuente.pideElPermiso());
    },

    /**
     * Lee los metros nuevos desde la última lectura, restando las ventanas de salida
     * activa, y **avanza la marca solo si se leyó**.
     *
     * @returns `{ metros, leyo, motivo, ventana, trozos }`. Que no se lea nada no es un
     *   fallo y ninguna pantalla lo llama así: el juego sigue igual.
     */
    async lee({ activo = true, salidas = [] } = {}) {
      const vacia = (motivo) => Object.freeze({ metros: 0, leyo: false, motivo, ventana: null, trozos: [] });
      if (!activo) {
        // Con el modo apagado no se lee **ni ahora ni después**: la marca se olvida en vez
        // de quedarse quieta, para que volver a encender abra la ventana inicial y no una
        // hacia atrás de todo el tiempo apagado. Sin penalización por ausencia, y tampoco
        // regalo por ella.
        await marca.olvida();
        return vacia(MOTIVOS_DE_LECTURA.MODO_APAGADO);
      }
      if (!fuente) return vacia(MOTIVOS_DE_LECTURA.SIN_FUENTE);

      const estado = await permisoActual();
      if (estado !== 'concedido') return vacia(MOTIVOS_DE_LECTURA.SIN_PERMISO);

      const hasta = exigeInstante(ahora(), 'el instante de la lectura de salud');
      const guardada = await marca.lee();
      const desde = guardada == null ? Math.max(0, hasta - ventanaInicialMs) : Math.min(guardada, hasta);
      const ventana = exigeVentana({ desde, hasta });
      const trozos = ventanaSinSalidas(ventana, salidas);
      if (!trozos.length) {
        // Toda la ventana la cubrió una salida activa: no hay metros nuevos que acreditar,
        // pero la marca sí avanza — si no, la siguiente apertura volvería a mirarlos.
        await marca.escribe(hasta);
        return Object.freeze({ metros: 0, leyo: true, motivo: MOTIVOS_DE_LECTURA.SIN_VENTANA, ventana, trozos: [] });
      }

      const crudos = [];
      for (const trozo of trozos) {
        try {
          crudos.push(await pideElTrozo(trozo));
        } catch {
          // Que la app de salud no conteste es una condición de funcionamiento: no se lee
          // nada, no se ejecuta ningún paso, **la marca no se mueve** —para que lo de esta
          // ventana se cuente la próxima vez— y ninguna pantalla lo llama fallo.
          return vacia(MOTIVOS_DE_LECTURA.NO_RESPONDE);
        }
      }
      // Fuera del `try`, para que unos metros negativos fallen nombrando el valor en lugar
      // de disfrazarse de «la app de salud no responde».
      let metros = 0;
      for (const crudo of crudos) {
        metros += crudo.clase === 'metros' ? metrosDeLaLectura(crudo.valor) : metrosDePasos(crudo.valor);
      }
      await marca.escribe(hasta);
      return Object.freeze({ metros, leyo: true, motivo: null, ventana, trozos });
    },
  };
}
