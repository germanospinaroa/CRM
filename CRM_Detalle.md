# CRM Detalle

Documento maestro del CRM de WhatsApp de Pórtate Mal.

Objetivo:
- dejar una referencia técnica y funcional completa del sistema
- permitir que otra IA o un desarrollador entienda cómo funciona el CRM
- registrar mejoras futuras en un solo lugar

Regla operativa:
- cualquier cambio relevante de arquitectura, datos, flujos, automatizaciones, UI, integraciones o despliegue debe actualizar este archivo

Última actualización:
- 2026-05-15

## 1. Resumen Ejecutivo

Este proyecto es un CRM comercial orientado a WhatsApp que combina:
- captura de leads
- conversación asistida por IA
- análisis comercial
- seguimiento automático
- operación humana desde un workspace web
- exportación y auditoría operativa

El sistema está construido sobre:
- `Next.js 15` con App Router
- `Supabase` como base de datos, auth y realtime
- `OpenAI` para Valentina y análisis comercial
- `Meta WhatsApp Cloud API` para mensajería
- `Vercel` para despliegue

La idea central es:
- el CRM es el sistema de verdad
- el agente es la capa de inteligencia y ejecución

Seguridad operativa actual:
- el webhook público valida firma real de Meta antes de parsear el payload
- los endpoints internos del CRM requieren sesión autenticada de Supabase
- la automatización por cron requiere secreto dedicado
- los logs evitan imprimir payloads completos, prompts completos y mensajes privados completos

## 2. Qué Hace el Sistema

Hoy el CRM permite:
- recibir mensajes entrantes desde WhatsApp
- crear o actualizar conversaciones y mensajes
- responder automáticamente con Valentina
- permitir control manual por conversación
- analizar la conversación con `Sales Brain`
- clasificar temperatura, etapa y siguiente acción
- crear y actualizar follow-ups
- crear tareas operativas automáticas
- activar seguimiento automático por reglas
- exportar datos del CRM
- registrar eventos de auditoría
- editar el prompt de Valentina sin redeploy

## 3. Arquitectura General

Flujo principal:

```text
Lead por WhatsApp
  -> /api/webhook
  -> parseo del evento
  -> persistencia de conversación y mensaje
  -> espera de debounce sobre el último mensaje del lead
  -> agrupación de mensajes entrantes pendientes
  -> respuesta única de Valentina al bloque completo
  -> envío por WhatsApp Cloud API
  -> análisis comercial con Sales Brain
  -> actualización de conversación y follow-up
  -> creación/actualización de tarea operativa
  -> dashboard CRM en tiempo real
```

Flujo de automatización:

```text
Cron / ejecución manual
  -> /api/automation/run
  -> carga de reglas desde app_settings
  -> selección de follow-ups pendientes
  -> validación de ventana horaria y reglas
  -> generación de follow-up automático
  -> envío por WhatsApp
  -> análisis comercial posterior
  -> actualización de estado, conteo y eventos
```

## 4. Estructura del Proyecto

### 4.1 Rutas principales de app

Archivos:
- [`app/CRM/page.tsx`](/CRM/app/CRM/page.tsx)
- [`app/CRM/conversations/page.tsx`](/CRM/app/CRM/conversations/page.tsx)
- [`app/CRM/follow-ups/page.tsx`](/CRM/app/CRM/follow-ups/page.tsx)
- [`app/CRM/settings/page.tsx`](/CRM/app/CRM/settings/page.tsx)

Vistas funcionales:
- `/CRM`
  - dashboard ejecutivo y operativo
- `/CRM/conversations`
  - inbox de conversaciones
- `/CRM/follow-ups`
  - gestión comercial y pipeline de seguimiento
- `/CRM/settings`
  - prompt de Valentina y reglas de automatización

### 4.2 API routes

Webhook y operación:
- [`app/api/webhook/route.ts`](/CRM/app/api/webhook/route.ts)
- [`app/api/conversations/[conversationId]/manual-reply/route.ts`](/CRM/app/api/conversations/[conversationId]/manual-reply/route.ts)
- [`app/api/conversations/delete/route.ts`](/CRM/app/api/conversations/delete/route.ts)

