# Lecciones

Las del pipeline original eran casi todas específicas de un implementador remoto que aquí no existe, así que quedan fuera. Estas son las de este proyecto, y salen de cosas que ya han pasado.

**Un test verde no significa app viva.** `test/headless.mjs` pasa aunque la capa de datos esté rota, porque no la importa. Ocurrió: un `.gitignore` con una ruta sin anclar se tragó `app/js/data/overpass.js`, la app estuvo rota y ningún test lo detectó. Cuando la spec toque datos o render, escribe una prueba que los toque de verdad.

**Comparar mundos campo a campo no afirma determinismo.** Solo la serialización completa lo hace. Es fácil escribir una prueba que compara los núcleos, pasa, y deja pasar una regresión en las polilíneas.

**Una prueba lenta casi siempre está esperando al reloj real.** El reloj del mundo se avanza a mano: nunca esperes a que pase el tiempo.

**El caso pequeño es el caso normal.** El barrio de tres calles no es el mundo raro que se prueba al final: es donde fallan las plantillas y donde el diseño se pelea. Si una prueba de casting solo usa el fixture urbano denso, no está probando lo que importa.

**Los fallos de casting tienen una forma reconocible.** Son siempre «sin candidatos para X: un paraje con escena Y», y se dan incluso en mundos con noventa anclajes. Cuando veas uno, el problema no es escasez de lugares: es el sorteo de tipos.

**Y la afirmación más difícil de este proyecto es una negativa**: que algo no sale del móvil. No se puede probar leyendo el código; hace falta el inspector de tráfico saliente y afirmar sobre su registro. Una prueba de privacidad que no lo use está fingiendo.
