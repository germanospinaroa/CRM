# Pórtate Mal · CRM Valentina

CRM de WhatsApp en Next.js para **Pórtate Mal** (Germán Ospina Roa).
Recibe leads desde WhatsApp, los responde con Valentina (asistente AI),
los califica con Sales Brain y los organiza en un panel comercial claro.

## Rutas

- Dashboard CRM: `https://germanospina.com/CRM`
- Conversaciones: `https://germanospina.com/CRM/conversations`
- Follow-ups: `https://germanospina.com/CRM/follow-ups`
- Webhook Meta WhatsApp: `https://germanospina.com/api/webhook`

Importante:

- El dashboard vive en `/CRM`.
- El webhook vive en `/api/webhook`.
- La callback URL de Meta **no** debe usar `/CRM`.

## Stack

- Next.js 15 (App Router)
- Supabase Auth + Postgres + Realtime
- OpenAI (`gpt-4.1-mini`) para Valentina y Sales Brain
- Meta WhatsApp Cloud API (Graph v23)
- UI CRM responsive en **modo claro** (cálido, tipo Notion / Linear)

## Arquitectura corta

```
Lead WhatsApp
   │
   ▼
POST /api/webhook
   │  parse → guardar mensaje
   ▼
Valentina (lib/openai/respond)  ──► reply
   │                                │
   ▼                                ▼
guardar reply              enviar por WhatsApp Cloud API
   │
   ▼
Sales Brain (lib/sales-brain/analyze)
   │
   ▼
sync conversation + follow_up + lead_events
   │
   ▼
CRM /CRM (Supabase Realtime)
```

## Desarrollo local

1. Copia `.env.local.example` a `.env.local`.
2. Completa las variables (ver sección abajo).
3. Instala dependencias:

   ```bash
   npm install
   ```

4. Inicia la app:

   ```bash
   npm run dev
   ```

5. Abre:

   - `http://localhost:3000/CRM`
   - `http://localhost:3000/api/webhook`

## Variables de entorno

Todas son **obligatorias** en producción. No subas valores reales al repo.

```bash
WHATSAPP_ACCESS_TOKEN=        # Token permanente de WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=     # Phone number ID del WhatsApp Business
WHATSAPP_VERIFY_TOKEN=        # Cadena que pones también en Meta (verify token)
OPENAI_API_KEY=               # Key de OpenAI (org de Pórtate Mal)
NEXT_PUBLIC_SUPABASE_URL=     # https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=# anon key (frontend, RLS protegido)
SUPABASE_SERVICE_ROLE_KEY=    # service role (server-only, NO exponer)
```

> ⚠️ Si alguna de estas claves se commitea por error, **rotálas inmediatamente**
> en Meta, OpenAI y Supabase.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. SQL Editor → ejecuta `supabase/schema.sql`.
3. Authentication → activa email/password.
4. Crea al menos un usuario para entrar al CRM.

El schema incluye RLS:

- Service role: full access (escrituras del webhook).
- Authenticated: read + update sobre conversations y follow_ups.
- Realtime activo en `conversations`, `messages`, `follow_ups`.

## Deploy en Vercel

1. Conecta el repo al proyecto Vercel `german-agent-crm`.
2. Agrega las variables de entorno en Vercel.
3. Deploy.
4. Verifica primero la URL temporal:

   - `https://<proyecto>.vercel.app/CRM`
   - `https://<proyecto>.vercel.app/api/webhook`

> Nota técnica: `next.config.ts` tiene `assetPrefix: "/CRM-static"`. Esto es
> necesario si `germanospina.com` es WordPress/otro sitio y `/CRM` es un proxy
> al deploy de Vercel. Si germanospina.com está apuntando 100% a este proyecto
> Vercel, este `assetPrefix` debe **eliminarse** o los assets estáticos
> (`_next/static/...`) servirán 404. Verifica la topología antes de deployar.

## Configurar Meta WhatsApp Cloud API

En Meta App → WhatsApp → Configuration:

