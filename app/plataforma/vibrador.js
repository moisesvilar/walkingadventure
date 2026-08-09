// El vibrador: la capa de bolsillo de todo aviso (`game-design/accesibilidad.md` §3).
// `haptico.js` sondea si el módulo está; esto es lo que vibra.
//
// Aquí no se importa ningún módulo nativo, por lo mismo que en `ubicacion.js`: el
// contrato se ejercita en `node --test` contra un doble y el módulo entra por la firma.
// Y por lo mismo, **no cae solo a un vibrador de mentira** cuando no hay con qué vibrar:
// un vibrador que se traga la llamada en silencio es la pieza que, al no estar, no
// protesta (`pipeline/decisiones-orquestador.md` §6h), y el núcleo distingue a propósito
// entre «no está cableado», que es avería, y «no salió», que se anota en el dato.

/**
 * Envuelve el módulo nativo en el contrato que el emisor de avisos espera.
 *
 * @param {object} piezas
 * @param {(aviso: {texto: string}) => void} piezas.vibra  da el toque desde el bolsillo.
 *   No recibe la posición ni nada que se guarde: solo el texto, y solo para que quien lo
 *   implemente pueda elegir la intensidad del toque si quisiera.
 */
export function creaVibrador({ vibra }) {
  if (typeof vibra !== 'function') {
    throw new Error('el vibrador se monta con vibra({ texto }) y no llegó ninguna: sin ella no hay capa de bolsillo, y un aviso de una sola capa no llega');
  }
  return {
    montado: true,
    motivo: null,
    capa: 'bolsillo',
    vibra(aviso) {
      vibra(aviso ?? {});
    },
  };
}

/**
 * Un vibrador que **no está montado** y lo dice al usarlo.
 *
 * Falla al vibrar en lugar de callarse porque el momento en marcha se construye
 * exigiéndolo: enterarse al arrancar de que no hay capa de bolsillo es lo que impide una
 * salida entera de avisos que nadie recibe.
 */
export function vibradorSinMontar(motivo = 'no montado: esta compilación no trae háptico') {
  return {
    montado: false,
    motivo,
    capa: 'bolsillo',
    vibra() {
      throw new Error(`no se puede dar el toque desde el bolsillo: ${motivo}`);
    },
  };
}

/**
 * El vibrador sobre `expo-haptics`, que ya es dependencia de la app.
 *
 * `impactAsync` se dispara y no se espera a propósito: el aviso no depende de que el
 * motor haya terminado, y esperarlo metería una promesa en un camino que se recorre
 * mientras alguien anda. Si el módulo no está, se devuelve el sin montar en lugar de uno
 * que finja.
 */
export function creaVibradorDeExpo(Haptics) {
  if (typeof Haptics?.impactAsync !== 'function') {
    return vibradorSinMontar('no montado: expo-haptics no está en esta compilación');
  }
  return creaVibrador({
    vibra() {
      // El estilo del toque no se elige por tipo de aviso: los dos tipos vibran igual,
      // porque lo que distingue una oportunidad de una noticia es la otra capa.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium);
    },
  });
}
