// Salud: los pasos acumulados que el juego lee al abrir. La lógica de la fila 42 —el
// permiso, la ventana, la marca de agua y los metros— vive en `lector-de-salud.js`; lo que
// queda aquí es la **capacidad**, que declara si esta compilación tiene de verdad de dónde
// leer.
//
// Y hoy no la tiene, así que lo dice en lugar de suponerlo: el enlace con la app de salud
// del sistema es un módulo nativo, y traerlo es traer una dependencia que la spec de la
// fila 42 no nombra. El lector la recibe **inyectada** y sin ella el interruptor de los
// ajustes no se puede encender, que es lo contrario de encenderlo y no leer nada.

/** No es capa de aviso: salud no avisa de nada, solo aporta pasos. */
export const salud = {
  nombre: 'salud',
  capa: 'ninguna',
  async sonda() {
    return {
      montado: false,
      disponible: false,
      motivo: 'la fila 42 monta el lector y su doble; la fuente nativa de salud entra con la dependencia que su spec no nombra',
    };
  },
};
