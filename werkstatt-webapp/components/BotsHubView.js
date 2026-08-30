"use client";

import React, { useMemo } from "react";
import {
  Bot, ShieldCheck, Sparkles, Github, Database, Globe,
  CheckCircle2, AlertCircle, ExternalLink, ArrowRight, Link2, Scissors
} from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { BOTS, getClientConnectionStatuses } from "../lib/bots";
import { evaluateAllCases } from "../lib/checker";
import { aggregateWeeklyActivity, getWeekRange } from "../lib/zementa";

const ACCENT = {
  violet: {
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    iconBg: "from-violet-600 to-indigo-800",
    ring: "ring-violet-200",
    btn: "bg-violet-600 hover:bg-violet-700",
  },
  rose: {
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    iconBg: "from-rose-500 to-pink-700",
    ring: "ring-rose-200",
    btn: "bg-rose-600 hover:bg-rose-700",
  },
  orange: {
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    iconBg: "from-slate-700 to-slate-900",
    ring: "ring-orange-200",
    btn: "bg-orange-500 hover:bg-orange-600",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    iconBg: "from-emerald-600 to-teal-800",
    ring: "ring-emerald-200",
    btn: "bg-emerald-600 hover:bg-emerald-700",
  },
};

const BOT_ICONS = {
  saep: Sparkles,
  hans: Scissors,
  zementa: Bot,
  checker: ShieldCheck,
};

const SERVICE_ICONS = {
  supabase: Database,
  github: Github,
  netlify: Globe,
};

function ConnectionCard({ service }) {
  const Icon = SERVICE_ICONS[service.id] || Link2;
  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${service.connected ? "border-emerald-200" : "border-amber-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${service.connected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            <Icon size={18} />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{service.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{service.detail}</p>
          </div>
        </div>
        {service.connected ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
            <CheckCircle2 size={10} /> Verbunden
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
            <AlertCircle size={10} /> Offen
          </span>
        )}
      </div>
      <a
        href={service.href}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
      >
        {service.action} <ExternalLink size={12} />
      </a>
    </div>
  );
}

