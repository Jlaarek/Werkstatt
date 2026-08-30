-- SalonFlow Probe-App — Friseur / Dienstleister
-- Angelehnt an Geniva/Werkstatt-Struktur (services, cases, leads)
-- Im Supabase SQL Editor ausführen

-- ─── Säp App-Projekte ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  app_data JSONB NOT NULL DEFAULT '{}',
  github_repo TEXT,
  netlify_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apps_user_id_idx ON apps(user_id);

ALTER TABLE apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own apps" ON apps;
DROP POLICY IF EXISTS "Users can insert own apps" ON apps;
DROP POLICY IF EXISTS "Users can update own apps" ON apps;
DROP POLICY IF EXISTS "Users can delete own apps" ON apps;
DROP POLICY IF EXISTS "Public can view demo apps" ON apps;

CREATE POLICY "Users can view own apps" ON apps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own apps" ON apps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own apps" ON apps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own apps" ON apps FOR DELETE USING (auth.uid() = user_id);
-- Demo-Apps ohne User lesbar
CREATE POLICY "Public can view demo apps" ON apps FOR SELECT USING (user_id IS NULL);

-- ─── Salon Services (analog zu services) ────────────────────────
CREATE TABLE IF NOT EXISTS salon_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Schnitt',
  duration_min INT NOT NULL DEFAULT 30,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE salon_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read salon services" ON salon_services;
CREATE POLICY "Anyone can read salon services" ON salon_services FOR SELECT USING (true);

-- ─── Salon Appointments (analog zu cases) ───────────────────────
CREATE TABLE IF NOT EXISTS salon_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Neu',
  urgency TEXT NOT NULL DEFAULT 'normal',
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  service_name TEXT NOT NULL,
  stylist TEXT,
  desired_date DATE,
  desired_time TEXT,
  notes TEXT,
  price NUMERIC(10,2)
);

ALTER TABLE salon_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read salon appointments" ON salon_appointments;
DROP POLICY IF EXISTS "Anyone can insert salon appointments" ON salon_appointments;
CREATE POLICY "Anyone can read salon appointments" ON salon_appointments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert salon appointments" ON salon_appointments FOR INSERT WITH CHECK (true);

-- ─── Seed: Friseur-Leistungen ───────────────────────────────────
TRUNCATE salon_services CASCADE;
INSERT INTO salon_services (name, category, duration_min, price, description, sort_order) VALUES
  ('Damenhaarschnitt', 'Schnitt', 45, 42.00, 'Waschen, Schneiden, Föhnen', 10),
  ('Herrenhaarschnitt', 'Schnitt', 30, 28.00, 'Klassisch oder modern', 20),
  ('Kinderschnitt', 'Schnitt', 25, 22.00, 'Bis 12 Jahre', 30),
  ('Pony schneiden', 'Schnitt', 15, 12.00, 'Auffrischung', 40),
  ('Balayage', 'Farbe', 120, 145.00, 'Natürliche Strähnen-Technik', 50),
  ('Vollblondierung', 'Farbe', 150, 165.00, 'Inkl. Tonung und Pflege', 60),
  ('Ansatz färben', 'Farbe', 60, 55.00, 'Farbe nach Wahl', 70),
  ('Glossing', 'Farbe', 45, 48.00, 'Glanz und leichte Auffrischung', 80),
  ('Olaplex-Kur', 'Pflege', 40, 35.00, 'Intensive Haar-Reparatur', 90),
  ('Hochsteckfrisur', 'Styling', 60, 65.00, 'Für Hochzeit & Events', 100),
  ('Brautstyling komplett', 'Styling', 90, 120.00, 'Probe + Hochzeitstag', 110),
  ('Bart trimmen', 'Bart', 20, 18.00, 'Form und Pflege', 120);

