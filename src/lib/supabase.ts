import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

// Preview and Production deployments can point to entirely separate Supabase projects —
// e.g. a staging project for Preview so admin testing never touches live client data —
// purely by setting different VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY values per Vercel
// environment (same idea server-side for SUPABASE_SERVICE_ROLE_KEY in api/*.ts). No code
// change is needed to support this: every Supabase credential here is already read from
// env vars, never hardcoded. If a second project is set up as Preview's target, its schema
// needs the same migrations (supabase/migrations/*.sql, run in order) applied to it first.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
