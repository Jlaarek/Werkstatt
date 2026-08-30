-- Säp App Builder — Supabase Schema
-- Im Supabase SQL Editor ausführen (Region: EU empfohlen)

-- Apps-Tabelle: gespeicherte App-Projekte
CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  app_data JSONB NOT NULL DEFAULT '{}',
  github_repo TEXT,
  netlify_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index für schnelle User-Abfragen
CREATE INDEX IF NOT EXISTS apps_user_id_idx ON apps(user_id);
CREATE INDEX IF NOT EXISTS apps_created_at_idx ON apps(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apps_updated_at ON apps;
CREATE TRIGGER apps_updated_at
  BEFORE UPDATE ON apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;

-- Nutzer sehen nur eigene Apps
CREATE POLICY "Users can view own apps"
  ON apps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own apps"
  ON apps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own apps"
  ON apps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own apps"
  ON apps FOR DELETE
  USING (auth.uid() = user_id);
