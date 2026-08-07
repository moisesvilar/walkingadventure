# Qué se dobla y qué no

Sustituye a la estrategia de mocking del pipeline original, que doblaba el cliente de Supabase. Aquí no hay Supabase, y lo que hay que doblar es otra cosa: **todo lo que entra al núcleo, porque el núcleo no llama a nada por su cuenta.**

Esa es la propiedad que hace fácil este apartado. `buildWorld` recibe `fetchData` inyectado, y el resto de la entrada y salida sigue el mismo patrón. Doblar no es interceptar: es pasar otro argumento.

## Los cinco dobles

**1 · Datos de OSM congelados.** En `test/fixtures/osm/`, cuatro mundos que cubren los casos que el diseño distingue: costero, urbano denso, barrio de tres calles y el suelo de 250 m. Se capturan una vez y no se regeneran: si cambian, dejan de ser fixtures. Cualquier prueba de generación los usa.

**2 · GPS simulado.** Recorre una polilínea a la velocidad del tramo declarado, sin saltos, y sabe hacer tres cosas que el diseño necesita distinguir: **pararse** un rato (que no cuenta para medir el ritmo), moverse a **velocidad de vehículo** (que se aparta del reloj del mundo) y moverse a una **velocidad ambigua** (que en la duda cuenta).

**3 · Reloj de mundo.** Es distinto del reloj del sistema y no se dobla con timers falsos: el motor de pasos avanza por kilómetros, así que la prueba pide «avanza siete pasos» y ya. Nunca uses el reloj real para nada de esto — el mundo no depende del calendario a propósito.

**4 · Doble del proxy**, con tres modos, y los tres hacen falta:
- **responde**: devuelve textos e imágenes fijos, para probar el camino con LLM.
- **falla siempre**: para probar que una salida entera funciona sin red y que todo cae a plantilla.
- **responde mal**: campos desconocidos, contenido no apto, nombres que chocan con el índice. Es lo que verifica que el modelo no escribe datos vivos y que lo que llega fuera del esquema se descarta.

**5 · Inspector de tráfico saliente.** No es un mock, es un observador, y es la única manera de afirmar «esto no sale del móvil» en lugar de suponerlo. Registra cada petición con su destino y su cuerpo, y las pruebas de privacidad afirman sobre ese registro. Sin él, los escenarios `@privacidad` son fe.

## Lo que no se dobla nunca

**El RNG.** Es determinista por construcción y doblarlo sería probar otra cosa. Si una prueba necesita un resultado concreto, se busca la semilla que lo produce y se escribe en el fixture, no se falsea el azar.

**La serialización de la partida.** Las pruebas de persistencia guardan y cargan de verdad, en memoria o en un directorio temporal. Un doble ahí escondería justo el bug que se busca.

**El casting.** Si una prueba necesita un mundo donde no castee cierta plantilla, se usa el fixture que lo produce —para eso está el del barrio de tres calles—, no un casting falso.

## La regla de fondo

**Dobla la frontera, nunca el interior.** Todo lo que el núcleo recibe inyectado es doblable; todo lo que el núcleo calcula, no. Cuando te apetezca doblar algo que está dentro, casi siempre significa que hace falta un fixture distinto.
