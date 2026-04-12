import { createClient as _createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Returns a Supabase client using the public anon key.
 * Safe to use in both Server Components and Client Components — there is
 * no auth / session involved so no cookie handling is needed.
 */
export function createClient() {
  return _createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
