// El punto de montaje del arranque: junta las piezas que las siete pantallas
// necesitan —el proveedor de ubicación, la entropía, el idioma, el almacén, el
// levantamiento— y se las entrega ya cableadas.
//
// Es el único sitio de la app donde se decide **qué** se monta para el arranque, igual
// que `mapa-montado.jsx` para el mapa y `plataforma/index.js` para las capacidades.
// Quien quiera un montaje doblado —un proveedor que deniega, una entropía fija que
// hace reproducible el recorrido entero— construye el suyo y llama a
// `PantallaArranque` directamente: esa es la frontera, y es lo que permite recorrer el
// arranque en `node --test` sin ningún dispositivo.

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';

import { CLAVE_DEL_ARRANQUE, creaArranque } from '@walkingadventure/nucleo/partida/onboarding.js';
import { localeFor } from '@walkingadventure/nucleo/names/index.js';
import { colocadorDeRotulos } from '@walkingadventure/nucleo/render/colocador.js';

import { exigeAlmacenDuradero } from '../datos/almacen-duradero.js';
import { atestacionDeLaApp } from '../datos/atestacion.js';
import { creaClienteDeProxy } from '../datos/cliente-proxy.js';
import { entropiaDelDispositivo } from '../datos/entropia.js';
import { puertaDeRed } from '../datos/red.js';
import { creaTraedorDeOsm } from '../datos/traedor.js';
import { creaCronometro } from '../mapa/cronometro.js';
import { NUCLEO_DEL_LEVANTAMIENTO } from '../nucleo/piezas.js';
import { creaLevantamiento } from '../mapa/levantamiento.js';
import { componePrimeraLista } from '../mapa/primera-lista.js';
import { evidenciaDelSistema, mecanismoDeAtestacion } from '../plataforma/atestacion.js';
import { mensajeDeError } from '../plataforma/capacidades.js';
import { creaProveedorDeUbicacionDeExpo, proveedorSinMontar } from '../plataforma/ubicacion.js';
import { creaEnlaceReal } from '../render/enlace-real.js';
import { AbrirCopia } from './copia.jsx';
import { creaMedidorSkia } from '../render/medidor-skia.js';
import { PantallaArranque } from './arranque.jsx';
import { DIRECCION_DEL_PROXY, PUNTO_DE_ARRANQUE } from './mapa-montado.jsx';

/**
 * Dónde empieza la marca cuando no hay permiso.
 *
 * Es la misma coordenada con la que el resto del repositorio compara mundos, y es una
 * decisión de la app y no del paquete: el núcleo no conoce ninguna geografía y no se
 * la puede inventar. Quien la arrastre a otro sitio la mueve en un gesto; lo que esta
 * constante evita es una pantalla en blanco cuando alguien deniega el permiso.
 */
export const PUNTO_POR_DEFECTO = PUNTO_DE_ARRANQUE;

/**
 * El idioma con el que se abre A1P1.
 *
 * Sale del punto por defecto y no del sitio donde se va a levantar el mapa, porque el
 * nombre se elige **antes** de saber dónde se levanta: pedir el permiso para poder
 * proponer un nombre sería pedirlo por la puerta de atrás. Cuando el punto se
 * confirma, el mundo resuelve el suyo por su cuenta.
 */
export function idiomaDeArranque(punto = PUNTO_POR_DEFECTO) {
  return localeFor(punto.lat, punto.lon);
}

const ALTO_DE_LOS_CONTROLES = 40;

