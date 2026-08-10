// Ejecutar una escena sobre una superficie de Skia. Es el único módulo que habla
// la API de dibujo, y **no consulta el estilo ni una sola vez**: cada primitiva
// llega con su color, su grosor y su tipografía ya resueltos, y los rótulos con su
// posición ya colocada. Por eso «ningún color vive en el código de dibujo» no es
// una promesa: es algo que se comprueba buscando literales en este fichero.
//
// El lienzo se inyecta, con el mismo patrón que `fetchData` en `buildWorld` y que
// el `canvas` que recibe el prototipo: aquí no se importa Skia, se recibe. Eso es
// lo que permite ejercitar el ejecutor en Node contra un doble que apunta las
// llamadas, sin simulador.

/** Los tipos de primitiva que esta lámina sabe pintar. Cualquier otro es error. */
export const PRIMITIVAS = Object.freeze([
  'rect', 'circulo', 'elipse', 'camino', 'texto', 'trama', 'degradadoRadial',
  'guarda', 'restaura', 'recorta', 'transforma',
]);

const GRADOS_POR_RADIAN = 180 / Math.PI;
const CANALES_RGBA = 4;

/**
 * Pinta una escena compuesta.
 *
 * @param {object} destino
 *   `canvas` el lienzo de Skia; `Skia` la fábrica; `enums` los enumerados que la
 *   biblioteca publica aparte (`PaintStyle`, `ClipOp`, `TileMode`, `ColorType`,
 *   `AlphaType`, `StrokeCap`, `StrokeJoin`, `FilterMode`, `MipmapMode`);
 *   `fuente(tipografia) → SkFont`, que **falla nombrando la familia** si todavía
 *   no está cargada, en lugar de devolver una sustituta.
 * @param {object} escena la que devuelve `componeEscena`.
 * @returns {{ pintadas: number, rotulos: number }} lo que se ha ejecutado.
 */
export function pintaEscena(destino, escena) {
  const { canvas, Skia, enums, fuente } = destino ?? {};
  if (!canvas || !Skia || !enums) throw new Error('pintaEscena necesita { canvas, Skia, enums } inyectados');
  if (typeof fuente !== 'function') throw new Error('pintaEscena necesita que se le inyecte fuente(tipografia) → SkFont');
  if (!escena || !Array.isArray(escena.primitivas)) throw new Error('pintaEscena necesita una escena compuesta');
  // Una superficie sin área no se pinta y no falla.
  if (escena.vacia) return { pintadas: 0, rotulos: 0 };

  let pintadas = 0;
  let rotulos = 0;
  for (const primitiva of escena.primitivas) {
    ejecuta(destino, primitiva);
    pintadas += 1;
    if (primitiva.tipo === 'texto') rotulos += 1;
  }
  return { pintadas, rotulos };
}

function ejecuta(destino, p) {
  const { canvas, Skia, enums } = destino;
  switch (p.tipo) {
    case 'guarda':
      canvas.save();
      return;
    case 'restaura':
      canvas.restore();
      return;
    case 'transforma':
      canvas.translate(p.tx, p.ty);
      if (p.rot) canvas.rotate(p.rot * GRADOS_POR_RADIAN, 0, 0);
      return;
    case 'recorta':
      canvas.clipPath(caminoDe(Skia, formaComoOps(p.forma)), enums.ClipOp.Intersect, true);
      return;
    case 'rect':
      dibuja(destino, caminoDe(Skia, [['R', p.x, p.y, p.ancho, p.alto]]), p.pintura);
      return;
    case 'circulo':
      dibuja(destino, caminoDe(Skia, [['C', p.cx, p.cy, p.r]]), p.pintura);
      return;
    case 'elipse':
      dibuja(destino, caminoDe(Skia, [['E', p.cx, p.cy, p.rx, p.ry, p.rot]]), p.pintura);
      return;
    case 'camino':
      dibuja(destino, caminoDe(Skia, p.ops), p.pintura);
      return;
    case 'texto':
      pintaTextoPlano(destino, p);
      return;
    case 'trama':
      pintaTrama(destino, p);
      return;
    case 'degradadoRadial':
      pintaDegradado(destino, p);
      return;
    default:
      throw new Error(`pintaEscena: primitiva desconocida "${p.tipo}"; las que sabe pintar son ${PRIMITIVAS.join(', ')}`);
  }
}

