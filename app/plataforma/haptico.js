// Háptico: la capa de bolsillo del par de avisos de `accesibilidad.md` §3. Aquí
// solo se sondea si está; vibrar es de la fila 29. La sonda no pide ningún
// permiso porque el háptico no tiene ninguno que pedir, y aun así se comprueba
// llamando a nada: preguntar por las funciones del módulo es suficiente.

import * as Haptics from 'expo-haptics';

export const haptico = {
  nombre: 'haptico',
  capa: 'bolsillo',
  async sonda() {
    const montado = typeof Haptics?.impactAsync === 'function' && typeof Haptics?.notificationAsync === 'function';
    if (!montado) {
      return { montado: false, disponible: false, motivo: 'expo-haptics no está en esta compilación' };
    }
    // Que el módulo esté no garantiza que el dispositivo vibre —un emulador no
    // vibra—, pero eso no se puede saber sin disparar un háptico, y dispararlo al
    // arrancar es exactamente el ruido que esta pantalla no debe hacer.
    return { montado: true, disponible: true, motivo: null };
  },
};