Configuración:
- [`app/api/settings/route.ts`](/CRM/app/api/settings/route.ts)
- [`app/api/settings/diagnostics/route.ts`](/CRM/app/api/settings/diagnostics/route.ts)

Automatización y auditoría:
- [`app/api/automation/run/route.ts`](/CRM/app/api/automation/run/route.ts)
- [`app/api/exports/log/route.ts`](/CRM/app/api/exports/log/route.ts)

Rutas espejo bajo `/CRM/api`:
- existen para que el frontend funcione correctamente cuando la app corre bajo `/CRM`

### 4.3 Seguridad de rutas

Públicas:
- `GET /api/webhook`
  - verificación de Meta con `WHATSAPP_VERIFY_TOKEN`
- `POST /api/webhook`
  - pública para Meta, pero protegida con `X-Hub-Signature-256` y `META_APP_SECRET`

Privadas con sesión autenticada del CRM:
- `GET/POST /api/settings`
- `GET/POST /api/settings/diagnostics`
- `POST /api/conversations/delete`
- `POST /api/conversations/[conversationId]/manual-reply`
- `POST /api/exports/log`

Privadas para automatización:
- `GET/POST /api/automation/run`
  - acepta `x-cron-secret` contra `CRON_SECRET`
  - conserva compatibilidad con la ejecución manual desde Settings permitiendo también sesión autenticada del CRM

## 5. Componentes de UI

### 5.1 Shell principal

Archivo:
- [`components/crm/CRMClientApp.tsx`](/CRM/components/crm/CRMClientApp.tsx)

Responsabilidad:
- layout del workspace
- sidebar
- topbar
- routing visual por vista
- lectura de filtros desde query string
- composición de dashboard, conversaciones, follow-ups y settings

### 5.2 Dashboard

Archivo:
- [`components/crm/DashboardView.tsx`](/CRM/components/crm/DashboardView.tsx)

Responsabilidad:
- mostrar métricas principales
- navegar a colas reales desde métricas clicables
- listar leads calientes
- listar próximos follow-ups
- mostrar tareas activas
- mostrar agenda/citas
- mostrar rendimiento por fuente
- mostrar salud de automatización
- mostrar auditoría reciente

### 5.3 Conversaciones

Archivo:
- [`components/crm/ConversationsView.tsx`](/CRM/components/crm/ConversationsView.tsx)

Responsabilidad:
- inbox de conversaciones
- búsqueda
- filtros por query string
- selección
- borrado lógico
- toggle IA/manual
- apertura del panel de detalle del lead

### 5.4 Panel de detalle de lead

Archivo:
- [`components/crm/LeadDetailPanel.tsx`](/CRM/components/crm/LeadDetailPanel.tsx)

Responsabilidad:
- resumen comercial
- score
- objeciones
- siguiente acción
- mensaje sugerido
- envío manual

### 5.5 Follow-ups

Archivo:
- [`components/crm/FollowUpsView.tsx`](/CRM/components/crm/FollowUpsView.tsx)

Responsabilidad:
- gestión de pipeline
- filtros de seguimiento por query string
- edición de estado
- edición de prioridad
- edición de fecha
- edición de tipo de seguimiento
- edición de nota/acuerdo

### 5.6 Settings

Archivo:
- [`components/crm/SettingsView.tsx`](/CRM/components/crm/SettingsView.tsx)

Responsabilidad:
- editar prompt de Valentina
- diagnosticar el prompt activo
- probar respuesta del prompt
- configurar motor de seguimiento automático
- ejecutar una corrida manual del motor automático

### 5.7 Toolbar de exportación

Archivo:
- [`components/crm/WorkspaceToolbar.tsx`](/CRM/components/crm/WorkspaceToolbar.tsx)

Responsabilidad:
- menú compacto de exportaciones
- exportación CSV de conversaciones
- exportación CSV de follow-ups
- exportación CSV de tareas
- exportación snapshot JSON del CRM
- registro de exportaciones en base de datos

## 6. Hook principal del Frontend

Archivo:
- [`hooks/use-crm-workspace.ts`](/CRM/hooks/use-crm-workspace.ts)

