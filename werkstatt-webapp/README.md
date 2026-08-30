# Kfz-Werkstatt Dashboard - Phase 2 (echte Web-App)

Diese App ist die produktive Fortsetzung des Claude-Prototyps: gleiche Oberfläche
und Bedienung, aber mit echter Datenbank (Supabase/Postgres) statt nur
Arbeitsspeicher, und mit Login-Schutz für deine Mitarbeiter.

## 1. Supabase-Projekt anlegen (Datenbank + Login) - kostenlos

1. Auf https://supabase.com kostenlos registrieren, "New Project" anlegen.
2. **Wichtig:** Region **EU** wählen (z. B. Frankfurt/eu-central-1) - relevant für DSGVO.
3. Im neuen Projekt: **SQL Editor** öffnen -> Inhalt von `supabase/schema.sql`
   einfügen -> **Run**. Das legt die Tabelle `cases` inkl. Zugriffsschutz
   (Row Level Security) an.
4. **Authentication -> Users -> Add user**: für jede/n Mitarbeiter:in ein
   Konto mit E-Mail + Passwort anlegen (keine Selbstregistrierung nötig).
5. **Project Settings -> API**: `Project URL` und `anon public` Key kopieren.

## 2. App lokal einrichten

```bash
cd werkstatt-webapp
cp .env.local.example .env.local
# .env.local öffnen und die beiden Werte aus Schritt 1.5 eintragen
npm install
npm run dev
```

Dann `http://localhost:3000` öffnen und dich mit einem der Schritt-1.4-Konten anmelden.

## 3. Kostenlos online stellen

Empfehlung für den Start (beides kostenlos in der jeweiligen Free-Tier-Stufe):

**Option A - Vercel (einfachste Next.js-Anbindung)**
1. Projekt auf GitHub hochladen (privates Repo reicht).
2. Auf https://vercel.com mit GitHub anmelden -> "Add New Project" -> Repo auswählen.
3. Unter "Environment Variables" `NEXT_PUBLIC_SUPABASE_URL` und
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` eintragen (gleiche Werte wie in `.env.local`).
4. Deploy klicken - nach ca. 1 Minute ist die App unter einer `*.vercel.app`-Adresse live.

**Option B - Netlify** funktioniert nach dem gleichen Prinzip (Next.js wird automatisch erkannt).

Eine eigene Domain (z. B. `meine-werkstatt.de`) kann bei beiden Anbietern kostenlos
verbunden werden - die Domain selbst kostet ca. 10-15 €/Jahr bei einem Registrar.

## 4. Laufende Kosten

| Baustein | Kostenlos bis... | danach |
|---|---|---|
| Vercel/Netlify Hosting | großzügiges Free-Tier, reicht für eine Werkstatt lange | ab ca. 19 $/Monat |
| Supabase (Datenbank+Login) | 500 MB Datenbank, 50.000 Auth-Nutzer | ab ca. 25 $/Monat |
| Domain (optional) | - | 10-15 €/Jahr |

Für eine einzelne Werkstatt bleibt das in der Praxis meist dauerhaft im kostenlosen Bereich.

## 5. Datenschutz-Hinweise (bitte vor echtem Einsatz prüfen)

- Es werden jetzt **echte** Kundendaten gespeichert - der "Prototyp"-Hinweis
  aus der Claude-Demo wurde deshalb entfernt und durch eine reine
  Zugriffsschutz-Anzeige ersetzt.
- Zugriff ist nur nach Login möglich (Row Level Security in `schema.sql`
  erlaubt Lesen/Schreiben ausschließlich für angemeldete Nutzer:innen).
- Prüfe den Auftragsverarbeitungsvertrag (AVV/DPA) von Supabase und deinem
  Hosting-Anbieter, bevor personenbezogene Daten gespeichert werden.
- Lege ein Löschkonzept fest (z. B. Vorgänge nach Abschluss + gesetzlicher
  Aufbewahrungsfrist automatisiert löschen) - das ist in diesem MVP noch
  nicht automatisiert.
- VIN/Kennzeichen/Telefonnummer nur so lange speichern, wie nötig.

## 6. Zementa – Wöchentlicher Aktivitäts-Bot

**Zementa** ist dein wöchentlicher Überblick über alle Werkstatt-Aktivitäten: neue Vorgänge,
abgeschlossene Fälle, Termine, Angebote und die komplette Historie – als Dashboard in der App
und optional per E-Mail.

### Einrichtung (einmalig)

1. Im Supabase **SQL Editor** zusätzlich `supabase/zementa.sql` ausführen (nach `schema.sql`).
2. In der App links **Zementa** öffnen → E-Mail-Adresse und Wochentag eintragen → speichern.
3. Optional – automatischer E-Mail-Versand:
   - Edge Function deployen: `supabase functions deploy zementa-weekly`
   - Secrets setzen: `RESEND_API_KEY`, `ZEMENTA_CRON_SECRET`, `ZEMENTA_FROM_EMAIL`
   - GitHub Repository Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ZEMENTA_CRON_SECRET`
   - Der GitHub Actions Workflow (`.github/workflows/zementa-weekly.yml`) ruft jeden Montag die Function auf.

Ohne E-Mail-Setup funktioniert das **Dashboard sofort** – du siehst alle Wochen-Aktivitäten live in der App.

## 7. Nächste Ausbaustufen (siehe auch Roadmap aus dem Chat)

Im Code stehen `TODO`-Kommentare an den Stellen, wo später Telefonie,
Kalender-Sync, Teilekatalog-API und die Claude API angebunden werden können
(siehe unten in `app/page.js`).
