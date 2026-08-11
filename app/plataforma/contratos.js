// Los contratos escritos, probados y **a los que todavía no llega ningún llamador desde
// `app/`**, uno a uno y con dueño.
//
// Existe por la décima aparición de `pipeline/decisiones-orquestador.md` §6h en este repo, y
// esta vez con el número delante. Hasta SPEC-048, `app/plataforma/ubicacion.js`,
// `app/plataforma/posiciones.js`, `app/marcha/seguidor.js` y `app/plataforma/rotulo.android.js`
// estaban escritos, probados contra dobles y **no los llamaba nadie**: sus contratos existían,
// sus pruebas pasaban y la app no hacía nada de lo que prometían. Poner llamador arregla los
// cuatro casos de hoy; esta lista es lo único que arregla el de mañana.
//
// Cómo se usa, y es lo que la hace valer algo: **las dos direcciones son rojo**. Un contrato
// nuevo sin llamador que no esté aquí pone la suite roja, y uno de aquí que pase a tener
// llamador también, hasta que se quite. Bajar el número es un acto con registro, igual que en
// `pantallas-huerfanas.test.mjs` y en `limite-declarado.test.mjs`, y por lo mismo: si la lista
// se descubriera sola, dejar un contrato sin cablear no costaría nada.
//
// Lo que **no** entra aquí: los dobles y las implementaciones de Node —`creaAlmacenEnMemoria`,
// `creaFicherosDeNode`— que existen para que la batería corra sin dispositivo. Que la app no
// los llame es su cometido, no una deuda.

/**
 * Los contratos sin llamador, en orden alfabético por fichero.
 *
 * `dueña` es la fila que los cableará, y `porque` lo que falta para poder hacerlo. Los cuatro
 * que SPEC-048 sacó de esta lista se nombran en la cabecera y no aquí: lo que se enumera es
 * lo que queda.
 */
export const CONTRATOS_SIN_LLAMADOR = Object.freeze([
  Object.freeze({
    fichero: 'app/plataforma/lector-de-salud.js',
    contrato: 'creaLectorDeSalud',
    porque: 'lee los pasos del día a día al abrir, y el interruptor que lo enciende es del zurrón',
    dueña: 'fila 46 del checklist',
  }),
  Object.freeze({
    fichero: 'app/plataforma/notificador.js',
    contrato: 'creaNotificadorDeExpo',
    porque: 'la notificación de oportunidad se emite al validar una llegada, y el camino de la llegada entero es de la fila 44',
    dueña: 'fila 44 del checklist',
  }),
  Object.freeze({
    fichero: 'app/plataforma/rotulo.ios.js',
    contrato: 'creaRotulo',
    porque: 'la Actividad en Vivo pide un widget de ActivityKit compilado dentro de la app, y ninguna spec ha nombrado todavía el módulo nativo que lo daría',
    dueña: 'la fila que nombre ese módulo; SPEC-048 lo deja declarado como límite',
  }),
  Object.freeze({
    fichero: 'app/plataforma/lector-de-salud.js',
    contrato: 'creaMarcaDeAgua',
    porque: 'es la marca de hasta dónde se leyeron los pasos, y sin lector de salud no hay nada que marcar',
    dueña: 'fila 46 del checklist',
  }),
]);

/** Los ficheros de la lista, para poder cruzarla con lo que se mide sobre `app/`. */
export const FICHEROS_SIN_LLAMADOR = Object.freeze(CONTRATOS_SIN_LLAMADOR.map((c) => c.fichero));
