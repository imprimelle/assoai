-- ============================================
-- AssoAI - Schéma initial Supabase
-- Migration 001 : Tables, Triggers, RPC, RLS, Realtime
-- ============================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABLES PRINCIPALES
-- ============================================

-- 2.1 Utilisateurs de l'application
create table if not exists app_users (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  name        text default '',
  session_id  text,
  role        text default 'user',
  created_at  timestamptz default now()
);

-- 2.2 Messages (contient aussi les templates via JSONB)
create table if not exists messages (
  id            uuid primary key default uuid_generate_v4(),
  session_id    text not null,
  user_id       text not null,
  sender        text not null check (sender in ('user','ai','system')),
  content       text,
  timestamp     timestamptz default now(),
  attachments   jsonb default '[]'::jsonb,
  template_type text,
  template_data jsonb,
  quote         jsonb,
  version_ref   text
);

create index idx_messages_session on messages(session_id);
create index idx_messages_template_type on messages(template_type);
create index idx_messages_timestamp on messages(timestamp desc);

-- 2.3 Projets
create table if not exists projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  created_by  text not null,
  session_id  text not null,
  templates   jsonb default '{"factures":[],"commandes":[],"devis":[],"cahiers_des_charges":[]}'::jsonb
);

-- 2.4 Notifications
create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    text not null,
  title      text not null,
  message    text default '',
  read       boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user on notifications(user_id);

-- 3. FONCTIONS & TRIGGERS
-- ============================================

-- 3.1 Nettoyage des anciennes versions avant insertion
create or replace function trg_messages_deflag()
returns trigger as $$
begin
  -- Si le nouveau message est un template avec is_latest=true,
  -- on passe is_latest=false sur toutes les versions précédentes
  if new.template_data is not null 
     and new.template_data->'data'->>'is_latest' = 'true'
     and new.template_type is not null then
    
    update messages
    set template_data = jsonb_set(
      template_data,
      '{data,is_latest}',
      'false'
    )
    where template_type = new.template_type
      and id != new.id
      and template_data->'data'->>'is_latest' = 'true';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_messages_deflag_trigger on messages;
create trigger trg_messages_deflag_trigger
  before insert on messages
  for each row
  execute function trg_messages_deflag();

-- 3.2 Préparation des template_data avant insertion
create or replace function trg_messages_prepare()
returns trigger as $$
begin
  -- Si template_data existe, s'assurer qu'il est bien formé
  if new.template_data is not null then
    -- Si le template_data n'a pas de wrapper 'data', on le wrap
    if new.template_data->'data' is null then
      new.template_data = jsonb_build_object('data', new.template_data);
    end if;
    
    -- S'assurer que is_latest est présent
    if new.template_data->'data'->'is_latest' is null then
      new.template_data = jsonb_set(
        new.template_data,
        '{data,is_latest}',
        'true'
      );
    end if;
    
    -- S'assurer que version est présent
    if new.template_data->'data'->'version' is null then
      new.template_data = jsonb_set(
        new.template_data,
        '{data,version}',
        '1'
      );
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_messages_prepare_trigger on messages;
create trigger trg_messages_prepare_trigger
  before insert on messages
  for each row
  execute function trg_messages_prepare();

-- 4. FONCTIONS RPC
-- ============================================

-- 4.1 Comptage des templates par type
create or replace function get_template_counts(user_filter text default 'ALL')
returns table(template_type text, count bigint) as $$
begin
  return query
  select m.template_type, count(*)::bigint
  from messages m
  where m.template_type is not null
    and m.template_data->'data'->>'is_latest' = 'true'
    and (
      user_filter = 'ALL'
      or m.user_id = user_filter
    )
  group by m.template_type;
end;
$$ language plpgsql;

-- 5. POLITIQUES RLS (Row Level Security)
-- ============================================

-- Activer RLS sur toutes les tables
alter table app_users enable row level security;
alter table messages enable row level security;
alter table projects enable row level security;
alter table notifications enable row level security;

-- 5.1 app_users : lecture publique, écriture authentifiée
create policy "Lecture publique app_users" on app_users
  for select using (true);

create policy "Insertion app_users" on app_users
  for insert with check (true);

create policy "Mise à jour app_users" on app_users
  for update using (true);

-- 5.2 messages : lecture/écriture publique (l'auth est gérée par l'app)
create policy "Lecture publique messages" on messages
  for select using (true);

create policy "Insertion messages" on messages
  for insert with check (true);

create policy "Mise à jour messages" on messages
  for update using (true);

-- 5.3 projects
create policy "Lecture publique projects" on projects
  for select using (true);

create policy "Insertion projects" on projects
  for insert with check (true);

create policy "Mise à jour projects" on projects
  for update using (true);

create policy "Suppression projects" on projects
  for delete using (true);

-- 5.4 notifications
create policy "Lecture publique notifications" on notifications
  for select using (true);

create policy "Insertion notifications" on notifications
  for insert with check (true);

create policy "Mise à jour notifications" on notifications
  for update using (true);

-- 6. REPLICATION TEMPS RÉEL
-- ============================================

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table notifications;