/** Una forma de recorte, expresada con las mismas operaciones que un camino. */
function formaComoOps(forma) {
  if (forma.tipo === 'rect') return [['R', forma.x, forma.y, forma.ancho, forma.alto]];
  if (forma.tipo === 'circulo') return [['C', forma.cx, forma.cy, forma.r]];
  if (forma.tipo === 'camino') return forma.ops;
  throw new Error(`pintaEscena: forma de recorte desconocida "${forma.tipo}"`);
}

/**
 * Un camino, levantado con `PathBuilder` y no con el camino mutable de siempre.
 *
 * `Skia.Path.Make()` y sus métodos siguen funcionando, pero **cada llamada imprime un
 * aviso de obsolescencia**, y un aviso en una compilación de desarrollo levanta el
 * rótulo de LogBox: una franja negra al pie de la pantalla que no aparece en el árbol
 * de accesibilidad, que tapa la acción principal y que se come el primer toque que
 * reciba. Medido en el emulador: al pintar la lámina de A1P6 salían seis avisos
 * —`addRect`, `moveTo`, `lineTo`, `addCircle`, `addRRect`, `close`—, el rótulo caía
 * justo encima de «Seguir» (`[63,2183][210,2246]` contra una franja de 2154 a 2274) y
 * el arranque no pasaba de ahí ni con Maestro ni a mano. Es el mismo mecanismo que ya
 * está anotado en `plataforma/area-segura.jsx`, y por eso se cierra donde nace: **la
 * app no emite ni un aviso**.
 *
 * `detach()` devuelve el camino inmutable ya terminado; el trazado se tira.
 */
function caminoDe(Skia, ops) {
  const trazado = Skia.PathBuilder.Make();
  for (const op of ops) {
    switch (op[0]) {
      case 'M': trazado.moveTo(op[1], op[2]); break;
      case 'L': trazado.lineTo(op[1], op[2]); break;
      case 'Q': trazado.quadTo(op[1], op[2], op[3], op[4]); break;
      case 'Z': trazado.close(); break;
      case 'R': trazado.addRect(Skia.XYWHRect(op[1], op[2], op[3], op[4])); break;
      case 'RR': trazado.addRRect(Skia.RRectXY(Skia.XYWHRect(op[1], op[2], op[3], op[4]), op[5], op[5])); break;
      case 'C': trazado.addCircle(op[1], op[2], op[3]); break;
      case 'E': trazado.addOval(Skia.XYWHRect(op[1] - op[3], op[2] - op[4], op[3] * 2, op[4] * 2)); break;
      default: throw new Error(`pintaEscena: operación de camino desconocida "${op[0]}"`);
    }
  }
  return trazado.detach();
}

/**
 * Una brocha con lo que traiga la primitiva y nada más. Todos los valores salen de
 * `pintura`: aquí no se decide ni un color ni un grosor.
 */
function brocha(Skia, enums, pintura, relleno) {
  const brochaSkia = Skia.Paint();
  brochaSkia.setAntiAlias(true);
  brochaSkia.setColor(Skia.Color(relleno ? pintura.relleno : pintura.trazo));
  brochaSkia.setStyle(relleno ? enums.PaintStyle.Fill : enums.PaintStyle.Stroke);
  if (!relleno) {
    brochaSkia.setStrokeWidth(pintura.grosor);
    if (enums.StrokeCap && pintura.remate) brochaSkia.setStrokeCap(pintura.remate === 'round' ? enums.StrokeCap.Round : enums.StrokeCap.Butt);
    if (enums.StrokeJoin && pintura.union) brochaSkia.setStrokeJoin(pintura.union === 'round' ? enums.StrokeJoin.Round : enums.StrokeJoin.Miter);
    if (pintura.discontinuo) brochaSkia.setPathEffect(Skia.PathEffect.MakeDash(pintura.discontinuo, 0));
  }
  if (pintura.alfa !== 1) brochaSkia.setAlphaf(pintura.alfa);
  if (pintura.sombra) {
    const s = pintura.sombra;
    brochaSkia.setImageFilter(Skia.ImageFilter.MakeDropShadow(0, s.dy, s.difuminado, s.difuminado, Skia.Color(s.color), null));
  }
  return brochaSkia;
}

