import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { DbReport, DbUser } from "@/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Browser client (singleton) ───────────────────────────────────────────────

let _client: ReturnType<typeof createSupabaseClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

// ─── Server client (service role — only for API routes) ───────────────────────

export function getSupabaseServer() {
  return createSupabaseClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}



// ─── Usage helpers ────────────────────────────────────────────────────────────

export const FREE_LIMIT = 3;
export const PRO_LIMIT = 50;

const PLAN_LIMITS: Record<DbUser["plan"], number> = {
  free: FREE_LIMIT,
  pro: PRO_LIMIT,
  agency: Infinity,
};

/** Returns true if user is under their monthly limit */
export async function canAnalyze(userId: string): Promise<boolean> {
  const db = getSupabaseServer();
  const { data: user } = await db
    .from("users")
    .select("plan, reports_this_month")
    .eq("id", userId)
    .single();

  if (!user) return true; // anonymous — allow, rate-limit by IP instead
  return user.reports_this_month < PLAN_LIMITS[user.plan as DbUser["plan"]];
}

/** Increments the user's monthly report count */
export async function incrementUsage(userId: string): Promise<void> {
  const db = getSupabaseServer();
  await db.rpc("increment_reports", { user_id: userId });
}

/** Save a completed report */
export async function saveReport(
  report: Omit<DbReport, "created_at">
): Promise<string | null> {
  const db = getSupabaseServer();
  const { data, error } = await db
    .from("reports")
    .insert(report)
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase saveReport]", error);
    return null;
  }
  return data.id;
}

/** Fetch a report by ID (public route) */
export async function getReport(id: string): Promise<DbReport | null> {
  const db = getSupabaseBrowser();
  const { data } = await db
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();
  return data as DbReport | null;
}
