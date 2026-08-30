"use client";
import React, { useEffect, useState } from "react";
import {
  Phone, PhoneCall, Calendar, ClipboardList, Wrench, AlertTriangle,
  CheckCircle2, Clock, Plus, X, Search, Copy, ChevronRight, ChevronLeft,
  Car, FileText, ArrowLeft, LayoutDashboard, Trash2, PhoneIncoming,
  RotateCcw, ShieldAlert, Download, Percent, Eye, EyeOff, User, CalendarClock,
  Check, LogOut, Lock, RefreshCw, Bot, ShieldCheck, Link2
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import ZementaView from "../components/ZementaView";
import CheckerView from "../components/CheckerView";
import BotsHubView from "../components/BotsHubView";

/* ============================================================
   DATENMODELL - identisch zum Claude-Prototyp, jetzt aber in
   Supabase-Tabelle "cases" gespeichert (siehe supabase/schema.sql).
   customer/vehicle/appointment/parts/notes/history liegen dort als
   jsonb-Spalten, damit die Struktur 1:1 übernommen werden konnte.
   ============================================================ */

const STATUS_OPTIONS = ["Neu", "In Prüfung", "Angebot gesendet", "Termin bestätigt", "Abgeschlossen"];
const URGENCY_OPTIONS = ["niedrig", "mittel", "hoch"];
const APPT_STATUS_OPTIONS = ["angefragt", "bestätigt", "erledigt", "abgesagt"];

const QUICK_CONCERNS = [
  "Bremsen quietschen", "Inspektion / Ölwechsel", "Motorkontrollleuchte",
  "Klimaanlage defekt", "Reifenwechsel", "TÜV / AU fällig",
  "Batterie / springt nicht an", "Ungewöhnliches Geräusch",
];

const STATUS_STYLES = {
  "Neu": "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-amber-100 text-amber-700 border-amber-200",
  "Angebot gesendet": "bg-purple-100 text-purple-700 border-purple-200",
  "Termin bestätigt": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Abgeschlossen": "bg-slate-200 text-slate-600 border-slate-300",
};

const URGENCY_STYLES = {
  "niedrig": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "mittel": "bg-amber-100 text-amber-700 border-amber-200",
  "hoch": "bg-orange-100 text-orange-700 border-orange-300",
};

const URGENCY_BUTTON_STYLES = {
  "niedrig": { active: "bg-emerald-500 text-white border-emerald-500", idle: "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
  "mittel": { active: "bg-amber-500 text-white border-amber-500", idle: "bg-white text-amber-700 border-amber-200 hover:bg-amber-50" },
  "hoch": { active: "bg-orange-600 text-white border-orange-600", idle: "bg-white text-orange-700 border-orange-200 hover:bg-orange-50" },
};

const APPT_STATUS_STYLES = {
  "angefragt": "bg-slate-100 text-slate-600 border-slate-300",
  "bestätigt": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "erledigt": "bg-blue-100 text-blue-700 border-blue-200",
  "abgesagt": "bg-red-100 text-red-700 border-red-200",
};

/* ---------- Hilfsfunktionen ---------- */

let idCounter = 1000;
function uid(prefix = "id") {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function newCaseId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid("case");
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatDateDE(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function weekdayShort(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short" });
}

function formatCurrency(n) {
  return (Number(n) || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function nowTimestamp() {
  return new Date().toLocaleString("de-DE");
}

function formatTimestampDE(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleString("de-DE"); } catch { return iso; }
}

function generateSlots() {
  const slots = [];
  for (let h = 8; h <= 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}
const DAY_SLOTS = generateSlots();
const MORNING_SLOTS = DAY_SLOTS.filter(s => parseInt(s) < 12);
const AFTERNOON_SLOTS = DAY_SLOTS.filter(s => parseInt(s) >= 12);

function calcQuote(parts, laborRatePerHour, discountPercent = 0) {
  const partsSubtotal = parts.reduce((sum, p) => sum + (Number(p.sellPrice) || 0) * (Number(p.qty) || 0), 0);
  const buyTotal = parts.reduce((sum, p) => sum + (Number(p.buyPrice) || 0) * (Number(p.qty) || 0), 0);
  const laborHours = parts.reduce((sum, p) => sum + (Number(p.laborTime) || 0) * (Number(p.qty) || 0), 0);
  const laborCost = laborHours * (Number(laborRatePerHour) || 0);
  const netBeforeDiscount = partsSubtotal + laborCost;
  const discountAmount = netBeforeDiscount * ((Number(discountPercent) || 0) / 100);
  const net = netBeforeDiscount - discountAmount;
  const tax = net * 0.19;
  const total = net + tax;
  const margin = partsSubtotal - buyTotal;
  const marginPct = partsSubtotal > 0 ? (margin / partsSubtotal) * 100 : 0;
  return { partsSubtotal, buyTotal, laborHours, laborCost, netBeforeDiscount, discountAmount, net, tax, total, margin, marginPct };
}

function lineTotal(p, laborRatePerHour) {
  return (Number(p.sellPrice) || 0) * (Number(p.qty) || 0) + (Number(p.laborTime) || 0) * (Number(p.qty) || 0) * (Number(laborRatePerHour) || 0);
}

function vehicleMissingFields(vehicle) {
  const missing = [];
  if (!vehicle.plate) missing.push("Kennzeichen");
  if (!vehicle.vin) missing.push("VIN / Fahrzeug-ID");
  if (!vehicle.mileage) missing.push("Kilometerstand");
  return missing;
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Mapping Supabase-Zeile <-> App-Datenmodell ---------- */
function rowToCase(row) {
  return {
    id: row.id,
    createdAt: formatTimestampDE(row.created_at),
    _createdAtIso: row.created_at,
    status: row.status,
    urgency: row.urgency,
    customer: row.customer || { name: "", phone: "", email: "" },
    vehicle: row.vehicle || { make: "", model: "", year: "", plate: "", vin: "", mileage: "" },
    concern: row.concern || "",
    desiredDate: row.desired_date,
    appointment: row.appointment || null,
    laborRatePerHour: row.labor_rate_per_hour,
    discountPercent: row.discount_percent,
    parts: row.parts || [],
    notes: row.notes || [],
    history: row.history || [],
    callbackRequested: row.callback_requested,
    callbackReason: row.callback_reason || "",
  };
}

function caseToRow(c) {
  return {
    status: c.status,
    urgency: c.urgency,
    customer: c.customer,
    vehicle: c.vehicle,
    concern: c.concern,
    desired_date: c.desiredDate || null,
    appointment: c.appointment,
    labor_rate_per_hour: c.laborRatePerHour,
    discount_percent: c.discountPercent,
    parts: c.parts,
    notes: c.notes,
    history: c.history,
    callback_requested: c.callbackRequested,
    callback_reason: c.callbackReason,
  };
}

/* ---------- Textgeneratoren ----------
   TODO Phase 4: Claude API für individuellere Formulierungen anbinden. */

function generateQuoteText(c) {
  const q = calcQuote(c.parts, c.laborRatePerHour, c.discountPercent || 0);
  const partsLines = c.parts.length
    ? c.parts.map(p => `- ${p.name || "Teil"} (${p.qty}x): ${formatCurrency((p.sellPrice || 0) * (p.qty || 0))}`).join("\n")
    : "- (noch keine Teile hinterlegt)";
  const discountLine = (c.discountPercent || 0) > 0
    ? `Rabatt (${c.discountPercent}%): -${formatCurrency(q.discountAmount)}\n`
    : "";
  return `Sehr geehrte(r) ${c.customer.name || "Kunde/Kundin"},

vielen Dank für Ihre Anfrage zu Ihrem ${c.vehicle.make || ""} ${c.vehicle.model || ""} (Baujahr ${c.vehicle.year || "-"}).

Wir haben folgendes Angebot für Sie erstellt:
${partsLines}

Arbeitszeit: ${q.laborHours.toFixed(1)} Std. à ${formatCurrency(c.laborRatePerHour)} = ${formatCurrency(q.laborCost)}
Zwischensumme (netto): ${formatCurrency(q.netBeforeDiscount)}
${discountLine}Nettobetrag: ${formatCurrency(q.net)}
zzgl. 19% MwSt.: ${formatCurrency(q.tax)}
Gesamtbetrag: ${formatCurrency(q.total)}

Das Angebot ist 14 Tage gültig. Gerne vereinbaren wir einen passenden Termin mit Ihnen.

Mit freundlichen Grüßen
Ihr Werkstatt-Team`;
}

function generateConfirmationText(c) {
  const appt = c.appointment;
  if (!appt) {
    return `Sehr geehrte(r) ${c.customer.name || "Kunde/Kundin"},

für Ihr Anliegen "${c.concern || "-"}" möchten wir gerne zeitnah einen Termin mit Ihnen vereinbaren. Wir melden uns dazu bei Ihnen.

Mit freundlichen Grüßen
Ihr Werkstatt-Team`;
  }
  return `Sehr geehrte(r) ${c.customer.name || "Kunde/Kundin"},

wir bestätigen Ihnen hiermit den Termin am ${formatDateDE(appt.date)} um ${appt.time} Uhr für Ihr Fahrzeug ${c.vehicle.make || ""} ${c.vehicle.model || ""}.

Bitte bringen Sie den Fahrzeugschein mit. Bei Verhinderung geben Sie uns bitte kurz Bescheid.

Mit freundlichen Grüßen
Ihr Werkstatt-Team`;
}

function generateCallbackNote(c) {
  return `Rückrufnotiz - ${nowTimestamp()}
Kunde: ${c.customer.name || "-"} (${c.customer.phone || "-"})
Fahrzeug: ${c.vehicle.make || "-"} ${c.vehicle.model || "-"}
Dringlichkeit: ${c.urgency}
Anliegen: ${c.concern || "-"}
Grund für Rückruf: ${c.callbackReason || "Rückruf erwünscht - Details siehe Notizen"}
Nächster Schritt: Kunde zurückrufen unter ${c.customer.phone || "-"} und offene Fragen klären.`;
}

/* ---------- Kleine UI-Bausteine ---------- */

function Badge({ text, styles }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${styles[text] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {text}
    </span>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
      <Icon size={32} className="mb-2" />
      <p className="text-sm text-center px-4">{text}</p>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

function Field({ label, children, required, hint }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-orange-500"> *</span>}
        {hint && <span className="text-slate-400 font-normal"> ({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function UrgencyPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {URGENCY_OPTIONS.map(u => {
        const active = value === u;
        const styles = URGENCY_BUTTON_STYLES[u];
        return (
          <button
            type="button"
            key={u}
            onClick={() => onChange(u)}
            className={`border rounded-lg py-3 text-sm font-semibold capitalize transition ${active ? styles.active : styles.idle}`}
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}

function SectionCard({ title, icon: Icon, accent, children }) {
  const accentBorder = {
    blue: "border-l-blue-500",
    orange: "border-l-orange-500",
    emerald: "border-l-emerald-500",
    purple: "border-l-purple-500",
  }[accent] || "border-l-slate-400";
  const accentText = {
    blue: "text-blue-600",
    orange: "text-orange-500",
    emerald: "text-emerald-600",
    purple: "text-purple-600",
  }[accent] || "text-slate-500";
  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${accentBorder} shadow-sm p-4 sm:p-5`}>
      {title && (
        <h2 className={`font-semibold text-slate-700 mb-3 flex items-center gap-2`}>
          {Icon && <Icon size={16} className={accentText} />} {title}
        </h2>
      )}
      {children}
    </div>
  );
}

const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400";

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 right-5 left-5 sm:left-auto bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="text-slate-400 hover:text-white ml-auto"><X size={16} /></button>
    </div>
  );
}

/* ============================================================
   KONFIGURATIONS- / LOGIN- / LADE-ZUSTÄNDE
   ============================================================ */

function ConfigErrorScreen() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6 max-w-md text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-3" size={32} />
        <h1 className="font-bold text-lg text-slate-800 mb-2">Supabase nicht konfiguriert</h1>
        <p className="text-sm text-slate-500">
          Es fehlen die Umgebungsvariablen <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> und/oder{" "}
          <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Bitte in <code className="bg-slate-100 px-1 rounded">.env.local</code> (lokal)
          bzw. in den Umgebungsvariablen deines Hosting-Anbieters setzen - siehe README.md.
        </p>
      </div>
    </div>
  );
}

function LoginScreen({ signIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-white">KW</div>
          <div>
            <p className="font-semibold leading-tight">Kfz-Werkstatt</p>
            <p className="text-xs text-slate-400">Mitarbeiter-Login</p>
          </div>
        </div>
        <Field label="E-Mail" required>
          <input type="email" required className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="mitarbeiter@werkstatt.de" />
        </Field>
        <Field label="Passwort" required>
          <input type="password" required className={inputCls} value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg disabled:opacity-60">
          <Lock size={16} /> {loading ? "Anmelden..." : "Anmelden"}
        </button>
        <p className="text-xs text-slate-400 mt-3">
          Konten werden im Supabase-Dashboard unter Authentication → Users angelegt (siehe README.md).
        </p>
      </form>
    </div>
  );
}

/* ============================================================
   HAUPTKOMPONENTE
   ============================================================ */

export default function WerkstattDashboard() {
  const { session, loading: authLoading, signIn, signOut } = useAuth();

  if (!isSupabaseConfigured) return <ConfigErrorScreen />;
  if (authLoading) return <FullscreenLoader text="Anmeldung wird geprüft..." />;
  if (!session) return <LoginScreen signIn={signIn} />;

  return <Dashboard session={session} signOut={signOut} />;
}

function FullscreenLoader({ text }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-500 text-sm"><RefreshCw className="animate-spin" size={18} /> {text}</div>
    </div>
  );
}

function Dashboard({ session, signOut }) {
  const [cases, setCases] = useState(null); // null = wird geladen
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(isoDate(0));
  const [caseFilter, setCaseFilter] = useState({ status: "alle", urgency: "alle", search: "" });
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  async function loadCases() {
    setLoadError("");
    const { data, error } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setCases(data.map(rowToCase));
  }

  useEffect(() => { loadCases(); }, []);

  async function persist(caseObj) {
    const { error } = await supabase.from("cases").update(caseToRow(caseObj)).eq("id", caseObj.id);
    if (error) showToast(`Fehler beim Speichern: ${error.message}`);
  }

  function updateCase(id, updater) {
    setCases(prev => {
      const next = prev.map(c => (c.id === id ? updater(c) : c));
      const updated = next.find(c => c.id === id);
      if (updated) persist(updated);
      return next;
    });
  }

  function addHistory(id, event) {
    updateCase(id, c => ({ ...c, history: [...c.history, { id: uid("hist"), event, timestamp: nowTimestamp() }] }));
  }

  const selectedCase = (cases || []).find(c => c.id === selectedCaseId) || null;

  const today = isoDate(0);
  const safeCases = cases || [];
  const todaysAppointments = safeCases.filter(c => c.appointment && c.appointment.date === today);
  const openRequests = safeCases.filter(c => c.status === "Neu" || c.status === "In Prüfung");
  const openQuotes = safeCases.filter(c => c.status === "Angebot gesendet");
  const callbacks = safeCases.filter(c => c.callbackRequested);
  const urgentCases = safeCases.filter(c => c.urgency === "hoch" && c.status !== "Abgeschlossen");

  const emptyIntake = {
    name: "", phone: "", email: "",
    concern: "",
    make: "", model: "", year: "", plate: "", vin: "", mileage: "",
    desiredDate: isoDate(1), urgency: "mittel", notes: "",
  };
  const [intake, setIntake] = useState(emptyIntake);
  const [intakeErrors, setIntakeErrors] = useState({});

  async function submitIntake() {
    const errors = {};
    if (!intake.phone.trim()) errors.phone = "Telefonnummer wird benötigt";
    if (!intake.concern.trim()) errors.concern = "Anliegen wird benötigt";
    setIntakeErrors(errors);
    if (Object.keys(errors).length > 0) return false;

    const id = newCaseId();
    const newCase = {
      id,
      createdAt: nowTimestamp(),
      status: "Neu",
      urgency: intake.urgency,
      customer: { name: intake.name.trim(), phone: intake.phone.trim(), email: intake.email.trim() },
      vehicle: {
        make: intake.make.trim(), model: intake.model.trim(), year: intake.year.trim(),
        plate: intake.plate.trim(), vin: intake.vin.trim(), mileage: intake.mileage.trim(),
      },
      concern: intake.concern.trim(),
      desiredDate: intake.desiredDate,
      appointment: null,
      laborRatePerHour: 110,
      discountPercent: 0,
      parts: [],
      notes: intake.notes.trim() ? [{ id: uid("note"), text: intake.notes.trim(), timestamp: nowTimestamp() }] : [],
      history: [{ id: uid("hist"), event: "Vorgang telefonisch angelegt", timestamp: nowTimestamp() }],
      callbackRequested: false,
      callbackReason: "",
    };

    setCases(prev => [newCase, ...(prev || [])]);
    const { error } = await supabase.from("cases").insert({ id, ...caseToRow(newCase) });
    if (error) {
      showToast(`Fehler beim Speichern: ${error.message}`);
      setCases(prev => (prev || []).filter(c => c.id !== id));
      return false;
    }
    setIntake(emptyIntake);
    showToast("Anfrage gespeichert - neuer Vorgang angelegt.");
    setSelectedCaseId(id);
    setView("fallakte");
    return true;
  }

  function bookAppointment(caseId, date, time) {
    if (!caseId || !date || !time) return;
    updateCase(caseId, c => ({ ...c, appointment: { date, time, status: "angefragt" }, status: c.status === "Neu" ? "In Prüfung" : c.status }));
    addHistory(caseId, `Termin am ${formatDateDE(date)} ${time} Uhr angefragt`);
    showToast("Termin eingetragen.");
  }

  function setApptStatus(caseId, status) {
    updateCase(caseId, c => ({
      ...c,
      appointment: { ...c.appointment, status },
      status: status === "bestätigt" ? "Termin bestätigt" : c.status,
    }));
    addHistory(caseId, `Terminstatus geändert: ${status}`);
  }

  function clearSlot(caseId) {
    updateCase(caseId, c => ({ ...c, appointment: null }));
    addHistory(caseId, "Termin entfernt");
  }

  const NAV_ITEMS = [
    { key: "dashboard", label: "Startseite", icon: LayoutDashboard },
    { key: "intake", label: "Anrufannahme", icon: PhoneIncoming },
    { key: "calendar", label: "Termine", icon: Calendar },
    { key: "cases", label: "Fallakten", icon: ClipboardList },
    { key: "bots", label: "Bots", icon: Link2 },
    { key: "checker", label: "Checker", icon: ShieldCheck },
    { key: "zementa", label: "Zementa", icon: Bot },
  ];

  function openCase(id) {
    setSelectedCaseId(id);
    setView("fallakte");
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="flex flex-1 flex-col md:flex-row min-h-0">
        <aside className="bg-slate-900 text-white flex flex-row md:flex-col shrink-0 md:w-56 lg:w-60">
          <div className="hidden md:flex px-5 py-5 border-b border-slate-800 items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center font-bold shrink-0">KW</div>
            <div>
              <p className="font-semibold leading-tight">Kfz-Werkstatt</p>
              <p className="text-xs text-slate-400">Annahme-Dashboard</p>
            </div>
          </div>
          <nav className="flex flex-row md:flex-col flex-1 px-2 md:px-3 py-2 md:py-4 gap-1 overflow-x-auto md:overflow-visible">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = view === item.key || (item.key === "cases" && view === "fallakte");
              return (
                <button
                  key={item.key}
                  onClick={() => { setView(item.key); if (item.key !== "fallakte") setSelectedCaseId(null); }}
                  className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-3 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap shrink-0 ${
                    active ? "bg-orange-500 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="hidden md:block p-3 m-3 rounded-lg bg-slate-800 text-xs text-slate-300">
            <p className="flex items-center gap-1.5 mb-1"><Lock size={12} /> {session.user.email}</p>
            <p className="text-slate-400 mb-2">Zugriffsgeschützt - Kundendaten vertraulich behandeln.</p>
            <button onClick={signOut} className="flex items-center gap-1.5 text-slate-300 hover:text-white"><LogOut size={13} /> Abmelden</button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-6xl mx-auto p-3 sm:p-5 md:p-6">
            {cases === null && !loadError && (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center"><RefreshCw className="animate-spin" size={18} /> Vorgänge werden geladen...</div>
            )}

            {loadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-center justify-between gap-3 mb-4">
                <span className="text-sm flex items-center gap-2"><AlertTriangle size={16} /> Fehler beim Laden: {loadError}</span>
                <button onClick={loadCases} className="text-sm font-medium underline shrink-0">Erneut versuchen</button>
              </div>
            )}

            {cases !== null && (
              <>
                {view === "dashboard" && (
                  <DashboardView
                    todaysAppointments={todaysAppointments}
                    openRequests={openRequests}
                    openQuotes={openQuotes}
                    callbacks={callbacks}
                    urgentCases={urgentCases}
                    openCase={openCase}
                    goToIntake={() => setView("intake")}
                  />
                )}

                {view === "intake" && (
                  <IntakeWizard
                    intake={intake} setIntake={setIntake}
                    errors={intakeErrors} onSubmit={submitIntake}
                  />
                )}

                {view === "calendar" && (
                  <CalendarView
                    cases={safeCases}
                    selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                    bookAppointment={bookAppointment} setApptStatus={setApptStatus} clearSlot={clearSlot}
                    openCase={openCase}
                  />
                )}

                {view === "cases" && (
                  <CasesListView
                    cases={safeCases} filter={caseFilter} setFilter={setCaseFilter}
                    openCase={openCase}
                  />
                )}

                {view === "bots" && (
                  <BotsHubView
                    cases={safeCases}
                    openView={(key) => setView(key)}
                    showToast={showToast}
                  />
                )}

                {view === "checker" && (
                  <CheckerView
                    cases={safeCases}
                    openCase={openCase}
                  />
                )}

                {view === "zementa" && (
                  <ZementaView
                    cases={safeCases}
                    openCase={openCase}
                    showToast={showToast}
                  />
                )}

                {view === "fallakte" && selectedCase && (
                  <CaseDetailView
                    c={selectedCase}
                    updateCase={updateCase}
                    addHistory={addHistory}
                    bookAppointment={bookAppointment}
                    setApptStatus={setApptStatus}
                    clearSlot={clearSlot}
                    onBack={() => setView("cases")}
                    showToast={showToast}
                  />
                )}

                {view === "fallakte" && !selectedCase && (
                  <EmptyState icon={ClipboardList} text="Kein Vorgang ausgewählt." />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

/* ============================================================
   STARTSEITE
   ============================================================ */

function DashboardView({ todaysAppointments, openRequests, openQuotes, callbacks, urgentCases, openCase, goToIntake }) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Übersicht</h1>
          <p className="text-slate-500 text-sm">Heutiger Stand, {formatDateDE(isoDate(0))}</p>
        </div>
        <button onClick={goToIntake} className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-3 rounded-lg shadow-sm">
          <PhoneIncoming size={18} /> Anruf entgegennehmen
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <KpiCard icon={Calendar} label="Termine heute" value={todaysAppointments.length} accent="bg-blue-600" />
        <KpiCard icon={ClipboardList} label="Offene Anfragen" value={openRequests.length} accent="bg-slate-600" />
        <KpiCard icon={FileText} label="Offene Angebote" value={openQuotes.length} accent="bg-purple-600" />
        <KpiCard icon={PhoneCall} label="Rückrufe" value={callbacks.length} accent="bg-emerald-600" />
        <KpiCard icon={AlertTriangle} label="Dringende Fälle" value={urgentCases.length} accent="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <DashboardList title="Heutige Termine" icon={Calendar} items={todaysAppointments} openCase={openCase}
          render={c => `${c.appointment.time} Uhr - ${c.customer.name || "Anrufer"} (${c.vehicle.make} ${c.vehicle.model})`}
          emptyText="Keine Termine für heute." />

        <DashboardList title="Dringende Fälle" icon={AlertTriangle} items={urgentCases} openCase={openCase}
          render={c => `${c.customer.name || "Anrufer"} - ${c.concern || "kein Anliegen hinterlegt"}`}
          emptyText="Aktuell keine dringenden Fälle." />

        <DashboardList title="Offene Anfragen" icon={ClipboardList} items={openRequests} openCase={openCase}
          render={c => `${c.customer.name || "Anrufer"} - Status: ${c.status}`}
          emptyText="Keine offenen Anfragen." />

        <DashboardList title="Offene Angebote" icon={FileText} items={openQuotes} openCase={openCase}
          render={c => `${c.customer.name || "Anrufer"} - ${formatCurrency(calcQuote(c.parts, c.laborRatePerHour, c.discountPercent || 0).total)}`}
          emptyText="Keine offenen Angebote." />

        <DashboardList title="Rückrufe" icon={PhoneCall} items={callbacks} openCase={openCase}
          render={c => `${c.customer.name || "Anrufer"} - ${c.customer.phone}`}
          emptyText="Keine offenen Rückrufe." />
      </div>
    </div>
  );
}

function DashboardList({ title, icon: Icon, items, render, emptyText, openCase }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Icon size={16} className="text-orange-500" />
        <h2 className="font-semibold text-sm text-slate-700">{title}</h2>
        <span className="ml-auto text-xs text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Icon} text={emptyText} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 6).map(c => (
            <li key={c.id}>
              <button onClick={() => openCase(c.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center justify-between gap-2">
                <span className="truncate">{render(c)}</span>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================
   ANRUFANNAHME - Schritt-für-Schritt-Assistent
   ============================================================ */

const INTAKE_STEPS = [
  { key: "kunde", label: "Kunde", icon: User },
  { key: "fahrzeug", label: "Fahrzeug", icon: Car },
  { key: "anliegen", label: "Anliegen", icon: Wrench },
  { key: "termin", label: "Termin", icon: CalendarClock },
];

function IntakeWizard({ intake, setIntake, errors, onSubmit }) {
  const [step, setStep] = useState("kunde");
  const [saving, setSaving] = useState(false);
  const stepIndex = INTAKE_STEPS.findIndex(s => s.key === step);

  function set(field, value) {
    setIntake(prev => ({ ...prev, [field]: value }));
  }

  function addConcernChip(chip) {
    setIntake(prev => ({ ...prev, concern: prev.concern ? `${prev.concern}; ${chip}` : chip }));
  }

  function goNext() {
    const idx = INTAKE_STEPS.findIndex(s => s.key === step);
    if (idx < INTAKE_STEPS.length - 1) setStep(INTAKE_STEPS[idx + 1].key);
  }
  function goBack() {
    const idx = INTAKE_STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(INTAKE_STEPS[idx - 1].key);
  }

  async function handleSave() {
    setSaving(true);
    const ok = await onSubmit();
    setSaving(false);
    if (!ok) {
      if (errors.phone) setStep("kunde");
      else if (errors.concern) setStep("anliegen");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <PhoneIncoming className="text-orange-500" size={22} />
        <h1 className="text-2xl font-bold text-slate-800">Anrufannahme</h1>
      </div>
      <p className="text-slate-500 text-sm mb-5">Schritt für Schritt durchs Gespräch - nur Telefon &amp; Anliegen sind Pflicht, alles andere optional.</p>

      <div className="flex items-center gap-1 sm:gap-2 mb-5 overflow-x-auto">
        {INTAKE_STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.key === step;
          const isDone = i < stepIndex;
          return (
            <React.Fragment key={s.key}>
              <button
                onClick={() => setStep(s.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm font-medium border shrink-0 transition ${
                  isActive ? "bg-orange-500 text-white border-orange-500" :
                  isDone ? "bg-orange-50 text-orange-600 border-orange-200" :
                  "bg-white text-slate-500 border-slate-200"
                }`}
              >
                {isDone ? <Check size={14} /> : <Icon size={14} />}
                {i + 1}. {s.label}
              </button>
              {i < INTAKE_STEPS.length - 1 && <div className={`h-0.5 w-3 sm:w-6 shrink-0 ${isDone ? "bg-orange-300" : "bg-slate-200"}`} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {step === "kunde" && (
            <SectionCard title="Kunde" icon={User} accent="blue">
              <Field label="Telefonnummer" required hint="wichtigstes Feld - zuerst erfragen">
                <input autoFocus className={inputCls} value={intake.phone} onChange={e => set("phone", e.target.value)} placeholder="0170 1234567" inputMode="tel" />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Field label="Name" hint="optional">
                  <input className={inputCls} value={intake.name} onChange={e => set("name", e.target.value)} placeholder="z. B. Max Mustermann" />
                </Field>
                <Field label="E-Mail" hint="optional">
                  <input className={inputCls} value={intake.email} onChange={e => set("email", e.target.value)} placeholder="kunde@beispiel.de" />
                </Field>
              </div>
            </SectionCard>
          )}

          {step === "fahrzeug" && (
            <SectionCard title="Fahrzeugdaten" icon={Car} accent="orange">
              <p className="text-xs text-slate-400 mb-3">Alles optional - was der Kunde nicht griffbereit hat, kann später ergänzt werden.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
                <Field label="Marke"><input className={inputCls} value={intake.make} onChange={e => set("make", e.target.value)} placeholder="VW" /></Field>
                <Field label="Modell"><input className={inputCls} value={intake.model} onChange={e => set("model", e.target.value)} placeholder="Golf VII" /></Field>
                <Field label="Baujahr"><input className={inputCls} value={intake.year} onChange={e => set("year", e.target.value)} placeholder="2018" /></Field>
                <Field label="Kennzeichen"><input className={inputCls} value={intake.plate} onChange={e => set("plate", e.target.value)} placeholder="M-XX 1234" /></Field>
                <Field label="VIN / Fahrzeug-ID" hint="optional"><input className={inputCls} value={intake.vin} onChange={e => set("vin", e.target.value)} placeholder="WVWZZZ..." /></Field>
                <Field label="Kilometerstand"><input className={inputCls} value={intake.mileage} onChange={e => set("mileage", e.target.value)} placeholder="128000" inputMode="numeric" /></Field>
              </div>
            </SectionCard>
          )}

          {step === "anliegen" && (
            <SectionCard title="Anliegen & Dringlichkeit" icon={Wrench} accent="purple">
              <Field label="Häufige Anliegen" hint="antippen zum Übernehmen">
                <div className="flex flex-wrap gap-2">
                  {QUICK_CONCERNS.map(chip => (
                    <button type="button" key={chip} onClick={() => addConcernChip(chip)}
                      className="text-xs sm:text-sm border border-slate-300 rounded-full px-3 py-1.5 text-slate-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700">
                      {chip}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Anliegen des Kunden" required>
                <textarea className={inputCls} rows={3} value={intake.concern} onChange={e => set("concern", e.target.value)} placeholder="z. B. Bremsen quietschen, seltsames Geräusch beim Bremsen" />
                {errors.concern && <p className="text-xs text-red-500 mt-1">{errors.concern}</p>}
              </Field>
              <Field label="Dringlichkeit">
                <UrgencyPicker value={intake.urgency} onChange={v => set("urgency", v)} />
              </Field>
            </SectionCard>
          )}

          {step === "termin" && (
            <SectionCard title="Terminwunsch & Notizen" icon={CalendarClock} accent="emerald">
              <Field label="Gewünschter Termin">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" className={`${inputCls} w-auto`} value={intake.desiredDate} onChange={e => set("desiredDate", e.target.value)} />
                  <button type="button" onClick={() => set("desiredDate", isoDate(0))} className="text-xs border border-slate-300 rounded-full px-3 py-1.5 hover:bg-slate-50">Heute</button>
                  <button type="button" onClick={() => set("desiredDate", isoDate(1))} className="text-xs border border-slate-300 rounded-full px-3 py-1.5 hover:bg-slate-50">Morgen</button>
                  <button type="button" onClick={() => set("desiredDate", isoDate(7))} className="text-xs border border-slate-300 rounded-full px-3 py-1.5 hover:bg-slate-50">In 1 Woche</button>
                </div>
              </Field>
              <p className="text-xs text-slate-400 mb-1">Der genaue Termin-Slot wird nach dem Speichern im Termine-Modul eingetragen.</p>
              <Field label="Notizen während des Gesprächs">
                <textarea className={inputCls} rows={3} value={intake.notes} onChange={e => set("notes", e.target.value)} placeholder="Freitext, z. B. Kunde ist tagsüber schlecht erreichbar..." />
              </Field>
            </SectionCard>
          )}

          <div className="flex items-center justify-between mt-4 gap-3">
            <button onClick={goBack} disabled={stepIndex === 0}
              className="flex items-center gap-1 text-sm text-slate-500 disabled:opacity-0 px-3 py-2">
              <ChevronLeft size={16} /> Zurück
            </button>
            {stepIndex < INTAKE_STEPS.length - 1 ? (
              <button onClick={goNext} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold px-5 py-3 rounded-lg">
                Weiter <ChevronRight size={18} />
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-3.5 rounded-lg text-base shadow-sm disabled:opacity-60">
                <Plus size={20} /> {saving ? "Speichert..." : "Vorgang speichern"}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="font-semibold text-slate-700 mb-2 flex items-center gap-2 text-sm"><ClipboardList size={16} className="text-orange-500" /> Live-Vorschau</h2>
            <p className="text-sm text-slate-700 font-medium">{intake.name || "Kundenname (optional)"}</p>
            <p className="text-sm text-slate-500">{intake.phone || "Telefonnummer fehlt noch"}</p>
            <p className="text-sm text-slate-500 mt-1">{intake.make || "Marke"} {intake.model || "Modell"} {intake.year && `(${intake.year})`}</p>
            <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{intake.concern || "Noch kein Anliegen erfasst."}</p>
            <div className="mt-2"><Badge text={intake.urgency} styles={URGENCY_STYLES} /></div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="font-semibold text-slate-700 mb-2 text-sm">Noch offen</h2>
            <ul className="space-y-1 text-sm">
              <li className={`flex items-center gap-1.5 ${intake.phone ? "text-emerald-600" : "text-slate-400"}`}>
                {intake.phone ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />} Telefonnummer
              </li>
              <li className={`flex items-center gap-1.5 ${intake.concern ? "text-emerald-600" : "text-slate-400"}`}>
                {intake.concern ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />} Anliegen
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TERMINE
   ============================================================ */

function CalendarView({ cases, selectedDate, setSelectedDate, bookAppointment, setApptStatus, clearSlot, openCase }) {
  const [bookingSlot, setBookingSlot] = useState(null);
  const [pickCaseId, setPickCaseId] = useState("");

  const dayAppointments = cases.filter(c => c.appointment && c.appointment.date === selectedDate);
  const bookableCases = cases.filter(c => !(c.appointment && c.appointment.date === selectedDate));
  const freeCount = DAY_SLOTS.length - dayAppointments.length;

  function shiftDay(offset) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  function confirmBooking(time) {
    if (!pickCaseId) return;
    bookAppointment(pickCaseId, selectedDate, time);
    setBookingSlot(null);
    setPickCaseId("");
  }

  const weekStrip = Array.from({ length: 7 }, (_, i) => isoDate(i - 1));

  function renderSlotGroup(slots) {
    return slots.map(slot => {
      const booked = dayAppointments.find(c => c.appointment.time === slot);
      return (
        <div key={slot} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 ${booked ? "bg-white border-slate-200" : "bg-slate-50 border-dashed border-slate-300"}`}>
          <span className="text-sm font-mono text-slate-500 w-14 shrink-0 flex items-center gap-1"><Clock size={13} />{slot}</span>
          {booked ? (
            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
              <button onClick={() => openCase(booked.id)} className="text-sm text-left truncate hover:underline flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${booked.urgency === "hoch" ? "bg-orange-500" : booked.urgency === "mittel" ? "bg-amber-400" : "bg-emerald-400"}`} />
                <span className="truncate"><span className="font-medium">{booked.customer.name || "Anrufer"}</span><span className="text-slate-400"> · {booked.vehicle.make} {booked.vehicle.model}</span></span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  value={booked.appointment.status}
                  onChange={e => setApptStatus(booked.id, e.target.value)}
                  className={`text-xs rounded-full border px-2 py-1 ${APPT_STATUS_STYLES[booked.appointment.status]}`}
                >
                  {APPT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => clearSlot(booked.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ) : bookingSlot === slot ? (
            <div className="flex-1 flex items-center gap-2">
              <select className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm min-w-0" value={pickCaseId} onChange={e => setPickCaseId(e.target.value)}>
                <option value="">Vorgang wählen...</option>
                {bookableCases.map(c => <option key={c.id} value={c.id}>{c.customer.name || "Anrufer"} - {c.vehicle.make} {c.vehicle.model}</option>)}
              </select>
              <button onClick={() => confirmBooking(slot)} className="text-xs bg-orange-500 text-white px-2.5 py-1.5 rounded-lg font-medium shrink-0">OK</button>
              <button onClick={() => setBookingSlot(null)} className="text-slate-400 p-1 shrink-0"><X size={16} /></button>
            </div>
          ) : (
            <button onClick={() => setBookingSlot(slot)} className="flex-1 text-left text-sm text-slate-400 hover:text-orange-600">
              frei - Termin planen
            </button>
          )}
        </div>
      );
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="text-orange-500" size={22} />
        <h1 className="text-2xl font-bold text-slate-800">Termine</h1>
      </div>
      <p className="text-slate-500 text-sm mb-4">Tagesansicht - Beispiel-Zeitfenster 08:00 - 18:00 Uhr.</p>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {weekStrip.map(d => {
          const count = cases.filter(c => c.appointment && c.appointment.date === d).length;
          const active = d === selectedDate;
          return (
            <button key={d} onClick={() => setSelectedDate(d)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg border shrink-0 min-w-[64px] ${active ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-orange-300"}`}>
              <span className="text-xs capitalize">{weekdayShort(d)}</span>
              <span className="font-semibold text-sm">{d.slice(8, 10)}.{d.slice(5, 7)}</span>
              <span className={`text-[10px] mt-0.5 ${active ? "text-orange-100" : "text-slate-400"}`}>{count} Termin{count === 1 ? "" : "e"}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <button onClick={() => shiftDay(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button onClick={() => shiftDay(1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight size={18} /></button>
        <span className="text-sm text-slate-500">{formatDateDE(selectedDate)}</span>
        <span className="ml-auto text-xs sm:text-sm text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> {dayAppointments.length} gebucht</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> {freeCount} frei</span>
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Vormittag</h3>
          <div className="space-y-2">{renderSlotGroup(MORNING_SLOTS)}</div>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Nachmittag</h3>
          <div className="space-y-2">{renderSlotGroup(AFTERNOON_SLOTS)}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FALLAKTEN - LISTE
   ============================================================ */

function CasesListView({ cases, filter, setFilter, openCase }) {
  const filtered = cases.filter(c => {
    if (filter.status !== "alle" && c.status !== filter.status) return false;
    if (filter.urgency !== "alle" && c.urgency !== filter.urgency) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const hay = `${c.customer.name} ${c.vehicle.make} ${c.vehicle.model} ${c.concern}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="text-orange-500" size={22} />
        <h1 className="text-2xl font-bold text-slate-800">Fallakten</h1>
      </div>
      <p className="text-slate-500 text-sm mb-6">Alle Vorgänge im Überblick.</p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm w-full"
            placeholder="Suche nach Name, Fahrzeug, Anliegen..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="alle">Alle Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" value={filter.urgency} onChange={e => setFilter(f => ({ ...f, urgency: e.target.value }))}>
          <option value="alle">Alle Dringlichkeiten</option>
          {URGENCY_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} text="Keine Vorgänge gefunden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Kunde</th>
                  <th className="px-4 py-2.5 font-medium">Fahrzeug</th>
                  <th className="px-4 py-2.5 font-medium">Anliegen</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Dringlichkeit</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openCase(c.id)}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{c.customer.name || "Anrufer"}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{c.vehicle.make} {c.vehicle.model}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{c.concern}</td>
                    <td className="px-4 py-3"><Badge text={c.status} styles={STATUS_STYLES} /></td>
                    <td className="px-4 py-3"><Badge text={c.urgency} styles={URGENCY_STYLES} /></td>
                    <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-slate-300 inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   FALLAKTE - DETAIL
   ============================================================ */

function CaseDetailView({ c, updateCase, addHistory, bookAppointment, setApptStatus, clearSlot, onBack, showToast }) {
  const [tab, setTab] = useState("kunde");
  const [newNote, setNewNote] = useState("");
  const [genText, setGenText] = useState("");
  const [genLabel, setGenLabel] = useState("");
  const [showMargin, setShowMargin] = useState(false);
  const [quickDate, setQuickDate] = useState(isoDate(0));
  const [quickTime, setQuickTime] = useState(DAY_SLOTS[0]);

  function set(field, value) {
    updateCase(c.id, prev => ({ ...prev, [field]: value }));
  }
  function setVehicle(field, value) {
    updateCase(c.id, prev => ({ ...prev, vehicle: { ...prev.vehicle, [field]: value } }));
  }
  function setCustomer(field, value) {
    updateCase(c.id, prev => ({ ...prev, customer: { ...prev.customer, [field]: value } }));
  }

  function addNote() {
    if (!newNote.trim()) return;
    updateCase(c.id, prev => ({ ...prev, notes: [...prev.notes, { id: uid("note"), text: newNote.trim(), timestamp: nowTimestamp() }] }));
    setNewNote("");
  }

  function changeStatus(status) {
    set("status", status);
    addHistory(c.id, `Status geändert: ${status}`);
  }

  function addPart() {
    updateCase(c.id, prev => ({
      ...prev,
      parts: [...prev.parts, { id: uid("part"), name: "", partNumber: "", oeNumber: "", supplier: "", buyPrice: 0, sellPrice: 0, laborTime: 0, qty: 1 }],
    }));
  }
  function updatePart(partId, field, value) {
    updateCase(c.id, prev => ({
      ...prev,
      parts: prev.parts.map(p => (p.id === partId ? { ...p, [field]: value } : p)),
    }));
  }
  function removePart(partId) {
    updateCase(c.id, prev => ({ ...prev, parts: prev.parts.filter(p => p.id !== partId) }));
  }

  function runGenerator(kind) {
    let text = "";
    let label = "";
    if (kind === "angebot") { text = generateQuoteText(c); label = "Angebotstext"; addHistory(c.id, "Angebotstext generiert"); changeStatus("Angebot gesendet"); }
    if (kind === "termin") { text = generateConfirmationText(c); label = "Terminbestätigung"; addHistory(c.id, "Terminbestätigung generiert"); }
    if (kind === "rueckruf") { text = generateCallbackNote(c); label = "Rückrufnotiz"; addHistory(c.id, "Rückrufnotiz generiert"); }
    setGenText(text);
    setGenLabel(label);
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast("Text in Zwischenablage kopiert."));
    }
  }

  function exportQuote() {
    const text = generateQuoteText(c);
    copyText(text);
    downloadTextFile(`Angebot_${(c.customer.name || "Kunde").replace(/\s+/g, "_")}.txt`, text);
    addHistory(c.id, "Angebotstext exportiert (kopiert & heruntergeladen)");
  }

  const q = calcQuote(c.parts, c.laborRatePerHour, c.discountPercent || 0);
  const missing = vehicleMissingFields(c.vehicle);

  const TABS = [
    { key: "kunde", label: "Kunde", icon: User },
    { key: "fahrzeug", label: "Fahrzeug", icon: Car },
    { key: "termin", label: "Termin", icon: CalendarClock },
    { key: "teile", label: "Teile & Angebot", icon: Wrench },
    { key: "kommunikation", label: "Kommunikation", icon: FileText },
    { key: "verlauf", label: "Verlauf", icon: RotateCcw },
  ];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft size={16} /> Zurück zu Fallakten
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{c.customer.name || "Unbenannter Anrufer"}</h1>
          <p className="text-slate-500 text-sm">{c.vehicle.make} {c.vehicle.model} {c.vehicle.year && `(${c.vehicle.year})`} · angelegt {c.createdAt}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge text={c.urgency} styles={URGENCY_STYLES} />
          <select value={c.status} onChange={e => changeStatus(e.target.value)} className={`text-sm rounded-full border px-3 py-1.5 font-medium ${STATUS_STYLES[c.status]}`}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 ${tab === t.key ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "kunde" && (
        <SectionCard title="Kundendaten" icon={User} accent="blue">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Name"><input className={inputCls} value={c.customer.name} onChange={e => setCustomer("name", e.target.value)} placeholder="optional" /></Field>
            <Field label="Telefon"><input className={inputCls} value={c.customer.phone} onChange={e => setCustomer("phone", e.target.value)} /></Field>
            <Field label="E-Mail"><input className={inputCls} value={c.customer.email} onChange={e => setCustomer("email", e.target.value)} placeholder="optional" /></Field>
          </div>
          <Field label="Anliegen"><textarea className={inputCls} rows={3} value={c.concern} onChange={e => set("concern", e.target.value)} /></Field>

          <h3 className="font-semibold text-slate-700 mt-4 mb-2 text-sm">Notizen</h3>
          <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
            {c.notes.length === 0 && <p className="text-sm text-slate-400">Noch keine Notizen.</p>}
            {c.notes.map(n => (
              <div key={n.id} className="text-sm bg-slate-50 rounded-lg px-3 py-1.5">
                <span>{n.text}</span>
                <span className="block text-xs text-slate-400">{n.timestamp}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Neue Notiz..." value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} />
            <button onClick={addNote} className="bg-slate-800 text-white px-3 rounded-lg text-sm shrink-0">Hinzufügen</button>
          </div>
        </SectionCard>
      )}

      {tab === "fahrzeug" && (
        <SectionCard title="Fahrzeugdaten" icon={Car} accent="orange">
          {missing.length > 0 && (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Fahrzeugdaten unvollständig: {missing.join(", ")}.</span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
            <Field label="Marke"><input className={inputCls} value={c.vehicle.make} onChange={e => setVehicle("make", e.target.value)} /></Field>
            <Field label="Modell"><input className={inputCls} value={c.vehicle.model} onChange={e => setVehicle("model", e.target.value)} /></Field>
            <Field label="Baujahr"><input className={inputCls} value={c.vehicle.year} onChange={e => setVehicle("year", e.target.value)} /></Field>
            <Field label="Kennzeichen"><input className={inputCls} value={c.vehicle.plate} onChange={e => setVehicle("plate", e.target.value)} /></Field>
            <Field label="VIN / Fahrzeug-ID"><input className={inputCls} value={c.vehicle.vin} onChange={e => setVehicle("vin", e.target.value)} /></Field>
            <Field label="Kilometerstand"><input className={inputCls} value={c.vehicle.mileage} onChange={e => setVehicle("mileage", e.target.value)} /></Field>
          </div>
        </SectionCard>
      )}

      {tab === "termin" && (
        <SectionCard title="Termin" icon={CalendarClock} accent="emerald">
          {c.appointment ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4 mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{formatDateDE(c.appointment.date)} um {c.appointment.time} Uhr</p>
                  <p className="text-xs text-slate-400">{weekdayShort(c.appointment.date)}</p>
                </div>
                <Badge text={c.appointment.status} styles={APPT_STATUS_STYLES} />
              </div>
              <p className="text-sm text-slate-600 mb-2">Terminstatus ändern:</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {APPT_STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setApptStatus(c.id, s)}
                    className={`px-3 py-2 rounded-lg text-sm border capitalize ${c.appointment.status === s ? APPT_STATUS_STYLES[s] + " font-semibold" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={() => clearSlot(c.id)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600">
                <Trash2 size={14} /> Termin entfernen
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-500 mb-3">Noch kein Termin eingetragen. Gewünschtes Datum des Kunden: {formatDateDE(c.desiredDate)}.</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Datum"><input type="date" className={inputCls} value={quickDate} onChange={e => setQuickDate(e.target.value)} /></Field>
                <Field label="Uhrzeit">
                  <select className={inputCls} value={quickTime} onChange={e => setQuickTime(e.target.value)}>
                    {DAY_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <button onClick={() => bookAppointment(c.id, quickDate, quickTime)} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2.5 rounded-lg mb-3">
                  Termin eintragen
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {tab === "teile" && (
        <SectionCard title="Teile & Angebot" icon={Wrench} accent="purple">
          {missing.length > 0 && (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Fahrzeugdaten unvollständig ({missing.join(", ")}). Teilesuche und Angebot können ungenau sein. <button onClick={() => setTab("fahrzeug")} className="underline font-medium">Jetzt ergänzen</button></span>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700 text-sm">Teile</h3>
            <button onClick={addPart} className="flex items-center gap-1 text-sm bg-slate-800 text-white px-3 py-1.5 rounded-lg"><Plus size={14} /> Teil hinzufügen</button>
          </div>

          {/* TODO Phase 3: Anbindung an Teilekatalog-API (TecDoc, PartsLink24) */}
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input disabled placeholder="Teilekatalog-Suche (bald verfügbar - Teilekatalog-API Anbindung folgt)" className="w-full pl-9 pr-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
            <button disabled className="text-sm border border-slate-300 text-slate-400 px-3 py-2 rounded-lg cursor-not-allowed shrink-0">Im Katalog suchen</button>
          </div>

          {c.parts.length === 0 ? (
            <EmptyState icon={Wrench} text="Noch keine Teile hinzugefügt." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm mb-4">
                <thead className="text-slate-500 text-left border-b border-slate-200">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Teilename</th>
                    <th className="py-2 pr-2 font-medium">Teilenr.</th>
                    <th className="py-2 pr-2 font-medium">OE-Nr.</th>
                    <th className="py-2 pr-2 font-medium">Lieferant</th>
                    <th className="py-2 pr-2 font-medium">EK (€)</th>
                    <th className="py-2 pr-2 font-medium">VK (€)</th>
                    <th className="py-2 pr-2 font-medium">AZ (h)</th>
                    <th className="py-2 pr-2 font-medium">Menge</th>
                    <th className="py-2 pr-2 font-medium">Zeilensumme</th>
                    <th className="py-2 pr-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {c.parts.map(p => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2"><input className="w-32 border border-slate-200 rounded px-2 py-1" value={p.name} onChange={e => updatePart(p.id, "name", e.target.value)} /></td>
                      <td className="py-1.5 pr-2"><input className="w-24 border border-slate-200 rounded px-2 py-1" value={p.partNumber} onChange={e => updatePart(p.id, "partNumber", e.target.value)} /></td>
                      <td className="py-1.5 pr-2"><input className="w-24 border border-slate-200 rounded px-2 py-1" value={p.oeNumber} onChange={e => updatePart(p.id, "oeNumber", e.target.value)} /></td>
                      <td className="py-1.5 pr-2"><input className="w-28 border border-slate-200 rounded px-2 py-1" value={p.supplier} onChange={e => updatePart(p.id, "supplier", e.target.value)} /></td>
                      <td className="py-1.5 pr-2"><input type="number" className="w-16 border border-slate-200 rounded px-2 py-1" value={p.buyPrice} onChange={e => updatePart(p.id, "buyPrice", parseFloat(e.target.value) || 0)} /></td>
                      <td className="py-1.5 pr-2"><input type="number" className="w-16 border border-slate-200 rounded px-2 py-1" value={p.sellPrice} onChange={e => updatePart(p.id, "sellPrice", parseFloat(e.target.value) || 0)} /></td>
                      <td className="py-1.5 pr-2"><input type="number" step="0.1" className="w-14 border border-slate-200 rounded px-2 py-1" value={p.laborTime} onChange={e => updatePart(p.id, "laborTime", parseFloat(e.target.value) || 0)} /></td>
                      <td className="py-1.5 pr-2"><input type="number" className="w-14 border border-slate-200 rounded px-2 py-1" value={p.qty} onChange={e => updatePart(p.id, "qty", parseInt(e.target.value) || 0)} /></td>
                      <td className="py-1.5 pr-2 font-medium text-slate-600 whitespace-nowrap">{formatCurrency(lineTotal(p, c.laborRatePerHour))}</td>
                      <td className="py-1.5"><button onClick={() => removePart(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Stundensatz (€/h):</label>
              <input type="number" className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" value={c.laborRatePerHour} onChange={e => set("laborRatePerHour", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 flex items-center gap-1"><Percent size={13} /> Rabatt (%):</label>
              <input type="number" min="0" max="100" className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" value={c.discountPercent || 0} onChange={e => set("discountPercent", parseFloat(e.target.value) || 0)} />
            </div>
            <button onClick={() => setShowMargin(v => !v)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 ml-auto">
              {showMargin ? <EyeOff size={14} /> : <Eye size={14} />} {showMargin ? "Interne Kalkulation ausblenden" : "Interne Kalkulation anzeigen"}
            </button>
          </div>

          {showMargin && (
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 max-w-sm ml-auto text-sm space-y-1.5 mb-4">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Nur intern - nicht für Kunden sichtbar</p>
              <div className="flex justify-between"><span className="text-slate-400">Wareneinsatz (EK)</span><span>{formatCurrency(q.buyTotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Marge Teile</span><span>{formatCurrency(q.margin)} ({q.marginPct.toFixed(0)}%)</span></div>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4 max-w-sm ml-auto text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-500">Teile (Zwischensumme)</span><span>{formatCurrency(q.partsSubtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Arbeitskosten ({q.laborHours.toFixed(1)} h)</span><span>{formatCurrency(q.laborCost)}</span></div>
            {(c.discountPercent || 0) > 0 && (
              <div className="flex justify-between text-orange-600"><span>Rabatt ({c.discountPercent}%)</span><span>-{formatCurrency(q.discountAmount)}</span></div>
            )}
            <div className="flex justify-between font-medium border-t border-slate-200 pt-1.5"><span>Netto</span><span>{formatCurrency(q.net)}</span></div>
            <div className="flex justify-between text-slate-500"><span>zzgl. 19% MwSt.</span><span>{formatCurrency(q.tax)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-1.5"><span>Gesamt</span><span>{formatCurrency(q.total)}</span></div>
          </div>

          <div className="flex justify-end mt-3">
            <button onClick={exportQuote} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2.5 rounded-lg text-sm">
              <Download size={16} /> Angebotstext exportieren (kopieren &amp; herunterladen)
            </button>
          </div>
        </SectionCard>
      )}

      {tab === "kommunikation" && (
        <SectionCard title="Kommunikation" icon={FileText} accent="blue">
          <p className="text-sm text-slate-500 mb-4">Texte werden als Entwurf erzeugt - Versand erfolgt aktuell noch manuell durch dich (Telefon/E-Mail).</p>
          <div className="flex flex-wrap gap-3 mb-4">
            <button onClick={() => runGenerator("angebot")} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2.5 rounded-lg text-sm"><FileText size={16} /> Angebotstext generieren</button>
            <button onClick={() => runGenerator("termin")} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-medium px-4 py-2.5 rounded-lg text-sm"><Calendar size={16} /> Terminbestätigung generieren</button>
            <button onClick={() => runGenerator("rueckruf")} className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm"><PhoneCall size={16} /> Rückrufnotiz generieren</button>
          </div>

          {genText ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-600">{genLabel}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => copyText(genText)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-orange-600"><Copy size={13} /> Kopieren</button>
                  <button onClick={() => downloadTextFile(`${genLabel.replace(/\s+/g, "_")}_${(c.customer.name || "Kunde").replace(/\s+/g, "_")}.txt`, genText)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-orange-600"><Download size={13} /> Herunterladen</button>
                </div>
              </div>
              <textarea readOnly className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-64" value={genText} />
            </div>
          ) : (
            <EmptyState icon={FileText} text="Noch kein Text generiert. Wähle oben eine Option." />
          )}
        </SectionCard>
      )}

      {tab === "verlauf" && (
        <SectionCard title="Verlauf" icon={RotateCcw} accent="purple">
          {c.history.length === 0 ? (
            <EmptyState icon={RotateCcw} text="Noch keine Historie vorhanden." />
          ) : (
            <ol className="relative border-l border-slate-200 ml-2">
              {c.history.slice().reverse().map(h => (
                <li key={h.id} className="mb-4 ml-4">
                  <div className="absolute w-2.5 h-2.5 bg-orange-500 rounded-full -left-[5px] mt-1.5" />
                  <p className="text-sm text-slate-700">{h.event}</p>
                  <p className="text-xs text-slate-400">{h.timestamp}</p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ============================================================
   INTEGRATIONSPUNKTE FÜR SPÄTER
   ------------------------------------------------------------
   - Telefonie (Phase 4): CTI/Sipgate/Placetel-Webhook.
   - Kalender (Phase 3): Sync mit Google Calendar / Microsoft 365.
   - Teilekatalog (Phase 3): TecDoc/PartsLink24-API.
   - Lieferantenpreise (Phase 3): Live-Preisabfrage.
   - Claude API (Phase 4): individuellere Text-Generierung.
   ============================================================ */
