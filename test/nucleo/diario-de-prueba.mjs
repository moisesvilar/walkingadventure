// SPEC-016 · Lo que necesitan las pruebas del diario, del registro de hechos y de
// la reconstrucción: hechos estructurados de un suceso escritos a mano, versiones
// como las que sedimentan en un núcleo, y una salida entera de hechos con los tipos
// que hoy existen.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `partida-de-prueba.mjs`: los
// dobles son de la frontera del núcleo —datos de OSM, GPS, reloj, proxy, red— y
// esto es andamiaje de prueba. **Nada de aquí toca la red, el reloj del sistema ni
// el azar**: el momento es siempre el día de diario y el paso del mundo, escritos a
// mano por quien prueba.

import { SIGNOS, hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import { CLASES_DE_ENTRADA, FUENTES, entradaDeDiario } from '../../packages/nucleo/partida/diario.js';
import { versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { SEMILLA_A, SEMILLA_B } from './celda-de-prueba.mjs';

export { SIGNOS, CLASES_DE_ENTRADA, FUENTES };

/** El mapa activo de casi todas las pruebas. Los dos conviven en las de dos mapas. */
export const MAPA = 'casa';
export const OTRO_MAPA = 'fuera';

/** Las dos semillas de partida fijas, las mismas que usan las demás pruebas. */
export const SEMILLA = SEMILLA_A;
export const OTRA_SEMILLA = SEMILLA_B;

/** El suceso del que habla toda la fila: las campanas de la ermita de «Monfrida». */
export const SUCESO = 'las-campanas';

/**
 * Los hechos estructurados de un suceso, en la escala que se pida.
 *
 * La escala es el eje con el que se ve a simple vista qué versión se guardó: una
 * campana es la fiel y tres son la abultada del nivel 1.
 */
export function hechosDe({ asunto = 'la ermita tocó a rebato', veces = 1, lugar = 'Monfrida' } = {}) {
  return hechosFieles({ asunto, escala: { veces }, detalle: { lugar } });
}

/** Una versión como la que sedimenta en un núcleo, con su nivel y su signo. */
export function versionDe({
  rumor = SUCESO,
  nivel = 1,
  veces = 3,
  signo = SIGNOS.BUENO,
  origen = 'Monfrida',
  plantilla = 'entrega-sospechosa',
  texto = null,
  oidoEn = null,
} = {}) {
  return versionQueLlego({ rumor, plantilla, origen, nivel, signo, hechos: hechosDe({ veces }), oidoEn, texto });
}

/** Una entrada del diario ya normalizada, con lo mínimo escrito y el resto por defecto. */
export function entradaDe({
  mapa = MAPA,
  suceso = SUCESO,
  nucleo = 'Monfrida',
  fuente = null,
  lugar = null,
  dia = 1,
  paso = 1,
  veces = 3,
  nivel = 1,
  signo = SIGNOS.BUENO,
  plantilla = 'entrega-sospechosa',
  origen = 'Monfrida',
  texto = null,
} = {}) {
  return entradaDeDiario({
    mapa,
    clase: CLASES_DE_ENTRADA.OIDO,
    suceso,
    fuente: fuente ?? { tipo: FUENTES.NUCLEO, sitio: nucleo },
    lugar: lugar ?? nucleo,
    dia,
    paso,
    hechos: hechosDe({ veces }),
    nivel,
    signo,
    plantilla,
    origen,
    texto,
  });
}

/** Los hechos de una salida cualquiera, con los cuatro tipos que hoy se reproducen. */
export function hechosDeUnaSalida({ mapa = MAPA, dia = 1, paso = 1, nucleo = 'Monfrida', suceso = SUCESO, nivel = 1, veces = 3 } = {}) {
  return [
    { tipo: 'paso-ejecutado', mapa, dia, paso, carga: { n: paso, restoM: 120.5, restoFondoM: 40 } },
    { tipo: 'sitio-pisado', mapa, dia, paso, carga: { sitio: nucleo } },
    {
      tipo: 'version-oida',
      mapa,
      dia,
      paso,
      carga: {
        suceso,
        fuenteTipo: FUENTES.NUCLEO,
        fuenteSitio: nucleo,
        fuentePuesto: null,
        lugar: nucleo,
        nivel,
        signo: SIGNOS.BUENO,
        plantilla: 'entrega-sospechosa',
        origen: 'Monfrida',
        texto: null,
        hechos: hechosDe({ veces }),
      },
    },
  ];
}

/** Un hecho de cara conocida, que es lo que devuelve al reconstruir a los NPCs. */
export function hechoDeCaraConocida({ mapa = MAPA, dia = 1, paso = 1, sitio = 'Monfrida', puesto = 'regencia' } = {}) {
  return { tipo: 'cara-conocida', mapa, dia, paso, carga: { sitio, puesto } };
}

/** Un hecho de objeto obtenido, que es lo que devuelve la repisa al reconstruir. */
export function hechoDeObjeto({ mapa = MAPA, dia = 1, paso = 1, id = 'farol-de-la-ermita', clase = 'recuerdo' } = {}) {
  return { tipo: 'objeto-obtenido', mapa, dia, paso, carga: { id, clase, procedencia: 'Monfrida', diaDeRepisa: 'día 1' } };
}

/**
 * La vista del mapa activo que pide el rango: sus núcleos y la pregunta de si uno le
 * pertenece. Es la misma forma que cumple `arbolDeCalzadas(mundo)`, escrita a mano
 * porque aquí lo que se afirma es que el rango vuelve, no cómo se lee un mundo.
 */
export function mapaDeNucleos(nucleos) {
  return { nucleos: nucleos.slice(), tiene: (n) => nucleos.includes(n) };
}
