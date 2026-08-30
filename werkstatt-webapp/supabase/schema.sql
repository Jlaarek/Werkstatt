-- ============================================================
-- Kfz-Werkstatt Dashboard - Supabase-Schema (Phase 2)
-- ------------------------------------------------------------
-- Ausführen in: Supabase-Projekt -> SQL Editor -> "New query" -> einfügen -> Run
--
-- WICHTIG (Datenschutz):
--  - Beim Anlegen des Supabase-Projekts eine EU-Region wählen
--    (z. B. "eu-central-1"), damit personenbezogene Daten in der EU
--    verarbeitet werden.
--  - Row Level Security (RLS) ist unten aktiviert: Nur eingeloggte
--    Nutzer (deine Werkstatt-Mitarbeiter) dürfen Daten lesen/schreiben.
--  - Prüfe zusätzlich den Auftragsverarbeitungsvertrag (AVV/DPA) von
--    Supabase, bevor echte Kundendaten gespeichert werden.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'Neu',
  urgency text not null default 'mittel',
  customer jsonb not null default '{"name":"","phone":"","email":""}',
  vehicle jsonb not null default '{"make":"","model":"","year":"","plate":"","vin":"","mileage":""}',
  concern text default '',
  desired_date date,
  appointment jsonb,                -- { date, time, status } oder null
  labor_rate_per_hour numeric not null default 110,
  discount_percent numeric not null default 0,
  parts jsonb not null default '[]',
  notes jsonb not null default '[]',
  history jsonb not null default '[]',
  callback_requested boolean not null default false,
  callback_reason text default ''
);

-- updated_at automatisch pflegen
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cases_updated_at on cases;
create trigger trg_cases_updated_at
  before update on cases
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security: nur eingeloggte Mitarbeiter (jede
-- authentifizierte Supabase-Nutzer:in) dürfen lesen/schreiben.
-- Für ein Team mit mehreren Rollen kann das später verfeinert werden.
-- ------------------------------------------------------------
alter table cases enable row level security;

drop policy if exists "Mitarbeiter duerfen alles lesen" on cases;
create policy "Mitarbeiter duerfen alles lesen"
  on cases for select
  using (auth.role() = 'authenticated');

drop policy if exists "Mitarbeiter duerfen anlegen" on cases;
create policy "Mitarbeiter duerfen anlegen"
  on cases for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Mitarbeiter duerfen aendern" on cases;
create policy "Mitarbeiter duerfen aendern"
  on cases for update
  using (auth.role() = 'authenticated');

drop policy if exists "Mitarbeiter duerfen loeschen" on cases;
create policy "Mitarbeiter duerfen loeschen"
  on cases for delete
  using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Optional: ein Beispiel-Vorgang zum Testen nach dem ersten Deploy.
-- Kann gefahrlos gelöscht werden (Beispieldaten, keine echte Person).
-- ------------------------------------------------------------
insert into cases (status, urgency, customer, vehicle, concern, desired_date, labor_rate_per_hour, discount_percent)
values (
  'Neu', 'mittel',
  '{"name":"Test Kunde","phone":"0170 0000000","email":""}',
  '{"make":"VW","model":"Golf","year":"2018","plate":"","vin":"","mileage":""}',
  'Beispiel-Vorgang zum Testen nach dem Deployment - kann gelöscht werden.',
  current_date + 1,
  110, 0
);

-- ============================================================
-- TODO Phase 3/4 (spätere Erweiterungen, hier nur als Hinweis):
--  - Eigene Tabellen für Teilekatalog-Cache / Lieferantenpreise,
--    sobald eine Teilekatalog-API angebunden wird.
--  - Tabelle "staff" mit Rollen (Annahme, Werkstattleitung), falls
--    unterschiedliche Rechte pro Mitarbeiter:in nötig werden.
--  - Tabelle "call_events" für eine spätere Telefonie-Integration
--    (Anrufer-ID, Zeitstempel, Zuordnung zu "cases").
-- ============================================================
