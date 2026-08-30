"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Einfache Session-Verwaltung mit Supabase Auth (E-Mail/Passwort).
// Mitarbeiter-Konten werden im Supabase-Dashboard unter
// Authentication -> Users angelegt (siehe README.md) - es gibt
// bewusst keine öffentliche Selbstregistrierung.
export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = wird geladen, null = kein Login

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, loading: session === undefined, signIn, signOut };
}