Responsabilidad:
- inicializar auth con Supabase
- cargar datasets del workspace
- escuchar realtime de:
  - `conversations`
  - `messages`
  - `follow_ups`
  - `tasks`
  - `appointments`
  - `lead_events`
- exponer acciones del frontend:
  - refresh
  - sign out
  - update follow-up
  - toggle IA
  - send manual reply
  - delete conversations

Datasets que carga:
- conversaciones
- mensajes
- follow-ups
- tareas
- citas
- eventos

## 7. Capa de Dominio y Lógica

### 7.1 Webhook y procesamiento entrante

Archivo:
- [`lib/crm/process-incoming-message.ts`](/CRM/lib/crm/process-incoming-message.ts)

Responsabilidad:
- parsear payload de WhatsApp
- crear/buscar conversación
- guardar mensaje entrante
- deduplicar por `whatsapp_message_id`
- pausar secuencias automáticas cuando el lead responde
- esperar 10 segundos reales desde el último mensaje del lead
- cancelar procesos viejos si entra un mensaje más reciente
- agrupar todos los mensajes pendientes `processed_at IS NULL`
- responder una sola vez al bloque agrupado
- marcar como procesados los mensajes ya agrupados
- generar respuesta de Valentina
- enviar chunks por WhatsApp
- analizar comercialmente la conversación
- sincronizar conversación y follow-up
- disparar notificación humana si aplica

### 7.2 Persistencia

Archivo:
- [`lib/crm/persistence.ts`](/CRM/lib/crm/persistence.ts)

Responsabilidad:
- acceso server-side a Supabase
- CRUD operativo de conversaciones y mensajes
- carga de historial
- lock de procesamiento por conversación
- liberación de locks vencidos
- sincronización de análisis comercial
- actualización de estado conversacional
- creación de tareas operativas
- guardado de eventos
- control de notificación humana

### 7.3 Valentina

Archivos:
- [`lib/openai/respond.ts`](/CRM/lib/openai/respond.ts)
- [`lib/openai/client.ts`](/CRM/lib/openai/client.ts)
- [`lib/agent/prompt.ts`](/CRM/lib/agent/prompt.ts)
- [`lib/agent/resolve-prompt.ts`](/CRM/lib/agent/resolve-prompt.ts)

Responsabilidad:
- resolver el prompt activo
- construir contexto desde CRM
- invocar OpenAI
- parsear la respuesta del modelo
- devolver mensajes y actualizaciones de estado

Prompt source order:
1. `app_settings.valentina_prompt`
2. `VALENTINA_SYSTEM_PROMPT`
3. `AGENT_PROMPT.md`
4. fallback local

### 7.4 Sales Brain

Archivo:
- [`lib/sales-brain/analyze.ts`](/CRM/lib/sales-brain/analyze.ts)

Responsabilidad:
- analizar conversación
- producir:
  - nombre
  - necesidad
  - producto deseado
  - objeciones
  - temperatura
  - etapa
  - score
  - siguiente acción
  - mensaje sugerido
  - prioridad de follow-up
  - eventos

### 7.5 Motor de automatización

Archivos:
- [`lib/crm/automation.ts`](/CRM/lib/crm/automation.ts)
- [`lib/crm/automation-config.ts`](/CRM/lib/crm/automation-config.ts)

Responsabilidad:
- resolver configuración del motor desde `app_settings`
- decidir si una conversación es elegible para recontacto
- validar:
  - automatización habilitada
  - IA activa o no
  - ventana horaria
  - días permitidos
  - tiempo desde el último mensaje del lead
  - límite diario por conversación
  - estado del follow-up
- generar follow-up automático
- enviar WhatsApp
- volver a analizar la conversación
- registrar eventos
- respetar una secuencia configurable de hasta 5 acercamientos

Configuración persistida en:
- `app_settings.key = automation_config`

## 8. Modelo de Datos

Archivo principal:
- [`supabase/schema.sql`](/CRM/supabase/schema.sql)

### 8.1 Tablas actuales

#### `conversations`

Propósito:
- entidad principal del lead y estado comercial

