// El punto de entrada. Nada más que registrar la raíz: toda la orquestación vive
// en App.js, y todo lo que sabe de plataforma, en app/plataforma/.

import { registerRootComponent } from 'expo';

import { App } from './App.js';

registerRootComponent(App);
