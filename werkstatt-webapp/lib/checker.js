/** Checker – prüft und bewertet Workflow-Schritte aller Vorgänge, arbeitet mit Zementa zusammen */

import { parseTimestamp, STATUS_OPTIONS } from "./zementa";

export const WORKFLOW_STEPS = [
  { key: "intake", label: "Anlage", description: "Vorgang mit Kundendaten angelegt" },
  { key: "review", label: "Prüfung", description: "Anliegen geprüft / Termin angefragt" },
  { key: "quote", label: "Angebot", description: "Angebot erstellt und versendet" },
  { key: "appointment", label: "Termin", description: "Termin bestätigt" },
  { key: "completion", label: "Abschluss", description: "Vorgang abgeschlossen" },
];

const STATUS_INDEX = Object.fromEntries(STATUS_OPTIONS.map((s, i) => [s, i]));

const STEP_STATUS = {
  OK: "ok",
  WARNING: "warning",
  MISSING: "missing",
  SKIPPED: "skipped",
  NOT_APPLICABLE: "na",
};

const STUCK_DAYS = {
  Neu: 3,
  "In Prüfung": 7,
  "Angebot gesendet": 14,
  "Termin bestätigt": 7,
};

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function historyHas(c, pattern) {
  return (c.history || []).some(h => {
    const event = h.event || "";
    return typeof pattern === "string" ? event.includes(pattern) : pattern.test(event);
  });
}

function getStatusHistory(c) {
  return (c.history || [])
    .filter(h => (h.event || "").startsWith("Status geändert:"))
    .map(h => ({
      status: h.event.replace("Status geändert:", "").trim(),
      timestamp: parseTimestamp(h.timestamp),
    }));
}

function checkIntake(c) {
  const issues = [];
  const customer = c.customer || {};
  const vehicle = c.vehicle || {};

  if (!customer.name?.trim()) issues.push({ severity: "warning", text: "Kein Kundenname hinterlegt" });
  if (!c.concern?.trim()) issues.push({ severity: "warning", text: "Kein Anliegen erfasst" });
  if (!vehicle.make?.trim() && !vehicle.model?.trim()) {
    issues.push({ severity: "info", text: "Fahrzeugdaten unvollständig" });
  }

  const status = issues.some(i => i.severity === "warning") ? STEP_STATUS.WARNING : STEP_STATUS.OK;
  return { key: "intake", status, issues };
}

function checkReview(c) {
  const issues = [];
  const statusIdx = STATUS_INDEX[c.status] ?? 0;

  if (statusIdx === 0 && !historyHas(c, "Termin am")) {
    const created = parseTimestamp(c.createdAt);
    const stuck = daysSince(created);
    if (stuck !== null && stuck >= STUCK_DAYS.Neu) {
      issues.push({ severity: "error", text: `Seit ${stuck} Tagen unbearbeitet (Status: Neu)` });
      return { key: "review", status: STEP_STATUS.MISSING, issues };
    }
    if (statusIdx === 0) {
      return { key: "review", status: STEP_STATUS.MISSING, issues: [{ severity: "info", text: "Prüfung noch ausstehend" }] };
    }
  }

  const hasReview = statusIdx >= 1 || historyHas(c, "Termin am") || historyHas(c, "Status geändert: In Prüfung");
  if (!hasReview) {
    issues.push({ severity: "warning", text: "Kein Prüfungsschritt dokumentiert" });
    return { key: "review", status: STEP_STATUS.MISSING, issues };
  }

  if (c.status === "In Prüfung") {
    const lastChange = getStatusHistory(c).filter(h => h.status === "In Prüfung").pop();
    const ref = lastChange?.timestamp || parseTimestamp(c.createdAt);
    const stuck = daysSince(ref);
    if (stuck !== null && stuck >= STUCK_DAYS["In Prüfung"]) {
      issues.push({ severity: "warning", text: `${stuck} Tage in Prüfung ohne Fortschritt` });
    }
  }

  return { key: "review", status: issues.length ? STEP_STATUS.WARNING : STEP_STATUS.OK, issues };
}

