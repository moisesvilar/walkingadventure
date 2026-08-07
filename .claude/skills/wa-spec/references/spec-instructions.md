# Instrucciones para generar specs (modo CREAR)

## Proceso

### Fase 1: Entender el requisito

Antes de escribir una línea de spec, verifica que entiendes el requisito.

**Preguntas prioritarias** (las que apliquen, no todas):

1. **Datos de la entidad:** ¿Qué campos? ¿Tipos? ¿Requeridos? ¿Enums (roles, estados, categorías)?
2. **Roles y permisos:** ¿Quién puede hacer qué?
3. **Flujos condicionales:** ¿El comportamiento cambia según el estado de los datos?
4. **Acciones destructivas:** ¿Soft-delete o hard-delete? ¿Cascadas?
5. **Volumen de datos:** ¿Decenas o miles? (Determina paginación client-side vs server-side.)
6. **Dependencias:** ¿Depende de otra spec? ¿Necesita autenticación? ¿Datos de otra entidad?

**Resolución según modo de operación:**

- **supervised:** si el requisito es ambiguo, agrupa las preguntas en un solo mensaje (máx 5-6),
  con defaults propuestos. Si es claro, no preguntes por cortesía.
- **unattended:** NO preguntes. Aplica el default más razonable respaldado por el design system
  (p. ej.: soft-delete, paginación server-side si el volumen es incierto, Sheet para 5-10 campos)
  y registra CADA default en la sección `## Decisiones asumidas` de la spec, con su alternativa.
  Si la ambigüedad es de producto y no de diseño (p. ej. no está claro QUÉ hace la feature),
  aborta con error explícito: eso lo resuelve el PRD, no un default.

### Fase 2: Evaluar si tiene UI

- **Feature con UI** (la mayoría): ambos bloques (PO + Designer). Spec completa con UX Design.
- **Feature backend-only** (API, lógica pura, migración): solo bloque PO. Sin UX Design; con Notas técnicas.

### Fase 3: Escribir la spec

Estructura exacta, sin cambiar headings ni omitir secciones obligatorias:

```
# SPEC-NNN — <Nombre descriptivo>
## Descripción
## Alcance de implementación          ← cláusula canónica (alcance-clause.md)
## Criterios de aceptación
## UX Design                          ← solo con UI
### Wireframe textual
### Pantallas y elementos utilizados
### data-testid
### Patrón de interacción
### Comportamiento responsive
## Notas técnicas                     ← opcional
## Decisiones asumidas                ← obligatoria en unattended si hubo defaults
```

## Reglas por sección

### `## Descripción`

- 2-4 frases en lenguaje no técnico: qué hace, para quién, en qué contexto.
- No describas implementación ("componente React con useState" ❌).

### `## Alcance de implementación` (obligatoria en TODA spec)

Copia la cláusula canónica de `references/alcance-clause.md`, con sus reglas de uso. Va
inmediatamente después de `## Descripción`. Sin excepciones — incluso en specs backend-only.

### `## Criterios de aceptación`

- Gherkin estricto: `GIVEN [precondición] WHEN [acción del usuario] THEN [resultado esperado]`.
- Una línea por criterio; un solo THEN por criterio.
- Agrupados por flujo con sub-headings `###` (`### Listado`, `### Creación`, `### Eliminación`).
- Numeración implícita: AC-01 = primer criterio en orden de aparición. No escribas el número —
  el QA Dev y el analista los infieren del orden, así que NO reordenes ACs en revisiones.
- Cada criterio verificable con un test automatizado. Si no imaginas el test, reescríbelo.

**Cobertura obligatoria — sin alguna de estas categorías la spec está incompleta:**

| Categoría | Qué cubre | Ejemplo |
| --- | --- | --- |
| Happy path | Flujo principal exitoso | GIVEN formulario válido WHEN click en Crear THEN se crea y aparece Toast |
| Validación | Formato, requeridos | GIVEN email vacío WHEN blur THEN error inline "Campo requerido" |
| Empty state | Sin datos | GIVEN no hay usuarios WHEN carga THEN empty state con CTA |
| Error state | Fallo de carga/servidor | GIVEN fetch falla WHEN carga THEN error state con "Reintentar" |
| Edge cases | Cancelaciones, duplicados, límites | GIVEN edición con cambios WHEN Descartar THEN AlertDialog |

### `## UX Design`

Solo con UI. Cinco sub-secciones obligatorias:

