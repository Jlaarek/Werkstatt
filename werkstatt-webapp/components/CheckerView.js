"use client";

import React, { useMemo } from "react";
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronRight, ClipboardCheck, TrendingUp, Flag
} from "lucide-react";
import { evaluateAllCases, WORKFLOW_STEPS, STEP_STATUS } from "../lib/checker";

function ScoreRing({ score, size = 72 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-slate-800">{score}</span>
      </div>
    </div>
  );
}

const STEP_STATUS_CONFIG = {
  [STEP_STATUS.OK]: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "OK" },
  [STEP_STATUS.WARNING]: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200", label: "Warnung" },
  [STEP_STATUS.MISSING]: { icon: Clock, color: "text-slate-500 bg-slate-50 border-slate-200", label: "Offen" },
  [STEP_STATUS.SKIPPED]: { icon: XCircle, color: "text-orange-500 bg-orange-50 border-orange-200", label: "Übersprungen" },
  [STEP_STATUS.NOT_APPLICABLE]: { icon: CheckCircle2, color: "text-slate-400 bg-slate-50 border-slate-200", label: "–" },
};

function StepBadge({ status }) {
  const cfg = STEP_STATUS_CONFIG[status] || STEP_STATUS_CONFIG[STEP_STATUS.MISSING];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}

function CaseRow({ result, openCase }) {
  const gradeColors = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    orange: "text-orange-700 bg-orange-50 border-orange-200",
    red: "text-red-700 bg-red-50 border-red-200",
  };

  return (
    <button
      onClick={() => openCase(result.caseId)}
      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-4 border-b border-slate-100 last:border-0"
    >
      <ScoreRing score={result.score} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-slate-800">{result.customerName}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${gradeColors[result.grade.color]}`}>
            {result.grade.label}
          </span>
          {result.flagged && <Flag size={14} className="text-orange-500" />}
        </div>
        <p className="text-xs text-slate-400 truncate">{result.vehicle} · {result.status}</p>
        {result.issues.filter(i => i.severity !== "info").slice(0, 2).map((issue, i) => (
          <p key={i} className="text-xs text-amber-600 mt-0.5 truncate">{issue.text}</p>
        ))}
      </div>
      <div className="hidden sm:flex gap-1 shrink-0">
        {result.steps.map(step => (
          <StepBadge key={step.key} status={step.status} />
        ))}
      </div>
      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  );
}

export default function CheckerView({ cases, openCase }) {
  const evaluation = useMemo(() => evaluateAllCases(cases), [cases]);

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg shrink-0">
          <ShieldCheck size={28} className="text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">Checker</h1>
            <span className="text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
              Schritt-Prüfer
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">
            Prüft alle Workflow-Schritte deiner Vorgänge, bewertet die Qualität und arbeitet mit Zementa zusammen.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm col-span-2 md:col-span-1 flex items-center gap-4">
          <ScoreRing score={evaluation.avgScore} />
          <div>
            <p className="text-xs text-slate-500">Gesamt-Score</p>
            <p className="font-semibold text-slate-800">{evaluation.avgGrade.label}</p>
            <p className="text-xs text-slate-400">{evaluation.totalCases} Vorgänge</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Auffällig</p>
          <p className="text-2xl font-bold text-orange-600">{evaluation.flaggedCount}</p>
          <p className="text-xs text-slate-400">benötigen Aufmerksamkeit</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Noch offen</p>
          <p className="text-2xl font-bold text-slate-800">{evaluation.openCases}</p>
          <p className="text-xs text-slate-400">nicht abgeschlossen</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><TrendingUp size={12} /> Zementa</p>
          <p className="text-sm font-medium text-slate-700">Wöchentlicher Bericht</p>
          <p className="text-xs text-slate-400">Checker-Daten fließen in Zementa ein</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-emerald-600" />
            <h2 className="font-semibold text-sm text-slate-700">Vorgänge nach Bewertung</h2>
          </div>
          {evaluation.results.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-8 text-center">Keine Vorgänge vorhanden.</p>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {evaluation.results.map(r => (
                <CaseRow key={r.caseId} result={r} openCase={openCase} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="font-semibold text-sm text-slate-700 mb-4">Schritt-Übersicht</h2>
            <div className="space-y-4">
              {WORKFLOW_STEPS.map(step => {
                const stats = evaluation.stepStats[step.key];
                const total = stats.ok + stats.warning + stats.missing + stats.skipped || 1;
                const okPct = Math.round((stats.ok / total) * 100);
                return (
                  <div key={step.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{step.label}</span>
                      <span className="text-slate-400">{okPct}% OK</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(stats.ok / total) * 100}%` }} />
                      <div className="h-full bg-amber-400" style={{ width: `${(stats.warning / total) * 100}%` }} />
                      <div className="h-full bg-slate-300" style={{ width: `${(stats.missing / total) * 100}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {evaluation.flaggedCases.length > 0 && (
            <div className="bg-orange-50 rounded-xl border border-orange-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-orange-600" />
                <h2 className="font-semibold text-sm text-orange-800">Dringend prüfen</h2>
              </div>
              <ul className="space-y-2">
                {evaluation.flaggedCases.slice(0, 5).map(r => (
                  <li key={r.caseId}>
                    <button
                      onClick={() => openCase(r.caseId)}
                      className="text-sm text-left w-full hover:text-orange-700"
                    >
                      <span className="font-medium">{r.customerName}</span>
                      <span className="text-orange-600 ml-1">({r.score} Pkt.)</span>
                      {r.issues[0] && (
                        <p className="text-xs text-orange-600/80 truncate">{r.issues[0].text}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
