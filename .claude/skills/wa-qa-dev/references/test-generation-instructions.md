# Instrucciones de generacion de tests

## Como usar este documento

Documento operativo: describe el flujo paso a paso que sigues cada vez que recibes una spec implementada para generar tests. Los documentos 01 (rol) y 02 (framework) definen quien eres y que herramientas tienes. Este documento define que haces y en que orden.

---

## 1. Flujo de trabajo completo

Cuando recibes una spec y el codigo implementado, ejecutas estos 7 pasos en orden estricto:

```
Paso 1: Leer la spec (ACs + UX Design)
Paso 2: Leer el codigo implementado (proporcionado como contexto)
Paso 3: Consultar spec-test-map.json (iteraciones anteriores)
Paso 4: Clasificar ACs en unit vs e2e
Paso 5: Escribir tests
Paso 6: Producir spec-test-map.json actualizado
Paso 7: Resumen de output
```

---

## 2. Paso 1 — Leer la spec

Lee la spec completa proporcionada. Extrae dos cosas:

### Los criterios de aceptacion (ACs)

Cada AC es un caso de test. Numeralos mentalmente por orden de aparicion: AC-01 = primer criterio, AC-02 = segundo, etc.

Para cada AC, identifica:
- **GIVEN** = setup del test (estado inicial, datos mock, navegacion previa).
- **WHEN** = accion que dispara el comportamiento (click, blur, carga de pagina).
- **THEN** = assertion (que verificar: texto visible, elemento presente, callback llamado).

### La seccion UX Design

Contiene informacion critica para tests:
- **Componentes especificos:** Si dice "Sheet lateral derecho", tu test verifica que se abre un Sheet, no un Dialog.
- **Comportamiento responsive:** Si dice "en mobile, sidebar es drawer", generas un test e2e con viewport 375px.
- **Feedback patterns:** Si dice "Toast 'Usuario creado'", tu test busca ese texto exacto.
- **Accesibilidad:** Si dice "focus al primer campo al abrir Sheet", tu test verifica focus.
- **data-testid:** la seccion `### data-testid` de la spec define los garantizados. Usalos como ultimo recurso tras role/label/text; si falta uno que necesitas, es gap de la SPEC — reportalo.

---

## 3. Paso 2 — Leer el codigo implementado

Recorre `src/` directamente (solo lectura). Necesitas entender:

**Estructura de componentes:**
- Que componentes existen, que props aceptan. Esto determina como los instancias en tests unitarios.
- Que hooks se usan, que servicios llaman. Esto determina que mockear.

**Flujo de datos:**
- Pantalla -> estado de partida -> paquete de núcleo. El núcleo no llama a nada: todo entra inyectado, y eso es lo que se dobla.
- En tests unitarios, cortas en el nivel de servicio (mockear el servicio).
- En las de `@app` no cortas nada: el flujo se ejecuta contra la app en el simulador, con GPS simulado y el doble del proxy.

**Nota sobre el backend:** no hay. Los datos de OSM salen de fixtures congelados, el proxy tiene doble y la partida se serializa en memoria o en un directorio temporal. Ninguna prueba necesita red ni credenciales.

---

## 4. Paso 3 — Consultar spec-test-map.json

Si se te proporciona un spec-test-map.json existente, revisalo.

**Si la spec NO esta en el map (primera iteracion):**
Generas tests desde cero.

**Si la spec YA esta en el map (iteracion 2+):**
1. Revisa que ACs cambiaron.
2. Decide para cada test existente: mantener, actualizar, o eliminar.
3. Anade tests nuevos para ACs nuevos.
4. Nunca generes tests duplicados.

---

## 5. Paso 4 — Clasificar ACs en unit vs e2e

| El AC verifica... | Tipo de test | Razon |
|-------------------|-------------|-------|
| Que un componente renderiza datos correctos | Unit | Aislable, no necesita browser |
| Que un estado de UI existe (loading, empty, error) | Unit | Estado del componente, mockeable |
| Que la validacion de un campo muestra un error | Unit | Comportamiento del formulario, aislable |
| Que un flujo completo funciona (crear -> Toast -> tabla) | E2E | Requiere multiples componentes |
| Que un AlertDialog aparece antes de eliminar | E2E | Flujo multi-paso con feedback |
| Que el layout cambia en mobile | E2E | Requiere viewport real |
| Que el focus va al elemento correcto | E2E | Comportamiento de browser real |

**Regla de no-duplicacion:** Si un AC se cubre completamente con un unitario, no anadas un e2e para lo mismo.

---

## 6. Paso 5 — Escribir tests

### Estructura de archivos

```
tests/
  unit/<feature>/
    <Componente>.test.tsx    # Un archivo por componente principal
    use<Hook>.test.ts        # Un archivo por hook (si tiene logica no trivial)
  e2e/
    <feature>.e2e.ts          # Un archivo por feature
```

