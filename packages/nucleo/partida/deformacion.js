// La escalera con la que se deforma un rumor al recontarse: cuatro niveles
// enumerados, el nivel que corresponde a unos saltos dados y la invariante de la
// que cuelga toda la fila — **el signo moral no se invierte nunca**.
//
// Opera sobre **hechos estructurados con ejes cerrados** y jamás sobre prosa, y es
// lo único que hace verificable «la deformación no invierte el signo moral» sin un
// narrador delante: con la versión guardada como texto, comprobarlo exigiría un
// LLM, que es exactamente lo que la batería `@nucleo` no puede tener
// (`quests.md` decisión 1, «si alguna regla bifurca por él, no lo escribe el modelo»).

import { congelaHondo } from '../core/congelar.js';
// La marca de suposición es la de SPEC-007 y no se vuelve a escribir aquí: dos
// enumerados del mismo campo en dos ficheros es como se desincronizan, y el
// precedente ya está en `filtro.js`, que la importa del mismo sitio.
import { MARCAS_DE_SUPOSICION, SUPOSICIONES } from '../world/grafo.js';

/**
 * El signo moral del acto: **enumerado cerrado de dos valores**, fijado al nacer y
 * de solo lectura.
 *
 * Sin neutro a propósito. La invariante que hay que poder verificar es «no se
 * invierte», y un tercer valor la debilita sin añadir nada que el diseño pida.
 */
export const SIGNOS = Object.freeze({ BUENO: 'bueno', FEO: 'feo' });

/** Los dos valores admitidos, en orden estable. */
export const IDS_DE_SIGNO = congelaHondo(Object.values(SIGNOS).sort());

/**
 * La escalera, literalmente la de `quests.md` §6: **0 fiel · 1 abultado ·
 * 2 trastocado · 3 leyenda**. Enumerada y no continua, porque de ella cuelgan
 * textos con fallback de plantilla y entre dos niveles no hay nada.
 */
export const NIVELES = congelaHondo([
  { nivel: 0, id: 'fiel' },
  { nivel: 1, id: 'abultado' },
  { nivel: 2, id: 'trastocado' },
  { nivel: 3, id: 'leyenda' },
]);

/** Los nombres de los cuatro niveles, en el orden de la escalera. */
export const IDS_DE_NIVEL = congelaHondo(NIVELES.map((n) => n.id));

/** El tope. No se rebasa nunca: cinco saltos siguen siendo nivel 3. */
export const NIVEL_MAXIMO = NIVELES.length - 1;

/**
 * Quién protagoniza unos hechos. **Enumerado cerrado**, y existe por una razón
 * concreta: el hito de fin de arranque se cumple cuando lo que se cuenta en un
 * núcleo **es la jugadora**, contado por otros (`game-design/arranque.md` §3), y
 * los sucesos del prólogo no pueden dispararlo. Con el protagonista como texto
 * libre, distinguir «lo hizo ella» de «lo hizo el pueblo» dependería de acertar a
 * escribir la misma cadena en dos módulos.
 *
 * `otro` es a quien el nivel 3 le atribuye lo que no hizo; `vecindario` es de quién
 * son las cosas que pasaron antes de que llegaras.
 */
export const PROTAGONISTAS = Object.freeze({ JUGADORA: 'jugadora', OTRO: 'otro', VECINDARIO: 'vecindario' });

/** Los tipos de protagonista admitidos, en orden estable. */
export const IDS_DE_PROTAGONISTA = congelaHondo(Object.values(PROTAGONISTAS).sort());

/**
 * Los ejes que la deformación puede tocar. **Catálogo cerrado, y el signo no es
 * uno de ellos**: esa ausencia es la invariante, no una convención.
 */
export const EJES_DEFORMABLES = congelaHondo(['escala', 'protagonista', 'detalle']);

