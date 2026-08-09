// Cajas orientadas: el rectángulo que ocupa un rótulo ya pintado, el solape por ejes
// separadores con holgura y el índice de rejilla que acota lo que cuesta preguntarlo.
// Vive en `core/` por lo mismo que `geo.js`: esto es geometría y no dibujo, así que no
// conoce ni un color y corre en `node --test` sin nada instalado.
//
// Todas las cajas llevan giro, y los rótulos derechos son el caso degenerado con
// `rot = 0`. Es a propósito: el rótulo de calzada va girado sobre su trazado y su
// envolvente alineada a la pantalla puede ser el doble de grande, lo que retiraría
// rótulos que sí caben. Con una sola regla no hay dos caminos que mantener.

/** Una caja orientada: centro, tamaño y giro en radianes. */
export function creaCaja(cx, cy, ancho, alto, rot = 0) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) throw new Error(`creaCaja: el centro tiene que ser finito; llegó (${cx}, ${cy})`);
  if (!Number.isFinite(ancho) || ancho <= 0) throw new Error(`creaCaja: el ancho tiene que ser un número positivo; llegó ${ancho}`);
  if (!Number.isFinite(alto) || alto <= 0) throw new Error(`creaCaja: el alto tiene que ser un número positivo; llegó ${alto}`);
  if (!Number.isFinite(rot)) throw new Error(`creaCaja: el giro tiene que ser finito; llegó ${rot}`);
  return Object.freeze({ cx, cy, ancho, alto, rot });
}

/** Los dos ejes propios de una caja: el de su ancho y el de su alto. */
function ejesDe(caja) {
  const cos = Math.cos(caja.rot);
  const sin = Math.sin(caja.rot);
  return [{ x: cos, y: sin }, { x: -sin, y: cos }];
}

/** Cuánto se proyecta media caja sobre un eje unitario. */
function radioSobre(caja, eje) {
  const [u, v] = ejesDe(caja);
  return Math.abs((caja.ancho / 2) * (u.x * eje.x + u.y * eje.y))
    + Math.abs((caja.alto / 2) * (v.x * eje.x + v.y * eje.y));
}

/** Las cuatro esquinas, en orden fijo. */
export function esquinasDeCaja(caja) {
  const [u, v] = ejesDe(caja);
  const hx = caja.ancho / 2;
  const hy = caja.alto / 2;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([su, sv]) => ({
    x: caja.cx + u.x * hx * su + v.x * hy * sv,
    y: caja.cy + u.y * hx * su + v.y * hy * sv,
  }));
}

/** La envolvente alineada a la pantalla. Solo la usa el índice, nunca el solape. */
export function envolventeDeCaja(caja) {
  const rx = radioSobre(caja, { x: 1, y: 0 });
  const ry = radioSobre(caja, { x: 0, y: 1 });
  return { x0: caja.cx - rx, y0: caja.cy - ry, x1: caja.cx + rx, y1: caja.cy + ry };
}

/** La diagonal de la caja, que es la unidad con la que se topa el tirador. */
export function diagonalDeCaja(caja) {
  return Math.hypot(caja.ancho, caja.alto);
}

/**
 * ¿Se pisan dos cajas, dejando `holgura` de margen?
 *
 * Ejes separadores: si existe un eje sobre el que las dos proyecciones se separan al
 * menos la holgura, no se pisan. Con `holgura > 0`, **dos cajas que se tocan cuentan
 * como que se pisan**, que es lo que pide el criterio: dos rótulos pegados se leen
 * como uno solo.
 */
export function seSolapan(a, b, holgura = 0) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  for (const eje of [...ejesDe(a), ...ejesDe(b)]) {
    const distancia = Math.abs(dx * eje.x + dy * eje.y);
    if (distancia >= radioSobre(a, eje) + radioSobre(b, eje) + holgura) return false;
  }
  return true;
}

/**
 * ¿Cabe la caja entera dentro del marco?
 *
 * El marco es `{ modo: 'rect', x0, y0, x1, y1 }` o `{ modo: 'disc', cx, cy, R }`: las
 * dos formas de área que declaran los estilos. Se comprueban las cuatro esquinas,
 * que para un rectángulo orientado es exacto en los dos casos.
 */
