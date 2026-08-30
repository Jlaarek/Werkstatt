"use client";

import { useState, useCallback } from "react";
import { generateAppFromPrompt, type GeneratedApp } from "@/lib/appGenerator";
import { PromptInput } from "./PromptInput";
import { AppPreview } from "./AppPreview";
import { BuildingOverlay } from "./BuildingOverlay";

export function SaepBuilder() {
  const [prompt, setPrompt] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [generatedApp, setGeneratedApp] = useState<GeneratedApp | null>(null);
  const [activeScreen, setActiveScreen] = useState(0);

  const handleBuild = useCallback(() => {
    if (!prompt.trim() || isBuilding) return;
    setIsBuilding(true);
    setGeneratedApp(null);
    setActiveScreen(0);
  }, [prompt, isBuilding]);

  const handleBuildComplete = useCallback(() => {
    const app = generateAppFromPrompt(prompt);
    setGeneratedApp(app);
    setIsBuilding(false);
  }, [prompt]);

  const handleNewApp = () => {
    setGeneratedApp(null);
    setPrompt("");
    setActiveScreen(0);
  };

  return (
    <>
      <BuildingOverlay isBuilding={isBuilding} onComplete={handleBuildComplete} />

      {/* Hero */}
      <section className="relative pt-16 pb-8 px-4">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-saep-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-40 right-1/4 w-48 h-48 bg-accent-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-white/60 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Der beste App-Programmierer der Welt
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold mb-4 tracking-tight">
            <span className="gradient-text">Säp</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed">
            Aus <em> allem</em> eine App. Beschreibe deine Idee — Säp baut sie für dich.
          </p>
        </div>
      </section>

      {/* Builder area */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          {!generatedApp ? (
            <div className="max-w-2xl mx-auto animate-slide-up">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={handleBuild}
                isLoading={isBuilding}
              />

              {/* Example prompts */}
              <div className="mt-12 grid sm:grid-cols-3 gap-4">
                {[
                  { icon: "🍕", text: "Pizza-Lieferdienst mit Live-Tracking" },
                  { icon: "🏋️", text: "Personal Trainer mit Video-Workouts" },
                  { icon: "🌱", text: "Urban Gardening Community App" },
                ].map((ex) => (
                  <button
                    key={ex.text}
                    onClick={() => setPrompt(ex.text)}
                    className="p-4 rounded-xl glass text-left hover:bg-white/5 transition-all group"
                  >
                    <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">{ex.icon}</span>
                    <span className="text-xs text-white/50 leading-relaxed">{ex.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
                {/* Left: App info */}
                <div className="flex-1 space-y-6">
                  <div className="glass rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{generatedApp.categoryIcon}</span>
                          <h2 className="text-2xl font-bold">{generatedApp.name}</h2>
                        </div>
                        <p className="text-sm text-white/50 leading-relaxed">
                          {generatedApp.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/10">
                      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                        Erkannte Features
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {generatedApp.features.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                          >
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                              style={{ background: `${f.color}20` }}
                            >
                              {f.icon}
                            </span>
                            <span className="text-sm text-white/80">{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/10">
                      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                        Screens
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {generatedApp.screens.map((s, i) => (
                          <button
                            key={s.id}
                            onClick={() => setActiveScreen(i)}
                            className="px-3 py-1.5 rounded-lg text-xs transition-all"
                            style={{
                              background: activeScreen === i ? `${generatedApp.primaryColor}30` : "rgba(255,255,255,0.05)",
                              color: activeScreen === i ? generatedApp.primaryColor : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleNewApp}
                      className="flex-1 py-3 rounded-xl glass text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all"
                    >
                      Neue App bauen
                    </button>
                    <button
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all bg-gradient-to-r from-saep-500 to-accent-500 hover:from-saep-400 hover:to-accent-400 shadow-lg shadow-saep-500/20"
                      onClick={() => alert("Export-Funktion kommt bald! Säp wird bald echte Apps exportieren können.")}
                    >
                      App exportieren
                    </button>
                  </div>
                </div>

                {/* Right: Phone preview */}
                <div className="flex-shrink-0 mx-auto lg:mx-0">
                  <AppPreview
                    app={generatedApp}
                    activeScreen={activeScreen}
                    onScreenChange={setActiveScreen}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-white/30">
            Säp — Aus allem eine App. Gebaut mit ❤️ für Johann.
          </p>
        </div>
      </footer>
    </>
  );
}
