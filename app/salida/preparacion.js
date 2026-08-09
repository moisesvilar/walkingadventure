// La preparación de la salida, A2P5: los segundos de red que quedan.
//
// Encadena las dos únicas cosas que salen del móvil en todo el juego —los textos que escribe
// el narrador y las ilustraciones de los lugares del lazo— y devuelve la pantalla, lo
// conseguido y **lo que faltó, con su motivo**. La pantalla sale igual en los dos casos; el
// resumen no, y esa asimetría es la fila entera.
//
// Vive en `app/` y no en el paquete por la frontera de siempre: el núcleo decide qué hace
// falta y no habla con nadie, la app consigue. Aquí no hay ni una regla de juego.
//
// **Los dos silencios, otra vez, porque es donde se tocan:**
//
// - Que el proveedor esté caído, tarde más de la cuenta o diga que no hay: el texto cae a
//   plantilla, la ilustración queda ausente con su motivo y **ninguna pantalla lo menciona**.
// - Que falte el conseguidor, el cliente de imágenes o la llamada al narrador: **no se
//   construye**. Una preparación que arranca sin ellos daría exactamente el mismo resultado
//   que una sin cobertura, y entonces «nadie lo cableó» y «hoy no hay red» serían la misma
//   cosa (`pipeline/decisiones-orquestador.md` §6h).
//
// **Y el núcleo entra por la puerta, como todo lo demás** (SPEC-020). Aquí no hay ni una
// regla de juego, así que el generador es una pieza inyectada y no un import: es lo que
// deja esta orquestación alcanzable desde `node --test` sin resolver ningún especificador
// que haya que instalar. Quien monta la app sí cita el paquete por su nombre, y lo hace en
// `app/nucleo/piezas.js`.

/** Las piezas sin las que esto no se construye. Su ausencia es avería, nunca falta de red. */
export const PIEZAS_DE_LA_PREPARACION = Object.freeze(['nucleo', 'conseguidor', 'llamada']);

/**
 * Lo que la preparación le pide al núcleo, enumerado. Un núcleo al que le falta media
 * interfaz tiene que fallar al construir y no a mitad de una salida.
 */
export const DEL_NUCLEO = Object.freeze([
  'PRESUPUESTO_PREPARACION_MS', 'declaraAusencia', 'declaraIlustracion', 'declaraTexto',
  'ordenaRecursos', 'planDeIlustraciones', 'recursosVacios', 'componePreparacion',
  'resumenDeLaPreparacion', 'redactaAventura',
]);

function exigePieza(pieza, nombre, paraQue) {
  if (!pieza) {
    throw new Error(
      `la preparación de la salida se construye sin ${nombre}, y no arranca sin él: ${paraQue}. ` +
      'Salir adelante sin la pieza haría que «nadie la cableó» y «hoy no hay cobertura» dieran el mismo resultado',
    );
  }
  return pieza;
}

/**
 * La preparación, ya cableada.
 *
 * @param {object} opciones
 *   `nucleo` el generador, con lo que enumera `DEL_NUCLEO`; `conseguidor` el de SPEC-025,
 *   que es quien pide el lote de ilustraciones; `llamada` el cliente del narrador; `locale`
 *   el idioma del mundo; `presupuestoMs` lo que dura la pantalla como mucho — se sale igual
 *   con lo que haya cuando se agota.
 */
