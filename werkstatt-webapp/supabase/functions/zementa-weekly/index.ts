import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STATUS_OPTIONS = ["Neu", "In Prüfung", "Angebot gesendet", "Termin bestätigt", "Abgeschlossen"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getWeekRange(referenceDate = new Date(), offsetWeeks = 0) {
  const d = new Date(referenceDate);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetWeeks * 7);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { weekStart: toIsoDate(monday), weekEnd: toIsoDate(sunday), monday, sunday };
}

function parseTimestamp(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso);
  const deMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (deMatch) {
    const [, day, month, year, hour, minute, second = "0"] = deMatch;
    return new Date(+year, +month - 1, +day, +hour, +minute, +second);
  }
  return null;
}

function isInRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function calcQuoteTotal(c: Record<string, unknown>) {
  const parts = (c.parts as Array<Record<string, unknown>>) || [];
  const rate = Number(c.labor_rate_per_hour) || 0;
  const discount = Number(c.discount_percent) || 0;
  const partsSub = parts.reduce((s, p) => s + (Number(p.sellPrice) || 0) * (Number(p.qty) || 0), 0);
  const laborH = parts.reduce((s, p) => s + (Number(p.laborTime) || 0) * (Number(p.qty) || 0), 0);
  const net = (partsSub + laborH * rate) * (1 - discount / 100);
  return net * 1.19;
}

