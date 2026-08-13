// Los cinco módulos de plataforma que esta compilación monta, reunidos para
// inyectarlos en el registro. Es el único sitio de la app donde se decide QUÉ se
// monta; quien quiera un registro doblado —o vacío— construye el suyo con otros.

import { haptico } from './haptico.js';
import { notificaciones } from './notificaciones.js';
// Sin extensión a propósito: es así como Metro elige entre `respaldo.ios.js` y
// `respaldo.android.js`, entre `rotulo.ios.js` y `rotulo.android.js`, y desde la fila 46
// entre `salud.ios.js` y `salud.android.js`. Con `./respaldo.js` la selección por
// plataforma no ocurre y las dos implementaciones sobran. Son las tres únicas
// importaciones sin extensión de la app, y las tres son capacidades con ciclo de vida
// propio en cada sistema: salud entra en el grupo porque su fuente nativa es Health
// Connect, que es de Android, y meterla en un módulo compartido con un `if` de plataforma
// dentro llevaría la dependencia nativa al árbol de iOS.
import { salud } from './salud';
import { respaldo } from './respaldo';
import { rotulo } from './rotulo';

export const MODULOS_DE_PLATAFORMA = [salud, haptico, notificaciones, respaldo, rotulo];
