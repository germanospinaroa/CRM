-- ============================================================
-- CRM Pórtate Mal · Schema completo (idempotente)
-- Ejecutar este archivo entero en Supabase SQL Editor.
-- Si ya existe data, las nuevas columnas se agregan sin perderla.
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TABLAS
-- ============================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  phone_number text unique not null,
  first_name text null,
  last_name text null,
  full_name text null,
  lead_status text not null default 'new',
  lead_temperature text not null default 'cold',
  lead_priority text not null default 'medium',
  lead_score integer not null default 0,
  lead_source text null,
  ai_enabled boolean not null default true,
  current_intent text null,
  desired_product text null,
  budget_range text null,
  objections text null,
  last_summary text null,
  next_step text null,
  last_contact_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotente: agregar columnas nuevas a tablas existentes
alter table public.conversations add column if not exists lead_priority text not null default 'medium';
alter table public.conversations add column if not exists lead_score integer not null default 0;
alter table public.conversations add column if not exists lead_source text null;
alter table public.conversations add column if not exists ai_enabled boolean not null default true;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  content text not null,
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists is_manual boolean not null default false;

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  phone_number text not null,
  contact_name text null,
  summary text not null,
  desired_product text null,
  customer_need text null,
  stage text not null default 'new',
  priority text not null default 'medium',
  next_step text null,
  recommended_action text null,
  follow_up_date timestamptz null,
  last_agent_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  event_type text not null,
  event_value text null,
  created_at timestamptz not null default now()
);

-- Configuración global (prompt de Valentina, datos del negocio, links, reglas)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index if not exists conversations_last_contact_at_idx
  on public.conversations (last_contact_at desc nulls last);

create index if not exists conversations_lead_status_idx
  on public.conversations (lead_status);

create index if not exists conversations_lead_priority_idx
  on public.conversations (lead_priority);

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);

create index if not exists follow_ups_stage_priority_idx
  on public.follow_ups (stage, priority);

create index if not exists lead_events_conversation_created_at_idx
  on public.lead_events (conversation_id, created_at desc);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

drop trigger if exists follow_ups_set_updated_at on public.follow_ups;
create trigger follow_ups_set_updated_at
before update on public.follow_ups
for each row
execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.follow_ups enable row level security;
alter table public.lead_events enable row level security;
alter table public.app_settings enable row level security;

-- conversations
drop policy if exists "service role full access conversations" on public.conversations;
create policy "service role full access conversations" on public.conversations
  for all to service_role using (true) with check (true);

drop policy if exists "authenticated read conversations" on public.conversations;
create policy "authenticated read conversations" on public.conversations
  for select to authenticated using (true);

drop policy if exists "authenticated update conversations" on public.conversations;
create policy "authenticated update conversations" on public.conversations
  for update to authenticated using (true) with check (true);

drop policy if exists "authenticated delete conversations" on public.conversations;
create policy "authenticated delete conversations" on public.conversations
  for delete to authenticated using (true);

-- messages
drop policy if exists "service role full access messages" on public.messages;
create policy "service role full access messages" on public.messages
  for all to service_role using (true) with check (true);

drop policy if exists "authenticated read messages" on public.messages;
create policy "authenticated read messages" on public.messages
  for select to authenticated using (true);

-- follow_ups
drop policy if exists "service role full access follow_ups" on public.follow_ups;
create policy "service role full access follow_ups" on public.follow_ups
  for all to service_role using (true) with check (true);

drop policy if exists "authenticated read follow_ups" on public.follow_ups;
create policy "authenticated read follow_ups" on public.follow_ups
  for select to authenticated using (true);

drop policy if exists "authenticated update follow_ups" on public.follow_ups;
create policy "authenticated update follow_ups" on public.follow_ups
  for update to authenticated using (true) with check (true);

drop policy if exists "authenticated delete follow_ups" on public.follow_ups;
create policy "authenticated delete follow_ups" on public.follow_ups
  for delete to authenticated using (true);

-- lead_events
drop policy if exists "service role full access lead_events" on public.lead_events;
create policy "service role full access lead_events" on public.lead_events
  for all to service_role using (true) with check (true);

drop policy if exists "authenticated read lead_events" on public.lead_events;
create policy "authenticated read lead_events" on public.lead_events
  for select to authenticated using (true);

-- app_settings
drop policy if exists "service role full access app_settings" on public.app_settings;
create policy "service role full access app_settings" on public.app_settings
  for all to service_role using (true) with check (true);

drop policy if exists "authenticated read app_settings" on public.app_settings;
create policy "authenticated read app_settings" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "authenticated update app_settings" on public.app_settings;
create policy "authenticated update app_settings" on public.app_settings
  for update to authenticated using (true) with check (true);

drop policy if exists "authenticated insert app_settings" on public.app_settings;
create policy "authenticated insert app_settings" on public.app_settings
  for insert to authenticated with check (true);

-- ============================================================
-- GRANTS
-- ============================================================

grant usage on schema public to authenticated, service_role;

grant select on public.conversations, public.messages, public.follow_ups, public.lead_events to authenticated;
grant update on public.conversations, public.follow_ups to authenticated;
grant delete on public.conversations, public.follow_ups to authenticated;
grant select, insert, update on public.app_settings to authenticated;

grant all on public.conversations, public.messages, public.follow_ups, public.lead_events, public.app_settings to service_role;

-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
    ) then
      alter publication supabase_realtime add table public.conversations;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follow_ups'
    ) then
      alter publication supabase_realtime add table public.follow_ups;
    end if;
  end if;
end
$$;
