// Catálogo inicial de plantillas-arquetipo de quest (game-design/quests.md).
//
// Una plantilla define ROLES abstractos ("una taberna", "un paraje con guarida")
// y una secuencia de beats sobre esos roles. El casting (casting.js) resuelve
// los roles contra un mundo concreto. Los textos son el fallback digno que la
// spec exige: en el juego final un LLM los vestirá por mundo, pero la quest
// funciona igual sin él.
//
// Tipos de rol:
//   { tipo: 'servicio', kind: 'taberna'|'posada'|'boticario'|'armeria'|'conjureria'|'mercado' }
//   { tipo: 'nucleo', types: ['ciudad','pueblo','aldea','granja'] }
//   { tipo: 'paraje', escena: 'guarida'|'emboscada'|..., minPeso?: 0.2 }
//   { tipo: 'humano', en: '<rol de sitio>', puesto?: '...' }   ← lo produce el sitio
//
// Cada plantilla declara además tres cosas que el casting verifica y no deduce:
//
//   `tamano`  cuál de los tres tamaños de salida es, con una palabra del mundo
//             (`bucle-jugable.md` §3). El casting comprueba que cabe; deducirlo de
//             los minutos que salgan sería decidirlo con una fórmula.
//   `orden`   en qué orden se resuelven los roles. **Se declara**: sacarlo de las
//             claves del objeto lo hacía depender del orden de escritura, que es el
//             patrón que `CLAUDE.md` prohíbe.
//   Y cada beat, su `disparador` (`llegada` · `franja` · `con_objeto`) y su
//   `resultado` (`informacion` · `objeto` · `estado`), que son los dos campos de
//   `quests.md` §2 que hasta ahora estaban escritos y sin usar.
//
//   `rumor`   si su desenlace es notable, con qué semilla nace y cuál es el signo
//             del acto (`quests.md` §6). **Se declara y no se deduce** del texto
//             del desenlace ni de la recompensa: con una declaración opcional, «no
//             es notable» y «se me olvidó decirlo» son indistinguibles, y media
//             aventura se quedaría sin rumor sin que nadie se enterara. La semilla
//             son **hechos estructurados** —asunto, escala y el detalle que
//             importa— y no prosa: es lo que hace verificable que la deformación no
//             invierte el signo sin un narrador delante. Los valores del detalle
//             son identificadores del suceso, nunca texto que se enseñe.
//             Mientras el catálogo de la fila 17 no exista, estas seis son la
//             declaración viva.

