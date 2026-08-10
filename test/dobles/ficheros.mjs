// El doble del sistema de ficheros del dispositivo: las seis operaciones de
// `app/datos/ficheros.js` sobre un mapa en memoria, con el registro de lo que se le
// pidió y en qué orden.
//
// No sustituye al sistema de ficheros de verdad —la atomicidad se comprueba contra el
// disco, con `creaFicherosDeNode` sobre un directorio temporal—, sino que sirve para
// las dos cosas que el disco no deja afirmar sin trampas: **en qué orden ocurre una
// escritura** (temporal, mover encima, y nunca abrir el bueno) y **qué queda cuando se
// muere justo en medio**. Doblar aquí es doblar la frontera, que es la regla.
//
// El orden en que devuelve las entradas de un directorio es invertible a propósito: el
// almacén promete un orden estable **suyo**, y eso solo se puede afirmar si el sistema
// de ficheros de debajo puede contestar en otro.

/** Un error del sistema de ficheros con el aspecto del de verdad. */
function falla(mensaje) {
  return new Error(mensaje);
}

/**
 * Un sistema de ficheros en memoria.
 *
 * @param {object} [opciones]
 *   `ordenInvertido` devuelve las entradas de cada directorio al revés;
 *   `falloAlEscribir` hace fallar `escribe` en las rutas que contengan ese texto;
 *   `falloAlMover` hace fallar `mueve`, que es morir con el temporal ya escrito.
 */
export function creaFicherosDeMemoria({ ordenInvertido = false, falloAlEscribir = null, falloAlMover = null } = {}) {
  const contenido = new Map();
  const directorios = new Set();
  const registro = [];

  const hijos = (ruta) => {
    const prefijo = `${ruta}/`;
    const nombres = new Map();
    for (const clave of [...contenido.keys(), ...directorios]) {
      if (!clave.startsWith(prefijo)) continue;
      const resto = clave.slice(prefijo.length);
      const corte = resto.indexOf('/');
      const nombre = corte < 0 ? resto : resto.slice(0, corte);
      if (!nombre) continue;
      const esDirectorio = corte >= 0 || (directorios.has(clave) && !contenido.has(clave));
      nombres.set(nombre, (nombres.get(nombre) ?? false) || esDirectorio);
    }
    return [...nombres.entries()].map(([nombre, esDirectorio]) => ({ nombre, esDirectorio }));
  };

  return {
    /** Lo que se le ha pedido, en orden. Es lo que permite afirmar cómo se escribe. */
    registro,
    operaciones: (op) => registro.filter((o) => o.op === op).map((o) => o.ruta),
    contenido,

    async lee(ruta) {
      registro.push({ op: 'lee', ruta });
      return contenido.has(ruta) ? contenido.get(ruta) : null;
    },

    async escribe(ruta, texto) {
      registro.push({ op: 'escribe', ruta });
      if (falloAlEscribir !== null && ruta.includes(falloAlEscribir)) throw falla(`no queda espacio en el dispositivo (${ruta})`);
      contenido.set(ruta, texto);
    },

    async mueve(origen, destino) {
      registro.push({ op: 'mueve', ruta: `${origen} → ${destino}` });
      if (falloAlMover !== null && destino.includes(falloAlMover)) throw falla(`el sistema se ha apagado al sustituir ${destino}`);
      if (!contenido.has(origen)) throw falla(`no existe ${origen}`);
      contenido.set(destino, contenido.get(origen));
      contenido.delete(origen);
    },

    async borra(ruta) {
      registro.push({ op: 'borra', ruta });
      contenido.delete(ruta);
      directorios.delete(ruta);
    },

    async entradas(ruta) {
      registro.push({ op: 'entradas', ruta });
      if (!directorios.has(ruta) && hijos(ruta).length === 0) return null;
      const lista = hijos(ruta);
      return ordenInvertido ? lista.reverse() : lista;
    },

    async creaDirectorio(ruta) {
      registro.push({ op: 'creaDirectorio', ruta });
      const partes = ruta.split('/');
      for (let i = 1; i <= partes.length; i += 1) directorios.add(partes.slice(0, i).join('/'));
    },
  };
}
