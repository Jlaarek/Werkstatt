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

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function weekIntro(k: { newCasesCount: number; completedCount: number; activityCount: number }) {
  if (k.newCasesCount === 0 && k.completedCount === 0 && k.activityCount === 0) {
    return "Diese Woche war es ruhig bei euch – keine großen Bewegungen in den Vorgängen. Manchmal ist genau das die beste Nachricht.";
  }
  if (k.completedCount > 0 && k.newCasesCount > 0) {
    return `Eine produktive Woche liegt hinter euch: ${plural(k.newCasesCount, "neuer Vorgang", "neue Vorgänge")} rein, ${plural(k.completedCount, "Fall", "Fälle")} abgeschlossen. Der Laden läuft.`;
  }
  if (k.newCasesCount > 3) {
    return `Es war eine lebhafte Woche – ${plural(k.newCasesCount, "neuer Vorgang ist", "neue Vorgänge sind")} reingekommen. Gut, dass ihr den Überblick behaltet.`;
  }
  if (k.completedCount > 0) {
    return `Diese Woche konntet ihr ${plural(k.completedCount, "Vorgang", "Vorgänge")} sauber abschließen. Das zählt.`;
  }
  return "Hier ist euer kompakter Wochenüberblick – alles Wichtige auf einen Blick.";
}

function focusHint(k: { callbacksCount: number; openAtWeekEnd: number; quotesCount: number; completedCount: number }) {
  const hints: string[] = [];
  if (k.callbacksCount > 0) {
    hints.push(`${plural(k.callbacksCount, "offener Rückruf wartet", "offene Rückrufe warten")} noch – lohnt sich, das früh am Wochenbeginn anzugehen`);
  }
  if (k.openAtWeekEnd > 5) {
    hints.push(`mit ${k.openAtWeekEnd} offenen Vorgängen lohnt ein kurzer Blick auf die Prioritäten`);
  }
  if (k.quotesCount > 0 && k.completedCount === 0) {
    hints.push("Angebote sind raus – die Nachverfolgung entscheidet oft über den Auftrag");
  }
  if (hints.length === 0) return "";
  return `\n\nMein Tipp für die kommende Woche: ${hints.join("; ")}.`;
}

function buildDigestText(
  summary: ReturnType<typeof aggregateWeeklyActivity>,
  workshopName: string,
  recipientName: string,
) {
  const k = summary.kpis;
  const lines = [
    `Hallo ${recipientName},`,
    "",
    weekIntro(k),
    "",
    `Wochenbericht für ${workshopName}`,
    `Zeitraum: ${summary.weekLabel}`,
    "",
    "─── Kurzüberblick ───",
    `Neue Vorgänge:        ${k.newCasesCount}`,
    `Abgeschlossen:        ${k.completedCount}`,
    `Termine angefragt:    ${k.appointmentsCount}`,
    `Angebote erstellt:    ${k.quotesCount}`,
    `Angebotsvolumen:      ${formatCurrency(k.totalQuoteValue)}`,
    `Offene Rückrufe:      ${k.callbacksCount}`,
    `Noch offen gesamt:    ${k.openAtWeekEnd}`,
  ];

  const tip = focusHint(k);
  if (tip) lines.push(tip.trimStart());

  lines.push(
    "",
    "Den vollständigen Überblick mit Timeline und Archiv findest du jederzeit im Dashboard unter „Zementa“.",
    "",
    "Einen guten Start in die neue Woche –",
    "Zementa",
    `dein Wochenüberblick für ${workshopName}`,
  );
  return lines.join("\n");
}

