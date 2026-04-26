-- ============================================================
-- RESET completo de la base de datos del CRM Pórtate Mal.
-- Borra TODOS los datos y la estructura (tablas, políticas,
-- triggers, función set_updated_at).
--
-- Después de ejecutar esto, vuelve a correr supabase/schema.sql
-- para recrear el esquema vacío.
--
-- ⚠️ Esto NO toca:
--    - Usuarios de auth (auth.users)
--    - Otros schemas que tengas
-- Solo borra lo que este proyecto creó en `public`.
-- ============================================================

begin;

-- 1. Sacar las tablas de la publicación de Realtime (ignora si no existe)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'follow_ups'
    ) then
      alter publication supabase_realtime drop table public.follow_ups;
    end if;

    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime drop table public.messages;
    end if;

    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversations'
    ) then
      alter publication supabase_realtime drop table public.conversations;
    end if;
  end if;
end
$$;

-- 2. Drop tablas (CASCADE elimina políticas, triggers, FKs e índices)
drop table if exists public.lead_events  cascade;
drop table if exists public.follow_ups   cascade;
drop table if exists public.messages     cascade;
drop table if exists public.conversations cascade;

-- 3. Drop función helper
drop function if exists public.set_updated_at() cascade;

commit;

-- Después de esto, ejecuta supabase/schema.sql para recrear todo limpio.