/**
 * Las tres claves del detalle que importa, en orden declarado: «el motivo, el
 * lugar, con quién» (`quests.md` §6). El orden es alfabético y **no** el de
 * escritura, porque de él sale qué detalle se trastoca.
 */
export const CLAVES_DE_DETALLE = congelaHondo(['con', 'lugar', 'motivo']);

/** Cuánto crece la escala en el nivel 1: «uno se vuelve tres». */
export const FACTOR_DE_ABULTAMIENTO = 3;

// El catálogo se comprueba a sí mismo al cargarse, igual que el de efectos. Cierra
// la puerta por la que la invariante se rompería de verdad: no con una versión
// rara, sino con un eje nuevo añadido aquí dentro el día que alguien quiera
// «solo matizar si fue tan buena idea».
if (EJES_DEFORMABLES.includes('signo')) {
  throw new Error('el catálogo de ejes deformables declara "signo": la deformación cambia la escala, el protagonista y el detalle, y el signo no es un eje');
}

/** El signo, o un error que nombra lo que llegó. */
export function exigeSigno(valor, quien = 'el signo del rumor') {
  if (!IDS_DE_SIGNO.includes(valor)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(valor) ?? String(valor)}, que no está en el enumerado cerrado: ` +
      `los dos valores son ${IDS_DE_SIGNO.join(', ')}, y lo fija el código a partir del desenlace, nunca un texto`,
    );
  }
  return valor;
}

/** El nivel, entero de cero a tres, o un error que nombra el valor recibido. */
export function exigeNivel(nivel, quien = 'el nivel de deformación') {
  if (!Number.isInteger(nivel) || nivel < 0 || nivel > NIVEL_MAXIMO) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(nivel) ?? String(nivel)}: la escalera es enumerada y sus cuatro peldaños ` +
      `son 0 a ${NIVEL_MAXIMO} (${IDS_DE_NIVEL.join(', ')})`,
    );
  }
  return nivel;
}

/** Cómo se llama un nivel de la escalera. */
export function nombreDeNivel(nivel) {
  return NIVELES[exigeNivel(nivel)].id;
}

/**
 * El nivel que corresponde a unos saltos dados: `min(3, saltos + saltos que
 * cruzan un trozo sin calzada real)`.
 *
 * Tres cosas de esa fórmula son decisión y no aritmética. **Se cuentan saltos, no
 * metros**, porque deforma quien lo recuenta y eso es un acto social. **La
 * penalización es por salto y no por tramo**: un salto que cruza dos trozos
 * `fallback` suma uno, porque lo que se modela es que la noticia cruzó el monte y
 * no cuántas veces lo cruzó. Y **el tope no se rebasa nunca**: cinco saltos siguen
 * dando 3, que es la propiedad con la que se lee la fila `| 5 | 3 |` del esquema de
 * la batería sin suponer que un núcleo a cinco saltos llegue a oírlo.
 */
export function nivelDeSaltos(saltos, saltosPorElMonte = 0) {
  if (!Number.isInteger(saltos) || saltos < 0) {
    throw new Error(`el número de saltos llega como ${JSON.stringify(saltos) ?? String(saltos)}: se cuentan bocas que recuentan, con enteros no negativos`);
  }
  if (!Number.isInteger(saltosPorElMonte) || saltosPorElMonte < 0 || saltosPorElMonte > saltos) {
    throw new Error(
      `los saltos que cruzan un trozo sin calzada real llegan como ${JSON.stringify(saltosPorElMonte) ?? String(saltosPorElMonte)} ` +
      `sobre ${saltos} saltos: la penalización es por salto, así que no puede haber más penalizados que saltos`,
    );
  }
  return Math.min(NIVEL_MAXIMO, saltos + saltosPorElMonte);
}

