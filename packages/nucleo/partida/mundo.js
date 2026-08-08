// Congelar el mundo de una celda en su documento y volver a levantarlo idéntico,
// sin OpenStreetMap y sin red. A partir de aquí el mapa de quien juega deja de
// depender de un servicio ajeno: lo que hay en el documento es todo lo que hace
// falta, y lo que no está en el documento no se recalcula al cargar.

import { congelaHondo } from '../core/congelar.js';
import { exigeSemilla, semillaDeCelda } from '../core/semilla.js';
import { castAll } from '../quests/casting.js';
import { TRAMO_DE_REFERENCIA_M } from '../world/cupos.js';
import { tramosSupuestos } from '../world/routes.js';
import {
  CLASES,
  VERSION_FORMATO,
  VERSION_GENERADOR,
  aBase64,
  compruebaVersion,
  deBase64,
  esquemaDe,
  escribe,
  exigeSerializable,
  lee,
  texto,
} from './formato.js';
import { ordenaRecursos, recursosVacios } from './recursos.js';

/**
 * Lo que **no** entra en el documento del mundo, y por qué. Se declara como dato
 * para que quien levante un mundo sepa qué le falta en vez de descubrirlo por un
 * `undefined` a mitad de una pantalla.
 */
export const CAMPOS_NO_CONGELADOS = Object.freeze([
  'la semilla de la celda, que se recompone con la de la partida y no viaja en ningún documento del mundo',
  'el pool de anclajes entero, porque lleva dentro los libres que nadie consumió',
  'la auditoría de la generación: qué se desplazó hasta el viario, qué topes de diversidad hubo que relajar y qué escenas se quedaron sin cubrir',
  'el casting, que se recompone contra el mundo congelado cada vez que hace falta; lo aceptado es estado del jugador (fila 16)',
]);

/**
 * Los campos del mundo que el formato declara, y por tanto los únicos que un mundo
 * levantado tiene.
 *
 * Es una lista **positiva** y no una de exclusiones a propósito: con exclusiones,
 * un campo nuevo del generador se colaría en el documento por no haberlo excluido, y
 * el esquema cerrado existe justamente para que eso no pueda pasar en silencio.
 */
export const CAMPOS_DEL_MUNDO = Object.freeze([
  'seed', 'radius', 'baseRadius', 'origin', 'locale', 'geo', 'settlements', 'routes',
  'parajes', 'grafo', 'viario', 'suposiciones', 'pool', 'seaMask', 'title', 'casting',
]);

// Lo que se comprueba a mano antes de codificar: el resto tiene codificación propia
// —el grafo con sus tres Maps, la máscara con su rejilla de bits— o no se congela.
const CAMPOS_QUE_SE_RECORREN = ['radius', 'baseRadius', 'locale', 'title', 'geo', 'settlements', 'parajes', 'routes', 'pool'];

const toma = (objeto, claves) => {
  const out = {};
  for (const clave of claves) if (Object.prototype.hasOwnProperty.call(objeto, clave)) out[clave] = objeto[clave];
  return out;
};

// Los tres valores de la marca de suposición, por su índice en el documento. Se
// guardan como número y no como texto porque hay una marca por arista y por tramo.
const MARCAS = [null, 'cosida', 'fallback'];

const LAND = 1;
const SEA = 2;

const aplana = (pts) => {
  const out = [];
  for (const p of pts) { out.push(p.x, p.y); }
  return out;
};

const desaplana = (planos) => {
  const out = [];
  for (let i = 0; i < planos.length; i += 2) out.push({ x: planos[i], y: planos[i + 1] });
  return out;
};

// --- La ficha del lado real -------------------------------------------------
//
// Los anclajes de OSM llevan tres campos y los de Places dos más. En el documento
// van siempre los cinco, para que el esquema sea uno solo; al levantar se vuelve a
// la forma de origen, que es lo que hace comparable el mundo campo a campo.

