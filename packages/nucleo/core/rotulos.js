// La colocación de rótulos: quién va dónde antes de que se pinte ninguno, y qué se
// sacrifica cuando no caben todos. Devuelve cajas ya colocadas y una lista de
// retirados con su motivo; quien pinta no decide nada.
//
// Es geometría pura y vive en `core/` con `cajas.js` y `geo.js`: no dibuja, no conoce
// un color, no importa nada de plataforma y **no tiene ninguna fuente de azar**. Un
// barrido codicioso sobre un orden total declarado no la necesita, y sin azar el
// determinismo se afirma sin depender de que nadie se olvide de un sufijo.
//
// Lo único que no puede vivir aquí es medir texto, que depende de la tipografía y de
// la plataforma: entra inyectado. Sin medidor **falla**, en lugar de estimar el ancho
// por el número de letras — una estimación da mapas sin solapes en la prueba y con
// solapes en el móvil, que es la peor forma de verde.

import {
  cajaDentroDe,
  creaCaja,
  creaIndiceDeCajas,
  diagonalDeCaja,
  envolventeDeCaja,
  puntoDentroDe,
  seSolapan,
} from './cajas.js';

// --- los números declarados ------------------------------------------------------
// Salen de las medidas del prototipo (`LABEL_SIZE`, la separación de `drawLabel`, los
// márgenes de `placa`) y se ajustan por iteración con el mapa delante. Son el
// instrumento, no la verdad: sin números declarados no hay nada que afirmar.

/** Dos cajas que se tocan se leen como que se pisan: se exige esta holgura entre todas. */
export const HOLGURA = 2;

/** Lo que separa la caja del borde del glifo, sobre el radio del propio glifo. */
export const SEPARACION_BASE = 3;

/** Las ocho posiciones de un rótulo puntual, **en el orden en que se prueban**. */
export const POSICIONES = Object.freeze([
  'debajo', 'encima', 'derecha', 'izquierda',
  'abajo-derecha', 'abajo-izquierda', 'arriba-derecha', 'arriba-izquierda',
]);

/** Pasos de deslizamiento de un rótulo de calzada desde su punto medio. */
export const PASOS_DE_DESLIZAMIENTO = 16;

/** Largo mínimo del trazado visible para que una calzada se rotule, en px. */
export const LARGO_MINIMO_DE_TRAZADO = 150;

/** Tope del tirador, en diagonales de la caja: más allá, la placa deja de leerse como del pueblo. */
export const TOPE_DE_TIRADOR = 2;

/** Cada cuánto se prueba una distancia nueva al alejar un protegido, en px. */
export const PASO_DE_ALEJAMIENTO = 8;

/** El filete del tirador se dibuja a partir de esta separación, en múltiplos de la base. */
export const TIRADOR_VISIBLE = 1.5;

/** Cuantización del zoom: pasos de un cuarto de duplicación. */
export const PASO_DE_ZOOM = 0.25;

/** Cuantización del centro: rejilla de 8 px lógicos. */
export const REJILLA_DE_CENTRO = 8;

/** Por encima de este número de candidatos se descarta por prioridad antes de intentar nada. */
export const TOPE_DE_CANDIDATOS = 300;

/**
 * Comprobaciones de solape que puede gastar un rótulo. Es a la vez el presupuesto que
 * se afirma y **el límite de la búsqueda**: agotado, se retira. Un tope en tiempo
 * dentro del runner sería intermitente; este contador es idéntico en cualquier máquina
 * y afirma lo que importa —que hay índice espacial y que el barrido no es cuadrático—.
 */
export const PRESUPUESTO_DE_COMPROBACIONES = 64;

/** Lo más que puede crecer el coste total al doblar el número de candidatos. */
export const CRECIMIENTO_MAXIMO = 2.5;

/** Lado de la celda del índice espacial, en px. */
export const PASO_DE_REJILLA = 64;

// --- el orden de prioridad -------------------------------------------------------

/** Los cuatro roles que se colocan. `ruta` es como llama el render a la calzada. */
export const ROLES = Object.freeze(['nucleo', 'paraje', 'servicio', 'calzada']);

/** El nombre que el render usa para cada rol, aceptado como sinónimo en la entrada. */
const SINONIMOS = Object.freeze({ ruta: 'calzada', calzada: 'calzada', nucleo: 'nucleo', paraje: 'paraje', servicio: 'servicio' });

/**
 * Rol, de más a menos importante. El orden inverso es el del sacrificio: primero se
 * retiran las calzadas, luego los servicios, luego los parajes conocidos.
 */
