// La sonda: si un Overpass **sirve datos de verdad**, y por qué no cuando no.
//
// Existe por un caso real que costó siete horas y está escrito en CLAUDE.md: un
// contenedor en `Up` respondiendo **200 con una página de error XML**, el proxy
// descartándola y cayendo a los mirrors públicos. Todo «funcionaba», solo que lentísimo.
// De ahí salen las dos reglas de este módulo:
//
// 1. **Se pregunta consultando**, no mirando el contenedor, el proceso ni el puerto.
//    `docker ps` dice `Up` en los dos casos conocidos y en ninguno hay datos.
// 2. **El canario exige un número mínimo de elementos.** El criterio anterior era
//    `grep '"elements"'`, que pasa con la lista vacía — y una lista vacía es exactamente
//    lo que devuelve un extracto que no cubre la zona o una base de datos sin importar.
//
// Y la clasificación es un conjunto cerrado porque las dos causas conocidas tienen el
// mismo síntoma y arreglos opuestos: importar horas, o cambiar un permiso. Un mensaje sin
// clasificar deja esa distinción en manos de quien esté mirando a las tres de la mañana.

/**
 * Los motivos de fallo, cerrados, con su arreglo. El arreglo es parte del motivo: es la
 * diferencia entre una noche de importación y un `chmod`.
 */
export const MOTIVOS = Object.freeze({
  'sin-base-de-datos': Object.freeze({
    que: 'el volumen de base de datos está vacío o la importación no se hizo nunca',
    arreglo: 'importar el extracto (scripts/overpass-setup.sh); el entrypoint la salta si existe /db/init_done. NO reiniciar: reiniciar no importa nada.',
  }),
  'base-de-datos-inalcanzable': Object.freeze({
    que: 'la base de datos está, pero el CGI no la alcanza: /db llega 700 overpass:overpass y nginx corre como uid 101',
    arreglo: 'chmod 755 /db dentro del contenedor. NO volver a importar: los datos ya están.',
  }),
  'importacion-en-curso': Object.freeze({
    que: 'está importando, o la importación quedó a medias y el canario devuelve menos elementos de los declarados',
    arreglo: 'esperar y volver a sondar; seguirlo con docker compose logs -f. Ninguna generación se encamina aquí mientras tanto.',
  }),
  'plazo-agotado': Object.freeze({
    que: 'no contestó dentro del plazo declarado de la sonda',
    arreglo: 'comprobar carga y cola del servicio; si es un eslabón de respaldo, se pasa al siguiente sin reintentar.',
  }),
  'respuesta-ilegible': Object.freeze({
    que: 'contestó algo que no son datos de Overpass: página de error desconocida, JSON truncado, o nada',
    arreglo: 'comprobar que quien responde en esa URL es Overpass y que está en pie; el cuerpo no se sirve ni se cachea.',
  }),
});

/** Los motivos, en el orden en que están declarados. Nada fuera de esta lista. */
export const MOTIVOS_DE_FALLO = Object.freeze(Object.keys(MOTIVOS));

/**
 * La consulta canario, fija y con respuesta conocida no vacía: cafeterías a 300 m de la
 * Puerta del Sol. Se elige por eso mismo —una zona del extracto que nunca está vacía— y
 * no por lo que representa: su única función es separar «sirve» de «contesta».
 *
 * Su texto es un artefacto: cambiarlo cambia lo que `SONDA_MINIMO` significa.
 */
export const CONSULTA_CANARIO =
  '[out:json][timeout:25];node(around:300,40.4168,-3.7038)["amenity"="cafe"];out center 20;';

/** Códigos con los que un eslabón dice «ahora no»: se pasa al siguiente sin reintentar. */
export const CODIGOS_DE_COLA = Object.freeze([429, 503, 504]);

