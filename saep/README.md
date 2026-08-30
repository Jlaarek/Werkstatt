# Säp — Aus allem eine App

**Säp** verbindet GitHub, Supabase und Netlify: Beschreibe deine Idee, Säp baut die App, speichert sie in Supabase und exportiert sie direkt auf GitHub — bereit für Netlify.

Teil der **Bot-Suite** zusammen mit **Checker** und **Zementa** (siehe Root-`README.md`). Alle drei nutzen dieselben Konten.

## Schnellstart (mit deinen bestehenden Konten)

### 1. Supabase verbinden

1. In deinem [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**
2. Inhalt von `supabase/schema.sql` einfügen → **Run**
3. **Authentication → Providers → GitHub** aktivieren:
   - GitHub OAuth App anlegen unter [github.com/settings/developers](https://github.com/settings/developers)
   - Callback URL: `https://DEIN-PROJEKT.supabase.co/auth/v1/callback`
   - Client ID + Secret in Supabase eintragen
4. **Project Settings → API**: URL und `anon` Key kopieren

### 2. Lokal einrichten

```bash
cd saep
cp .env.local.example .env.local
# Deine Supabase-Werte eintragen
npm install
npm run dev
```

### 3. GitHub verbinden

- In Säp auf **„Mit GitHub anmelden"** klicken
- Nach dem Login werden Apps automatisch in Supabase gespeichert
- **„→ GitHub & Netlify"** erstellt ein Repository mit App-Code

### 4. Netlify deployen

**Option A — Direkt aus Säp:**
Nach dem GitHub-Export erscheint ein Link „Auf Netlify deployen".

**Option B — Manuell:**
1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Dein GitHub-Repo auswählen
3. Build settings (automatisch via `netlify.toml`):
   - Base directory: `saep` (wenn Repo-Root) oder `.` (wenn nur saep-Ordner)
   - Build command: `npm run build`
4. Environment Variables setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy!

**Option C — Säp selbst auf Netlify:**
1. Dieses Repo auf GitHub pushen
2. Netlify → Import → Repo `Werkstatt` wählen
3. Base directory: `saep`
4. Env-Vars setzen → Deploy

## Architektur

```
Säp App
  ├── GitHub OAuth (Login + Repo-Export)
  ├── Supabase (Auth + App-Speicherung)
  └── Netlify (Hosting + Deploy)
```

## Features

- Natürliche Sprache → App-Vorschau
- 6 Vorlagen (Restaurant, Fitness, Shop, Werkstatt, Events, Gesundheit)
- Automatisches Speichern in Supabase (wenn angemeldet)
- GitHub-Export mit README, package.json, Next.js-Code
- Netlify-Deploy-Link nach Export
- Interaktive Phone-Preview

## Umgebungsvariablen

| Variable | Woher |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |

## Tech Stack

- Next.js 14, TypeScript, Tailwind CSS
- Supabase (Auth + Postgres)
- GitHub API (Repo-Export)
- Netlify (Hosting)
