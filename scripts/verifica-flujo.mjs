// Comprueba que docs/flujo.md contiene exactamente las pantallas que dibujan los
// seis artefactos de docs/pantallas/. El diagrama es el único sitio donde se ven
// las costuras entre momentos, y las dos veces que un artefacto estuvo mal el
// fallo era una arista que faltaba: sin esta comprobación, añadir una pantalla y
// olvidarse del flujo no lo detecta nadie.
//
// Y **además compara aristas**, desde SPEC-044. Comparar solo nodos es una
// comprobación asimétrica: caza una pantalla dibujada que falta en el diagrama, y no
// caza una transición que el código tiene y el diagrama no. Por ahí se coló entera la
// llegada a un núcleo sin beat —`secuencia.js` le da el paso de A4P5 y el diagrama
// solo llegaba a A4P5 pasando por el beat—, y antes se había colado una pantalla
// entera (`decisiones-orquestador.md` §6y). Dos veces la misma forma.
//
// La segunda fuente de verdad es `secuenciaDeLlegada`, y se eligió porque es honesta
// y barata: es una función pura sobre un espacio de entrada de veinticuatro
// combinaciones, así que se enumera entero en lugar de mantener a mano una lista de
// transiciones que alguien tendría que acordarse de mirar. El mapa de tipo de paso a
// pantallas sí es a mano, y por eso **se exige completo contra `IDS_DE_TIPO`**: añadir
// un tipo de paso obliga a tocarlo, que es la regla de siempre en este repo.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IDS_DE_TIPO, MODOS, TIPOS_DE_PASO, TIPOS_DE_SITIO, secuenciaDeLlegada } from '../packages/nucleo/partida/secuencia.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirPantallas = join(raiz, 'docs', 'pantallas');
const rutaFlujo = join(raiz, 'docs', 'flujo.md');

// Los artefactos se llaman pantallas-<n>-<slug>.html y el número es el del artefacto.
function artefactos() {
  return readdirSync(dirPantallas)
    .filter((f) => /^pantallas-\d+-.*\.html$/.test(f))
    .sort();
}

// De cada bloque de notas salen la etiqueta ("PANTALLA 2B · EN SU LUGAR") y el
// título. El identificador es A<artefacto>P<etiqueta>: 1..8, o 1B/2B en las
// variantes del telón, que ocupan el sitio de otra pantalla en lugar de ser un
// camino aparte.
function pantallasDe(fichero) {
  const artefacto = Number(fichero.match(/^pantallas-(\d+)-/)[1]);
  const html = readFileSync(join(dirPantallas, fichero), 'utf8');
  const bloques = [...html.matchAll(/<p class="paso">(.*?)<\/p>\s*<h2>(.*?)<\/h2>/gs)];

  return bloques.map(([, etiquetaCruda, tituloCrudo]) => {
    const m = etiquetaCruda.trim().match(/^PANTALLA\s+(\d+B?)/i);
    if (!m) throw new Error(`Etiqueta de pantalla ilegible en ${fichero}: "${etiquetaCruda.trim()}"`);
    const numero = m[1].toUpperCase();
    // El título lleva insignias (<span class="nuevo">) que no son parte del nombre.
    const titulo = tituloCrudo.replace(/<span class="(nuevo|fuente)">.*?<\/span>/gs, '')
      .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return { id: `A${artefacto}P${numero}`, artefacto, numero, titulo, fichero };
  });
}

// Del diagrama salen los nodos declarados (id["etiqueta"]) y los extremos de las
// aristas, para poder distinguir un nodo suelto de uno conectado.
function leerFlujo() {
  const md = readFileSync(rutaFlujo, 'utf8');
  const bloque = md.match(/```mermaid\n([\s\S]*?)```/);
  if (!bloque) throw new Error('docs/flujo.md no contiene ningún bloque ```mermaid');
  const mermaid = bloque[1];

  const nodos = new Map();
  for (const [, id, etiqueta] of mermaid.matchAll(/\b(A\d+P\d+B?)\["(.*?)"\]/gs)) {
    nodos.set(id, etiqueta.replace(/<br\/>/g, ' · ').trim());
  }

  // Aristas: --> y -.-> con o sin |etiqueta|. Se recogen los dos extremos.
  const conectados = new Set();
  const aristas = [...mermaid.matchAll(
    /^\s*([A-Za-z0-9_]+)\s*-[.-]*->\s*(?:\|"?(.*?)"?\|\s*)?([A-Za-z0-9_]+)/gm
  )];
  for (const [, origen, , destino] of aristas) {
    conectados.add(origen);
    conectados.add(destino);
  }

  // El grafo dirigido, que es lo que hace falta para preguntar por caminos y no solo
  // por extremos sueltos. Los nodos de bifurcación (LLEGA, CIERRA, NUCLEO) entran
  // igual: son parte del camino aunque no sean pantallas.
  const salidas = new Map();
  for (const [, origen, , destino] of aristas) {
    if (!salidas.has(origen)) salidas.set(origen, []);
    salidas.get(origen).push(destino);
  }

  return { nodos, conectados, aristas: aristas.length, salidas, mermaid };
}