export const PRIORIDAD_DE_ROL = Object.freeze({ nucleo: 0, paraje: 1, servicio: 2, calzada: 3 });

/** Rango dentro del rol. Solo los núcleos tienen; el resto empata y decide el identificador. */
export const PRIORIDAD_DE_RANGO = Object.freeze({ ciudad: 0, pueblo: 1, aldea: 2, granja: 3 });

/** Por qué se retira un rótulo. Se declara siempre: retirar en silencio no es una decisión. */
export const MOTIVOS = Object.freeze({
  fueraDelEncuadre: 'fuera-del-encuadre',
  topeDeCandidatos: 'tope-de-candidatos',
  trazadoCorto: 'trazado-corto',
  noCabeEnElMarco: 'no-cabe-en-el-marco',
  sinHueco: 'sin-hueco',
});

// --- el encuadre ------------------------------------------------------------------

/**
 * El encuadre cuantizado: el zoom en pasos de un cuarto de duplicación y el centro
 * sobre una rejilla de píxeles lógicos.
 *
 * Es lo que hace que arrastrar el mapa no recoloque en cada fotograma **sin
 * histéresis**: recordar la colocación anterior para que nada parpadee haría que el
 * resultado dependiera del fotograma previo, y la colocación dejaría de ser una
 * función pura del encuadre, que es justo lo que la hace verificable.
 */
export function cuantizaEncuadre(encuadre) {
  if (!encuadre || typeof encuadre !== 'object') throw new Error('cuantizaEncuadre: hace falta el encuadre { centro, escala, lienzo }');
  const { centro, escala } = encuadre;
  if (!Number.isFinite(escala) || escala <= 0) throw new Error(`cuantizaEncuadre: la escala tiene que ser positiva; llegó ${escala}`);
  if (!centro || !Number.isFinite(centro.x) || !Number.isFinite(centro.y)) throw new Error('cuantizaEncuadre: el centro tiene que traer x e y finitos');
  const escalaCuantizada = 2 ** (Math.round(Math.log2(escala) / PASO_DE_ZOOM) * PASO_DE_ZOOM);
  const paso = REJILLA_DE_CENTRO / escalaCuantizada;
  return {
    ...encuadre,
    escala: escalaCuantizada,
    centro: { x: Math.round(centro.x / paso) * paso, y: Math.round(centro.y / paso) * paso },
  };
}

// --- la métrica que se lee del estilo ---------------------------------------------

function exigeMetrica(valor, nombre, rol) {
  if (!Number.isFinite(valor)) {
    throw new Error(`colocarRotulos: al estilo le falta la métrica "${nombre}", que necesita el rol "${rol}"`);
  }
  return valor;
}

/** ¿Va este rol sobre placa en este estilo? Lo decide el estilo, nunca la colocación. */
export function vaSobrePlaca(estilo, rol) {
  const lista = estilo?.label?.placa;
  if (!Array.isArray(lista) || !estilo.placa) return false;
  return lista.includes(rol) || (rol === 'calzada' && lista.includes('ruta'));
}

/**
 * La caja de un rótulo: el medidor mide el texto y **la caja la calcula aquí**,
 * sumando lo que el rol añade —los márgenes de la placa si va sobre placa, el ancho
 * del halo si no, y el tracking del estilo—. Ese cálculo es del núcleo porque es
 * donde vive la regla.
 */
export function tamanoDeCaja({ medida, rol, estilo, letras, margen = { x: 0, y: 0 } }) {
  const label = estilo?.label;
  if (!label || typeof label !== 'object') throw new Error(`colocarRotulos: al estilo le falta la métrica "label", que necesita el rol "${rol}"`);
  const tracking = exigeMetrica(label.tracking, 'label.tracking', rol);
  const anchoTexto = medida.ancho + (letras > 1 ? tracking * (letras - 1) : 0);

  if (vaSobrePlaca(estilo, rol)) {
    const P = estilo.placa;
    const padX = exigeMetrica(P?.padX, 'placa.padX', rol);
    const padY = exigeMetrica(P?.padY, 'placa.padY', rol);
    const lw = Number.isFinite(P?.lw) ? P.lw : 0;
    return {
      ancho: anchoTexto + padX * 2 + lw + margen.x * 2,
      alto: medida.alto + padY * 2 + lw + margen.y * 2,
      placa: true,
    };
  }
  const haloW = exigeMetrica(label.haloW, 'label.haloW', rol);
  return { ancho: anchoTexto + haloW + margen.x * 2, alto: medida.alto + haloW + margen.y * 2, placa: false };
}