/**
 * Si un tramo de calzada cuenta como «cruzó el monte».
 *
 * **`cosida` no penaliza y `fallback` sí**, y es la mitad que se pierde si alguien
 * colapsa el enumerado en un booleano: cruzar un hueco de 22 m que OSM no trae es
 * una carretera real que el dato no traía; cruzar un `fallback` es ir por donde no
 * hay camino que conozcamos. SPEC-007 distingue los tres valores exactamente por
 * esto —el filtro de accesibilidad trata igual a las dos marcas, la propagación
 * no— y un tramo sin marca **falla** en lugar de pasar por calzada real.
 */
export function cruzaElMonte(marca, quien = 'un tramo de calzada') {
  if (marca === undefined || !MARCAS_DE_SUPOSICION.includes(marca)) {
    throw new Error(
      `${quien} no declara su marca de suposición (llegó ${JSON.stringify(marca) ?? String(marca)}): ` +
      'sin ella no se puede calcular el nivel, y suponer que es calzada real es exactamente lo que la marca existe para impedir',
    );
  }
  return marca === SUPOSICIONES.FALLBACK;
}

function exigeDetalle(detalle, quien) {
  const d = detalle ?? {};
  if (typeof d !== 'object' || Array.isArray(d)) {
    throw new Error(`${quien}: el detalle de los hechos llega como ${JSON.stringify(detalle) ?? String(detalle)} y se espera un objeto con ${CLAVES_DE_DETALLE.join(', ')}`);
  }
  for (const clave of Object.keys(d)) {
    if (!CLAVES_DE_DETALLE.includes(clave)) {
      throw new Error(`${quien}: el detalle de los hechos declara "${clave}", que no está en el catálogo cerrado (${CLAVES_DE_DETALLE.join(', ')})`);
    }
  }
  return d;
}

// El signo no vive en los hechos y no puede colarse dentro por la puerta de atrás:
// si estuviera ahí, una transformación podría cambiarlo sin que la comprobación de
// la versión se enterara.
function sinSignoDentro(valor, ruta, quien) {
  if (!valor || typeof valor !== 'object') return;
  for (const clave of Object.keys(valor)) {
    if (clave === 'signo') {
      throw new Error(`${quien}: los hechos llevan un campo "signo" en ${ruta}.signo; el signo es del rumor, de solo lectura, y no un eje de la deformación`);
    }
    sinSignoDentro(valor[clave], `${ruta}.${clave}`, quien);
  }
}

/**
 * Los hechos de un rumor en su **versión fiel**, normalizados desde la semilla que
 * declara la plantilla.
 *
 * Que esta pieza exista es la razón de que la invariante sea comprobable: la
 * deformación es una función sobre datos con ejes cerrados, no sobre prosa.
 */
export function hechosFieles(semilla, { lugar = null, protagonista = null, quien = 'la semilla del rumor' } = {}) {
  if (!semilla || typeof semilla !== 'object' || Array.isArray(semilla)) {
    throw new Error(`${quien} llega como ${JSON.stringify(semilla) ?? String(semilla)}: se espera la semilla estructurada del rumor, con su asunto`);
  }
  sinSignoDentro(semilla, 'la semilla', quien);
  if (typeof semilla.asunto !== 'string' || !semilla.asunto) {
    throw new Error(`${quien} no declara "asunto": sin él no hay hechos que deformar ni que contar`);
  }
  const veces = semilla.escala?.veces ?? 1;
  if (!Number.isInteger(veces) || veces < 1) {
    throw new Error(`${quien} declara una escala de ${JSON.stringify(veces) ?? String(veces)} veces: se espera un entero positivo`);
  }
  const detalle = exigeDetalle(semilla.detalle, quien);
  // El protagonista fiel por defecto es la jugadora, porque un rumor nace del
  // desenlace de una aventura suya. El prólogo del mundo entra por aquí con otro
  // (`PROTAGONISTAS.VECINDARIO`): lo que pasó antes de que llegaras no lo hizo
  // ella, y de eso depende que el hito de fin de arranque no se dispare el día 1.
  const quienLoHizo = protagonista == null ? PROTAGONISTAS.JUGADORA : protagonista;
  if (!IDS_DE_PROTAGONISTA.includes(quienLoHizo)) {
    throw new Error(
      `${quien} declara el protagonista ${JSON.stringify(protagonista) ?? String(protagonista)}, que no está en el enumerado cerrado: ` +
      `los declarados son ${IDS_DE_PROTAGONISTA.join(', ')}`,
    );
  }
  return congelaHondo({
    asunto: semilla.asunto,
    escala: { veces },
    // El protagonista fiel es siempre quien lo hizo. Lo que el nivel 3 cambia es
    // esto, y por eso nace declarado en lugar de deducirse por ausencia.
    protagonista: { tipo: quienLoHizo, ref: null },
    detalle: {
      con: detalle.con ?? null,
      lugar: detalle.lugar ?? lugar,
      motivo: detalle.motivo ?? null,
    },
    trastocado: null,
    fundidoCon: null,
  });
}

