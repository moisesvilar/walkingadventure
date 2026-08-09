// Las tres piezas que SPEC-025 mete en la frontera de inyección del conseguidor de
// recursos: el cliente de imágenes, el cliente de fotos y el almacén de binarios.
//
// Los dos clientes son el mismo mecanismo con distinto contenido, así que se montan
// desde una sola fábrica: lo que cambia entre uno y otro es qué sobre devuelven, y
// tenerlo dos veces sería la manera conocida de que un modo se arregle en uno y se
// quede roto en el otro.
//
// Los cuatro modos son los que la spec declara —responde fijo, falla siempre, responde
// mal y tarda más que el presupuesto—, más el «no hay», que **no es un modo de fallo**:
// es la respuesta normal de un sitio real sin foto, y separarla es justo lo que permite
// contar aparte «Places no tiene foto» y «no se pudo pedir».
//
// El registro guarda **los lotes y no las peticiones sueltas**, porque lo que se afirma
// de esta capa es el recuento de llamadas: una petición por beat y una llamada por lote
// se parecen mucho si solo se cuentan peticiones.
//
// No abre ninguna conexión ni lee ningún reloj: el contenido sale de
// test/fixtures/proxy/respuestas.json, que es el mismo que sirve el doble del proxy.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'proxy');

export const MODOS = ['responde', 'falla-siempre', 'responde-mal', 'tarda', 'no-hay'];

/** El contenido fijo de cada ruta, copia nueva en cada llamada. */
function contenidoFijo(ruta) {
  return JSON.parse(readFileSync(join(FIXTURES, 'respuestas.json'), 'utf8'))[ruta];
}

/**
 * El sobre de la respuesta, con la misma forma que el del proxy: tipo, `hay`, si vino de
 * caché y el contenido. Un sobre de «no hay» lleva `contenido: null` y **no** lleva error:
 * que un sitio no tenga foto no es un fallo de nadie.
 */
function sobre(tipo, contenido) {
  return { tipo, hay: contenido != null, deCache: false, contenido: contenido ?? null };
}

/** Contenidos que no encajan en el esquema de la ruta, para el modo «responde mal». */
const DEFECTUOSOS = {
  imagen: [
    { id: 'imagen-sin-binario', contenido: { formato: 'png', ancho: 512, alto: 512 } },
    { id: 'imagen-con-campo-de-mas', contenido: { ...contenidoFijo('imagen'), url: 'https://ejemplo/imagen.png' } },
    { id: 'imagen-con-medidas-de-texto', contenido: { ...contenidoFijo('imagen'), ancho: '512' } },
  ],
  places: [
    { id: 'places-sin-foto-dentro', contenido: { atribucion: 'suelta, fuera del sobre de la foto' } },
    { id: 'places-sin-atribucion', contenido: { foto: { referencia: 'x', ancho: 800, alto: 600 } } },
    { id: 'places-con-url', contenido: { foto: { ...contenidoFijo('places').foto, url: 'https://maps.googleapis.com/caduca' } } },
  ],
};

/**
 * Un cliente de lote.
 *
 * @param {'imagen'|'places'} ruta
 * @param {object} [opciones]
 * @param {string} [opciones.modo='responde']
 * @param {string} [opciones.defecto]  id del catálogo de defectuosos. Sin él sale el
 *   primero de la ruta: no se sortea, porque un doble que elige al azar deja de valer
 *   para afirmar dos veces lo mismo.
 * @param {number[]} [opciones.sinContenido]  índices dentro del lote que responden «no
 *   hay» aunque el modo sea «responde». Es el caso mixto, que es el normal.
 * @param {number} [opciones.deMenos=0]  cuántas respuestas de menos devuelve, para el
 *   caso de un lote que vuelve descuadrado.
 */