function formatCurrency(n: number) {
  return (Number(n) || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDateDE(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function aggregateWeeklyActivity(cases: Array<Record<string, unknown>>, weekStartIso: string, weekEndIso: string) {
  const { monday, sunday } = getWeekRange(new Date(weekStartIso + "T12:00:00"), 0);
  const activities: Array<Record<string, unknown>> = [];
  const newCases: Array<Record<string, unknown>> = [];
  const completedCases: Array<Record<string, unknown>> = [];
  const appointmentsBooked: Array<Record<string, unknown>> = [];
  const quotesSent: Array<Record<string, unknown>> = [];
  const statusBreakdown: Record<string, number> = Object.fromEntries(STATUS_OPTIONS.map(s => [s, 0]));

  for (const c of cases) {
    const status = String(c.status || "Neu");
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    const customer = (c.customer as Record<string, string>) || {};
    const vehicle = (c.vehicle as Record<string, string>) || {};

    const created = parseTimestamp(c.created_at as string);
    if (created && isInRange(created, monday, sunday)) {
      newCases.push(c);
      activities.push({
        id: `new-${c.id}`,
        timestamp: created.toISOString(),
        label: `Neuer Vorgang: ${customer.name || "Anrufer"}`,
        caseId: c.id,
      });
    }

    const history = (c.history as Array<Record<string, string>>) || [];
    for (const h of history) {
      const ts = parseTimestamp(h.timestamp);
      if (!ts || !isInRange(ts, monday, sunday)) continue;
      activities.push({
        id: h.id || `hist-${c.id}`,
        timestamp: ts.toISOString(),
        label: h.event,
        caseId: c.id,
      });
      if (h.event?.includes("Status geändert: Abgeschlossen")) completedCases.push(c);
      if (h.event?.includes("Termin am") && h.event?.includes("angefragt")) appointmentsBooked.push(c);
      if (h.event?.includes("Angebotstext generiert")) quotesSent.push(c);
    }
  }

  activities.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  const uniqueQuotes = [...new Map(quotesSent.map(c => [c.id, c])).values()];
  const totalQuoteValue = uniqueQuotes.reduce((s, c) => s + calcQuoteTotal(c), 0);
  const openAtWeekEnd = cases.filter(c => c.status !== "Abgeschlossen").length;

  return {
    weekStart: weekStartIso,
    weekEnd: weekEndIso,
    weekLabel: `${formatDateDE(weekStartIso)} – ${formatDateDE(weekEndIso)}`,
    kpis: {
      newCasesCount: newCases.length,
      completedCount: [...new Map(completedCases.map(c => [c.id, c])).values()].length,
      appointmentsCount: appointmentsBooked.length,
      quotesCount: uniqueQuotes.length,
      callbacksCount: cases.filter(c => c.callback_requested).length,
      totalQuoteValue,
      openAtWeekEnd,
      activityCount: activities.length,
    },
    statusBreakdown,
    activities: activities.slice(0, 50),
  };
}

function buildDigestText(summary: ReturnType<typeof aggregateWeeklyActivity>, workshopName: string) {
  const k = summary.kpis;
  const lines = [
    `Zementa – Wochenbericht ${summary.weekLabel}`,
    workshopName,
    "",
    "Kennzahlen:",
    `- Neue Vorgänge: ${k.newCasesCount}`,
    `- Abgeschlossen: ${k.completedCount}`,
    `- Termine angefragt: ${k.appointmentsCount}`,
    `- Angebote erstellt: ${k.quotesCount}`,
    `- Offene Rückrufe: ${k.callbacksCount}`,
    `- Angebotsvolumen: ${formatCurrency(k.totalQuoteValue)}`,
    `- Noch offen gesamt: ${k.openAtWeekEnd}`,
    "",
    "Im Dashboard unter Zementa findest du den vollständigen Wochenüberblick.",
  ];
  return lines.join("\n");
}

async function sendEmail(to: string, subject: string, text: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return { sent: false, reason: "RESEND_API_KEY nicht konfiguriert" };
  }
  const from = Deno.env.get("ZEMENTA_FROM_EMAIL") || "Zementa <zementa@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`E-Mail-Versand fehlgeschlagen: ${err}`);
  }
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zementa-secret",
      },
    });
  }

  try {
    const cronSecret = Deno.env.get("ZEMENTA_CRON_SECRET");
    const headerSecret = req.headers.get("x-zementa-secret");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || "cron";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await supabase.from("zementa_settings").select("*").limit(1);
    const settings = settingsRows?.[0];

    if (mode === "cron") {
      if (cronSecret && headerSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      if (settings && !settings.enabled) {
        return new Response(JSON.stringify({ message: "Zementa deaktiviert" }), { status: 200 });
      }
      const now = new Date();
      if (settings) {
        const dayMatch = now.getDay() === Number(settings.notify_day);
        const hourMatch = now.getHours() === Number(settings.notify_hour);
        if (!dayMatch || !hourMatch) {
          return new Response(JSON.stringify({ message: "Nicht der konfigurierte Zeitpunkt" }), { status: 200 });
        }
      }
    }

    const weekOffset = mode === "test" && body.weekStart
      ? Math.round((new Date(body.weekStart + "T12:00:00").getTime() - getWeekRange(new Date()).monday.getTime()) / (7 * 86400000))
      : -1;

    const week = getWeekRange(new Date(), weekOffset);

    const { data: cases, error: casesError } = await supabase.from("cases").select("*");
    if (casesError) throw casesError;

    const summary = aggregateWeeklyActivity(cases || [], week.weekStart, week.weekEnd);
    const workshopName = settings?.workshop_name || "Kfz-Werkstatt";
    const digest = buildDigestText(summary, workshopName);

    const { error: upsertError } = await supabase.from("zementa_reports").upsert({
      week_start: week.weekStart,
      week_end: week.weekEnd,
      summary,
    }, { onConflict: "week_start" });

    if (upsertError) throw upsertError;

    let emailResult = { sent: false, reason: "Keine E-Mail konfiguriert" };
    const recipient = settings?.notification_email?.trim();
    if (recipient && (mode === "cron" || mode === "test")) {
      emailResult = await sendEmail(
        recipient,
        `Zementa Wochenbericht ${summary.weekLabel}`,
        digest,
      );
      if (emailResult.sent) {
        await supabase.from("zementa_reports")
          .update({ notification_sent_at: new Date().toISOString() })
          .eq("week_start", week.weekStart);
      }
    }

    return new Response(JSON.stringify({
      message: emailResult.sent
        ? `Wochenbericht ${summary.weekLabel} gesendet an ${recipient}`
        : `Wochenbericht ${summary.weekLabel} gespeichert (${emailResult.reason || "ohne E-Mail"})`,
      summary: summary.kpis,
      email: emailResult,
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
