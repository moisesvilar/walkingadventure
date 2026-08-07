// GPS simulado: recorre una polilínea a cadencia fija, con paradas y con tramos a
// velocidad de vehículo. Es la única fuente de recorridos del proyecto — las
// pruebas de @nucleo consumen la secuencia y las de @app la misma secuencia
// traducida a pasos `setLocation` de Maestro — para que núcleo y app no midan
// sobre dos recorridos distintos.
//
// Todo el tiempo sale del origen recibido: aquí no se lee el reloj del sistema,
// porque una secuencia que depende de cuándo se ejecuta no se puede afirmar.

const R_TIERRA = 6371000;

// Proyección equirectangular local: a escala de un barrio el error es
// despreciable y evita arrastrar trigonometría esférica a un doble de pruebas.
function metros(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat = ((a.lat + b.lat) / 2) * rad;
  const x = dLon * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * R_TIERRA;
}

function interpola(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

export const MODOS = ['andando', 'ambiguo', 'vehiculo', 'parado'];

// Umbrales de conveniencia del andamiaje, NO una decisión de diseño: game-design/
// cierra que el vehículo se aparta (bucle-jugable.md §9) pero no fija en qué
// km/h. El detector real llegará con su propia spec y sus propios umbrales; aquí
// solo hacen falta para que quien escribe una prueba no tenga que declarar el
// modo en cada tramo. Declarando `modo` se ignoran.
const UMBRAL_ANDANDO_KMH = 6;
const UMBRAL_VEHICULO_KMH = 15;

function modoPorVelocidad(velocidadKmH) {
  if (velocidadKmH <= UMBRAL_ANDANDO_KMH) return 'andando';
  if (velocidadKmH >= UMBRAL_VEHICULO_KMH) return 'vehiculo';
  return 'ambiguo';
}

function normalizaTramos(opciones, ultimoVertice) {
  if (opciones.tramos) return opciones.tramos;
  // Atajo: sin tramos declarados, la polilínea entera a una velocidad.
  if (opciones.velocidadKmH === undefined) {
    throw new Error('recorrido sin tramos: declara `tramos` o una `velocidadKmH` para toda la polilínea');
  }
  return [{ hastaVertice: ultimoVertice, velocidadKmH: opciones.velocidadKmH, modo: opciones.modo }];
}

/**
 * Simula un recorrido y devuelve la secuencia de posiciones.
 *
 * @param {object} opciones
 * @param {{lat:number, lon:number}[]} opciones.polilinea  al menos dos vértices
 * @param {number} [opciones.cadenciaMs=1000]  cada cuánto se emite una posición
 * @param {number} [opciones.origenTiempoMs=0] instante de la primera posición
 * @param {Array} [opciones.tramos]  cada tramo es o un avance
 *   `{ hastaVertice, velocidadKmH, modo? }` o una parada `{ parada: true, duracionS }`
 * @param {number} [opciones.velocidadKmH]  atajo: un único tramo a esta velocidad
 * @returns {{lat:number, lon:number, tMs:number, modo:string, tramo:number}[]}
 */
export function simulaRecorrido(opciones) {
  const { polilinea, cadenciaMs = 1000, origenTiempoMs = 0 } = opciones;

  if (!Array.isArray(polilinea) || polilinea.length < 2) {
    throw new Error(
      `polilínea inválida: hacen falta al menos dos vértices y llegaron ${Array.isArray(polilinea) ? polilinea.length : 0}. ` +
      'Un solo punto no es un recorrido.',
    );
  }
  if (!(cadenciaMs > 0)) throw new Error(`parámetro inválido "cadenciaMs": ${cadenciaMs}; tiene que ser mayor que cero`);

  const tramos = normalizaTramos(opciones, polilinea.length - 1);
  if (!tramos.length) throw new Error('recorrido sin tramos: no hay nada que simular');

  const posiciones = [];
  let tMs = origenTiempoMs;
  let vertice = 0;
  let punto = polilinea[0];

  // La primera posición es el vértice de salida, con el modo del primer tramo que
  // se mueva: así una secuencia nunca empieza sin modo declarado.
  const primerAvance = tramos.find((t) => !t.parada);
  posiciones.push({
    ...punto,
    tMs,
    modo: primerAvance ? (primerAvance.modo ?? modoPorVelocidad(primerAvance.velocidadKmH)) : 'parado',
    tramo: 0,
  });

  tramos.forEach((tramo, iTramo) => {
    if (tramo.parada) {
      const duracionS = tramo.duracionS;
      if (!(duracionS > 0)) throw new Error(`parámetro inválido "duracionS" en el tramo ${iTramo}: ${duracionS}; tiene que ser mayor que cero`);
      const ticks = Math.max(1, Math.round((duracionS * 1000) / cadenciaMs));
      for (let k = 0; k < ticks; k++) {
        tMs += cadenciaMs;
        // Durante la parada la posición no cambia y el tiempo sí avanza: es lo que
        // permite afirmar que las paradas no bajan el ritmo medido.
        posiciones.push({ ...punto, tMs, modo: 'parado', tramo: iTramo });
      }
      return;
    }

    const velocidadKmH = tramo.velocidadKmH;
    if (!(velocidadKmH > 0)) {
      throw new Error(`parámetro inválido "velocidadKmH" en el tramo ${iTramo}: ${velocidadKmH}; tiene que ser mayor que cero`);
    }
    const modo = tramo.modo ?? modoPorVelocidad(velocidadKmH);
    if (!MODOS.includes(modo)) {
      throw new Error(`parámetro inválido "modo" en el tramo ${iTramo}: "${modo}". Válidos: ${MODOS.join(', ')}`);
    }

    const hasta = tramo.hastaVertice ?? polilinea.length - 1;
    if (!Number.isInteger(hasta) || hasta <= vertice || hasta > polilinea.length - 1) {
      throw new Error(
        `parámetro inválido "hastaVertice" en el tramo ${iTramo}: ${hasta}; ` +
        `tiene que ser un entero entre ${vertice + 1} y ${polilinea.length - 1}`,
      );
    }

    const pasoM = (velocidadKmH / 3.6) * (cadenciaMs / 1000);

    // Se avanza vértice a vértice sin saltarse ninguno: cada posición emitida está
    // como mucho a `pasoM` de la anterior, que es lo que significa "sin saltos".
    while (vertice < hasta) {
      const destino = polilinea[vertice + 1];
      let restante = metros(punto, destino);
      while (restante > pasoM) {
        const t = pasoM / restante;
        punto = interpola(punto, destino, t);
        restante = metros(punto, destino);
        tMs += cadenciaMs;
        posiciones.push({ ...punto, tMs, modo, tramo: iTramo });
      }
      // El vértice se pisa exacto: si se dejara aproximado, dos recorridos con la
      // misma polilínea acabarían en puntos distintos según la cadencia.
      punto = { lat: destino.lat, lon: destino.lon };
      vertice++;
      tMs += cadenciaMs;
      posiciones.push({ ...punto, tMs, modo, tramo: iTramo });
    }
  });

  return posiciones;
}

/**
 * La misma secuencia como pasos de un flujo de Maestro. Mismas posiciones y mismo
 * orden: en @app el GPS se simula encadenando `setLocation`, y si esto se
 * generase por otro camino los recorridos de núcleo y de app dejarían de ser el
 * mismo dato.
 */
export function pasosMaestro(secuencia) {
  return secuencia.map((p) => ({ setLocation: { latitude: p.lat, longitude: p.lon } }));
}
