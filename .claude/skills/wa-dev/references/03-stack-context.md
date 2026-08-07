# El stack de Walking Adventure

Sustituye al contexto de stack web del pipeline original. Este proyecto no es una aplicación web: no hay Vite, ni React DOM, ni Tailwind, ni shadcn/ui, ni Supabase, ni router de navegador. Si una instrucción heredada menciona alguna de esas cosas, está desactualizada y manda este documento.

Decisión de origen: `game-design/arquitectura.md`, que es cerrada y no se discute al implementar.

## Las dos mitades, y la frontera entre ellas

```
packages/nucleo/     JavaScript ESM puro. Corre en Node y en la app.
app/                 React Native con Expo. Solo aquí viven pantallas, GPS, háptico y Skia.
server/              El proxy ciego: claves, atestación, caché. Nada del jugador.
```

**La regla dura de la que cuelga el proyecto: `packages/nucleo/` no puede importar nada de React Native.** Si lo hace, deja de correr en Node y se pierden las pruebas de determinismo, que son la red de seguridad más importante del repo. Esto no es preferencia de estilo: es lo que hace que la elección de React Native valga la pena (`arquitectura.md` §1).

Corolario práctico: **toda la entrada y salida se inyecta**, nunca se llama desde dentro del núcleo. El prototipo ya trazó esa línea aunque fuera por otro motivo — `buildWorld` recibe `fetchData` inyectado en lugar de llamar a la red por su cuenta.

Qué va en cada sitio:

| En `packages/nucleo/` | En `app/` |
| --- | --- |
| RNG determinista, geometría | Pantallas y navegación |
| Generación del mundo: rejilla, cupos, núcleos, parajes, rutas | Dibujo con Skia |
| Paquetes de idioma | GPS, geofences, háptico, notificaciones |
| Plantillas y casting de quests | Servicio en primer plano y Actividad en Vivo |
| Motor de pasos, propagación de rumores | Salud (pasos de fondo), respaldo del sistema |
| Estado de partida y serialización | Llamadas al proxy |

## Determinismo, que condiciona cómo se escribe el código

Dentro de `packages/nucleo/`, en todo lo que participe en la generación:

- **Nunca** `Math.random()`, `Date.now()` ni `new Date()`. Siempre `makeRng(seed + ':sufijo')`, con un sufijo distinto por fase para que tocar una fase no desplace el azar de las demás.
- **Nunca** iteración sobre `Set`/`Map` cuyo orden de inserción no controles. Ordena explícitamente antes de recorrer.
- El reloj del mundo son los kilómetros del jugador, no el calendario: un paso se siembra con su número, `makeRng(seed + ':tick:' + n)`.

Si necesitas tiempo o azar de verdad —una animación, un identificador de sesión— eso vive en `app/`, nunca en el núcleo.

## Sin toolchain de más

El repo llega sin `package.json` y eso ha sido deliberado. Al implementar entra el mínimo:

- **`packages/nucleo/`**: JavaScript ESM puro sobre Node nativo. **Cero dependencias de runtime.** Las pruebas van con `node --test`, que viene en Node.
- **`app/`**: Expo, con lo que Expo trae. No añadas librerías que la spec no mencione; si crees que hace falta una, dilo en el resumen y no la metas.
- **Sin TypeScript en `packages/nucleo/`**: JavaScript con JSDoc donde ayude. Es lo que mantiene el núcleo ejecutable en Node sin paso de compilación, que es justamente lo que lo hace testeable.

## El render

El mapa se dibuja con **Skia**, que da el mismo canvas 2D que el prototipo usa hoy. Los cinco estilos de pintado son **objetos de datos** fusionados sobre unos valores por defecto, y esa forma se conserva: `map.js` no contiene ni un color ni un grosor propios, todo sale del estilo. Añadir un estilo es añadir un objeto.

Dos cosas que el render debe cumplir y que no son opcionales:

- **Cambiar de estilo repinta y jamás resiembra.** El mundo que hay en pantalla es el mismo antes y después.
- **Ningún rótulo se solapa con otro.** Hace falta un algoritmo que calcule posición y tamaño de todos los rótulos antes de pintar. Es la deuda de render más antigua del proyecto y con los núcleos sobre placa opaca canta a la primera.

## El proxy

`server/` guarda las claves de LLM, imágenes y Places y reenvía. Lo que **no** hace, y es la mitad del diseño: no registra quién llama, ni desde dónde, ni guarda partidas. Comprueba con App Attest y Play Integrity que la llamada viene de una instalación legítima, que verifica la app **sin identificar a la persona**. Cachea solo lo inerte: imágenes por su prompt de ficción y fotos de Places por sitio.

**Nunca** añadas un identificador por instalación, ni siquiera anónimo, ni siquiera "para depurar": se descartó a propósito porque es un identificador persistente con el que se puede correlacionar todo lo que ha pedido un móvil.

## Lo que nunca se hace en este proyecto

- Meter datos del jugador en una llamada de red. Del móvil salen las coordenadas al generar un mapa, una vez, y prompts de ficción sin ningún dato real.
- Guardar un rastro de ubicación. No se guarda nunca, ni en la partida ni en el respaldo.
- Regenerar un mundo ya generado. Crecer es generar otra celda.
- Pedir el permiso de ubicación permanente. Es «mientras se usa», sostenido por el servicio en primer plano.
- Enseñar al jugador kilómetros, ritmo, pasos, calorías o porcentajes de progreso. El oro sí es un número y sí se enseña.
