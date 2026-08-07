// Doble del proxy ciego: texto de LLM, imagen y ficha de Places, con tres modos.
// El modo «falla siempre» es el que sostiene los escenarios de «sin red la
// aventura funciona entera», y el modo «responde mal» el que impide que una
// respuesta del modelo se dé por buena solo porque llegó.
//
// No abre ninguna conexión: las respuestas salen de test/fixtures/proxy/.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'proxy');

export const MODOS = ['responde', 'falla-siempre', 'responde-mal'];
export const TIPOS = ['texto', 'imagen', 'places'];

const crudo = (fichero) => readFileSync(join(FIXTURES, fichero), 'utf8');

/** Las respuestas fijas del modo «responde», copia nueva en cada llamada. */
export function respuestasFijas() {
  return JSON.parse(crudo('respuestas.json'));
}

/** El catálogo de respuestas defectuosas del modo «responde mal». */
export function respuestasDefectuosas() {
  return JSON.parse(crudo('respuestas-defectuosas.json')).catalogo;
}

/**
 * @param {object} [opciones]
 * @param {'responde'|'falla-siempre'|'responde-mal'} [opciones.modo='responde']
 * @param {string} [opciones.defecto]  id del catálogo a devolver en modo
 *   «responde mal». Sin él sale la primera entrada del tipo pedido. No se sortea:
 *   un doble que elige al azar deja de ser reproducible, que es lo contrario de
 *   lo que hace falta aquí.
 */
export function creaDobleDelProxy({ modo = 'responde', defecto } = {}) {
  if (!MODOS.includes(modo)) {
    throw new Error(`modo de proxy inválido: "${modo}". Modos válidos: ${MODOS.join(', ')}`);
  }

  const registro = [];

  const responde = (tipo, peticion) => {
    // El registro se escribe antes de decidir qué se devuelve: en modo «falla
    // siempre» también interesa saber qué se pidió.
    registro.push({ tipo, peticion, indice: registro.length });

    if (modo === 'falla-siempre') {
      throw new Error(`el proxy no responde (doble en modo "falla-siempre"): petición de ${tipo}`);
    }

    if (modo === 'responde-mal') {
      const catalogo = respuestasDefectuosas();
      const entrada = defecto
        ? catalogo.find((e) => e.id === defecto)
        : catalogo.find((e) => e.tipo === tipo);
      if (!entrada) {
        throw new Error(
          defecto
            ? `no hay ninguna respuesta defectuosa con id "${defecto}". Disponibles: ${catalogo.map((e) => e.id).join(', ')}`
            : `no hay ninguna respuesta defectuosa de tipo "${tipo}"`,
        );
      }
      return entrada.respuesta;
    }

    return respuestasFijas()[tipo];
  };

  return {
    modo,
    /** Texto de LLM. */
    async texto(peticion) { return responde('texto', peticion); },
    /** Imagen generada, cacheada por su prompt de ficción. */
    async imagen(peticion) { return responde('imagen', peticion); },
    /** Ficha de Places: solo lo inerte, foto y atribución. */
    async places(peticion) { return responde('places', peticion); },
    /** Lo que ha recibido, en el orden en que llegó. */
    peticiones() { return registro.map((p) => ({ ...p })); },
  };
}
