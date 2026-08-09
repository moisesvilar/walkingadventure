// Dobles de los cuatro proveedores de aguas arriba —texto, imagen, Places y generación—
// con los tres modos que ya tiene el doble del proxy: responde, falla siempre y responde
// mal. SPEC-001 no los entregó porque allí el proxy era el sujeto simulado; aquí es el
// sujeto probado y lo que hay que simular es lo que tiene delante.
//
// Firma idéntica a la de los clientes reales de `server/aguas-arriba/`: `{ruta, seCachea,
// pide(peticion)}`. Es lo que permite enchufarlos por la frontera de inyección sin que el
// proxy se entere, y lo que hace que un cambio de firma en el cliente real ponga rojas
// estas pruebas en lugar de dejarlas verdes contra un doble que ya no se parece a nada.
//
// No abren ninguna conexión: no importan `fetch` ni nada que lo use. Y llevan cuenta de
// **cuántas llamadas de pago** han recibido, que es lo único con lo que se puede afirmar
// «no se paga» en lugar de suponerlo.

import { FalloDeAguasArriba, TIPOS_DE_FALLO } from '../../server/aguas-arriba/comun.mjs';

export const MODOS = Object.freeze(['responde', 'falla-siempre', 'responde-mal']);

/** Las cuatro rutas de contenido, con si su ruta cachea, igual que los clientes reales. */
export const PROVEEDORES = Object.freeze({
  texto: { seCachea: false },
  imagen: { seCachea: true },
  places: { seCachea: true },
  generacion: { seCachea: true },
});

/**
 * Lo que devuelve el modo «responde», en la forma exacta que valida cada cliente real.
 *
 * Es función de la petición a propósito: dos prompts distintos tienen que dar contenidos
 * distintos, porque si no, una prueba de caché pasaría aunque la caché devolviera
 * cualquier cosa.
 */
export function contenidoFijo(ruta, peticion = {}) {
  switch (ruta) {
    case 'texto':
      return { texto: `texto de ficción para «${peticion.prompt}» en ${peticion.idioma ?? 'es'}` };
    case 'imagen':
      return {
        formato: (peticion.formato && peticion.formato.tipo) || 'png',
        ancho: (peticion.formato && peticion.formato.ancho) || 512,
        alto: (peticion.formato && peticion.formato.alto) || 512,
        datos_base64: Buffer.from(`imagen:${peticion.prompt}`).toString('base64'),
      };
    case 'places':
      return {
        foto: {
          referencia: `foto-de-${peticion.place_id}`,
          atribucion: 'Fotografía de ejemplo del andamiaje de pruebas',
          ancho: 800,
          alto: 600,
        },
      };
    case 'generacion':
      return { elements: [{ type: 'node', id: 1, tags: { name: 'nodo de fixture' } }] };
    default:
      throw new Error(`ruta de contenido no declarada: "${ruta}"`);
  }
}

/**
 * Lo que devuelve el modo «responde mal»: respuestas que llegan pero no encajan en el
 * esquema de su ruta. El cliente real las convierte en `respuesta-invalida`, y lo que
 * esto verifica es que una respuesta no se da por buena sólo porque llegó.
 */
export function contenidoDefectuoso(ruta, peticion = {}) {
  switch (ruta) {
    // Texto vacío: el cliente real exige `texto` no vacío.
    case 'texto': return { texto: '   ' };
    // Sin binario y con un campo de más que además trae un dato vivo: si algo así se
    // cacheara, la caché dejaría de contener sólo lo inerte.
    case 'imagen': return { formato: 'png', ancho: 512, alto: 512, place_id: peticion.place_id ?? 'ChIJ-vivo' };
    // Foto sin atribución: Places la exige y sin ella la entrada no se puede servir.
    case 'places': return { foto: { referencia: 'sin-atribucion', ancho: 800, alto: 600 } };
    // Overpass respondiendo su página de error, que es el 200 que no trae datos.
    case 'generacion': return { error: '<html>runtime error</html>' };
    default: throw new Error(`ruta de contenido no declarada: "${ruta}"`);
  }
}

