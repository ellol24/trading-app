import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role via service role (bypasses RLS)
    const { data: adminProfile } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("uid", user.id)
      .single();

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const limit = parseInt(searchParams.get("limit") ?? "1000", 10);
    const uid = searchParams.get("uid");

    // Build profile query
    let query = adminClient
      .from("user_profiles")
      .select("uid, full_name, email, role, balance, status, referral_code, created_at");

    if (uid) {
      query = query.eq("uid", uid);
    } else if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: profiles, error: dbError } = await query.limit(limit);
    if (dbError) throw new Error(dbError.message);

    // If it's a simple search/lookup, return lightweight response
    if (search || uid) {
      return NextResponse.json({ users: profiles ?? [] });
    }

    // Full list: fetch auth users + deposits for enriched data
    const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw new Error(authError.message);

    const { data: deposits } = await adminClient
      .from("deposits")
      .select("user_id, amount, status");

    const depositTotals: Record<string, number> = {};
    (deposits || []).forEach((d: any) => {
      if (d.status === "approved") {
        depositTotals[d.user_id] = (depositTotals[d.user_id] || 0) + Number(d.amount);
      }
    });

    const mergedUsers = (profiles ?? []).map((profile: any) => {
      const authUser = authUsers.find((u) => u.id === profile.uid);
      return {
        ...profile,
        email: authUser?.email || profile.email,
        raw_password: authUser?.user_metadata?.raw_password || null,
        total_deposits: depositTotals[profile.uid] || 0,
      };
    });

    return NextResponse.json({ users: mergedUsers });
  } catch (err: any) {
    console.error("[admin/users] Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
