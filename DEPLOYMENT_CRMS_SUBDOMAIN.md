# Configuración de crm.germanospina.com - Guía Paso a Paso

## Estado del código: ✅ LISTO

El código del CRM ya está configurado para funcionar en `crm.germanospina.com` con rutas limpias:

- `/` → Dashboard
- `/conversations` → Conversaciones  
- `/follow-ups` → Follow-ups
- `/settings` → Configuración

(Las rutas viejas `/CRM/*` siguen funcionando para compatibilidad)

---

## Paso 1: Verificar el proyecto Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Busca el proyecto `german-agent-crm`
3. Verifica que esté conectado a `germanospinaroa/CRM` en GitHub
4. El deployment actual debe mostrar status "Ready" ✅

---

## Paso 2: Agregar dominio custom a Vercel

1. En Vercel Dashboard → `german-agent-crm` proyecto
2. Settings → **Domains**
3. Click en "Add Domain"
4. Escribe: `crm.germanospina.com`
5. Click "Add"
6. Vercel te mostrará instrucciones DNS (ver Paso 3)

---

## Paso 3: Configurar DNS para crm.germanospina.com

### Opción A: Si germanospina.com está en Vercel (recomendado)

1. El host del dominio debería ser Vercel Nameservers
2. Ya debería estar configurado para germanospina.com
3. Vercel auto-gestiona todos los subdominios

**Verifica en Vercel:**
- Settings → Domains → germanospina.com
- Debería mostrar "Nameserver" configuration

Si ya está, espera 24-48 horas para propagación DNS.

### Opción B: Si germanospina.com está en otro host (GoDaddy, Namecheap, etc)

1. Ve al dashboard de tu proveedor DNS (GoDaddy, Namecheap, CloudFlare, etc)
2. Busca "DNS Records" o "DNS Management"
3. Crea un nuevo registro **CNAME**:
   ```
   Name:   crm
   Type:   CNAME
   Value:  cname.vercel.sh
   ```
   O el valor que Vercel te indicó en Paso 2
4. Guarda los cambios
5. Espera 24-48 horas para propagación

**Ejemplo Namecheap:**
- Host: `crm`
- Type: `CNAME Record`
- Value: `cname.vercel.sh`

**Ejemplo GoDaddy:**
- Type: `CNAME`
- Name: `crm`
- Value: `cname.vercel.sh`
- TTL: 600 (o valor por defecto)

### Opción C: Verifica qué configuración tienes hoy

```bash
# Ver nameservers de germanospina.com
nslookup -type=NS germanospina.com

# Ver records CNAME de germanospina.com  
nslookup -type=CNAME germanospina.com

# Ver si crm.germanospina.com apunta a algo
nslookup crm.germanospina.com
```

Si ves `vercel.com` o `vercel.sh` → Ya apunta a Vercel ✅

---

## Paso 4: Verificar configuración en Vercel

Dentro de 5 minutos después de agregar el dominio en Vercel:

1. Vercel Dashboard → `german-agent-crm` → Domains
2. Debería ver: `crm.germanospina.com` con estado:
   - 🟡 "Pending" (DNS aún no se propaga)
   - 🟢 "Active" (DNS configurado correctamente) ✅

Si muestra "Pending" después de 24h, verifica la configuración DNS.

---

## Paso 5: Probar en el navegador

Una vez que el dominio esté "Active" en Vercel:

1. Abre `https://crm.germanospina.com`
   - Debería cargar el dashboard del CRM
   - NO debe quedarse en "Cargando workspace..." (si falta variable NEXT_PUBLIC_SUPABASE_URL)
   - Debe mostrar login si no hay sesión activa ✅

2. Prueba las otras rutas:
   - `https://crm.germanospina.com/conversations`
   - `https://crm.germanospina.com/follow-ups`
   - `https://crm.germanospina.com/settings`

---

## Paso 6: Actualizar webhook (OPCIONAL)

