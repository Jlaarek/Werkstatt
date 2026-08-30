/** Zementa – wöchentliche Aktivitäts-Auswertung für das Werkstatt-Dashboard */

const STATUS_OPTIONS = ["Neu", "In Prüfung", "Angebot gesendet", "Termin bestätigt", "Abgeschlossen"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Montag 00:00 bis Sonntag 23:59:59 der Kalenderwoche (offsetWeeks: 0 = diese Woche) */
export function getWeekRange(referenceDate = new Date(), offsetWeeks = 0) {
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

export function formatDateDE(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function formatWeekLabel(weekStart, weekEnd) {
  return `${formatDateDE(weekStart)} – ${formatDateDE(weekEnd)}`;
}

/** Parst deutsche Locale-Zeitstempel aus history (z. B. "30.8.2025, 10:30:00") oder ISO */
export function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value !== "string") return null;

  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso);

  const deMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (deMatch) {
    const [, day, month, year, hour, minute, second = "0"] = deMatch;
    return new Date(+year, +month - 1, +day, +hour, +minute, +second);
  }
  return null;
}

function isInRange(date, start, end) {
  if (!date) return false;
  return date >= start && date <= end;
}

function calcQuoteTotal(c) {
  const parts = c.parts || [];
  const rate = Number(c.laborRatePerHour) || 0;
  const discount = Number(c.discountPercent) || 0;
  const partsSub = parts.reduce((s, p) => s + (Number(p.sellPrice) || 0) * (Number(p.qty) || 0), 0);
  const laborH = parts.reduce((s, p) => s + (Number(p.laborTime) || 0) * (Number(p.qty) || 0), 0);
  const net = (partsSub + laborH * rate) * (1 - discount / 100);
  return net * 1.19;
}

