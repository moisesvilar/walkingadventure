// El punto de arranque del proxy en producción.
//
//   TOPE_DIARIO_GASTO=... node server/arranca.mjs
//
// Aquí es donde se junta todo lo que en `node --test` llega inyectado: la
// configuración del entorno, los cuatro clientes de aguas arriba con sus claves, el
// verificador de atestación y los almacenes en disco. Y aquí es donde el proxy se
// niega a arrancar por las dos razones declaradas: sin `TOPE_DIARIO_GASTO`, y con una
// escritura fuera de la superficie declarada.
//
// El verificador de App Attest y Play Integrity es la **única** pieza que en producción
// habla con Apple y con Google, y es la única que exige una dependencia. Se resuelve
// por su ruta en el entorno (`VERIFICADOR_ATESTACION`) en lugar de importarse aquí, para
// que este fichero —y con él la suite entera— siga corriendo sin instalar nada. Sin esa
// variable, el proxy tampoco arranca: un verificador que acepta a todo el mundo es un
// proxy con las claves abiertas.

import { join } from 'node:path';
import { homedir } from 'node:os';

import { cargaConfig } from './config.mjs';
import { creaProxy } from './proxy.mjs';
import { creaAlmacenEnDisco } from './cache.mjs';
import { creaClienteDeTexto } from './aguas-arriba/texto.mjs';
import { creaClienteDeImagen } from './aguas-arriba/imagen.mjs';
import { creaClienteDePlaces } from './aguas-arriba/places.mjs';
import { creaClienteDeGeneracion } from './aguas-arriba/generacion.mjs';

const entorno = process.env;
const config = cargaConfig(entorno);

const RAIZ = entorno.WA_PROXY_DIR || join(homedir(), '.walkingadventure', 'proxy');

if (!entorno.VERIFICADOR_ATESTACION) {
  throw new Error(
    'el proxy no arranca: falta VERIFICADOR_ATESTACION, la ruta del módulo que verifica ' +
    'App Attest y Play Integrity. Sin verificador, las claves de los proveedores quedan abiertas.',
  );
}
const { creaVerificador } = await import(entorno.VERIFICADOR_ATESTACION);

const proxy = creaProxy({
  config,
  verificador: creaVerificador({ entorno }),
  aguasArriba: {
    texto: creaClienteDeTexto({ fetch, url: entorno.URL_TEXTO, clave: entorno.CLAVE_TEXTO, config }),
    imagen: creaClienteDeImagen({ fetch, url: entorno.URL_IMAGEN, clave: entorno.CLAVE_IMAGEN, config }),
    places: creaClienteDePlaces({ fetch, url: entorno.URL_PLACES, clave: entorno.CLAVE_PLACES, config }),
    generacion: creaClienteDeGeneracion({ fetch, url: entorno.URL_OVERPASS, config }),
  },
  // La caché de generación se abre igual, encendida o apagada: si está apagada no
  // escribe nada, y así el interruptor no cambia la forma del cableado.
  almacenes: {
    'cache-imagenes': creaAlmacenEnDisco({ entrada: 'cache-imagenes', raiz: join(RAIZ, 'imagenes'), config }),
    'cache-fotos': creaAlmacenEnDisco({ entrada: 'cache-fotos', raiz: join(RAIZ, 'fotos'), config }),
    'cache-generacion': creaAlmacenEnDisco({ entrada: 'cache-generacion', raiz: join(RAIZ, 'generacion'), config }),
    'metrica-del-dia': creaAlmacenEnDisco({ entrada: 'metrica-del-dia', raiz: join(RAIZ, 'metrica'), config }),
  },
});

// Ni una línea por petición, ni al arrancar ni después. Lo único que se escribe en la
// salida estándar es que el proceso está en pie, y eso ocurre una vez.
proxy.arranca(Number(entorno.PUERTO || 8138));
process.on('SIGTERM', async () => { await proxy.cierra(); process.exit(0); });
