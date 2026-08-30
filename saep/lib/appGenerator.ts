export type AppFeature = {
  id: string;
  icon: string;
  label: string;
  color: string;
};

export type GeneratedApp = {
  name: string;
  description: string;
  category: string;
  categoryIcon: string;
  primaryColor: string;
  secondaryColor: string;
  features: AppFeature[];
  screens: AppScreen[];
  stats: { label: string; value: string; trend?: string }[];
};

export type AppScreen = {
  id: string;
  title: string;
  type: "dashboard" | "list" | "form" | "profile" | "map" | "calendar";
  items?: { title: string; subtitle?: string; badge?: string; icon?: string }[];
};

export const TEMPLATES = [
  {
    id: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    prompt: "Eine App für mein Restaurant mit Speisekarte, Tischreservierung und Lieferung",
  },
  {
    id: "fitness",
    label: "Fitness",
    icon: "💪",
    prompt: "Fitness-App mit Trainingsplänen, Fortschritt-Tracking und Community",
  },
  {
    id: "shop",
    label: "Online-Shop",
    icon: "🛍️",
    prompt: "Online-Shop mit Produktkatalog, Warenkorb und Zahlungsabwicklung",
  },
  {
    id: "werkstatt",
    label: "Werkstatt",
    icon: "🔧",
    prompt: "Kfz-Werkstatt App mit Auftragsverwaltung, Terminen und Kundendaten",
  },
  {
    id: "event",
    label: "Events",
    icon: "🎉",
    prompt: "Event-App mit Ticketverkauf, Kalender und Teilnehmerverwaltung",
  },
  {
    id: "health",
    label: "Gesundheit",
    icon: "🏥",
    prompt: "Gesundheits-App mit Terminbuchung, Medikamentenplan und Dokumenten",
  },
  {
    id: "salon",
    label: "Friseur",
    icon: "💇",
    prompt: "Friseur-App mit Terminbuchung, Leistungskatalog, Kundendaten und Salon-Dashboard",
  },
];

const CATEGORY_KEYWORDS: Record<string, { keywords: string[]; icon: string; color: string; secondary: string }> = {
  restaurant: {
    keywords: ["restaurant", "speise", "küche", "tisch", "liefer", "menü", "essen", "gastro"],
    icon: "🍽️",
    color: "#f97316",
    secondary: "#fb923c",
  },
  fitness: {
    keywords: ["fitness", "training", "sport", "gym", "workout", "muskel", "laufen"],
    icon: "💪",
    color: "#ef4444",
    secondary: "#f87171",
  },
  shop: {
    keywords: ["shop", "kauf", "produkt", "waren", "verkauf", "e-commerce", "online"],
    icon: "🛍️",
    color: "#8b5cf6",
    secondary: "#a78bfa",
  },
  werkstatt: {
    keywords: ["werkstatt", "kfz", "auto", "reparatur", "auftrag", "fahrzeug", "mechaniker"],
    icon: "🔧",
    color: "#0ea5e9",
    secondary: "#38bdf8",
  },
  event: {
    keywords: ["event", "ticket", "veranstaltung", "konzert", "party", "festival"],
    icon: "🎉",
    color: "#ec4899",
    secondary: "#f472b6",
  },
  health: {
    keywords: ["gesundheit", "arzt", "medizin", "patient", "kranken"],
    icon: "🏥",
    color: "#10b981",
    secondary: "#34d399",
  },
  salon: {
    keywords: ["friseur", "salon", "haarschnitt", "balayage", "stylist", "barber", "nagel", "beauty", "dienstleister"],
    icon: "💇",
    color: "#db2777",
    secondary: "#f472b6",
  },
  education: {
    keywords: ["schule", "lernen", "kurs", "unterricht", "bildung", "student"],
    icon: "📚",
    color: "#6366f1",
    secondary: "#818cf8",
  },
  travel: {
    keywords: ["reise", "hotel", "buchung", "flug", "urlaub", "tourismus"],
    icon: "✈️",
    color: "#06b6d4",
    secondary: "#22d3ee",
  },
};