### Reglas de escritura

**1. Cada `it`/`test` verifica un solo AC.**

```typescript
// OK: Un AC, un test
it('shows error when email is empty on blur', async () => {
  // AC-09
})

// MAL: Dos ACs en un test
it('validates email', async () => {
  // AC-09 + AC-10 mezclados
})
```

**2. El nombre del test refleja el AC.**

El analista de QA (subagente somo-qa-analyst) correlaciona tests fallidos con ACs usando los nombres.

```typescript
// OK
it('renders paginated table with columns: Name, Email, Role, Status, Created, Actions', () => { })

// MAL
it('renders table', () => { })
```

**3. Los datos mock son realistas pero minimos.**

```typescript
const mockUsers: User[] = [
  { id: '1', full_name: 'Ana Garcia', email: 'ana@example.com', role: 'admin', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: '2', full_name: 'Carlos Lopez', email: 'carlos@example.com', role: 'editor', status: 'inactive', created_at: '2026-01-02T00:00:00Z' },
]
```

**4. Las assertions son especificas, no genericas.**

```typescript
// OK
expect(screen.getByText('Ana Garcia')).toBeInTheDocument()

// MAL
expect(screen.getByRole('table')).toBeInTheDocument()
```

**5. Los tests e2e usan locators user-facing.**

```typescript
// OK
await page.getByRole('button', { name: 'Crear usuario' }).click()

// MAL
await page.locator('.create-button').click()
```

**6. Tests e2e para responsive usan `setViewportSize`.**

```typescript
test('sidebar collapses on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
})
```

**7. Cada archivo de test incluye un comentario con el SPEC ID.**

```typescript
// SPEC-001: User Management
// Generated by QA Dev agent
```

---

## 7. Paso 6 — Producir spec-test-map.json

Produce la entrada del spec-test-map.json para esta spec:

```json
{
  "SPEC-001": {
    "spec_file": "specs/SPEC-001-user-management.md",
    "unit": [
      {
        "file": "tests/unit/users/UserTable.test.tsx",
        "test_count": 8,
        "description": "Rendering, pagination, sorting, empty/error states"
      }
    ],
    "e2e": [
      {
        "file": "tests/e2e/users.e2e.ts",
        "test_count": 10,
        "description": "CRUD flows, validation, AlertDialog, responsive"
      }
    ],
    "acceptance_criteria_coverage": {
      "AC-01": ["tests/unit/users/UserTable.test.tsx::UserTable::renders paginated table with correct columns"],
      "AC-08": ["tests/e2e/users.e2e.ts::User Management::creates a user and shows success toast"]
    },
    "created_at": "ISO_TIMESTAMP",
    "updated_at": "ISO_TIMESTAMP"
  }
}
```

**Reglas:**
1. Cada AC debe aparecer en `acceptance_criteria_coverage`. Gaps = problemas.
2. Formato de identificador: `file_path::describe_block::test_name`.
3. `test_count` debe coincidir con el conteo real de `it()`/`test()`.

---

## 8. Paso 7 — Resumen de output

Al final, produce un resumen:

```
## Resumen QA Dev

- **Spec:** SPEC-NNN
- **Unit tests:** X tests en Y archivos
- **E2E tests:** Z tests en 1 archivo
- **Cobertura ACs:** N/M ACs cubiertos
- **Gaps:** (listar ACs sin test, si los hay, con justificacion)
```

---

## 9. Formato de output

**Escritura directa:** escribe los archivos en el workspace con Write (ya no hay script extractor del pipeline original). Manten no obstante el identificador de ruta al citar fragmentos en el resumen, por legibilidad.

Formato obligatorio para cada archivo:

~~~
```typescript:tests/unit/users/UserTable.test.tsx
// Contenido del archivo de test
```
~~~

~~~
```typescript:tests/e2e/users.e2e.ts
// Contenido del archivo de test
```
~~~

~~~
```json:tests/spec-test-map.json
// Contenido actualizado del spec-test-map.json
```
~~~

Usa exactamente este formato: triple backtick + tipo + dos puntos + ruta del archivo. Sin este formato, el script no puede extraer los archivos.

---

## 10. Cobertura de ACs — checklist de verificacion

Antes de producir el output, verifica que cada categoria obligatoria tiene al menos un test:

| Categoria | Que buscar en la spec | Tiene test? |
|-----------|----------------------|-------------|
| Happy path | Flujo principal exitoso | |
| Validacion | Campos requeridos, formato | |
| Empty state | Sin datos | |
| Error state | Fallo de carga | |
| Edge cases | Cancelaciones, duplicados | |
| Responsive | Cambios en mobile | |
| Accesibilidad | Focus management, aria-labels | |

Si alguna categoria no tiene test y la spec tiene ACs para ella, es un gap que debes cubrir.
