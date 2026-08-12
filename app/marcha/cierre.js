// El cierre de una salida, cableado: **echar el telón**, una sola vez y por las tres vías.
//
// Es la otra mitad de lo que SPEC-049 vino a coser. Medido con grep antes de escribirlo, nadie
// desde `app/` llamaba a `echaElTelon`, ni a `componeElTelon`, ni a `componeElDesenlace`, ni a
// `apuntaHaberEstado`: sus únicos consumidores estaban en `test/nucleo/`. Consecuencia medida:
// volver a casa dejaba el telón sin leer y nadie lo componía, la lista de ascensos habría
// salido siempre vacía y RF-BUCLE-012 no se habría cumplido nunca.
//
// **Aquí no se decide nada del juego.** Qué entra en un telón, en qué orden van sus pantallas,
// cómo acabó la aventura y qué se ingresa lo deciden `partida/cierre-de-salida.js` y
// `partida/telon.js` desde SPEC-036, y lo único que faltaba era esto: alguien que reuniera lo
// que hace falta y los llamara. **El núcleo entra por la puerta** (SPEC-020, §6u).
//
// Tres cosas que este módulo existe para sostener, y las tres son de orden:
//
// - **El telón se echa al montarse su pantalla, no al cerrar la salida.** `salidas.js` sostiene
//   «cerrada sin leer» durante días y el telón es lo primero que la app enseña al abrirse, así
//   que nada de lo que el cierre escribe es observable antes. La alternativa —echarlo al
//   cerrar— obliga a guardar la composición entera dentro de `AREA_SALIDAS`, que declara «ni un
//   campo más».
// - **Una sola vez.** Quien decide si ya se echó no es una bandera de esta capa: es el propio
//   estado. `echaElTelon` cierra el registro de la salida abierta en su paso 9, así que
//   `salidaAbierta(estado.aventuras)` en nulo con un telón sin leer significa exactamente «ya
//   se echó y todavía no se ha leído», y entonces lo que se enseña es su última pantalla
//   recompuesta del diario.
// - **El libro de pendientes se deriva de las llegadas que el estado ya guarda.**
//   `conocimiento.js` lo pone fuera del estado a propósito, para que «el mapa no cambia durante
//   la salida» sea comprobable; y el área `llegadas` guarda el sitio de cada llegada de esta
//   salida, así que reconstruirlo es derivarlo y no inventárselo. Eso es lo que hace que
//   entintar sobreviva a que el sistema mate el proceso a mitad de camino.

/** Lo que esto le pide al generador, enumerado. Ni una función más. */
export const DEL_NUCLEO = Object.freeze([
  'echaElTelon',
  'piezasDeSerie',
  'componeElTelon',
  'componeElDesenlace',
  'repuestoDe',
  'salidaAbierta',
  'aventuraEnCurso',
  'telonPendiente',
  'libroDePendientes',
  'apuntaHaberEstado',
  'sitiosConPosicion',
  'entradasDe',
  'proyeccion',
  'estadoDeMapa',
  'namesFor',
  'CATALOGO',
  'VIAS_DE_CIERRE',
  'MOTIVOS_DE_CIERRE',
]);

function exigeNucleo(nucleo, quien) {
  if (!nucleo) throw new Error(`${quien} necesita el núcleo inyectado: es quien compone el telón y quien decide qué entra en él`);
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] == null);
  if (faltan.length) throw new Error(`al núcleo inyectado le faltan ${faltan.length} pieza(s) del cierre de la salida: ${faltan.join(', ')}`);
  return nucleo;
}

/**
 * Por qué vía se cerró, traducido del motivo que guarda el área de salidas.
 *
 * Son dos vocabularios distintos y a propósito: `salidas.js` distingue tres motivos —el
 * regreso, el rótulo del sistema y la portada— porque el diario querrá contarlos, y el cierre
 * distingue dos vías porque `bucle-jugable.md` §8 dice que cerrar a mano «no es una salida de
 * emergencia sino la misma puerta en otro sitio». Volver es volver; las otras dos son dejarlo.
 */
export function viaDelCierre(nucleo, motivo) {
  return motivo === nucleo.MOTIVOS_DE_CIERRE.REGRESO ? nucleo.VIAS_DE_CIERRE.VOLVER : nucleo.VIAS_DE_CIERRE.DEJARLO_AQUI;
}

/**
 * Las llegadas de esta salida que el estado guarda, en el orden en que se validaron.
 *
 * Se leen del área entera filtrando por mapa y **no se cruzan con la identidad de la salida**.
 * El área se vacía sola al cambiar de salida (`creaLlegadas` lo hace cuando `registro.salida`
 * no es la que se le pide), así que lo que hay dentro es de la salida que se cierra. Cruzarlas
 * con la identidad tendría además un caso vivo que no debe fallar: una partida congelada a
 * mitad de salida por una compilación anterior lleva la identidad vieja del área `salidas` aquí
 * y la vieja del área `aventuras` allí, y esas dos nunca coincidieron.
 */
