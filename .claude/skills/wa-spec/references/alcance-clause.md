# Cláusula canónica de "Alcance de implementación"

Única copia de la cláusula (antes duplicada en spec-instructions e iter-instructions — hallazgo A19).
Reformulada por ADR-001: el implementador es el subagente `somo-implementer` (skill somo-dev-fable),
y no un tercero. La cláusula es contractual: se copia LITERAL en cada spec e iteración, ajustando solo
los bullets 3º y 4º según indica cada plantilla. **Los dos primeros bullets nunca se eliminan ni se parafrasean.**

```markdown
## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes,
  páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya
  commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica
  explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
```

Reglas de uso:

- **En specs nuevas:** copiar tal cual; si la spec tiene matices reales (p. ej. excluye una migración
  que parecería natural pero ya la hizo otra spec), añadir un cuarto bullet aclarándolo.
- **En iteraciones:** el primer bullet se ajusta a una frase breve del delta ("un ajuste de UI", "una
  corrección de a11y"...); el tercer bullet declara explícitamente si hay o no cambios de
  la frontera de inyección del núcleo o las dependencias; se añade el cuarto bullet **"Fuera de alcance"** con
  SOLO el delta a no tocar (nunca repitiendo lo que ya excluía la spec base).

Por qué existe: sin esta sección el implementador entrega tests por iniciativa propia — ocurrió en
el pipeline original y rompe la separación implementador / QA. La cláusula es el blindaje.