Si actualmente el webhook está en `germanospina.com/api/webhook`, tienes dos opciones:

### Opción A: Mantener webhook en germanospina.com

Si germanospina.com sigue siendo un sitio WordPress o similar, el webhook puede seguir en:
```
https://germanospina.com/api/webhook
```

Meta WhatsApp seguirá enviando mensajes ahí sin cambios.

### Opción B: Mover webhook a crm.germanospina.com

1. En Meta App → WhatsApp → Configuration
2. Actualiza **Callback URL** a:
   ```
   https://crm.germanospina.com/api/webhook
   ```
3. Mantén el **Verify Token** igual

---

## Paso 7: Variables de entorno en Vercel (REVISIÓN)

Verifica que estas variables estén configuradas en Vercel Dashboard → `german-agent-crm` → Settings → Environment Variables:

**Públicas (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_SUPABASE_URL` = `https://xxxx.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu clave anon

**Privadas (server-only):**
- `SUPABASE_SERVICE_ROLE_KEY` = tu service key
- `OPENAI_API_KEY` = tu API key
- `WHATSAPP_ACCESS_TOKEN` = tu token
- `WHATSAPP_PHONE_NUMBER_ID` = tu phone ID
- `WHATSAPP_VERIFY_TOKEN` = tu verify token

Si falta alguna → Agrégala y click "Save"
Si cambió alguna → Actualiza y click "Save"

---

## Paso 8: Redeploy en Vercel (si cambiaste variables)

Si agregaste o actualizaste variables de entorno:

1. Vercel Dashboard → `german-agent-crm` → Deployments
2. Click en el deployment más reciente (el de arriba)
3. Click en los 3 puntos (...) → **Redeploy**

O desde terminal:
```bash
cd /CRM
vercel --prod
```

---

## Troubleshooting

### Error: "Domain not active yet"
- Espera 24-48 horas para que DNS se propague
- Verifica que el registro CNAME está correcto en tu proveedor DNS

### Error: "Cargando workspace..." indefinidamente
- Presiona F12 → Console
- Busca mensaje de error (debería aparecer en rojo)
- Probablemente faltan variables NEXT_PUBLIC_* en Vercel
- Ver Paso 7

### Error: 404 en /conversations, /follow-ups, /settings
- Espera a que Vercel termine el deploy (puede tomar 5-10 min)
- Recarga la página (Ctrl+F5 para forzar)
- Si persiste, ir a Vercel Dashboard → Redeploy

### Error: "No matches found" en Network tab
- El DNS aún no se ha propagado
- Espera 24-48 horas
- Prueba con `nslookup crm.germanospina.com` desde terminal

---

## Checklist final

- [ ] Dominio `crm.germanospina.com` agregado en Vercel
- [ ] DNS configurado (CNAME o Vercel Nameservers)
- [ ] Dominio muestra "Active" en Vercel Dashboard
- [ ] `https://crm.germanospina.com` carga sin 404
- [ ] Rutas `/conversations`, `/follow-ups`, `/settings` funcionan
- [ ] Variables NEXT_PUBLIC_* están en Vercel
- [ ] F12 Console no muestra errores de Supabase
- [ ] Webhook meta apunta a `germanospina.com/api/webhook` O `crm.germanospina.com/api/webhook`

---

## Referencia rápida

**URL anterior (deprecada):**
```
germanospina.com/CRM
germanospina.com/CRM/conversations
germanospina.com/CRM/follow-ups
```

**URL nueva:**
```
crm.germanospina.com
crm.germanospina.com/conversations
crm.germanospina.com/follow-ups
crm.germanospina.com/settings
```

**Webhook (elige una):**
```
germanospina.com/api/webhook    (recomendado si germanospina.com existe)
O
crm.germanospina.com/api/webhook
```

---

**Estado del código:** ✅ Listo para producción en crm.germanospina.com
**Última actualización:** Abril 2026
**Versión:** CRM Valentina Fase 1.2 (Clean Routes)
