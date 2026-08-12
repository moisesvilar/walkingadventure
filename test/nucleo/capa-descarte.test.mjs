// SPEC-050 · Que A4P8 sea una capa de verdad, que es lo que la hacía imposible de usar.
//
// La fila 49 midió en `wa-pixel` que «Marcarlo» no se puede pulsar: la capa del descarte
// desborda 1080×2400, los cinco motivos empujan y los dos últimos salen con cotas
// degeneradas (`y2 < y1`) **encima del botón**, que solo entra por una franja de 30 px.
// Tercera aparición de la trampa del pliegue, y el descarte había costado tres costuras.
//
// La causa no era el alto de los motivos: `app/pantallas/llegada.js` montaba `CapaDescarte`
// como **último hijo del flujo normal**, y su raíz era `flex: 1` sin posicionar, así que se
// repartía el alto con la ficha en vez de ponerse encima. La otra capa del mismo fichero,
// el visor, siempre usó `absoluteFillObject`. Esa es toda la diferencia.
//
// Se afirma **leyendo la fuente**, que es el mismo mecanismo de `escena-cableada.test.mjs` y
// por la misma razón: las dos pantallas llevan JSX y no se pueden importar desde
// `node --test` sin toolchain. Que el toque entre de verdad en el centro del botón es de
// `@app` y está en `test/app/descarte.yaml`; lo que se puede poner rojo aquí, sin
// dispositivo, es la propiedad estructural de la que depende.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { codigoDe } from './rumor-de-prueba.mjs';

const DESCARTE = 'app/pantallas/descarte.jsx';
const VISOR = 'app/pantallas/visor.js';
const LLEGADA = 'app/pantallas/llegada.js';

const fuente = (ruta) => readFileSync(join(RAIZ_REPO, ruta), 'utf8');

describe('El sitio que no pega se marca desde una capa, y por eso se puede marcar', () => {
  test('La capa del descarte cubre la pantalla en lugar de repartirse el alto con la ficha', () => {
    const codigo = codigoDe(fuente(DESCARTE));
    assert.match(
      codigo,
      /raiz:\s*\{[^}]*StyleSheet\.absoluteFillObject/,
      'la raíz de la capa no está posicionada: con `flex: 1` compite por el alto con la ficha y empuja «Marcarlo» fuera de la pantalla',
    );
  });

  test('La capa del descarte se posiciona igual que la otra capa del mismo momento', () => {
    // El visor es el precedente, y estaba bien desde que se escribió. Se compara contra él
    // en lugar de contra una constante para que las dos no puedan divergir en silencio.
    assert.match(codigoDe(fuente(VISOR)), /capa:\s*\{[^}]*absoluteFillObject/);
    assert.match(codigoDe(fuente(DESCARTE)), /raiz:\s*\{[^}]*absoluteFillObject/);
  });

  test('Lo que se desplaza son los motivos, y la acción se queda fuera del desplazable', () => {
    // Aquí se lee la fuente **sin limpiar**: `codigoDe` vacía las cadenas, y el localizador
    // del botón es precisamente una cadena.
    const codigo = fuente(DESCARTE);
    const desplazable = codigo.indexOf('</ScrollView>');
    const boton = codigo.indexOf('descarte-confirmar');
    assert.ok(desplazable > 0 && boton > 0, 'la capa tiene que traer su desplazable y su botón');
    assert.ok(
      boton > desplazable,
      '«Marcarlo» está dentro del desplazable: con los motivos empujando, la única acción de la capa se iría de la vista',
    );
    assert.match(codigoDe(codigo), /desplazable:\s*\{[^}]*flex:\s*1/, 'sin `flex: 1` el desplazable no se queda con el hueco que sobra y vuelve a empujar');
  });

  test('La ficha sigue montada debajo, que es lo que hace que cerrar la capa la devuelva entera', () => {
    const codigo = codigoDe(fuente(LLEGADA));
    // La capa se monta **además** de la ficha y no en su lugar: es un `&&` al final del
    // árbol, no una rama de la condición que elige pantalla.
    assert.match(codigo, /descarte\s*\?\s*<CapaDescarte/, 'la capa se monta bajo su propia condición y no como rama de la que elige pantalla');
    assert.ok(
      codigo.indexOf('<CapaDescarte') > codigo.indexOf('PantallaFicha'),
      'la capa se monta antes que la ficha en el árbol, así que la ficha se pintaría encima de ella',
    );
  });

  test('Ningún motivo del descarte trae campo de texto libre', () => {
    // No es de esta fila y se afirma igual, porque es lo que la capa promete en su cabecera:
    // un campo libre invita a escribir datos de personas reales del barrio dentro de la
    // partida, y ese texto acabaría en la copia exportable (`seguridad-privacidad.md` §3).
    const codigo = codigoDe(fuente(DESCARTE));
    assert.ok(!/TextInput/.test(codigo), 'la capa del descarte monta un campo de texto');
  });
});
