// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase server client not configured");
  }

  const cookieStore = cookies();

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value ?? null;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options);
        } catch (err) {
          console.error("Error setting cookie:", err);
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch (err) {
          console.error("Error removing cookie:", err);
        }
      },
    },
  });
}

// ✅ Helper يعيد session + user
export async function getServerAuth() {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  return { supabase, session, user: session?.user, error };
}
