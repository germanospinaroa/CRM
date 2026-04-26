# 🚀 CRM VALENTINA — ESPECIFICACIÓN COMPLETA DE MODIFICACIONES

## 🎯 OBJETIVO GENERAL

Transformar el CRM actual en una herramienta profesional de ventas que permita:

- Gestionar leads de forma estratégica
- Automatizar conversaciones con IA (Valentina)
- Tomar control manual en cualquier momento
- Ejecutar seguimiento efectivo
- No perder oportunidades
- Convertir conversaciones en citas

---

# 🧩 NUEVA ESTRUCTURA DEL CRM

## Menú lateral actualizado

- Dashboard  
- Conversaciones  
- Follow-ups  
- Clientes / Leads  
- Configuración  

---

# 💬 MÓDULO: CONVERSACIONES

## Vista principal

### Panel izquierdo
- Lista de conversaciones
- Nombre del lead
- Teléfono
- Estado del lead
- Prioridad
- Último mensaje
- Próximo seguimiento
- Indicador:
  - IA activa
  - Control manual

---

### Panel central (chat)

- Historial completo
- Tipos de mensaje:
  - Lead
  - Valentina (IA)
  - Germán (manual)

### Acciones disponibles

- Tomar control (manual)
- Activar IA
- Crear seguimiento
- Cambiar estado del lead
- Marcar prioridad
- Agendar llamada

---

### Panel derecho (contexto del lead)

- Nombre
- Teléfono
- Fuente (ads, landing, IG)
- Estado
- Prioridad
- Score
- Dolor detectado
- Interés principal
- Objeciones
- Resumen automático
- Último acuerdo
- Próximo seguimiento
- Próximo paso sugerido
- Botón copiar Calendly

---

# 🤖 MÓDULO: VALENTINA (IA)

## Función principal

- Recibir leads
- Hacer onboarding
- Calificar
- Generar confianza
- Manejar objeciones
- Llevar a llamada

---

## Reglas de comportamiento

- No sonar robótica
- No responder igual a todos
- No presionar
- No vender directo
- Guiar con preguntas
- Mensajes cortos
- 1 pregunta por mensaje

---

# 🧠 CONTROL MANUAL (CRÍTICO)

## Botón: “Tomar control”

### Cuando está activo:

- IA NO responde
- Germán responde manualmente
- IA puede sugerir, pero no enviar

---

## Rehabilitar IA

Cuando se reactiva:

- IA analiza toda la conversación
- Detecta:
  - estado del lead
  - intención
  - objeciones
- Continúa desde el punto real

---

## Regla crítica

SI control manual está activo:

→ La IA NO puede responder bajo ninguna circunstancia

---

# 🔁 MÓDULO: FOLLOW-UPS (SEGUIMIENTOS)

## Objetivo

Evitar pérdida de leads por falta de seguimiento.

---

## Datos de cada seguimiento

- Lead asociado
- Fecha
- Hora
- Tipo
- Nota del acuerdo
- Estado
- Responsable

---

## Tipos de seguimiento

- Volver a escribir
- Confirmar llamada
- Recuperar lead
- Cierre
- Seguimiento post conversación
- Seguimiento producto
- Seguimiento negocio

---

## Estados del seguimiento

- Pendiente
- Vencido
- Completado
- Reprogramado
- Cancelado

---

## Estados del lead

- Nuevo
- Conversando
- Calificado
- Tibio
- Caliente
- Listo para llamada
- Llamada agendada
- Seguimiento pendiente
- No califica
- Cerrado
- Perdido
- Cliente

---

## Prioridad del lead

- Baja
- Media
- Alta
- Urgente

---

## Acuerdos (clave de ventas)

Permitir guardar acuerdos como:

- “Escribirle mañana”
- “Revisar con pareja”
- “Hablar después del trabajo”

Campos:

- Descripción
- Fecha
- Hora
- Recordatorio activo

---

## Alertas automáticas

- Seguimiento próximo
- Seguimiento vencido
- Lead caliente sin respuesta
- Llamada próxima
- Lead sin clasificar

---

# 📊 DASHBOARD

## Métricas clave

- Conversaciones totales
- Nuevos leads
- Leads calientes
- Seguimientos pendientes
- Seguimientos vencidos
- Llamadas agendadas
- Tasa de conversión
- Leads por fuente

---

# 🧠 RESUMEN AUTOMÁTICO DEL LEAD

Generado por IA:

- Quién es
- Qué busca
- Dolor
- Objeciones
- Nivel de interés
- Próximo paso

---

# 🔢 SCORE DEL LEAD

Escala: 0 – 100

## Suma:

- +10 respondió
- +15 quiere algo adicional
- +15 expresa dolor
- +10 pregunta cómo funciona
- +15 acepta llamada

## Resta:

- -20 busca dinero fácil
- -20 no tiene tiempo
- -30 rechaza llamada

---

## Clasificación

- 0–30 → frío  
- 31–60 → tibio  
- 61–80 → caliente  
- 81–100 → listo  

---

# 📌 PIPELINE COMERCIAL

Columnas:

1. Nuevo  
2. Conversando  
3. Calificado  
4. Seguimiento  
5. Listo  
6. Agendado  
7. Cerrado  
8. Perdido  

---

# ⚙️ MÓDULO: CONFIGURACIÓN

## 1. Cerebro de Valentina

- Editar prompt completo
- Guardar cambios
- Aplicación inmediata
- Sin redeploy

---

## 2. Datos del negocio

- Nombre proyecto
- Método PM
- Reglas comerciales
- Niveles de entrada

---

## 3. Links

- WhatsApp
- Calendly
- Instagram
- Landing
- Email

---

## 4. Reglas de conversación

Toggles:

- Mencionar Zilis solo si preguntan
- No hablar de inversión al inicio
- Una pregunta por mensaje
- Modo vendedor
- Modo consultivo

---

## 5. Mensajes rápidos

Plantillas editables:

- Inicio
- Información
- Objeciones
- Cita
- Follow-ups

---

## 6. Seguimientos

Configurar:

- Tiempo follow-up 1
- Tiempo follow-up 2
- Tiempo lead frío
- Activación automática

---

## 7. Tracking

Eventos:

- WhatsAppClick
- CalendlyClick
- Lead
- PageView

---

# 🧾 HISTORIAL DE CAMBIOS

Registrar:

- Cambios de prompt
- Cambios de estado
- Seguimientos creados
- Control manual activado

Campos:

- Usuario
- Fecha
- Acción
- Antes / Después

---

# 🔐 PERMISOS (PREPARADO)

- Admin
- Vendedor
- Lectura

---

# 🧪 MODO PRUEBA

Permitir probar respuestas de Valentina sin afectar leads reales.

---

# 🧠 PRINCIPIO CENTRAL

Todo lead debe tener siempre:

- Estado  
- Prioridad  
- Próximo paso  
- Fecha de seguimiento  

---

# 🚀 PRIORIDAD DE IMPLEMENTACIÓN

## Fase 1 (crítico)

- Configuración (prompt editable)
- Control manual
- Seguimientos básicos
- Estados de lead

## Fase 2

- Score
- Resumen automático
- Pipeline

## Fase 3

- Automatizaciones
- Métricas avanzadas
- Integraciones

---

# ✅ CRITERIO DE ÉXITO

El CRM funciona correctamente cuando:

- Puedes editar el prompt sin código
- Puedes tomar control manual
- La IA respeta ese control
- Puedes crear seguimientos con fecha/hora
- No se pierde ningún lead
- Cada lead tiene contexto claro
- Se generan más conversaciones → más citas