export function cajaDentroDe(caja, marco) {
  const esquinas = esquinasDeCaja(caja);
  if (marco.modo === 'disc') {
    return esquinas.every((p) => Math.hypot(p.x - marco.cx, p.y - marco.cy) <= marco.R);
  }
  return esquinas.every((p) => p.x >= marco.x0 && p.x <= marco.x1 && p.y >= marco.y0 && p.y <= marco.y1);
}

/** ¿Cae un punto dentro del marco? */
export function puntoDentroDe(punto, marco) {
  if (marco.modo === 'disc') return Math.hypot(punto.x - marco.cx, punto.y - marco.cy) <= marco.R;
  return punto.x >= marco.x0 && punto.x <= marco.x1 && punto.y >= marco.y0 && punto.y <= marco.y1;
}

/** El marco encogido por igual en todos sus lados. */
export function encogeMarco(marco, margen) {
  if (marco.modo === 'disc') return { modo: 'disc', cx: marco.cx, cy: marco.cy, R: Math.max(0, marco.R - margen) };
  return {
    modo: 'rect',
    x0: marco.x0 + margen, y0: marco.y0 + margen,
    x1: Math.max(marco.x0 + margen, marco.x1 - margen),
    y1: Math.max(marco.y0 + margen, marco.y1 - margen),
  };
}

/**
 * El índice de rejilla uniforme.
 *
 * Es lo que hace que preguntar «¿esta caja pisa algo?» no recorra todo lo colocado.
 * El prefiltro por envolvente **no es una comprobación de solape**: la comprobación
 * es la de ejes separadores, que es la cara, y por eso es la que se cuenta. Que el
 * índice exista se afirma justo con ese contador.
 */
export function creaIndiceDeCajas(paso = 64) {
  if (!Number.isFinite(paso) || paso <= 0) throw new Error(`creaIndiceDeCajas: el paso de la rejilla tiene que ser positivo; llegó ${paso}`);
  const celdas = new Map();
  const entradas = [];

  const clave = (i, j) => `${i}|${j}`;
  const rango = (envolvente, margen) => ({
    i0: Math.floor((envolvente.x0 - margen) / paso), i1: Math.floor((envolvente.x1 + margen) / paso),
    j0: Math.floor((envolvente.y0 - margen) / paso), j1: Math.floor((envolvente.y1 + margen) / paso),
  });

  return {
    /** Mete una caja con el dato que la explica (quién es y de qué elemento). */
    inserta(caja, dato = null) {
      const n = entradas.length;
      const envolvente = envolventeDeCaja(caja);
      entradas.push({ caja, dato, envolvente });
      const { i0, i1, j0, j1 } = rango(envolvente, 0);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = clave(i, j);
          const lista = celdas.get(k);
          if (lista) lista.push(n);
          else celdas.set(k, [n]);
        }
      }
      return n;
    },

    /**
     * Las cajas que podrían pisar a esta, en orden de inserción. Prefiltro por
     * envolvente y nada más: quien pregunta decide con `seSolapan`.
     */
    vecinos(caja, margen = 0) {
      const envolvente = envolventeDeCaja(caja);
      const { i0, i1, j0, j1 } = rango(envolvente, margen);
      const numeros = [];
      const marca = new Set();
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const lista = celdas.get(clave(i, j));
          if (!lista) continue;
          for (const n of lista) {
            if (marca.has(n)) continue;
            marca.add(n);
            const otra = entradas[n];
            if (otra.envolvente.x0 - margen > envolvente.x1 || otra.envolvente.x1 + margen < envolvente.x0) continue;
            if (otra.envolvente.y0 - margen > envolvente.y1 || otra.envolvente.y1 + margen < envolvente.y0) continue;
            numeros.push(n);
          }
        }
      }
      // Orden de inserción, que es el orden de colocación: no depende del recorrido
      // de la rejilla y por tanto no depende de dónde caiga la caja.
      numeros.sort((a, b) => a - b);
      return numeros.map((n) => entradas[n]);
    },

    /** Cuántas cajas hay dentro. */
    get cuantas() {
      return entradas.length;
    },
  };
}