// --- validación de la entrada -----------------------------------------------------

function normalizaCandidato(bruto, vistos) {
  if (!bruto || typeof bruto !== 'object') throw new Error('colocarRotulos: un candidato tiene que ser un objeto');
  const id = bruto.id;
  if (typeof id !== 'string' || id === '') throw new Error('colocarRotulos: un candidato llega sin el campo "id"');
  if (vistos.has(id)) throw new Error(`colocarRotulos: el identificador "${id}" llega dos veces; no se elige uno en silencio`);
  vistos.add(id);

  if (typeof bruto.texto !== 'string' || bruto.texto === '') {
    throw new Error(`colocarRotulos: el candidato "${id}" no trae el campo "texto"`);
  }
  const rol = SINONIMOS[bruto.rol];
  if (!rol) {
    throw new Error(`colocarRotulos: el candidato "${id}" llega con el rol "${bruto.rol}", que no es núcleo, paraje, servicio ni calzada`);
  }
  const ancla = bruto.ancla;
  if (!ancla || !Number.isFinite(ancla.x) || !Number.isFinite(ancla.y)) {
    throw new Error(`colocarRotulos: el candidato "${id}" no trae el campo "ancla"`);
  }
  const radio = Number.isFinite(bruto.radio) ? Math.max(0, bruto.radio) : 0;
  // El bulto del elemento, del que cuelgan las ocho posiciones. Se declara como caja
  // porque un glifo no es redondo —una torre es alta y estrecha— y porque tiene que
  // ser **la misma** que entra al índice como obstáculo: si la separación se midiera
  // sobre un círculo y el estorbo fuera una caja, el rótulo chocaría con su propio
  // glifo en cuanto el glifo asomara del círculo.
  const glifo = bruto.glifo
    ? envolventeDeCaja(bruto.glifo)
    : { x0: ancla.x - radio, y0: ancla.y - radio, x1: ancla.x + radio, y1: ancla.y + radio };
  const trazado = Array.isArray(bruto.trazado) ? bruto.trazado : null;
  if (trazado) {
    for (const p of trazado) {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`colocarRotulos: el trazado del candidato "${id}" trae un punto que no es un punto`);
    }
  }
  return {
    id,
    rol,
    rolPedido: bruto.rol,
    texto: bruto.texto,
    ancla: { x: ancla.x, y: ancla.y },
    radio,
    glifo,
    rango: typeof bruto.rango === 'string' ? bruto.rango : null,
    encargado: bruto.encargado === true,
    trazado,
    medida: bruto.medida ?? null,
    margen: bruto.margen ?? { x: 0, y: 0 },
    giro: Number.isFinite(bruto.giro) ? bruto.giro : 0,
    datos: bruto.datos ?? null,
  };
}

function exigeMedida(medida, id) {
  if (!medida || !Number.isFinite(medida.ancho) || !Number.isFinite(medida.alto) || medida.ancho <= 0 || medida.alto <= 0) {
    const ancho = medida ? medida.ancho : undefined;
    const alto = medida ? medida.alto : undefined;
    throw new Error(`colocarRotulos: la medida del rótulo "${id}" no es un número positivo (ancho=${ancho}, alto=${alto})`);
  }
  return { ancho: medida.ancho, alto: medida.alto };
}

