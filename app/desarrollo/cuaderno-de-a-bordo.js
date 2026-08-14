// El cuaderno de a bordo de desarrollo: escribe JSON Lines en caché y nunca en la partida.
// Su reloj real es una excepción deliberada a SPEC-016: esta traza no es estado del juego.

export const VERSION_DEL_CUADERNO = 1;
export const TOPE_DEL_CUADERNO = 5 * 1024 * 1024;

export const TIPOS_DEL_CUADERNO = Object.freeze([
  'sesion', 'apertura', 'fijo-de-anclaje', 're-anclaje', 'posicion', 'cadencia',
  'geofence', 'llegada', 'situacion', 'marca', 'averia', 'error-global',
  'rechazo-global', 'truncado', 'averia-del-cuaderno',
]);

const TIPOS = new Set(TIPOS_DEL_CUADERNO);
// Hermes no garantiza `TextEncoder` como una API web. Este contador UTF-8 no depende de DOM.
const bytes = (texto) => {
  let total = 0;
  for (const caracter of texto) {
    const punto = caracter.codePointAt(0);
    total += punto <= 0x7f ? 1 : punto <= 0x7ff ? 2 : punto <= 0xffff ? 3 : 4;
  }
  return total;
};

function mensaje(error) {
  return error?.message ?? String(error);
}

function errorComoDatos(error, extra = {}) {
  const esError = Object.prototype.toString.call(error) === '[object Error]';
  let valor = null;
  if (!esError) {
    try {
      valor = JSON.parse(JSON.stringify(error));
    } catch {
      valor = String(error);
    }
  }
  return {
    ...extra,
    nombre: esError ? (error.name ?? 'Error') : typeof error,
    mensaje: esError ? error.message : String(error),
    pila: esError && typeof error.stack === 'string' ? error.stack : null,
    valor,
  };
}

function lineaSegura(registro, tipoOriginal) {
  try {
    return `${JSON.stringify(registro)}\n`;
  } catch (error) {
    return `${JSON.stringify({
      version: VERSION_DEL_CUADERNO,
      secuencia: registro.secuencia,
      instante: registro.instante,
      tipo: 'averia-del-cuaderno',
      datos: { tipoOriginal, mensaje: `no se pudo convertir el acontecimiento a JSON: ${mensaje(error)}` },
    })}\n`;
  }
}

function ajustaAlTope(lineas, creaRegistro) {
  // La marca de activación ocupa un byte y cuenta dentro del prefijo completo.
  const espacio = TOPE_DEL_CUADERNO - 1;
  const cabecera = lineas[0] ?? '';
  let cola = lineas.slice(1);
  let descartadas = 0;
  let aviso = '';
  while (bytes(cabecera + aviso + cola.join('')) > espacio && cola.length) {
    cola.shift();
    descartadas += 1;
    aviso = lineaSegura(creaRegistro('truncado', { descartadas, motivo: 'tope-de-5-mib' }), 'truncado');
  }
  if (bytes(cabecera + aviso + cola.join('')) <= espacio) return cabecera + aviso + cola.join('');
  const truncada = lineaSegura(creaRegistro('truncado', {
    descartadas: descartadas + 1,
    motivo: 'linea-mayor-que-el-espacio-disponible',
  }), 'truncado');
  return bytes(cabecera + truncada) <= espacio ? cabecera + truncada : truncada;
}

/**
 * Crea el instrumento con todas sus entradas de plataforma inyectadas.
 * `ficheros` trabaja sobre el prefijo propio; `errores` es `global.ErrorUtils` de RN/Hermes.
 */