function fichaAlDocumento(ficha, ruta) {
  if (ficha == null) return null;
  if (typeof ficha !== 'object') throw new Error(`${ruta}: la ficha del anclaje real no es un objeto`);
  const declarados = ['name', 'kind', 'osmId', 'placeId', 'refrescable'];
  for (const clave of Object.keys(ficha)) {
    if (!declarados.includes(clave)) throw new Error(`${ruta}: la ficha del anclaje lleva el campo "${clave}", que el formato no declara`);
  }
  return {
    name: ficha.name ?? null,
    kind: ficha.kind,
    osmId: ficha.osmId ?? null,
    placeId: ficha.placeId ?? null,
    refrescable: ficha.refrescable ?? null,
  };
}

function fichaDelDocumento(f) {
  if (f == null) return null;
  const ficha = { name: f.name, kind: f.kind, osmId: f.osmId };
  // Los dos campos de Places solo existen en los anclajes de Places: añadirlos
  // siempre haría que un mundo levantado y el mismo recién generado dejaran de ser
  // iguales campo a campo por dos nulos que nadie pidió.
  if (f.placeId != null) {
    ficha.placeId = f.placeId;
    ficha.refrescable = f.refrescable;
  }
  return ficha;
}

// --- La máscara tierra/mar --------------------------------------------------

/**
 * La máscara, en rejilla de bits. Un bit por celda en vez de un byte: es lo que
 * hace asumible congelarla en lugar de recalcularla, que es lo que el mapa exige
 * —el mar pintado es parte del mapa y no puede cambiar porque cambie `seamask.js`—.
 */
function mascaraAlDocumento(mask) {
  if (!mask) return null;
  const { state, n, cell, extent } = mask;
  const bytes = new Uint8Array(Math.ceil(state.length / 8));
  for (let i = 0; i < state.length; i++) {
    const v = state[i];
    if (v !== LAND && v !== SEA) {
      throw new Error(`mundo.seaMask.state[${i}]: vale ${v} y la máscara solo declara tierra (${LAND}) y mar (${SEA})`);
    }
    if (v === SEA) bytes[i >> 3] |= 1 << (i & 7);
  }
  return { n, cell, extent, bits: aBase64(bytes) };
}

function mascaraDelDocumento(doc) {
  if (!doc) return null;
  const bytes = deBase64(doc.bits);
  const total = doc.n * doc.n;
  if (bytes.length < Math.ceil(total / 8)) {
    throw new Error(`mundo.seaMask: la rejilla de bits trae ${bytes.length} bytes y una máscara de ${doc.n}×${doc.n} necesita ${Math.ceil(total / 8)}`);
  }
  const state = new Uint8Array(total);
  for (let i = 0; i < total; i++) state[i] = (bytes[i >> 3] >> (i & 7)) & 1 ? SEA : LAND;
  return { state, n: doc.n, cell: doc.cell, extent: doc.extent };
}

// --- El grafo viario --------------------------------------------------------

/**
 * El grafo entero, congelado como dato.
 *
 * Se guarda y **no se vuelve a coser**: las aristas `'cosida'` de SPEC-007 llegan
 * hechas, así que cambiar `COSER_MAX` mañana no altera ningún mapa ya generado. Los
 * nodos van una sola vez y todo lo demás los cita por su índice; el nombre de la
 * vía y la marca de aptitud se internan, porque se repiten en miles de aristas.
 */