Campos importantes:
- identidad:
  - `phone_number`
  - `first_name`
  - `last_name`
  - `full_name`
  - `preferred_name`
  - `email`
  - `country`
- estado comercial:
  - `lead_status`
  - `lead_temperature`
  - `lead_priority`
  - `lead_score`
  - `current_intent`
  - `desired_product`
  - `budget_range`
  - `objections`
  - `last_summary`
  - `next_step`
- origen:
  - `lead_source`
  - `source_channel`
  - `source_campaign`
  - `source_ad`
- control IA:
  - `ai_enabled`
  - `ai_mode`
- seguimiento:
  - `last_followup_at`
  - `next_followup_at`
  - `followup_count`
  - `followup_attempt_count`
  - `followup_active`
  - `lead_replied_after_last_followup`
- memoria conversacional:
  - `has_greeted`
  - `has_asked_name`
  - `conversation_stage`
  - `last_user_intent`
  - `last_ai_action`
  - `last_analysis`
- operación:
  - `last_user_message_at`
  - `last_assistant_response_at`
  - `processing`
  - `processing_started_at`
  - `human_notified`

#### `messages`

Propósito:
- historial de chat por conversación

Campos importantes:
- `conversation_id`
- `role`
- `content`
- `is_manual`
- `whatsapp_message_id`
- `processed_at`

#### `follow_ups`

Propósito:
- capa comercial resumida para operación

Campos importantes:
- `summary`
- `customer_need`
- `desired_product`
- `stage`
- `priority`
- `follow_up_type`
- `follow_up_status`
- `next_step`
- `recommended_action`
- `follow_up_date`
- `agreement_note`
- `last_agent_note`

#### `tasks`

Propósito:
- tareas operativas activas del pipeline

Campos importantes:
- `title`
- `description`
- `task_type`
- `priority`
- `status`
- `due_at`
- `owner_name`
- `owner_email`
- `source`
- `auto_created`
- `completed_at`
- `metadata`

#### `appointments`

Propósito:
- agenda comercial y citas

Campos importantes:
- `title`
- `status`
- `scheduled_at`
- `duration_minutes`
- `meeting_url`
- `notes`
- `owner_name`
- `owner_email`
- `source`

#### `lead_events`

Propósito:
- auditoría de eventos funcionales

Ejemplos:
- `manual_reply`
- `manual_reply_delivery`
- `conversation_deleted`
- `automation_followup_sent`
- `automation_followup_failed`
- `human_notification_sent`

#### `app_settings`

Propósito:
- configuración global editable sin redeploy

Keys actuales esperadas:
- `valentina_prompt`
- `automation_config`
- `deleted_conversation_ids`

#### `data_exports`

Propósito:
- auditoría de exportaciones

Campos:
- `export_type`
- `export_format`
- `row_count`
- `requested_by`
- `filters`

## 9. Estados, Tipos y Clasificaciones

Archivo:
- [`lib/types.ts`](/CRM/lib/types.ts)
- [`lib/crm/format.ts`](/CRM/lib/crm/format.ts)

### 9.1 Lead status

Estados actuales:
- `new`
- `conversing`
- `qualified`
- `warm`
- `hot`
- `ready_for_call`
- `call_scheduled`
- `follow_up_pending`
- `not_qualified`
- `closed`
- `lost`
- `customer`

Compatibilidad legacy:
- `qualifying`
- `nurturing`
- `ready_to_buy`
- `won`

### 9.2 Follow-up types

- `write_back`
- `confirm_call`
- `remind_appointment`
- `recover_cold_lead`
- `review_decision`
- `post_call`
- `post_purchase`

### 9.3 Follow-up statuses

- `pending`
- `overdue`
- `completed`
- `rescheduled`
- `cancelled`

### 9.4 Task types

- `follow_up`
- `call_review`
- `qualification`
- `manual_outreach`
- `recovery`
- `appointment_prep`

## 10. Configuración del Motor Automático

Persistencia:
- `app_settings.automation_config`

Estructura:
- `enabled`
- `maxMessagesPerRun`
- `minHoursSinceLastInbound`
- `businessHoursStart`
- `businessHoursEnd`
- `allowedWeekdays`
- `dailyLimit`
- `requireAiEnabled`
- `attemptIntervalsHours`