// --- la comparación de aristas contra la secuencia del núcleo ----------------------

/**
 * Qué pantallas dibujan cada tipo de paso de una llegada.
 *
 * Un paso puede ocupar más de una: el visor son la pantalla y su arrastre, el beat son
 * la escena y lo que te llevas, y de la ficha cuelga el descarte, que es capa suya.
 * Se exige completo contra `IDS_DE_TIPO` unas líneas más abajo.
 */
const PANTALLAS_DEL_PASO = {
  [TIPOS_DE_PASO.VISOR]: ['A4P1', 'A4P2'],
  [TIPOS_DE_PASO.BEAT]: ['A4P3', 'A4P4'],
  [TIPOS_DE_PASO.FICHA]: ['A4P7', 'A4P8'],
  [TIPOS_DE_PASO.LO_QUE_SE_CUENTA]: ['A4P5'],
};

/** Por dónde entra una llegada en el diagrama, y dónde aterriza una segunda visita. */
const ENTRADA_DE_LLEGADA = 'LLEGA';
const SEGUNDA_VISITA = 'A4P6';

/**
 * Si desde `desde` se llega a `hasta` **sin salirse de `permitidas`**.
 *
 * La restricción es la pieza, y sin ella la comprobación no vale: con alcanzabilidad a
 * secas, la llegada a un núcleo sin beat quedaba «cubierta» por el camino que pasa por
 * el beat, que es justo el que esa secuencia no tiene. Un camino solo cuenta si usa
 * las pantallas de los pasos que esta secuencia sí trae.
 */
function alcanzable(salidas, desde, hasta, permitidas) {
  const vistos = new Set([desde]);
  const cola = [desde];
  while (cola.length) {
    const actual = cola.shift();
    for (const siguiente of salidas.get(actual) ?? []) {
      if (siguiente === hasta) return true;
      if (vistos.has(siguiente) || !permitidas.has(siguiente)) continue;
      vistos.add(siguiente);
      cola.push(siguiente);
    }
  }
  return false;
}

/**
 * Toda secuencia que el núcleo puede producir tiene su camino en el diagrama.
 *
 * Se enumeran las veinticuatro combinaciones en vez de elegir casos: el espacio es
 * pequeño y completo, así que no hay manera de que se quede fuera el que falla.
 */
function fallosDeAristas({ nodos, salidas }) {
  const fallos = [];

  const sinMapa = IDS_DE_TIPO.filter((tipo) => !PANTALLAS_DEL_PASO[tipo]);
  if (sinMapa.length) {
    fallos.push(
      `El tipo de paso ${sinMapa.join(', ')} no dice qué pantalla lo dibuja: añade su entrada a PANTALLAS_DEL_PASO. ` +
      'Sin ella, una secuencia nueva se comprobaría a medias sin que nada protestara.',
    );
    return fallos;
  }

  const decisiones = [...salidas.keys()].filter((id) => !/^A\d+P\d+B?$/.test(id));
  const dichos = new Set();

  for (const tipoDeSitio of TIPOS_DE_SITIO) {
    for (const primeraVisita of [true, false]) {
      for (const hayIlustracion of [true, false]) {
        for (const hayBeat of [true, false]) {
          const secuencia = secuenciaDeLlegada({ tipoDeSitio, primeraVisita, hayIlustracion, hayBeat });
          // Solo las pantallas de esta secuencia, más las bifurcaciones y el aterrizaje
          // de la segunda visita, que es por donde el diagrama la hace pasar.
          const permitidas = new Set([...decisiones, ...(primeraVisita ? [] : [SEGUNDA_VISITA])]);
          for (const paso of secuencia) for (const p of PANTALLAS_DEL_PASO[paso.tipo]) permitidas.add(p);

          // El encadenado es el camino obligado; lo que está a un toque se alcanza con
          // un dedo y el diagrama ya lo dibuja como tal.
          const encadenados = secuencia.filter((p) => p.modo === MODOS.ENCADENADO);
          let desde = ENTRADA_DE_LLEGADA;
          for (const paso of encadenados) {
            const destino = PANTALLAS_DEL_PASO[paso.tipo][0];
            if (!nodos.has(destino)) break;
            if (!alcanzable(salidas, desde, destino, permitidas)) {
              const caso = `${tipoDeSitio}${primeraVisita ? '' : ', ya visitado'}${hayIlustracion ? ', con ilustración' : ', sin ilustración'}${hayBeat ? ', con beat' : ', sin beat'}`;
              const linea = `Falta camino a ${destino} desde ${desde}: la secuencia de un ${caso} lo exige (${secuencia.map((p) => p.tipo).join(' → ')}) y el diagrama no lo tiene`;
              if (!dichos.has(linea)) { dichos.add(linea); fallos.push(linea); }
              break;
            }
            desde = destino;
          }
        }
      }
    }
  }
  return fallos;
}