export const TEMPLATES = [
  {
    id: 'entrega-sospechosa',
    titulo: 'La entrega sospechosa',
    gancho: 'El tabernero desliza un paquete envuelto en hule por encima del mostrador: «Llévaselo al herrero. No preguntes. Y si alguien te sale al paso… no era mío».',
    tamano: 'paseo',
    // El signo declarado es el del desenlace de la plantilla; si la partida ofrece
    // otra salida —vender el paquete en el paraje— el desenlace trae el suyo y ese
    // manda. Lo que nunca cambia es que el signo lo fija el código.
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'paquete-entregado', escala: { veces: 1 }, detalle: { con: 'herrero', motivo: 'encargo-de-la-taberna' } },
    },
    orden: ['origen', 'riesgo', 'destino'],
    roles: {
      origen: { tipo: 'servicio', kind: 'taberna' },
      riesgo: { tipo: 'paraje', escena: 'guarida' },
      destino: { tipo: 'servicio', kind: 'armeria' },
    },
    beats: [
      { rol: 'origen', escena: 'encargo', texto: 'Recibes el paquete y las señas del herrero.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'paquete' } },
      { rol: 'riesgo', escena: 'guarida', texto: 'Alguien sale de entre las sombras y ofrece comprar el paquete. Decide.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      {
        rol: 'destino',
        escena: 'entrega',
        texto: 'El herrero abre el paquete y por fin entiendes qué llevabas.',
        // El objeto es una llave: si lo vendiste en el paraje anterior, el herrero
        // te lo saca igual. Sin esta vía la plantilla no castearía, y es a propósito.
        disparador: {
          tipo: 'con_objeto',
          objeto: 'paquete',
          viaAlternativa: { texto: 'Llegas con las manos vacías y el herrero, que ya lo sabe, te cuenta qué había dentro para que cargues con ello de otra manera.' },
        },
        resultado: { tipo: 'informacion' },
      },
      { rol: 'origen', escena: 'recompensa', texto: 'De vuelta en la taberna te espera la paga… y una historia.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'cita-en-la-fuente',
    titulo: 'La cita al caer la tarde',
    gancho: 'Una nota doblada bajo tu puerta en la posada: «Si quieres saber la verdad, ven donde susurra el agua cuando el sol se esconda. Ven sin compañía».',
    tamano: 'paseo',
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'verdad-sacada-a-la-luz', escala: { veces: 1 }, detalle: { con: 'encapuchada', motivo: 'nota-bajo-la-puerta' } },
    },
    orden: ['dador', 'cita', 'confidente'],
    roles: {
      dador: { tipo: 'servicio', kind: 'posada' },
      cita: { tipo: 'paraje', escena: 'encuentro' },
      confidente: { tipo: 'servicio', kind: 'mercado' },
    },
    beats: [
      { rol: 'dador', escena: 'hallazgo', texto: 'Encuentras la nota y decides acudir.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      {
        rol: 'cita',
        escena: 'encuentro',
        texto: 'La figura encapuchada te cuenta lo que nadie quiere decir en voz alta.',
        // La franja es del beat, no de la persona (`npcs.md` §3). Llegar dentro abre
        // una puerta extra; llegar fuera resuelve el beat igual y con el mismo
        // resultado: solo cambia la variante de escena.
        disparador: { tipo: 'franja', franja: 'atardecer', variante: 'Llegas con la última luz y la ves antes de que ella te vea.' },
        resultado: { tipo: 'informacion' },
      },
      { rol: 'confidente', escena: 'verificación', texto: 'El mercader confirma la historia y añade el nombre que faltaba.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'dador', escena: 'decisión', texto: 'De vuelta en la posada, decides qué hacer con la verdad.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'tres-pistas',
    titulo: 'El rastro de las tres pistas',
    gancho: 'Ha desaparecido algo valioso y nadie vio nada. Tres rumores, tres lugares: alguien miente, y caminando se descubre a los mentirosos.',
    // Seis beats y cinco sitios: es la única del catálogo que no es un paseo.
    tamano: 'aventura',
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'culpable-senalado', escala: { veces: 1 }, detalle: { con: 'culpable', motivo: 'robo-sin-testigos' } },
    },
    orden: ['origen', 'pista1', 'pista2', 'pista3', 'resolucion'],
    roles: {
      origen: { tipo: 'servicio', kind: 'taberna' },
      pista1: { tipo: 'paraje', escena: 'misterio' },
      pista2: { tipo: 'nucleo', types: ['aldea', 'granja'] },
      pista3: { tipo: 'servicio', kind: 'boticario' },
      resolucion: { tipo: 'nucleo', types: ['ciudad', 'pueblo'] },
    },
    beats: [
      { rol: 'origen', escena: 'encargo', texto: 'En la taberna te cuentan los tres rumores.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pista1', escena: 'misterio', texto: 'Entre las piedras encuentras la primera pista: huellas que no deberían estar ahí.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pista2', escena: 'testigo', texto: 'Un vecino asustado te dice a quién vio pasar de madrugada.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'pista3', escena: 'prueba', texto: 'El boticario reconoce el ungüento: solo lo compra una persona.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'frasco de ungüento' } },
      { rol: 'resolucion', escena: 'resolución', texto: 'Con las tres pistas, señalas al culpable ante todos.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'origen', escena: 'celebración', texto: 'En la taberna corre la voz: fuiste tú quien lo resolvió. La primera ronda es gratis.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'ronda-del-vigia',
    titulo: 'La ronda del vigía',
    gancho: 'El vigía está viejo y la ronda es larga: «Hazla tú por mí esta vez. Mira desde lo alto, pasa por el cruce, y cuéntame TODO lo que veas. Todo».',
    tamano: 'paseo',
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'ronda-cumplida', escala: { veces: 1 }, detalle: { con: 'vigia', motivo: 'emboscada-en-el-paso' } },
    },
    orden: ['cuartel', 'alto', 'paso'],
    roles: {
      cuartel: { tipo: 'nucleo', types: ['pueblo', 'ciudad'] },
      alto: { tipo: 'paraje', escena: ['vigilancia', 'revelación'] }, // cualquier sitio desde donde se ve lejos
      paso: { tipo: 'paraje', escena: 'emboscada' },
    },
    beats: [
      { rol: 'cuartel', escena: 'encargo', texto: 'El vigía te entrega su catalejo y la ruta de la ronda.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'catalejo del vigía' } },
      { rol: 'alto', escena: 'vigilancia', texto: 'Desde lo alto ves algo que no encaja: un brillo donde no debería haber nadie.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'paso', escena: 'emboscada', texto: 'En el cruce te esperan. No querían ser vistos.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'cuartel', escena: 'informe', texto: 'El vigía escucha tu informe y palidece: «Así que han vuelto…».', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'peregrinaje',
    titulo: 'El pequeño peregrinaje',
    gancho: 'Para curar lo que la botica no cura, el remedio antiguo: rezar donde se reza, y dejar una ofrenda donde los antiguos escuchaban.',
    tamano: 'paseo',
    // La única del catálogo cuyo desenlace **no** es notable, y a propósito: un
    // remedio que se pide en voz baja no lo cuenta nadie por los caminos. Existe
    // para que «el rumor solo aparece si el desenlace era notable» tenga un caso
    // vivo y no haya que fabricarlo.
    rumor: { notable: false },
    orden: ['origen', 'templo', 'antiguo'],
    roles: {
      origen: { tipo: 'nucleo', types: ['aldea', 'pueblo'] },
      templo: { tipo: 'paraje', escena: 'ritual' },
      antiguo: { tipo: 'paraje', escena: 'misterio' },
    },
    beats: [
      { rol: 'origen', escena: 'súplica', texto: 'Te confían la ofrenda y las palabras exactas que hay que decir.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'ofrenda' } },
      { rol: 'templo', escena: 'ritual', texto: 'Enciendes la vela y dices las palabras. El silencio responde.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'antiguo', escena: 'ofrenda', texto: 'Dejas la ofrenda sobre la piedra. Algo, en alguna parte, la acepta.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      { rol: 'origen', escena: 'regreso', texto: 'Vuelves con la señal de que el remedio está en marcha.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
  {
    id: 'rescate-en-la-granja',
    titulo: 'El zagal perdido',
    gancho: 'En la granja falta el zagal desde el alba. El perro volvió solo, mirando hacia el camino. La granjera no llora: aprieta los puños y te mira a ti.',
    tamano: 'paseo',
    rumor: {
      notable: true,
      signo: 'bueno',
      semilla: { asunto: 'zagal-rescatado', escala: { veces: 1 }, detalle: { con: 'zagal', motivo: 'desaparicion-al-alba' } },
    },
    orden: ['granja', 'peligro', 'botica'],
    roles: {
      granja: { tipo: 'nucleo', types: ['granja'] },
      peligro: { tipo: 'paraje', escena: 'emboscada' },
      botica: { tipo: 'servicio', kind: 'boticario' },
    },
    beats: [
      { rol: 'granja', escena: 'súplica', texto: 'La granjera te da el silbato del zagal: «Él lo reconocerá».', disparador: { tipo: 'llegada' }, resultado: { tipo: 'objeto', objeto: 'silbato del zagal' } },
      {
        rol: 'peligro',
        escena: 'rescate',
        texto: 'Lo encuentras escondido, con el tobillo torcido y una historia increíble.',
        disparador: {
          tipo: 'con_objeto',
          objeto: 'silbato del zagal',
          viaAlternativa: { texto: 'Sin el silbato tardas más: lo llamas a voces hasta que responde desde debajo de las zarzas.' },
        },
        resultado: { tipo: 'estado' },
      },
      { rol: 'botica', escena: 'curas', texto: 'El boticario venda el tobillo y frunce el ceño con la historia del zagal.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
      { rol: 'granja', escena: 'reunión', texto: 'El reencuentro. La granjera por fin llora. Hay pan recién hecho para ti.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    ],
  },
];
