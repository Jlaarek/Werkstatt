"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const signInWithGitHub = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "repo",
      },
    });
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  if (!configured) return null;

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
    );
  }

  if (user) {
    const avatar = user.user_metadata?.avatar_url;
    const name = user.user_metadata?.user_name || user.user_metadata?.full_name || user.email;

    return (
      <div className="flex items-center gap-3">
        {avatar && (
          <img src={avatar} alt="" className="w-8 h-8 rounded-full ring-2 ring-saep-400/30" />
        )}
        <span className="text-xs text-white/50 hidden sm:inline">{name}</span>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded-lg glass text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          Abmelden
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGitHub}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
      Mit GitHub anmelden
    </button>
  );
}
