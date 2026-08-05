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

export const TEMPLATES = [
  {
    id: 'entrega-sospechosa',
    titulo: 'La entrega sospechosa',
    gancho: 'El tabernero desliza un paquete envuelto en hule por encima del mostrador: «Llévaselo al herrero. No preguntes. Y si alguien te sale al paso… no era mío».',
    roles: {
      origen: { tipo: 'servicio', kind: 'taberna' },
      riesgo: { tipo: 'paraje', escena: 'guarida' },
      destino: { tipo: 'servicio', kind: 'armeria' },
    },
    beats: [
      { rol: 'origen', escena: 'encargo', texto: 'Recibes el paquete y las señas del herrero.' },
      { rol: 'riesgo', escena: 'guarida', texto: 'Alguien sale de entre las sombras y ofrece comprar el paquete. Decide.' },
      { rol: 'destino', escena: 'entrega', texto: 'El herrero abre el paquete y por fin entiendes qué llevabas.' },
      { rol: 'origen', escena: 'recompensa', texto: 'De vuelta en la taberna te espera la paga… y una historia.' },
    ],
  },
  {
    id: 'cita-en-la-fuente',
    titulo: 'La cita al caer la tarde',
    gancho: 'Una nota doblada bajo tu puerta en la posada: «Si quieres saber la verdad, ven donde susurra el agua cuando el sol se esconda. Ven sin compañía».',
    roles: {
      dador: { tipo: 'servicio', kind: 'posada' },
      cita: { tipo: 'paraje', escena: 'encuentro' },
      confidente: { tipo: 'servicio', kind: 'mercado' },
    },
    beats: [
      { rol: 'dador', escena: 'hallazgo', texto: 'Encuentras la nota y decides acudir.' },
      { rol: 'cita', escena: 'encuentro', texto: 'La figura encapuchada te cuenta lo que nadie quiere decir en voz alta.' },
      { rol: 'confidente', escena: 'verificación', texto: 'El mercader confirma la historia y añade el nombre que faltaba.' },
      { rol: 'dador', escena: 'decisión', texto: 'De vuelta en la posada, decides qué hacer con la verdad.' },
    ],
  },
  {
    id: 'tres-pistas',
    titulo: 'El rastro de las tres pistas',
    gancho: 'Ha desaparecido algo valioso y nadie vio nada. Tres rumores, tres lugares: alguien miente, y caminando se descubre a los mentirosos.',
    roles: {
      origen: { tipo: 'servicio', kind: 'taberna' },
      pista1: { tipo: 'paraje', escena: 'misterio' },
      pista2: { tipo: 'nucleo', types: ['aldea', 'granja'] },
      pista3: { tipo: 'servicio', kind: 'boticario' },
      resolucion: { tipo: 'nucleo', types: ['ciudad', 'pueblo'] },
    },
    beats: [
      { rol: 'origen', escena: 'encargo', texto: 'En la taberna te cuentan los tres rumores.' },
      { rol: 'pista1', escena: 'misterio', texto: 'Entre las piedras encuentras la primera pista: huellas que no deberían estar ahí.' },
      { rol: 'pista2', escena: 'testigo', texto: 'Un vecino asustado te dice a quién vio pasar de madrugada.' },
      { rol: 'pista3', escena: 'prueba', texto: 'El boticario reconoce el ungüento: solo lo compra una persona.' },
      { rol: 'resolucion', escena: 'resolución', texto: 'Con las tres pistas, señalas al culpable ante todos.' },
      { rol: 'origen', escena: 'celebración', texto: 'En la taberna corre la voz: fuiste tú quien lo resolvió. La primera ronda es gratis.' },
    ],
  },
  {
    id: 'ronda-del-vigia',
    titulo: 'La ronda del vigía',
    gancho: 'El vigía está viejo y la ronda es larga: «Hazla tú por mí esta vez. Mira desde lo alto, pasa por el cruce, y cuéntame TODO lo que veas. Todo».',
    roles: {
      cuartel: { tipo: 'nucleo', types: ['pueblo', 'ciudad'] },
      alto: { tipo: 'paraje', escena: ['vigilancia', 'revelación'] }, // cualquier sitio desde donde se ve lejos
      paso: { tipo: 'paraje', escena: 'emboscada' },
    },
    beats: [
      { rol: 'cuartel', escena: 'encargo', texto: 'El vigía te entrega su catalejo y la ruta de la ronda.' },
      { rol: 'alto', escena: 'vigilancia', texto: 'Desde lo alto ves algo que no encaja: un brillo donde no debería haber nadie.' },
      { rol: 'paso', escena: 'emboscada', texto: 'En el cruce te esperan. No querían ser vistos.' },
      { rol: 'cuartel', escena: 'informe', texto: 'El vigía escucha tu informe y palidece: «Así que han vuelto…».' },
    ],
  },
  {
    id: 'peregrinaje',
    titulo: 'El pequeño peregrinaje',
    gancho: 'Para curar lo que la botica no cura, el remedio antiguo: rezar donde se reza, y dejar una ofrenda donde los antiguos escuchaban.',
    roles: {
      origen: { tipo: 'nucleo', types: ['aldea', 'pueblo'] },
      templo: { tipo: 'paraje', escena: 'ritual' },
      antiguo: { tipo: 'paraje', escena: 'misterio' },
    },
    beats: [
      { rol: 'origen', escena: 'súplica', texto: 'Te confían la ofrenda y las palabras exactas que hay que decir.' },
      { rol: 'templo', escena: 'ritual', texto: 'Enciendes la vela y dices las palabras. El silencio responde.' },
      { rol: 'antiguo', escena: 'ofrenda', texto: 'Dejas la ofrenda sobre la piedra. Algo, en alguna parte, la acepta.' },
      { rol: 'origen', escena: 'regreso', texto: 'Vuelves con la señal de que el remedio está en marcha.' },
    ],
  },
  {
    id: 'rescate-en-la-granja',
    titulo: 'El zagal perdido',
    gancho: 'En la granja falta el zagal desde el alba. El perro volvió solo, mirando hacia el camino. La granjera no llora: aprieta los puños y te mira a ti.',
    roles: {
      granja: { tipo: 'nucleo', types: ['granja'] },
      peligro: { tipo: 'paraje', escena: 'emboscada' },
      botica: { tipo: 'servicio', kind: 'boticario' },
    },
    beats: [
      { rol: 'granja', escena: 'súplica', texto: 'La granjera te da el silbato del zagal: «Él lo reconocerá».' },
      { rol: 'peligro', escena: 'rescate', texto: 'Lo encuentras escondido, con el tobillo torcido y una historia increíble.' },
      { rol: 'botica', escena: 'curas', texto: 'El boticario venda el tobillo y frunce el ceño con la historia del zagal.' },
      { rol: 'granja', escena: 'reunión', texto: 'El reencuentro. La granjera por fin llora. Hay pan recién hecho para ti.' },
    ],
  },
];