function BotCard({ bot, onOpen, stats }) {
  const accent = ACCENT[bot.accent] || ACCENT.orange;
  const Icon = BOT_ICONS[bot.id] || Bot;
  const isInternal = Boolean(bot.viewKey);

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ring-1 ${accent.ring}`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${accent.iconBg} flex items-center justify-center shadow shrink-0`}>
            <Icon size={22} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-slate-800">{bot.name}</h3>
              <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${accent.badge}`}>
                {bot.role}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{bot.tagline}</p>
            <p className="text-sm text-slate-600 mt-2">{bot.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {bot.connections.map(id => {
            const SIcon = SERVICE_ICONS[id] || Link2;
            return (
              <span key={id} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
                <SIcon size={10} /> {id === "supabase" ? "Supabase" : id === "github" ? "GitHub" : "Netlify"}
              </span>
            );
          })}
        </div>

        {stats && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {stats.map(s => (
              <div key={s.label} className="bg-slate-50 rounded-lg py-2 px-1">
                <p className="text-sm font-bold text-slate-800">{s.value}</p>
                <p className="text-[10px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {isInternal ? (
            <button
              onClick={() => onOpen(bot.viewKey)}
              className={`inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg ${accent.btn}`}
            >
              Öffnen <ArrowRight size={14} />
            </button>
          ) : (
            <a
              href="#saep-setup"
              className={`inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg ${accent.btn}`}
            >
              {bot.id === "hans" ? "Salon Hans starten" : "Säp starten"} <ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BotsHubView({ cases, openView, showToast }) {
  const supabaseConfigured = isSupabaseConfigured;
  const connections = useMemo(
    () => getClientConnectionStatuses({ supabaseConfigured }),
    [supabaseConfigured]
  );

  const week = useMemo(() => getWeekRange(new Date(), 0), []);
  const zementaStats = useMemo(() => {
    const summary = aggregateWeeklyActivity(cases, week.weekStart, week.weekEnd);
    return [
      { label: "Neu", value: summary.kpis.newCasesCount },
      { label: "Erledigt", value: summary.kpis.completedCount },
      { label: "Aktivitäten", value: summary.kpis.activityCount },
    ];
  }, [cases, week]);

  const checkerStats = useMemo(() => {
    const ev = evaluateAllCases(cases);
    return [
      { label: "Score", value: `${ev.avgScore}` },
      { label: "Auffällig", value: ev.flaggedCount },
      { label: "Offen", value: ev.openCases },
    ];
  }, [cases]);

  const saepStats = [
    { label: "Stack", value: "3" },
    { label: "Vorlagen", value: "7" },
    { label: "Export", value: "GH" },
  ];

  const hansStats = [
    { label: "Leistungen", value: "12" },
    { label: "Termine", value: "6" },
    { label: "Port", value: "3001" },
  ];

  function handleOpen(viewKey) {
    openView(viewKey);
    showToast?.(`${viewKey === "zementa" ? "Zementa" : "Checker"} geöffnet.`);
  }

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shadow-lg shrink-0">
          <Link2 size={28} className="text-orange-400" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">Bot-Suite</h1>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
              Säp × Hans × Checker × Zementa
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Gemeinsamer Stack: <strong>Supabase</strong>, <strong>GitHub</strong>, <strong>Netlify</strong>.
            Säp baut mit Hans Probe-Apps, Checker bewertet Schritte, Zementa berichtet wöchentlich.
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Link2 size={14} className="text-orange-500" /> Verbindungen
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {connections.map(s => (
            <ConnectionCard key={s.id} service={s} />
          ))}
        </div>
        {!supabaseConfigured && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Supabase noch nicht verbunden. Trage in <code className="font-mono">.env.local</code> dieselbe
            Project URL und den anon Key ein wie bei Säp – ein Projekt für alle Bots.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Deine Bots</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {BOTS.map(bot => (
            <BotCard
              key={bot.id}
              bot={bot}
              onOpen={handleOpen}
              stats={
                bot.id === "zementa" ? zementaStats
                  : bot.id === "checker" ? checkerStats
                    : bot.id === "hans" ? hansStats
                      : saepStats
              }
            />
          ))}
        </div>
      </section>

      <section className="mb-8 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">So arbeiten sie zusammen</h2>
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <span><strong>Säp</strong> + <strong>Hans</strong>: Ideen → Probe-Apps (z. B. Salon Hans für Friseure) → GitHub → Netlify.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <span><strong>Checker</strong> prüft jeden Vorgangs-Schritt und bewertet die Qualität (Score 0–100).</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <span><strong>Zementa</strong> fasst die Woche zusammen und nimmt Checker-Bewertungen in den Wochenbericht auf.</span>
          </li>
        </ol>
      </section>

      <section id="saep-setup" className="bg-slate-900 text-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-violet-300" />
          <h2 className="text-sm font-semibold">Säp & Hans starten (gleiche Konten)</h2>
        </div>
        <p className="text-sm text-slate-300 mb-3">
          Säp (<code className="text-violet-200">saep/</code>) und Hans’ Salon (
          <code className="text-rose-200">salon-app/</code>) nutzen dieselben Supabase-/GitHub-/Netlify-Konten.
        </p>
        <pre className="text-xs bg-black/40 border border-white/10 rounded-lg p-3 overflow-x-auto text-slate-200 font-mono whitespace-pre-wrap">{`# Säp
cd saep && npm install && npm run dev

# Salon Hans (Port 3001)
cd salon-app && npm install && npm run dev`}</pre>
        <p className="text-xs text-slate-400 mt-3">
          SQL: <code className="text-slate-300">werkstatt-webapp/supabase/schema.sql</code> +{" "}
          <code className="text-slate-300">zementa.sql</code>, dann{" "}
          <code className="text-slate-300">saep/supabase/schema.sql</code> und{" "}
          <code className="text-slate-300">salon-app/supabase/schema.sql</code>.
        </p>
      </section>
    </div>
  );
}