function checkQuote(c) {
  const statusIdx = STATUS_INDEX[c.status] ?? 0;
  const hasQuote = historyHas(c, "Angebotstext generiert") || statusIdx >= 2;

  if (statusIdx >= 2 && !hasQuote) {
    return {
      key: "quote",
      status: STEP_STATUS.WARNING,
      issues: [{ severity: "warning", text: "Status „Angebot gesendet“, aber kein Angebot in Historie" }],
    };
  }

  if (!hasQuote) {
    if (statusIdx >= 3) {
      return { key: "quote", status: STEP_STATUS.SKIPPED, issues: [{ severity: "info", text: "Angebot übersprungen" }] };
    }
    return { key: "quote", status: STEP_STATUS.MISSING, issues: [{ severity: "info", text: "Noch kein Angebot erstellt" }] };
  }

  const issues = [];
  if (c.status === "Angebot gesendet") {
    const lastChange = getStatusHistory(c).filter(h => h.status === "Angebot gesendet").pop();
    const ref = lastChange?.timestamp;
    const stuck = daysSince(ref);
    if (stuck !== null && stuck >= STUCK_DAYS["Angebot gesendet"]) {
      issues.push({ severity: "warning", text: `${stuck} Tage ohne Rückmeldung auf Angebot` });
    }
  }

  return { key: "quote", status: issues.length ? STEP_STATUS.WARNING : STEP_STATUS.OK, issues };
}

function checkAppointment(c) {
  const statusIdx = STATUS_INDEX[c.status] ?? 0;
  const appt = c.appointment;
  const hasApptRequest = historyHas(c, /Termin am.*angefragt/);
  const hasApptConfirmed = appt?.status === "bestätigt" || statusIdx >= 3;

  if (statusIdx >= 3 && !hasApptConfirmed && !appt) {
    return {
      key: "appointment",
      status: STEP_STATUS.WARNING,
      issues: [{ severity: "warning", text: "Status „Termin bestätigt“, aber kein Termin hinterlegt" }],
    };
  }

  if (!hasApptRequest && !appt) {
    if (statusIdx >= 4) {
      return { key: "appointment", status: STEP_STATUS.SKIPPED, issues: [] };
    }
    return { key: "appointment", status: STEP_STATUS.MISSING, issues: [{ severity: "info", text: "Noch kein Termin angefragt" }] };
  }

  const issues = [];
  if (appt?.status === "angefragt" && statusIdx >= 2) {
    issues.push({ severity: "warning", text: "Termin noch nicht bestätigt" });
  }
  if (c.status === "Termin bestätigt") {
    const ref = appt?.date ? new Date(appt.date + "T12:00:00") : null;
    if (ref && ref < new Date() && appt.status !== "erledigt") {
      issues.push({ severity: "warning", text: "Termin liegt in der Vergangenheit, noch nicht erledigt" });
    }
    const lastChange = getStatusHistory(c).filter(h => h.status === "Termin bestätigt").pop();
    const stuck = daysSince(lastChange?.timestamp);
    if (stuck !== null && stuck >= STUCK_DAYS["Termin bestätigt"]) {
      issues.push({ severity: "warning", text: `${stuck} Tage seit Terminbestätigung ohne Abschluss` });
    }
  }

  const status = !hasApptConfirmed && hasApptRequest
    ? STEP_STATUS.WARNING
    : issues.length
      ? STEP_STATUS.WARNING
      : STEP_STATUS.OK;

  return { key: "appointment", status, issues };
}

function checkCompletion(c) {
  if (c.status === "Abgeschlossen") {
    const hasCompletion = historyHas(c, "Status geändert: Abgeschlossen");
    if (!hasCompletion) {
      return {
        key: "completion",
        status: STEP_STATUS.WARNING,
        issues: [{ severity: "warning", text: "Abgeschlossen, aber kein Abschluss-Eintrag in Historie" }],
      };
    }
    return { key: "completion", status: STEP_STATUS.OK, issues: [] };
  }

  if (c.callbackRequested) {
    return {
      key: "completion",
      status: STEP_STATUS.WARNING,
      issues: [{ severity: "warning", text: "Offener Rückrufwunsch" }],
    };
  }

  return { key: "completion", status: STEP_STATUS.MISSING, issues: [{ severity: "info", text: "Vorgang noch offen" }] };
}

function calcScore(steps) {
  let score = 100;
  for (const step of steps) {
    if (step.status === STEP_STATUS.WARNING) score -= 12;
    if (step.status === STEP_STATUS.MISSING) score -= 8;
    if (step.status === STEP_STATUS.SKIPPED) score -= 5;
    for (const issue of step.issues) {
      if (issue.severity === "error") score -= 15;
      if (issue.severity === "warning") score -= 5;
    }
  }
  return Math.max(0, Math.min(100, score));
}

function scoreGrade(score) {
  if (score >= 90) return { label: "Sehr gut", color: "emerald" };
  if (score >= 75) return { label: "Gut", color: "blue" };
  if (score >= 60) return { label: "Verbesserungswürdig", color: "amber" };
  if (score >= 40) return { label: "Kritisch", color: "orange" };
  return { label: "Dringend", color: "red" };
}

