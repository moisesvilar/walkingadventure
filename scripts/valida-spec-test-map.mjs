// Valida test/spec-test-map.json contra test/spec-test-map.schema.json.
//
// Validador propio y no un motor genérico de JSON Schema, por dos razones: el
// repo no tiene dependencias de runtime, y las dos comprobaciones que de verdad
// evitan un mapa mentiroso —que el fichero de pruebas exista y que el escenario
// citado esté en docs/testing.md— no las hace ningún esquema.
//
//   node scripts/valida-spec-test-map.mjs
//
// Sale 0 si el mapa es válido o si todavía no existe (que no es un error: hasta
// que wa-qa-dev escriba pruebas no hay nada que mapear) y 1 si hay problemas.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAPA = join(RAIZ, 'test', 'spec-test-map.json');
const BATERIA = join(RAIZ, 'docs', 'testing.md');

const NIVELES = ['@nucleo', '@app', '@red', '@manual'];
const OBLIGATORIOS = ['spec', 'criterio', 'nivel', 'fichero', 'caso'];
const SPEC = /^SPEC-\d{3}(-iter-\d+)?$/;

// Los nombres de escenario de la batería, tal cual aparecen tras "Escenario:".
// Se compara literal a propósito: si alguien reescribe el escenario, el mapa debe
// romperse en vez de seguir apuntando a un nombre que ya no existe.
function escenariosDeLaBateria() {
  const texto = readFileSync(BATERIA, 'utf8');
  const nombres = new Set();
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*Escenario:\s*(.+?)\s*$/);
    if (m) nombres.add(m[1]);
  }
  return nombres;
}

export function validaMapa() {
  if (!existsSync(MAPA)) {
    return { estado: 'sin-mapa', problemas: [], mensaje: 'test/spec-test-map.json todavía no existe: aún no hay mapa de cobertura que validar.' };
  }

  const problemas = [];
  let mapa;
  try {
    mapa = JSON.parse(readFileSync(MAPA, 'utf8'));
  } catch (e) {
    return { estado: 'invalido', problemas: [`test/spec-test-map.json no es JSON válido: ${e.message}`], mensaje: '1 problema' };
  }

  if (!Array.isArray(mapa.entradas)) {
    return { estado: 'invalido', problemas: ['falta la lista "entradas" en la raíz del mapa'], mensaje: '1 problema' };
  }

  const escenarios = escenariosDeLaBateria();

  mapa.entradas.forEach((entrada, i) => {
    const donde = `entrada ${i}${entrada && entrada.caso ? ` ("${entrada.caso}")` : ''}`;

    for (const campo of OBLIGATORIOS) {
      if (entrada[campo] === undefined || entrada[campo] === '') problemas.push(`${donde}: falta el campo obligatorio "${campo}"`);
    }
    if (entrada.spec !== undefined && !SPEC.test(entrada.spec)) {
      problemas.push(`${donde}: "spec" mal formada: "${entrada.spec}" (se espera SPEC-NNN o SPEC-NNN-iter-M)`);
    }
    if (entrada.nivel !== undefined && !NIVELES.includes(entrada.nivel)) {
      problemas.push(`${donde}: nivel inválido "${entrada.nivel}". Válidos: ${NIVELES.join(', ')}`);
    }
    if (entrada.fichero && !existsSync(join(RAIZ, entrada.fichero))) {
      problemas.push(`${donde}: el fichero de pruebas "${entrada.fichero}" no existe`);
    }
    if (entrada.escenario) {
      if (!escenarios.has(entrada.escenario)) {
        problemas.push(`${donde}: el escenario "${entrada.escenario}" no aparece en docs/testing.md`);
      }
    } else if (entrada.hueco_de_bateria !== true) {
      // Una entrada sin escenario solo se acepta declarada como hueco: si no, es
      // indistinguible de un olvido.
      problemas.push(`${donde}: no cita ningún escenario de docs/testing.md y no viene marcada con "hueco_de_bateria": true`);
    }
  });

  return {
    estado: problemas.length ? 'invalido' : 'valido',
    problemas,
    mensaje: problemas.length
      ? `${problemas.length} problema(s) en ${mapa.entradas.length} entrada(s)`
      : `${mapa.entradas.length} entrada(s), todas válidas`,
  };
}

// Ejecutable directo: es lo que llama el runner.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = validaMapa();
  console.log(r.mensaje);
  for (const p of r.problemas) console.log(`- ${p}`);
  process.exitCode = r.estado === 'invalido' ? 1 : 0;
}
