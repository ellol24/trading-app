// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// --- Mock Client Implementation ---
const MOCK_USER_ID = "virtual-user-id";
const MOCK_USER = {
  id: MOCK_USER_ID,
  email: "demo@example.com",
  user_metadata: { full_name: "Demo Trader" },
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
};

const MOCK_PROFILE = {
  uid: MOCK_USER_ID,
  full_name: "Demo Trader",
  role: "user",
  balance: 10000,
  total_referrals: 5,
  total_trades: 24,
  created_at: new Date().toISOString(),
};

class MockSupabaseClient {
  auth = {
    getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
    getSession: async () => ({
      data: {
        session: {
          access_token: "mock-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user: MOCK_USER,
        },
      },
      error: null,
    }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: MOCK_USER, session: {} }, error: null }),
    signUp: async () => ({ data: { user: MOCK_USER, session: {} }, error: null }),
  };

  from(table: string) {
    return {
      select: () => this.queryBuilder(table),
      update: () => this.queryBuilder(table),
      insert: () => this.queryBuilder(table),
      delete: () => this.queryBuilder(table),
      upsert: () => this.queryBuilder(table),
    };
  }

  // Simple mock query builder
  private queryBuilder(table: string) {
    const builder: any = {
      eq: () => builder,
      single: async () => {
        if (table === "user_profiles") return { data: MOCK_PROFILE, error: null };
        return { data: null, error: { message: "Mock data not found" } };
      },
      maybeSingle: async () => {
        if (table === "user_profiles") return { data: MOCK_PROFILE, error: null };
        return { data: null, error: null };
      },
      order: () => builder,
      limit: () => builder,
    };
    // Return a promise-like object that resolves to the builder's result if awaited immediately
    // or allows chaining. Ideally we'd need a more complex proxy, but for our simple usage:
    return builder;
  }
}

export function createClient() {
  const cookieStore = cookies();
  const isMockSession = cookieStore.get("mock_session")?.value === "true";

  if (isMockSession) {
    return new MockSupabaseClient() as any;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return mock client if config is missing to avoid crashing, 
    // but logically we shouldn't be here if isSupabaseConfigured checks are respected
    // However, let's stick to the original behavior or throw.
    // Original threw error. Let's keep it safe but maybe just return mock if we want to force it?
    // No, let's respect the current flow.
    throw new Error("Supabase server client not configured");
  }

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