function creaCliente(ruta, { modo = 'responde', defecto, sinContenido = [], deMenos = 0 } = {}) {
  if (!MODOS.includes(modo)) {
    throw new Error(`modo de cliente inválido: "${modo}". Modos válidos: ${MODOS.join(', ')}`);
  }
  const lotes = [];

  return {
    ruta,
    modo,
    async pideLote(peticiones) {
      // El lote se registra antes de decidir qué se devuelve: en modo «falla siempre»
      // también interesa saber qué se pidió, y sobre todo cuántas veces.
      lotes.push(peticiones.map((p) => JSON.parse(JSON.stringify(p))));

      if (modo === 'falla-siempre') {
        throw new Error(`el proveedor de ${ruta} no responde (doble en modo "falla-siempre")`);
      }
      // Nunca resuelve: la pared del presupuesto es la única que puede ganar. Sin
      // temporizador, para no dejar nada vivo detrás de la prueba.
      if (modo === 'tarda') return new Promise(() => {});

      if (modo === 'responde-mal') {
        const catalogo = DEFECTUOSOS[ruta];
        const entrada = defecto ? catalogo.find((e) => e.id === defecto) : catalogo[0];
        if (!entrada) {
          throw new Error(`no hay ninguna respuesta defectuosa con id "${defecto}" para la ruta ${ruta}. Disponibles: ${catalogo.map((e) => e.id).join(', ')}`);
        }
        return peticiones.map(() => ({ tipo: ruta, hay: true, deCache: false, contenido: entrada.contenido }));
      }

      const todas = peticiones.map((_, i) => (
        modo === 'no-hay' || sinContenido.includes(i) ? sobre(ruta, null) : sobre(ruta, contenidoFijo(ruta))
      ));
      return deMenos > 0 ? todas.slice(0, Math.max(0, todas.length - deMenos)) : todas;
    },
    /** Los lotes recibidos, en orden. `lotes().length` es el recuento de llamadas. */
    lotes() { return lotes.map((l) => l.map((p) => ({ ...p }))); },
    /** Cuántas llamadas ha recibido. Cero es una respuesta válida y nunca un error. */
    llamadas() { return lotes.length; },
    /** Todas las peticiones que han salido, aplanadas. */
    peticiones() { return lotes.flat(); },
  };
}

/** El cliente de imágenes: un prompt de ficción y su formato entran, un binario sale. */
export function creaClienteDeImagenes(opciones = {}) {
  return creaCliente('imagen', opciones);
}

/** El cliente de fotos: un `place_id` entra, el binario con su atribución sale. */
export function creaClienteDeFotos(opciones = {}) {
  return creaCliente('places', opciones);
}

/**
 * El almacén de recursos binarios, en memoria.
 *
 * Devuelve una referencia y **no el binario**: es la propiedad que el documento congelado
 * necesita, y tenerla aquí es lo que permite afirmar que por el documento no pasa una
 * imagen. `olvida` existe para poder montar el caso de un residente cuyo binario ya no
 * está, que es lo que distingue «se perdió» de «nunca se tuvo».
 */
export function creaAlmacenDeRecursos() {
  const datos = new Map();
  const registro = [];
  return {
    datos,
    registro,
    guarda(clave, contenido) {
      const referencia = `local/recursos/${clave}`;
      registro.push({ op: 'guarda', clave, referencia });
      datos.set(referencia, contenido);
      return referencia;
    },
    tiene(referencia) {
      registro.push({ op: 'tiene', referencia });
      return datos.has(referencia);
    },
    /** Borra el binario dejando la referencia declarada por ahí fuera. */
    olvida(referencia) { return datos.delete(referencia); },
    guardados() { return [...datos.keys()].sort(); },
  };
}

/** La pared que no llega a vencer: gana siempre la respuesta del proveedor. */
export const NUNCA_VENCE = () => ({ promesa: new Promise(() => {}), cancela: () => {} });

/** La pared ya vencida: la preparación cierra con lo que tenga, que puede ser nada. */
export const VENCE_YA = () => ({ promesa: Promise.resolve('la pared del presupuesto'), cancela: () => {} });

/** Una pared que cuenta si la cancelaron, para afirmar que no queda nada vivo detrás. */
export function paredContada() {
  const estado = { pedidas: [], canceladas: 0 };
  const pared = (ms) => {
    estado.pedidas.push(ms);
    return { promesa: new Promise(() => {}), cancela: () => { estado.canceladas += 1; } };
  };
  pared.estado = estado;
  return pared;
}
