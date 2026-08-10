// El documento del mundo que la portada necesita al volver a abrir la app, leído del
// almacén y **sin pintar nada**: abrir la partida no es levantar un mapa.
//
// Es el hermano pobre de `levantamiento.abre`, y a propósito: aquel monta el traedor, el
// proxy, la atestación, el medidor de Skia y el colocador de rótulos porque tiene que
// poder generar; esto solo lee dos documentos que ya están escritos, así que no arrastra
// ninguna de esas piezas y corre en `node --test` sin dispositivo.
//
// Cuál es el mapa que se abre es **el primero por identificador**, y es una limitación
// declarada: cuál es el mapa activo lo decide dónde estás (RF-PERS-007), y saber dónde
// estás pide el módulo de ubicación, que es la fila 48. Mientras tanto es la única regla
// determinista disponible, y es la misma que la exportación ya usa para dar nombre al
// fichero. Con un solo mapa —toda partida que no ha viajado— las dos coinciden.

/** Lo que esto le pide al generador, enumerado. Ni una función más. */
export const DEL_NUCLEO = Object.freeze(['listaMapas', 'cargaMapa', 'cargaCelda', 'celdasAbiertas']);

/**
 * El mundo de la partida guardada, o `null` si todavía no hay ninguno levantado.
 *
 * Que no haya mapa es un estado normal y no una avería: una partida puede existir con su
 * personaje antes de que ninguna celda se haya escrito entera.
 */
export async function mundoDeLaPartida({ almacen, nucleo, semilla } = {}) {
  if (!almacen) throw new Error('el mundo de la partida necesita el almacén de la partida inyectado');
  if (!nucleo) throw new Error('el mundo de la partida necesita el núcleo inyectado: es quien lee el índice y la celda');
  const faltan = DEL_NUCLEO.filter((n) => typeof nucleo[n] !== 'function');
  if (faltan.length) {
    throw new Error(`al núcleo del mundo de la partida le faltan ${faltan.length} pieza(s): ${faltan.join(', ')}`);
  }
  const { listaMapas, cargaMapa, cargaCelda, celdasAbiertas } = nucleo;

  const ids = await listaMapas({ almacen });
  if (!ids.length) return null;
  const mapa = await cargaMapa({ almacen, id: ids[0], semilla });
  const abiertas = celdasAbiertas(mapa);
  if (!abiertas.length) return null;
  // La primera por su clave: es la misma que fija el título y el idioma del mapa, así que
  // lo que se lee al volver no depende del orden en que se abrieron las celdas.
  const registro = await cargaCelda(mapa, abiertas[0].celda, { almacen });
  return { mapaId: mapa.id, documento: registro.mundo, titulo: mapa.titulo ?? registro.mundo?.title ?? null };
}
