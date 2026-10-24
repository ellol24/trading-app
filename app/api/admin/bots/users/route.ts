import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";

    const { data: users, error } = await adminClient
      .from("user_profiles")
      .select("uid, full_name, email, telegram_chat_id, balance, status, country, role, created_at, updated_at")
      .not("telegram_chat_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    let filtered = users || [];
    if (search) {
      filtered = filtered.filter(
        (u) =>
          (u.full_name && u.full_name.toLowerCase().includes(search)) ||
          (u.email && u.email.toLowerCase().includes(search)) ||
          (u.telegram_chat_id && String(u.telegram_chat_id).includes(search)) ||
          (u.country && u.country.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      ok: true,
      total: filtered.length,
      users: filtered,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