Valores por defecto actuales:
- `enabled: true`
- `maxMessagesPerRun: 12`
- `minHoursSinceLastInbound: 12`
- `businessHoursStart: 8`
- `businessHoursEnd: 19`
- `allowedWeekdays: [1,2,3,4,5,6]`
- `dailyLimit: 3`
- `requireAiEnabled: true`
- `attemptIntervalsHours: [4,24,72,168,336]`

Interpretación de `attemptIntervalsHours`:
- acercamiento 1 a las 4 horas
- acercamiento 2 a las 24 horas
- acercamiento 3 a las 72 horas
- acercamiento 4 a las 168 horas
- acercamiento 5 a las 336 horas

## 11. Exportaciones

### 11.1 Qué existe

Desde UI:
- exportación CSV de conversaciones
- exportación CSV de follow-ups
- exportación CSV de tareas
- snapshot JSON completo del CRM

Archivos:
- [`components/crm/WorkspaceToolbar.tsx`](/CRM/components/crm/WorkspaceToolbar.tsx)
- [`lib/crm/export.ts`](/CRM/lib/crm/export.ts)
- [`app/api/exports/log/route.ts`](/CRM/app/api/exports/log/route.ts)

### 11.2 Para qué existe

Uso operativo:
- compartir base comercial
- análisis externo
- backup lógico
- transferencia a BI

## 12. Despliegue y Dominio

Proyecto Vercel:
- `german-agent-crm`

Vinculación local:
- `.vercel/project.json`

Dominio operativo:
- `https://crm.germanospina.com`

Configuración importante:
- [`next.config.ts`](/CRM/next.config.ts)

Actualmente:
- `assetPrefix` usa por defecto `https://crm.germanospina.com`

## 13. Variables de Entorno Relevantes

Variables detectadas en Vercel:
- `HUMAN_NOTIFY_PHONE`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `META_APP_SECRET`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `CRON_SECRET`

## 14. Operación Diaria Esperada

### 14.1 Cuando entra un lead

1. Meta llama `/api/webhook`
2. se parsea el payload
3. se crea o actualiza la conversación
4. se guarda el mensaje
5. se actualiza `last_user_message_at`
6. se espera el debounce real de 10 segundos
7. si entró un mensaje más nuevo, el proceso anterior se aborta
8. se adquiere lock de conversación
9. se agrupan todos los mensajes pendientes del lead
10. se genera una sola respuesta para el bloque completo
11. se marcan los mensajes agrupados como procesados
12. se envía por WhatsApp en máximo 3 chunks y en orden
13. se analiza comercialmente la conversación
14. se actualiza follow-up y estado conversacional
15. se crea/actualiza tarea
16. el CRM se refresca por realtime

### 14.2 Cuando el humano toma control

1. desde conversaciones cambia `IA activa` a `Control manual`
2. la conversación deja de responder automáticamente
3. el humano puede enviar mensaje desde el panel de detalle
4. el sistema sigue guardando mensajes y análisis

### 14.3 Cuando corre la automatización

1. se llama `/api/automation/run`
2. se cargan reglas
3. se buscan follow-ups pendientes
4. se filtran elegibles
5. se valida el número de acercamiento según `followup_attempt_count`
6. se genera y envía follow-up automático
7. se reanaliza el lead
8. se calcula la próxima fecha con `attemptIntervalsHours`
9. se registran eventos

## 15. Validaciones Realizadas

En esta fase se validó:
- `npm run build`
- `npm run lint`
- endpoint local `GET /api/automation/run`
- deploy productivo a Vercel
- alias de `crm.germanospina.com`
- respuesta HTTP `200` de:
  - `/`
  - `/CRM`

Validaciones nuevas de esta iteración:
- debounce real de 10 segundos compilando y conectado al flujo de webhook
- agrupación de mensajes pendientes antes de responder
- secuencia de 5 acercamientos configurable desde settings
- filtros navegables en dashboard, conversaciones y follow-ups
- toolbar compacta de exportaciones

## 16. Limitaciones Actuales

