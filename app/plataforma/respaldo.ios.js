// Respaldo, implementación de iOS. En iOS entrar en la copia del sistema es
// cuestión de EN QUÉ DIRECTORIO vive el fichero: lo que cuelga del directorio de
// documentos entra en la copia de iCloud salvo que se marque excluido con
// `isExcludedFromBackup`. Aquí no se escribe nada todavía —la partida es de la
// fila 39—; lo que se declara es el mecanismo y que nada lo excluye.
//
// Su pareja es `respaldo.android.js` y exporta exactamente los mismos nombres.

/** El mecanismo real de esta plataforma, para que la fila 39 no tenga que redescubrirlo. */
export const MECANISMO = 'copia de iCloud del directorio de documentos de la app';

/** Nada excluido de la copia: es lo único que esta fila puede afirmar, y lo afirma. */
const EXCLUIDO_DE_LA_COPIA = false;

export const respaldo = {
  nombre: 'respaldo',
  capa: 'ninguna',
  async sonda() {
    if (EXCLUIDO_DE_LA_COPIA) {
      return { montado: true, disponible: false, motivo: `${MECANISMO}: el directorio está marcado como excluido de la copia` };
    }
    return { montado: true, disponible: true, motivo: null };
  },
};