/** Los hechos ya normalizados, o un error que dice qué les falta. */
export function exigeHechos(hechos, quien = 'los hechos del rumor') {
  if (!hechos || typeof hechos !== 'object' || Array.isArray(hechos)) {
    throw new Error(`${quien} llegan como ${JSON.stringify(hechos) ?? String(hechos)}: se esperan los hechos estructurados que devuelve hechosFieles()`);
  }
  if (typeof hechos.asunto !== 'string' || !hechos.asunto) throw new Error(`${quien} no declaran su asunto`);
  if (!Number.isInteger(hechos.escala?.veces)) throw new Error(`${quien} no declaran su escala`);
  if (!hechos.protagonista || typeof hechos.protagonista.tipo !== 'string') throw new Error(`${quien} no declaran su protagonista`);
  exigeDetalle(hechos.detalle, quien);
  sinSignoDentro(hechos, 'los hechos', quien);
  return hechos;
}

/**
 * La comprobación de la invariante, **sobre los datos estructurados y sin ninguna
 * red, ningún narrador y ningún texto**.
 *
 * Se rechaza nombrando el rumor y el núcleo, y quien llama no escribe nada: lo que
 * allí se cuenta no cambia.
 */
export function compruebaElSigno({ version, signo, rumor = '(sin identidad)', nucleo = '(sin núcleo)' }) {
  const esperado = exigeSigno(signo, `el signo de origen del rumor "${rumor}"`);
  const quien = `la deformación del rumor "${rumor}" en el núcleo "${nucleo}"`;
  if (version?.signo !== esperado) {
    throw new Error(
      `${quien} devolvió el signo ${JSON.stringify(version?.signo) ?? String(version?.signo)} y el de origen es "${esperado}": ` +
      'la deformación cambia la escala, el protagonista y el detalle, y nunca el signo; la versión se rechaza entera y lo que allí se cuenta no cambia',
    );
  }
  sinSignoDentro(version.hechos, 'los hechos de la versión', quien);
  return version;
}

// Elegir sobre una lista **ya ordenada**: el azar decide cuál, nunca el orden en
// que las cosas se insertaron en ningún sitio.
function eligeDe(lista, rng, quien) {
  if (typeof rng !== 'function') {
    throw new Error(`${quien} necesita el azar del paso: la deformación de un nivel 2 o 3 sortea, y sin generador no se puede sembrar`);
  }
  return lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))];
}

/**
 * Deforma unos hechos hasta un nivel de la escalera.
 *
 * **La escalera es acumulativa**: el 2 lleva encima lo que hizo el 1 y el 3 lo que
 * hicieron los dos. Es como se deforma algo que se recuenta, y además hace la
 * escalera monótona, que es lo que permite afirmar «el primero lo recibe más
 * deformado que el segundo» sin comparar ni un texto.
 *
 * @param {object} opciones
 *   `hechos` la versión fiel; `signo` el del rumor, de solo lectura; `nivel` el
 *   peldaño; `rng` el azar sembrado por paso, rumor y núcleo; `rumor` y `nucleo`
 *   para que el rechazo nombre a los dos; `anteriores` lo que ya sedimentó en ese
 *   núcleo, que es con lo que el nivel 3 puede fundirse.
 * @returns `{ nivel, escalon, signo, hechos, ejes }`, congelado. **Ni un texto**:
 *   la redacción viaja aparte y puede no existir todavía.
 */
