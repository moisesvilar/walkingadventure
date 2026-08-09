// Los cuatro módulos de plataforma que esta compilación monta, reunidos para
// inyectarlos en el registro. Es el único sitio de la app donde se decide QUÉ se
// monta; quien quiera un registro doblado —o vacío— construye el suyo con otros.

import { salud } from './salud.js';
import { haptico } from './haptico.js';
import { notificaciones } from './notificaciones.js';
// Sin extensión a propósito, y es la única de la app: es así como Metro elige
// entre `respaldo.ios.js` y `respaldo.android.js`. Con `./respaldo.js` la
// selección por plataforma no ocurre y las dos implementaciones sobran.
import { respaldo } from './respaldo';

export const MODULOS_DE_PLATAFORMA = [salud, haptico, notificaciones, respaldo];