function viarioAlDocumento(grafo, geo) {
  if (!grafo || !(grafo.adj instanceof Map)) {
    throw new Error('mundo.viario: se esperaba el grafo viario construido con construyeGrafo y no ha llegado');
  }
  const nodos = grafo.nodeIds;
  const indiceDe = new Map(nodos.map((id, i) => [id, i]));
  // Dónde vive cada punto de las vías, por identidad: el grafo no copia los puntos
  // de la geometría, se queda con los mismos objetos, y eso es lo que permite
  // citarlos en vez de repetirlos.
  const sitioDelPunto = new Map();
  [geo.roads ?? [], geo.callejero ?? []].forEach((familia, f) => {
    familia.forEach((via, vi) => via.pts.forEach((p, pi) => {
      if (!sitioDelPunto.has(p)) sitioDelPunto.set(p, [f, vi, pi]);
    }));
  });

  const coord = [];
  const capas = [];
  const de = [];
  for (const id of nodos) {
    const p = grafo.coord.get(id);
    if (!p) throw new Error(`mundo.viario.coord: el nodo ${id} no tiene coordenada`);
    coord.push(sitioDelPunto.get(p) ?? [p.x, p.y]);
    capas.push((grafo.capas.get(id) ?? []).slice());
    de.push(grafo.de.get(id) ?? -1);
  }

  const nombres = [];
  const rasgos = [];
  const aptitudes = [];
  const interna = (tabla, valor, comoTexto) => {
    if (valor == null) return -1;
    const clave = comoTexto(valor);
    const i = tabla.claves.indexOf(clave);
    if (i >= 0) return i;
    tabla.claves.push(clave);
    tabla.valores.push(valor);
    return tabla.claves.length - 1;
  };
  const tablaNombres = { claves: [], valores: nombres };
  const tablaRasgos = { claves: [], valores: rasgos };
  const tablaAptitudes = { claves: [], valores: aptitudes };
  const claveAptitud = (a) => `${a.escalones}|${a.firme}|${a.bordillos}|${a.paso}`;

  const adj = nodos.map((id) => (grafo.adj.get(id) ?? []).map((arista) => {
    const hasta = indiceDe.get(arista.hasta);
    if (hasta === undefined) throw new Error(`mundo.viario.adj: la arista desde ${id} apunta al nodo ${arista.hasta}, que no está en la lista de nodos`);
    const marca = MARCAS.indexOf(arista.suposicion ?? null);
    if (marca < 0) throw new Error(`mundo.viario.adj: la arista ${id} ↔ ${arista.hasta} declara una marca de suposición desconocida: ${JSON.stringify(arista.suposicion)}`);
    return [
      hasta,
      arista.metros,
      marca,
      interna(tablaRasgos, arista.rasgo ?? null, (v) => v),
      interna(tablaNombres, arista.nombre ?? null, (v) => v),
      interna(tablaAptitudes, arista.aptitud ?? null, claveAptitud),
    ];
  }));

  return {
    umbralM: grafo.umbralM,
    mayor: grafo.mayor,
    nodos: nodos.slice(),
    coord,
    capas,
    de,
    nombres,
    rasgos,
    aptitudes: aptitudes.map((a) => ({ escalones: a.escalones, firme: a.firme, bordillos: a.bordillos, paso: a.paso })),
    adj,
    informe: grafo.informe,
  };
}

function viarioDelDocumento(d, geo) {
  const nodos = d.nodos.slice();
  const familias = [geo.roads, geo.callejero];
  const coord = new Map();
  const capas = new Map();
  const de = new Map();
  nodos.forEach((id, i) => {
    const c = d.coord[i];
    if (c.length === 3) {
      const [f, vi, pi] = c;
      const punto = familias[f]?.[vi]?.pts?.[pi];
      if (!punto) throw new Error(`mundo.viario.coord[${i}]: cita el punto ${pi} de la vía ${vi} de ${f === 0 ? 'roads' : 'callejero'} y ahí no hay ninguno`);
      // El mismo objeto que la geometría, igual que en el grafo recién construido.
      coord.set(id, punto);
    } else {
      coord.set(id, { x: c[0], y: c[1] });
    }
    capas.set(id, d.capas[i].slice());
    de.set(id, d.de[i]);
  });
  const adj = new Map();
  nodos.forEach((id, i) => {
    adj.set(id, d.adj[i].map(([hasta, metros, marca, rasgo, nombre, aptitud]) => ({
      hasta: nodos[hasta],
      metros,
      suposicion: MARCAS[marca],
      rasgo: rasgo < 0 ? null : d.rasgos[rasgo],
      nombre: nombre < 0 ? null : d.nombres[nombre],
      aptitud: aptitud < 0 ? null : { ...d.aptitudes[aptitud] },
    })));
  });
  return { coord, capas, adj, nodeIds: nodos, umbralM: d.umbralM, de, mayor: d.mayor, informe: d.informe };
}