/**
 * Clasifica lo que contestó un Overpass —el propio o un mirror, la sonda es una sola—.
 *
 * @param {object} r
 * @param {string} [r.texto]  el cuerpo tal cual. Una respuesta que empieza por `<` es la
 *   página de error, y se trata como fallo aunque el código HTTP sea 200.
 * @param {number} [r.http]
 * @param {Error} [r.error]  lo que lanzó el transporte, si no llegó a haber cuerpo.
 * @param {number} [r.minimo=0]  elementos exigidos. El canario exige `SONDA_MINIMO`; una
 *   consulta de celda exige **cero**, porque una celda de campo abierto sin un solo POI
 *   es un dato legítimo y no un Overpass roto.
 * @param {boolean} [r.importando=false]  si consta que hay una importación en marcha. Es
 *   un hecho de la máquina, no de la respuesta: por fuera, «no hay base de datos» e
 *   «importando» dan el mismo XML, y por eso la señal se inyecta en vez de adivinarse.
 * @returns {{sirve: boolean, elementos?: number, datos?: object, motivo?: string,
 *   arreglo?: string, mensaje?: string}}  `mensaje` es el error literal del XML, que es
 *   el dato que separa un diagnóstico útil de uno inútil.
 */
export function clasificaRespuesta({ texto, http, error, minimo = 0, importando = false } = {}) {
  const falla = (motivo, mensaje) => ({ sirve: false, motivo, arreglo: MOTIVOS[motivo].arreglo, mensaje });

  if (error) {
    const nombre = String(error && (error.name || '')) + ' ' + String(error && (error.message || ''));
    if (/abort|timeout|plazo/i.test(nombre)) return falla('plazo-agotado', 'la petición no volvió dentro del plazo');
    // Conexión rechazada, DNS, TLS: no llegó a haber respuesta que leer. Se clasifica
    // como ilegible y no como «sin base de datos», que diría a alguien que se pase la
    // noche importando cuando lo que pasa es que ahí no hay nadie escuchando.
    return falla('respuesta-ilegible', 'no hubo respuesta que leer');
  }

  if (typeof http === 'number' && http !== 200) {
    if (CODIGOS_DE_COLA.includes(http)) return falla('plazo-agotado', `el servicio respondió ${http}`);
    return falla('respuesta-ilegible', `el servicio respondió ${http}`);
  }

  const cuerpo = String(texto ?? '').trim();
  if (cuerpo.startsWith('<')) {
    const mensaje = mensajeDelXml(cuerpo);
    // Las dos causas de síntoma idéntico, separadas por lo único que las separa.
    if (/No such file or directory/i.test(cuerpo)) {
      return falla(importando ? 'importacion-en-curso' : 'sin-base-de-datos', mensaje);
    }
    if (/Permission denied/i.test(cuerpo)) return falla('base-de-datos-inalcanzable', mensaje);
    return falla(importando ? 'importacion-en-curso' : 'respuesta-ilegible', mensaje);
  }

  let datos;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    // JSON truncado: llegó a medias. No se sirve y no se cachea.
    return falla('respuesta-ilegible', 'el cuerpo no es JSON completo');
  }
  if (!datos || !Array.isArray(datos.elements)) {
    return falla('respuesta-ilegible', 'la respuesta no trae una lista de elementos');
  }

  const elementos = datos.elements.length;
  if (elementos < minimo) {
    // Cero con un mínimo exigido es una base de datos sin datos; algunos, pero menos de
    // los declarados, es una importación a medias. Las dos se distinguen aquí porque los
    // arreglos son distintos: importar, o esperar.
    return falla(elementos === 0 ? 'sin-base-de-datos' : 'importacion-en-curso',
      `el canario devolvió ${elementos} elementos y se exigen ${minimo}`);
  }
  return { sirve: true, elementos, datos };
}

/** El mensaje de error del XML, entero y sin adornos. Es lo que nombra el arreglo. */
function mensajeDelXml(cuerpo) {
  const p = cuerpo.match(/<p>([\s\S]*?)<\/p>/i);
  const bruto = p ? p[1] : cuerpo.slice(0, 400);
  return bruto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}

/**
 * La sonda de un destino, con su estado de prontitud.
 *
 * Prontitud, y por qué no es un booleano de la última respuesta: se pasa a listo tras
 * `SONDA_PARA_LISTO` sondas seguidas en verde —lo que evita el vaivén del final de una
 * importación— y se cae a no listo **a la primera en rojo**, que es lo que hace que el
 * respaldo absorba una caída dentro del periodo de sonda en vez de dentro de una tarde.
 *
 * @param {object} deps
 * @param {Function} deps.fetch  inyectado: en `node --test` es un doble y no hay red.
 * @param {string} deps.url
 * @param {object} deps.config  el de `cargaConfigDeOrigen`.
 * @param {() => boolean} [deps.importando]  la señal de importación en curso.
 */
