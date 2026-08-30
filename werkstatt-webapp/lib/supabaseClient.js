import { createClient } from "@supabase/supabase-js";

// Diese zwei Werte kommen aus deinem Supabase-Projekt (Settings -> API)
// und werden als Umgebungsvariablen gesetzt (siehe .env.local.example / README.md).
// Der "anon" Key ist bewusst öffentlich nutzbar - der eigentliche Schutz
// der Daten passiert über Row Level Security (siehe supabase/schema.sql)
// und die Login-Pflicht (siehe app/login/page.js).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn("Supabase-Umgebungsvariablen fehlen. Bitte .env.local anlegen (siehe .env.local.example).");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