/** El orden de proceso: una tupla comparable, nunca el orden en que llegó la lista. */
export function comparaCandidatos(a, b) {
  const encargado = (a.encargado ? 0 : 1) - (b.encargado ? 0 : 1);
  if (encargado !== 0) return encargado;
  const rol = PRIORIDAD_DE_ROL[a.rol] - PRIORIDAD_DE_ROL[b.rol];
  if (rol !== 0) return rol;
  const rango = (PRIORIDAD_DE_RANGO[a.rango] ?? 9) - (PRIORIDAD_DE_RANGO[b.rango] ?? 9);
  if (rango !== 0) return rango;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// --- las posiciones que se prueban -------------------------------------------------

/** La dirección unitaria de cada una de las ocho posiciones. */
const DIRECCION = Object.freeze({
  'debajo': { x: 0, y: 1 },
  'encima': { x: 0, y: -1 },
  'derecha': { x: 1, y: 0 },
  'izquierda': { x: -1, y: 0 },
  'abajo-derecha': { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  'abajo-izquierda': { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  'arriba-derecha': { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  'arriba-izquierda': { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
});

/**
 * El centro de la caja en una de las ocho posiciones, medida desde el borde del glifo
 * y alejada `extra` más si hay que sacarla con tirador. Las cuatro diagonales son el
 * mismo cálculo con las dos coordenadas desplazadas a la vez: salen por la esquina.
 */
function centroDe(glifo, tamano, posicion, extra = 0) {
  const d = DIRECCION[posicion];
  const sep = SEPARACION_BASE + extra;
  const medioX = (glifo.x0 + glifo.x1) / 2;
  const medioY = (glifo.y0 + glifo.y1) / 2;
  return {
    x: d.x > 0 ? glifo.x1 + sep + tamano.ancho / 2 : d.x < 0 ? glifo.x0 - sep - tamano.ancho / 2 : medioX,
    y: d.y > 0 ? glifo.y1 + sep + tamano.alto / 2 : d.y < 0 ? glifo.y0 - sep - tamano.alto / 2 : medioY,
  };
}

/** El largo de una polilínea y sus tramos, en px. */
function largoDeTrazado(pts) {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return total;
}

/** El punto y el ángulo del trazado a una distancia dada del principio. Texto siempre derecho. */
function puntoDeTrazado(pts, distancia) {
  let acumulado = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const tramo = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (tramo === 0) continue;
    if (acumulado + tramo >= distancia) {
      const t = (distancia - acumulado) / tramo;
      let angulo = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) angulo += Math.PI;
      return {
        punto: { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t },
        angulo,
      };
    }
    acumulado += tramo;
  }
  const ultimo = pts[pts.length - 1];
  return { punto: { x: ultimo.x, y: ultimo.y }, angulo: 0 };
}

/**
 * Las colocaciones que se prueban para un candidato, en el orden estricto en que se
 * prueban: reubicar en las ocho posiciones —o deslizar por el trazado si es una
 * calzada—, y solo después, y solo los protegidos, alejar con tirador hasta el tope.
 *
 * No hay una cuarta palanca: no se encoge —el tamaño es la jerarquía y un pueblo
 * encogido se lee como una aldea—, no se recorta el texto y no se apila en dos
 * líneas. El sacrificio es binario, y por eso es verificable.
 */
function* colocacionesDe(candidato, tamano, protegido) {
  if (candidato.trazado) {
    const largo = largoDeTrazado(candidato.trazado);
    const medio = largo / 2;
    for (let k = 0; k <= PASOS_DE_DESLIZAMIENTO; k++) {
      for (const signo of k === 0 ? [1] : [1, -1]) {
        const d = medio + signo * (k * medio) / PASOS_DE_DESLIZAMIENTO;
        if (d < tamano.ancho / 2 || d > largo - tamano.ancho / 2) continue;
        const { punto, angulo } = puntoDeTrazado(candidato.trazado, d);
        const normal = { x: -Math.sin(angulo), y: Math.cos(angulo) };
        const desvio = SEPARACION_BASE + tamano.alto / 2;
        yield {
          posicion: `trazado:${signo * k}`,
          giro: angulo,
          ancla: punto,
          centro: { x: punto.x - normal.x * desvio, y: punto.y - normal.y * desvio },
          alejado: 0,
        };
      }
    }
    return;
  }

  for (const posicion of POSICIONES) {
    yield { posicion, giro: candidato.giro, ancla: candidato.ancla, centro: centroDe(candidato.glifo, tamano, posicion), alejado: 0 };
  }

  if (!protegido) return;

  // Alejar con tirador, y **con tope**: una placa a diez veces su diagonal del pueblo,
  // unida por un filete larguísimo, es peor mapa que uno con un nombre menos. Y sin
  // tope, la garantía de coste se va con él.
  const tope = TOPE_DE_TIRADOR * diagonalDeCaja(creaCaja(0, 0, tamano.ancho, tamano.alto, 0));
  for (let extra = PASO_DE_ALEJAMIENTO; extra <= tope; extra += PASO_DE_ALEJAMIENTO) {
    for (const posicion of POSICIONES) {
      yield { posicion, giro: candidato.giro, ancla: candidato.ancla, centro: centroDe(candidato.glifo, tamano, posicion, extra), alejado: extra };
    }
  }
}

/** El filete que une una caja alejada con su glifo, con sus dos extremos ya calculados. */
function tiradorDe(candidato, caja) {
  const glifo = candidato.glifo;
  const origen = { x: (glifo.x0 + glifo.x1) / 2, y: (glifo.y0 + glifo.y1) / 2 };
  const dx = caja.cx - origen.x;
  const dy = caja.cy - origen.y;
  const largo = Math.hypot(dx, dy);
  if (largo === 0) return null;
  const u = { x: dx / largo, y: dy / largo };
  const hasta = (medioX, medioY) => Math.min(
    Math.abs(u.x) > 1e-9 ? medioX / Math.abs(u.x) : Infinity,
    Math.abs(u.y) > 1e-9 ? medioY / Math.abs(u.y) : Infinity,
  );
  const envolvente = envolventeDeCaja(caja);
  const hastaLaCaja = hasta((envolvente.x1 - envolvente.x0) / 2, (envolvente.y1 - envolvente.y0) / 2);
  const hastaElGlifo = hasta((glifo.x1 - glifo.x0) / 2, (glifo.y1 - glifo.y0) / 2);
  const hueco = largo - hastaLaCaja - hastaElGlifo;
  // Por debajo de esto no se dibuja: la cercanía ya explica de quién es el nombre, y
  // un filete de dos píxeles solo ensucia.
  if (hueco <= TIRADOR_VISIBLE * SEPARACION_BASE) return null;
  return Object.freeze({
    x0: origen.x + u.x * hastaElGlifo,
    y0: origen.y + u.y * hastaElGlifo,
    x1: caja.cx - u.x * hastaLaCaja,
    y1: caja.cy - u.y * hastaLaCaja,
  });
}

// --- la colocación -----------------------------------------------------------------

/**
 * Coloca todos los rótulos de una lámina.
 *
 * @param {object} opciones
 *   `candidatos` la lista de rótulos que hay que poner —qué rótulos existen lo deciden
 *   los niveles de conocimiento del mapa, no esto—; `encuadre` `{ lienzo, marco }` ya
 *   cuantizado; `estilo` del que se lee **solo** lo que cambia una caja; `medidor`
 *   `(texto, rol, estilo) → { ancho, alto }`; `glifos` los bultos que dibuja cada
 *   elemento; `reservadas` la cartela, la brújula, la escala y la marca de la jugadora,
 *   ya calculadas por quien las dibuja.
 * @returns {{ colocados: object[], retirados: object[], coste: object }}
 */
export function colocarRotulos({ candidatos, encuadre, estilo, medidor, glifos = [], reservadas = [] }) {
  if (!Array.isArray(candidatos)) throw new Error('colocarRotulos: los candidatos tienen que llegar en una lista');
  if (typeof medidor !== 'function') {
    throw new Error('colocarRotulos: falta el medidor de texto inyectado, medir(texto, rol, estilo) → { ancho, alto }; sin él no se estima el ancho por el número de letras');
  }
  if (!estilo || typeof estilo !== 'object') throw new Error('colocarRotulos: hace falta el estilo del que salen las métricas de la caja');
  if (!encuadre || typeof encuadre !== 'object' || !encuadre.marco) {
    throw new Error('colocarRotulos: hace falta el encuadre con su marco { modo, ... }');
  }
  const marco = encuadre.marco;

  // 1 · validación y orden. El orden de proceso sale de la prioridad y del
  // identificador, nunca del orden de inserción: es la trampa documentada del repo.
  const vistos = new Set();
  const normalizados = candidatos.map((bruto) => normalizaCandidato(bruto, vistos));
  const ordenados = normalizados.slice().sort(comparaCandidatos);

  const colocados = [];
  const retirados = [];
  const porRotulo = [];
  let comprobaciones = 0;

  // 2 · lo que ni entra al reparto. Fuera del encuadre no cuesta ni una comprobación;
  // por encima del tope se descarta por prioridad, que es lo que conserva la garantía
  // de que lo importante sigue puesto.
  const dentro = [];
  for (const candidato of ordenados) {
    if (!puntoDentroDe(candidato.ancla, marco) && !candidato.trazado) {
      retirados.push({ id: candidato.id, rol: candidato.rol, motivo: MOTIVOS.fueraDelEncuadre });
    } else dentro.push(candidato);
  }
  const reparto = dentro.slice(0, TOPE_DE_CANDIDATOS);
  for (const sobrante of dentro.slice(TOPE_DE_CANDIDATOS)) {
    retirados.push({ id: sobrante.id, rol: sobrante.rol, motivo: MOTIVOS.topeDeCandidatos });
  }

  // 3 · el índice, con los glifos y las zonas reservadas dentro desde el principio:
  // son obstáculos que no se mueven, y un rótulo tampoco puede pisar el glifo de su
  // propio elemento.
  const indice = creaIndiceDeCajas(PASO_DE_REJILLA);
  for (const glifo of glifos) indice.inserta(glifo.caja, { clase: 'glifo', id: glifo.id ?? null });
  for (const zona of reservadas) indice.inserta(zona.caja, { clase: 'reservada', nombre: zona.nombre ?? null });

  // 4 · el barrido codicioso. No es una optimización global a propósito: el criterio
  // es binario —ninguno pisa a otro— y una optimización global puede callar un núcleo
  // para colocar tres parajes, que es lo que la jerarquía de Reino no quiere.
  for (const candidato of reparto) {
    const medida = exigeMedida(candidato.medida ?? medidor(candidato.texto, candidato.rol, estilo), candidato.id);
    const tamano = tamanoDeCaja({
      medida, rol: candidato.rol, estilo, letras: [...candidato.texto].length, margen: candidato.margen,
    });
    const protegido = candidato.rol === 'nucleo' || candidato.encargado;

    if (candidato.trazado && largoDeTrazado(candidato.trazado) < LARGO_MINIMO_DE_TRAZADO) {
      retirados.push({ id: candidato.id, rol: candidato.rol, motivo: MOTIVOS.trazadoCorto });
      continue;
    }

    let gasto = 0;
    let puesta = null;
    let cupo = false;
    for (const intento of colocacionesDe(candidato, tamano, protegido)) {
      const caja = creaCaja(intento.centro.x, intento.centro.y, tamano.ancho, tamano.alto, intento.giro);
      // Que quepa entera dentro del marco es una condición de forma, no un solape: un
      // rótulo recortado por el marco no se pinta, se retira.
      if (!cajaDentroDe(caja, marco)) continue;
      cupo = true;
      let libre = true;
      for (const vecino of indice.vecinos(caja, HOLGURA)) {
        if (gasto >= PRESUPUESTO_DE_COMPROBACIONES) { libre = false; break; }
        gasto += 1;
        if (seSolapan(caja, vecino.caja, HOLGURA)) { libre = false; break; }
      }
      if (libre) { puesta = { ...intento, caja }; break; }
      if (gasto >= PRESUPUESTO_DE_COMPROBACIONES) break;
    }
    comprobaciones += gasto;
    porRotulo.push({ id: candidato.id, comprobaciones: gasto });

    if (!puesta) {
      // Nunca se calla, mientras quede sitio, el núcleo de mayor rango del conflicto ni
      // el sitio encargado: los dos han probado antes las ocho posiciones y el tirador.
      // Cuando aun así no cabe, se pierde el nombre en la lámina y no el pueblo: su
      // glifo se dibuja igual, porque lo dibuja otra capa.
      retirados.push({ id: candidato.id, rol: candidato.rol, motivo: cupo ? MOTIVOS.sinHueco : MOTIVOS.noCabeEnElMarco });
      continue;
    }

    indice.inserta(puesta.caja, { clase: 'rotulo', id: candidato.id });
    colocados.push(Object.freeze({
      id: candidato.id,
      rol: candidato.rol,
      rolPedido: candidato.rolPedido,
      texto: candidato.texto,
      rango: candidato.rango,
      encargado: candidato.encargado,
      protegido,
      posicion: puesta.posicion,
      alejado: puesta.alejado,
      x: puesta.caja.cx,
      y: puesta.caja.cy,
      giro: puesta.caja.rot,
      ancla: Object.freeze({ ...puesta.ancla }),
      caja: puesta.caja,
      placa: tamano.placa,
      medida: Object.freeze({ ...medida }),
      tirador: puesta.alejado > 0 ? tiradorDe(candidato, puesta.caja) : null,
      datos: candidato.datos,
    }));
  }

  return Object.freeze({
    colocados: Object.freeze(colocados),
    retirados: Object.freeze(retirados.map((r) => Object.freeze(r))),
    coste: Object.freeze({
      comprobaciones,
      candidatos: normalizados.length,
      colocados: colocados.length,
      retirados: retirados.length,
      maximoPorRotulo: porRotulo.reduce((mayor, r) => Math.max(mayor, r.comprobaciones), 0),
      presupuesto: PRESUPUESTO_DE_COMPROBACIONES,
      porRotulo: Object.freeze(porRotulo.map((r) => Object.freeze(r))),
    }),
  });
}