export function ArranqueMontado({
  ubicacion: ubicacionInyectada = null,
  puntoPorDefecto = PUNTO_POR_DEFECTO,
  base = DIRECCION_DEL_PROXY,
  alSalirAAndar = null,
  almacen = null,
  copia = null,
  alAbrirCopia = null,
}) {
  const { width, height } = useWindowDimensions();

  // El proveedor de esta compilación, que desde SPEC-048 es `expo-location`. Devuelve
  // `null` cuando el módulo no está en el binario, y entonces se monta el que dice que no
  // está: un `app.json` con el plugin puesto y un binario sin el módulo dentro son la
  // misma cosa para quien pulsa «Permitir», y solo esta pregunta los distingue.
  const ubicacion = useMemo(
    () => ubicacionInyectada ?? creaProveedorDeUbicacionDeExpo(Location),
    [ubicacionInyectada],
  );

  const montaje = useMemo(() => {
    try {
      // El arranque a medias y el mapa que levanta se escriben aquí: sin almacén
      // duradero, cerrar la app durante la generación perdería las dos cosas.
      exigeAlmacenDuradero(almacen, 'el arranque');
      const enlace = creaEnlaceReal();
      const cronometro = creaCronometro({ ahora: () => Date.now() });
      // El mapa de A1P5 se levanta con datos que **no están en la caché de nadie**, así
      // que sin ficha el proxy responde «no hay» y el arranque se queda clavado en A1P4.
      const pide = puertaDeRed();
      const atestacion = atestacionDeLaApp({
        pide,
        base,
        plataforma: mecanismoDeAtestacion(),
        evidencia: evidenciaDelSistema(),
      });
      const cliente = creaClienteDeProxy({ pide, base, ficha: () => atestacion.ficha() });
      const levantamiento = creaLevantamiento({
        consultaOsm: creaTraedorDeOsm({ cliente }),
        almacen,
        cronometro,
        colocador: colocadorDeRotulos,
        medidor: creaMedidorSkia(enlace.fuente),
        nucleo: NUCLEO_DEL_LEVANTAMIENTO,
      });
      const arranque = creaArranque({
        // Sin módulo nativo de ubicación se monta el que **dice que no está**, nunca
        // uno que responda «denegado»: eso convertiría una pieza sin cablear en una
        // decisión de quien juega (§6h).
        ubicacion: ubicacion ?? proveedorSinMontar(),
        entropia: entropiaDelDispositivo().valores,
        locale: idiomaDeArranque(puntoPorDefecto),
        puntoPorDefecto,
      });
      return { enlace, cronometro, levantamiento, arranque, fallo: null };
    } catch (e) {
      return { enlace: null, cronometro: null, levantamiento: null, arranque: null, fallo: mensajeDeError(e) };
    }
  }, [almacen, base, ubicacion, puntoPorDefecto]);

  // El arranque a medias que hubiera quedado de una sesión anterior. Es lo que hace
  // que cerrar la app durante la generación no obligue a repetir ninguna pregunta.
  useEffect(() => {
    if (!montaje.arranque) return;
    let vivo = true;
    almacen.lee(CLAVE_DEL_ARRANQUE)
      .then((texto) => {
        if (!vivo || !texto) return;
        montaje.arranque.reanuda(JSON.parse(texto));
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [almacen, montaje]);

  const tamano = useMemo(
    () => ({ ancho: Math.round(width), alto: Math.max(0, Math.round(height) - ALTO_DE_LOS_CONTROLES) }),
    [width, height],
  );

  if (montaje.fallo !== null) {
    return (
      <View style={estilos.aviso} testID="arranque-sin-cablear">
        <Text style={estilos.texto}>{montaje.fallo}</Text>
      </View>
    );
  }

  return (
    <View style={estilos.pila}>
      <PantallaArranque
        arranque={montaje.arranque}
        levantamiento={montaje.levantamiento}
        enlace={montaje.enlace}
        cronometro={montaje.cronometro}
        tamano={tamano}
        guarda={(texto) => almacen.escribe(CLAVE_DEL_ARRANQUE, texto)}
        componeLista={(levantado, personaje) => componePrimeraLista({
          semilla: montaje.arranque.semilla(),
          mapaId: levantado.mapaId,
          mundo: levantado.documento,
          tramoM: personaje.tramo.declaradoM,
          oficio: personaje.oficio,
          sinContenidoJugable: !levantado.jugable,
        })}
        alSalirAAndar={alSalirAAndar}
      />
      {/* A1P1 aporta una acción secundaria y nada más: por debajo de la principal y con
          menos peso. Sin las dos piezas del sistema cableadas no se ofrece, porque una
          acción que no puede llegar a ninguna parte es peor que no tenerla. */}
      {/* Y quien monta decide qué pasa cuando la copia entra: hasta SPEC-047 no pasaba
          nada, se sustituía la partida del almacén y el arranque seguía como si nada. */}
      {copia ? <AbrirCopia copia={copia} alAbrir={alAbrirCopia} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pila: { flex: 1 },
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