function main() {
  const esperadas = artefactos().flatMap(pantallasDe);
  const { nodos, conectados, aristas, salidas } = leerFlujo();

  const fallos = [];

  // 1. Todas las pantallas de los artefactos están en el diagrama.
  const faltan = esperadas.filter((p) => !nodos.has(p.id));
  for (const p of faltan) {
    fallos.push(`Falta en el diagrama: ${p.id} — "${p.titulo}" (${p.fichero})`);
  }

  // 2. El diagrama no inventa pantallas que ningún artefacto dibuja.
  const idsEsperados = new Set(esperadas.map((p) => p.id));
  for (const id of nodos.keys()) {
    if (!idsEsperados.has(id)) fallos.push(`Sobra en el diagrama: ${id} no existe en ningún artefacto`);
  }

  // 3. La etiqueta del nodo dice de qué pantalla y de qué artefacto es, y con el
  //    título que le puso el artefacto. Un nodo bien conectado con el nombre de
  //    otra pantalla es peor que un nodo que falta.
  for (const p of esperadas) {
    const etiqueta = nodos.get(p.id);
    if (etiqueta === undefined) continue;
    const cabecera = `pantalla ${p.numero} · artefacto ${p.artefacto}`;
    if (!etiqueta.toLowerCase().startsWith(cabecera.toLowerCase())) {
      fallos.push(`Etiqueta mal formada en ${p.id}: "${etiqueta}" no empieza por "${cabecera}"`);
    }
    if (!etiqueta.includes(p.titulo)) {
      fallos.push(`Título distinto en ${p.id}: el artefacto dice "${p.titulo}" y el diagrama "${etiqueta}"`);
    }
  }

  // 4. Ninguna pantalla queda suelta: un nodo sin aristas es una pantalla a la
  //    que no se llega, que es exactamente el fallo que este diagrama existe para
  //    cazar.
  for (const p of esperadas) {
    if (nodos.has(p.id) && !conectados.has(p.id)) {
      fallos.push(`Pantalla suelta: ${p.id} — "${p.titulo}" está dibujada pero no la conecta ninguna arista`);
    }
  }

  // 5. Toda secuencia de llegada que el núcleo puede producir tiene camino en el
  //    diagrama, con las pantallas de sus propios pasos y no con las de otro.
  fallos.push(...fallosDeAristas({ nodos, salidas }));

  const porArtefacto = new Map();
  for (const p of esperadas) porArtefacto.set(p.artefacto, (porArtefacto.get(p.artefacto) ?? 0) + 1);
  const resumen = [...porArtefacto.entries()].sort((a, b) => a[0] - b[0])
    .map(([a, n]) => `artefacto ${a}: ${n}`).join(' · ');

  if (fallos.length) {
    console.error(`\n✗ El diagrama de docs/flujo.md no cuadra con los artefactos.\n`);
    for (const f of fallos) console.error(`  - ${f}`);
    console.error(`\n  ${esperadas.length} pantallas esperadas (${resumen})`);
    console.error(`  ${nodos.size} nodos en el diagrama, ${aristas} aristas\n`);
    process.exit(1);
  }

  console.log(`\n✓ El diagrama contiene las ${esperadas.length} pantallas de los ${porArtefacto.size} artefactos.`);
  console.log(`  ${resumen}`);
  console.log(`  ${nodos.size} nodos, ${aristas} aristas, ninguna pantalla suelta.\n`);
}

main();
