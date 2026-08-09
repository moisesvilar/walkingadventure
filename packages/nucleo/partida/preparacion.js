// La composición de la preparación, A2P5, y **la separación de los dos silencios**.
//
// La pantalla es de SPEC-025 y aquí no se rediseña: lo que esta fila entrega es que se puede
// afirmar que **dice exactamente lo mismo con red y sin ella**. Por eso `componePreparacion`
// recibe los recursos conseguidos —con sus ausencias y sus motivos— y devuelve una pantalla
// que no depende de ellos: dos composiciones, una con todo y otra sin nada, salen idénticas.
// Si algún día dejaran de serlo, la igualdad se pone roja sin abrir un simulador.
//
// Los dos silencios se parecen y no son el mismo, y esta es la frontera:
//
// - **El silencio de diseño** (RNF-RED-001): sin cobertura, ninguna pantalla lo menciona.
//   Anunciarlo solo serviría para señalar algo que quien juega no puede arreglar.
// - **La degradación silenciosa** (§6h): una pieza que no está y no protesta. Prohibida, y se
//   comprueba haciendo fallar la construcción.
//
// Lo que los mantiene separados en la práctica: **la ausencia se anota siempre en el dato con
// su motivo**, aunque la pantalla no diga nada. El silencio es hacia quien juega, nunca hacia
// el dato. `resumenDeLaPreparacion` es ese lado, y no lo lee ninguna pantalla.

import { congelaHondo } from '../core/congelar.js';
import { LINEAS_DE_LA_PREPARACION, textoDelGuion } from './guion-de-antes-de-salir.js';
import { CLAVES_DE_AUSENCIA, ORIGENES_DE_TEXTO } from './recursos.js';

/** Los bloques de A2P5, en orden. Lista cerrada: aquí no cabe un indicador por recurso. */
export const BLOQUES_DE_LA_PREPARACION = congelaHondo(['titulo', 'coletilla', 'lineas', 'contrato', 'listo']);

/**
 * Lo que la preparación no tiene, nombrado para que la ausencia se pueda poner roja.
 *
 * `cancelar` está en la lista y es una decisión: dura segundos y termina sola, así que un botón
 * de cancelar sería un control para un momento que no lo necesita. Volver atrás desde aquí es
 * «Otra cosa» en la ficha, un paso antes.
 */
export const BLOQUES_QUE_LA_PREPARACION_NO_TIENE = congelaHondo([
  'cancelar',
  'barra-de-progreso',
  'porcentaje',
  'aviso-de-red',
  'detalle-por-recurso',
]);

/**
 * Compone la preparación.
 *
 * @param {object} opciones `recursos` lo conseguido, con sus ausencias — **y no cambia nada de
 *   lo que vuelve**. Está en la firma a propósito: es lo que permite componer dos veces, con
 *   cobertura y sin ella, y afirmar que salen iguales.
 * @returns la pantalla entera, congelada.
 */
export function componePreparacion({ recursos = null } = {}) {
  // El parámetro se lee una vez y solo para comprobar que llega bien formado: si de aquí
  // saliera un texto distinto según lo conseguido, la pantalla estaría contando la red.
  if (recursos !== null && typeof recursos !== 'object') {
    throw new Error(`la preparación se compone sobre lo conseguido y llegó ${JSON.stringify(recursos) ?? String(recursos)}`);
  }
  return congelaHondo({
    bloques: [...BLOQUES_DE_LA_PREPARACION],
    titulo: textoDelGuion('a2p5', 'titulo'),
    coletilla: textoDelGuion('a2p5', 'coletilla'),
    lineas: LINEAS_DE_LA_PREPARACION.map((id) => textoDelGuion('a2p5', id)),
    contrato: textoDelGuion('a2p5', 'contrato'),
    listo: textoDelGuion('a2p5', 'listo'),
    // El botón se habilita al cerrar la preparación, no al conseguirlo todo: cerrar con lo que
    // haya es indistinguible de haber terminado, que es exactamente lo que el criterio exige.
    dejaSalir: true,
    // La pantalla no menciona nunca lo que faltó. El dato sí, y vive en el resumen.
    menciona: null,
  });
}

/**
 * El otro lado: **lo que queda anotado**, que sí lo dice todo.
 *
 * Cada texto con su origen —`llm` o `plantilla`— y cada recurso ausente con su motivo del
 * vocabulario cerrado de SPEC-025. Sin cobertura, esto queda lleno de `plantilla` y de motivos,
 * y la pantalla de arriba no cambia ni una letra.
 */
export function resumenDeLaPreparacion({ textos = [], ausencias = [] } = {}) {
  const origenes = {};
  for (const t of textos) {
    if (!ORIGENES_DE_TEXTO.includes(t?.origen)) {
      throw new Error(
        `el texto "${t?.clave}" de la preparación se guarda con el origen ${JSON.stringify(t?.origen) ?? String(t?.origen)}, ` +
        `que no está declarado: los orígenes son ${ORIGENES_DE_TEXTO.join(', ')}. Un texto sin origen sería un texto del que ya no se sabe quién lo escribió`,
      );
    }
    origenes[t.clave] = t.origen;
  }
  for (const a of ausencias) {
    if (!CLAVES_DE_AUSENCIA.includes(a?.motivo)) {
      throw new Error(
        `la ausencia de "${a?.clave}" se declara con el motivo ${JSON.stringify(a?.motivo) ?? String(a?.motivo)}, que no está declarado: ` +
        `los motivos son ${CLAVES_DE_AUSENCIA.join(', ')}. Una ausencia sin motivo es una degradación silenciosa con otro nombre`,
      );
    }
  }
  const deLlm = textos.filter((t) => t.origen === 'llm').length;
  return congelaHondo({
    textos: textos.length,
    origenes,
    // Cuántos vinieron del modelo. Cero es un resultado normal —una salida sin cobertura— y no
    // un fallo: lo que sería un fallo es no saberlo.
    deLlm,
    dePlantilla: textos.length - deLlm,
    ausencias: ausencias.map((a) => ({ familia: a.familia, clave: a.clave, motivo: a.motivo })),
  });
}
