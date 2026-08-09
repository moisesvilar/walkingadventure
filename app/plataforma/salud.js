// Salud: los pasos acumulados que el juego lee al abrir. En esta entrega no está
// montada y lo declara nombrando a su dueña, que es lo honesto: la fila 42 monta
// el módulo nativo, y hasta entonces prometer disponibilidad sería mentir.

/** No es capa de aviso: salud no avisa de nada, solo aporta pasos. */
export const salud = {
  nombre: 'salud',
  capa: 'ninguna',
  async sonda() {
    return { montado: false, disponible: false, motivo: 'no montada todavía: la monta la fila 42 (pasos de fondo)' };
  },
};