export function llegadasDeLaSalida(estado, mapaId) {
  return (estado?.llegadas?.llegadas ?? []).filter((l) => l.mapa === mapaId);
}

/** Los sitios por los que se pasó, en orden y sin repetir. Es lo que enseña el día sin tinta. */
export function porDondeSePaso(estado, mapaId) {
  const vistos = [];
  for (const llegada of llegadasDeLaSalida(estado, mapaId)) {
    if (!vistos.includes(llegada.sitio)) vistos.push(llegada.sitio);
  }
  return vistos;
}

/**
 * El libro de pendientes de conocimiento de la salida, **derivado**.
 *
 * Una anotación por sitio al que se llegó, con la familia que le da su geofence —núcleo,
 * servicio o paraje— y por la vía de las piernas, que es la única que producen unas llegadas.
 * La otra vía, la boca de otro, la produce el motor de pasos del mundo y **no tiene llamador
 * en `app/`**: queda declarada como pendiente en la spec y no se cablea de paso.
 */
export function pendientesDeLaSalida(nucleo, { estado, mundo, mapaId }) {
  const libro = nucleo.libroDePendientes();
  const sitios = nucleo.sitiosConPosicion(mundo);
  for (const llegada of llegadasDeLaSalida(estado, mapaId)) {
    const geofence = sitios.get(llegada.sitio);
    if (!geofence) continue;
    nucleo.apuntaHaberEstado(libro, { familia: geofence.tipo, id: llegada.sitio });
  }
  return libro;
}

/** La plantilla del catálogo, o un error que la nombra. Es una de las cuatro inyecciones. */
export function plantillaDelCatalogo(nucleo, id) {
  const plantilla = nucleo.CATALOGO.find((p) => p.id === id);
  if (!plantilla) {
    throw new Error(
      `la aventura en curso es de la plantilla "${id}" y el catálogo no la trae: de ella salen el desenlace, los dos repuestos, ` +
      'el mote y la declaración de rumor, así que sin ella se echaría un telón sin desenlace',
    );
  }
  return plantilla;
}

/** La aventura casteada de una plantilla dentro del mundo congelado, o `null`. */
function casteadaDe(mundo, plantilla) {
  return (mundo?.casting ?? []).find((c) => c.ok && c.plantilla === plantilla) ?? null;
}

/**
 * Dónde se cierra el día.
 *
 * El último sitio al que se llegó, y si no se llegó a ninguno, donde la salida anotó que se
 * quedó; y de último recurso el primer núcleo del mundo, que es determinista porque el
 * documento no se regenera. `hojaDelDia` exige un sitio del mundo y no admite nulo: un paseo
 * en el que no se validó ninguna llegada sigue siendo un día que pasó y tiene que tener hoja.
 */
export function lugarDelCierre({ estado, mundo, mapaId, abierta }) {
  const suyas = llegadasDeLaSalida(estado, mapaId);
  if (suyas.length) return suyas[suyas.length - 1].sitio;
  if (typeof abierta?.sitio === 'string' && abierta.sitio) return abierta.sitio;
  const primero = (mundo?.settlements ?? [])[0]?.name ?? null;
  if (!primero) throw new Error('el mundo congelado no tiene ningún núcleo con el que nombrar dónde se cierra el día');
  return primero;
}

/** El último núcleo al que se llegó, que es la condición del hito, o `null`. */
export function nucleoDelCierre(nucleo, { estado, mundo, mapaId }) {
  const sitios = nucleo.sitiosConPosicion(mundo);
  const suyas = llegadasDeLaSalida(estado, mapaId);
  for (let i = suyas.length - 1; i >= 0; i--) {
    if (sitios.get(suyas[i].sitio)?.tipo === 'nucleo') return suyas[i].sitio;
  }
  return null;
}

/**
 * Echa el telón de la salida que está abierta.
 *
 * Reúne lo que `echaElTelon` exige y lo llama **una vez**. No decide cuándo se cierra la
 * salida —eso es de SPEC-030— y no marca el telón como leído, que es un toque de quien lo lee.
 *
 * @param {object} piezas
 *   `nucleo` el generador con lo que enumera `DEL_NUCLEO`; `estado` el estado vivo de la
 *   partida; `registro` su registro de hechos; `calendario` el de la partida, inyectado;
 *   `mundo` el documento congelado del mapa activo; `mapaId`.
 * @returns lo que devuelve `echaElTelon`, con su telón dentro.
 */
