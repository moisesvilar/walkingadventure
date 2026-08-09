// El conseguidor de recursos: compone los dos lotes, se los da a los clientes
// inyectados, guarda los binarios y devuelve el material que `declaraIlustracion` y
// `declaraFoto` congelan. Es la mitad de SPEC-025 que sí habla con alguien.
//
// Tres cosas lo ordenan, y ninguna es de dibujo:
//
// 1. **Un lote es una llamada.** Las fotos van en una sola tanda al terminar de generar
//    la celda y las ilustraciones en una sola tanda al preparar la salida. Nunca hay una
//    petición por aventura ni una por beat: el recuento de llamadas es lo que se afirma.
// 2. **La degradación hacia quien juega es silenciosa, la del cableado no.** Que el
//    proveedor esté caído deja el recurso ausente con su motivo y la pantalla dice lo
//    mismo; que falte un cliente o el almacén **impide construir esto**, nombrando la
//    pieza. Devolver un lote vacío sería indistinguible de que no hubiera nada que pedir.
// 3. **No sabe nada del mundo.** Recibe planes con las peticiones ya construidas y
//    cribadas por el núcleo, así que por aquí no puede colarse un dato real: no hay
//    ningún camino desde el mundo congelado hasta una petición que pase por este módulo.
//
// El vocabulario de los motivos llega **dentro del plan**, no escrito aquí: con dos
// copias, añadir un motivo en el núcleo dejaría esta mitad contando con el catálogo
// viejo sin que nada se pusiera rojo.

/**
 * El tope de llamadas de pago por lote de mapa. Es la copia declarada de
 * `TOPE_PAGO_LOTE_MAPA` de `server/config.mjs`, que esta mitad no puede importar.
 *
 * Se recorta **aquí** y no aguas arriba a propósito: pasarse del tope haría que el proxy
 * respondiera «no hay» a las últimas peticiones, que es la misma forma de un fallo de
 * red. Recortando antes, lo que no cabe queda ausente con el motivo `tope` y se distingue.
 */
export const TOPE_PAGO_LOTE_MAPA = 60;

/** El testigo con el que se reconoce que ganó la pared y no la respuesta. */
const PARED = Symbol('presupuesto agotado');

/** La espera por defecto: un temporizador, cancelable para no dejar el proceso vivo. */
function esperaPorDefecto(ms) {
  let id = null;
  const promesa = new Promise((resolve) => { id = setTimeout(() => resolve(PARED), ms); });
  return { promesa, cancela: () => { if (id != null) clearTimeout(id); } };
}

function exigePieza(pieza, nombre, paraQue) {
  if (!pieza) {
    throw new Error(
      `el conseguidor de recursos se construye sin ${nombre}, y no arranca sin él: ${paraQue}. ` +
      'Devolver un lote vacío haría que «no hay nada que pedir» y «nadie cableó esto» fueran indistinguibles',
    );
  }
  return pieza;
}

function exigeMetodo(pieza, metodo, nombre) {
  if (typeof pieza[metodo] !== 'function') {
    throw new Error(`el ${nombre} inyectado no expone "${metodo}", que es como se le pide un lote entero de una vez`);
  }
  return pieza;
}

function exigePresupuesto(ms, nombre) {
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(
      `el conseguidor necesita ${nombre} declarado y llegó ${JSON.stringify(ms) ?? String(ms)}: ` +
      'sin él se esperaría sin límite, y una preparación que espera sin límite es una pantalla de carga',
    );
  }
  return ms;
}

/**
 * Las listas blancas **cerradas** del contenido que puede volver, por ruta.
 *
 * Son la copia declarada de lo que el proxy deja pasar —la entrada de caché de imágenes
 * de `server/superficie.mjs` y lo que devuelve `server/aguas-arriba/places.mjs`—, que esta
 * mitad no puede importar por la misma razón que no puede importar `server/config.mjs`.
 *
 * Cerradas y no «que estén los obligatorios»: comprobar solo lo obligatorio deja pasar una
 * respuesta con una URL de Places dentro, y lo que se guarda en el almacén es el contenido
 * **entero**. La URL de Places caduca y no puede vivir en el dispositivo, así que un campo
 * de más no es ruido: es exactamente lo que el esquema cerrado viene a impedir.
 */
export const CAMPOS_DE_CONTENIDO_DE_IMAGEN = Object.freeze(['formato', 'ancho', 'alto', 'datos_base64']);
export const CAMPOS_DE_CONTENIDO_DE_FOTO = Object.freeze(['foto']);
export const CAMPOS_DE_FOTO = Object.freeze(['referencia', 'atribucion', 'ancho', 'alto']);

/**
 * Comprueba un objeto contra una lista blanca cerrada. Devuelve el primer campo de más.
 *
 * Es el mismo mecanismo que `campoDeMas` de `server/proxy.mjs` y con el mismo nombre a
 * propósito: allí criba lo que **entra** y aquí lo que **vuelve**, y las dos mitades del
 * esquema cerrado tienen que poder leerse como una sola.
 */
