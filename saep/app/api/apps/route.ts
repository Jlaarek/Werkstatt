import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { GeneratedApp } from "@/lib/appGenerator";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await request.json();
  const { name, prompt, category, app_data } = body as {
    name: string;
    prompt: string;
    category: string;
    app_data: GeneratedApp;
  };

  const { data, error } = await supabase
    .from("apps")
    .insert({ user_id: user.id, name, prompt, category, app_data })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
