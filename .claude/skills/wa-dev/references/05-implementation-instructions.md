# Cómo se implementa aquí

## Antes de escribir

Lee la spec entera. Después sitúa cada criterio de aceptación en un lado de la frontera: `packages/nucleo/` (lógica, determinista, sin plataforma) o `app/` (pantallas, sensores, dibujo). Si un criterio no cae limpio en ninguno de los dos, casi siempre es que hay que inyectar algo.

## Estructura

```
packages/nucleo/
  core/       rng, geometría
  world/      rejilla, generación, rutas, parajes
  names/      paquetes de idioma, con interfaz común
  quests/     plantillas y casting
  partida/    estado, motor de pasos, rumores, serialización
app/
  pantallas/
  render/     Skia, y los estilos como objetos de datos
  plataforma/ GPS, háptico, notificaciones, salud, respaldo
server/       el proxy ciego
```

Módulos ESM con extensión explícita en los imports. Funciones exportadas nombradas, nada de `export default`. Dos espacios, comillas simples, punto y coma.

**Cada módulo abre con un comentario de una a tres líneas** que dice qué hace y por qué existe. No es opcional: es la convención más visible del repo.

## Determinismo, en la práctica

- Todo azar sale de `makeRng(seed + ':sufijo')`, **con un sufijo distinto por fase**. Añadir una fase no puede desplazar el azar de las demás.
- Nada de `Math.random()`, `Date.now()` ni `new Date()` dentro del núcleo.
- Nada de recorrer un `Set` o un `Map` cuyo orden de inserción no controles: ordena explícitamente antes.
- El contenido de un paso del mundo lo decide su número: `makeRng(seed + ':tick:' + n)`.

Si dudas de si algo rompe el determinismo, la prueba es barata: genera dos veces y compara la serialización completa.

## Inyección

El núcleo no llama a nada por su cuenta. `buildWorld` recibe `fetchData`; todo lo demás sigue el mismo patrón. Cuando implementes algo que necesite red, reloj, sensores o almacenamiento, el parámetro entra por la firma.

Esto no es purismo: es lo que hace que las pruebas de `@nucleo` corran en Node sin dispositivo, y son 18 de las 33 características de la batería.

## Validación antes de commitear

1. `node --test test/nucleo/` si ya hay pruebas.
2. `node test/headless.mjs` mientras exista, que es la red de seguridad del determinismo.
3. `node scripts/verifica-flujo.mjs` y `node scripts/verifica-gherkin.mjs` si has tocado `docs/`.
4. Que la app arranca, si has tocado `app/`.

**Tres fallos seguidos y paras**, devolviendo el error literal sin commitear.

## Commit

Una rama por spec: `pipeline/SPEC-NNN-<slug>`. Conventional Commits con el ID en el ámbito: `feat(SPEC-003): rejilla de celdas anclada a coordenada redondeada`. El estado del pipeline no vive aquí.

## Trampas de este repo que te van a morder

**`.gitignore` con rutas sin anclar.** La regla `data/` se tragó `app/js/data/overpass.js` y la app estuvo rota sin que ningún test lo detectara. Al añadir una regla, ánclala; y si creas un directorio nuevo, comprueba con `git check-ignore` que no lo está tragando nada.

**Un test verde no significa app viva.** Las pruebas del núcleo no tocan la capa de datos ni el render. Si has tocado una de esas dos, no te fíes del verde.

**El callejero de OSM llega troceado.** En un mundo real medido salieron 109 componentes conexas. Antes de mover un núcleo porque «no tiene carretera», comprueba si el problema es el dato.

**Los anclajes se eligen por reconocimiento, no por abundancia.** Un tag masivo inunda el pool y mata la diversidad de escenas. Precedente medido: `amenity=drinking_water` está excluido a propósito.
