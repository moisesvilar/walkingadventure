// El catálogo de plantillas-arquetipo: treinta aventuras escritas a mano
// (`game-design/quests.md` §7, `personaje.md` §3).
//
// Una plantilla ya no es un texto. Son **roles que castean** contra el mundo
// concreto, un **lazo que cierra**, una **afinidad de oficio declarada**, textos de
// fallback dignos para cuando no hay red, un **desenlace de repuesto** para quien se
// vuelve a mitad, la **declaración de rumor** con su semilla de hechos
// estructurados, el **mote candidato**, lo que el desenlace entrega en oro y
// objetos, y **qué actos rompen y qué actos reparan una relación**.
//
// Lo que cada campo significa y por qué existe está en `catalogo.js`, que es quien
// lo comprueba entero al cargarse. Aquí van solo las decisiones que gobiernan cómo
// están escritas estas treinta:
//
//   · **Variar los roles, no solo la historia.** El cuello de botella medido no es
//     el catálogo, es el barrio: los fallos del informe dicen todos lo mismo, «sin
//     candidatos para un paraje con escena X». Un tercio largo del catálogo no pide
//     ningún paraje, y las que sí lo piden se apoyan sobre todo en las escenas que
//     un cruce o un puente sostienen —emboscada, encuentro, vigilancia, peaje—,
//     que son las únicas que existen en un mundo de tres calles sin un solo
//     servicio.
//   · **El local es la excepción, no la puerta de entrada.** Dos tercios de estas
//     treinta pedían un servicio y `barrio-tres-calles` no tiene ninguno, así que
//     el catálogo entero solo funcionaba donde había tiendas. El reequilibrio va
//     por dos caminos, los dos declarados aquí y ninguno bajando la exigencia:
//     **quien encarga pasa a ser gente y sitio** —una casa, una plaza, un taller,
//     una cara con puesto— en todas las que no necesitaban mostrador; y **los roles
//     de paraje con escena escasa declaran alternativa** —`['refugio',
//     'encuentro']`, `['saber', 'vigilancia']`, `['ritual', 'encuentro']`—, porque
//     donde no hay ermita se reza en el cruce y donde no hay cobertizo se para al
//     resguardo del puente. Quedan **cinco** que sí piden local, y entre ellas
//     cubren los seis servicios que el mundo sabe generar, para que ninguno se
//     coloque sin que nadie lo visite.
//   · **Dos núcleos seguidos no son un camino.** En un barrio pequeño los núcleos
//     están más lejos entre sí que un tramo y los parajes caen sobre el viario,
//     así que una cadena `núcleo → núcleo` no castea aunque los dos existan. Las
//     que van de una casa a otra pasan por el paraje de en medio, y de ahí que la
//     feria vuelva tres veces al cruce y el camino de la sal suba el alto cinco:
//     no es relleno, es lo que hace la aventura andable donde el mundo es escaso.
//   · **Cómico-cálido, y para leerse en voz alta** (`bucle-jugable.md` §6). El
//     chiste está en el desajuste entre la ficción y el sitio, nunca a costa del
//     sitio ni de quien lo regenta, y los personajes se toman en serio a sí mismos.
//   · **Inclusivo con sesgo al femenino** (`lenguaje.md`). Se reformula antes de
//     desdoblar, no hay morfología inventada, la voz que narra no tiene género y
//     nadie del reparto viene con el suyo escrito: el género de cada cara lo pone la
//     generación. Cuando el texto se dirige a quien juega, la forma que concuerda va
//     como **ranura** —`{forastera}`— y la resuelve el paquete de idioma.
//   · **Ningún número dentro de un texto.** Ni cifras del mundo, ni distancias, ni
//     esfuerzo. La cantidad de oro la pone el desenlace en ejecución y nunca está
//     escrita en la prosa.
//
// Las seis primeras vienen del prototipo y **conservan su identificador** —vive en
// partidas guardadas y en el informe— reescritas en cómico-cálido: el registro de
// cuento popular que traían era la deuda que `bucle-jugable.md` §6 dejó declarada.
//
// Y una última que se ve al final del fichero: **qué beats se dicen en voz de alguien no
// se escribe aquí, se deriva** (SPEC-051). Cada plantilla declara sus roles humanos y de
// qué momento cuelga cada acto de relación, y las dos cláusulas de `caras.js` deciden
// sobre qué beat cae cada cara. Elegirlas a mano habría sido una lista sin regla, y una
// lista sin regla es la pieza que al no estar no protesta. Los textos de esos beats sí
// están escritos aquí, y **como parlamento**: se pintan entrecomillados, así que la
// narración de lo que te pasa a ti se leería mal en boca de alguien.

import { conCaras } from './caras.js';

