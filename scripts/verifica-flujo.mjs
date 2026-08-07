// Comprueba que docs/flujo.md contiene exactamente las pantallas que dibujan los
// seis artefactos de docs/pantallas/. El diagrama es el único sitio donde se ven
// las costuras entre momentos, y las dos veces que un artefacto estuvo mal el
// fallo era una arista que faltaba: sin esta comprobación, añadir una pantalla y
// olvidarse del flujo no lo detecta nadie.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  return { nodos, conectados, aristas: aristas.length, mermaid };
}

function main() {
  const esperadas = artefactos().flatMap(pantallasDe);
  const { nodos, conectados, aristas } = leerFlujo();

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
