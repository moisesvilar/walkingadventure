// El motor de pasos: el reloj del mundo, que son los kilómetros de quien anda y no
// el calendario. Aquí viven el contador por mapa, la semilla de cada paso, la
// ejecución de N pasos consecutivos y el registro de productores.
//
// Es una **capa sobre el mundo ya generado, nunca una fase de la tubería**: no
// importa la generación ni ninguna de sus fases, no toca el documento congelado de
// ninguna celda y no resiembra nada. Solo hace avanzar un número y le da a quien
// cuelgue de él un azar reproducible. Romper esa frontera convertiría el mundo en
// una regeneración, que es el fallo que la batería llama «Lo generado no se
// resiembra jamás».

import { congelaHondo } from '../core/congelar.js';
import { makeRng } from '../core/rng.js';
import { SUFIJO_DE_PASO, exigeSemilla, semillaDePaso } from '../core/semilla.js';
import { validaEfectos } from './efectos.js';

export { SUFIJO_DE_PASO, semillaDePaso };

/**
 * El estado de pasos de una partida: un registro por mapa y nada más.
 *
 * Viaja con la partida y **nunca dentro del documento congelado de una celda**: el
 * documento describe el mundo, que no cambia al andar (SPEC-009). Una partida
 * recién creada no tiene ningún registro, y el primer mapa que se lea marcará cero.
 */
export function estadoDePasos() {
  return { mapas: {} };
}

/** El identificador del mapa cuyo contador avanza. No hay ninguno por defecto. */
export function exigeMapaId(mapaId, quien = 'el motor de pasos') {
  if (typeof mapaId !== 'string' || !mapaId) {
    throw new Error(
      `falta el mapa activo: ${quien} necesita el identificador del mapa cuyo contador avanza y llegó ` +
      `${JSON.stringify(mapaId) ?? String(mapaId)}; avanzar un contador por defecto movería el mundo de casa mientras andas fuera`,
    );
  }
  return mapaId;
}

/**
 * El registro de un mapa dentro del estado, creándolo si es la primera vez.
 *
 * `n` es del motor. `restoM`, `restoFondoM` y `reserva` los gobierna
 * `kilometros.js` y viven aquí porque son el mismo estado serializable de la
 * partida: partirlos en dos documentos obligaría a guardarlos por separado y a que
 * un contador y su resto pudieran cargarse desparejados.
 */
export function estadoDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId);
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de pasos llega mal formado: se espera lo que devuelve estadoDePasos(), un objeto con "mapas"');
  }
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) {
    estado.mapas[id] = { n: 0, restoM: 0, restoFondoM: 0, reserva: [] };
  }
  return estado.mapas[id];
}

// Un productor sin identificador no puede tener azar propio, y sin azar propio
// añadir uno desplazaría el de los demás. Por eso el identificador es obligatorio y
// su ausencia es un error de construcción, no un caso que se resuelva por el orden.
function exigeProductores(productores) {
  if (!Array.isArray(productores)) {
    throw new Error(`los productores de paso llegan como ${JSON.stringify(productores) ?? String(productores)}: se espera una lista, aunque sea vacía`);
  }
  const vistos = [];
  productores.forEach((p, i) => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) {
      throw new Error(`el productor de paso ${i} llega sin "id": el motor deriva su azar del identificador, así que sin él añadir un productor desplazaría el azar de los demás`);
    }
    if (typeof p.produce !== 'function') {
      throw new Error(`el productor de paso "${p.id}" no trae "produce(n, azar)": el motor sabe cuándo ocurre un paso y con qué azar, nunca qué ocurre en él`);
    }
    if (vistos.includes(p.id)) {
      throw new Error(`dos productores de paso comparten el identificador "${p.id}": compartirían flujo de azar sin que nadie lo notara`);
    }
    vistos.push(p.id);
  });
  return productores.slice();
}

/**
 * Levanta el motor de un mapa.
 *
 * @param {object} opciones
 *   `semilla` la de la partida; `mapaId` el mapa cuyo contador avanza; `estado` el
 *   estado de pasos de la partida, compartido entre los mapas; `productores` la
 *   lista inyectada de `{ id, produce(n, azar) }`.
 *
 *   **Sin ningún productor el motor funciona entero** y el contador avanza igual:
 *   lo declara la spec y es como corre en `node --test`. Es la única ausencia que
 *   aquí no es un error; todo lo demás que falte se dice.
 *
 *   `baseDePaso` es la **base de siembra**, opcional: una función `(n) => string`
 *   que sustituye a `semillaDePaso`. Existe por el prólogo del mundo (SPEC-013),
 *   que instancia este mismo motor con un contador y una base propios —los suyos
 *   cuelgan de la semilla del mapa con el sufijo del prólogo y el número de
 *   intento— y muere al terminar el intento. Sin ella el prólogo compartiría flujo
 *   de azar con los primeros pasos de la jugadora, que es la colisión que el sufijo
 *   por fase existe para impedir. Ninguna otra decisión del motor se reabre.
 */
