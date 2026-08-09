// El vocabulario de las capacidades de plataforma: cuáles hay, en qué orden se
// enumeran y qué forma tiene lo que responde una sonda. Vive aparte del registro
// porque los módulos también lo necesitan y no deben depender de quien los monta.

/**
 * Las cinco capacidades, en el orden estable en el que se enumeran siempre.
 * Estable quiere decir que no depende del orden en que se inyectaron los módulos:
 * una lista que se reordena sola es una lista que no se puede comparar entre dos
 * ejecuciones ni entre dos plataformas.
 *
 * `rotulo` entra la última, de SPEC-030, y es la única cuya ausencia **no** admite
 * degradar en silencio: sin él una salida no se abre, porque abrirla significaría o
 * perder la ubicación a los pocos minutos o pedir el permiso permanente.
 */
export const CAPACIDADES = ['salud', 'haptico', 'notificaciones', 'respaldo', 'rotulo'];

/** El nombre en castellano de cada capacidad, que es lo que se lee en pantalla. */
export const ETIQUETAS = {
  salud: 'Salud',
  haptico: 'Háptico',
  notificaciones: 'Notificaciones',
  respaldo: 'Respaldo',
  rotulo: 'Rótulo del sistema',
};

/**
 * Las capas de aviso de `game-design/accesibilidad.md` §3. `ninguna` no es una
 * capa: es la respuesta honesta de una capacidad que no avisa de nada —salud y
 * respaldo, y también el rótulo—, y existe para que el campo sea obligatorio en las cinco.
 */
export const CAPAS = ['bolsillo', 'pantalla', 'ninguna'];

/**
 * Los tres estados que sabe pintar la pantalla, derivados de `montado` y
 * `disponible`. La distinción no es cosmética: un módulo montado que no se puede
 * usar y un módulo que nadie montó son problemas distintos y se arreglan en
 * sitios distintos.
 */
export function estadoLegible({ montado, disponible }) {
  if (!montado) return 'no montada';
  return disponible ? 'disponible' : 'montada, sin poder usarse';
}

/**
 * Normaliza lo que devuelve una sonda. Se hace aquí y no en cada módulo para que
 * una sonda que se deja un campo no produzca una fila a medias en pantalla: un
 * `disponible` ausente es «no disponible», nunca «no se sabe» disfrazado de sí.
 */
export function normalizaRespuesta(nombre, capa, respuesta) {
  const r = respuesta ?? {};
  const montado = r.montado === true;
  const disponible = montado && r.disponible === true;
  let motivo = typeof r.motivo === 'string' && r.motivo ? r.motivo : null;
  if (!disponible && !motivo) motivo = 'la sonda no dijo por qué';
  return { nombre, capa, montado, disponible, motivo: disponible ? null : motivo };
}

/** El mensaje de un error de sonda, sin suponer que lo lanzado sea un Error. */
export function mensajeDeError(e) {
  if (e && typeof e.message === 'string' && e.message) return e.message;
  return String(e);
}
