# Los dos niveles de prueba

Sustituye al framework de pruebas web del pipeline original. Aquí no hay Vitest, ni Testing Library de React DOM, ni Playwright, ni dev server que levantar.

**La clasificación ya existe y no se inventa.** `docs/testing.md` etiqueta cada característica con dónde puede correr, y esas etiquetas son las nuestras. Antes de escribir una prueba, busca el escenario: **de 33 características, 18 son `@nucleo`**, así que el grueso del trabajo no necesita dispositivo.

| Nivel | Runner | Dónde | Qué verifica |
| --- | --- | --- | --- |
| `@nucleo` | `node --test` | `test/nucleo/<area>.test.mjs` | generación, determinismo, casting, motor de pasos, rumores, estado de partida |
| `@app` | Maestro | `test/app/<flujo>.yaml` | pantallas, avisos, geofences, el bucle de una salida |
| `@red` | `node --test` con el doble del proxy | `test/nucleo/<area>.test.mjs` | qué sale del móvil y qué no |
| `@manual` | una persona | `docs/testing.md` | tono, prosa, si el chiste funciona |

## `@nucleo`: Node y nada más

Cero dependencias, a propósito: es lo que mantiene el paquete compartido ejecutable sin paso de compilación, que es justamente lo que lo hace testeable. Se usa `node:test` y `node:assert/strict`.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../../packages/nucleo/world/build.js';
import { mundoCongelado } from '../fixtures/osm/index.mjs';

test('Dos generaciones con la misma semilla dan el mismo mundo', async () => {
  const datos = mundoCongelado('costero');
  const a = await buildWorld({ seed: '42.40,-8.81#1', fetchData: () => datos });
  const b = await buildWorld({ seed: '42.40,-8.81#1', fetchData: () => datos });
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
});
```

Tres reglas que no son negociables aquí:

- **El nombre del test es el nombre del escenario de `docs/testing.md`, literal.** Es lo que permite cruzar batería e implementación con un grep y lo que da de comer al análisis de fallos. Si escribes una prueba que no corresponde a ningún escenario, dilo en el resumen: o falta el escenario o sobra la prueba.
- **Nada de red, nada de reloj real, nada de azar.** Los datos de OSM salen de fixtures congelados; el tiempo del mundo se avanza a mano; el azar viene de la semilla.
- **Comparar mundos se hace por serialización completa**, no campo a campo. Es lo único que afirma «idéntico byte a byte» de verdad.

## `@app`: Maestro sobre el simulador

Flujos en YAML sobre la app real. Se eligió por encajar con lo que hay que probar: pantallas que casi no tienen controles y un bucle que va de andar, no de rellenar formularios.

```yaml
appId: com.walkingadventure.app
---
- launchApp:
    clearState: true
- setLocation: { latitude: 42.4012, longitude: -8.8114 }
- assertVisible: { id: "momento-en-marcha" }
- assertNotVisible: { id: "control-tocable" }
```

- **Los localizadores salen de la sección `data-testid` de la spec.** Si necesitas uno que no está y tampoco hay texto visible estable al que agarrarse, es un hueco de la spec: repórtalo y no inventes un selector frágil.
- **El GPS se simula con `setLocation`**, encadenando puntos para recorrer una calzada. Para las pruebas de vehículo, el mismo mecanismo con saltos mayores entre puntos.
- **El reloj del mundo no se simula andando**: se avanza por el gancho de pruebas que expone la app, porque hacer diez pasos del mundo caminando de verdad en un simulador es minutos de test para nada.

## Lo que no se prueba con estos runners

- **La prosa que escribe el LLM.** Se prueba que la estructura es idéntica con y sin él, que un texto no apto cae al fallback y que el prompt no lleva datos reales. Que el texto tenga gracia es `@manual`.
- **Que un mundo sea bonito.** Lo que sí es comprobable es que ningún rótulo se solapa con otro, y esa prueba hay que escribirla.

## El mapa de cobertura

`test/spec-test-map.json`, validado contra `test/spec-test-map.schema.json`. Una entrada por criterio de aceptación, con el nivel, el fichero y el nombre del caso. Cuando un AC se verifica con un escenario que ya existía en `docs/testing.md`, se cita su nombre: es la manera de ver de un vistazo qué parte de la batería escrita antes de implementar ya está viva.
