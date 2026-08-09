// Los cinco módulos de plataforma que esta compilación monta, reunidos para
// inyectarlos en el registro. Es el único sitio de la app donde se decide QUÉ se
// monta; quien quiera un registro doblado —o vacío— construye el suyo con otros.

import { salud } from './salud.js';
import { haptico } from './haptico.js';
import { notificaciones } from './notificaciones.js';
// Sin extensión a propósito: es así como Metro elige entre `respaldo.ios.js` y
// `respaldo.android.js`, y entre `rotulo.ios.js` y `rotulo.android.js`. Con
// `./respaldo.js` la selección por plataforma no ocurre y las dos implementaciones
// sobran. Son las dos únicas importaciones sin extensión de la app, y las dos son
// capacidades con ciclo de vida propio en cada sistema.
import { respaldo } from './respaldo';
import { rotulo } from './rotulo';

export const MODULOS_DE_PLATAFORMA = [salud, haptico, notificaciones, respaldo, rotulo];