// --- Rutas ------------------------------------------------------------------

function referencia(objeto, indiceNucleos, indiceParajes, ruta) {
  if (objeto == null) return null;
  const n = indiceNucleos.get(objeto);
  if (n !== undefined) return ['nucleo', n];
  const p = indiceParajes.get(objeto);
  if (p !== undefined) return ['paraje', p];
  throw new Error(
    `${ruta}: apunta a un elemento que no es ninguno de los núcleos ni de los parajes del mundo, ` +
    'así que no se puede citar por su sitio y copiarlo entero rompería la unicidad de los anclajes',
  );
}

function resuelve(ref, settlements, parajes, ruta) {
  if (ref == null) return null;
  const [familia, i] = ref;
  const lista = familia === 'nucleo' ? settlements : familia === 'paraje' ? parajes : null;
  if (!lista) throw new Error(`${ruta}: familia de referencia desconocida "${familia}"`);
  if (!lista[i]) throw new Error(`${ruta}: cita el ${familia} ${i} y el mundo solo tiene ${lista.length}`);
  return lista[i];
}

const mismoPunto = (a, b) => a != null && b != null && Object.is(a.x, b.x) && Object.is(a.y, b.y);

// --- Congelar ---------------------------------------------------------------

/**
 * El mundo de una celda, en documento.
 *
 * @param {object} registro  el que devuelve `generaCelda`.
 * @param {{ recursos?: object }} [opciones]  `recursos` es la capa de ilustraciones,
 *   fotos y textos ya resuelta —los huecos de las filas 18 y 25—; sin ella los tres
 *   huecos se declaran vacíos, que es el estado normal hoy.
 * @returns el documento, congelado. **No se escribe en ningún sitio**: quien quiera
 *   guardarlo le pasa el documento al almacén, y sin almacén el mundo se congela
 *   igual y se queda en memoria.
 */