/**
 * Un proveedor doblado.
 *
 * @param {object} opciones
 * @param {'texto'|'imagen'|'places'|'generacion'} opciones.ruta
 * @param {'responde'|'falla-siempre'|'responde-mal'} [opciones.modo='responde']
 * @param {string} [opciones.fallo='caido']  el tipo del catálogo cerrado de
 *   `aguas-arriba/comun.mjs` con el que falla el modo «falla siempre». `plazo-agotado`
 *   se simula así y no esperando de verdad: el reloj real no entra en ninguna prueba.
 * @param {(peticion: object) => Promise<void>} [opciones.antesDeResponder]  gancho para
 *   sostener dos peticiones simultáneas en vuelo y poder afirmar la coalescencia.
 * @param {boolean} [opciones.respuestaNula=false]  en modo «responde mal», devolver
 *   `null` en vez de lanzar. Es el otro camino por el que el proxy llega a «no hay», y
 *   sin él la guarda de `contenido === null` de `proxy.mjs` no la ejercita nadie.
 */
export function creaProveedorDoblado({ ruta, modo = 'responde', fallo = 'caido', antesDeResponder, respuestaNula = false } = {}) {
  if (!PROVEEDORES[ruta]) throw new Error(`ruta de contenido no declarada: "${ruta}"`);
  if (!MODOS.includes(modo)) throw new Error(`modo inválido: "${modo}". Modos válidos: ${MODOS.join(', ')}`);
  if (!TIPOS_DE_FALLO.includes(fallo)) throw new Error(`tipo de fallo no declarado: "${fallo}"`);

  const registro = [];

  return {
    ruta,
    seCachea: PROVEEDORES[ruta].seCachea,
    modo,

    async pide(peticion) {
      // Se anota antes de decidir qué se devuelve: en modo «falla siempre» también
      // interesa saber qué se pidió, y sobre todo **cuántas veces** se llegó hasta aquí.
      registro.push({ indice: registro.length, peticion });
      if (antesDeResponder) await antesDeResponder(peticion);

      if (modo === 'falla-siempre') throw new FalloDeAguasArriba(ruta, fallo);
      if (modo === 'responde-mal') {
        // El doble ocupa el sitio del **cliente entero**, validación incluida: el
        // cliente real valida `contenidoDefectuoso` contra el esquema de su ruta, no
        // le encaja y lanza `respuesta-invalida`. Devolver el cuerpo defectuoso tal
        // cual sería doblar el proveedor y saltarse la validación, que es justo la
        // pieza que aquí interesa que corra.
        contenidoDefectuoso(ruta, peticion);
        if (respuestaNula) return null;
        throw new FalloDeAguasArriba(ruta, 'respuesta-invalida');
      }
      return contenidoFijo(ruta, peticion);
    },

    /** Cuántas veces se llegó a aguas arriba. Es con lo que se afirma «no se paga». */
    llamadas() { return registro.length; },
    /** Qué se pidió, en el orden en que llegó. */
    peticiones() { return registro.map((p) => ({ ...p })); },
    /** Vuelve a cero sin recrear el doble, para medir un tramo concreto del tráfico. */
    olvida() { registro.length = 0; },
  };
}

/**
 * Los cuatro a la vez, en la forma que espera `creaProxy({aguasArriba})`.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.modo='responde']  el modo de los cuatro.
 * @param {object} [opciones.porRuta]  modo distinto para una ruta concreta, que es lo que
 *   hace falta para «el proveedor de imágenes caído mientras el resto responde».
 */
export function creaAguasArribaDobladas({ modo = 'responde', fallo = 'caido', porRuta = {}, antesDeResponder, respuestaNula = false } = {}) {
  const cuatro = {};
  for (const ruta of Object.keys(PROVEEDORES)) {
    const propio = porRuta[ruta] ?? {};
    cuatro[ruta] = creaProveedorDoblado({
      ruta,
      modo: propio.modo ?? modo,
      fallo: propio.fallo ?? fallo,
      antesDeResponder: propio.antesDeResponder ?? antesDeResponder,
      respuestaNula: propio.respuestaNula ?? respuestaNula,
    });
  }
  /** Llamadas de pago sumadas de las cuatro rutas. */
  cuatro.llamadasDePago = () =>
    Object.keys(PROVEEDORES).reduce((n, ruta) => n + cuatro[ruta].llamadas(), 0);
  return cuatro;
}

export { FalloDeAguasArriba };
