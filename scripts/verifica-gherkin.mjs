// Comprueba que los bloques Gherkin de docs/testing.md están bien formados.
// La batería se escribió antes de implementar nada, así que nadie la va a
// ejecutar en meses: sin esta comprobación, los errores de sintaxis se
// descubrirían el día que se monte el runner, que es el peor momento.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ruta = join(raiz, 'docs', 'testing.md');

// Palabras clave del locale es de Gherkin. Se listan a propósito en vez de
// aceptar cualquier cosa: un "Given" colado en castellano no lo ve nadie.
const PASOS = ['Dado', 'Dada', 'Dados', 'Dadas', 'Cuando', 'Entonces', 'Y', 'E', 'Pero'];
const rePaso = new RegExp(`^(${PASOS.join('|')})\\s+\\S`);

function bloques(md) {
  return [...md.matchAll(/```gherkin\n([\s\S]*?)```/g)].map((m, i) => ({
    indice: i + 1,
    linea: md.slice(0, m.index).split('\n').length,
    texto: m[1],
  }));
}

function analiza(bloque, fallos) {
  const donde = `bloque ${bloque.indice} (línea ${bloque.linea})`;
  const lineas = bloque.texto.split('\n');

  if (lineas[0].trim() !== '# language: es') {
    fallos.push(`${donde}: la primera línea debe ser "# language: es"`);
  }

  const caracteristicas = lineas.filter((l) => l.trim().startsWith('Característica:'));
  if (caracteristicas.length !== 1) {
    fallos.push(`${donde}: se esperaba una Característica y hay ${caracteristicas.length}`);
    return;
  }
  const nombreCar = caracteristicas[0].split(':').slice(1).join(':').trim();
  if (!nombreCar) fallos.push(`${donde}: la Característica no tiene nombre`);

  // Cada característica cita el documento de game-design del que sale. Un
  // escenario sin procedencia es una opinión, no una decisión.
  if (!bloque.texto.includes('Fuente:')) {
    fallos.push(`${donde} "${nombreCar}": falta la línea "Fuente:" con el documento de origen`);
  }

  // Se recorre agrupando por escenario para poder validar cada uno entero.
  const escenarios = [];
  let actual = null;
  let enCabecera = false;
  for (const [i, cruda] of lineas.entries()) {
    const l = cruda.trim();
    const n = bloque.linea + i;
    if (!l || l.startsWith('#')) continue;

    if (l.startsWith('Escenario:') || l.startsWith('Esquema del escenario:')) {
      actual = {
        tipo: l.startsWith('Esquema') ? 'esquema' : 'escenario',
        nombre: l.split(':').slice(1).join(':').trim(),
        n, pasos: [], tabla: [], enEjemplos: false,
      };
      escenarios.push(actual);
      continue;
    }
    // Antes del primer escenario van las etiquetas y la descripción libre de la
    // característica, que Gherkin permite y que aquí lleva la Fuente.
    if (l.startsWith('@') || l.startsWith('Característica:') || l.startsWith('Antecedentes:')) {
      if (l.startsWith('Característica:')) enCabecera = true;
      continue;
    }
    if (!actual) {
      if (!enCabecera) fallos.push(`${donde}, línea ${n}: "${l}" está antes de la Característica`);
      continue;
    }
    if (l.startsWith('Ejemplos:')) { actual.enEjemplos = true; continue; }
    if (l.startsWith('|')) {
      if (!actual.enEjemplos) fallos.push(`${donde}, línea ${n}: fila de tabla fuera de Ejemplos`);
      actual.tabla.push(l.split('|').slice(1, -1).map((c) => c.trim()));
      continue;
    }
    if (rePaso.test(l)) {
      if (actual.enEjemplos) fallos.push(`${donde}, línea ${n}: hay un paso después de Ejemplos`);
      actual.pasos.push(l);
      continue;
    }
    fallos.push(`${donde}, línea ${n}: "${l}" no empieza por ninguna palabra clave (${PASOS.join(', ')})`);
  }

  if (!escenarios.length) fallos.push(`${donde} "${nombreCar}": no tiene ningún escenario`);

  const vistos = new Set();
  for (const e of escenarios) {
    const eDonde = `${donde}, escenario "${e.nombre}" (línea ${e.n})`;
    if (!e.nombre) fallos.push(`${donde}, línea ${e.n}: escenario sin nombre`);
    if (vistos.has(e.nombre)) fallos.push(`${eDonde}: nombre repetido dentro de la característica`);
    vistos.add(e.nombre);

    if (!e.pasos.length) fallos.push(`${eDonde}: no tiene ningún paso`);
    // Un escenario sin Entonces no afirma nada, que es la manera más silenciosa
    // de tener una suite verde que no comprueba nada.
    if (!e.pasos.some((p) => /^Entonces\s/.test(p))) fallos.push(`${eDonde}: no tiene ningún Entonces`);
    if (e.pasos.length && /^(Y|E|Pero)\s/.test(e.pasos[0])) {
      fallos.push(`${eDonde}: empieza por "${e.pasos[0].split(' ')[0]}", que necesita un paso anterior`);
    }

    const placeholders = new Set();
    for (const p of e.pasos) for (const [, v] of p.matchAll(/<([^<>]+)>/g)) placeholders.add(v);

    if (e.tipo === 'esquema') {
      if (!e.tabla.length) { fallos.push(`${eDonde}: es un Esquema y no tiene tabla de Ejemplos`); continue; }
      const cabecera = e.tabla[0];
      const filas = e.tabla.slice(1);
      if (!filas.length) fallos.push(`${eDonde}: la tabla de Ejemplos no tiene ninguna fila`);
      for (const [i, f] of filas.entries()) {
        if (f.length !== cabecera.length) {
          fallos.push(`${eDonde}: la fila ${i + 1} tiene ${f.length} columnas y la cabecera ${cabecera.length}`);
        }
      }
      for (const p of placeholders) {
        if (!cabecera.includes(p)) fallos.push(`${eDonde}: usa <${p}> y no está en la cabecera de Ejemplos`);
      }
      for (const c of cabecera) {
        if (!placeholders.has(c)) fallos.push(`${eDonde}: la columna "${c}" no la usa ningún paso`);
      }
    } else {
      if (e.tabla.length) fallos.push(`${eDonde}: tiene tabla de Ejemplos sin ser un Esquema del escenario`);
      if (placeholders.size) {
        fallos.push(`${eDonde}: usa <${[...placeholders][0]}> sin ser un Esquema del escenario`);
      }
    }
  }
  return escenarios;
}

