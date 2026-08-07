# El lenguaje del juego (5-ago-2026)

Cómo escribe este juego, y por tanto cómo tienen que escribir las plantillas, los nombres, los NPCs y el LLM. Vale para todo texto que llegue al jugador.

**La decisión de fondo: el lenguaje es inclusivo, y donde el castellano obliga a elegir sin motivo, el sesgo va hacia el femenino.** No es una capa de corrección aplicada al final: es cómo se escribe desde el principio, igual que el tono cómico-cálido de `bucle-jugable.md` §6.

Va junto a una restricción que ya estaba tomada y que condiciona el cómo: **los textos se escriben para leerse en voz alta** (`personaje.md` §4). Cualquier solución que suene rara dicha a otra persona mientras camináis no sirve, por correcta que parezca escrita.

## Qué significa en concreto

### El personaje

**Femenino por defecto.** El género gramatical se pregunta en la creación (`personaje.md` §1) y llega con el femenino ya puesto. Quien quiera otra cosa lo cambia en un toque; quien no toque nada juega en femenino. Es la aplicación más literal de la regla: en la duda, femenino.

### Los NPCs

- **Reparto equilibrado por generación, no por casualidad.** La generación perezosa de `npcs.md` §1 asigna género con la semilla, y el reparto se equilibra a propósito en lugar de dejarlo al azar puro.
- **El oficio no arrastra el estereotipo.** La herrera, la vigía, la tabernera, la cantera. Romperlo es la norma y no el guiño: un mundo donde la única mujer con oficio es la posadera está peor escrito, no más verosímil.
- **Y el retrato sigue siendo libre.** Esto es sesgo en el reparto y en la duda, nunca censura del personaje: en un mundo cómico-cálido cabe perfectamente un tabernero gruñón y una vigía insoportable. Lo que no cabe es que el gruñón sea siempre él.

### Los textos

- **Nada de masculino genérico donde se pueda evitar sin retorcer el idioma.** Y se puede casi siempre, con colectivos y reformulaciones: *quien camina*, *la gente de aquí*, *el vecindario*, *quien llegue*, *cualquiera*. Casi todas leen mejor que el masculino que sustituyen.
- **Desdoblar es el último recurso.** "Los vecinos y las vecinas" en cada frase es ilegible en voz alta, y este juego se lee en voz alta. Antes de desdoblar, reformular.
- **Nada de -e ni de -x.** Choca de frente con leerse en voz alta y con el registro del mundo. La inclusión aquí se consigue reescribiendo, no inventando morfología.
- **La voz que narra el mundo no tiene género visible**, porque no hace falta que lo tenga.

### Los textos no saben cuántos hay

**Ningún texto puede depender de un número que solo existe en la maqueta.** Cada mundo tiene los núcleos, las calzadas y los parajes que le tocan, así que cualquier frase con una cantidad dentro está o **calculada en tiempo de ejecución** o **escrita para que valga en cualquier mundo**. No hay tercera opción, y la que falla siempre es la tercera: escribir el copy mirando el mockup.

El caso que lo destapó: en las pantallas del arranque, un texto decía «hoy solo son dos nombres en un mapa» porque la maqueta dibujaba dos pueblos. En un mundo de paseo real son trece —siete núcleos y seis calzadas, que nacen sabidos por ser la infraestructura de navegación—, y contarlos de verdad tampoco arreglaba la frase, porque «trece» ya no dice lo que quería decir. Se quitó el número: *hoy son solo nombres en un mapa*.

Regla práctica al escribir: si una frase se puede desmentir generando otro mundo, hay que reescribirla. Lo mismo vale para las distancias y los tiempos, que además tienen su propia norma — el juego no enseña números de distancia (`bucle-jugable.md` §3).

### Los dos registros

**El onboarding habla como aplicación; el juego habla como mundo.** Hasta que sales a andar por primera vez, el texto explica qué hace la app y por qué, en primera persona del plural y sin disfraz: «necesitamos tu ubicación para generar el mapa», «este es el nivel de dificultad». A partir de ahí, la aplicación desaparece y solo habla el mundo.

La frontera es el botón de «salir a andar» de la última pantalla del onboarding, y conviene que sea nítida: mezclar los dos registros es lo que hace que un juego suene a formulario o que un ajuste suene a acertijo. Dentro del juego, cualquier cosa que solo se pueda decir como aplicación —un error de red, un permiso revocado— es señal de que hay que rediseñar el momento, no de que haya que cambiar de voz.

**Con una excepción, y solo una: los ajustes** (6-ago-2026). Ahí se vuelve a hablar como aplicación, y se nota hasta en la tipografía, porque un ajuste disfrazado de acertijo es peor que un ajuste. Que sea la única excepción es lo que la hace sostenible: entrar en ajustes es salir un momento del mundo, y por eso están apartados y no repartidos por las pantallas del juego. La prueba de que la frontera sigue en pie es que ningún ajuste asoma en el bucle — el tamaño de letra de la escena (`personaje.md` §4) es el caso límite y se cuela sin etiqueta ni palabra de aplicación.

### Los nombres

`app/js/names/` produce los nombres propios y pasa a necesitar **repertorio femenino y masculino equilibrado** en cada paquete de idioma, con las sugerencias de la creación de personaje mostrando femenino primero.

## Cómo se comprueba

- **En las plantillas y los textos de fallback**: se escribe así desde el principio, y es criterio de revisión del catálogo igual que el tono.
- **En el LLM**: estas reglas entran en el prompt junto al tono y a la restricción de no usar datos reales (`seguridad-privacidad.md` §1). Y el filtro de aptitud que ya existe comprueba lo comprobable — el masculino genérico en fórmulas frecuentes se detecta con una lista, aunque no todo se puede automatizar.
- **En el reparto de NPCs**: se puede medir. Un informe sobre mundos generados, como el de casting, diría si el equilibrio se cumple o si algún oficio se está poblando siempre igual.

## Pendientes

1. **Qué hacer con las lenguas que vengan.** El paquete gallego tiene el mismo problema y la misma solución; otras lenguas pueden no tenerlo o tenerlo distinto.
2. **La lista del filtro de aptitud** para masculino genérico: qué fórmulas entran y cuáles son falsos positivos.
3. **Si el equilibrio de reparto se mide por mundo o por partida.** Por mundo es más fácil de comprobar; por partida es lo que el jugador percibe, porque conoce a la gente poco a poco.