export function creaSonda({ fetch, url, config, importando = () => false }) {
  let verdesSeguidas = 0;
  let listo = false;
  let ultimo = { sirve: false, motivo: 'importacion-en-curso', arreglo: MOTIVOS['importacion-en-curso'].arreglo };
  let temporizador = null;

  async function consulta(ql, minimo) {
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), config.SONDA_PLAZO);
    if (corte.unref) corte.unref();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ql),
        signal: control.signal,
      });
      if (!res) return clasificaRespuesta({ error: new Error('sin respuesta'), minimo, importando: importando() });
      const texto = await res.text();
      return clasificaRespuesta({ texto, http: res.status ?? (res.ok ? 200 : 500), minimo, importando: importando() });
    } catch (e) {
      return clasificaRespuesta({ error: e, minimo, importando: importando() });
    } finally {
      clearTimeout(corte);
    }
  }

  return {
    url,
    MOTIVOS,

    /** Una pasada del canario. No toca el estado: es la sonda cruda. */
    async pasa() {
      return consulta(CONSULTA_CANARIO, config.SONDA_MINIMO);
    },

    /** Una pasada que **sí** mueve la prontitud. Es la que corre en el periodo declarado. */
    async revisa() {
      const r = await this.pasa();
      ultimo = r;
      if (r.sirve) {
        verdesSeguidas += 1;
        if (verdesSeguidas >= config.SONDA_PARA_LISTO) listo = true;
      } else {
        verdesSeguidas = 0;
        listo = false;
      }
      return r;
    },

    /** Si el destino recibe tráfico. Falso mientras importa, y falso en cuanto deja de servir. */
    estaListo() { return listo; },

    /** El último veredicto, con su motivo y su arreglo. Sin coordenadas y sin quién llamó. */
    estado() {
      return {
        listo,
        verdesSeguidas,
        periodo: config.SONDA_PERIODO,
        plazo: config.SONDA_PLAZO,
        paraListo: config.SONDA_PARA_LISTO,
        minimo: config.SONDA_MINIMO,
        ...ultimo,
      };
    },

    /** Arranca el periodo declarado. El temporizador va `unref`: no sostiene el proceso. */
    arranca() {
      if (temporizador) return;
      temporizador = setInterval(() => { this.revisa().catch(() => {}); }, config.SONDA_PERIODO);
      if (temporizador.unref) temporizador.unref();
      return temporizador;
    },

    para() { if (temporizador) { clearInterval(temporizador); temporizador = null; } },
  };
}

// Como herramienta de línea de órdenes: `node server/aguas-arriba/sonda-overpass.mjs [url]`.
// Sale con 0 si sirve y con 1 si no, y en ese caso dice el motivo y su arreglo. Es lo que
// usa scripts/overpass-setup.sh, para que el script y el proxy compartan criterio en vez
// de tener cada uno el suyo.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2] || process.env.OVERPASS_PROPIO || 'http://localhost:12345/api/interpreter';
  const config = {
    SONDA_PLAZO: Number(process.env.SONDA_PLAZO || 30000),
    SONDA_MINIMO: Number(process.env.SONDA_MINIMO || 5),
    SONDA_PERIODO: Number(process.env.SONDA_PERIODO || 60000),
    SONDA_PARA_LISTO: Number(process.env.SONDA_PARA_LISTO || 2),
  };
  const r = await creaSonda({ fetch, url, config }).pasa();
  if (r.sirve) {
    process.stdout.write(`sirve: ${r.elementos} elementos del canario (mínimo ${config.SONDA_MINIMO}) en ${url}\n`);
    process.exit(0);
  }
  process.stdout.write(`no sirve (${r.motivo}): ${r.mensaje}\n  → ${r.arreglo}\n`);
  process.exit(1);
}
