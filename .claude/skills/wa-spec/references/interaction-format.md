# Formato de interacción (por modo de operación)

El modo lo fija `pipeline/config.yml → mode`, o el invocador. Objetivo en ambos: llegar a una spec
válida con la mínima fricción. No es una conversación abierta — es un proceso con entregable.

## Modo `unattended` (invocación desde /somo-pipeline)

- **Cero preguntas, cero confirmaciones.** El flujo es: leer contexto → escribir fichero → devolver
  resumen. La spec entra al pipeline sin visto bueno humano; el humano la revisa a posteriori si quiere.
- **Ambigüedad de diseño** → default respaldado por el design system + entrada en `## Decisiones asumidas`.
- **Ambigüedad de producto** (no se sabe QUÉ debe hacer la feature; el Rationale no existe en el PRD;
  el slug no está en el checklist) → **abort con error explícito y accionable**: qué falta y dónde
  debería estar. El orquestador lo convierte en escalado. Nunca inventes producto.
- **Salida en chat:** ruta del fichero + resumen 3-4 líneas + decisiones asumidas. Nada más.

## Modo `supervised` (uso manual)

### Recepción del requisito

- **Claro y completo** → produce la spec directamente. No preguntes por cortesía: el humano prefiere
  revisar una spec completa y pedir cambios que responder un interrogatorio.
- **Ambiguo** → preguntas agrupadas en UN solo mensaje, máximo 5-6, numeradas, con defaults
  ofrecidos ("¿Soft-delete o hard-delete? (asumo soft-delete si no dices nada)"). Si necesitas más
  de 6, el requisito es demasiado vago: pide reformulación.

### Presentación

1. Resumen breve (3-4 líneas) de las decisiones clave, ANTES de la spec.
2. La spec se escribe a fichero; en chat NO se vuelca completa (el humano la abre en su IDE).
3. Pregunta de confirmación: "¿Confirmas esta spec, o quieres ajustar algo?"

### Iteración sobre la spec en revisión

Si pide cambios: aplícalos al fichero y muestra un **diff semántico** — numerado, por sección, solo
lo que cambió y los cambios en cascada que provocó. No repitas la spec entera.

Si pide algo que viola el design system:

```
No puedo incluir eso tal como lo describes porque [razón concreta].
El design system indica que [regla]. La alternativa sería [propuesta].
¿Uso la alternativa, o lo documento como excepción justificada?
```

### Confirmación

"Spec SPEC-NNN-<slug> confirmada." — y devuelves el control. **Quién hace qué después NO es asunto
tuyo:** /somo-pipeline registra la transición en `pipeline/state.json` y commitea
(`chore(SPEC-NNN): spec definida`). Tú no tocas state.json ni git.

## Lo que NO hacer (ambos modos)

- Smalltalk, preámbulos, "¿quieres que añada algo más?".
- Repetir la spec entera ante un cambio menor (diff semántico).
- Pedir confirmación de lo que el humano ya dijo.
- Explicar el design system salvo que pregunten.
- Producir specs parciales: cada versión escrita a disco cumple el checklist de calidad completo.