export function creaPreparacion({ nucleo, conseguidor, llamada = null, sinNarrador = false, locale = 'es', presupuestoMs = null }) {
  exigePieza(nucleo, 'el núcleo', 'es quien declara los recursos, compone la pantalla y redacta la aventura');
  for (const nombre of DEL_NUCLEO) {
    if (nucleo[nombre] == null) throw new Error(`al núcleo inyectado le falta "${nombre}", que es de lo que se compone la preparación`);
  }
  const {
    PRESUPUESTO_PREPARACION_MS, componePreparacion, declaraAusencia, declaraIlustracion, declaraTexto,
    ordenaRecursos, planDeIlustraciones, recursosVacios, redactaAventura, resumenDeLaPreparacion,
  } = nucleo;
  const presupuesto = presupuestoMs ?? PRESUPUESTO_PREPARACION_MS;

  exigePieza(conseguidor, 'el conseguidor de recursos', 'es quien pide el lote de ilustraciones de los lugares del lazo');
  if (typeof conseguidor.ilustracionesDeSalida !== 'function') {
    throw new Error('el conseguidor inyectado no expone "ilustracionesDeSalida", que es como se le pide el lote entero de una vez');
  }
  // La llamada al narrador se puede no tener —una compilación sin proveedor de texto es una
  // cosa legítima y SPEC-018 la describe como funcionamiento—, pero **se declara**: sin
  // declararla, olvidarla y no tenerla serían la misma cosa, y todos los textos saldrían de
  // plantilla sin que nadie lo hubiera decidido.
  if (!llamada && !sinNarrador) {
    exigePieza(null, 'la llamada al narrador', 'es quien escribe los textos de la aventura antes de salir; si de verdad no hay narrador, se declara con sinNarrador: true');
  }
  if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
    throw new Error(
      `la preparación necesita su presupuesto declarado y llegó ${JSON.stringify(presupuestoMs) ?? String(presupuestoMs)}: ` +
      'sin él la pantalla esperaría sin límite, y una espera sin límite es una pantalla de carga',
    );
  }

  return {
    presupuestoMs: presupuesto,

    /**
     * Prepara una salida y devuelve `{ pantalla, recursos, textos, resumen }`.
     *
     * **Nunca lanza por culpa de la red.** Lo que no se consiga queda ausente con su motivo y
     * cada texto queda anotado con su origen; la pantalla es la misma en los dos casos, y por
     * eso se compone desde el núcleo y no desde lo que haya salido bien.
     */
    async prepara({ aventura, plantilla, mundo, recursos = null, filtro = null, topicos = null, semillaDeMundo = null }) {
      const conseguidos = recursos ? { ...recursos } : recursosVacios();
      const ausencias = [];

      // --- Los textos ---------------------------------------------------------
      let redaccion = null;
      try {
        redaccion = await redactaAventura({
          mundo,
          aventura,
          plantilla,
          locale,
          momento: 'antes-de-salir',
          llamada,
          presupuestoMs: presupuesto,
          filtro,
          topicos,
          semillaDeMundo,
        });
      } catch {
        // Lo que dijo el proveedor se descarta entero y no se interpreta. Sin redacción, cada
        // hueco se queda con el texto de su plantilla, que es lo que el catálogo garantiza.
        redaccion = null;
      }
      const textos = (redaccion?.textos ?? []).map((t) => declaraTexto({ clave: t.clave, texto: t.texto, origen: t.origen }));
      conseguidos.textos = [...(conseguidos.textos ?? []), ...textos];

      // --- Las ilustraciones --------------------------------------------------
      const plan = planDeIlustraciones({ aventura, mundo, locale, recursos: conseguidos });
      const lote = await conseguidor.ilustracionesDeSalida(plan);
      for (const conseguido of lote.conseguidos ?? []) {
        conseguidos.ilustraciones = [
          ...(conseguidos.ilustraciones ?? []),
          declaraIlustracion({ elemento: conseguido.clave, prompt: conseguido.prompt, recurso: conseguido.recurso }),
        ];
      }
      for (const ausente of lote.ausentes ?? []) {
        ausencias.push(declaraAusencia({ familia: ausente.familia ?? 'ilustracion', clave: ausente.clave, motivo: ausente.motivo }));
      }

      return {
        // La pantalla no sabe nada de lo de arriba, y es el punto: dice lo mismo con red y sin
        // ella, y de ella se sale a andar.
        pantalla: componePreparacion({ recursos: conseguidos }),
        recursos: ordenaRecursos(conseguidos),
        textos,
        // El otro lado: aquí sí está todo dicho, con el origen de cada texto y el motivo de
        // cada ausencia. El silencio es hacia quien juega, nunca hacia el dato.
        resumen: resumenDeLaPreparacion({ textos, ausencias }),
        ausencias,
        llamadas: lote.llamadas ?? 0,
      };
    },
  };
}