export function congelaCelda(registro, { recursos = null } = {}) {
  if (!registro || !registro.mundo) {
    throw new Error('congelaCelda necesita el registro de una celda ya generada, con su mundo dentro');
  }
  const mundo = registro.mundo;

  // Antes de codificar nada: lo que JSON no sabe escribir se caza aquí y se nombra.
  exigeSerializable(toma(mundo, CAMPOS_QUE_SE_RECORREN), 'mundo');
  const viario = mundo.viario;
  const seaMask = mundo.seaMask;

  const indiceNucleos = new Map(mundo.settlements.map((s, i) => [s, i]));
  const indiceParajes = new Map(mundo.parajes.map((p, i) => [p, i]));
  const indiceNodos = new Map(viario.nodeIds.map((id, i) => [id, i]));
  // Los puntos del trazado que **son** nodos del grafo se citan por su índice y no
  // se copian: es lo que dice el criterio de que una calzada cita los tramos del
  // callejero en lugar de repetir sus puntos, y es la mitad del presupuesto.
  const indicePorPunto = new Map();
  viario.nodeIds.forEach((id, i) => indicePorPunto.set(viario.coord.get(id), i));

  const via = (v) => ({
    osmId: v.osmId ?? null,
    nodes: v.nodes ?? null,
    level: v.level,
    layer: v.layer,
    rasgo: v.rasgo ?? null,
    filtrables: v.filtrables ?? {},
    name: v.name ?? null,
    pts: aplana(v.pts),
  });

  const tramo = (t, ruta) => {
    const nodos = (t.nodos ?? []).map((id) => {
      const i = indiceNodos.get(id);
      if (i === undefined) throw new Error(`${ruta}: el tramo cita el nodo ${id}, que no está en el grafo congelado`);
      return i;
    });
    const a = nodos.length === 2 ? viario.coord.get(t.nodos[0]) : null;
    const b = nodos.length === 2 ? viario.coord.get(t.nodos[1]) : null;
    return {
      nodos,
      desde: mismoPunto(a, t.desde) ? null : [t.desde.x, t.desde.y],
      hasta: mismoPunto(b, t.hasta) ? null : [t.hasta.x, t.hasta.y],
      metros: t.metros,
      suposicion: t.suposicion ?? null,
      rasgo: t.rasgo ?? null,
      nombre: t.nombre ?? null,
      aptitud: t.aptitud,
    };
  };

  const doc = {
    version: VERSION_FORMATO,
    generador: VERSION_GENERADOR,
    clase: CLASES.CELDA,
    mapa: {
      id: registro.mapaId,
      anclaje: { lat: registro.anclaje.lat, lon: registro.anclaje.lon },
      idioma: mundo.locale,
    },
    celda: {
      i: registro.celda.i,
      j: registro.celda.j,
      clave: registro.clave,
      motivo: registro.motivo,
      ladoM: registro.ladoM,
      radioInscritoM: registro.radioInscritoM,
      tramoM: registro.tramoM,
      sinContenidoJugable: registro.sinContenidoJugable,
      centro: { lat: registro.centro.lat, lon: registro.centro.lon },
      esquinas: registro.limites.esquinas.map((e) => ({ lat: e.lat, lon: e.lon })),
      metros: { ...registro.limites.metros },
    },
    marco: {
      unidad: 'm',
      relativoA: 'anclaje-del-mapa',
      // El desplazamiento del marco de la celda respecto del anclaje del mapa. Con
      // él, cada coordenada del documento es metros desde el anclaje redondeado y
      // ningún punto es por sí solo una coordenada del mundo real.
      origenM: [registro.celda.i * registro.ladoM, registro.celda.j * registro.ladoM],
    },
    cupos: registro.cupos,
    mundo: {
      radius: mundo.radius,
      baseRadius: mundo.baseRadius,
      locale: mundo.locale,
      title: mundo.title,
      geo: {
        coastlines: mundo.geo.coastlines.map((c) => ({ osmId: c.osmId ?? null, pts: aplana(c.pts) })),
        lakes: mundo.geo.lakes.map((c) => ({ osmId: c.osmId ?? null, pts: aplana(c.pts) })),
        rivers: mundo.geo.rivers.map((c) => ({ osmId: c.osmId ?? null, kind: c.kind, pts: aplana(c.pts) })),
        forests: mundo.geo.forests.map((c) => ({ osmId: c.osmId ?? null, pts: aplana(c.pts) })),
        peaks: mundo.geo.peaks.map((p) => ({ osmId: p.osmId ?? null, name: p.name ?? null, ele: p.ele, x: p.x, y: p.y })),
        roads: mundo.geo.roads.map(via),
        callejero: (mundo.geo.callejero ?? []).map(via),
        bordillos: (mundo.geo.bordillos ?? []).map((b) => ({ osmId: b.osmId ?? null, nodo: b.nodo, aptitud: b.aptitud, x: b.x, y: b.y })),
      },
      seaMask: mascaraAlDocumento(seaMask),
      settlements: mundo.settlements.map((s) => ({
        type: s.type,
        x: s.x,
        y: s.y,
        name: s.name,
        anchor: fichaAlDocumento(s.anchor, `mundo.settlements "${s.name}".anchor`),
        services: s.services.map((v) => ({
          kind: v.kind,
          label: v.label ?? null,
          name: v.name,
          x: v.x,
          y: v.y,
          real: fichaAlDocumento(v.real, `mundo.settlements "${s.name}".services "${v.name}".real`),
        })),
      })),
      parajes: mundo.parajes.map((p) => ({
        type: p.type,
        x: p.x,
        y: p.y,
        name: p.name,
        label: p.label ?? null,
        origin: p.origin,
        real: fichaAlDocumento(p.real, `mundo.parajes "${p.name}".real`),
        scenes: p.scenes,
      })),
      routes: mundo.routes.map((r, k) => ({
        name: r.name ?? null,
        ramal: !!r.ramal,
        desde: referencia(r.from, indiceNucleos, indiceParajes, `mundo.routes[${k}].from`),
        hasta: referencia(r.to, indiceNucleos, indiceParajes, `mundo.routes[${k}].to`),
        pts: r.pts.map((p) => {
          const i = indicePorPunto.get(p);
          return i === undefined ? [p.x, p.y] : i;
        }),
        nodos: (r.nodos ?? []).map((id) => {
          const i = indiceNodos.get(id);
          if (i === undefined) throw new Error(`mundo.routes[${k}].nodos: cita el nodo ${id}, que no está en el grafo congelado`);
          return i;
        }),
        tramos: r.tramos.map((t, i) => tramo(t, `mundo.routes[${k}].tramos[${i}]`)),
        suposiciones: { ...r.suposiciones },
      })),
      viario: viarioAlDocumento(viario, mundo.geo),
      pool: poolAlDocumento(mundo.pool),
    },
    recursos: recursos ? ordenaRecursos(recursos) : recursosVacios(),
  };

  // Escribir es validar: si el documento no encaja en el esquema cerrado, aquí se
  // entera quien congela y no quien intente abrirlo dentro de un año.
  escribe(doc, esquemaDe(CLASES.CELDA), 'documento celda');
  return congelaHondo(doc);
}