const FEATURE_KEYWORDS: Record<string, { keywords: string[]; icon: string; label: string; color: string }> = {
  calendar: { keywords: ["termin", "kalender", "buchung", "reservierung", "schedule"], icon: "📅", label: "Terminbuchung", color: "#3b82f6" },
  payment: { keywords: ["zahlung", "bezahl", "payment", "kasse", "rechnung"], icon: "💳", label: "Zahlungen", color: "#8b5cf6" },
  chat: { keywords: ["chat", "nachricht", "kommunikation", "support", "messenger"], icon: "💬", label: "Chat & Support", color: "#10b981" },
  map: { keywords: ["karte", "standort", "navigation", "liefer", "route"], icon: "🗺️", label: "Standort & Karte", color: "#f59e0b" },
  notification: { keywords: ["benachrichtigung", "push", "alarm", "erinnerung"], icon: "🔔", label: "Benachrichtigungen", color: "#ef4444" },
  analytics: { keywords: ["statistik", "analyse", "dashboard", "bericht", "fortschritt", "tracking"], icon: "📊", label: "Analytics", color: "#6366f1" },
  profile: { keywords: ["profil", "account", "konto", "user", "mitglied"], icon: "👤", label: "Benutzerprofile", color: "#ec4899" },
  inventory: { keywords: ["lager", "bestand", "inventar", "ware", "produkt"], icon: "📦", label: "Bestandsverwaltung", color: "#14b8a6" },
  social: { keywords: ["community", "social", "freunde", "teilen", "netzwerk"], icon: "👥", label: "Community", color: "#f97316" },
  document: { keywords: ["dokument", "datei", "upload", "pdf", "archiv"], icon: "📄", label: "Dokumente", color: "#64748b" },
};

function detectCategory(text: string): { id: string; icon: string; color: string; secondary: string } {
  const lower = text.toLowerCase();
  let bestMatch = { id: "custom", icon: "✨", color: "#14b8a6", secondary: "#2dd4bf" };
  let bestScore = 0;

  for (const [id, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = cat.keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { id, icon: cat.icon, color: cat.color, secondary: cat.secondary };
    }
  }
  return bestMatch;
}

function detectFeatures(text: string): AppFeature[] {
  const lower = text.toLowerCase();
  const features: AppFeature[] = [];

  for (const [id, feat] of Object.entries(FEATURE_KEYWORDS)) {
    if (feat.keywords.some((k) => lower.includes(k))) {
      features.push({ id, icon: feat.icon, label: feat.label, color: feat.color });
    }
  }

  if (features.length < 3) {
    const defaults = [
      { id: "dashboard", icon: "📊", label: "Dashboard", color: "#6366f1" },
      { id: "notification", icon: "🔔", label: "Benachrichtigungen", color: "#ef4444" },
      { id: "profile", icon: "👤", label: "Benutzerprofile", color: "#ec4899" },
    ];
    for (const d of defaults) {
      if (!features.find((f) => f.id === d.id)) {
        features.push(d);
      }
    }
  }

  return features.slice(0, 6);
}

