"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bot, Calendar, CheckCircle2, ClipboardList, FileText, PhoneCall,
  AlertTriangle, Activity, ChevronLeft, ChevronRight, Mail, Send,
  RefreshCw, BarChart3, Sparkles
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  aggregateWeeklyActivity,
  buildDigestText,
  formatCurrency,
  formatDateDE,
  formatWeekLabel,
  getWeekRange,
  STATUS_OPTIONS,
} from "../lib/zementa";

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function KpiTile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusBars({ breakdown }) {
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0) || 1;
  const colors = {
    "Neu": "bg-blue-500",
    "In Prüfung": "bg-amber-500",
    "Angebot gesendet": "bg-purple-500",
    "Termin bestätigt": "bg-emerald-500",
    "Abgeschlossen": "bg-slate-400",
  };

  return (
    <div className="space-y-3">
      {STATUS_OPTIONS.map(status => {
        const count = breakdown[status] || 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={status}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">{status}</span>
              <span className="text-slate-500">{count} ({pct}%)</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${colors[status] || "bg-slate-400"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ZementaView({ cases, openCase, showToast }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [savedReports, setSavedReports] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    notification_email: "",
    notify_day: 1,
    notify_hour: 8,
    enabled: true,
    workshop_name: "Kfz-Werkstatt",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const weekRange = useMemo(() => getWeekRange(new Date(), weekOffset), [weekOffset]);

  const enrichedCases = useMemo(
    () => cases.map(c => ({ ...c, _createdAtIso: c._createdAtIso })),
    [cases]
  );

  const summary = useMemo(
    () => aggregateWeeklyActivity(enrichedCases, weekRange.weekStart, weekRange.weekEnd),
    [enrichedCases, weekRange]
  );

  const savedReport = savedReports.find(r => r.week_start === weekRange.weekStart);

  async function loadMeta() {
    setLoading(true);
    const [reportsRes, settingsRes] = await Promise.all([
      supabase.from("zementa_reports").select("*").order("week_start", { ascending: false }).limit(12),
      supabase.from("zementa_settings").select("*").limit(1).maybeSingle(),
    ]);

    if (!reportsRes.error) setSavedReports(reportsRes.data || []);
    if (!settingsRes.error && settingsRes.data) {
      setSettings(settingsRes.data);
      setSettingsForm({
        notification_email: settingsRes.data.notification_email || "",
        notify_day: settingsRes.data.notify_day ?? 1,
        notify_hour: settingsRes.data.notify_hour ?? 8,
        enabled: settingsRes.data.enabled ?? true,
        workshop_name: settingsRes.data.workshop_name || "Kfz-Werkstatt",
      });
    }
    setLoading(false);
  }

  useEffect(() => { loadMeta(); }, []);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...settingsForm,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (settings?.id) {
      ({ error } = await supabase.from("zementa_settings").update(payload).eq("id", settings.id));
    } else {
      ({ error } = await supabase.from("zementa_settings").insert(payload));
    }

    setSaving(false);
    if (error) {
      showToast(`Einstellungen konnten nicht gespeichert werden: ${error.message}`);
      return;
    }
    showToast("Zementa-Einstellungen gespeichert.");
    loadMeta();
  }

  async function saveWeeklyReport(markNotified = false) {
    const row = {
      week_start: summary.weekStart,
      week_end: summary.weekEnd,
      summary,
      ...(markNotified ? { notification_sent_at: new Date().toISOString() } : {}),
    };

    const { error } = await supabase.from("zementa_reports").upsert(row, { onConflict: "week_start" });
    if (error) throw new Error(error.message);
    await loadMeta();
  }

  async function generateReport() {
    setGenerating(true);
    try {
      await saveWeeklyReport(false);
      showToast("Wochenbericht gespeichert.");
    } catch (err) {
      showToast(err.message || "Bericht konnte nicht gespeichert werden.");
    }
    setGenerating(false);
  }

  async function sendTestNotification() {
    if (!settingsForm.notification_email?.trim()) {
      showToast("Bitte zuerst eine E-Mail-Adresse in den Einstellungen hinterlegen.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("zementa-weekly", {
        body: { mode: "test", weekStart: summary.weekStart },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showToast(data?.message || "Test-Benachrichtigung gesendet.");
      await loadMeta();
    } catch (err) {
      showToast(`Benachrichtigung fehlgeschlagen: ${err.message}. Edge Function deployen? (siehe README)`);
    }
    setGenerating(false);
  }

  const digestPreview = buildDigestText(summary, settingsForm.workshop_name);

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg shrink-0">
            <Bot size={28} className="text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">Zementa</h1>
              <span className="text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
                Wöchentlicher Bot
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Dein wöchentlicher Überblick über alle Werkstatt-Aktivitäten – als Dashboard und per E-Mail-Benachrichtigung.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[180px]">
            <p className="text-sm font-semibold text-slate-800">{formatWeekLabel(weekRange.weekStart, weekRange.weekEnd)}</p>
            <p className="text-xs text-slate-400">
              {weekOffset === 0 ? "Aktuelle Woche" : weekOffset === -1 ? "Letzte Woche" : `${Math.abs(weekOffset)} Wochen zurück`}
            </p>
          </div>
          <button
            onClick={() => setWeekOffset(o => Math.min(o + 1, 0))}
            disabled={weekOffset >= 0}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30"
            aria-label="Nächste Woche"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {savedReport?.notification_sent_at && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          <CheckCircle2 size={16} />
          Benachrichtigung gesendet am {formatDateDE(savedReport.notification_sent_at.slice(0, 10))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiTile icon={ClipboardList} label="Neue Vorgänge" value={summary.kpis.newCasesCount} accent="bg-blue-600" />
        <KpiTile icon={CheckCircle2} label="Abgeschlossen" value={summary.kpis.completedCount} accent="bg-emerald-600" />
        <KpiTile icon={Calendar} label="Termine" value={summary.kpis.appointmentsCount} accent="bg-indigo-600" />
        <KpiTile icon={FileText} label="Angebote" value={summary.kpis.quotesCount} sub={formatCurrency(summary.kpis.totalQuoteValue)} accent="bg-purple-600" />
        <KpiTile icon={PhoneCall} label="Rückrufe offen" value={summary.kpis.callbacksCount} accent="bg-teal-600" />
        <KpiTile icon={Activity} label="Aktivitäten" value={summary.kpis.activityCount} accent="bg-orange-500" />
        <KpiTile icon={AlertTriangle} label="Noch offen" value={summary.kpis.openAtWeekEnd} accent="bg-slate-600" />
        <KpiTile icon={Sparkles} label="Berichte archiviert" value={savedReports.length} accent="bg-slate-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-orange-500" />
            <h2 className="font-semibold text-sm text-slate-700">Aktivitäten diese Woche</h2>
          </div>
          {summary.activities.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-8 text-center">In dieser Woche wurden noch keine Aktivitäten erfasst.</p>
          ) : (
            <ol className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {summary.activities.map(a => (
                <li key={a.id}>
                  <button
                    onClick={() => openCase(a.caseId)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex gap-3 items-start"
                  >
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{a.label}</p>
                      <p className="text-xs text-slate-400 truncate">{a.detail}</p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {a.timestamp instanceof Date ? a.timestamp.toLocaleString("de-DE") : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-orange-500" />
              <h2 className="font-semibold text-sm text-slate-700">Status-Verteilung (gesamt)</h2>
            </div>
            <StatusBars breakdown={summary.statusBreakdown} />
          </div>

          {summary.topConcerns.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-semibold text-sm text-slate-700 mb-3">Top-Anliegen (neu diese Woche)</h2>
              <ul className="space-y-2">
                {summary.topConcerns.map(t => (
                  <li key={t.concern} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate pr-2">{t.concern}</span>
                    <span className="text-slate-400 shrink-0">{t.count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail size={16} className="text-orange-500" />
            <h2 className="font-semibold text-sm text-slate-700">Benachrichtigungs-Vorschau</h2>
          </div>
          <pre className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
            {digestPreview}
          </pre>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={generateReport}
              disabled={generating}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
              Bericht speichern
            </button>
            <button
              onClick={sendTestNotification}
              disabled={generating}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
            >
              <Send size={14} /> Test senden
            </button>
          </div>
        </div>

        <form onSubmit={saveSettings} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} className="text-orange-500" />
            <h2 className="font-semibold text-sm text-slate-700">Zementa-Einstellungen</h2>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Lade...</p>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500">Werkstatt-Name</span>
                <input
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={settingsForm.workshop_name}
                  onChange={e => setSettingsForm(f => ({ ...f, workshop_name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">E-Mail für Wochenbericht</span>
                <input
                  type="email"
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="leitung@werkstatt.de"
                  value={settingsForm.notification_email}
                  onChange={e => setSettingsForm(f => ({ ...f, notification_email: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500">Wochentag</span>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={settingsForm.notify_day}
                    onChange={e => setSettingsForm(f => ({ ...f, notify_day: +e.target.value }))}
                  >
                    {DAY_NAMES.map((name, i) => (
                      <option key={name} value={i}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Uhrzeit</span>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={settingsForm.notify_hour}
                    onChange={e => setSettingsForm(f => ({ ...f, notify_hour: +e.target.value }))}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00 Uhr</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={settingsForm.enabled}
                  onChange={e => setSettingsForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                Wöchentliche Benachrichtigung aktiv
              </label>
              <p className="text-xs text-slate-400">
                Standard: jeden {DAY_NAMES[settingsForm.notify_day]} um {String(settingsForm.notify_hour).padStart(2, "0")}:00 Uhr.
                Der automatische Versand läuft über die Supabase Edge Function + GitHub Actions (siehe README).
              </p>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-60"
              >
                {saving ? "Speichern..." : "Einstellungen speichern"}
              </button>
            </div>
          )}
        </form>
      </div>

      {savedReports.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-sm text-slate-700">Archivierte Wochenberichte</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {savedReports.map(r => (
              <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <button
                  onClick={() => {
                    const offset = Math.round((new Date(r.week_start) - getWeekRange(new Date()).monday) / (7 * 86400000));
                    setWeekOffset(offset);
                  }}
                  className="text-left hover:text-orange-600"
                >
                  {formatWeekLabel(r.week_start, r.week_end)}
                </button>
                <span className="text-slate-400 text-xs shrink-0">
                  {r.summary?.kpis?.newCasesCount ?? "?"} neue · {r.summary?.kpis?.completedCount ?? "?"} erledigt
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
