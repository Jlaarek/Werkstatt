# SalonFlow — Friseur Probe-App von Säp

Gebaut nach dem gleichen Datenmuster wie **Geniva/Werkstatt**:
Services → Termine/Cases → Dashboard — hier für Friseure und Dienstleister.

## Features

- Dashboard (heute, Umsatz, Auslastung)
- Terminliste mit Status (Neu, Bestätigt, In Arbeit, …)
- Leistungskatalog (Schnitt, Farbe, Pflege, Styling, Bart)
- Online-Buchungsanfrage → landet in `salon_appointments`

## Setup

1. In Supabase SQL Editor: `supabase/schema.sql` ausführen
2. Env setzen:

```bash
cp ../saep/.env.local .env.local
# oder manuell:
# NEXT_PUBLIC_SUPABASE_URL=https://….supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=…
```

3. Starten:

```bash
npm install
npm run dev
```

Öffne http://localhost:3001

Ohne Supabase-Schema läuft die App mit eingebauten Demo-Daten (Fallback).

## Netlify

- Base directory: `salon-app`
- Env-Vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
