# Módulo de Encuestas Institucionales

Alcance grande. Propongo construirlo en **5 fases** entregables e iterativas, para que puedas validar cada bloque antes de continuar. Todo se integra con el LMS existente (estilos, sidebar, auth, roles, áreas, empleados).

---

## Fase 1 — Fundaciones (BD + permisos + navegación)

**Base de datos (modelo genérico y escalable):**
- `survey_categories` — SST, Calidad, Talento Humano, etc.
- `surveys` — título, descripción, categoría, estado (borrador/publicada/cerrada), fechas apertura/cierre, creado_por, área dueña, `is_template`.
- `survey_sections` — secciones/pasos con orden.
- `survey_questions` — tipo (`short_text`, `long_text`, `number`, `date`, `time`, `email`, `phone`, `dropdown`, `single_choice`, `multi_choice`, `boolean`, `rating`, `scale`, `file`, `signature`), obligatoria, ayuda, validaciones (JSONB), valor por defecto, condición de visibilidad (JSONB), `autofill_source` (para prellenar desde perfil).
- `survey_question_options` — opciones para choice/dropdown.
- `survey_assignments` — a quién se asigna (usuario, área, sede, cargo, o "todos").
- `survey_responses` — cabecera por usuario/encuesta, estado (pendiente/en_progreso/respondida), fecha inicio, fecha envío.
- `survey_answers` — respuesta por pregunta (valor texto, número, fecha, JSONB para múltiples, url para archivo).
- `survey_audit_log` — usuario, acción, IP, user agent, timestamp, payload.

**Permisos granulares:**
- Nuevo enum `survey_permission` con: `create`, `edit`, `delete`, `publish`, `close`, `view_responses`, `export`, `view_dashboard`, `manage_templates`, `manage_own_area`, `manage_all`.
- Tabla `survey_user_permissions (user_id, permission, scope_area_id NULL)`.
- Admin general ya tiene todo vía rol `admin`.
- Funciones `security definer`: `has_survey_permission(user, permission)`, `can_manage_survey(user, survey_id)`.
- RLS estricta: empleado solo ve sus asignaciones/respuestas; líder solo lo de su ámbito; admin todo.

**Navegación:**
- Nueva entrada "Encuestas" en `AdminSidebar` (admin y usuarios con permisos).
- Nueva entrada "Mis Encuestas" en navegación de empleado.
- Rutas: `/dashboard/surveys` (gestión), `/dashboard/surveys/:id/edit`, `/dashboard/surveys/:id/responses`, `/dashboard/surveys/:id/dashboard`, `/surveys` (empleado), `/surveys/:id/respond`.

---

## Fase 2 — Constructor manual de encuestas

- Editor tipo wizard con: metadatos → secciones → preguntas.
- Drag & drop para reordenar secciones/preguntas.
- Panel lateral por pregunta: tipo, obligatoria, ayuda, validaciones, condición de visibilidad, prellenado desde perfil.
- Vista previa en vivo del formulario.
- Guardado como borrador y publicación con fechas.
- Duplicar y "Guardar como plantilla".
- Asignación: por áreas, sedes, cargos, usuarios individuales o "todos".

---

## Fase 3 — Importar desde Excel (constructor inteligente)

- Botón **"Crear encuesta desde Excel"**.
- Parser con `xlsx` (ya está en el proyecto): detecta secciones (filas resaltadas/encabezado), preguntas, opciones (columnas adyacentes o separadas por `/`, `,`, `|`).
- Heurísticas de tipo:
  - `Masculino/Femenino`, `Sí/No` → single_choice / boolean.
  - Fechas, números, emails, teléfonos → tipo correspondiente.
  - Listas largas → dropdown.
- **Vista previa editable** antes de guardar: editar preguntas, tipos, orden, agregar/eliminar, secciones, obligatoriedad.
- Asistente para resolver preguntas ambiguas (elegir tipo).

*(Import con IA de Word/PDF se deja arquitectónicamente listo pero se implementa como Fase 6 opcional para no inflar la primera entrega.)*

---

## Fase 4 — Primera encuesta: Perfil Sociodemográfico SST

- Semilla de la encuesta con las 8 secciones (Datos personales, Laboral, Familiar, Vivienda, Transporte, Salud, Hábitos, Observaciones) tomando como referencia el Excel actual de SSGST.
- Formulario multi-paso con:
  - Barra de progreso.
  - Auto-guardado cada X seg (borrador en `survey_responses`).
  - Prellenado desde `profiles` (nombre, documento, correo, cargo, área, sede, etc.) — solo lectura salvo permiso.
  - Validaciones en tiempo real.
  - Modal de confirmación antes de enviar.
- Estados visibles al empleado: Pendiente / En Proceso / Respondida / Cerrada.

> Para asegurar fidelidad total con vuestro formato, **necesitaré que subas el Excel SST actual** cuando lleguemos a esta fase, y de él generaré el seed exacto.

---

## Fase 5 — Dashboards, tabla consolidada y reportes

- **Dashboard por encuesta** (recharts, patrón ya usado en el LMS):
  - KPIs: total asignados, respondidos, pendientes, % participación, tiempo promedio.
  - Gráficos configurables por pregunta (barras, circular, línea, KPI, heatmap donde aplique).
  - Realtime vía suscripciones Supabase (ya se usa en adherencia).
- **Tabla consolidada** tipo DataTable: buscador, filtros avanzados, ordenamiento, paginación, columnas configurables, export XLSX/CSV/PDF, impresión.
- **Reportes** por área, cargo, sede, estado, fecha, variables — descarga PDF/XLSX (reutiliza `xlsx-utils.ts`).
- **Notificaciones** in-app al publicar + badge de encuestas pendientes en sidebar. Recordatorios por email vía Resend (ya integrado). WhatsApp/Push quedan como ganchos preparados.

---

## Detalles técnicos

- **Stack:** React + Vite + Tailwind + shadcn (ya montado); Lovable Cloud (Supabase) para BD, RLS, Edge Functions y Storage; Resend para correos.
- **Auditoría:** trigger genérico en `surveys`, `survey_responses`, `survey_answers` → `survey_audit_log` con IP y user-agent capturados desde el cliente al invocar edge functions.
- **Diseño:** conservamos paleta institucional (azul/naranja), tipografía y componentes actuales. Terminología "En Proceso".
- **Escalabilidad:** el modelo es genérico — cualquier encuesta futura se crea con datos, sin cambios de esquema.
- **Sin límites de caracteres** en textos (regla del proyecto).
- **Fechas** normalizadas a hora local (regla del proyecto) en filtros.

---

## Qué necesito de ti para arrancar

1. **Confirmación del plan** y del orden por fases.
2. Cuando lleguemos a Fase 4: **el archivo Excel actual del Perfil Sociodemográfico SST** para replicarlo con exactitud.
3. Confirmar si quieres arrancar ya con **Fase 1 (fundaciones BD + permisos + navegación)** — es el bloque más grande y sin él nada más funciona.

¿Avanzo con la Fase 1?
