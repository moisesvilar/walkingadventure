# El sistema de diseño de Walking Adventure

Sustituye al sistema de diseño web del pipeline original. Aquí no hay shadcn/ui, ni Tailwind, ni componentes de navegador. Toda decisión de UX de una spec se respalda en este documento y en los seis artefactos de `docs/pantallas/`.

**Antes de escribir la sección UX Design de una spec, mira si la pantalla ya está dibujada.** Cuarenta lo están, con notas que citan la decisión de la que sale cada elemento. El índice es `docs/pantallas.md` y el encadenado, `docs/flujo.md`. Una spec que rediseña una pantalla ya dibujada está inventándose una decisión.

## Los dos registros, que es la regla que más se rompe

**El onboarding habla como aplicación; el juego habla como mundo.** La frontera es el botón de «salir a andar» de la última pantalla del onboarding, y conviene que sea nítida: mezclarlos es lo que hace que un juego suene a formulario.

Dentro del juego, **cualquier cosa que solo se pueda decir como aplicación —un error de red, un permiso revocado— es señal de que hay que rediseñar el momento**, no de cambiar de voz. Con una única excepción: los **ajustes**, que hablan como aplicación y se nota hasta en la tipografía, porque un ajuste disfrazado de acertijo es peor que un ajuste.

Fuente: `game-design/lenguaje.md`.

## La paleta

Sale del estilo `reino` del render y no se inventa:

| Token | Valor | Uso |
| --- | --- | --- |
| tierra | `#7fae5a` | la tierra del mapa |
| mar | `#3f7fa8` | el agua |
| tinta | `#1e2b18` | texto y trazo |
| marca | `#c62828` | tu posición, los puntos de interés, lo destructivo |
| placa | `#efe3c0` | el papel y las cajas de rótulo |
| filete | `#8a6d34` | filetes, bordes de cartela, acentos |

**Tipografía**: una serif para la voz del mundo, una sans para la voz de la aplicación. Esa distinción no es decorativa: es cómo se ven los dos registros.

## Qué NO lleva ninguna pantalla

Esto es lo que más veces habrá que defender, así que va en lista. Nada de esto entra en una spec, y si una spec lo pide, la spec está mal:

- **Ninguna cifra de distancia, tiempo, ritmo, pasos, calorías ni porcentaje de progreso.** Convierten el juego en una app de deporte. El oro sí es un número y sí se enseña, porque es una moneda que se gasta.
- **Ningún panel del estado del mundo.** Lo que pasa ahí fuera se oye llegando a los sitios.
- **Ningún medidor de reputación.** El rango se nota en cómo te hablan y en los motes.
- **Ningún nivel de deformación de un rumor.** Es dato vivo interno y no sale a pantalla en ningún sitio.
- **Ninguna racha ni logro.** Castigan la ausencia, que es justo lo que el reloj del mundo se diseñó para no hacer.
- **Ningún control tocable dentro de la app mientras se anda.** Lo único tocable en ese momento vive en la pantalla de bloqueo y es del sistema.

## Los momentos y lo que cada uno permite

| Momento | Pantalla | Qué cabe |
| --- | --- | --- |
| Antes de salir | permitida | elegir, leer, esperar. Es el único momento que pide atención |
| En marcha | prohibida | nada tocable. Avisos desde el bolsillo |
| Al parar | permitida | el visor, la escena, lo que allí se cuenta |
| El telón | permitida | el mapa entintado, el desenlace, el diario |
| De consulta | permitida | diario, repisa, ajustes. Cuelgan de la portada, sin barra de pestañas |

## Avisos

Regla que no admite excepción: **cada aviso viaja por dos capas, y el par mezcla una de bolsillo con una de pantalla.** Háptico y sonido fallan a la vez para la misma persona, así que duplicar así no es duplicar.

- **Noticias**: háptico más marca en el mapa. Sin notificación.
- **Oportunidades**: notificación más háptico. Es el único aviso que enciende la pantalla, y por eso está racionado.

Y **el aviso se lee de un vistazo o no se lee**: cabe en una línea, nombra el sitio, y nunca lleva un «toca para saber más». La prueba: si tocando se aprende algo que hacía falta, el aviso está mal escrito.

## Accesibilidad, que aquí no es una sección aparte

No es un modo: es la unidad de medida. El tramo es lo que cada persona anda en media hora y el juego entero se redimensiona con él. En una spec eso significa:

- **Nunca** una etiqueta, un icono ni una palabra que llame a esto «accesibilidad». En los ajustes se llama «caminos que evitar».
- **El filtro evita y declara**: el mundo entero existe y se dibuja; lo que cambia es por dónde te mandan, y el mapa lo dice con nombre propio y razón concreta.
- **El ajuste automático del tramo no se comenta jamás.** Ningún texto puede insinuar que hoy has andado menos.
- **Tamaño de letra ajustable a mano** donde haya texto largo, porque el modo compañía es dos personas leyendo en voz alta del mismo móvil.

## Escribir los textos

- Lenguaje inclusivo, con el sesgo hacia el femenino donde el castellano obliga a elegir sin motivo.
- Nada de masculino genérico evitable, nada de desdoblar en cada frase, nada de -e ni de -x: los textos se leen en voz alta.
- **Ningún texto puede depender de un número que solo existe en la maqueta.** O está calculado en tiempo de ejecución o está escrito para valer en cualquier mundo.
- Tono cómico-cálido: el mundo se toma en serio a sí mismo y el juego sabe que es un chiringuito. **El chiste nunca es a costa del sitio real ni de quien lo regenta**, siempre a costa del desajuste.

## `data-testid`

Toda spec con interfaz lleva su sección de `data-testid`, con un identificador por elemento que una prueba necesite alcanzar. Si `wa-qa-dev` necesita uno que no está y tampoco hay localizador semántico, es un hueco de la spec y se reporta: no se inventan selectores frágiles.

En este proyecto hay dos localizadores que conviene declarar siempre porque casi ninguna prueba se apaña sin ellos: **el estado del momento** (antes de salir / en marcha / al parar / telón) y **el mapa**, con lo que haya que distinguir en él.
