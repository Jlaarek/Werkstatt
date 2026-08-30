"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createAppointment,
  fetchAppointments,
  fetchServices,
  type SalonAppointment,
  type SalonService,
} from "@/lib/salon";

type Tab = "dashboard" | "termine" | "leistungen" | "buchen";

const STATUS_STYLE: Record<string, string> = {
  Neu: "bg-amber-100 text-amber-800",
  Bestätigt: "bg-emerald-100 text-emerald-800",
  "In Arbeit": "bg-sky-100 text-sky-800",
  Abgeschlossen: "bg-stone-100 text-stone-600",
};

function formatEuro(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function SalonApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [services, setServices] = useState<SalonService[]>([]);
  const [appointments, setAppointments] = useState<SalonAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingMsg, setBookingMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    service_name: "",
    desired_date: "",
    desired_time: "10:00",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const [s, a] = await Promise.all([fetchServices(), fetchAppointments()]);
    setServices(s);
    setAppointments(a);
    if (!form.service_name && s[0]) {
      setForm((f) => ({ ...f, service_name: s[0].name }));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayAppts = appointments.filter((a) => a.desired_date === today && a.status !== "Abgeschlossen");
    const revenue = appointments
      .filter((a) => a.status !== "Neu" || a.desired_date === today)
      .reduce((sum, a) => sum + (a.price || 0), 0);
    const open = appointments.filter((a) => a.status === "Neu" || a.status === "Bestätigt").length;
    return {
      today: todayAppts.length,
      revenue,
      open,
      utilization: Math.min(96, 60 + todayAppts.length * 8),
    };
  }, [appointments]);

  const categories = useMemo(() => {
    const map = new Map<string, SalonService[]>();
    for (const s of services) {
      const list = map.get(s.category) || [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [services]);

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const service = services.find((s) => s.name === form.service_name);
    const result = await createAppointment({
      ...form,
      price: service?.price,
    });
    if (result.ok) {
      setBookingMsg("Termin angefragt — wir melden uns zur Bestätigung.");
      setForm({
        customer_name: "",
        customer_phone: "",
        service_name: services[0]?.name || "",
        desired_date: "",
        desired_time: "10:00",
        notes: "",
      });
      await load();
      setTab("termine");
    } else {
      setBookingMsg(result.error || "Fehler beim Speichern");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="hero-wash relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23db2777' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }} />
        <div className="relative max-w-5xl mx-auto px-4 pt-10 pb-16">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-salon-600 text-white flex items-center justify-center text-lg shadow-lg shadow-salon-600/30">
                ✂
              </div>
              <div>
                <div className="font-display text-2xl font-semibold tracking-tight text-ink-900">Salon Hans</div>
                <div className="text-[11px] text-ink-500 tracking-wide uppercase">Säp × Hans · Probe-App</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-xs text-ink-500 soft-panel px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
              Live-Daten · Friseur
            </span>
          </div>

          <div className="max-w-xl animate-rise">
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] text-ink-900 mb-4">
              Salon Hans.<br />
              <span className="text-salon-600">Termine im Griff.</span>
            </h1>
            <p className="text-ink-500 text-base leading-relaxed mb-6">
              Säp und Hans bauen zusammen: Leistungskatalog, Terminbuchung und Tagesübersicht —
              nach dem Geniva-Muster, für Friseure und Dienstleister.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setTab("buchen")}
                className="px-5 py-2.5 rounded-full bg-salon-600 text-white text-sm font-medium shadow-lg shadow-salon-600/25 hover:bg-salon-700 transition"
              >
                Termin buchen
              </button>
              <button
                onClick={() => setTab("leistungen")}
                className="px-5 py-2.5 rounded-full soft-panel text-sm text-ink-700 hover:bg-white transition"
              >
                Leistungen ansehen
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#faf7f5]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {([
            ["dashboard", "Dashboard"],
            ["termine", "Termine"],
            ["leistungen", "Leistungen"],
            ["buchen", "Buchen"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition ${
                tab === id
                  ? "border-salon-600 text-salon-700 font-medium"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 animate-rise-delay">
        {loading ? (
          <div className="text-center py-20 text-ink-500">Lade Salon-Daten…</div>
        ) : (
          <>
            {tab === "dashboard" && (
              <section className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Heute", value: String(stats.today), hint: "offene Termine" },
                    { label: "Umsatz", value: formatEuro(stats.revenue), hint: "geplant" },
                    { label: "Offen", value: String(stats.open), hint: "Neu + bestätigt" },
                    { label: "Auslastung", value: `${stats.utilization}%`, hint: "heute" },
                  ].map((s) => (
                    <div key={s.label} className="soft-panel rounded-2xl p-4">
                      <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-1">{s.label}</div>
                      <div className="font-display text-2xl font-semibold text-ink-900">{s.value}</div>
                      <div className="text-[11px] text-ink-500 mt-1">{s.hint}</div>
                    </div>
                  ))}
                </div>

                <div className="soft-panel rounded-2xl p-5">
                  <h2 className="font-display text-xl font-semibold mb-4">Nächste Termine</h2>
                  <div className="space-y-3">
                    {appointments
                      .filter((a) => a.status !== "Abgeschlossen")
                      .slice(0, 5)
                      .map((a) => (
                        <div key={a.id} className="flex items-center gap-4 py-2 border-b border-stone-100 last:border-0">
                          <div className="w-14 text-center">
                            <div className="text-xs text-ink-500">{formatDate(a.desired_date)}</div>
                            <div className="font-medium text-salon-700">{a.desired_time}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{a.customer_name}</div>
                            <div className="text-sm text-ink-500 truncate">
                              {a.service_name}
                              {a.stylist ? ` · ${a.stylist}` : ""}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[a.status] || STATUS_STYLE.Neu}`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </section>
            )}

            {tab === "termine" && (
              <section className="space-y-3">
                <h2 className="font-display text-2xl font-semibold mb-2">Alle Termine</h2>
                {appointments.map((a) => (
                  <article key={a.id} className="soft-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="sm:w-28">
                      <div className="text-sm text-ink-500">{formatDate(a.desired_date)}</div>
                      <div className="font-display text-lg text-salon-700">{a.desired_time || "—"}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{a.customer_name}</div>
                      <div className="text-sm text-ink-500">
                        {a.service_name}
                        {a.stylist ? ` · Stylist:in ${a.stylist}` : ""}
                      </div>
                      {a.notes && <div className="text-xs text-ink-500 mt-1 italic">{a.notes}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      {a.price != null && (
                        <span className="text-sm font-medium">{formatEuro(Number(a.price))}</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[a.status] || STATUS_STYLE.Neu}`}>
                        {a.status}
                      </span>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {tab === "leistungen" && (
              <section className="space-y-8">
                <h2 className="font-display text-2xl font-semibold">Leistungskatalog</h2>
                {Array.from(categories.entries()).map(([cat, items]) => (
                  <div key={cat}>
                    <h3 className="text-xs uppercase tracking-widest text-salon-600 mb-3">{cat}</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {items.map((s) => (
                        <div key={s.id} className="soft-panel rounded-2xl p-4 flex justify-between gap-4">
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-sm text-ink-500 mt-0.5">
                              {s.duration_min} Min
                              {s.description ? ` · ${s.description}` : ""}
                            </div>
                          </div>
                          <div className="font-display text-lg text-salon-700 whitespace-nowrap">
                            {formatEuro(Number(s.price))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {tab === "buchen" && (
              <section className="max-w-lg">
                <h2 className="font-display text-2xl font-semibold mb-2">Termin anfragen</h2>
                <p className="text-sm text-ink-500 mb-6">
                  Wie bei Geniva für Werkstätten — hier für den Salon: Anfrage landet direkt in der Terminliste.
                </p>
                <form onSubmit={submitBooking} className="soft-panel rounded-2xl p-5 space-y-4">
                  <label className="block">
                    <span className="text-xs text-ink-500">Name</span>
                    <input
                      required
                      value={form.customer_name}
                      onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-salon-400"
                      placeholder="Dein Name"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-ink-500">Telefon (optional)</span>
                    <input
                      value={form.customer_phone}
                      onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-salon-400"
                      placeholder="+49 …"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-ink-500">Leistung</span>
                    <select
                      value={form.service_name}
                      onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-salon-400"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} — {formatEuro(Number(s.price))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-ink-500">Datum</span>
                      <input
                        required
                        type="date"
                        value={form.desired_date}
                        onChange={(e) => setForm({ ...form, desired_date: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-salon-400"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-ink-500">Uhrzeit</span>
                      <input
                        required
                        type="time"
                        value={form.desired_time}
                        onChange={(e) => setForm({ ...form, desired_time: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-salon-400"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-ink-500">Notiz</span>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-salon-400 resize-none"
                      placeholder="Wünsche, Haarlänge, …"
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-full bg-salon-600 text-white text-sm font-medium hover:bg-salon-700 transition"
                  >
                    Anfrage senden
                  </button>
                  {bookingMsg && (
                    <p className="text-sm text-center text-emerald-700">{bookingMsg}</p>
                  )}
                </form>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-stone-200 mt-12 py-8 px-4 text-center">
        <p className="text-xs text-ink-500">
          Salon Hans — gebaut von <span className="text-salon-600 font-medium">Säp × Hans</span>
          {" "}· Bot-Suite mit Checker & Zementa · GitHub · Supabase · Netlify
        </p>
      </footer>
    </div>
  );
}
