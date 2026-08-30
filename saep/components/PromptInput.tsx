"use client";

import { TEMPLATES } from "@/lib/appGenerator";

type PromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
};

export function PromptInput({ value, onChange, onSubmit, isLoading }: PromptInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Beschreibe deine App-Idee… z.B. „Eine App für mein Café mit Speisekarte, Tischreservierung und Treuepunkten“"
          rows={3}
          className="w-full px-5 py-4 rounded-2xl glass text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-saep-400/50 transition-all text-sm leading-relaxed"
          disabled={isLoading}
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim() || isLoading}
          className="absolute bottom-3 right-3 px-5 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-saep-500 to-accent-500 hover:from-saep-400 hover:to-accent-400 text-white shadow-lg shadow-saep-500/25"
        >
          {isLoading ? "Baut…" : "App bauen →"}
        </button>
      </div>

      <div>
        <p className="text-xs text-white/40 mb-3">Oder starte mit einer Vorlage:</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange(t.prompt)}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
