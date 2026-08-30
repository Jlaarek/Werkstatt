/** Bot-Suite – Registry und Verbindungsstatus (GitHub, Supabase, Netlify) */

export const BOTS = [
  {
    id: "saep",
    name: "Säp",
    tagline: "Aus allem eine App",
    description:
      "Beschreibe eine Idee – Säp baut die App, speichert sie in Supabase und exportiert sie auf GitHub für Netlify. Arbeitet mit Hans an Probe-Apps (z. B. Salon Hans).",
    role: "App-Builder",
    accent: "violet",
    path: "saep",
    viewKey: null,
    connections: ["supabase", "github", "netlify"],
  },
  {
    id: "hans",
    name: "Hans",
    tagline: "Salon & Dienstleister",
    description:
      "Partner von Säp: Friseur-/Dienstleister-Probe-App Salon Hans – Termine, Leistungen, Dashboard. Gemeinsam mit Checker und Zementa im gleichen Stack.",
    role: "Probe-App",
    accent: "rose",
    path: "salon-app",
    viewKey: null,
    connections: ["supabase", "github", "netlify"],
  },
  {
    id: "zementa",
    name: "Zementa",
    tagline: "Wöchentlicher Aktivitäts-Bot",
    description:
      "Fasst alle Werkstatt-Aktivitäten der Woche zusammen – als Dashboard und per E-Mail.",
    role: "Wochenbericht",
    accent: "orange",
    path: "werkstatt-webapp",
    viewKey: "zementa",
    connections: ["supabase", "github", "netlify"],
  },
  {
    id: "checker",
    name: "Checker",
    tagline: "Schritt-Prüfer",
    description:
      "Prüft und bewertet alle Workflow-Schritte deiner Vorgänge. Ergebnisse fließen in Zementa ein. Arbeitet mit Säp & Hans an Qualitätschecks.",
    role: "Qualität",
    accent: "emerald",
    path: "werkstatt-webapp",
    viewKey: "checker",
    connections: ["supabase", "github", "netlify"],
  },
];

export const SERVICES = [
  {
    id: "supabase",
    name: "Supabase",
    description: "Datenbank, Login und Speicherung",
    docsUrl: "https://supabase.com/dashboard",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Code, Export und Cron-Workflows",
    docsUrl: "https://github.com",
  },
  {
    id: "netlify",
    name: "Netlify",
    description: "Hosting und Deploy",
    docsUrl: "https://app.netlify.com",
  },
];

/** Prüft, ob Supabase-Env-Vars gesetzt sind (wie bei Säp). */
export function getSupabaseConnectionStatus() {
  const url = typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : undefined;
  const key = typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : undefined;

  const configured =
    Boolean(url && key) &&
    !String(url).includes("dein-projekt") &&
    !String(key).includes("dein-anon");

  return {
    id: "supabase",
    connected: configured,
    detail: configured ? "Verbunden" : "Env-Vars fehlen (.env.local)",
  };
}

/**
 * Client-seitiger Verbindungsstatus.
 * GitHub/Netlify gelten als „bereit“, sobald Repo + Deploy-Config existieren;
 * Live-OAuth steckt in Säp.
 */
export function getClientConnectionStatuses({ supabaseConfigured }) {
  return [
    {
      id: "supabase",
      name: "Supabase",
      connected: Boolean(supabaseConfigured),
      detail: supabaseConfigured
        ? "Auth + Datenbank aktiv"
        : "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY setzen",
      action: "Supabase Dashboard öffnen",
      href: "https://supabase.com/dashboard",
    },
    {
      id: "github",
      name: "GitHub",
      connected: true,
      detail: "Repo Werkstatt · Actions für Zementa-Cron · Säp-Export",
      action: "Repository öffnen",
      href: "https://github.com/Jlaarek/Werkstatt",
    },
    {
      id: "netlify",
      name: "Netlify",
      connected: true,
      detail: "netlify.toml in saep/ und werkstatt-webapp/ bereit",
      action: "Netlify öffnen",
      href: "https://app.netlify.com",
    },
  ];
}

export function getBotById(id) {
  return BOTS.find(b => b.id === id) || null;
}