function campoDeMas(objeto, permitidos) {
  if (objeto === null || objeto === undefined) return null;
  if (typeof objeto !== 'object' || Array.isArray(objeto)) return '(no es un objeto)';
  return Object.keys(objeto).find((c) => !permitidos.includes(c)) ?? null;
}

/** El contenido de una imagen, tal como lo declara la ruta de imagen del proxy. */
function imagenValida(contenido) {
  if (!contenido || typeof contenido !== 'object') return null;
  if (campoDeMas(contenido, CAMPOS_DE_CONTENIDO_DE_IMAGEN)) return null;
  if (typeof contenido.datos_base64 !== 'string' || !contenido.datos_base64) return null;
  if (typeof contenido.formato !== 'string') return null;
  if (!Number.isInteger(contenido.ancho) || !Number.isInteger(contenido.alto)) return null;
  return contenido;
}

/** El contenido de una foto, tal como lo declara la ruta de Places del proxy. */
function fotoValida(contenido) {
  const foto = contenido && contenido.foto;
  if (!foto || typeof foto !== 'object') return null;
  if (campoDeMas(contenido, CAMPOS_DE_CONTENIDO_DE_FOTO)) return null;
  if (campoDeMas(foto, CAMPOS_DE_FOTO)) return null;
  if (typeof foto.referencia !== 'string' || !foto.referencia) return null;
  if (typeof foto.atribucion !== 'string' || !foto.atribucion) return null;
  if (!Number.isInteger(foto.ancho) || !Number.isInteger(foto.alto)) return null;
  return contenido;
}

/**
 * Monta el conseguidor.
 *
 * @param {object} deps
 * @param {{pideLote: (peticiones: object[]) => Promise<object[]>}} deps.clienteDeImagenes
 * @param {{pideLote: (peticiones: object[]) => Promise<object[]>}} deps.clienteDeFotos
 * @param {{guarda: (clave: string, contenido: object) => string, tiene: (ref: string) => boolean}} deps.almacen
 * @param {number} deps.presupuestoIlustracionesMs  la pared de la preparación.
 * @param {number} deps.presupuestoFotosMs  la rebanada del minuto de la generación.
 * @param {number} [deps.topePorLote]  llamadas de pago que caben en un lote de mapa.
 * @param {(ms: number) => {promesa: Promise<any>, cancela: () => void}} [deps.espera]
 */