Lo que existe pero aún puede mejorarse:
- no hay scheduler gestionado desde el repo
  - hoy el motor automático necesita cron externo o Vercel Cron
- `appointments` ya existe en datos y dashboard, pero aún no tiene flujo de creación completo desde UI
- no hay BI externo integrado todavía
- la analítica depende de poblar bien `lead_source`, `source_channel`, `source_campaign`, `source_ad`
- no hay multi-tenant; es un CRM de un solo negocio
- `next lint` sigue funcionando, pero la CLI de Next lo marca como deprecada hacia Next 16
- la validación admin actual considera válido a cualquier usuario autenticado de Supabase con acceso al CRM; si el equipo crece, conviene evolucionar a roles explícitos

## 17. Qué Se Construyó en Esta Intervención

### Base de datos y modelo
- consolidación del schema para que coincida con el código real
- incorporación de `tasks`
- incorporación de `appointments`
- incorporación de `data_exports`
- expansión de `conversations` con memoria, estado conversacional y seguimiento

### Operación CRM
- carga en frontend de tareas, citas y eventos
- dashboard ampliado con operación y analítica
- exportación desde UI
- logging de exportaciones

### IA y automatización
- reglas configurables de automatización
- endpoint para ejecutar seguimientos automáticos
- pausa de secuencia automática cuando el lead responde
- recálculo comercial después de follow-up automático
- debounce real sobre mensajes entrantes
- agrupación de mensajes del lead antes de responder
- lock de conversación con cancelación limpia de procesos viejos
- secuencia configurable de 5 acercamientos
- tracking de `followup_attempt_count` y `last_assistant_response_at`

### UI
- refinamiento visual del workspace
- navegación del dashboard con métricas clicables
- filtros por query string para colas reales de trabajo
- corrección de contraste del sidebar
- toolbar superior compacta de exportaciones
- settings ampliado con control del motor automático

### Deploy
- publicación en producción sobre el mismo proyecto de Vercel
- alias activo en `crm.germanospina.com`

## 18. Recomendaciones Siguientes

Próximas mejoras recomendadas:
1. crear Vercel Cron para `/api/automation/run`
2. agregar CRUD visual de `appointments`
3. agregar CRUD visual de `tasks`
4. mostrar cohortes y conversiones por fuente
5. integrar gasto publicitario para ver CPL y CAC
6. crear vista de auditoría avanzada
7. migrar de `next lint` a ESLint CLI estándar

## 19. Política de Documentación Futura

A partir de ahora, este archivo debe actualizarse cuando cambie cualquiera de estas áreas:
- esquema de base de datos
- rutas de app o API
- configuración del agente
- lógica de automatización
- paneles del CRM
- despliegue
- dominios
- exportaciones
- métricas
- dependencias críticas

## 20. Changelog

### 2026-05-11

Se documentó y consolidó el estado funcional del CRM.

Cambios principales de esta etapa:
- consolidación de Fase 1 con modelo robusto de datos
- incorporación de tareas, citas y exportaciones
- implementación de Fase 2 con motor de seguimiento automático
- implementación de Fase 3 con analítica operativa y de mercadeo en dashboard
- implementación de Fase 4 con auditoría, logging de exportaciones y mayor control operativo
- endurecimiento del flujo conversacional con debounce real, agrupación y lock por conversación
- incorporación de secuencia configurable de hasta 5 acercamientos automáticos
- mejora de UX con métricas navegables, filtros de cola y sidebar corregido
- despliegue productivo en `https://crm.germanospina.com`

### 2026-05-15

Se ejecutó una fase de hardening de seguridad sin cambiar la lógica comercial.

Cambios principales de esta etapa:
- validación real de `X-Hub-Signature-256` en `POST /api/webhook`
- incorporación de `META_APP_SECRET` para autenticar llamadas de Meta
- cierre de endpoints internos con validación server-side de sesión autenticada
- protección del endpoint de automatización con `CRON_SECRET`
- compatibilidad mantenida para ejecutar automatización manual desde Settings con sesión autenticada
- reducción de logging sensible en webhook y diagnósticos
- documentación explícita de endpoints públicos, privados y secretos requeridos