function poolAlDocumento(pool) {
  const { problematicos, etiquetasSinNombre, ...contadores } = pool.descartes ?? {};
  return {
    admitidos: pool.admitidos,
    deOsm: pool.deOsm,
    dePlaces: pool.dePlaces,
    demanda: { ...pool.demanda },
    deficit: pool.deficit,
    relleno: pool.relleno ? { ...pool.relleno } : null,
    porEtiqueta: pool.porEtiqueta.map((e) => ({ ...e })),
    porKind: pool.porKind.map((e) => ({ ...e })),
    tomados: pool.tomados.map((t) => ({ osmId: t.osmId, rol: t.rol, nombre: t.nombre ?? null })),
    excluidos: pool.excluidos.slice(),
    descartes: {
      problematicos: { ...(problematicos ?? {}) },
      etiquetasSinNombre: (etiquetasSinNombre ?? []).map((e) => ({ ...e })),
      contadores,
    },
  };
}

function poolDelDocumento(d) {
  return {
    admitidos: d.admitidos,
    deOsm: d.deOsm,
    dePlaces: d.dePlaces,
    demanda: { ...d.demanda },
    deficit: d.deficit,
    relleno: d.relleno ? { ...d.relleno } : null,
    porEtiqueta: d.porEtiqueta.map((e) => ({ ...e })),
    porKind: d.porKind.map((e) => ({ ...e })),
    tomados: d.tomados.map((t) => ({ ...t })),
    excluidos: d.excluidos.slice(),
    descartes: {
      problematicos: { ...d.descartes.problematicos },
      etiquetasSinNombre: d.descartes.etiquetasSinNombre.map((e) => ({ ...e })),
      ...d.descartes.contadores,
    },
  };
}

/** El texto canónico del documento de una celda. Dos congelaciones del mismo mundo dan el mismo texto. */
export function textoDeCelda(registro, opciones) {
  return texto(congelaCelda(registro, opciones));
}

// --- Levantar ---------------------------------------------------------------