#### `### Wireframe textual`

Por cada pantalla/vista:

- **Layout nombrado** del design system ("Layout 1 — Estándar", "Layout 3 — Formulario/wizard").
- **Elementos y posición relativa** ("a la derecha del título", "sticky bottom bar").
- **Pantallas ya dibujadas, por su nodo del flujo** ("pantalla 2 · artefacto 4, el visor arrastrado"), y los elementos propios del proyecto: cartela, placa, tirador del visor, marca del mapa, rótulo del sistema.
- **Datos concretos**: columnas exactas, campos exactos, labels literales. Nunca "los datos del usuario".

Errores a evitar: "se abre un modal" (¿Dialog, Sheet o AlertDialog?), "un formulario con los campos"
(¿cuáles, en qué orden, con qué componentes?).

#### `### Pantallas y elementos utilizados`

Lista completa; marca los no instalados en el scaffold:

```
Componentes: Table, Input, Select, Button, Sheet, Badge, Toast, AlertDialog, Skeleton, Form
Componente adicional necesario: Switch (no instalado en el scaffold base)
```

#### `### data-testid` (nueva sección obligatoria — hallazgo A21)

Define el `data-testid` de cada elemento interactivo o assertable clave que no tenga un locator
user-facing robusto (role+name, label, texto único). El QA Dev usa `getByRole`/`getByLabel`/`getByText`
como primera opción y estos testids como último recurso — pero deben existir en la spec para que el
implementador los ponga en el código. Formato:

```
- `users-table` — la tabla del listado
- `create-user-sheet` — el Sheet de creación
- `user-row-actions` — el trigger del DropdownMenu de cada fila
```

Regla: pocos y estables (contenedores y triggers), no uno por nodo. Si todos los elementos tienen
locator semántico obvio, declara: "Sin data-testid adicionales: todos los elementos son localizables
por role/label/text".

#### `### Patrón de interacción`

Decisiones de UX **justificadas con reglas del design system** (no repite el wireframe):

- Paginación client-side (≤100 filas) vs server-side (>100) — y por qué.
- Selección de filas (checkbox si bulk / navegación por link en texto / ninguna).
- Formularios: Dialog 1-4 campos / Sheet 5-10 / página 10+ o multi-step.
- Feedback por acción mutadora: Toast en éxito, AlertDialog antes de destruir, inline on blur.
- Si una decisión no está cubierta por el design system: "Decisión no cubierta por el design
  system: [descripción]. Se resuelve con [decisión] por [razón]."

#### `### Comportamiento responsive`

- **Mobile (< md):** qué cambia respecto a desktop.
- **Tablet (md-lg):** solo si difiere; si no, "interpolado entre mobile y desktop".
- **Desktop (lg+):** layout completo del wireframe (puede ser breve).

### `## Notas técnicas` (opcional)

Solo información NO deducible de ACs/UX: estructura de datos, endpoints sugeridos, lógica de negocio
no trivial, dependencias con otras specs o infraestructura. **No incluir:** código, arquitectura
React, tipos TypeScript, indicaciones de testing. Si no hay nada, omite la sección.

### `## Decisiones asumidas` (obligatoria en unattended si hubo defaults)

Una línea por default aplicado: `- [ambigüedad] → asumido [default] (alternativa: [X]). Regla: [design system §N | criterio]`.
El humano las revisa a posteriori; si alguna es incorrecta, se corrige vía iteración.

## Checklist de calidad final

- [ ] Título con `SPEC-NNN` y nombre descriptivo.
- [ ] Descripción funcional de 2-4 frases.
- [ ] Cláusula de alcance canónica presente y sin recortar.
- [ ] ACs Gherkin con las 5 categorías de cobertura, agrupados por flujo.
- [ ] Wireframe con layout nombrado, componentes con variantes, datos concretos.
- [ ] Lista de pantallas ya dibujadas que la spec toca, por su nodo de `docs/flujo.md`, y de elementos nuevos si los hay.
- [ ] Sección data-testid presente (o su declaración de "sin adicionales").
- [ ] Patrones justificados con el design system; excepciones documentadas.
- [ ] Responsive en 3 breakpoints.
- [ ] Notas técnicas solo si aportan; Decisiones asumidas si hubo defaults.
- [ ] Suficiente detalle para que QA Dev derive tests de: composición, interacción, estados de UI,
      feedback, responsive y accesibilidad (las 6 categorías QUX).
