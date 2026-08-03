Quiero crear una aplicación / juego que funcione de la siguiente manera.

El usuario se crea una cuenta (ya veremos cómo) y configura un personaje en un mundo de fantasía que puede ser de tres clases diferentes (por el momento)
- Un guerrero, bueno en el cuerpo a cuerpo
- Un mago, bueno en el lanzamiento de hechizos y conjuros
- Un pícaro, bueno en el subterfugio, sigilo y ataques a distancia

Entonces la aplicación lee la ubicación actual del usuario y le pregunta si quiere generar su mundo en la ubicación actual o en otra diferente. Si es la segunda, podrá desplazar un puntero por un mapa empezando desde su posición y cuando esté conforme, fijar la posición nueva de generación pulsando un botón.

Al finalizar, la aplicación generará un mapa a partir del mapa del mundo real centrado en la posición seleccionada por el usuario con un radio de 20km. Mantendrá los elementos principales geográficos del mapa:
- Líneas de costa
- Ríos
- Lagos
- Montañas
- ...

Después obtendrá los emplazamientos principales dentro de dicha área:
- Iglesias
- Monumentos
- Miradores
- Parques
- ...

Después cogerá los locales principales que sean aptos para menores (muy importante esto)
- Centros comerciales
- Cafeterías
- Restaurantes
- ...

En función de estos elementos geográficos, emplazamientos y locales, generará diferentes "núcleos de población" ficticios y fantásticos, que serán de cuatro tipos (de menor a mayor tamaño):
- granjas (15-10 como máximo)
- aldeas (10-15 como máximo)
- pueblos (5-10 como máximo)
- ciudades (1 como máximo)

Dentro de cada uno emplazarás diferentes puntos de interés, en función del tipo del núcleo de población:
- posadas (donde se permite descansar y pasar la noche)
- tabernas (donde se puede hablar con aldeanos y obtener trabajos)
- boticarios (donde se permite comprar plantas para recuperar salud y curar enfermedades)
- armerías y herreros (donde se permite comprar armas y armaduras)
- conjurerías (donde se permite comprar libros y pergaminos mágicos)
- ...

[WORK IN PROGRESS]