function main() {
  const md = readFileSync(ruta, 'utf8');
  const bs = bloques(md);
  if (!bs.length) { console.error('docs/testing.md no contiene ningún bloque ```gherkin'); process.exit(1); }

  const fallos = [];
  let escenarios = 0, esquemas = 0, ejemplos = 0;
  for (const b of bs) {
    const es = analiza(b, fallos) ?? [];
    escenarios += es.filter((e) => e.tipo === 'escenario').length;
    esquemas += es.filter((e) => e.tipo === 'esquema').length;
    ejemplos += es.filter((e) => e.tipo === 'esquema')
      .reduce((n, e) => n + Math.max(0, e.tabla.length - 1), 0);
  }

  // Las etiquetas de nivel deciden qué puede correr en cada commit, así que una
  // característica sin etiqueta es una que nadie sabe dónde ejecutar.
  const conEtiqueta = [...md.matchAll(/@(nucleo|app|red|manual)\b/g)].length;
  if (conEtiqueta < bs.length) {
    fallos.push(`Hay ${bs.length} características y solo ${conEtiqueta} etiquetas de nivel (@nucleo, @app, @red, @manual)`);
  }

  if (fallos.length) {
    console.error(`\n✗ docs/testing.md tiene ${fallos.length} problema(s) de forma.\n`);
    for (const f of fallos) console.error(`  - ${f}`);
    console.error('');
    process.exit(1);
  }

  console.log(`\n✓ docs/testing.md está bien formado.`);
  console.log(`  ${bs.length} características · ${escenarios} escenarios · ${esquemas} esquemas con ${ejemplos} ejemplos`);
  console.log(`  ${escenarios + ejemplos} casos ejecutables en total.\n`);
}

main();