const ESCRITAS = [
  // --- las seis portadas del prototipo -------------------------------------
  {
    id: 'entrega-sospechosa',
    titulo: 'El paquete que no era nada',
    gancho: 'Un bulto envuelto en hule cambia de manos en la plaza. «Llévalo al cruce y déjalo donde te digan. No preguntes. Y si alguien te sale al paso, esto no salió de aquí».',
    tamano: 'paseo',
    oficios: ['taberna', 'forja', 'mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'paquete-entregado', escala: { veces: 1 }, detalle: { con: 'destinataria', motivo: 'encargo-de-la-plaza' } },
    },
    mote: 'la-que-no-preguntó',
    desenlace: {
      texto: 'Dentro había herraduras. Herraduras normales. Te pagan igual y juran que la discreción tenía sentido, y nadie se atreve a discutirlo.',
      oro: 12,
      objetos: [{ id: 'hule-del-paquete', clase: 'recuerdo', procedencia: { plantilla: 'entrega-sospechosa' } }],
    },
    repuesto: {
      sinTi: 'El paquete llegó al cruce por otras manos. Las herraduras ya cuelgan del clavo, y la historia se cuenta sin ti y con más misterio del que tuvo.',
      conLoConseguido: 'Te quedas con el hule vacío y con la sospecha. Bien mirado, es más de lo que tenía nadie al empezar.',
    },
    relacion: [
      { rol: 'origen', signo: 'feo', beat: 2, decision: 'vender-el-paquete-en-el-camino' },
      { rol: 'quien_encarga', signo: 'reparador', beat: 4, decision: 'contar-la-verdad-del-encargo' },
    ],
    revision: 'El desajuste está en la solemnidad del encargo contra lo que había dentro. Quien lo manda no queda en ridículo: queda cauta, y eso la respeta.',
    orden: ['origen', 'quien_encarga', 'riesgo', 'destino'],
    roles: {
      origen: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
      quien_encarga: { tipo: 'humano', en: 'origen', puesto: 'regencia' },
      riesgo: { tipo: 'paraje', escena: ['guarida', 'emboscada'] },
      destino: { tipo: 'paraje', escena: 'encuentro' },
    },
    beats: [
      { rol: 'origen', escena: 'encargo', texto: 'Recoges el bulto y las señas. Nadie te mira a la cara mientras lo haces, lo cual ayuda poco a la tranquilidad.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'paquete' } },
      { rol: 'riesgo', escena: 'guarida', texto: 'Alguien sale de la sombra y ofrece comprarlo sin saber qué es. Ese entusiasmo tan sin fundamento da que pensar.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      {
        rol: 'destino',
        escena: 'entrega',
        texto: 'Quien espera abre el hule, mira dentro y suelta una carcajada corta. Tú tardas un poco más en entenderlo.',
        disparador: {
          tipo: 'con_objeto',
          objeto: 'paquete',
          viaAlternativa: { texto: 'Llegas con las manos vacías. Quien esperaba ya lo sabía y te cuenta qué había dentro para que cargues con ello de otra manera.' },
        },
        resultado: { tipo: 'informacion' },
      },
      { rol: 'origen', escena: 'recompensa', texto: 'Aquí tienes tu paga. Y la explicación, que ya te aviso de que no explica nada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'cita-en-la-fuente',
    titulo: 'La cita donde susurra el agua',
    gancho: 'Una nota doblada bajo una puerta, con letra de quien escribe poco: «Ven donde susurra el agua cuando el sol se esconda. Ven {sola}».',
    tamano: 'paseo',
    oficios: ['taberna', 'mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'verdad-sacada-a-la-luz', escala: { veces: 1 }, detalle: { con: 'encapuchada', motivo: 'nota-bajo-la-puerta' } },
    },
    mote: 'la-de-la-nota',
    desenlace: {
      texto: 'La verdad resulta ser pequeña y muy antigua, y aun así cambia cómo se saluda cierta gente en la plaza. Las cosas pequeñas pesan cuando llevan tiempo calladas.',
      oro: 10,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La cita se deshizo con la luz. Quien escribió la nota se guardó lo suyo y siguió con su vida, que también era un plan.',
      conLoConseguido: 'Te vuelves con la nota en el bolsillo. Sigue sin decir gran cosa, pero ahora sabes de qué agua hablaba.',
    },
    relacion: [
      { rol: 'dador', signo: 'reparador', beat: 3, decision: 'guardar-el-nombre-que-falta' },
    ],
    revision: 'El humor está en el contraste entre el aparato de la cita secreta y lo menuda que resulta la verdad. Nadie queda en ridículo por ello.',
    orden: ['dador', 'cita', 'confidente'],
    roles: {
      dador: { tipo: 'nucleo', types: ['aldea', 'pueblo', 'ciudad', 'granja'] },
      cita: { tipo: 'paraje', escena: 'encuentro' },
      confidente: { tipo: 'paraje', escena: 'vigilancia' },
    },
    beats: [
      { rol: 'dador', escena: 'hallazgo', texto: 'Encuentras la nota, la relees por si acaso y decides ir. La curiosidad es más fuerte que la prudencia y lo sabes.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      {
        rol: 'cita',
        escena: 'encuentro',
        texto: 'La figura encapuchada dice en voz baja lo que aquí nadie dice en voz alta, y luego pregunta si te ha gustado el efecto.',
        disparador: {
          tipo: 'franja',
          franja: 'atardecer',
          variante: 'Llegas cuando la luz se va y la ves colocarse la capucha a toda prisa, ensayando el momento.',
          // La variante de fuera cuenta **lo que pasó mientras tanto**, nunca lo que
          // quien juega dejó de hacer: llegar fuera de la franja resuelve el beat igual.
          varianteFuera: 'La capucha está doblada sobre el brocal, con una piedra encima para que el aire no se la lleve, y debajo hay otra nota con la misma letra.',
        },
        resultado: { tipo: 'informacion' },
      },
      { rol: 'confidente', escena: 'verificación', texto: 'Quien se pasa el día mirando el camino desde lo alto confirma la historia y añade el nombre que faltaba, sin darle importancia.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'dador', escena: 'decisión', texto: 'De vuelta bajo techo decides qué hacer con lo que ya sabes. Nadie te mete prisa: aquí se cena tarde.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'tres-pistas',
    titulo: 'El rastro que nadie quiso ver',
    gancho: 'Falta algo valioso y nadie vio nada, que es justo lo que se dice cuando alguien vio algo. Hay rastros repartidos por el mapa y ganas de que los sigas.',
    tamano: 'aventura',
    oficios: ['botica', 'taberna', 'mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'culpable-senalado', escala: { veces: 1 }, detalle: { con: 'culpable', motivo: 'robo-sin-testigos' } },
    },
    mote: 'la-que-ata-cabos',
    desenlace: {
      texto: 'Señalas a quien fue delante de quien haga falta. Resulta que casi nadie estaba sorprendido y casi nadie iba a decirlo, que es una manera de convivir.',
      oro: 24,
      objetos: [],
    },
    repuesto: {
      sinTi: 'El asunto se resolvió sin ti, mal y a gritos, y quedó una versión que no le sirve a nadie.',
      conLoConseguido: 'Vuelves con lo que ya sabes, que es más de lo que sabía nadie ayer. El resto puede esperar a otra salida.',
    },
    relacion: [
      { rol: 'origen', signo: 'reparador', beat: 6, decision: 'nombrar-a-quien-ayudo' },
      { rol: 'quien_pregunta', signo: 'feo', beat: 4, decision: 'contar-lo-del-ungüento-en-la-plaza' },
    ],
    revision: 'La gracia está en que el pueblo entero lo sabía y nadie quería ser quien lo dijera. El chiste es sobre la costumbre, no sobre el sitio.',
    orden: ['origen', 'quien_pregunta', 'pista1', 'pista2', 'resolucion'],
    roles: {
      origen: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
      quien_pregunta: { tipo: 'humano', en: 'origen', puesto: 'vecindad' },
      pista1: { tipo: 'paraje', escena: 'emboscada' },
      pista2: { tipo: 'paraje', escena: 'encuentro' },
      resolucion: { tipo: 'nucleo', types: ['ciudad', 'pueblo', 'aldea', 'granja'] },
    },
    beats: [
      { rol: 'origen', escena: 'encargo', texto: 'Te sueltan los rumores en desorden y con nombres cambiados, por si acaso.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pista1', escena: 'rastro', texto: 'En el mal paso hay huellas que no deberían estar ahí, y encima están muy bien hechas.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pista2', escena: 'testigo', texto: 'Alguien asustado te dice a quién vio pasar de madrugada y luego pide que no digas que lo dijo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'resolucion', escena: 'prueba', texto: 'Reconocen el ungüento al olerlo. Solo lo compra una persona, y no por gusto.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'frasco de ungüento' } },
      { rol: 'pista2', escena: 'resolución', texto: 'Pones las piezas encima de una piedra del camino. Se hace un silencio incómodo del que todavía se habla.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'origen', escena: 'celebración', texto: 'Ya corre la voz de que fuiste tú. Siéntate, que te sirvo la cena sin que la pidas, y aquí eso es un honor.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'ronda-del-vigia',
    titulo: 'La ronda prestada',
    gancho: 'Quien vigila lleva vigilando desde antes de que existieran las excusas. «Hazla tú esta vez. Mira desde lo alto, pasa por el mal paso, y cuéntamelo todo».',
    tamano: 'paseo',
    oficios: ['forja', 'taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'ronda-cumplida', escala: { veces: 1 }, detalle: { con: 'vigia', motivo: 'emboscada-en-el-paso' } },
    },
    mote: 'la-que-hizo-la-ronda',
    desenlace: {
      texto: 'Das el parte con detalle y quien vigila palidece, luego asiente, y luego te pide que vuelvas mañana. La costumbre se pega rápido.',
      oro: 8,
      // Con tilde dentro del identificador, igual que los motes: el nombre visible se lee
      // de aquí —la plantilla no persiste ningún otro— y «Catalejo del vigia» sale a la
      // repisa mal escrito. Es una referencia y nadie la parsea; el único que la toca la
      // parte por los guiones para escribirla en palabras.
      objetos: [{ id: 'catalejo-del-vigía', clase: 'llave', procedencia: { plantilla: 'ronda-del-vigia' } }],
    },
    repuesto: {
      sinTi: 'La ronda la hizo quien siempre la hace, refunfuñando, y no vio nada raro porque ya no mira.',
      conLoConseguido: 'Vuelves con lo que sí viste. Con eso basta para que esta noche alguien duerma peor y mejor vigilado.',
    },
    relacion: [
      { rol: 'cuartel', signo: 'reparador', beat: 4, decision: 'dar-el-parte-completo' },
    ],
    revision: 'El chiste es la pereza cariñosa de quien delega su ronda, no el pueblo. Los hechos siguen importando: en el paso hay alguien de verdad.',
    orden: ['cuartel', 'alto', 'paso'],
    roles: {
      cuartel: { tipo: 'nucleo', types: ['pueblo', 'ciudad', 'aldea'] },
      alto: { tipo: 'paraje', escena: ['vigilancia', 'revelación'] },
      paso: { tipo: 'paraje', escena: 'emboscada' },
    },
    beats: [
      { rol: 'cuartel', escena: 'encargo', texto: 'Te entregan el catalejo con instrucciones larguísimas para un aparato de mirar.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'catalejo del vigía' } },
      { rol: 'alto', escena: 'vigilancia', texto: 'Desde lo alto ves un brillo donde no debería haber nadie. Lo miras un rato largo por si se cansa antes que tú.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'paso', escena: 'emboscada', texto: 'En el mal paso te esperan sin ninguna gana de ser vistos. Les sale regular.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'cuartel', escena: 'informe', texto: 'Cuentas la ronda entera. Antes de acabar ya nadie respira, y eso que empezó como una excusa.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'peregrinaje',
    titulo: 'El remedio que no cura nada',
    gancho: 'Para lo que la botica no arregla queda el remedio antiguo: rezar donde se reza y dejar algo donde antes escuchaban. Nadie promete resultados.',
    tamano: 'paseo',
    oficios: ['botica'],
    rumor: { notable: false },
    mote: null,
    desenlace: {
      texto: 'Vuelves con la ofrenda entregada y con la sensación exacta de haber cumplido. Nadie lo cuenta por los caminos, y así tiene que ser.',
      oro: 4,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La ofrenda la llevó otra persona con el mismo cuidado. Estas cosas se hacen y no se lucen.',
      conLoConseguido: 'Te vuelves con la vela sin encender. La intención cuenta, dicen aquí, y aquí se dice mucho.',
    },
    relacion: [],
    revision: 'Sin ironía a costa de la creencia: el humor está en la solemnidad del trámite. Es exclusiva de botica y su desenlace no lo cuenta nadie, a propósito.',
    orden: ['origen', 'templo', 'antiguo'],
    roles: {
      origen: { tipo: 'nucleo', types: ['aldea', 'pueblo', 'ciudad', 'granja'] },
      // Las dos escenas alternativas no son un apaño: donde no hay ermita se reza
      // igual en el cruce y se deja la ofrenda bajo el puente, que es exactamente
      // como se ha hecho siempre donde no había templo.
      templo: { tipo: 'paraje', escena: ['ritual', 'encuentro'] },
      antiguo: { tipo: 'paraje', escena: ['misterio', 'peaje'] },
    },
    beats: [
      { rol: 'origen', escena: 'súplica', texto: 'Te confían la ofrenda y las palabras exactas, repetidas hasta que las dices bien.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'ofrenda' } },
      { rol: 'templo', escena: 'ritual', texto: 'Enciendes la vela y dices las palabras. El silencio responde con mucha educación.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'antiguo', escena: 'ofrenda', texto: 'Dejas lo que traías sobre la piedra. Algo, en alguna parte, lo da por bueno.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'origen', escena: 'regreso', texto: 'Vuelves con la señal de que el remedio está en marcha, lo cual admite interpretaciones.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'rescate-en-la-granja',
    titulo: 'El zagal que se escondió muy bien',
    gancho: 'Falta el zagal desde el alba y en casa ya no disimulan el susto. El perro volvió sin él y mirando al camino, que es la manera que tiene un perro de señalar.',
    tamano: 'aventura',
    oficios: ['botica', 'forja'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'zagal-rescatado', escala: { veces: 1 }, detalle: { con: 'zagal', motivo: 'desaparicion-al-alba' } },
    },
    mote: 'la-que-encontró-al-zagal',
    desenlace: {
      texto: 'El reencuentro es breve y muy ruidoso. Hay pan recién hecho para ti y una reprimenda pendiente para el zagal, en ese orden.',
      oro: 14,
      objetos: [{ id: 'silbato-del-zagal', clase: 'llave', procedencia: { plantilla: 'rescate-en-la-granja' } }],
    },
    repuesto: {
      sinTi: 'El zagal apareció al caer la tarde por su propio pie, con el tobillo hinchado y una historia que mejora cada vez que la cuenta.',
      conLoConseguido: 'Vuelves con el silbato y con el rastro. Alguien saldrá de nuevo con esa pista, y esta vez sabiendo dónde mirar.',
    },
    relacion: [
      { rol: 'casa', signo: 'reparador', beat: 6, decision: 'quitarle-hierro-delante-del-zagal' },
      { rol: 'remedio', signo: 'feo', beat: 3, decision: 'regatear-el-precio-de-la-venda' },
    ],
    revision: 'El humor va del lado del zagal y de su escondite excelente. La casa se toma en serio a sí misma y el susto no se banaliza.',
    orden: ['casa', 'peligro', 'remedio'],
    roles: {
      casa: { tipo: 'nucleo', types: ['granja', 'aldea', 'pueblo'] },
      peligro: { tipo: 'paraje', escena: 'emboscada' },
      // Quien sabe de vendas no necesita tener botica: en un sitio pequeño es una
      // casa concreta, y atar esta aventura a un local la dejaba sin castear
      // justo donde el zagal es más fácil de perder.
      remedio: { tipo: 'nucleo', types: ['aldea', 'pueblo', 'ciudad'] },
    },
    beats: [
      { rol: 'casa', escena: 'súplica', texto: 'Te dan el silbato del zagal. «Lo reconocerá», dicen, con una fe en el silbato que ya quisiera el silbato.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'silbato del zagal' } },
      {
        rol: 'peligro',
        escena: 'rescate',
        texto: 'Lo encuentras escondido con el tobillo torcido y una versión de lo ocurrido que no se sostiene de ninguna manera.',
        disparador: {
          tipo: 'con_objeto',
          objeto: 'silbato del zagal',
          viaAlternativa: { texto: 'Sin el silbato tardas más: lo llamas a voces hasta que contesta desde debajo de las zarzas, ofendido por el escándalo.' },
        },
        resultado: { tipo: 'estado' },
      },
      { rol: 'remedio', escena: 'curas', texto: 'Donde saben de vendas atan el tobillo y escuchan la versión del zagal con una ceja levantada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'peligro', escena: 'vuelta', texto: 'Volvéis por el mal paso a plena luz. Ahora el zagal explica su escondite con orgullo de arquitecto.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'peligro', escena: 'rastro', texto: 'Antes de seguir marcas la zarza con un trapo, por si a alguien le da otra vez por esconderse ahí.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'reunión', texto: 'Vuelves con el zagal a cuestas. En casa lloran, gritan y ponen la mesa, más o menos a la vez.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },

  // --- núcleo y paraje: lo que un barrio de tres calles sí tiene ------------
  {
    id: 'peaje-de-la-costumbre',
    titulo: 'El peaje que nadie cobra',
    gancho: 'En el cruce hay una tabla con las tarifas del portazgo. Está escrita a mano, lleva ahí desde siempre y no la ha pagado jamás nadie vivo.',
    tamano: 'paseo',
    oficios: ['mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'portazgo-aclarado', escala: { veces: 1 }, detalle: { con: 'vecindario', motivo: 'tabla-de-tarifas' } },
    },
    mote: 'la-que-leyó-la-tabla',
    desenlace: {
      texto: 'Resulta que el portazgo lo cobraba una familia que se mudó hace generaciones. La tabla se queda donde está: ya es parte del paisaje.',
      oro: 9,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La tabla sigue ahí y sigue sin cobrarle a nadie. Lleva mucho tiempo haciéndolo, así que no tiene prisa.',
      conLoConseguido: 'Te vuelves con parte del enigma resuelto, que en asuntos de tablas viejas es un avance notable.',
    },
    relacion: [
      { rol: 'plaza', signo: 'reparador', beat: 4, decision: 'dejar-la-tabla-en-su-sitio' },
    ],
    revision: 'El chiste es la burocracia fósil, no el sitio ni el vecindario. Exclusiva de mercado porque el asunto es de cuentas.',
    orden: ['plaza', 'portazgo', 'testigo'],
    roles: {
      plaza: { tipo: 'nucleo', types: ['aldea', 'pueblo', 'granja'] },
      portazgo: { tipo: 'paraje', escena: 'peaje' },
      testigo: { tipo: 'paraje', escena: 'encuentro' },
    },
    beats: [
      { rol: 'plaza', escena: 'encargo', texto: 'Alguien quiere saber de una vez quién cobra ese portazgo. Lleva preguntándoselo demasiado tiempo como para dejarlo estar.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'portazgo', escena: 'peaje', texto: 'Lees la tabla entera. Las tarifas están en monedas que ya no existen y en unidades que tampoco.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'testigo', escena: 'encuentro', texto: 'Quien pasa por aquí a diario te cuenta la versión que le contaron, y avisa de que le llegó torcida.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'plaza', escena: 'informe', texto: 'Vuelves con lo averiguado. Es decepcionante y perfecto, y se celebra como tal.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'cita-adelantada',
    titulo: 'Quien llegó antes de tiempo',
    gancho: 'Hay quien lleva esperando desde mucho antes de lo acordado, y lo dice cada vez que puede. Alguien tiene que ir a rescatar la cita.',
    tamano: 'paseo',
    oficios: ['botica', 'mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'cita-salvada', escala: { veces: 1 }, detalle: { con: 'impaciente', motivo: 'espera-adelantada' } },
    },
    mote: 'la-que-llegó-a-tiempo',
    desenlace: {
      texto: 'La cita se celebra con retraso y con público, que no estaba previsto. Quien esperaba se declara satisfecho y agotado.',
      oro: 7,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La cita se deshizo por puro cansancio y quedaron en verse otro día, con fecha nueva y menos entusiasmo.',
      conLoConseguido: 'Vuelves con el recado dado. Es justo lo que hacía falta, ni más ni menos.',
    },
    relacion: [
      { rol: 'aldea', signo: 'reparador', beat: 4, decision: 'traer-a-quien-esperaba-hasta-la-plaza' },
    ],
    revision: 'La gracia es la impaciencia, tratada con cariño. Nada del chiste toca al lugar donde ocurre.',
    orden: ['aldea', 'punto'],
    roles: {
      aldea: { tipo: 'nucleo', types: ['aldea', 'pueblo', 'granja'] },
      punto: { tipo: 'paraje', escena: 'encuentro' },
    },
    beats: [
      { rol: 'aldea', escena: 'encargo', texto: 'Te piden que vayas a decir que ya salen. Lo dicen con la calma de quien no piensa salir.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      {
        rol: 'punto',
        escena: 'encuentro',
        texto: 'Quien espera lleva ahí desde mucho antes y ha tenido tiempo de ensayar el reproche.',
        disparador: {
          tipo: 'franja',
          franja: 'tarde',
          variante: 'Llegas mientras aún hay sol y le pillas practicando el reproche en voz alta.',
          varianteFuera: 'Quien esperaba ha montado un campamento entero con la manta y la merienda, y ya se lo está pasando bien sin nadie.',
        },
        resultado: { tipo: 'informacion' },
      },
      { rol: 'punto', escena: 'espera', texto: 'Esperáis a que llegue quien faltaba. La conversación mejora mucho a partir del rato incómodo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'aldea', escena: 'reunión', texto: 'Volvéis a la plaza a la vez. Se saludan como si nada hubiera pasado, porque no ha pasado nada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'susto-del-camino',
    titulo: 'El susto que salió caro',
    gancho: 'Alguien se dedica a asustar a quien pasa por el mal paso. Le sale bien, y ese es exactamente el problema que ha venido a resolverse.',
    tamano: 'paseo',
    oficios: ['forja', 'botica'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'sustos-terminados', escala: { veces: 1 }, detalle: { con: 'bromista', motivo: 'sustos-en-el-mal-paso' } },
    },
    mote: 'la-que-paró-los-sustos',
    desenlace: {
      texto: 'Quien asustaba pide perdón con una dignidad admirable y se ofrece a acompañar de noche a quien lo necesite. Se le acepta con reservas.',
      oro: 11,
      objetos: [],
    },
    repuesto: {
      sinTi: 'Los sustos se acabaron sin que nadie interviniera: alguien se llevó uno y devolvió otro más grande. Así se arreglan aquí algunas cosas.',
      conLoConseguido: 'Vuelves sabiendo quién es. Con eso el mal paso ya asusta bastante menos.',
    },
    relacion: [
      { rol: 'pueblo', signo: 'feo', beat: 2, decision: 'devolver-el-susto-con-creces' },
      { rol: 'pueblo', signo: 'reparador', beat: 4, decision: 'no-dar-el-nombre' },
    ],
    revision: 'El desajuste está en tratar una broma pesada como una amenaza del reino. Quien la gasta queda humano, no ridículo.',
    orden: ['pueblo', 'acecho', 'respiro'],
    roles: {
      pueblo: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad'] },
      acecho: { tipo: 'paraje', escena: 'emboscada' },
      respiro: { tipo: 'paraje', escena: 'encuentro' },
    },
    beats: [
      { rol: 'pueblo', escena: 'encargo', texto: 'Te cuentan lo de los sustos bajando la voz, por si el causante anda cerca. Anda cerca.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'acecho', escena: 'emboscada', texto: 'Salta desde el mismo sitio de siempre con un grito muy trabajado. Se nota el oficio y se nota el aburrimiento.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'respiro', escena: 'encuentro', texto: 'Os sentáis a hablarlo con el corazón todavía a saltos. Sale una conversación mejor de lo esperado.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pueblo', escena: 'acuerdo', texto: 'Vuelves con el acuerdo cerrado. Nadie pregunta el nombre, y ese silencio es parte del trato.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'quien-vigila-al-vigia',
    titulo: 'Alguien mira desde el otro alto',
    gancho: 'Desde lo alto se ve el camino entero. Lo incómodo es que, si te fijas {atenta}, desde el otro alto llevan un buen rato mirando hacia aquí.',
    tamano: 'paseo',
    oficios: ['taberna', 'forja'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'vigilancia-descubierta', escala: { veces: 1 }, detalle: { con: 'observadora', motivo: 'miradas-cruzadas' } },
    },
    mote: 'la-que-miró-de-vuelta',
    desenlace: {
      texto: 'Quien miraba lleva meses contando cuánta gente pasa, por su cuenta y sin que nadie se lo pidiera. Ahora el recuento ya no lo lleva en solitario.',
      oro: 10,
      objetos: [],
    },
    repuesto: {
      sinTi: 'El recuento siguió sin ti, tan meticuloso y tan inútil como siempre, que es su encanto.',
      conLoConseguido: 'Te vuelves sabiendo que alguien mira. El camino no vuelve a ser el mismo, y tampoco tú.',
    },
    relacion: [
      { rol: 'plaza', signo: 'reparador', beat: 4, decision: 'contar-lo-del-recuento-con-respeto' },
    ],
    revision: 'El humor está en la manía del recuento, no en quien la tiene: se le trata con ternura y su empeño acaba siendo útil.',
    orden: ['plaza', 'otero', 'paso'],
    roles: {
      plaza: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
      otero: { tipo: 'paraje', escena: 'vigilancia' },
      paso: { tipo: 'paraje', escena: 'peaje' },
    },
    beats: [
      { rol: 'plaza', escena: 'encargo', texto: 'Te piden que subas a mirar y que vuelvas con el parte. Aquí el parte se pide mucho.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'otero', escena: 'vigilancia', texto: 'Miras el camino y, al fondo, alguien te devuelve la mirada con la misma cara de sorpresa.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'paso', escena: 'encuentro', texto: 'Os encontráis en el camino, cada cual con su cuaderno y sus cuentas. Hay que compararlas.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'plaza', escena: 'informe', texto: 'Vuelves con el parte y con una persona nueva del brazo, lo cual complica el parte.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'cuento-del-puente',
    titulo: 'Lo que vive bajo el puente',
    gancho: 'Bajo el puente vive algo que cobra por pasar, según quien lo cuenta. Según quien lo desmiente, bajo el puente vive alguien que necesita ayuda. Baja a mirar si te ves {dispuesta}.',
    tamano: 'paseo',
    oficios: ['taberna', 'mercado', 'forja'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'lo-del-puente-aclarado', escala: { veces: 1 }, detalle: { con: 'habitante-del-puente', motivo: 'peaje-inventado' } },
    },
    mote: 'la-que-bajó-al-puente',
    desenlace: {
      texto: 'Bajo el puente vive alguien que se refugia del viento y que no cobra nada. Lo del peaje se lo inventó quien no quería bajar a mirar.',
      oro: 10,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La historia del peaje siguió creciendo sin ti. Ahora cobra más y da más miedo, y sigue siendo mentira.',
      conLoConseguido: 'Te vuelves habiendo mirado. Solo eso ya deshace buena parte del cuento.',
    },
    relacion: [
      { rol: 'plaza', signo: 'feo', beat: 4, decision: 'seguir-contando-lo-del-peaje' },
      { rol: 'plaza', signo: 'reparador', beat: 2, decision: 'bajar-a-saludar' },
    ],
    revision: 'El chiste va contra el rumor, no contra quien vive bajo el puente, que sale bien parado y con nombre propio.',
    orden: ['plaza', 'puente', 'mirador'],
    roles: {
      plaza: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad'] },
      puente: { tipo: 'paraje', escena: ['peaje', 'guarida'] },
      mirador: { tipo: 'paraje', escena: 'vigilancia' },
    },
    beats: [
      { rol: 'plaza', escena: 'encargo', texto: 'Te cuentan lo del puente con adornos. Cada persona añade un adorno propio y nadie quita ninguno.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'puente', escena: 'peaje', texto: 'Bajas a mirar. Lo que hay debajo es mucho menos terrible y bastante más frío.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'mirador', escena: 'vigilancia', texto: 'Desde el alto compruebas quién pasa por el puente sin bajar nunca a mirar. Casi todo el mundo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'plaza', escena: 'desmentido', texto: 'Vuelves con el desmentido. Se recibe con decepción, y luego con una manta y comida.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'lo-que-dejo-la-crecida',
    titulo: 'Lo que dejó la crecida',
    gancho: 'El agua bajó y dejó cosas donde no estaban. Hay que ir a ver qué es de quién antes de que se decida por costumbre.',
    tamano: 'aventura',
    oficios: ['mercado', 'forja'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'reparto-tras-la-crecida', escala: { veces: 1 }, detalle: { con: 'vecindario', motivo: 'objetos-arrastrados' } },
    },
    mote: 'la-que-repartió-lo-arrastrado',
    desenlace: {
      texto: 'Casi todo vuelve a su sitio y lo demás se queda sin dueña reconocible. Se decide guardarlo en común, que aquí es la forma elegante de no decidir.',
      oro: 13,
      objetos: [],
    },
    repuesto: {
      sinTi: 'El reparto se hizo por antigüedad y por volumen de voz, con el resultado que cabía esperar.',
      conLoConseguido: 'Vuelves con lo que sí tiene dueña clara. El resto tendrá que esperar a otra conversación.',
    },
    relacion: [
      { rol: 'casa', signo: 'feo', beat: 3, decision: 'quedarse-con-lo-que-no-reclama-nadie' },
    ],
    revision: 'El humor está en el arte local de no decidir. Nadie queda como aprovechado salvo quien elige serlo, y eso lo elige quien juega.',
    orden: ['pueblo', 'orilla', 'casa'],
    roles: {
      pueblo: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad'] },
      orilla: { tipo: 'paraje', escena: 'encuentro' },
      casa: { tipo: 'nucleo', types: ['granja', 'aldea', 'pueblo'] },
    },
    beats: [
      { rol: 'pueblo', escena: 'encargo', texto: 'Te encargan bajar a ver qué dejó el agua, y sobre todo quién estaba ya mirándolo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'orilla', escena: 'hallazgo', texto: 'Entre el barro hay aperos, una cesta y algo con iniciales. Las iniciales complican el asunto entero.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'cesta con iniciales' } },
      { rol: 'casa', escena: 'reclamo', texto: 'Reconocen la cesta al instante y niegan lo demás con demasiada rapidez. Demasiada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'orilla', escena: 'comprobación', texto: 'Volvéis al barro a mirar lo que quedaba. Aparece otra cosa con iniciales distintas y vuelta a empezar.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'orilla', escena: 'acuerdo', texto: 'Se apila lo que no reclama nadie a la vista de quien pase. Es la manera de aquí de no decidir en voz alta.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pueblo', escena: 'reparto', texto: 'Vuelves y se reparte lo que se puede. La conversación dura más que la crecida.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },

  // --- sin ningún paraje: servicios, núcleos y caras -------------------------
  {
    id: 'la-cuenta-pendiente',
    titulo: 'La cuenta que nadie salda',
    gancho: 'Hay una deuda vieja anotada en una tabla que cuelga a la vista de todo el mundo. La deben, la reconocen, y aun así lleva ahí más tiempo del que nadie recuerda.',
    tamano: 'paseo',
    oficios: ['mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'deuda-saldada', escala: { veces: 1 }, detalle: { con: 'deudora', motivo: 'tabla-de-la-taberna' } },
    },
    mote: 'la-que-borró-la-tabla',
    desenlace: {
      texto: 'La deuda se salda en especie y con una ceremonia improvisada. Borrar la tabla resulta ser lo más difícil de la jornada.',
      oro: 15,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La tabla sigue con su cuenta pendiente. Ya casi es un adorno y hay quien la defendería si alguien la borrara.',
      conLoConseguido: 'Vuelves con la promesa de pago. Aquí una promesa dicha delante de gente vale bastante.',
    },
    relacion: [
      { rol: 'quien_debe', signo: 'reparador', beat: 3, decision: 'aceptar-el-pago-en-especie' },
      { rol: 'quien_cobra', signo: 'feo', beat: 2, decision: 'leer-la-cuenta-en-voz-alta' },
    ],
    revision: 'El chiste es la contabilidad sentimental, no la pobreza de nadie. Quien debe queda con dignidad intacta.',
    orden: ['plaza', 'quien_cobra', 'casa', 'quien_debe'],
    roles: {
      // La tabla cuelga donde se junta la gente, y eso lo hay en cualquier sitio:
      // colgarla de un local dejaba la aventura fuera de los mundos pequeños, que
      // son justo donde una deuda vieja se conoce mejor.
      plaza: { tipo: 'nucleo', types: ['pueblo', 'ciudad', 'aldea'] },
      quien_cobra: { tipo: 'humano', en: 'plaza', puesto: 'regencia' },
      casa: { tipo: 'nucleo', types: ['aldea', 'granja', 'pueblo'] },
      quien_debe: { tipo: 'humano', en: 'casa', puesto: 'vecindad' },
    },
    beats: [
      { rol: 'plaza', escena: 'encargo', texto: 'Te enseñan la tabla con la cuenta. La letra es de otra época y el rencor está fresquísimo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'reclamo', texto: 'Llegas a la casa y reconocen la deuda antes de que abras la boca. Llevan ensayándolo tiempo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'acuerdo', texto: 'Te pago con lo que hay en casa. Moneda no es, pero pesa igual y vale lo que dice que vale.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'pago en especie' } },
      { rol: 'plaza', escena: 'saldo', texto: 'Trae ese pago, que borro la tabla. Cuesta lo suyo, y me da una pena rarísima verla limpia otra vez.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-encargo-de-la-forja',
    titulo: 'El encargo que no cabía',
    gancho: 'En la forja han hecho una pieza magnífica. También la han hecho más grande que la puerta por la que tiene que salir.',
    tamano: 'paseo',
    oficios: ['forja'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'pieza-entregada', escala: { veces: 1 }, detalle: { con: 'forja', motivo: 'pieza-demasiado-grande' } },
    },
    mote: 'la-que-sacó-la-pieza',
    desenlace: {
      texto: 'La pieza sale por donde no debía y llega entera. En la forja juran que la puerta encogió, y nadie tiene ganas de discutirlo.',
      oro: 16,
      objetos: [{ id: 'clavo-de-la-forja', clase: 'recuerdo', procedencia: { plantilla: 'el-encargo-de-la-forja' } }],
    },
    repuesto: {
      sinTi: 'La pieza salió al día siguiente, desmontada y con mucho ruido. Funcionó, aunque perdió toda la épica.',
      conLoConseguido: 'Te vuelves con las medidas tomadas. Con eso, mañana la pieza sale sin discusión.',
    },
    relacion: [
      { rol: 'quien_forja', signo: 'reparador', beat: 2, decision: 'no-decir-lo-de-la-puerta' },
    ],
    revision: 'Exclusiva de forja. El humor es del oficio hacia sí mismo, contado por quien lo ejerce y sin condescendencia.',
    orden: ['forja', 'quien_forja', 'destino'],
    roles: {
      forja: { tipo: 'servicio', kind: 'armeria' },
      quien_forja: { tipo: 'humano', en: 'forja', puesto: 'regencia' },
      destino: { tipo: 'nucleo', types: ['ciudad', 'pueblo', 'aldea'] },
    },
    beats: [
      { rol: 'forja', escena: 'encargo', texto: 'Te enseñan la pieza con orgullo legítimo. Luego te enseñan la puerta, con menos orgullo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'forja', escena: 'problema', texto: 'Llevo probadas todas las salidas que se me ocurren. Ninguna funciona, y a cada una le he dedicado un rato muy serio.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'pieza de la forja' } },
      { rol: 'destino', escena: 'entrega', texto: 'La pieza llega a su sitio y encaja al golpe. El alivio se oye desde el camino.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'forja', escena: 'regreso', texto: 'Vuelves con la noticia. En la forja ya la sabían y aun así te dejan contarla entera.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'la-receta-perdida',
    titulo: 'La receta que se sabía de memoria',
    gancho: 'En la botica falta la receta del jarabe que todo el mundo pide. La sabían de memoria, y la memoria ha decidido tomarse un descanso.',
    tamano: 'paseo',
    oficios: ['botica', 'mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'receta-recuperada', escala: { veces: 1 }, detalle: { con: 'botica', motivo: 'memoria-perdida' } },
    },
    mote: 'la-que-devolvió-la-receta',
    desenlace: {
      texto: 'La receta se reconstruye preguntando a quien la tomó de pequeña. Sale distinta y, según la clientela, mejor.',
      oro: 12,
      objetos: [],
    },
    repuesto: {
      sinTi: 'En la botica improvisaron algo parecido. Cura igual y sabe peor, y nadie ha dicho nada por educación.',
      conLoConseguido: 'Vuelves con parte de la receta. Falta lo que le daba el color, que resulta ser lo importante.',
    },
    relacion: [
      { rol: 'quien_atiende', signo: 'reparador', beat: 5, decision: 'decir-que-la-receta-era-suya' },
    ],
    revision: 'Cariño hacia la memoria que falla, sin burla. El desajuste está en tratar un jarabe como un secreto de estado.',
    // Es una de las cinco que siguen pidiendo local, y la única que pide dos: entre
    // las cinco cubren los seis servicios que el mundo sabe generar, y así el resto
    // del catálogo queda libre para castear donde no hay ni uno.
    orden: ['botica', 'quien_atiende', 'conjuria', 'vecindario'],
    roles: {
      botica: { tipo: 'servicio', kind: 'boticario' },
      quien_atiende: { tipo: 'humano', en: 'botica', puesto: 'regencia' },
      conjuria: { tipo: 'servicio', kind: 'conjureria' },
      vecindario: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
    },
    beats: [
      { rol: 'botica', escena: 'encargo', texto: 'Te cuentan el desastre en voz baja para que no cunda el pánico. Ya ha cundido.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'vecindario', escena: 'testigo', texto: 'Preguntas por las casas. Cada persona recuerda un ingrediente distinto y ninguno coincide.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'conjuria', escena: 'pesquisa', texto: 'Donde guardan lo escrito buscan entre cuadernos que nadie ordenó nunca. La receta no está, y el desorden queda peor.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'vecindario', escena: 'prueba', texto: 'Alguien mayor recuerda el color exacto, y con el color aparece de golpe el ingrediente que faltaba.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'ingrediente olvidado' } },
      { rol: 'botica', escena: 'regreso', texto: 'Trae esa receta, que la pruebo aquí mismo. Sirve, sirve. Y no me mires así, que sigue sin gustarme de dónde ha salido.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'la-posada-sin-sitio',
    titulo: 'La posada que estaba llena',
    gancho: 'En la posada no queda sitio, y aun así hay gente que dormir. Alguien tiene que ir casa por casa a repartir invitados con mucha diplomacia.',
    tamano: 'paseo',
    oficios: ['taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'gente-alojada', escala: { veces: 1 }, detalle: { con: 'posada', motivo: 'noche-sin-camas' } },
    },
    mote: 'la-que-repartió-camas',
    desenlace: {
      texto: 'Todo el mundo duerme bajo techo y nadie donde quería. A la mañana siguiente hay amistades nuevas y una discusión antigua resuelta.',
      oro: 11,
      objetos: [],
    },
    repuesto: {
      sinTi: 'El reparto lo hizo la posada a gritos desde la puerta. Funcionó y se recuerda con espanto.',
      conLoConseguido: 'Vuelves con las casas que sí tienen sitio apuntadas. Con eso la noche ya está encarrilada.',
    },
    relacion: [
      { rol: 'quien_regenta', signo: 'reparador', beat: 4, decision: 'quedarte-a-ayudar-hasta-el-final' },
    ],
    revision: 'La hospitalidad forzosa como motor cómico. La posada no queda mal: queda desbordada, que es distinto.',
    orden: ['posada', 'quien_regenta', 'barrio', 'granja'],
    roles: {
      posada: { tipo: 'servicio', kind: 'posada' },
      quien_regenta: { tipo: 'humano', en: 'posada', puesto: 'regencia' },
      barrio: { tipo: 'nucleo', types: ['pueblo', 'ciudad', 'aldea'] },
      granja: { tipo: 'nucleo', types: ['granja', 'aldea'] },
    },
    beats: [
      { rol: 'posada', escena: 'encargo', texto: 'Te explican la situación mientras cuentan camas con los dedos. Faltan camas y sobran dedos.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'barrio', escena: 'gestión', texto: 'Vas casa por casa. Dicen que no y luego preguntan cuántos son, que aquí es decir que sí.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'granja', escena: 'gestión', texto: 'En la granja hay pajar y muy buena disposición, siempre que nadie fume dentro.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'posada', escena: 'reparto', texto: 'Con el reparto cerrado, lo leo en alto como si fuera un decreto. Y que nadie se queje, que aquí se aplaude y se duerme.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-inventario-del-mercado',
    titulo: 'El inventario imposible',
    gancho: 'En el mercado quieren saber qué hay exactamente. Nunca lo han sabido, viven muy bien así, y aun así este año les ha dado por averiguarlo.',
    tamano: 'paseo',
    oficios: ['mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'inventario-cerrado', escala: { veces: 1 }, detalle: { con: 'mercado', motivo: 'recuento-imposible' } },
    },
    mote: 'la-del-inventario',
    desenlace: {
      texto: 'El inventario se cierra con un descuadre que nadie quiere mirar. Se guarda en un cajón y se celebra como una victoria, que lo es.',
      oro: 14,
      objetos: [],
    },
    repuesto: {
      sinTi: 'El inventario se abandonó por consenso, igual que el del año pasado y el del anterior.',
      conLoConseguido: 'Vuelves con lo contado hasta ahora. Es más de lo que nadie había contado nunca aquí.',
    },
    relacion: [
      { rol: 'quien_pesa', signo: 'reparador', beat: 4, decision: 'firmar-el-inventario-en-común' },
    ],
    revision: 'Exclusiva de mercado. Se ríe del recuento y no de quien vende; el desajuste es la épica aplicada a una lista.',
    orden: ['mercado', 'quien_pesa', 'almacen'],
    roles: {
      mercado: { tipo: 'servicio', kind: 'mercado' },
      quien_pesa: { tipo: 'humano', en: 'mercado', puesto: 'acarreo' },
      almacen: { tipo: 'nucleo', types: ['ciudad', 'pueblo', 'aldea'] },
    },
    beats: [
      { rol: 'mercado', escena: 'encargo', texto: 'Te dan una lista empezada por alguien que se rindió sin avisar y no lo puso por escrito.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'almacen', escena: 'recuento', texto: 'Cuentas lo que hay guardado. Aparecen cosas que llevaban perdidas más tiempo que la lista.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'lista del recuento' } },
      { rol: 'almacen', escena: 'discusión', texto: 'Se discute si algunas cosas cuentan como una o como muchas. La discusión es mejor que el inventario.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'mercado', escena: 'cierre', texto: 'Recuento cerrado. Lo firmo con toda la solemnidad que merece y lo guardo donde nadie va a leerlo jamás.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-libro-que-no-se-presta',
    titulo: 'El libro que no sale de aquí',
    gancho: 'En una casa de aquí hay un libro que no se presta a nadie. Alguien lo necesita hoy y va a hacer falta mucha labia y algo de caminar.',
    tamano: 'paseo',
    oficios: ['botica', 'forja'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'libro-consultado', escala: { veces: 1 }, detalle: { con: 'custodia', motivo: 'préstamo-negado' } },
    },
    mote: 'la-que-abrió-el-libro',
    desenlace: {
      texto: 'El libro no sale, pero la página sí: alguien la copia a mano con una letra preciosa. Todo el mundo queda satisfecho por motivos distintos.',
      oro: 13,
      // Con tilde, por lo mismo: la repisa escribía «Copia de la pagina».
      objetos: [{ id: 'copia-de-la-página', clase: 'llave', procedencia: { plantilla: 'el-libro-que-no-se-presta' } }],
    },
    repuesto: {
      sinTi: 'El asunto se resolvió de memoria y con errores. Se notó al usarlo, y bastante.',
      conLoConseguido: 'Vuelves con lo que te dejaron leer. No es la página entera, pero es la parte que hacía falta.',
    },
    relacion: [
      { rol: 'quien_guarda', signo: 'feo', beat: 2, decision: 'llevarse-el-libro-sin-pedirlo' },
      { rol: 'quien_guarda', signo: 'reparador', beat: 3, decision: 'devolverlo-antes-de-que-lo-echen-de-menos' },
    ],
    revision: 'El humor es el celo del custodio, tratado con respeto: su norma es razonable y su solución, generosa.',
    orden: ['custodia', 'quien_guarda', 'quien_pide'],
    roles: {
      // Un libro que no sale de casa se guarda en una casa, no en un local: así la
      // aventura existe también donde no hay ninguno, que es donde un libro escaso
      // pesa más.
      custodia: { tipo: 'nucleo', types: ['ciudad', 'pueblo', 'aldea'] },
      quien_guarda: { tipo: 'humano', en: 'custodia', puesto: 'regencia' },
      quien_pide: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'granja', 'ciudad'] },
    },
    beats: [
      { rol: 'custodia', escena: 'negativa', texto: 'Te explican por qué el libro no sale. La explicación es larga, ordenada y, molestamente, razonable.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'custodia', escena: 'trato', texto: 'Prestarlo no lo presto. Te copio la página, que lleva su rato, y verás qué letra me sale cuando me lo tomo en serio.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'copia de la página' } },
      { rol: 'quien_pide', escena: 'entrega', texto: 'Llevas la copia a quien la necesitaba. La lee de pie y sin respirar, y luego da las gracias.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'custodia', escena: 'regreso', texto: 'Vuelves a decir que funcionó. Se recibe con la calma de quien nunca lo dudó.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'la-visita-que-toca',
    titulo: 'La visita que hay que hacer',
    gancho: 'Hay alguien a quien nadie visita desde hace demasiado, y todo el mundo lo sabe. Hoy le toca a quien pase por aquí, y la {forastera} que pasa eres tú.',
    tamano: 'paseo',
    oficios: ['taberna', 'botica'],
    rumor: { notable: false },
    mote: null,
    desenlace: {
      texto: 'La visita dura más de lo previsto y termina con la promesa de volver. La promesa se dice en serio, que es lo raro.',
      oro: 6,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La visita la hizo alguien más, con prisa y de pie en la puerta. Cuenta igual, que es lo que se pedía.',
      conLoConseguido: 'Vuelves con el recado dado desde el camino. Es menos de lo que querías y más de lo que había.',
    },
    relacion: [
      { rol: 'quien_espera', signo: 'reparador', beat: 3, decision: 'quedarte-a-escuchar-la-historia-larga' },
    ],
    revision: 'Sin ironía sobre la soledad. El humor está en la logística vecinal de los turnos de visita, no en quien la recibe.',
    orden: ['casa', 'quien_espera', 'sendero'],
    roles: {
      casa: { tipo: 'nucleo', types: ['granja', 'aldea', 'pueblo', 'ciudad'] },
      quien_espera: { tipo: 'humano', en: 'casa', puesto: 'vecindad' },
      sendero: { tipo: 'paraje', escena: 'encuentro' },
    },
    beats: [
      { rol: 'sendero', escena: 'encargo', texto: 'Te paran en el camino y te lo piden con una naturalidad que no admite negativa. Te dan una cesta que tampoco.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'cesta' } },
      { rol: 'casa', escena: 'visita', texto: 'Te reciben como si te esperaran, que en cierto modo era el caso desde hace tiempo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'conversación', texto: 'Siéntate, que te cuento una historia larga y con nombres que no conoces de nada. Aguanta hasta el final, que merece la pena.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'sendero', escena: 'regreso', texto: 'Vuelves por donde viniste y dices que está bien. Se nota que la visita importaba de verdad.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-relevo-de-la-guardia',
    titulo: 'El relevo que no llegó',
    gancho: 'Quien está de guardia lleva de guardia más de lo que le tocaba. El relevo no aparece y hay que ir a buscarlo antes de que se note el malhumor.',
    tamano: 'paseo',
    oficios: ['forja', 'taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'relevo-resuelto', escala: { veces: 1 }, detalle: { con: 'guardia', motivo: 'turno-doblado' } },
    },
    mote: 'la-que-trajo-el-relevo',
    desenlace: {
      texto: 'El relevo aparece con una excusa magnífica y muy detallada. Se le perdona por lo bien construida que estaba.',
      oro: 9,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La guardia se dobló entera y sin relevo. Al día siguiente hubo una conversación larga que sigue dando fruto.',
      conLoConseguido: 'Vuelves con el paradero del relevo. Con eso ya se sabe a quién echarle la culpa, que aquí tranquiliza.',
    },
    relacion: [
      { rol: 'quien_guarda', signo: 'reparador', beat: 4, decision: 'cubrirle-el-final-de-la-guardia' },
      { rol: 'quien_falta', signo: 'feo', beat: 3, decision: 'contar-la-excusa-a-quien-no-debía' },
    ],
    revision: 'Se ríe de la excusa, no del oficio. Quien dobla turno queda como lo que es: alguien cumpliendo.',
    orden: ['puesto', 'quien_guarda', 'casa', 'quien_falta'],
    roles: {
      puesto: { tipo: 'nucleo', types: ['pueblo', 'ciudad'] },
      quien_guarda: { tipo: 'humano', en: 'puesto', puesto: 'vigilancia' },
      casa: { tipo: 'nucleo', types: ['aldea', 'granja'] },
      quien_falta: { tipo: 'humano', en: 'casa', puesto: 'vecindad' },
    },
    beats: [
      { rol: 'puesto', escena: 'encargo', texto: 'Quien está de guardia te lo cuenta sin quejarse, que es la forma local de quejarse mucho.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'búsqueda', texto: 'En la casa del relevo no hay nadie, y la puerta está abierta como si acabaran de salir.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'hallazgo', texto: 'Ya voy, ya voy. Traigo una excusa larga, bien ordenada y con quien la confirme, por si a alguien le hace falta oírla.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'puesto', escena: 'relevo', texto: 'Con el relevo puesto ya me puedo retirar. Despacio, eso sí, y con toda la dignidad que da hacer bien la guardia.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-recado-que-crece',
    titulo: 'El recado que fue creciendo',
    gancho: 'Empieza como llevar una cosa a un sitio. Termina siendo llevar varias cosas a varios sitios, porque aquí un recado nunca viaja sin compañía.',
    tamano: 'aventura',
    oficios: ['mercado', 'taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'recados-entregados', escala: { veces: 3 }, detalle: { con: 'vecindario', motivo: 'recado-que-crece' } },
    },
    mote: 'la-de-los-recados',
    desenlace: {
      texto: 'Todo llega a su sitio y sobra una cosa que nadie reclama. Se queda donde empezó el recado, esperando dueña con mucha paciencia.',
      oro: 18,
      objetos: [],
    },
    repuesto: {
      sinTi: 'Los recados se entregaron uno a uno y en desorden. Llegaron, que era lo importante.',
      conLoConseguido: 'Vuelves con lo entregado hasta ahora y con la lista abierta. Mañana sigue.',
    },
    relacion: [
      { rol: 'quien_manda', signo: 'reparador', beat: 6, decision: 'devolver-lo-que-sobra' },
    ],
    revision: 'El chiste es la bola de nieve del favor, cariñosa con quien pide. Ninguna casa queda retratada.',
    orden: ['origen', 'quien_manda', 'primera_casa', 'segunda_casa', 'tercera_casa'],
    roles: {
      // Un recado empieza donde hay gente, y eso no exige mostrador: pedirlo lo
      // pedía un local y por eso la bola de nieve no rodaba en los sitios pequeños,
      // que son donde de verdad te paran por la calle.
      origen: { tipo: 'nucleo', types: ['pueblo', 'ciudad', 'aldea'] },
      quien_manda: { tipo: 'humano', en: 'origen', puesto: 'regencia' },
      primera_casa: { tipo: 'nucleo', types: ['aldea', 'granja'] },
      segunda_casa: { tipo: 'nucleo', types: ['pueblo', 'ciudad'] },
      tercera_casa: { tipo: 'nucleo', types: ['granja', 'aldea', 'pueblo'] },
    },
    beats: [
      { rol: 'origen', escena: 'encargo', texto: 'Te dan un paquete y una dirección. También te dan otra cosa más «ya que vas».', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'paquete de recados' } },
      { rol: 'primera_casa', escena: 'entrega', texto: 'Entregas lo que traías y recibes otra cosa para otra casa. Así funciona esto.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'segunda_casa', escena: 'entrega', texto: 'Aquí te esperaban antes de que existiera el encargo. Las noticias corren más que quien las lleva.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'tercera_casa', escena: 'entrega', texto: 'La entrega termina en merienda, que retrasa el recado y mejora la jornada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'segunda_casa', escena: 'vuelta', texto: 'Vuelves a pasar para devolver lo que sobraba. Se niegan a aceptarlo con mucha firmeza.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'origen', escena: 'cierre', texto: 'Déjalo aquí, donde empezó todo. Lo que no quiso nadie ya tiene su sitio en la repisa, y hasta nombre le hemos puesto.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'la-carta-sin-remite',
    titulo: 'La carta sin remite',
    gancho: 'Llega una carta sin remite y con una letra que aquí no reconoce nadie. Antes de abrirla, alguien quiere saber de dónde viene.',
    tamano: 'aventura',
    oficios: ['mercado', 'botica', 'taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'carta-devuelta', escala: { veces: 1 }, detalle: { con: 'remitente', motivo: 'carta-sin-remite' } },
    },
    mote: 'la-que-siguió-la-letra',
    desenlace: {
      texto: 'La carta era para otra casa y llevaba una noticia buena con mucho retraso. Llega igual, y en esta casa se celebra con ganas.',
      oro: 10,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La carta se abrió por curiosidad y luego hubo que explicarlo. Se explicó regular.',
      conLoConseguido: 'Vuelves con la letra reconocida. Con eso ya se sabe a qué casa hay que llevarla.',
    },
    relacion: [
      { rol: 'plaza', signo: 'feo', beat: 2, decision: 'abrir-la-carta-para-mirar' },
    ],
    revision: 'El desajuste está en la investigación monumental de un sobre. Nadie sale mal parado y la noticia buena se respeta.',
    orden: ['plaza', 'camino', 'casa', 'quien_recibe'],
    roles: {
      // Donde se junta la gente a comparar letras, que es cualquier sitio con dos
      // casas y una tarde larga. Y el camino de en medio no es adorno: una carta se
      // rastrea preguntando a quien pasa, y eso pasa fuera del pueblo.
      plaza: { tipo: 'nucleo', types: ['pueblo', 'ciudad', 'aldea', 'granja'] },
      camino: { tipo: 'paraje', escena: 'encuentro' },
      casa: { tipo: 'nucleo', types: ['aldea', 'granja', 'pueblo', 'ciudad'] },
      quien_recibe: { tipo: 'humano', en: 'casa', puesto: 'vecindad' },
    },
    beats: [
      { rol: 'plaza', escena: 'encargo', texto: 'Te enseñan el sobre a contraluz, que aquí se considera un método de investigación serio.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'carta sin remite' } },
      { rol: 'plaza', escena: 'pesquisa', texto: 'Se compara la letra con otras. La comparación acaba en discusión y la discusión, en pista.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'camino', escena: 'rastro', texto: 'Preguntas a quien pasa. Alguien reconoce la letra y señala con la barbilla hacia dónde vive.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'entrega', texto: 'Llamas a la puerta correcta. Reconocen la letra antes de tocar el sobre.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'camino', escena: 'vuelta', texto: 'De vuelta te paran otra vez a preguntar cómo acabó. Aquí las noticias se cobran en el sitio.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'plaza', escena: 'regreso', texto: 'Vuelves con el desenlace. Se pide que lo cuentes entero, con pausas y todo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-arreglo-de-la-fuente',
    titulo: 'El arreglo que lleva años',
    gancho: 'La fuente del pueblo gotea desde antes de que existiera la palabra gotera. Hoy alguien ha decidido, por fin, que se arregla.',
    tamano: 'paseo',
    oficios: ['forja', 'mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'fuente-arreglada', escala: { veces: 1 }, detalle: { con: 'vecindario', motivo: 'gotera-antigua' } },
    },
    mote: 'la-que-arregló-la-fuente',
    desenlace: {
      texto: 'La fuente deja de gotear y el silencio resultante desconcierta a todo el vecindario. Hay quien lo echa de menos y lo dice en voz alta.',
      oro: 15,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La fuente sigue goteando como siempre. Ya nadie la oye, que también es una forma de arreglarla.',
      conLoConseguido: 'Vuelves con la pieza pedida y las medidas tomadas. Lo que falta, aquí, significa algún día.',
    },
    relacion: [
      { rol: 'quien_forja', signo: 'reparador', beat: 3, decision: 'pagar-la-pieza-de-tu-bolsillo' },
    ],
    revision: 'El humor está en el apego a la avería. Quien trabaja el hierro queda como lo que es: gente que resuelve.',
    orden: ['pueblo', 'taller', 'quien_forja'],
    roles: {
      pueblo: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad'] },
      // Quien sabe hacer la pieza vive en algún sitio, y ese sitio no tiene por qué
      // ser una forja con rótulo: en una aldea es la casa de quien tiene el yunque.
      taller: { tipo: 'nucleo', types: ['aldea', 'granja', 'pueblo', 'ciudad'] },
      quien_forja: { tipo: 'humano', en: 'taller', puesto: 'vecindad' },
    },
    beats: [
      { rol: 'pueblo', escena: 'encargo', texto: 'Te explican la gotera con una precisión que solo da el hartazgo de años.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'taller', escena: 'encargo', texto: 'Quien trabaja el hierro escucha, mide en el aire con las manos y dice que sí, que se puede.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'pieza de repuesto' } },
      { rol: 'taller', escena: 'trato', texto: 'El precio lo discutimos, faltaría más. La discusión es parte del trato, y a mí me gusta tanto como cobrarla.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pueblo', escena: 'arreglo', texto: 'La pieza encaja y la gotera para. Se hace un silencio raro que dura más de lo previsto.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    // La premisa cambió entera y el identificador no: lo que se discute en la sala
    // es **una porfía vieja**, no una apuesta, y se salda con trabajo y no con
    // bebida. El contenido es apto para menores por especificación, así que una
    // plantilla que necesitara disfrazar su tema para pasar el filtro estaría apta a
    // medias; esta ya no lo necesita. El `id` se queda porque vive en partidas
    // guardadas y en los extractos de referencia, igual que el de las seis portadas.
    id: 'la-apuesta-de-la-taberna',
    titulo: 'La porfía que nadie sabía zanjar',
    gancho: 'En la taberna llevan años discutiendo algo que desde la sala no hay manera de comprobar. Hace falta quien camine hasta allí y vuelva con criterio, y resulta que traes justo eso.',
    tamano: 'paseo',
    oficios: ['taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'porfia-zanjada', escala: { veces: 1 }, detalle: { con: 'taberna', motivo: 'porfia-antigua' } },
    },
    mote: 'la-que-zanjó-la-porfía',
    desenlace: {
      texto: 'Tenía razón quien menos gritaba. La porfía se salda acarreando leña hasta la siega, y la discusión sigue por costumbre y con mejor humor.',
      oro: 12,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La porfía quedó en tablas por acuerdo tácito y desgaste. Aquí se resuelve así casi todo.',
      conLoConseguido: 'Vuelves con lo que sí has comprobado. Sirve para desmentir a alguien, que ya es motivo suficiente.',
    },
    relacion: [
      { rol: 'quien_sirve', signo: 'feo', beat: 4, decision: 'cobrar-comisión-por-arbitrar' },
      { rol: 'quien_sirve', signo: 'reparador', beat: 4, decision: 'dar-el-veredicto-sin-cobrar' },
    ],
    revision: 'Exclusiva de taberna. Se ríe de la porfía y del vozarrón, nunca del local ni de quien lo regenta: lo que se ventila es quién tenía razón, y se paga con trabajo.',
    orden: ['taberna', 'quien_sirve', 'lejos'],
    roles: {
      taberna: { tipo: 'servicio', kind: 'taberna' },
      quien_sirve: { tipo: 'humano', en: 'taberna', puesto: 'sala' },
      lejos: { tipo: 'nucleo', types: ['aldea', 'granja', 'pueblo'] },
    },
    beats: [
      { rol: 'taberna', escena: 'encargo', texto: 'Te ponen a arbitrar por aclamación y sin preguntarte. El cargo no trae sueldo, ni relevo, ni manera decente de escaquearse.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'lejos', escena: 'comprobación', texto: 'Compruebas el asunto en el sitio. Resulta ser mucho menos épico de lo que se cuenta en la sala.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'lejos', escena: 'testigo', texto: 'Consigues un testimonio que lo confirma, dicho con una sequedad envidiable.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'taberna', escena: 'veredicto', texto: 'Dilo alto, que se enteren. Aquí un veredicto se acata a regañadientes y se celebra a gritos, que viene a ser lo mismo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },

  // --- servicios y parajes ---------------------------------------------------
  {
    id: 'el-ungüento-que-huele-mal',
    titulo: 'El remedio que huele fatal',
    gancho: 'Han preparado un remedio que cura de maravilla y huele espantoso. Hay que llevarlo lejos y explicarlo con mucha delicadeza.',
    tamano: 'paseo',
    oficios: ['botica', 'mercado'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'remedio-entregado', escala: { veces: 1 }, detalle: { con: 'obrador', motivo: 'remedio-maloliente' } },
    },
    mote: 'la-que-llevó-el-remedio',
    desenlace: {
      texto: 'El remedio llega y funciona. El olor también llega, y sigue funcionando mucho después, según quien lo sufrió.',
      oro: 11,
      objetos: [{ id: 'frasco-sellado', clase: 'llave', procedencia: { plantilla: 'el-ungüento-que-huele-mal' } }],
    },
    repuesto: {
      sinTi: 'El remedio llegó por otras manos, sin explicación previa. El susto del olor fue considerable.',
      conLoConseguido: 'Te vuelves con el frasco sellado y con la advertencia dada. La advertencia era la parte difícil.',
    },
    relacion: [
      { rol: 'quien_prepara', signo: 'reparador', beat: 4, decision: 'defender-la-receta-delante-de-quien-la-critica' },
    ],
    revision: 'El chiste es el olor, no la clientela. Quien lo prepara está orgullosa con razón y así se cuenta.',
    orden: ['obrador', 'quien_prepara', 'atajo'],
    roles: {
      // El remedio se cuece en una cocina cualquiera cuando no hay botica, y el
      // resguardo del camino puede ser un cruce: las dos escenas alternativas son
      // lo que deja esta aventura viva en un sitio de tres calles.
      obrador: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
      quien_prepara: { tipo: 'humano', en: 'obrador', puesto: 'regencia' },
      atajo: { tipo: 'paraje', escena: ['refugio', 'encuentro'] },
    },
    beats: [
      { rol: 'obrador', escena: 'encargo', texto: 'Te dan el frasco sellado con cera y una lista de advertencias que empieza por el olor.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'frasco sellado' } },
      {
        rol: 'atajo',
        escena: 'refugio',
        texto: 'Paras a resguardo a comprobar el sello. Sigue entero, y aun así el aire ya no es el mismo.',
        disparador: {
          tipo: 'con_objeto',
          objeto: 'frasco sellado',
          viaAlternativa: { texto: 'Sin el frasco paras igual a resguardo, y descubres que el olor te ha seguido de todas formas y sin equipaje.' },
        },
        resultado: { tipo: 'informacion' },
      },
      { rol: 'atajo', escena: 'espera', texto: 'Esperas a que amaine con el frasco a favor del viento, que resulta ser una ciencia.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'obrador', escena: 'regreso', texto: 'Cuéntame qué tal fue la entrega. Lo del olor lo anoto como efecto conocido y aceptado, que ya me lo han dicho antes.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'la-guarida-de-nadie',
    titulo: 'La guarida sin nadie dentro',
    gancho: 'Hay una guarida temible en la que, según quien vuelve de mirar, no hay nadie. Según quien no ha ido, hay de todo. Toca comprobarlo.',
    tamano: 'aventura',
    oficios: ['forja', 'botica'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'guarida-vacía', escala: { veces: 1 }, detalle: { con: 'vecindario', motivo: 'leyenda-sin-dueño' } },
    },
    mote: 'la-que-entró-en-la-guarida',
    desenlace: {
      texto: 'La guarida está vacía y muy limpia, que es lo que da miedo de verdad. Alguien la barre, y nadie sabe quién.',
      oro: 20,
      objetos: [{ id: 'escoba-de-la-guarida', clase: 'recuerdo', procedencia: { plantilla: 'la-guarida-de-nadie' } }],
    },
    repuesto: {
      sinTi: 'La guarida siguió temible y vacía. Sigue barrida, y eso ya es una historia que se cuenta por su cuenta.',
      conLoConseguido: 'Vuelves con lo que viste desde la boca. Es suficiente para desmentir buena parte del cuento.',
    },
    relacion: [
      { rol: 'quien_manda', signo: 'reparador', beat: 7, decision: 'contarlo-sin-exagerar' },
    ],
    revision: 'El terror se desinfla en un detalle doméstico. Nadie del pueblo queda como crédulo: la leyenda se respeta.',
    orden: ['plaza', 'quien_manda', 'boca', 'fondo', 'alto'],
    roles: {
      // Una leyenda se cuenta donde haya gente, con mostrador o sin él. Y el fondo
      // admite un mal paso además de un sitio con misterio: la leyenda se desinfla
      // igual de bien en los dos.
      plaza: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad'] },
      quien_manda: { tipo: 'humano', en: 'plaza', puesto: 'regencia' },
      boca: { tipo: 'paraje', escena: 'guarida' },
      fondo: { tipo: 'paraje', escena: ['misterio', 'emboscada'] },
      alto: { tipo: 'paraje', escena: 'vigilancia' },
    },
    beats: [
      { rol: 'plaza', escena: 'encargo', texto: 'Te cuentan lo de la guarida por turnos y cada versión es peor que la anterior.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'alto', escena: 'vigilancia', texto: 'Antes de bajar vigilas la entrada desde arriba un buen rato, por si sale quien vive dentro. No sale.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'boca', escena: 'guarida', texto: 'Llegas a la boca. Está oscura, está callada y está sorprendentemente ordenada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'fondo', escena: 'misterio', texto: 'Al fondo no hay nada, y el nada está barrido. Eso sí que no lo esperaba nadie.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'escoba gastada' } },
      { rol: 'boca', escena: 'despedida', texto: 'Vuelves a asomarte antes de irte. Todo sigue igual de limpio y ahora resulta entrañable.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'alto', escena: 'espera', texto: 'Esperas otro rato desde el alto por si aparece quien barre. Sigue sin aparecer, y ya lo esperabas.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'plaza', escena: 'informe', texto: '¿Una escoba? Pues impresiona más que cualquier cosa que pudieras haberme traído. Anda, cuéntamelo despacio.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'la-feria-que-no-cabe',
    titulo: 'La feria que no cabe',
    gancho: 'Este año la feria trae más gente de la que cabe. Hay que buscar sitio, avisar por el camino y convencer a quien manda de que se puede.',
    tamano: 'aventura',
    oficios: ['mercado', 'taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'feria-salvada', escala: { veces: 1 }, detalle: { con: 'feria', motivo: 'feria-desbordada' } },
    },
    mote: 'la-que-salvó-la-feria',
    desenlace: {
      texto: 'La feria se monta a lo largo del camino y sale mejor que nunca. Nadie lo admitirá en voz alta hasta el año que viene.',
      oro: 22,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La feria se apretó como pudo y aguantó. Hubo empujones, quejas memorables y ganas de repetir.',
      conLoConseguido: 'Vuelves con el sitio nuevo apalabrado. Con eso la feria ya tiene por dónde crecer.',
    },
    relacion: [
      { rol: 'quien_organiza', signo: 'reparador', beat: 7, decision: 'darle-el-mérito-a-quien-organiza' },
      { rol: 'quien_organiza', signo: 'feo', beat: 3, decision: 'apalabrar-el-sitio-a-sus-espaldas' },
    ],
    revision: 'El desajuste es la épica del urbanismo improvisado. La feria y su gente salen bien: el problema es el éxito.',
    orden: ['feria', 'quien_organiza', 'campa', 'aldea', 'cruce'],
    roles: {
      // La feria es un día del año, no un local: se monta donde haya sitio, y así
      // esta aventura existe también donde no hay plaza de abastos.
      feria: { tipo: 'nucleo', types: ['pueblo', 'ciudad', 'aldea'] },
      quien_organiza: { tipo: 'humano', en: 'feria', puesto: 'regencia' },
      campa: { tipo: 'nucleo', types: ['aldea', 'granja'] },
      aldea: { tipo: 'nucleo', types: ['pueblo', 'ciudad'] },
      cruce: { tipo: 'paraje', escena: 'encuentro' },
    },
    beats: [
      { rol: 'feria', escena: 'encargo', texto: 'Te explican el problema mientras esquivan carros. El problema es evidente y muy ruidoso.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'cruce', escena: 'encuentro', texto: 'En el cruce avisas a quien viene. La noticia se adelanta a la feria por el camino corto.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'campa', escena: 'gestión', texto: 'Hay una campa que serviría. Quien la tiene pone condiciones razonables y una absurda.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'cruce', escena: 'aviso', texto: 'Otra vez el cruce, ahora en sentido contrario y con el plan aún sin cerrar. Aquí se entera todo el mundo antes que nadie.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'aldea', escena: 'venia', texto: 'Quien manda escucha el plan y pone pegas por deporte. Luego dice que sí.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'cruce', escena: 'trato', texto: 'En el cruce se cierra el trato de pie, que es como se cierran los tratos que importan. La condición absurda se acepta.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'feria', escena: 'cierre', texto: 'Con el sitio y con la venia de quien manda, esto lo montamos en un suspiro. Ya verás qué eficacia más sospechosa.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'la-vigilia-del-monasterio',
    titulo: 'La vigilia que había que cubrir',
    gancho: 'Alguien tiene que velar lo que aquí se guarda, y quien lo hacía se ha puesto malo. La vigilia no se suspende: se traspasa.',
    tamano: 'aventura',
    oficios: ['botica', 'forja'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'vigilia-cubierta', escala: { veces: 1 }, detalle: { con: 'custodia', motivo: 'vela-traspasada' } },
    },
    mote: 'la-que-veló-el-saber',
    desenlace: {
      texto: 'La vigilia se cubre entera y no pasa nada, que es exactamente lo que tenía que pasar. Se anota en el libro con letra de ocasión.',
      oro: 19,
      objetos: [],
    },
    repuesto: {
      sinTi: 'La vigilia la cubrió alguien a medias y con sueño. No pasó nada igualmente, que es la moraleja incómoda.',
      conLoConseguido: 'Vuelves con parte de la vela cumplida. Se anota igual, con una nota al margen.',
    },
    relacion: [
      { rol: 'quien_cuida', signo: 'reparador', beat: 5, decision: 'quedarte-hasta-el-relevo' },
    ],
    revision: 'Sin burla del rito. El humor está en el papeleo de la vigilia y en el orgullo de la letra de ocasión.',
    orden: ['casa', 'quien_cuida', 'saber', 'descanso', 'aldea'],
    roles: {
      // Quien traspasa la vela vive en una casa, no detrás de un mostrador. Y donde
      // no hay un sitio con libros se vela desde el alto que domina el camino: la
      // vela es mirar toda la noche, y eso se puede hacer en los dos.
      casa: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad'] },
      quien_cuida: { tipo: 'humano', en: 'casa', puesto: 'vecindad' },
      saber: { tipo: 'paraje', escena: ['saber', 'vigilancia'] },
      descanso: { tipo: 'paraje', escena: ['refugio', 'encuentro'] },
      aldea: { tipo: 'nucleo', types: ['aldea', 'granja'] },
    },
    beats: [
      { rol: 'casa', escena: 'encargo', texto: 'Te explican la vigilia y sus reglas. Son pocas, muy antiguas y bastante razonables.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'descanso', escena: 'refugio', texto: 'Paras al resguardo antes de subir, que es lo que hace todo el mundo y nadie cuenta.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'aldea', escena: 'aviso', texto: 'Avisas de que esta noche velas tú. Se recibe con sorpresa y con una tortilla.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'cena de la vela' } },
      { rol: 'saber', escena: 'saber', texto: 'Llegas al sitio de la vela. Está callado, muy limpio y con esa quietud que impone sin pedirlo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'saber', escena: 'vela', texto: 'Cumples la vela hasta el final sin moverte del sitio. No pasa nada, con mucha intensidad.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'descanso', escena: 'despedida', texto: 'De vuelta paras otra vez al resguardo, ya con la luz nueva. Sabe distinto y pesa menos.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'casa', escena: 'regreso', texto: 'Dame el parte, que lo anoto en el libro. Lo que se escribe aquí se queda para siempre, así que dilo con cuidado.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-camino-de-la-sal',
    titulo: 'El camino largo de la sal',
    gancho: 'Hay que traer sal desde donde la hay hasta donde hace falta, pasando por donde la piden. Es una jornada entera y todo el mundo lo sabe.',
    tamano: 'jornada',
    oficios: ['mercado', 'forja', 'taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'sal-repartida', escala: { veces: 2 }, detalle: { con: 'vecindario', motivo: 'camino-de-la-sal' } },
    },
    mote: 'la-de-la-sal',
    desenlace: {
      texto: 'La sal llega a donde tenía que llegar y sobra un puñado. Se guarda para el año que viene, como se hace desde siempre.',
      oro: 34,
      objetos: [{ id: 'saco-de-la-sal', clase: 'llave', procedencia: { plantilla: 'el-camino-de-la-sal' } }],
    },
    repuesto: {
      sinTi: 'La sal llegó en varios viajes y con retraso. Llegó, que es lo que cuenta en este asunto.',
      conLoConseguido: 'Vuelves con parte del reparto hecho. El resto se apunta y se termina otro día.',
    },
    relacion: [
      { rol: 'quien_pesa', signo: 'reparador', beat: 11, decision: 'devolver-el-sobrante-al-común' },
      { rol: 'quien_pesa', signo: 'feo', beat: 7, decision: 'aligerar-el-saco-por-el-camino' },
    ],
    revision: 'Es la plantilla larga del catálogo y el humor va en las paradas, no en el esfuerzo. Ninguna aldea queda como paleta.',
    orden: ['reparto', 'quien_pesa', 'salina', 'primera_parada', 'segunda_parada', 'alto'],
    roles: {
      // La lista de casas la lleva quien la lleva, con puesto de mercado o sin él:
      // atar la jornada larga a una plaza de abastos la dejaba fuera justo de los
      // sitios donde la sal se sigue repartiendo a pie.
      reparto: { tipo: 'nucleo', types: ['ciudad', 'pueblo', 'aldea'] },
      quien_pesa: { tipo: 'humano', en: 'reparto', puesto: 'vecindad' },
      salina: { tipo: 'nucleo', types: ['ciudad', 'pueblo', 'aldea'] },
      primera_parada: { tipo: 'nucleo', types: ['aldea', 'granja'] },
      segunda_parada: { tipo: 'nucleo', types: ['granja', 'aldea', 'pueblo'] },
      alto: { tipo: 'paraje', escena: 'encuentro' },
    },
    beats: [
      { rol: 'reparto', escena: 'encargo', texto: 'Te dan el saco vacío, la lista de casas y un consejo sobre el calzado.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'alto', escena: 'encuentro', texto: 'En el alto te cruzas con quien va en sentido contrario y os contáis las novedades.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'salina', escena: 'acarreo', texto: 'Cargas la sal. Pesa exactamente lo que te habían prometido que no pesaría.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'saco de sal' } },
      { rol: 'alto', escena: 'descanso', texto: 'Otra vez el alto, ahora con el saco a cuestas. Paras a respirar y a maldecir el consejo del calzado.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'primera_parada', escena: 'entrega', texto: 'En la casa de la lista piden más de lo apuntado, con una sonrisa muy trabajada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'alto', escena: 'espera', texto: 'De nuevo el alto. Aquí se decide siempre lo mismo: seguir un poco más antes de parar.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'segunda_parada', escena: 'entrega', texto: 'Aquí ya sabían que venías. También sabían cuánto traías, cosa que inquieta.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'alto', escena: 'vuelta', texto: 'El alto de vuelta, con el saco bastante más ligero. Ya conoces cada piedra y las saludas por costumbre.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'salina', escena: 'recarga', texto: 'Vuelves a por lo que faltaba. Te reciben como a alguien de la familia y te cobran igual.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'sal de recarga' } },
      { rol: 'alto', escena: 'despedida', texto: 'El alto por fin de bajada. Da hasta pena, y eso que llevas el día entero subiéndolo.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'reparto', escena: 'cierre', texto: 'Saco casi vacío y la lista tachada entera. Aquí eso es una hazaña, aunque de fuera nadie lo entienda.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'el-refugio-de-la-tormenta',
    titulo: 'El refugio que hay que dejar listo',
    gancho: 'Viene mal tiempo y el refugio del camino lleva tiempo sin que nadie lo mire. Conviene dejarlo listo antes de que haga falta.',
    tamano: 'paseo',
    oficios: ['forja', 'botica', 'taberna'],
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'refugio-preparado', escala: { veces: 1 }, detalle: { con: 'quien-avisa', motivo: 'mal-tiempo-que-viene' } },
    },
    mote: 'la-que-dejó-listo-el-refugio',
    desenlace: {
      texto: 'El refugio queda con leña seca, con la puerta que cierra y con una nota amable dentro. Esa noche lo usa alguien, y no se entera nunca de quién lo dejó así.',
      oro: 10,
      objetos: [],
    },
    repuesto: {
      sinTi: 'El refugio aguantó la noche como pudo, con la puerta suelta y sin leña. Aguantó.',
      conLoConseguido: 'Vuelves habiendo dejado la leña dentro. La puerta tendrá que esperar a mejor tiempo.',
    },
    relacion: [
      { rol: 'quien_avisa', signo: 'reparador', beat: 4, decision: 'no-firmar-la-nota' },
    ],
    revision: 'Sin sarcasmo: es la plantilla cálida del catálogo. El chiste, mínimo, está en la nota amable y anónima.',
    orden: ['taller', 'quien_avisa', 'refugio'],
    roles: {
      // La bisagra sale de donde haya un yunque, y el refugio del camino puede ser
      // el cobertizo del cruce: en un sitio de tres calles es exactamente eso.
      taller: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
      quien_avisa: { tipo: 'humano', en: 'taller', puesto: 'regencia' },
      refugio: { tipo: 'paraje', escena: ['refugio', 'encuentro'] },
    },
    beats: [
      { rol: 'taller', escena: 'encargo', texto: 'Te dan una bisagra nueva y una advertencia sobre el viento que resulta ser exacta.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'bisagra' } },
      { rol: 'refugio', escena: 'refugio', texto: 'El refugio está entero y desordenado. La puerta cuelga con una dignidad conmovedora.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'refugio', escena: 'arreglo', texto: 'Colocas la bisagra, apilas leña y dejas una nota. Todo tarda más de lo pensado.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'taller', escena: 'regreso', texto: 'Deja ahí las herramientas. No te voy a preguntar cómo fue, así que cuéntamelo por tu cuenta, que para eso has vuelto.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
];

/**
 * El catálogo con sus caras ya puestas, que es lo único que sale de aquí: ningún
 * consumidor puede ver una versión de las plantillas sin ellas. Dos catálogos con los
 * mismos identificadores y beats distintos son la clase de diferencia que se descubre
 * tarde, y `world/cupos.js`, el informe de casting y la batería importan esto directamente.
 */
export const TEMPLATES = ESCRITAS.map(conCaras);
