# Nombres

La convención canónica del proyecto está en `.claude/rules/naming.md` y no se redefine aquí. Lo que sí es propio de las pruebas:

**El nombre del caso es el nombre del escenario de `docs/testing.md`, literal.** No lo parafrasees, no le añadas prefijos, no lo traduzcas. Es lo que permite cruzar batería e implementación con un grep, y es la materia prima del análisis de fallos: un fallo que dice `Dos generaciones con la misma semilla dan el mismo mundo` se entiende sin abrir nada.

Cuando escribas una prueba que **no** corresponde a ningún escenario, usa el mismo registro —una frase que describe el comportamiento, no el método— y márcala en tu resumen como hueco de la batería.

**Ficheros**: `test/nucleo/<area>.test.mjs` y `test/app/<flujo>.yaml`, donde `<area>` y `<flujo>` salen del dominio (`generacion`, `rumores`, `casting`, `telon`), no de la spec. Una spec puede tocar varias áreas y un área la tocan varias specs; atar los ficheros a las specs los vuelve inservibles a las tres iteraciones.

**Agrupación**: dentro de un fichero, un bloque por característica de `docs/testing.md`, con su nombre.