function extractAppName(text: string, category: string): string {
  const patterns = [
    /(?:app für|app name|name:?)\s+["']?([^"'\n,]+)["']?/i,
    /(?:mein|meine)\s+(\w+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }

  const names: Record<string, string> = {
    restaurant: "GastroApp",
    fitness: "FitTrack",
    shop: "ShopFlow",
    werkstatt: "WerkstattPro",
    event: "EventHub",
    health: "HealthCare+",
    salon: "SalonFlow",
    education: "LearnSpace",
    travel: "TravelGo",
    custom: "MeineApp",
  };
  return names[category] || "MeineApp";
}

function generateScreens(category: string, features: AppFeature[]): AppScreen[] {
  const screens: AppScreen[] = [
    {
      id: "dashboard",
      title: "Dashboard",
      type: "dashboard",
    },
  ];

  if (features.some((f) => f.id === "calendar")) {
    screens.push({
      id: "calendar",
      title: "Termine",
      type: "calendar",
      items: [
        { title: "Heute 14:00", subtitle: "Termin bestätigt", badge: "Neu", icon: "📅" },
        { title: "Morgen 10:30", subtitle: "Wartet auf Bestätigung", icon: "📅" },
        { title: "Fr 16:00", subtitle: "Geplant", icon: "📅" },
      ],
    });
  }

  const listItems: Record<string, AppScreen> = {
    restaurant: {
      id: "menu",
      title: "Speisekarte",
      type: "list",
      items: [
        { title: "Pasta Carbonara", subtitle: "€12,90", badge: "Beliebt", icon: "🍝" },
        { title: "Salat Bowl", subtitle: "€9,50", icon: "🥗" },
        { title: "Tiramisu", subtitle: "€6,00", icon: "🍰" },
      ],
    },
    fitness: {
      id: "workouts",
      title: "Workouts",
      type: "list",
      items: [
        { title: "Oberkörper", subtitle: "45 Min • 320 kcal", badge: "Heute", icon: "💪" },
        { title: "Cardio", subtitle: "30 Min • 280 kcal", icon: "🏃" },
        { title: "Yoga Flow", subtitle: "60 Min • 150 kcal", icon: "🧘" },
      ],
    },
    shop: {
      id: "products",
      title: "Produkte",
      type: "list",
      items: [
        { title: "Premium Paket", subtitle: "€49,99", badge: "Neu", icon: "📦" },
        { title: "Starter Set", subtitle: "€19,99", icon: "🎁" },
        { title: "Zubehör Kit", subtitle: "€12,50", icon: "🔧" },
      ],
    },
    werkstatt: {
      id: "orders",
      title: "Aufträge",
      type: "list",
      items: [
        { title: "BMW 320d • HU/AU", subtitle: "Kunde: Schmidt", badge: "Offen", icon: "🚗" },
        { title: "VW Golf • Bremsen", subtitle: "Kunde: Müller", icon: "🚗" },
        { title: "Audi A4 • Inspektion", subtitle: "Kunde: Weber", badge: "Fertig", icon: "🚗" },
      ],
    },
    event: {
      id: "events",
      title: "Events",
      type: "list",
      items: [
        { title: "Summer Festival", subtitle: "15. Juli • 500 Tickets", badge: "Live", icon: "🎉" },
        { title: "Jazz Night", subtitle: "22. Juli • 120 Tickets", icon: "🎵" },
        { title: "Workshop", subtitle: "5. Aug • 30 Plätze", icon: "📋" },
      ],
    },
    health: {
      id: "appointments",
      title: "Termine",
      type: "list",
      items: [
        { title: "Dr. Hausmann", subtitle: "Check-up • 10:00", badge: "Heute", icon: "👨‍⚕️" },
        { title: "Labor", subtitle: "Bluttest • 14:30", icon: "🔬" },
        { title: "Physio", subtitle: "Rücken • Fr 11:00", icon: "💆" },
      ],
    },
    salon: {
      id: "appointments",
      title: "Termine",
      type: "list",
      items: [
        { title: "Lisa Berger · Balayage", subtitle: "Heute 10:00 · Anna", badge: "Bestätigt", icon: "💇" },
        { title: "Tom Weber · Herrenhaarschnitt", subtitle: "Heute 11:30 · Marc", badge: "Neu", icon: "✂️" },
        { title: "Julia Hoffmann · Brautstyling", subtitle: "Sa 09:00 · Anna", badge: "Hochzeit", icon: "👰" },
      ],
    },
  };

  const listScreen = listItems[category] || {
    id: "items",
    title: "Einträge",
    type: "list" as const,
    items: [
      { title: "Eintrag 1", subtitle: "Details anzeigen", badge: "Neu", icon: "📌" },
      { title: "Eintrag 2", subtitle: "In Bearbeitung", icon: "📌" },
      { title: "Eintrag 3", subtitle: "Abgeschlossen", icon: "📌" },
    ],
  };
  screens.push(listScreen);

  screens.push({
    id: "profile",
    title: "Profil",
    type: "profile",
  });

  return screens;
}

function generateStats(category: string): { label: string; value: string; trend?: string }[] {
  const statsMap: Record<string, { label: string; value: string; trend?: string }[]> = {
    restaurant: [
      { label: "Reservierungen", value: "24", trend: "+12%" },
      { label: "Umsatz heute", value: "€1.840", trend: "+8%" },
      { label: "Bewertung", value: "4.8★", trend: "+0.2" },
    ],
    fitness: [
      { label: "Workouts", value: "156", trend: "+23%" },
      { label: "Kalorien", value: "12.4k", trend: "+15%" },
      { label: "Streak", value: "14 Tage", trend: "🔥" },
    ],
    shop: [
      { label: "Bestellungen", value: "89", trend: "+18%" },
      { label: "Umsatz", value: "€4.2k", trend: "+22%" },
      { label: "Kunden", value: "1.2k", trend: "+5%" },
    ],
    werkstatt: [
      { label: "Offene Aufträge", value: "12", trend: "-3" },
      { label: "Heute fertig", value: "5", trend: "+2" },
      { label: "Umsatz", value: "€3.1k", trend: "+11%" },
    ],
    salon: [
      { label: "Termine heute", value: "8", trend: "+2" },
      { label: "Umsatz", value: "€624", trend: "+14%" },
      { label: "Auslastung", value: "86%", trend: "+5%" },
    ],
    default: [
      { label: "Nutzer", value: "248", trend: "+12%" },
      { label: "Aktivität", value: "89%", trend: "+5%" },
      { label: "Zufriedenheit", value: "4.7★", trend: "+0.3" },
    ],
  };
  return statsMap[category] || statsMap.default;
}

export function generateAppFromPrompt(prompt: string): GeneratedApp {
  const category = detectCategory(prompt);
  const features = detectFeatures(prompt);
  const name = extractAppName(prompt, category.id);
  const screens = generateScreens(category.id, features);
  const stats = generateStats(category.id);

  return {
    name,
    description: prompt.length > 120 ? prompt.slice(0, 120) + "…" : prompt,
    category: category.id,
    categoryIcon: category.icon,
    primaryColor: category.color,
    secondaryColor: category.secondary,
    features,
    screens,
    stats,
  };
}

export const BUILD_STEPS = [
  "Analysiere deine Idee…",
  "Erkenne Features & Struktur…",
  "Designe Benutzeroberfläche…",
  "Baue Navigation & Screens…",
  "Optimiere für Mobile…",
  "Säp App ist fertig! ✨",
];
