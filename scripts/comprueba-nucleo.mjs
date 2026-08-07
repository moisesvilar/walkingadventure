// Comprueba la regla dura de la que cuelga el proyecto: packages/nucleo/ no
// importa nada de React Native ni de Expo, y por tanto sigue corriendo en Node.
//
// Va antes que cualquier prueba en el report porque si esto se rompe, todo lo
// demás miente: el núcleo deja de ser ejecutable fuera del dispositivo y las
// pruebas de determinismo dejan de existir.
//
//   node scripts/comprueba-nucleo.mjs
//
// Sale 0 si la frontera está intacta (o si el paquete todavía no existe, que es
// el caso hasta SPEC-002), 1 si hay regresión y 2 si no llegó a comprobarla. El 2
// importa más aquí que en ningún otro sitio: este código decide el veredicto del
// runner, así que «no comprobé» no puede parecerse a «está intacta».
//
// Escribe siempre una línea `VEREDICTO: <estado> — <mensaje>` antes de terminar:
// es lo que el runner busca para dar por buena la comprobación.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { esPrincipal } from './guardian-principal.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const NUCLEO = join(RAIZ, 'packages', 'nucleo');

const PROHIBIDOS = /^(react-native|expo|@react-native|@expo|react-native-.*|expo-.*)$/;

function modulos(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...modulos(p));
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

export async function compruebaNucleo() {
  if (!existsSync(NUCLEO)) {
    return { estado: 'sin-paquete', hallazgos: [], mensaje: 'packages/nucleo/ todavía no existe: nada que comprobar (lo entrega SPEC-002).' };
  }

  const hallazgos = [];
  const ficheros = modulos(NUCLEO);

  // Dos comprobaciones, porque cada una caza lo que la otra deja pasar: la
  // estática ve el import aunque el módulo nunca llegue a cargarse, y la dinámica
  // ve la carga que falla por una dependencia transitiva.
  for (const f of ficheros) {
    const rel = relative(RAIZ, f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g)) {
      if (PROHIBIDOS.test(m[1])) hallazgos.push(`${rel}: importa "${m[1]}", que es de React Native o Expo`);
    }
    for (const m of readFileSync(f, 'utf8').matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (PROHIBIDOS.test(m[1])) hallazgos.push(`${rel}: importa dinámicamente "${m[1]}", que es de React Native o Expo`);
    }
  }

  for (const f of ficheros) {
    const rel = relative(RAIZ, f);
    try {
      await import(pathToFileURL(f).href);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      const culpaDePlataforma = /react-native|expo/i.test(msg);
      hallazgos.push(
        `${rel}: no se puede importar en Node${culpaDePlataforma ? ' y el error menciona React Native o Expo' : ''} → ${msg}`,
      );
    }
  }

  return {
    estado: hallazgos.length ? 'regresion' : 'intacta',
    hallazgos,
    mensaje: hallazgos.length
      ? `regresión de núcleo: ${hallazgos.length} hallazgo(s) en ${ficheros.length} módulo(s)`
      : `frontera intacta: ${ficheros.length} módulo(s) de packages/nucleo/ importan en Node sin React Native ni Expo`,
  };
}

// Guardián por rutas canónicas (ver scripts/guardian-principal.mjs): comparando
// las cadenas a secas, una invocación a través de un enlace simbólico dejaba este
// bloque sin ejecutar y una regresión de la frontera pasaba sin dejar rastro.
if (esPrincipal(import.meta.url)) {
  let r;
  try {
    r = await compruebaNucleo();
  } catch (e) {
    r = { estado: 'no-comprobada', hallazgos: [], mensaje: `no se pudo comprobar la frontera: ${e && e.message ? e.message : String(e)}` };
  }
  console.log(`VEREDICTO: ${r.estado} — ${r.mensaje}`);
  for (const h of r.hallazgos) console.log(`- ${h}`);
  process.exitCode = { intacta: 0, 'sin-paquete': 0, regresion: 1 }[r.estado] ?? 2;
}