/**
 * Levanta el registro de una celda desde su documento.
 *
 * **Sin fuente de datos y sin red**: lo que hay en el documento es todo. La semilla
 * de la partida entra por aquí y no sale de ningún documento del mundo —es el único
 * dato que quien juega puede llegar a enseñarle a alguien—, y con ella se recompone
 * la semilla de la celda, que es lo que necesita el casting.
 *
 * @param {object} doc  el documento ya leído, o su texto.
 * @param {{ semilla: string }} opciones
 */
export function levantaCelda(doc, { semilla } = {}) {
  const d = typeof doc === 'string' ? lee(doc, 'el documento de la celda') : compruebaDocumento(doc);
  const semillaPartida = exigeSemilla(semilla);
  const celda = { i: d.celda.i, j: d.celda.j };
  const semillaCelda = semillaDeCelda(semillaPartida, d.mapa.id, celda);

  const via = (v) => ({
    pts: desaplana(v.pts),
    nodes: v.nodes,
    level: v.level,
    layer: v.layer,
    rasgo: v.rasgo,
    filtrables: { ...v.filtrables },
    name: v.name,
    osmId: v.osmId,
  });

  const geo = {
    coastlines: d.mundo.geo.coastlines.map((c) => ({ pts: desaplana(c.pts), osmId: c.osmId })),
    lakes: d.mundo.geo.lakes.map((c) => ({ pts: desaplana(c.pts), osmId: c.osmId })),
    rivers: d.mundo.geo.rivers.map((c) => ({ pts: desaplana(c.pts), kind: c.kind, osmId: c.osmId })),
    forests: d.mundo.geo.forests.map((c) => ({ pts: desaplana(c.pts), osmId: c.osmId })),
    peaks: d.mundo.geo.peaks.map((p) => ({ x: p.x, y: p.y, ele: p.ele, name: p.name, osmId: p.osmId })),
    roads: d.mundo.geo.roads.map(via),
    callejero: d.mundo.geo.callejero.map(via),
    bordillos: d.mundo.geo.bordillos.map((b) => ({ nodo: b.nodo, x: b.x, y: b.y, aptitud: b.aptitud, osmId: b.osmId })),
  };

  // El grafo después de la geometría, porque cita sus puntos en lugar de copiarlos.
  const viario = viarioDelDocumento(d.mundo.viario, geo);
  const puntoDeNodo = (i) => viario.coord.get(viario.nodeIds[i]);

  const settlements = d.mundo.settlements.map((s) => ({
    type: s.type,
    x: s.x,
    y: s.y,
    name: s.name,
    anchor: fichaDelDocumento(s.anchor),
    services: s.services.map((v) => ({
      kind: v.kind,
      label: v.label,
      name: v.name,
      x: v.x,
      y: v.y,
      real: fichaDelDocumento(v.real),
    })),
  }));

  const parajes = d.mundo.parajes.map((p) => ({
    type: p.type,
    x: p.x,
    y: p.y,
    real: fichaDelDocumento(p.real),
    origin: p.origin,
    name: p.name,
    label: p.label,
    scenes: { ...p.scenes },
  }));

  const routes = d.mundo.routes.map((r, k) => {
    const tramos = r.tramos.map((t) => ({
      desde: t.desde ? { x: t.desde[0], y: t.desde[1] } : { ...puntoDeNodo(t.nodos[0]) },
      hasta: t.hasta ? { x: t.hasta[0], y: t.hasta[1] } : { ...puntoDeNodo(t.nodos[1]) },
      nodos: t.nodos.map((i) => viario.nodeIds[i]),
      metros: t.metros,
      suposicion: t.suposicion,
      rasgo: t.rasgo,
      nombre: t.nombre,
      aptitud: { ...t.aptitud },
    }));
    const ruta = {
      from: resuelve(r.desde, settlements, parajes, `mundo.routes[${k}].desde`),
      to: resuelve(r.hasta, settlements, parajes, `mundo.routes[${k}].hasta`),
      pts: r.pts.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : puntoDeNodo(p))),
      nodos: r.nodos.map((i) => viario.nodeIds[i]),
    };
    // La marca de ramal solo existe en los ramales: ponerla a `false` en las
    // calzadas añadiría un campo que el mundo recién generado no tiene.
    if (r.ramal) ruta.ramal = true;
    ruta.tramos = tramos;
    ruta.suposiciones = { ...r.suposiciones };
    // Las dos marcas de la ruta salen de su resumen y no se guardan aparte: son el
    // mismo dato dicho dos veces, y en un documento eso es una ocasión de divergir.
    ruta.cosida = r.suposiciones.cosida;
    ruta.fallback = r.suposiciones.fallback;
    ruta.name = r.name;
    return ruta;
  });

  const mundo = {
    seed: semillaCelda,
    radius: d.mundo.radius,
    baseRadius: d.mundo.baseRadius,
    origin: { lat: d.celda.centro.lat, lon: d.celda.centro.lon },
    locale: d.mundo.locale,
    geo,
    settlements,
    routes,
    parajes,
    grafo: viario.informe,
    viario,
    // Los tramos que son suposición nuestra son una vista de las calzadas ya
    // congeladas —un filtro, no una decisión—, así que se recomponen en lugar de
    // repetir cada tramo marcado una segunda vez dentro del documento.
    suposiciones: tramosSupuestos(routes),
    pool: poolDelDocumento(d.mundo.pool),
    seaMask: mascaraDelDocumento(d.mundo.seaMask),
    title: d.mundo.title,
  };
  // El casting no se congela: se recompone contra el mundo levantado, que es
  // determinista y no pide nada a nadie. Lo que hay que conservar es el resultado
  // **aceptado**, y eso es estado del jugador (fila 16).
  //
  // El encuadre tampoco se guarda, por lo mismo: es el que declara la tubería al
  // generar (`world/build.js`), y repetirlo en el documento sería una segunda copia
  // del mismo número esperando a desincronizarse.
  mundo.casteo = { tramoM: TRAMO_DE_REFERENCIA_M, partida: { x: 0, y: 0 } };
  mundo.casting = castAll(mundo);

  const centro = { lat: d.celda.centro.lat, lon: d.celda.centro.lon };
  const esquinas = d.celda.esquinas.map((e) => ({ lat: e.lat, lon: e.lon }));
  return congelaHondo({
    celda,
    clave: d.celda.clave,
    ladoM: d.celda.ladoM,
    radioInscritoM: d.celda.radioInscritoM,
    anclaje: { lat: d.mapa.anclaje.lat, lon: d.mapa.anclaje.lon },
    semillaPartida,
    semillaCelda,
    mapaId: d.mapa.id,
    motivo: d.celda.motivo,
    limites: {
      celda: { i: celda.i, j: celda.j },
      ladoM: d.celda.ladoM,
      metros: { ...d.celda.metros },
      esquinas,
      min: esquinas[0],
      max: esquinas[2],
      centro,
    },
    centro,
    tramoM: d.celda.tramoM,
    cupos: d.cupos,
    sinContenidoJugable: d.celda.sinContenidoJugable,
    mundo,
    recursos: d.recursos,
  });
}

/** Comprueba un documento ya parseado: la versión primero, el esquema cerrado después. */
export function compruebaDocumento(doc, donde = 'el documento de la celda') {
  compruebaVersion(doc, donde);
  escribe(doc, esquemaDe(doc.clase), donde);
  return doc;
}

/**
 * La parte de un mundo que el formato declara, para poder compararla.
 *
 * Existe porque un mundo recién generado trae además cosas que **no** se congelan
 * —el pool de anclajes con los libres dentro, la auditoría de lo que se movió— y
 * compararlo entero con uno levantado diría que son distintos cuando lo que pasa es
 * que uno lleva de más lo que el formato declara que no guarda.
 */
export function parteCongelada(mundo) {
  return toma(mundo, CAMPOS_DEL_MUNDO);
}