export function creaCuadernoDeABordo({ ficheros, reloj = () => new Date(), errores = global.ErrorUtils, hermes = global.HermesInternal, comparte }) {
  let encendido = false;
  let secuencia = 0;
  let contenido = '';
  let averia = null;
  let averiaDeCapacidad = null;
  let manejadorAnterior = null;
  let manejadorInstalado = null;
  let cola = Promise.resolve();
  const oyentes = new Set();

  const estado = () => ({ encendido, tieneContenido: contenido.length > 0, averia: averia ?? averiaDeCapacidad });
  const avisa = () => oyentes.forEach((oye) => oye(estado()));
  const creaRegistro = (tipo, datos) => ({
    version: VERSION_DEL_CUADERNO,
    secuencia: ++secuencia,
    instante: reloj().toISOString(),
    tipo,
    datos,
  });

  const falla = (error) => {
    averia = `El cuaderno no pudo escribir: ${mensaje(error)}`;
    avisa();
  };

  const registra = (tipo, datos = {}) => {
    if (!encendido) return Promise.resolve(false);
    cola = cola.then(async () => {
      if (!encendido) return false;
      const cerrado = TIPOS.has(tipo) ? tipo : 'averia-del-cuaderno';
      const propios = cerrado === tipo ? datos : { tipoOriginal: tipo, mensaje: 'tipo no declarado' };
      const nueva = lineaSegura(creaRegistro(cerrado, propios), tipo);
      contenido = ajustaAlTope((contenido + nueva).match(/[^\n]*\n/g) ?? [nueva], creaRegistro);
      await ficheros.escribeCuaderno(contenido);
      averia = null;
      avisa();
      return true;
    }).catch((error) => {
      falla(error);
      return false;
    });
    return cola;
  };

  const instalaErrores = () => {
    if (manejadorInstalado) return;
    if (!errores || typeof errores.getGlobalHandler !== 'function' || typeof errores.setGlobalHandler !== 'function') {
      averiaDeCapacidad = 'React Native no expone ErrorUtils; no se pueden capturar errores ni rechazos globales';
      avisa();
      return;
    }
    if (hermes?.hasPromise?.() !== true || typeof hermes?.enablePromiseRejectionTracker !== 'function') {
      averiaDeCapacidad = 'Hermes no expone su rastreador de promesas; los rechazos globales no se pueden observar en esta compilación';
      avisa();
    }
    manejadorAnterior = errores.getGlobalHandler();
    manejadorInstalado = (error, fatal) => {
      // RN 0.86/Hermes entrega los rechazos por ErrorUtils como un Error no fatal cuyo
      // mensaje empieza por «Uncaught (in promise» y conserva la razón en `cause`.
      const esRechazo = fatal !== true && /^Uncaught \(in promise/.test(error?.message ?? '');
      const original = esRechazo && 'cause' in (error ?? {}) ? error.cause : error;
      void registra(esRechazo ? 'rechazo-global' : 'error-global', errorComoDatos(original, { fatal: fatal === true }));
      if (typeof manejadorAnterior === 'function') manejadorAnterior(error, fatal);
    };
    errores.setGlobalHandler(manejadorInstalado);
  };

  const restauraErrores = () => {
    if (!manejadorInstalado || !errores) return;
    if (errores.getGlobalHandler() === manejadorInstalado) errores.setGlobalHandler(manejadorAnterior);
    manejadorAnterior = null;
    manejadorInstalado = null;
  };

  return {
    estado,
    observa: registra,
    suscribe(oye) {
      oyentes.add(oye);
      oye(estado());
      return () => oyentes.delete(oye);
    },
    async inicia() {
      const recuperado = await ficheros.leeEstado();
      encendido = recuperado.encendido;
      contenido = recuperado.contenido ?? '';
      secuencia = recuperado.secuencia ?? 0;
      if (encendido) {
        instalaErrores();
        await registra('sesion', { accion: 'reanudada' });
      }
      avisa();
      return estado();
    },
    async enciende() {
      if (encendido) return estado();
      encendido = true;
      contenido = '';
      secuencia = 0;
      await ficheros.marcaEncendido();
      instalaErrores();
      await registra('sesion', { accion: 'iniciada' });
      return estado();
    },
    async apaga() {
      encendido = false;
      restauraErrores();
      await cola;
      await ficheros.borraTodo();
      contenido = '';
      secuencia = 0;
      averia = null;
      averiaDeCapacidad = null;
      avisa();
      return estado();
    },
    async compartir() {
      if (!contenido) throw new Error('Todavía no hay nada que compartir');
      await comparte({ contenido });
      return estado();
    },
    provocaError() {
      const error = new Error('Error JS provocado por el cuaderno de a bordo');
      errores.reportError(error);
    },
    provocaRechazo() {
      void Promise.reject(new Error('Rechazo provocado por el cuaderno de a bordo'));
    },
  };
}