function buildDigestHtml(
  summary: ReturnType<typeof aggregateWeeklyActivity>,
  workshopName: string,
  recipientName: string,
) {
  const k = summary.kpis;
  const tip = focusHint(k).trim();
  const kpiRow = (label: string, value: string | number) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#475569;font-size:14px;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#ea580c;font-family:system-ui,sans-serif;font-weight:600;">Zementa</p>
      <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:700;">Dein Wochenbericht</h1>
      <p style="margin:0 0 24px;font-size:13px;color:#64748b;font-family:system-ui,sans-serif;">${workshopName} · ${summary.weekLabel}</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1e293b;">Hallo ${recipientName},</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#1e293b;">${weekIntro(k)}</p>
      <table style="width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;">
        ${kpiRow("Neue Vorgänge", k.newCasesCount)}
        ${kpiRow("Abgeschlossen", k.completedCount)}
        ${kpiRow("Termine angefragt", k.appointmentsCount)}
        ${kpiRow("Angebote erstellt", k.quotesCount)}
        ${kpiRow("Angebotsvolumen", formatCurrency(k.totalQuoteValue))}
        ${kpiRow("Offene Rückrufe", k.callbacksCount)}
        ${kpiRow("Noch offen gesamt", k.openAtWeekEnd)}
      </table>
      ${tip ? `<p style="margin:28px 0 0;padding:16px;background:#fff7ed;border-left:3px solid #ea580c;font-size:14px;line-height:1.6;color:#9a3412;font-family:system-ui,sans-serif;">${tip.replace(/^Mein Tipp/, "<strong>Mein Tipp</strong>")}</p>` : ""}
      <p style="margin:32px 0 0;font-size:15px;line-height:1.6;color:#1e293b;">
        Den vollständigen Überblick findest du jederzeit im Dashboard unter „Zementa“.
      </p>
      <p style="margin:24px 0 0;font-size:15px;line-height:1.5;color:#1e293b;">
        Einen guten Start in die neue Woche –<br/>
        <strong>Zementa</strong><br/>
        <span style="font-size:13px;color:#64748b;">dein Wochenüberblick für ${workshopName}</span>
      </p>
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#94a3b8;font-family:system-ui,sans-serif;">
      Diese Nachricht kommt von Zementa aus deiner Werkstatt-App – nicht von Cursor.
    </p>
  </div>
</body>
</html>`;
}

function buildDigestSubject(summary: ReturnType<typeof aggregateWeeklyActivity>, workshopName: string) {
  const k = summary.kpis;
  if (k.newCasesCount === 0 && k.completedCount === 0) {
    return `Zementa · Ruhige Woche bei ${workshopName} (${summary.weekLabel})`;
  }
  return `Zementa · Deine Woche: ${k.newCasesCount} neu, ${k.completedCount} erledigt (${summary.weekLabel})`;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string;
  senderName: string;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return { sent: false, reason: "RESEND_API_KEY nicht konfiguriert" };
  }

  // Technischer Absender (verifizierte Domain bei Resend). Anzeige + Reply-To = deine E-Mail.
  const deliveryFrom = Deno.env.get("ZEMENTA_FROM_EMAIL") || "Zementa <onboarding@resend.dev>";
  const displayName = opts.senderName || "Zementa";
  // Wenn ZEMENTA_FROM_EMAIL schon "Name <mail>" enthält, Name überschreiben
  const from = deliveryFrom.includes("<")
    ? deliveryFrom.replace(/^[^<]+/, `${displayName} `)
    : `${displayName} <${deliveryFrom}>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      reply_to: opts.replyTo || opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    }),
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
    const recipientName = settings?.recipient_name || "Johann";
    const digest = buildDigestText(summary, workshopName, recipientName);
    const digestHtml = buildDigestHtml(summary, workshopName, recipientName);
    const subject = buildDigestSubject(summary, workshopName);

    const { error: upsertError } = await supabase.from("zementa_reports").upsert({
      week_start: week.weekStart,
      week_end: week.weekEnd,
      summary,
    }, { onConflict: "week_start" });

    if (upsertError) throw upsertError;

    let emailResult: { sent: boolean; reason?: string } = { sent: false, reason: "Keine E-Mail konfiguriert" };
    const recipient = (settings?.notification_email || "lazarek.johann@gmail.com").trim();
    const replyTo = (settings?.sender_email || settings?.notification_email || recipient).trim();
    const senderName = settings?.sender_name || "Zementa";

    if (recipient && (mode === "cron" || mode === "test")) {
      emailResult = await sendEmail({
        to: recipient,
        subject,
        text: digest,
        html: digestHtml,
        replyTo,
        senderName,
      });
      if (emailResult.sent) {
        await supabase.from("zementa_reports")
          .update({ notification_sent_at: new Date().toISOString() })
          .eq("week_start", week.weekStart);
      }
    }

    return new Response(JSON.stringify({
      message: emailResult.sent
        ? `Wochenbericht ${summary.weekLabel} an ${recipient} gesendet (Reply-To: ${replyTo})`
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