function dibuja(destino, camino, pintura) {
  const { canvas, Skia, enums } = destino;
  if (pintura.relleno) canvas.drawPath(camino, brocha(Skia, enums, pintura, true));
  if (pintura.trazo) canvas.drawPath(camino, brocha(Skia, enums, pintura, false));
}

/**
 * Un texto. La posición llega resuelta —`x` es el borde izquierdo, `y` la línea
 * base—, así que aquí no se calcula ninguna colocación de rótulo: si el colocador
 * dejó dos cajas encima, las dos se pintan donde dijo.
 */
function pintaTextoPlano(destino, p) {
  const { canvas, Skia, enums, fuente } = destino;
  const tipografia = p.pintura;
  const font = fuente(tipografia);
  if (!font) throw new Error(`pintaEscena: la tipografía "${tipografia.familia}" todavía no está cargada`);
  if (tipografia.halo) {
    const halo = Skia.Paint();
    halo.setAntiAlias(true);
    halo.setColor(Skia.Color(tipografia.halo.color));
    halo.setStyle(enums.PaintStyle.Stroke);
    halo.setStrokeWidth(tipografia.halo.grosor);
    if (enums.StrokeJoin) halo.setStrokeJoin(enums.StrokeJoin.Round);
    // El halo se repite las pasadas que diga la escena: con halo opaco una sola
    // deja el borde lavado por el antialiasing.
    for (let i = 0; i < tipografia.halo.pasadas; i++) escribe(canvas, font, p, halo, tipografia.tracking);
  }
  const tinta = Skia.Paint();
  tinta.setAntiAlias(true);
  tinta.setColor(Skia.Color(tipografia.relleno));
  tinta.setStyle(enums.PaintStyle.Fill);
  escribe(canvas, font, p, tinta, tipografia.tracking);
}

/**
 * Escribe una línea. Con interletraje se escribe letra a letra porque Skia no lo
 * aplica al dibujar una cadena; el valor sale de la escena, no de aquí.
 */
function escribe(canvas, font, p, brochaSkia, tracking) {
  if (!tracking) {
    canvas.drawText(p.texto, p.x, p.y, brochaSkia, font);
    return;
  }
  let x = p.x;
  for (const letra of p.texto) {
    canvas.drawText(letra, x, p.y, brochaSkia, font);
    x += font.getTextWidth(letra) + tracking;
  }
}

/** El mar: una trama RGBA que llega con el color y la opacidad ya puestos. */
function pintaTrama(destino, p) {
  const { canvas, Skia, enums } = destino;
  const imagen = Skia.Image.MakeImage(
    { width: p.n, height: p.n, colorType: enums.ColorType.RGBA_8888, alphaType: enums.AlphaType.Unpremul },
    Skia.Data.fromBytes(p.pixeles),
    p.n * CANALES_RGBA,
  );
  if (!imagen) throw new Error('pintaEscena: Skia no ha podido montar la trama del mar');
  const brochaSkia = Skia.Paint();
  brochaSkia.setAntiAlias(true);
  canvas.drawImageRect(
    imagen,
    Skia.XYWHRect(0, 0, p.n, p.n),
    Skia.XYWHRect(p.x, p.y, p.ancho, p.alto),
    brochaSkia,
  );
}

/** El viñeteo: un degradado cuyas paradas vienen resueltas en la escena. */
function pintaDegradado(destino, p) {
  const { canvas, Skia, enums } = destino;
  const brochaSkia = Skia.Paint();
  brochaSkia.setAntiAlias(true);
  brochaSkia.setShader(Skia.Shader.MakeTwoPointConicalGradient(
    Skia.Point(p.cx, p.cy), p.r0,
    Skia.Point(p.cx, p.cy), p.r1,
    p.paradas.map((parada) => Skia.Color(parada.color)),
    p.paradas.map((parada) => parada.t),
    enums.TileMode.Clamp,
  ));
  canvas.drawRect(Skia.XYWHRect(p.x, p.y, p.ancho, p.alto), brochaSkia);
}