/** Einzelnen Vorgang prüfen und bewerten */
export function evaluateCase(c) {
  const steps = [
    checkIntake(c),
    checkReview(c),
    checkQuote(c),
    checkAppointment(c),
    checkCompletion(c),
  ];

  const score = calcScore(steps);
  const grade = scoreGrade(score);
  const allIssues = steps.flatMap(s => s.issues.map(i => ({ ...i, step: s.key })));
  const errors = allIssues.filter(i => i.severity === "error");
  const warnings = allIssues.filter(i => i.severity === "warning");

  return {
    caseId: c.id,
    customerName: c.customer?.name || "Anrufer",
    vehicle: `${c.vehicle?.make || ""} ${c.vehicle?.model || ""}`.trim() || "–",
    status: c.status,
    urgency: c.urgency,
    score,
    grade,
    steps,
    issues: allIssues,
    flagged: errors.length > 0 || warnings.length > 0 || score < 75,
  };
}

/** Alle Vorgänge auswerten */
export function evaluateAllCases(cases) {
  const results = cases.map(evaluateCase);
  const openCases = results.filter(r => r.status !== "Abgeschlossen");
  const flaggedCases = results.filter(r => r.flagged);
  const avgScore = results.length
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 100;

  const stepStats = Object.fromEntries(
    WORKFLOW_STEPS.map(s => [s.key, { ok: 0, warning: 0, missing: 0, skipped: 0 }])
  );
  for (const r of results) {
    for (const step of r.steps) {
      if (stepStats[step.key][step.status] !== undefined) {
        stepStats[step.key][step.status] += 1;
      }
    }
  }

  return {
    totalCases: results.length,
    openCases: openCases.length,
    flaggedCount: flaggedCases.length,
    avgScore,
    avgGrade: scoreGrade(avgScore),
    stepStats,
    results: results.sort((a, b) => a.score - b.score),
    flaggedCases: flaggedCases.sort((a, b) => a.score - b.score),
  };
}

/** Wöchentliche Checker-Zusammenfassung für Zementa */
export function aggregateWeeklyChecker(cases, weekStartIso, weekEndIso) {
  const weekStart = new Date(weekStartIso + "T00:00:00");
  const weekEnd = new Date(weekEndIso + "T23:59:59");

  const relevantCases = cases.filter(c => {
    const created = parseTimestamp(c.createdAt);
    if (created && created >= weekStart && created <= weekEnd) return true;

    for (const h of c.history || []) {
      const ts = parseTimestamp(h.timestamp);
      if (ts && ts >= weekStart && ts <= weekEnd) return true;
    }
    return c.status !== "Abgeschlossen";
  });

  const evaluation = evaluateAllCases(relevantCases);

  return {
    weekStart: weekStartIso,
    weekEnd: weekEndIso,
    avgScore: evaluation.avgScore,
    avgGrade: evaluation.avgGrade,
    flaggedCount: evaluation.flaggedCount,
    openCases: evaluation.openCases,
    stepStats: evaluation.stepStats,
    topIssues: summarizeTopIssues(evaluation.results),
    flaggedCases: evaluation.flaggedCases.slice(0, 10).map(r => ({
      caseId: r.caseId,
      customerName: r.customerName,
      status: r.status,
      score: r.score,
      grade: r.grade,
      topIssue: r.issues.find(i => i.severity === "error" || i.severity === "warning")?.text || null,
    })),
  };
}

function summarizeTopIssues(results) {
  const counts = {};
  for (const r of results) {
    for (const issue of r.issues) {
      if (issue.severity === "info") continue;
      counts[issue.text] = (counts[issue.text] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));
}

export function buildCheckerDigestSection(checkerSummary) {
  if (!checkerSummary) return [];
  const lines = [
    "",
    "✅ Checker – Schritt-Bewertung",
    `• Durchschnittliche Qualität: ${checkerSummary.avgScore}/100 (${checkerSummary.avgGrade.label})`,
    `• Auffällige Vorgänge: ${checkerSummary.flaggedCount}`,
    `• Noch offen: ${checkerSummary.openCases}`,
  ];

  if (checkerSummary.topIssues?.length) {
    lines.push("• Häufigste Probleme:");
    for (const t of checkerSummary.topIssues) {
      lines.push(`  – ${t.text} (${t.count}×)`);
    }
  }

  if (checkerSummary.flaggedCases?.length) {
    lines.push("• Dringend prüfen:");
    for (const c of checkerSummary.flaggedCases.slice(0, 5)) {
      lines.push(`  – ${c.customerName} (${c.score} Pkt.): ${c.topIssue || c.status}`);
    }
  }

  return lines;
}

export { STEP_STATUS, scoreGrade };
