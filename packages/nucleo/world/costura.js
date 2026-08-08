// La costura entre dos celdas contiguas: une en el borde compartido las calzadas
// que el corte de la consulta dejó a un lado y a otro. Vive fuera de las dos
// celdas a propósito — si viviera dentro de una, abrir la vecina la modificaría, y
// eso es resembrar.

import { makeProjector } from '../core/geo.js';
import { congelaHondo } from '../core/congelar.js';
import { SUFIJOS_DE_FASE, semillaDeCelda } from '../core/semilla.js';
import { claveDeCelda, ordenCanonico, proyectorDeRejilla, sonContiguas } from './rejilla.js';
import { COSER_MAX } from './routes.js';

/**
 * Umbral de cosido del borde. Es **el mismo** que el del callejero interno: dos
 * umbrales distintos producirían costuras que dependen de por qué lado se mira, y
 * `accesibilidad.md` §2 trata todo lo cosido igual —suposición marcada, nunca
 * transitable prometida—.
 */
export const UMBRAL_COSTURA_M = COSER_MAX;

/** La semilla de una costura, con su sufijo propio para no desplazar el azar de ninguna fase. */
export function semillaDeCostura(semilla, mapaId, a, b) {
  const [p, q] = ordenCanonico(a, b);
  return `${semillaDeCelda(semilla, mapaId, p)}|${claveDeCelda(q)}${SUFIJOS_DE_FASE.costura}`;
}

// Los puntos de un mundo de celda llegan en metros desde el centro de su celda:
// para compararlos con los de la vecina hay que llevarlos al marco métrico de la
// rejilla, que es el único común a las dos.
function alMarcoDeLaRejilla(registro, proyRejilla) {
  const proyCelda = makeProjector(registro.centro.lat, registro.centro.lon);
  return (p) => {
    const g = proyCelda.toLatLon(p);
    return proyRejilla.toXY(g.lat, g.lon);
  };
}

/**
 * Candidatos al cosido: por cada polilínea de calzada o de callejero, el punto más
 * cercano al borde, y solo si está dentro de la franja del umbral.
 *
 * Uno por polilínea y no todos sus puntos: coser dos veces la misma calzada no une
 * nada nuevo, y en un borde denso multiplicaría las comparaciones sin cambiar el
 * resultado.
 */
function candidatosDelBorde(registro, aMetros, borde) {
  const out = [];
  const familias = [
    ['calzada', registro.mundo.routes ?? []],
    ['callejero', registro.mundo.geo.roads ?? []],
  ];
  for (const [familia, lista] of familias) {
    lista.forEach((via, indice) => {
      let mejor = null;
      for (const pt of via.pts ?? []) {
        const q = aMetros(pt);
        const d = borde.eje === 'x' ? Math.abs(q.x - borde.en) : Math.abs(q.y - borde.en);
        if (mejor === null || d < mejor.distanciaAlBorde) mejor = { punto: q, distanciaAlBorde: d };
      }
      if (!mejor || mejor.distanciaAlBorde > UMBRAL_COSTURA_M) return;
      out.push({
        clave: `${familia}:${indice}@${Math.round(mejor.punto.x)},${Math.round(mejor.punto.y)}`,
        celda: registro.clave,
        familia,
        punto: mejor.punto,
      });
    });
  }
  // Orden estable por clave: los candidatos salen de arrays deterministas, pero el
  // empate a distancia lo tiene que romper algo que no sea el orden de llegada.
  return out.sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
}

/**
 * Cose dos celdas por el borde que comparten.
 *
 * @param {object} opciones `rejilla`, `a` y `b` (registros de celda), `semilla` de
 *   la partida y `mapaId`.
 * @returns la costura, congelada. Si las celdas no comparten borde, la costura sale
 *   vacía y no es un error: preguntar por dos celdas que no se tocan es una
 *   pregunta legítima con una respuesta vacía.
 */
export function coseCeldas({ rejilla, a, b, semilla, mapaId }) {
  if (!rejilla || !a || !b) throw new Error('coseCeldas necesita la rejilla y los registros de las dos celdas');
  const [p, q] = ordenCanonico(a.celda, b.celda);
  // Qué registro es cuál lo decide el orden canónico de los índices y no el orden
  // en que llegaron: es lo que hace que abrir A y después B cosa igual que al revés.
  const rp = a.clave === claveDeCelda(p) ? a : b;
  const rq = rp === a ? b : a;
  const base = {
    celdas: [claveDeCelda(p), claveDeCelda(q)],
    umbralM: UMBRAL_COSTURA_M,
    semilla: semilla ? semillaDeCostura(semilla, mapaId, p, q) : null,
  };

  if (!sonContiguas(p, q)) return congelaHondo({ ...base, contiguas: false, borde: null, aristas: [] });

  // El borde compartido, en el marco métrico de la rejilla. El orden canónico
  // garantiza que la vecina siempre está al este o al norte de la primera.
  const borde = p.i === q.i
    ? { eje: 'y', en: (p.j + 0.5) * rejilla.ladoM }
    : { eje: 'x', en: (p.i + 0.5) * rejilla.ladoM };

  const proyRejilla = proyectorDeRejilla(rejilla);
  const cp = candidatosDelBorde(rp, alMarcoDeLaRejilla(rp, proyRejilla), borde);
  const cq = candidatosDelBorde(rq, alMarcoDeLaRejilla(rq, proyRejilla), borde);

  const pares = [];
  for (const x of cp) {
    for (const y of cq) {
      const d = Math.hypot(x.punto.x - y.punto.x, x.punto.y - y.punto.y);
      if (d <= UMBRAL_COSTURA_M) pares.push({ d, x, y });
    }
  }
  pares.sort((m, n) => m.d - n.d || (m.x.clave < n.x.clave ? -1 : m.x.clave > n.x.clave ? 1 : 0) || (m.y.clave < n.y.clave ? -1 : 1));

  const gastados = new Set();
  const aristas = [];
  for (const { d, x, y } of pares) {
    if (gastados.has(x.clave) || gastados.has(y.clave)) continue;
    gastados.add(x.clave);
    gastados.add(y.clave);
    aristas.push({
      desde: { celda: x.celda, clave: x.clave, ...proyRejilla.toLatLon(x.punto) },
      hasta: { celda: y.celda, clave: y.clave, ...proyRejilla.toLatLon(y.punto) },
      metros: Math.round(d),
      // Marcada como suposición, igual que lo que cose el callejero interno: el
      // mapa no puede prometer un camino que nadie ha comprobado que exista.
      suposicion: true,
    });
  }

  return congelaHondo({ ...base, contiguas: true, borde, aristas });
}