export function creaConseguidorDeRecursos({
  clienteDeImagenes,
  clienteDeFotos,
  almacen,
  presupuestoIlustracionesMs,
  presupuestoFotosMs,
  topePorLote = TOPE_PAGO_LOTE_MAPA,
  espera = esperaPorDefecto,
}) {
  exigePieza(clienteDeImagenes, 'cliente de imágenes', 'es quien convierte un prompt de ficción en una ilustración');
  exigePieza(clienteDeFotos, 'cliente de fotos', 'es quien convierte un place_id en la foto del lado real');
  exigePieza(almacen, 'almacén de recursos binarios', 'el documento congelado guarda la referencia y nunca el binario, así que sin almacén no hay a qué referirse');
  exigeMetodo(clienteDeImagenes, 'pideLote', 'cliente de imágenes');
  exigeMetodo(clienteDeFotos, 'pideLote', 'cliente de fotos');
  exigeMetodo(almacen, 'guarda', 'almacén de recursos binarios');
  exigeMetodo(almacen, 'tiene', 'almacén de recursos binarios');
  exigePresupuesto(presupuestoIlustracionesMs, 'el presupuesto de la preparación');
  exigePresupuesto(presupuestoFotosMs, 'el presupuesto del lote de fotos del mapa');
  if (!Number.isInteger(topePorLote) || topePorLote <= 0) {
    throw new Error(`el tope de llamadas por lote tiene que ser un entero positivo y llegó ${JSON.stringify(topePorLote) ?? String(topePorLote)}`);
  }

  /** El motivo, sacado del plan. Un plan sin vocabulario es un plan de otra versión. */
  const motivoDe = (plan, nombre) => {
    const motivo = plan?.motivos?.[nombre];
    if (typeof motivo !== 'string' || !motivo) {
      throw new Error(`el plan no trae el vocabulario de motivos de ausencia (falta "${nombre}"): el catálogo lo declara el núcleo y esta mitad no tiene una copia propia`);
    }
    return motivo;
  };

  /**
   * El cuerpo común de los dos lotes: recortar al tope, una sola llamada, la pared, y el
   * reparto de lo que llegó entre conseguido y ausente con su motivo.
   */
  async function conLote({ plan, cliente, presupuestoMs, valida, guarda, motivoDelNoHay }) {
    if (!plan || !Array.isArray(plan.lote)) {
      throw new Error('el conseguidor necesita el plan que compone el núcleo, con su lote y sus ausencias ya declaradas');
    }
    const ausentes = [...(plan.ausentes ?? [])];
    const ausenta = (entrada, motivo) => ausentes.push({ familia: plan.familia, clave: entrada.clave, motivo });

    const cabe = plan.lote.slice(0, topePorLote);
    for (const entrada of plan.lote.slice(topePorLote)) ausenta(entrada, motivoDe(plan, 'TOPE'));

    if (cabe.length === 0) return { conseguidos: [], ausentes, llamadas: 0, recortados: plan.lote.length - cabe.length };

    const reloj = espera(presupuestoMs);
    let respuesta;
    try {
      respuesta = await Promise.race([
        Promise.resolve(cliente.pideLote(cabe.map((e) => e.peticion))),
        reloj.promesa,
      ]);
    } catch {
      // Lo que dijo el proveedor se descarta entero: puede traer la clave, la URL con la
      // clave dentro o el cuerpo que se le mandó. Aquí solo importa que no se pudo pedir.
      for (const entrada of cabe) ausenta(entrada, motivoDe(plan, 'NO_SE_PUDO_PEDIR'));
      return { conseguidos: [], ausentes, llamadas: 1, recortados: plan.lote.length - cabe.length };
    } finally {
      reloj.cancela();
    }

    // La pared cierra con lo que haya. Lo que llegue después se descarta para esta salida:
    // el momento «en marcha» no admite ningún cambio de pantalla que no sea un aviso.
    if (respuesta === PARED || !Array.isArray(respuesta) || respuesta.length !== cabe.length) {
      for (const entrada of cabe) ausenta(entrada, motivoDe(plan, 'NO_SE_PUDO_PEDIR'));
      return { conseguidos: [], ausentes, llamadas: 1, recortados: plan.lote.length - cabe.length };
    }

    const conseguidos = [];
    for (let i = 0; i < cabe.length; i++) {
      const entrada = cabe[i];
      const sobre = respuesta[i];
      if (!sobre || typeof sobre !== 'object' || sobre.hay !== true) {
        // «No hay» es una respuesta normal del sobre y no un error de transporte, así que
        // no se cuenta como «no se pudo pedir»: son dos cosas distintas y se cuentan aparte.
        ausenta(entrada, motivoDe(plan, motivoDelNoHay));
        continue;
      }
      const contenido = valida(sobre.contenido);
      if (contenido === null) {
        // Una respuesta que no encaja en el esquema se descarta **sin interpretarse**.
        ausenta(entrada, motivoDe(plan, 'NO_SE_PUDO_PEDIR'));
        continue;
      }
      conseguidos.push(guarda(entrada, contenido));
    }
    return { conseguidos, ausentes, llamadas: 1, recortados: plan.lote.length - cabe.length };
  }

  return {
    topePorLote,

    /**
     * El lote de fotos, **al terminar de generar la celda y nunca por aventura**.
     *
     * @param plan el de `sitiosParaFotografiar`.
     * @returns `{ conseguidos: [{clave, placeId, recurso, atribucion}], ausentes, llamadas }`.
     *   El binario no vuelve: vuelve la referencia con la que el documento lo cita.
     */
    async fotosDeCelda(plan) {
      return conLote({
        plan,
        cliente: clienteDeFotos,
        presupuestoMs: presupuestoFotosMs,
        valida: fotoValida,
        motivoDelNoHay: 'SIN_FOTO',
        guarda: (entrada, contenido) => ({
          clave: entrada.clave,
          placeId: entrada.placeId,
          recurso: almacen.guarda(entrada.clave, contenido),
          atribucion: contenido.foto.atribucion,
        }),
      });
    },

    /**
     * El lote de ilustraciones, **al preparar la salida**.
     *
     * Un «no hay» del proveedor de imágenes se cuenta como `no-se-pudo-pedir` y no como
     * `sin-foto`: `sin-foto` dice que el sitio real no tiene foto, que es una propiedad
     * del sitio, y una imagen de ficción no tiene equivalente — si no llega, es que no se
     * consiguió pedir.
     *
     * @param plan el de `planDeIlustraciones`.
     */
    async ilustracionesDeSalida(plan) {
      return conLote({
        plan,
        cliente: clienteDeImagenes,
        presupuestoMs: presupuestoIlustracionesMs,
        valida: imagenValida,
        motivoDelNoHay: 'NO_SE_PUDO_PEDIR',
        guarda: (entrada, contenido) => ({
          clave: entrada.clave,
          prompt: entrada.prompt,
          claveDeCache: entrada.claveDeCache,
          recurso: almacen.guarda(entrada.claveDeCache, contenido),
        }),
      });
    },

    /** Si el binario de una referencia está de verdad. Es lo que consume `exigeResidentes`. */
    tiene(referencia) { return almacen.tiene(referencia); },
  };
}
