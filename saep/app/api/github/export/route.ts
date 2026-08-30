import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { GeneratedApp } from "@/lib/appGenerator";

function generateReadme(app: GeneratedApp): string {
  return `# ${app.name}

> ${app.description}

Generiert mit [Säp](https://github.com) — Aus allem eine App.

## Features

${app.features.map((f) => `- ${f.icon} ${f.label}`).join("\n")}

## Screens

${app.screens.map((s) => `- ${s.title} (${s.type})`).join("\n")}

## Starten

\`\`\`bash
npm install
npm run dev
\`\`\`
`;
}

function generatePackageJson(appName: string): string {
  const slug = appName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return JSON.stringify(
    {
      name: slug,
      version: "1.0.0",
      private: true,
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { next: "^14.2.0", react: "^18.3.0", "react-dom": "^18.3.0" },
    },
    null,
    2
  );
}

function generatePageTsx(app: GeneratedApp): string {
  return `export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ color: "${app.primaryColor}" }}>${app.categoryIcon} ${app.name}</h1>
      <p>${app.description}</p>
      <div style={{ display: "grid", gap: "1rem", marginTop: "2rem" }}>
        ${app.features.map((f) => `<div key="${f.id}" style={{ padding: "1rem", border: "1px solid #eee", borderRadius: 8 }}>${f.icon} ${f.label}</div>`).join("\n        ")}
      </div>
    </main>
  );
}
`;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Bitte mit GitHub anmelden" }, { status: 401 });
  }

  const githubToken = session.provider_token;
  if (!githubToken) {
    return NextResponse.json(
      { error: "Kein GitHub-Token. Bitte abmelden und erneut mit GitHub anmelden." },
      { status: 403 }
    );
  }

  const { app, appId } = await request.json() as { app: GeneratedApp; appId?: string };
  const repoName = app.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

  const { data: ghUser } = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json" },
  }).then((r) => r.json());

  if (!ghUser.login) {
    return NextResponse.json({ error: "GitHub-API-Fehler" }, { status: 500 });
  }

  const createRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: repoName,
      description: app.description,
      private: false,
      auto_init: false,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    return NextResponse.json(
      { error: err.message || "Repository konnte nicht erstellt werden" },
      { status: createRes.status }
    );
  }

  const repo = await createRes.json();
  const owner = repo.owner.login;
  const files = [
    { path: "README.md", content: generateReadme(app) },
    { path: "package.json", content: generatePackageJson(app.name) },
    { path: "app/page.tsx", content: generatePageTsx(app) },
    { path: "app/layout.tsx", content: `export default function Layout({ children }: { children: React.ReactNode }) {\n  return <html lang="de"><body>{children}</body></html>;\n}` },
    { path: "netlify.toml", content: `[build]\n  command = "npm run build"\n  publish = ".next"\n\n[[plugins]]\n  package = "@netlify/plugin-nextjs"\n` },
  ];

  for (const file of files) {
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${file.path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Säp: ${file.path} hinzufügen`,
        content: Buffer.from(file.content).toString("base64"),
      }),
    });
  }

  const repoUrl = repo.html_url;

  if (appId) {
    await supabase
      .from("apps")
      .update({ github_repo: repoUrl })
      .eq("id", appId)
      .eq("user_id", session.user.id);
  }

  return NextResponse.json({
    repoUrl,
    netlifyHint: `https://app.netlify.com/start/deploy?repository=https://github.com/${owner}/${repoName}`,
  });
}