export function creaMotorDePasos({ semilla, mapaId, estado = estadoDePasos(), productores = [], baseDePaso = null } = {}) {
  const semillaPartida = exigeSemilla(semilla);
  const id = exigeMapaId(mapaId);
  const cola = exigeProductores(productores);
  const registro = estadoDeMapa(estado, id);
  if (baseDePaso !== null && typeof baseDePaso !== 'function') {
    throw new Error(`la base de siembra del motor llega como ${JSON.stringify(baseDePaso) ?? String(baseDePaso)}: se espera una función (n) => string, o nada para la de la partida`);
  }
  const base = (n) => (baseDePaso ? baseDePaso(n) : semillaDePaso(semillaPartida, id, n));

  // Calcula el paso entero **sin tocar nada**: los productores corren, sus efectos
  // se validan, y solo si todo sale bien lo escribe quien llama. Un paso se aplica
  // entero o no se aplica, porque su contenido depende de su número y un número
  // gastado a medias haría la partida irreproducible.
  const calcula = (n) => {
    const semillaBase = base(n);
    const efectos = [];
    for (const p of cola) {
      // Cada productor recibe un azar derivado del suyo: añadir la cola de
      // oportunidades no puede desplazar los rumores ya sembrados.
      const producidos = p.produce(n, makeRng(`${semillaBase}#${p.id}`));
      for (const e of validaEfectos(producidos, `el productor "${p.id}" en el paso ${n} del mapa ${id}`)) efectos.push(e);
    }
    return congelaHondo({ n, efectos });
  };

  const ejecuta = (n) => {
    const paso = calcula(n);
    registro.n = n;
    return paso;
  };

  return {
    mapaId: id,

    /**
     * Los pasos que lleva dados este mapa. Es el mecanismo, no una consulta de
     * pantalla: el design system prohíbe enseñar cifras de progreso, y lo que no
     * sale del núcleo hacia la presentación no se puede pintar por descuido.
     */
    contador() {
      return registro.n;
    },

    /** La semilla del paso `n` —o del último dado—, sin ninguna marca de reloj dentro. */
    semillaDelPaso(n = registro.n) {
      return base(n);
    },

    /** El azar del paso `n`, reproducible: dos veces desde cero dan exactamente lo mismo. */
    azarDelPaso(n = registro.n) {
      return makeRng(base(n));
    },

    /**
     * Ejecuta el paso número `n`, que tiene que ser el siguiente.
     *
     * Es el contrato del reloj de mundo de SPEC-001: «avanza N pasos, numerados
     * desde el actual». Un número que no sea el siguiente se dice en voz alta en
     * lugar de aceptarse: aceptarlo dejaría huecos o repeticiones en una secuencia
     * de la que cuelga la semilla de cada paso.
     */
    paso(n) {
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`número de paso inválido ${JSON.stringify(n) ?? String(n)}: los pasos se numeran desde uno con enteros positivos`);
      }
      if (n !== registro.n + 1) {
        throw new Error(`el mapa ${id} va por el paso ${registro.n} y le piden ejecutar el ${n}: los pasos van consecutivos, sin saltos ni repeticiones`);
      }
      return ejecuta(n);
    },

    /**
     * Avanza `cuantos` pasos consecutivos desde el actual más uno.
     *
     * Cero es un no-op declarado y no un error; lo que no es un entero no negativo
     * falla nombrando lo que llegó.
     */
    avanza(cuantos) {
      if (!Number.isInteger(cuantos) || cuantos < 0) {
        throw new Error(`número de pasos inválido ${JSON.stringify(cuantos) ?? String(cuantos)}: el motor avanza un número entero y no negativo de pasos`);
      }
      const dados = [];
      for (let k = 0; k < cuantos; k++) dados.push(ejecuta(registro.n + 1));
      return congelaHondo(dados);
    },

    /**
     * El registro vivo de este mapa. Lo usa `kilometros.js`, que es quien gobierna
     * el resto y la reserva; el contador solo lo mueven `paso` y `avanza`.
     */
    registro() {
      return registro;
    },
  };
}

/**
 * El estado de pasos en forma serializable, con los mapas en orden estable.
 *
 * El orden es declarado y no el de inserción: dos partidas con los mismos mapas
 * tienen que escribir el mismo texto aunque se hayan levantado en otro orden.
 */
export function congelaPasos(estado) {
  const mapas = {};
  for (const id of Object.keys(estado?.mapas ?? {}).sort()) {
    const r = estado.mapas[id];
    mapas[id] = {
      n: r.n,
      restoM: r.restoM,
      restoFondoM: r.restoFondoM,
      reserva: r.reserva.map((p) => ({ n: p.n, efectos: p.efectos.map((e) => ({ ...e })) })),
    };
  }
  return { mapas };
}

/** El estado de pasos de vuelta de su documento, con el contador y la reserva intactos. */
export function levantaPasos(doc) {
  const estado = estadoDePasos();
  for (const id of Object.keys(doc?.mapas ?? {}).sort()) {
    const r = doc.mapas[id] ?? {};
    if (!Number.isInteger(r.n) || r.n < 0) {
      throw new Error(`el contador del mapa ${id} llega como ${JSON.stringify(r.n) ?? String(r.n)}: tiene que ser un entero no negativo`);
    }
    estado.mapas[id] = {
      n: r.n,
      restoM: Number.isFinite(r.restoM) ? r.restoM : 0,
      restoFondoM: Number.isFinite(r.restoFondoM) ? r.restoFondoM : 0,
      reserva: (r.reserva ?? []).map((p) => congelaHondo({ n: p.n, efectos: (p.efectos ?? []).map((e) => ({ ...e })) })),
    };
  }
  return estado;
}
