"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { SavedApp } from "@/lib/types";
import type { GeneratedApp } from "@/lib/appGenerator";

type ProjectListProps = {
  onLoad: (app: GeneratedApp, prompt: string, savedId: string) => void;
  refreshKey?: number;
};

export function ProjectList({ onLoad, refreshKey }: ProjectListProps) {
  const [projects, setProjects] = useState<SavedApp[]>([]);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setLoading(true);
      fetch("/api/apps")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setProjects(data);
        })
        .finally(() => setLoading(false));
    });
  }, [configured, refreshKey]);

  if (!configured || loading || projects.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
        Deine gespeicherten Apps
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onLoad(p.app_data, p.prompt, p.id)}
            className="p-4 rounded-xl glass text-left hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{p.app_data.categoryIcon}</span>
              <span className="text-sm font-medium text-white/80 group-hover:text-white">
                {p.name}
              </span>
            </div>
            <p className="text-[10px] text-white/30 line-clamp-2">{p.prompt}</p>
            {p.github_repo && (
              <span className="inline-block mt-2 text-[9px] text-green-400/70">GitHub ✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