-- ─── Seed: Probe-Termine ────────────────────────────────────────
TRUNCATE salon_appointments CASCADE;
INSERT INTO salon_appointments (status, urgency, customer_name, customer_phone, service_name, stylist, desired_date, desired_time, notes, price) VALUES
  ('Bestätigt', 'normal', 'Lisa Berger', '+49 170 1112233', 'Balayage', 'Anna', CURRENT_DATE, '10:00', 'Erstbesuch, lange Haare', 145.00),
  ('Neu', 'hoch', 'Tom Weber', '+49 171 4455667', 'Herrenhaarschnitt', 'Marc', CURRENT_DATE, '11:30', 'Möchte etwas kürzer', 28.00),
  ('Bestätigt', 'normal', 'Sarah Klein', NULL, 'Damenhaarschnitt', 'Anna', CURRENT_DATE + 1, '14:00', NULL, 42.00),
  ('In Arbeit', 'normal', 'Julia Hoffmann', '+49 152 9988776', 'Brautstyling komplett', 'Anna', CURRENT_DATE + 3, '09:00', 'Hochzeit am Samstag', 120.00),
  ('Neu', 'normal', 'Max Richter', NULL, 'Bart trimmen', 'Marc', CURRENT_DATE + 1, '16:30', NULL, 18.00),
  ('Abgeschlossen', 'normal', 'Emma Schulz', '+49 160 3344556', 'Olaplex-Kur', 'Anna', CURRENT_DATE - 1, '15:00', 'Sehr zufrieden', 35.00);

-- ─── Demo-Eintrag für Säp ───────────────────────────────────────
INSERT INTO apps (user_id, name, prompt, category, app_data) VALUES (
  NULL,
  'Salon Hans',
  'Friseur-App mit Terminbuchung, Leistungskatalog, Kundendaten und Dashboard für den Salon — Säp × Hans',
  'salon',
  '{
    "name": "Salon Hans",
    "description": "Friseur-App mit Terminbuchung, Leistungskatalog und Kundendaten — Säp × Hans",
    "category": "salon",
    "categoryIcon": "💇",
    "primaryColor": "#db2777",
    "secondaryColor": "#f472b6",
    "features": [
      {"id": "calendar", "icon": "📅", "label": "Terminbuchung", "color": "#3b82f6"},
      {"id": "inventory", "icon": "✂️", "label": "Leistungskatalog", "color": "#14b8a6"},
      {"id": "profile", "icon": "👤", "label": "Kundendaten", "color": "#ec4899"},
      {"id": "analytics", "icon": "📊", "label": "Salon-Dashboard", "color": "#6366f1"},
      {"id": "notification", "icon": "🔔", "label": "Erinnerungen", "color": "#ef4444"}
    ],
    "screens": [
      {"id": "dashboard", "title": "Dashboard", "type": "dashboard"},
      {"id": "appointments", "title": "Termine", "type": "list", "items": [
        {"title": "Lisa Berger · Balayage", "subtitle": "Heute 10:00 · Anna", "badge": "Bestätigt", "icon": "💇"},
        {"title": "Tom Weber · Herrenhaarschnitt", "subtitle": "Heute 11:30 · Marc", "badge": "Neu", "icon": "✂️"},
        {"title": "Julia Hoffmann · Brautstyling", "subtitle": "Sa 09:00 · Anna", "badge": "Hochzeit", "icon": "👰"}
      ]},
      {"id": "services", "title": "Leistungen", "type": "list", "items": [
        {"title": "Damenhaarschnitt", "subtitle": "45 Min · €42", "icon": "💇"},
        {"title": "Balayage", "subtitle": "120 Min · €145", "badge": "Beliebt", "icon": "✨"},
        {"title": "Herrenhaarschnitt", "subtitle": "30 Min · €28", "icon": "✂️"}
      ]},
      {"id": "profile", "title": "Team", "type": "profile"}
    ],
    "stats": [
      {"label": "Termine heute", "value": "8", "trend": "+2"},
      {"label": "Umsatz", "value": "€624", "trend": "+14%"},
      {"label": "Auslastung", "value": "86%", "trend": "+5%"}
    ]
  }'::jsonb
)
ON CONFLICT DO NOTHING;
