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

export function buildDigestText(summary, workshopName = "Kfz-Werkstatt") {
  const k = summary.kpis;
  const lines = [
    `🧱 Zementa – Wochenbericht ${summary.weekLabel}`,
    `${workshopName}`,
    "",
    "📊 Kennzahlen",
    `• Neue Vorgänge: ${k.newCasesCount}`,
    `• Abgeschlossen: ${k.completedCount}`,
    `• Termine angefragt: ${k.appointmentsCount}`,
    `• Angebote erstellt: ${k.quotesCount}`,
    `• Offene Rückrufe: ${k.callbacksCount}`,
    `• Angebotsvolumen: ${formatCurrency(k.totalQuoteValue)}`,
    `• Noch offen gesamt: ${k.openAtWeekEnd}`,
    "",
  ];

  if (summary.topConcerns?.length) {
    lines.push("🔧 Häufigste Anliegen");
    for (const t of summary.topConcerns) {
      lines.push(`• ${t.concern} (${t.count}x)`);
    }
    lines.push("");
  }

  if (summary.activities?.length) {
    lines.push("📋 Letzte Aktivitäten");
    for (const a of summary.activities.slice(0, 10)) {
      const ts = a.timestamp instanceof Date
        ? a.timestamp.toLocaleString("de-DE")
        : (a.timestamp || "");
      lines.push(`• ${ts}: ${a.label}`);
    }
    lines.push("");
  }

  lines.push("—");
  lines.push("Im Dashboard unter „Zementa“ findest du den vollständigen Wochenüberblick.");

  return lines.join("\n");
}

export { formatCurrency, STATUS_OPTIONS };
