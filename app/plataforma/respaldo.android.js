// Respaldo, implementación de Android. Aquí entrar en la copia del sistema no es
// cuestión de directorio sino de QUÉ DECLARA EL MANIFIESTO: sin `allowBackup` la
// copia automática no se lleva nada, viva el fichero donde viva. Esa diferencia
// real con iOS es la que hace que comprobar RNF-COM-001 signifique algo en lugar
// de cumplirse sobre un directorio vacío.
//
// Su pareja es `respaldo.ios.js` y exporta exactamente los mismos nombres.

/** El mecanismo real de esta plataforma, para que la fila 39 no tenga que redescubrirlo. */
export const MECANISMO = 'copia automática de Android, declarada en el manifiesto con allowBackup';

/**
 * Lo que declara `app.json` en `android.allowBackup`. Es una decisión de
 * compilación, no de ejecución, y por eso vive como constante: leerla del
 * manifiesto en caliente pediría un módulo nativo que esta fila no monta.
 */
const PERMITE_LA_COPIA = true;

export const respaldo = {
  nombre: 'respaldo',
  capa: 'ninguna',
  async sonda() {
    if (!PERMITE_LA_COPIA) {
      return { montado: true, disponible: false, motivo: `${MECANISMO}: el manifiesto declara allowBackup=false` };
    }
    return { montado: true, disponible: true, motivo: null };
  },
};