export function deforma({ hechos, signo, nivel, rng = null, rumor = '(sin identidad)', nucleo = '(sin núcleo)', anteriores = [] }) {
  const fieles = exigeHechos(hechos, `los hechos del rumor "${rumor}"`);
  const s = exigeSigno(signo, `el signo del rumor "${rumor}"`);
  const n = exigeNivel(nivel, `el nivel con el que el rumor "${rumor}" llega al núcleo "${nucleo}"`);
  const quien = `la deformación del rumor "${rumor}" en el núcleo "${nucleo}"`;

  const ejes = [];
  let escala = { ...fieles.escala };
  let protagonista = { ...fieles.protagonista };
  let detalle = { ...fieles.detalle };
  let trastocado = null;
  let fundidoCon = null;

  // 1 · abultado: crece la escala, uno se vuelve tres.
  if (n >= 1) {
    escala = { veces: escala.veces * FACTOR_DE_ABULTAMIENTO };
    ejes.push('escala');
  }

  // 2 · trastocado: cambia el detalle que importa —el motivo, el lugar o con
  // quién—. Se trastoca **intercambiando** dos detalles del propio suceso en lugar
  // de inventar uno: el núcleo no tiene vocabulario que inventar, y una historia
  // con el lugar y el motivo cambiados de sitio es exactamente lo que se recuenta
  // mal. Con un solo detalle conocido no hay con qué cambiarlo y se pierde.
  if (n >= 2) {
    const conocidos = CLAVES_DE_DETALLE.filter((k) => detalle[k] != null);
    if (conocidos.length >= 2) {
      const clave = eligeDe(conocidos, rng, quien);
      const otras = conocidos.filter((k) => k !== clave);
      const otra = eligeDe(otras, rng, quien);
      detalle = { ...detalle, [clave]: fieles.detalle[otra], [otra]: fieles.detalle[clave] };
      trastocado = clave;
    } else if (conocidos.length === 1) {
      trastocado = conocidos[0];
      detalle = { ...detalle, [trastocado]: null };
    }
    ejes.push('detalle');
  }

  // 3 · leyenda: se le atribuye a otro, o se funde con un rumor viejo del mismo
  // núcleo. Sin nada con lo que fundirse **no se degrada el nivel**: se resuelve
  // por atribución, porque degradarlo haría que el estado de un núcleo dependiera
  // de cuántos rumores hubieran pasado antes por él.
  if (n >= 3) {
    const viejos = anteriores
      .filter((v) => v && typeof v.rumor === 'string' && v.rumor !== rumor)
      .slice()
      .sort((a, b) => (a.rumor < b.rumor ? -1 : a.rumor > b.rumor ? 1 : 0));
    if (viejos.length) {
      const viejo = eligeDe(viejos, rng, quien);
      fundidoCon = viejo.rumor;
      protagonista = { ...(viejo.hechos?.protagonista ?? { tipo: PROTAGONISTAS.OTRO, ref: null }) };
    } else {
      protagonista = { tipo: PROTAGONISTAS.OTRO, ref: null };
    }
    ejes.push('protagonista');
  }

  const version = {
    nivel: n,
    escalon: nombreDeNivel(n),
    // El signo viaja con la versión y **se copia del origen, nunca se calcula**:
    // no hay ninguna operación en este módulo que lo derive de los hechos.
    signo: s,
    hechos: { asunto: fieles.asunto, escala, protagonista, detalle, trastocado, fundidoCon },
    ejes,
  };
  return congelaHondo(compruebaElSigno({ version, signo: s, rumor, nucleo }));
}
