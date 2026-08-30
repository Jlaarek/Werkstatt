"use client";

import type { GeneratedApp, AppScreen } from "@/lib/appGenerator";

type AppPreviewProps = {
  app: GeneratedApp;
  activeScreen: number;
  onScreenChange: (index: number) => void;
};

function ScreenContent({ screen, app }: { screen: AppScreen; app: GeneratedApp }) {
  const color = app.primaryColor;

  if (screen.type === "dashboard") {
    return (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {app.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-2 text-center"
              style={{ background: `${color}15` }}
            >
              <div className="text-lg font-bold" style={{ color }}>{stat.value}</div>
              <div className="text-[9px] text-white/50 leading-tight">{stat.label}</div>
              {stat.trend && (
                <div className="text-[8px] text-green-400">{stat.trend}</div>
              )}
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3" style={{ background: `${color}10` }}>
          <div className="text-[10px] text-white/40 mb-2">Aktivität</div>
          <div className="flex items-end gap-1 h-16">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}%`,
                  background: `linear-gradient(to top, ${color}, ${app.secondaryColor})`,
                  opacity: 0.7 + (i * 0.04),
                }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {app.features.slice(0, 3).map((f) => (
            <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
              <span className="text-sm">{f.icon}</span>
              <span className="text-[11px] text-white/70">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (screen.type === "list" && screen.items) {
    return (
      <div className="p-3 space-y-2">
        {screen.items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
          >
            <span className="text-lg">{item.icon || "📌"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium truncate">{item.title}</div>
              {item.subtitle && (
                <div className="text-[9px] text-white/40">{item.subtitle}</div>
              )}
            </div>
            {item.badge && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${color}30`, color }}
              >
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (screen.type === "calendar") {
    return (
      <div className="p-3 space-y-2">
        {screen.items?.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: `${color}20` }}
            >
              📅
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-medium">{item.title}</div>
              <div className="text-[9px] text-white/40">{item.subtitle}</div>
            </div>
            {item.badge && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (screen.type === "profile") {
    return (
      <div className="p-4 text-center space-y-4">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${color}, ${app.secondaryColor})` }}
        >
          👤
        </div>
        <div>
          <div className="text-sm font-semibold">Max Mustermann</div>
          <div className="text-[10px] text-white/40">Premium Mitglied</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {["Einstellungen", "Hilfe", "Daten", "Abmelden"].map((label) => (
            <button
              key={label}
              className="text-[10px] py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function AppPreview({ app, activeScreen, onScreenChange }: AppPreviewProps) {
  const screen = app.screens[activeScreen];

  return (
    <div className="flex flex-col items-center">
      <div className="phone-frame w-[280px] h-[520px] overflow-hidden relative">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <span className="text-[10px] text-white/50">9:41</span>
          <div className="flex gap-1">
            <span className="text-[8px] text-white/40">●●●</span>
          </div>
        </div>

        {/* App header */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ background: `linear-gradient(135deg, ${app.primaryColor}20, transparent)` }}
        >
          <span className="text-xl">{app.categoryIcon}</span>
          <div>
            <div className="text-sm font-bold">{app.name}</div>
            <div className="text-[9px] text-white/40">{screen.title}</div>
          </div>
        </div>

        {/* Screen content */}
        <div className="flex-1 overflow-y-auto h-[380px]">
          <ScreenContent screen={screen} app={app} />
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="flex justify-around py-2">
            {app.screens.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onScreenChange(i)}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all"
                style={{
                  color: activeScreen === i ? app.primaryColor : "rgba(255,255,255,0.4)",
                }}
              >
                <span className="text-sm">
                  {s.type === "dashboard" ? "📊" : s.type === "list" ? "📋" : s.type === "calendar" ? "📅" : "👤"}
                </span>
                <span className="text-[8px]">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature badges */}
      <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-sm">
        {app.features.map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs glass"
          >
            <span>{f.icon}</span>
            <span className="text-white/70">{f.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