function formatCurrency(n) {
  return (Number(n) || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function aggregateWeeklyActivity(cases, weekStartIso, weekEndIso) {
  const { monday, sunday } = getWeekRange(new Date(weekStartIso + "T12:00:00"), 0);

  const activities = [];
  const newCases = [];
  const completedCases = [];
  const appointmentsBooked = [];
  const quotesSent = [];
  const callbacksOpened = [];
  const statusBreakdown = Object.fromEntries(STATUS_OPTIONS.map(s => [s, 0]));

  for (const c of cases) {
    statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1;

    const created = parseTimestamp(c.createdAt) || (c._createdAtIso ? new Date(c._createdAtIso) : null);
    if (created && isInRange(created, monday, sunday)) {
      newCases.push(c);
      activities.push({
        id: `new-${c.id}`,
        type: "new_case",
        timestamp: created,
        label: `Neuer Vorgang: ${c.customer?.name || "Anrufer"}`,
        detail: c.concern || "Kein Anliegen",
        caseId: c.id,
      });
    }

    if (c.callbackRequested) {
      callbacksOpened.push(c);
    }

    for (const h of c.history || []) {
      const ts = parseTimestamp(h.timestamp);
      if (!ts || !isInRange(ts, monday, sunday)) continue;

      activities.push({
        id: h.id || `hist-${c.id}-${h.event}`,
        type: "history",
        timestamp: ts,
        label: h.event,
        detail: `${c.customer?.name || "Anrufer"} · ${c.vehicle?.make || ""} ${c.vehicle?.model || ""}`.trim(),
        caseId: c.id,
      });

      if (h.event.includes("Status geändert: Abgeschlossen") || h.event === "Status geändert: Abgeschlossen") {
        completedCases.push(c);
      }
      if (h.event.includes("Termin am") && h.event.includes("angefragt")) {
        appointmentsBooked.push(c);
      }
      if (h.event.includes("Angebotstext generiert") || h.event.includes("Angebot gesendet")) {
        quotesSent.push(c);
      }
    }
  }

  activities.sort((a, b) => b.timestamp - a.timestamp);

  const uniqueCompleted = [...new Map(completedCases.map(c => [c.id, c])).values()];
  const uniqueQuotes = [...new Map(quotesSent.map(c => [c.id, c])).values()];
  const totalQuoteValue = uniqueQuotes.reduce((s, c) => s + calcQuoteTotal(c), 0);

  const openAtWeekEnd = cases.filter(c => c.status !== "Abgeschlossen").length;

  const concernCounts = {};
  for (const c of newCases) {
    const key = (c.concern || "Sonstiges").slice(0, 60);
    concernCounts[key] = (concernCounts[key] || 0) + 1;
  }
  const topConcerns = Object.entries(concernCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([concern, count]) => ({ concern, count }));

  return {
    weekStart: weekStartIso,
    weekEnd: weekEndIso,
    weekLabel: formatWeekLabel(weekStartIso, weekEndIso),
    kpis: {
      newCasesCount: newCases.length,
      completedCount: uniqueCompleted.length,
      appointmentsCount: appointmentsBooked.length,
      quotesCount: uniqueQuotes.length,
      callbacksCount: callbacksOpened.length,
      totalQuoteValue,
      openAtWeekEnd,
      activityCount: activities.length,
    },
    statusBreakdown,
    topConcerns,
    activities: activities.slice(0, 100),
    highlights: {
      newCases: newCases.slice(0, 8).map(c => ({
        id: c.id,
        name: c.customer?.name || "Anrufer",
        concern: c.concern,
        status: c.status,
      })),
      completed: uniqueCompleted.slice(0, 8).map(c => ({
        id: c.id,
        name: c.customer?.name || "Anrufer",
        vehicle: `${c.vehicle?.make || ""} ${c.vehicle?.model || ""}`.trim(),
      })),
    },
  };
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function weekIntro(k) {
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

function focusHint(k) {
  const hints = [];
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

/** Persönlicher Wochenbrief von Zementa (Klartext) */
export function buildDigestText(summary, workshopName = "Kfz-Werkstatt", recipientName = "Johann") {
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

  if (summary.topConcerns?.length) {
    lines.push("", "─── Was die Kunden beschäftigt hat ───");
    for (const t of summary.topConcerns) {
      lines.push(`• ${t.concern} (${t.count}×)`);
    }
  }

  if (summary.activities?.length) {
    lines.push("", "─── Die wichtigsten Momente ───");
    for (const a of summary.activities.slice(0, 8)) {
      const ts = a.timestamp instanceof Date
        ? a.timestamp.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : (a.timestamp || "");
      lines.push(`• ${ts} – ${a.label}`);
    }
  }

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

/** HTML-Version des Wochenbriefs */
export function buildDigestHtml(summary, workshopName = "Kfz-Werkstatt", recipientName = "Johann") {
  const k = summary.kpis;
  const tip = focusHint(k).trim();

  const kpiRow = (label, value) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#475569;font-size:14px;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;

  let concernsHtml = "";
  if (summary.topConcerns?.length) {
    concernsHtml = `
      <h2 style="margin:28px 0 12px;font-size:15px;color:#0f172a;">Was die Kunden beschäftigt hat</h2>
      <ul style="margin:0;padding-left:18px;color:#334155;font-size:14px;line-height:1.7;">
        ${summary.topConcerns.map(t => `<li>${t.concern} <span style="color:#94a3b8;">(${t.count}×)</span></li>`).join("")}
      </ul>`;
  }

  let activitiesHtml = "";
  if (summary.activities?.length) {
    activitiesHtml = `
      <h2 style="margin:28px 0 12px;font-size:15px;color:#0f172a;">Die wichtigsten Momente</h2>
      <ul style="margin:0;padding:0;list-style:none;">
        ${summary.activities.slice(0, 8).map(a => {
          const ts = a.timestamp instanceof Date
            ? a.timestamp.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "";
          return `<li style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">
            <span style="color:#94a3b8;font-size:12px;">${ts}</span><br/>${a.label}
          </li>`;
        }).join("")}
      </ul>`;
  }

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

      ${concernsHtml}
      ${activitiesHtml}

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

export function buildDigestSubject(summary, workshopName = "Kfz-Werkstatt") {
  const k = summary.kpis;
  if (k.newCasesCount === 0 && k.completedCount === 0) {
    return `Zementa · Ruhige Woche bei ${workshopName} (${summary.weekLabel})`;
  }
  return `Zementa · Deine Woche: ${k.newCasesCount} neu, ${k.completedCount} erledigt (${summary.weekLabel})`;
}

export { formatCurrency, STATUS_OPTIONS };
