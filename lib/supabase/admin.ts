import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/server/env";
import type { Database } from "@/lib/supabase/database.types";

export const createAdminClient = () => {
  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