export function echaElTelonDeLaSalida({ nucleo, estado, registro, calendario, mundo, mapaId }) {
  exigeNucleo(nucleo, 'el cierre de la salida');
  if (!mundo) {
    throw new Error('el cierre de la salida necesita el documento del mundo congelado: de él salen el entintado del mapa y el árbol de calzadas del rumor');
  }
  const abierta = nucleo.salidaAbierta(estado.aventuras);
  if (!abierta) {
    throw new Error(
      'no hay ninguna salida abierta cuyo telón echar: el telón se echa una sola vez, y echarlo dos veces entintaría dos veces ' +
      'e ingresaría el oro dos veces',
    );
  }
  const cerrada = nucleo.telonPendiente(estado.salidas);
  const enCurso = nucleo.aventuraEnCurso(estado.aventuras);

  // La aventura, su plantilla y su desenlace. El desenlace **solo si la cadena se acabó**: con
  // beats sin resolver el telón enseña el cierre en corto, y quien lo declara es el motor.
  let aventura = null;
  let desenlace = null;
  let repuesto = null;
  if (enCurso) {
    const plantilla = plantillaDelCatalogo(nucleo, enCurso.plantilla);
    const casteada = casteadaDe(mundo, enCurso.plantilla);
    if (!casteada) {
      throw new Error(
        `la aventura en curso es de la plantilla "${enCurso.plantilla}" y el casting del mundo congelado no la trae: ` +
        'sin su cadena no se sabe ni dónde acabó, así que el desenlace no se puede componer',
      );
    }
    aventura = casteada.aventura;
    repuesto = nucleo.repuestoDe(plantilla);
    if (enCurso.beatEnCurso === null) {
      desenlace = nucleo.componeElDesenlace({ plantilla, aventura, salida: abierta.salida });
    }
  }

  return nucleo.echaElTelon({
    estado,
    registro,
    calendario,
    mundo,
    mapaId,
    salida: abierta.salida,
    paso: nucleo.estadoDeMapa(estado.pasos, mapaId).n,
    via: viaDelCierre(nucleo, cerrada?.motivo ?? null),
    pendientes: pendientesDeLaSalida(nucleo, { estado, mundo, mapaId }),
    lugar: lugarDelCierre({ estado, mundo, mapaId, abierta }),
    aventura,
    desenlace,
    repuesto,
    nucleo: nucleoDelCierre(nucleo, { estado, mundo, mapaId }),
    idioma: nucleo.namesFor(mundo.locale),
    porDondeSePaso: porDondeSePaso(estado, mapaId),
    piezas: nucleo.piezasDeSerie(),
  });
}

/**
 * La última pantalla del telón, **recompuesta del diario**, para cuando la app murió entre
 * echarlo y marcarlo como leído.
 *
 * Es la decisión asumida de SPEC-049 y no un hueco: volver a echarlo entintaría dos veces e
 * ingresaría el oro dos veces, y una pantalla de avería sin acción dejaría la app encallada
 * sin poder abrir ninguna salida (§10h). La entrada del diario es la única pieza de la
 * secuencia que el estado guarda entera y es la que `bucle-jugable.md` §8 declara que siempre
 * está y cierra, así que es la que se enseña, con sus dos salidas intactas.
 */
export function laEntradaDelDiaRecompuesta({ nucleo, estado, mapaId }) {
  exigeNucleo(nucleo, 'la entrada del día del telón ya echado');
  const entradas = nucleo.entradasDe(estado.diario, { mapaId });
  const propias = entradas.filter((e) => e.clase === 'lo-propio');
  const hoja = propias.length ? propias[propias.length - 1] : null;
  if (!hoja) {
    throw new Error(
      'el telón de esta salida ya se echó y su entrada del diario no está en la partida: la hoja de hoy la escribe el cierre, ' +
      'así que sin ella no hay ninguna manera honesta de recomponer lo que pasó',
    );
  }
  const cerradas = estado.aventuras?.cerradas ?? [];
  const suya = cerradas.length ? cerradas[cerradas.length - 1] : null;
  const plantilla = suya ? nucleo.CATALOGO.find((p) => p.id === suya.plantilla) ?? null : null;
  const compuesto = nucleo.componeElTelon({
    mapaId,
    dia: hoja.dia,
    entradaDelDiario: hoja,
    oido: nucleo.proyeccion(entradas.filter((e) => e.dia === hoja.dia && e.clase === 'lo-oido')),
    aventura: plantilla ? { id: plantilla.id, titulo: plantilla.titulo } : null,
    cierreEnCorto: suya?.comoAcabo === 'a-medias' ? { texto: '' } : null,
  });
  // La última, que es siempre la entrada del diario: `componeElTelon` la pone al final de toda
  // secuencia y no hay ninguna rama en la que falte.
  return compuesto.pantallas[compuesto.pantallas.length - 1];
}
