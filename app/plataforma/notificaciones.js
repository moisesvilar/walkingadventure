// Notificaciones: la capa de pantalla del par de avisos de `accesibilidad.md` §3.
// La sonda lee el permiso YA concedido y no lo pide: pedirlo es una decisión de
// producto con su sitio dibujado en el onboarding, y una app que en su primer
// arranque dispara cuatro diálogos del sistema es lo que ese onboarding se
// diseñó para no ser. En un dispositivo recién instalado dirá «sin permiso», y
// eso es correcto, no un fallo.

import * as Notifications from 'expo-notifications';

export const notificaciones = {
  nombre: 'notificaciones',
  capa: 'pantalla',
  async sonda() {
    if (typeof Notifications?.getPermissionsAsync !== 'function') {
      return { montado: false, disponible: false, motivo: 'expo-notifications no está en esta compilación' };
    }
    const permiso = await Notifications.getPermissionsAsync();
    if (permiso?.granted === true) return { montado: true, disponible: true, motivo: null };
    return {
      montado: true,
      disponible: false,
      motivo: `montada, sin permiso concedido (estado "${permiso?.status ?? 'desconocido'}"); no se pide aquí`,
    };
  },
};
