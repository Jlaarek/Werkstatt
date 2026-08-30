-- ============================================================
-- Zementa – Wöchentlicher Aktivitäts-Bot
-- Nach schema.sql ausführen (SQL Editor → Run)
-- ============================================================

-- Einstellungen (eine Zeile pro Werkstatt-Installation)
create table if not exists zementa_settings (
  id uuid primary key default gen_random_uuid(),
  notification_email text not null default '',
  sender_email text not null default '',
  sender_name text not null default 'Zementa',
  recipient_name text not null default 'Johann',
  notify_day smallint not null default 1 check (notify_day between 0 and 6),
  notify_hour smallint not null default 8 check (notify_hour between 0 and 23),
  enabled boolean not null default true,
  workshop_name text not null default 'Kfz-Werkstatt',
  updated_at timestamptz not null default now()
);

-- Gespeicherte Wochenberichte
create table if not exists zementa_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  summary jsonb not null,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_zementa_reports_week on zementa_reports (week_start desc);

alter table zementa_settings enable row level security;
alter table zementa_reports enable row level security;

drop policy if exists "Mitarbeiter lesen Zementa-Einstellungen" on zementa_settings;
create policy "Mitarbeiter lesen Zementa-Einstellungen"
  on zementa_settings for select using (auth.role() = 'authenticated');

drop policy if exists "Mitarbeiter pflegen Zementa-Einstellungen" on zementa_settings;
create policy "Mitarbeiter pflegen Zementa-Einstellungen"
  on zementa_settings for all using (auth.role() = 'authenticated');

drop policy if exists "Mitarbeiter lesen Zementa-Berichte" on zementa_reports;
create policy "Mitarbeiter lesen Zementa-Berichte"
  on zementa_reports for select using (auth.role() = 'authenticated');

drop policy if exists "Mitarbeiter schreiben Zementa-Berichte" on zementa_reports;
create policy "Mitarbeiter schreiben Zementa-Berichte"
  on zementa_reports for insert with check (auth.role() = 'authenticated');

drop policy if exists "Mitarbeiter aktualisieren Zementa-Berichte" on zementa_reports;
create policy "Mitarbeiter aktualisieren Zementa-Berichte"
  on zementa_reports for update using (auth.role() = 'authenticated');

-- Standard-Einstellungen (Montag 08:00, Benachrichtigung an deine E-Mail)
insert into zementa_settings (notification_email, sender_email, sender_name, recipient_name, notify_day, notify_hour, enabled)
select 'lazarek.johann@gmail.com', 'lazarek.johann@gmail.com', 'Zementa', 'Johann', 1, 8, true
where not exists (select 1 from zementa_settings limit 1);

-- Falls Tabelle schon existierte: fehlende Spalten nachziehen
alter table zementa_settings add column if not exists sender_email text not null default '';
alter table zementa_settings add column if not exists sender_name text not null default 'Zementa';
alter table zementa_settings add column if not exists recipient_name text not null default 'Johann';
