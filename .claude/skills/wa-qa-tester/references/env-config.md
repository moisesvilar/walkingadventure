# Entorno de ejecución

Sustituye a la configuración de entorno del pipeline original, que cargaba credenciales de Supabase desde `.env.local`. **Aquí no hace falta ninguna credencial para ejecutar las pruebas, y eso es una propiedad del diseño, no una casualidad.**

## Qué hace falta

| Nivel | Requisito | Si falta |
| --- | --- | --- |
| `@nucleo` | Node 20 o superior | no se puede ejecutar nada; es fallo duro |
| `@app` | Maestro instalado y un simulador arrancado | se registra como aviso de infraestructura y se sigue |
| `@red` | nada: el doble del proxy vive en el repo | — |

La distinción del `@app` importa: **que Maestro no esté no es un test en rojo**, es infraestructura ausente. El report lo separa a propósito para que quien orquesta el bucle no lo lea como un defecto del código.

## Lo que nunca se necesita

- **Ninguna clave de API.** Las pruebas no llaman al LLM, ni a Places, ni a imágenes: usan el doble del proxy.
- **Ningún `.env`.** Si una prueba necesita una variable de entorno para pasar, la prueba está mal.
- **Ninguna red.** Todas las pruebas corren sin conexión, y varias verifican precisamente eso.
- **Ningún Overpass.** Los datos de OSM salen de fixtures congelados en `test/fixtures/osm/`.

Si en algún momento una prueba necesita red o una credencial, no lo resuelvas: repórtalo. Significa que algo se ha colado por la frontera de inyección del núcleo, y eso es un defecto de código, no un problema de entorno.
