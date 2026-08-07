// Sandbox del runner: una copia mínima del repo en un directorio temporal.
//
// Existe por un problema que no tiene otra salida honesta: `scripts/qa-tester-run.sh`
// ejecuta todo lo que hay en `test/nucleo/`, así que una prueba que lo invoque
// desde `test/nucleo/` se llama a sí misma sin fondo. El runner calcula su raíz
// desde su propia ubicación, de modo que copiarlo a otro árbol le da otro
// `test/nucleo/` que ejecutar y corta la recursión sin tocar ni una línea suya.
//
// No es un doble: es el runner de verdad, corriendo sobre un repo de mentira.
// Nada de esto toca el árbol del proyecto ni la red.

import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Nombres literales de los casos de ejemplo, para poder afirmarlos en el report. */
export const CASO_QUE_PASA = 'Un caso de ejemplo del andamiaje que pasa';
export const CASO_QUE_FALLA = 'Un caso de ejemplo del andamiaje que falla a propósito';
export const MENSAJE_DEL_FALLO = 'el andamiaje falla a propósito y esto tiene que salir literal en el report';

// Batería mínima del sandbox: solo hacen falta nombres de escenario, que es lo
// único que lee el validador del mapa de cobertura.
export const ESCENARIO_DE_LA_BATERIA = 'Dos generaciones con la misma semilla dan el mismo mundo';
const BATERIA_MINIMA = [
  '# Batería mínima del sandbox',
  '',
  '```gherkin',
  '@nucleo @determinismo',
  'Característica: Un ejemplo',
  '',
  `  Escenario: ${ESCENARIO_DE_LA_BATERIA}`,
  '    Dado un mundo sembrado',
  '```',
  '',
].join('\n');

const PRUEBA_QUE_PASA = [
  "import { test } from 'node:test';",
  "import assert from 'node:assert/strict';",
  '',
  `test('${CASO_QUE_PASA}', () => {`,
  '  assert.equal(1, 1);',
  '});',
  '',
].join('\n');

const PRUEBA_QUE_FALLA = [
  "import { test } from 'node:test';",
  "import assert from 'node:assert/strict';",
  '',
  `test('${CASO_QUE_FALLA}', () => {`,
  `  assert.equal(1, 2, '${MENSAJE_DEL_FALLO}');`,
  '});',
  '',
].join('\n');

/**
 * Monta un repo de mentira con el runner de verdad dentro.
 *
 * @param {object} [opciones]
 * @param {'ninguna'|'pasa'|'falla'} [opciones.pruebas='ninguna']  qué hay en test/nucleo/
 * @param {boolean} [opciones.conReports=true]  si test/reports/ existe de antemano
 * @param {boolean} [opciones.nucleoRoto=false] planta un packages/nucleo/ que importa React Native
 * @param {number}  [opciones.flujos=0]         cuántos .yaml hay en test/app/
 * @param {object|null} [opciones.mapa=null]    contenido de test/spec-test-map.json
 * @param {boolean} [opciones.conGit=false]     inicializa un repo git (queda sucio a propósito)
 */
export function creaSandbox(opciones = {}) {
  const {
    pruebas = 'ninguna',
    conReports = true,
    nucleoRoto = false,
    flujos = 0,
    mapa = null,
    conGit = false,
    bateria = BATERIA_MINIMA,
  } = opciones;

  const raiz = mkdtempSync(join(tmpdir(), 'wa-andamiaje-'));

  mkdirSync(join(raiz, 'scripts'), { recursive: true });
  for (const s of ['qa-tester-run.sh', 'comprueba-nucleo.mjs', 'valida-spec-test-map.mjs']) {
    copyFileSync(join(RAIZ_REPO, 'scripts', s), join(raiz, 'scripts', s));
  }
  chmodSync(join(raiz, 'scripts', 'qa-tester-run.sh'), 0o755);

  mkdirSync(join(raiz, 'docs'), { recursive: true });
  writeFileSync(join(raiz, 'docs', 'testing.md'), bateria);

  mkdirSync(join(raiz, 'test', 'nucleo'), { recursive: true });
  mkdirSync(join(raiz, 'test', 'app'), { recursive: true });
  if (conReports) mkdirSync(join(raiz, 'test', 'reports'), { recursive: true });

  if (pruebas === 'pasa') writeFileSync(join(raiz, 'test', 'nucleo', 'ejemplo.test.mjs'), PRUEBA_QUE_PASA);
  if (pruebas === 'falla') writeFileSync(join(raiz, 'test', 'nucleo', 'ejemplo.test.mjs'), PRUEBA_QUE_FALLA);

  for (let i = 0; i < flujos; i++) {
    writeFileSync(join(raiz, 'test', 'app', `flujo-${i}.yaml`), 'appId: com.walkingadventure.app\n');
  }

  if (nucleoRoto) {
    mkdirSync(join(raiz, 'packages', 'nucleo'), { recursive: true });
    writeFileSync(join(raiz, 'packages', 'nucleo', 'mundo.mjs'), "import 'react-native';\n\nexport const nada = 1;\n");
  }

  if (mapa !== null) {
    writeFileSync(join(raiz, 'test', 'spec-test-map.json'), typeof mapa === 'string' ? mapa : JSON.stringify(mapa, null, 2));
  }

  if (conGit) spawnSync('git', ['init', '-q'], { cwd: raiz, encoding: 'utf8' });

  return {
    raiz,

    /** Ejecuta el runner y devuelve código, salidas y el report si lo escribió. */
    corre(args = ['SPEC-001'], extra = {}) {
      const r = spawnSync('bash', [join(raiz, 'scripts', 'qa-tester-run.sh'), ...args], {
        cwd: raiz,
        encoding: 'utf8',
        ...extra,
      });
      const stdout = r.stdout ?? '';
      const reportRel = stdout.trim();
      const rutaReport = reportRel ? join(raiz, reportRel) : null;
      return {
        codigo: r.status,
        stdout,
        stderr: r.stderr ?? '',
        reportRel,
        report: rutaReport && existsSync(rutaReport) ? readFileSync(rutaReport, 'utf8') : null,
      };
    },

    /** Los reports escritos, por nombre. */
    reports() {
      const dir = join(raiz, 'test', 'reports');
      return existsSync(dir) ? readdirSync(dir).sort() : [];
    },

    escribe(rel, contenido) {
      const destino = join(raiz, rel);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, contenido);
      return destino;
    },

    borra() {
      rmSync(raiz, { recursive: true, force: true });
    },
  };
}

/**
 * Deja un report comparable con otro del mismo árbol: fuera el sello de tiempo y
 * fuera las duraciones, que es exactamente lo que el criterio permite que cambie.
 */
export function sinSelloNiDuraciones(texto) {
  return texto
    .replace(/\d{8}T\d{6}Z/g, '<SELLO>')
    .replace(/duration_ms[:\s]+[\d.]+/g, 'duration_ms <DURACION>');
}
