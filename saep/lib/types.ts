import type { GeneratedApp } from "@/lib/appGenerator";

export type SavedApp = {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  category: string;
  app_data: GeneratedApp;
  github_repo: string | null;
  netlify_url: string | null;
  created_at: string;
  updated_at: string;
};
