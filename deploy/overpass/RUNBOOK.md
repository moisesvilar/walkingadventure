# Runbook del Overpass del proyecto

Lo que hay que saber para operar la pieza, en el orden en que hace falta. Lo que no es código —proveedor, máquina, red— vive aquí y no en la spec.

## La única forma válida de preguntar si está listo

```bash
node server/aguas-arriba/sonda-overpass.mjs http://overpass:80/api/interpreter
```

Sale con 0 si sirve datos y con 1 si no, y en ese caso dice el motivo y su arreglo. **`docker ps` no vale**: dice `Up` en los dos fallos conocidos, y en ninguno de los dos hay un solo dato. Tampoco vale un `grep '"elements"'`: pasa con la lista vacía, que es exactamente lo que devuelve una base de datos sin importar o una zona fuera del extracto. La sonda exige un número mínimo de elementos del canario (`SONDA_MINIMO`).

## Las dos causas de síntoma idéntico

Un contenedor `Up` que responde **200 con una página de error XML**. Costó siete horas. El mensaje del XML es lo único que separa los dos casos, y los arreglos son opuestos:

| Mensaje del XML | Motivo de la sonda | Arreglo |
| --- | --- | --- |
| `No such file or directory` sobre `/db/db/osm3s_osm_base` | `sin-base-de-datos` | **Importar.** El entrypoint salta la importación si existe `/db/init_done`, así que recrear el contenedor es seguro. Reiniciar no importa nada. |
| `Permission denied` sobre el mismo socket | `base-de-datos-inalcanzable` | **`docker exec <contenedor> chmod 755 /db`.** `/db` llega del image como `700 overpass:overpass` y nginx corre como uid 101: no puede ni atravesarlo. No volver a importar: los datos ya están. |

Con un bind mount en macOS el segundo no aparece (los permisos se ignoran); en un volumen con nombre son permisos Linux de verdad.

Los otros tres motivos del conjunto cerrado: `importacion-en-curso` (esperar, seguirlo con `docker compose logs -f`), `plazo-agotado` (carga o cola) y `respuesta-ilegible` (ahí no responde Overpass, o responde a medias).

## Prontitud y tráfico

- La sonda corre cada `SONDA_PERIODO` (60 s por defecto) con plazo `SONDA_PLAZO`.
- Se pasa a listo tras `SONDA_PARA_LISTO` pasadas seguidas en verde: evita el vaivén del final de una importación.
- Se cae a no listo **a la primera en rojo**, para que el respaldo absorba una caída dentro del periodo de sonda y no dentro de una tarde.
- Mientras no está listo, ninguna generación se encamina aquí: van directas al respaldo.
- Tras un reinicio de la máquina el contenedor vuelve solo (`restart: unless-stopped`) y **no repite la importación**.

## El extracto y su cobertura

- Extracto: España, sin actualización por diffs. Se reimporta a demanda.
- La cobertura es un dato explícito (`server/aguas-arriba/cobertura.mjs`): bandas por latitud con el borde oeste siguiendo la raya con Portugal, más Baleares, Canarias, Ceuta y Melilla. **Una caja única no sirve: la caja de España contiene Lisboa**, y una consulta en Lisboa contra el extracto de España responde 200 con cero elementos. Sin la comprobación, el juego generaría un mundo sin nada anclado y lo presentaría como legítimo.
- Fuera de la cobertura no se pregunta al propio: se va directo al respaldo, que tiene el planeta.
- El recorte es grueso, así que hay una segunda red: **una respuesta vacía del propio se confirma contra el respaldo** antes de darla por buena. Vacío confirmado es dato legítimo —una celda de campo abierto sin un solo POI existe—; vacío sin confirmar, no.
- La procedencia (`EXTRACTO`, `EXTRACTO_MIRROR`, `EXTRACTO_FECHA`) entra en la medición: un número sin extracto, mirror y fecha no es comparable con el siguiente.
- Reimportar con datos más recientes **no cambia ningún mundo ya congelado** (RF-MUNDO-005): solo afecta a los mapas nuevos.

## El reparto del minuto

`RNF-PER-001` se mide de `A1P4` —el jugador confirma dónde levantar el mapa— a `A1P6` —la espera cede al mapa pintado—, e incluye red, generación y primer pintado.

| Tramo | Presupuesto | Dueño |
| --- | --- | --- |
| Datos | 20 s | esta pieza |
| Generación en el dispositivo | 25 s | fila 26 |
| Primer pintado | 10 s | fila 21 |
| Margen | 5 s | — |

```bash
OVERPASS_PROPIO=http://localhost:12345/api/interpreter CONSULTA_VERSION=1 \
  node scripts/overpass-medir.mjs
```

p95 sobre 20 pasadas por celda, **con la caché fría siempre** (cada pasada cambia el hash del texto sin cambiar ni un filtro), sobre las cuatro celdas arquetipo. **Gobierna la urbana densa**, que es la que más datos pide; la media de las cuatro no decide nada. La medición imprime máquina, extracto y fecha, y sale con 1 si la celda que gobierna no cabe.

## La cadena de respaldo

Propio → los tres mirrors públicos, en el orden de `server.mjs`. Un 429, 503 o 504 pasa al siguiente **sin reintentar contra el mismo**; una página de error XML se descarta con el mismo criterio que el propio, porque la sonda es una y vale para todos los eslabones.

Con la cadena agotada **no se levanta un mundo a medias**: no se congela nada de esa celda y el jugador puede reintentar sin volver a contestar el onboarding. Aquí no aplica la degradación silenciosa de `RNF-RED-001`: sin datos de OSM no hay mapa que levantar, y un mundo generado sobre una respuesta vacía sería un juego roto que no da error.

La métrica del día lleva un **recuento por eslabón** (`eslabones` en `metrica-del-dia`): cuántas generaciones sirvió cada uno, sin ninguna zona. Ese recuento es lo que dispara la revisión de la pieza — es el contrapeso de que la degradación al respaldo sea invisible por lo demás.

## La caché y el texto de la consulta

Permanente por diseño: los datos de OSM cambian despacio y ninguna entrada caduca por el paso del tiempo. **La clave es el texto literal de la consulta y nada más**, así que cambiar una letra invalida la caché entera y la siguiente ejecución paga minutos contra los mirrors. No es un cuelgue: es el precio.

Por eso el texto lleva versión (`VERSION_CONSULTA` en `server/aguas-arriba/overpass.mjs`, `CONSULTA_VERSION` en el despliegue) y el proxy **no arranca** si el texto cambió sin subir la versión, ni si el despliegue declara otra. Al cambiarlo: subir las dos a la vez, anotar el coste de repoblar la caché en el propio cambio, y cruzar el texto nuevo con la consulta literal que cada fixture de `test/fixtures/osm/*/manifiesto.json` guarda.

Tres cachés distintas conviven y no hay que mezclarlas: la del dispositivo (el mundo congelado, permanente de verdad), la del proxy sobre la generación (**apagada**, SPEC-023: encendida es un mapa de qué zonas se han pedido) y la de consultas de esta pieza, que vive junto al Overpass del proyecto.

## Lo que esta máquina no escribe

- Registro de accesos apagado y declarado (`nginx-sin-registro.conf`). Quien ponga un terminador de TLS delante tiene que apagar el suyo también.
- El diagnóstico de un fallo lleva el motivo clasificado y el eslabón, y **ninguna coordenada**.
- La métrica del día es un recuento sin geografía. Un día sin una sola generación tiene todos los contadores a cero y no le falta ninguno.
