# Werkstatt – Bot-Suite (Säp × Hans × Checker × Zementa)

Vier Partner, **ein Stack**: **GitHub · Supabase · Netlify**

| Partner | Ordner | Rolle |
|---|---|---|
| **Säp** | `saep/` | App-Builder – Ideen → App → GitHub → Netlify |
| **Hans** | `salon-app/` | Friseur-/Dienstleister-Probe-App (Salon Hans) |
| **Checker** | `werkstatt-webapp/` | Workflow-Schritte prüfen & bewerten |
| **Zementa** | `werkstatt-webapp/` | Wöchentlicher Aktivitäts-Bericht |

## Zusammenarbeit

1. **Säp + Hans** bauen und betreiben Probe-Apps (z. B. Salon Hans mit Terminen & Leistungen).
2. **Checker** bewertet Vorgangs-Qualität (Score 0–100).
3. **Zementa** fasst die Woche zusammen inkl. Checker-Scores.

Im Werkstatt-Dashboard: Tab **Bots** → Hub mit Verbindungsstatus und allen Partnern.

## Schnellstart

```bash
# Werkstatt (Checker + Zementa + Bot-Hub)
cd werkstatt-webapp && npm install && npm run dev

# Säp
cd saep && npm install && npm run dev

# Salon Hans
cd salon-app && npm install && npm run dev   # Port 3001
```

Gleiche Env-Vars in allen drei Apps:

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
```

SQL (ein Supabase-Projekt):

1. `werkstatt-webapp/supabase/schema.sql`
2. `werkstatt-webapp/supabase/zementa.sql`
3. `saep/supabase/schema.sql`
4. `salon-app/supabase/schema.sql`

## Netlify

| App | Base directory |
|---|---|
| Werkstatt | `werkstatt-webapp` |
| Säp | `saep` |
| Salon Hans | `salon-app` |
