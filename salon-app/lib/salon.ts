import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type SalonService = {
  id: string;
  name: string;
  category: string;
  duration_min: number;
  price: number;
  description: string | null;
  active: boolean;
};

export type SalonAppointment = {
  id: string;
  status: string;
  urgency: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  service_name: string;
  stylist: string | null;
  desired_date: string | null;
  desired_time: string | null;
  notes: string | null;
  price: number | null;
};

const FALLBACK_SERVICES: SalonService[] = [
  { id: "1", name: "Damenhaarschnitt", category: "Schnitt", duration_min: 45, price: 42, description: "Waschen, Schneiden, Föhnen", active: true },
  { id: "2", name: "Herrenhaarschnitt", category: "Schnitt", duration_min: 30, price: 28, description: "Klassisch oder modern", active: true },
  { id: "3", name: "Balayage", category: "Farbe", duration_min: 120, price: 145, description: "Natürliche Strähnen-Technik", active: true },
  { id: "4", name: "Ansatz färben", category: "Farbe", duration_min: 60, price: 55, description: "Farbe nach Wahl", active: true },
  { id: "5", name: "Olaplex-Kur", category: "Pflege", duration_min: 40, price: 35, description: "Intensive Haar-Reparatur", active: true },
  { id: "6", name: "Brautstyling komplett", category: "Styling", duration_min: 90, price: 120, description: "Probe + Hochzeitstag", active: true },
  { id: "7", name: "Hochsteckfrisur", category: "Styling", duration_min: 60, price: 65, description: "Für Hochzeit & Events", active: true },
  { id: "8", name: "Bart trimmen", category: "Bart", duration_min: 20, price: 18, description: "Form und Pflege", active: true },
];

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const FALLBACK_APPOINTMENTS: SalonAppointment[] = [
  { id: "a1", status: "Bestätigt", urgency: "normal", customer_name: "Lisa Berger", customer_phone: "+49 170 …", customer_email: null, service_name: "Balayage", stylist: "Anna", desired_date: todayPlus(0), desired_time: "10:00", notes: "Erstbesuch", price: 145 },
  { id: "a2", status: "Neu", urgency: "hoch", customer_name: "Tom Weber", customer_phone: null, customer_email: null, service_name: "Herrenhaarschnitt", stylist: "Marc", desired_date: todayPlus(0), desired_time: "11:30", notes: null, price: 28 },
  { id: "a3", status: "Bestätigt", urgency: "normal", customer_name: "Sarah Klein", customer_phone: null, customer_email: null, service_name: "Damenhaarschnitt", stylist: "Anna", desired_date: todayPlus(1), desired_time: "14:00", notes: null, price: 42 },
  { id: "a4", status: "In Arbeit", urgency: "normal", customer_name: "Julia Hoffmann", customer_phone: null, customer_email: null, service_name: "Brautstyling komplett", stylist: "Anna", desired_date: todayPlus(3), desired_time: "09:00", notes: "Hochzeit", price: 120 },
  { id: "a5", status: "Neu", urgency: "normal", customer_name: "Max Richter", customer_phone: null, customer_email: null, service_name: "Bart trimmen", stylist: "Marc", desired_date: todayPlus(1), desired_time: "16:30", notes: null, price: 18 },
  { id: "a6", status: "Abgeschlossen", urgency: "normal", customer_name: "Emma Schulz", customer_phone: null, customer_email: null, service_name: "Olaplex-Kur", stylist: "Anna", desired_date: todayPlus(-1), desired_time: "15:00", notes: null, price: 35 },
];

let client: SupabaseClient | null = null;

export function isConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getClient(): SupabaseClient | null {
  if (!isConfigured()) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

export async function fetchServices(): Promise<SalonService[]> {
  const sb = getClient();
  if (!sb) return FALLBACK_SERVICES;
  const { data, error } = await sb
    .from("salon_services")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error || !data?.length) return FALLBACK_SERVICES;
  return data as SalonService[];
}

export async function fetchAppointments(): Promise<SalonAppointment[]> {
  const sb = getClient();
  if (!sb) return FALLBACK_APPOINTMENTS;
  const { data, error } = await sb
    .from("salon_appointments")
    .select("*")
    .order("desired_date", { ascending: true });
  if (error || !data?.length) return FALLBACK_APPOINTMENTS;
  return data as SalonAppointment[];
}

export async function createAppointment(input: {
  customer_name: string;
  customer_phone?: string;
  service_name: string;
  desired_date: string;
  desired_time: string;
  notes?: string;
  price?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getClient();
  if (!sb) {
    return { ok: true }; // Demo-Modus
  }
  const { error } = await sb.from("salon_appointments").insert({
    ...input,
    status: "Neu",
    stylist: "Team",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
