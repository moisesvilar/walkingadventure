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

import { cargaConfig, cargaConfigDeOrigen } from './config.mjs';
import { creaProxy } from './proxy.mjs';
import { creaAlmacenEnDisco } from './cache.mjs';
import { creaClienteDeTexto } from './aguas-arriba/texto.mjs';
import { creaClienteDeImagen } from './aguas-arriba/imagen.mjs';
import { creaClienteDePlaces } from './aguas-arriba/places.mjs';
import { creaClienteDeOverpass } from './aguas-arriba/overpass.mjs';
import { creaSonda } from './aguas-arriba/sonda-overpass.mjs';
import { creaCobertura } from './aguas-arriba/cobertura.mjs';

const entorno = process.env;
const config = cargaConfig(entorno);
// La segunda negativa a arrancar: sin `OVERPASS_PROPIO` y sin `CONSULTA_VERSION` no se
// sigue. Caer a los mirrors públicos por no tener configurado el propio es el fallo
// documentado que costó siete horas, y un fallo silencioso deja de serlo aquí.
const origen = cargaConfigDeOrigen(entorno);

const RAIZ = entorno.WA_PROXY_DIR || join(homedir(), '.walkingadventure', 'proxy');

if (!entorno.VERIFICADOR_ATESTACION) {
  throw new Error(
    'el proxy no arranca: falta VERIFICADOR_ATESTACION, la ruta del módulo que verifica ' +
    'App Attest y Play Integrity. Sin verificador, las claves de los proveedores quedan abiertas.',
  );
}
const { creaVerificador } = await import(entorno.VERIFICADOR_ATESTACION);

// El origen de los datos de OSM: la sonda que decide si el propio recibe tráfico, la
// cobertura del extracto que decide si tiene sentido preguntarle, y el cliente con la
// cadena entera. La sonda arranca antes que el servidor: hasta que no la confirmen dos
// pasadas en verde, el propio no recibe ni una generación.
const sonda = creaSonda({ fetch, url: origen.OVERPASS_PROPIO, config: origen });
const cobertura = creaCobertura({
  cobertura: origen.COBERTURA,
  extracto: origen.EXTRACTO,
  mirror: origen.EXTRACTO_MIRROR,
  fecha: origen.EXTRACTO_FECHA,
});
const generacion = creaClienteDeOverpass({ fetch, config: origen, sonda, cobertura });
sonda.arranca();
sonda.revisa();

const proxy = creaProxy({
  config,
  verificador: creaVerificador({ entorno }),
  aguasArriba: {
    texto: creaClienteDeTexto({ fetch, url: entorno.URL_TEXTO, clave: entorno.CLAVE_TEXTO, config }),
    imagen: creaClienteDeImagen({ fetch, url: entorno.URL_IMAGEN, clave: entorno.CLAVE_IMAGEN, config }),
    places: creaClienteDePlaces({ fetch, url: entorno.URL_PLACES, clave: entorno.CLAVE_PLACES, config }),
    generacion,
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

// El recuento por eslabón se cablea aquí y no antes: la métrica vive dentro del proxy y
// el cliente se construye antes que él.
generacion.conectaMetrica((eslabon) => proxy.metrica.cuentaEslabon(eslabon));

// Ni una línea por petición, ni al arrancar ni después. Lo único que se escribe en la
// salida estándar es que el proceso está en pie, y eso ocurre una vez.
proxy.arranca(Number(entorno.PUERTO || 8138));
process.on('SIGTERM', async () => { sonda.para(); await proxy.cierra(); process.exit(0); });
