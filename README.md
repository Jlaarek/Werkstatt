# Werkstatt – Bot-Suite

Drei Bots, **ein Stack** – verbunden wie Säp mit **GitHub**, **Supabase** und **Netlify**.

| Bot | Ordner | Was er macht |
|---|---|---|
| **Säp** | `saep/` | Aus Ideen Apps bauen, speichern, nach GitHub & Netlify exportieren |
| **Checker** | `werkstatt-webapp/` | Workflow-Schritte prüfen und bewerten |
| **Zementa** | `werkstatt-webapp/` | Wöchentlicher Aktivitäts-Bericht (Dashboard + E-Mail) |

## Verbindungen (für alle Bots)

```
┌─────────┐   ┌──────────┐   ┌─────────┐
│ GitHub  │   │ Supabase │   │ Netlify │
└────┬────┘   └────┬─────┘   └────┬────┘
     │             │              │
     └─────────────┼──────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
   Säp         Checker       Zementa
```

1. **Supabase** (EU-Projekt empfohlen)
   - SQL ausführen: `werkstatt-webapp/supabase/schema.sql`
   - Dann: `werkstatt-webapp/supabase/zementa.sql`
   - Dann: `saep/supabase/schema.sql`
   - Dieselbe Project URL + anon Key in beide `.env.local` Dateien

2. **GitHub**
   - Dieses Repo hostet Code und den Zementa-Cron (`.github/workflows/`)
   - Säp exportiert generierte Apps als neue Repos (GitHub-Login in Säp)

3. **Netlify**
   - Werkstatt: Base directory `werkstatt-webapp`
   - Säp: Base directory `saep`
   - Env-Vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Schnellstart

**Werkstatt (Checker + Zementa + Bot-Hub):**

```bash
cd werkstatt-webapp
cp .env.local.example .env.local
npm install && npm run dev
```

In der App links **Bots** öffnen → Verbindungen und alle Bots auf einen Blick.

**Säp:**

```bash
cd saep
cp .env.local.example .env.local
npm install && npm run dev
```

Details: `werkstatt-webapp/README.md` und `saep/README.md`.