- **Callback URL**: `https://germanospina.com/api/webhook`
- **Verify Token**: el mismo valor que pongas en `WHATSAPP_VERIFY_TOKEN`.
- Subscribe el webhook al campo `messages`.

No uses `/CRM` como callback URL.

## Probar el webhook

GET (verificación de Meta):

```bash
curl "https://germanospina.com/api/webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=ping"
# => ping
```

POST (simulación de mensaje entrante):

```bash
curl -X POST https://germanospina.com/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry":[{"changes":[{"value":{
      "contacts":[{"profile":{"name":"Test Lead"}}],
      "messages":[{
        "from":"573001112233","id":"wamid.test",
        "type":"text","text":{"body":"hola"}
      }]
    }}]}]
  }'
```

Esperado: `{"ok":true,"ignored":false}` y un nuevo registro en
`conversations` + `messages` + `follow_ups`.

## Probar WhatsApp en vivo

1. Manda un WhatsApp al número de WhatsApp Business conectado.
2. Valentina debe responder en <10s.
3. En `/CRM/conversations` aparece la conversación con el chat completo.
4. En `/CRM/follow-ups` aparece el follow-up con prioridad y siguiente acción.

## Revisar logs en Vercel

- Dashboard de Vercel → proyecto `german-agent-crm` → **Logs**.
- Filtra por `path = /api/webhook`.
- Errores comunes:
  - `Meta WhatsApp API error: { status: 401, ... }` → token expirado, rotar.
  - `Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY` → variables.
  - `Sales Brain analysis failed` → fallback a heurística, no bloquea respuesta.

## Archivos clave

- `app/api/webhook/route.ts` — entrada Meta (GET verify, POST mensajes).
- `lib/crm/process-incoming-message.ts` — orquestación del flujo entrante.
- `lib/whatsapp/parse.ts` / `lib/whatsapp/send.ts` — Meta in/out.
- `lib/openai/respond.ts` — Valentina.
- `lib/agent/prompt.ts` — system prompt de Valentina.
- `lib/sales-brain/analyze.ts` — calificación + resumen + follow-up sugerido.
- `lib/crm/persistence.ts` — escritura en Supabase.
- `components/crm/*` — UI del CRM.
- `supabase/schema.sql` — DDL completo + RLS.
- `AGENT_PROMPT.md` — documento de la persona Valentina (referencia humana).

## Verificación

```bash
npm run lint
npm run build
```

## Pendiente para Pórtate Mal

El proyecto funciona, pero hay información de negocio que **no debe inventarse**.
Para tener un agente y un CRM al 100%, falta confirmar con Germán:

- [ ] **Niveles del Método PM**: ¿qué incluye exactamente el nivel ~299 USD vs el ~999 USD? (módulos, comunidad, llamadas, soporte, producto físico).
- [ ] **Catálogo Zilis**: nombre del producto físico principal, presentación, precio público, disponibilidad por país.
- [ ] **Países donde se puede operar** (Zilis tiene restricciones por mercado).
- [ ] **Calendly disponibilidad real** (¿siempre `caballerodigital-us/30min`? ¿zona horaria?).
- [ ] **Casos de éxito y testimonios** que Valentina pueda citar como prueba social cuando aplique.
- [ ] **Política de follow-up**: ¿después de cuántos toques sin respuesta dejamos de escribir? (hoy: heurística 4-48h, sin tope).
- [ ] **¿Hay handoff a humano?** Cuándo Valentina debe escalar a Germán o a un comercial humano (hoy: nunca, responde siempre).
- [ ] **Idiomas soportados**: hoy solo español. Confirmar si llegan leads en inglés.
- [ ] **Tracking de origen**: ¿queremos saber si vino de la landing, IG, ads, orgánico? Hoy no se captura el `entry_point`.

Hasta que esa info esté confirmada, Valentina sigue las reglas conservadoras de
`AGENT_PROMPT.md`: si el lead pregunta algo que no sabe, lo deriva a la llamada
con Germán en vez de inventar.
