// El bundle del núcleo que consume `app/marcha/llegadas.js`, armado **por ruta relativa**.
//
// Existe por lo de siempre (§6u de `pipeline/decisiones-orquestador.md`): `app/nucleo/piezas.js`
// cita el paquete por su nombre —`@walkingadventure/nucleo`— y no resuelve sin `node_modules`,
// y la batería de núcleo tiene que arrancar entera en un clon limpio sin instalar nada. Así que
// las pruebas arman el mismo bundle por su ruta, y que las dos listas digan lo mismo se
// comprueba leyendo la fuente, que es lo que impide que esta se quede atrás.
//
// Aquí no se dobla nada: son las funciones de verdad del paquete. Lo único que cambia respecto
// a producción es por dónde se importan.

import { creaCapaDeDescartes } from '../../packages/nucleo/partida/descartes.js';
import { pisaSitio } from '../../packages/nucleo/partida/estado.js';
import { creaLlegadas } from '../../packages/nucleo/partida/llegadas.js';
import { creaMicroEncuentros } from '../../packages/nucleo/partida/microencuentros.js';
import { loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { estadoDeMapa } from '../../packages/nucleo/partida/pasos.js';
import { MODOS, TIPOS_DE_PASO } from '../../packages/nucleo/partida/secuencia.js';
import { cierraLaEscena } from '../../packages/nucleo/partida/triangulacion.js';
import { PRESENTACIONES, creaVisor } from '../../packages/nucleo/partida/visor.js';

/** Lo mismo que `NUCLEO_DE_LAS_LLEGADAS` de `app/nucleo/piezas.js`, ni una función más. */
export const NUCLEO_DE_LAS_LLEGADAS = Object.freeze({
  creaLlegadas,
  creaVisor,
  creaCapaDeDescartes,
  creaMicroEncuentros,
  loQueSeCuentaEn,
  estadoDeMapa,
  pisaSitio,
  cierraLaEscena,
  PRESENTACIONES,
  TIPOS_DE_PASO,
  MODOS,
});
