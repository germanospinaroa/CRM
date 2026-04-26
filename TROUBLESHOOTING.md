# Troubleshooting - CRM Valentina

## Problema: Página se queda en "Cargando workspace..."

Si ves la página en blanco o con el mensaje "Cargando workspace..." indefinidamente:

### 1. Verifica variables de entorno en Vercel

El CRM necesita las siguientes variables **NEXT_PUBLIC_*** en el dashboard de Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Cómo configurarlas:**
1. Ve a [Vercel Dashboard](https://vercel.com)
2. Selecciona el proyecto `german-agent-crm`
3. Settings → Environment Variables
4. Agrega o verifica que existan las dos variables NEXT_PUBLIC_*
5. Redeploy el proyecto (Settings → Deploy)

> ⚠️ Sin estas variables, la página nunca podrá conectarse a Supabase.

### 2. Verifica la consola del navegador (F12)

Abre las herramientas de desarrollador (F12 → Console) y busca:

**Error esperado si faltan variables:**
```
Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY para iniciar el CRM.
```

**Error esperado si Supabase tarda mucho:**
```
Timeout en autenticación. Por favor recarga la página.
```

**Otros errores:** cópia el mensaje exacto y reporta a tu desarrollador.

### 3. Verifica la conexión a Supabase

En la consola del navegador (F12 → Network):

1. Busca requests a `supabase.co`
2. Si ves requests con status **403** o **401**: problema de permisos o credenciales
3. Si no ves ningún request a Supabase: las variables NEXT_PUBLIC_ no están cargadas

### 4. Limpia el cache de Vercel

A veces Vercel sirve una versión vieja:

1. En Vercel Dashboard → proyecto → Deployments
2. Haz clic en el deployment más reciente
3. Click en los tres puntos (...) → "Redeploy"

O desde la línea de comandos:
```bash
vercel --prod
```

### 5. Verifica que tu usuario existe en Supabase

Abra el dashboard de Supabase:

1. Supabase Dashboard → Authentication → Users
2. Verifica que existe un usuario con el email que intentas usar
3. Si no existe, crea uno: Authentication → Add User

### 6. Timeout de 10 segundos

Si ves "Timeout en autenticación", significa que Supabase tardó más de 10 segundos.

**Causas comunes:**
- Supabase está en zona geográfica lejana
- Conexión lenta a Internet
- Supabase está caído o sobrecargado

**Solución:** Recarga la página (F5). El timeout se mostrará después de 10 segundos si persiste.

### 7. Verifica la URL

Asegúrate de acceder a:
- `https://germanospina.com/CRM` (con la ruta `/CRM`)
- NO a `https://germanospina.com` o `https://germanospina.com/`

## Problema: Botón "Tomar control" no funciona

Si al clickear el botón de toggle de IA no pasa nada:

### 1. Verifica permisos en Supabase RLS

Ve a Supabase Dashboard → SQL Editor y ejecuta:

```sql
SELECT * FROM conversations LIMIT 1;
```

Si esto falla con error, hay un problema de RLS. Contacta al desarrollador.

### 2. Verifica que hay conversaciones

En el panel izquierdo, ¿hay al menos una conversación listada?

Si no hay conversaciones: no hay mensajes de WhatsApp aún. Espera a que llegue un mensaje real o prueba el webhook.

## Problema: "/CRM/settings" retorna 404

Si accedes a `https://germanospina.com/CRM/settings` y ves 404:

### 1. Verifica que la ruta existe localmente

```bash
npm run build
```

En el output, busca:
```
└ ○ /CRM/settings                          ...
```

Si está ahí, el problema es del deploy de Vercel.

### 2. Redeploy en Vercel

En Vercel Dashboard:
1. Selecciona el proyecto
2. Settings → Deploy  
3. Haz click en "Redeploy"

O desde CLI:
```bash
vercel --prod --force
```

## Problema: API `/api/settings` retorna 404

Si intentas guardar un prompt en Settings y ves error:

### 1. Verifica que la ruta existe

```bash
npm run build
```

Busca:
```
├ ƒ /api/settings
```

Si está ahí, el deploy de Vercel está desactualizado.

### 2. Redeploy como en el punto anterior

## Problema: "Error de carga" con mensaje rojo

Si ves la página con un mensaje de error en rojo y un botón "Reintentar":

**Mensaje esperado:**
```
Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY para iniciar el CRM.
```

→ Configura las variables NEXT_PUBLIC_* en Vercel (ver punto 1 arriba).

**Otro mensaje:**
```
Error de autenticación: <mensaje específico>
```

→ Reporta el mensaje exacto al desarrollador.

## Problema: Vercel muestra "DEPLOYMENT_NOT_FOUND"

Si intentas acceder a `germanospina.vercel.app` y ves "DEPLOYMENT_NOT_FOUND":

Esto es normal. Usa el dominio correcto: `germanospina.com/CRM` (no `.vercel.app`).

Si necesitas probar en vercel.app:
- Usa `german-agent-crm.vercel.app/CRM` en lugar de `germanospina.vercel.app`.

## Problema: "/CRM/conversations" o "/CRM/follow-ups" estan en blanco

Si las paginas cargan pero no muestran datos:

### 1. Verifica que hay datos en Supabase

En Supabase Dashboard → SQL Editor:

```sql
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM messages;
SELECT COUNT(*) FROM follow_ups;
```

Si todos retornan 0, no hay datos. Envía un mensaje de prueba por WhatsApp o prueba el webhook.

### 2. Verifica permisos RLS

```sql
SELECT * FROM conversations LIMIT 1;
```

Si falla, hay un problema de RLS. Contacta al desarrollador.

## Checklist de Deploy Exitoso

Después de cualquier deploy, verifica:

- [ ] `https://germanospina.com/CRM` → carga correctamente
- [ ] Muestra conversaciones o "Sin conversaciones" (no "Cargando...")
- [ ] Se puede hacer login (si no tienes sesión activa)
- [ ] `/CRM/conversations` funciona
- [ ] `/CRM/follow-ups` funciona
- [ ] `/CRM/settings` funciona (HTTP 200, no 404)
- [ ] Botón "Tomar control" responde al click
- [ ] F12 Console no muestra errores (excepto warnings de Next.js)

## Contactar al desarrollador

Si ninguno de los pasos anteriores funciona, proporciona:

1. **Pantalla del error** (screenshot)
2. **Console F12** (copiar texto completo de errores)
3. **URL exacta** donde ves el problema
4. **Pasos para reproducir**
5. **Qué esperabas ver**

---

**Última actualización:** Abril 2026
**Versión CRM:** Fase 1 (Control Manual + Settings)
