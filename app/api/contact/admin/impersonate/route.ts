import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { uid } = await req.json();

  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  // جلب بروفايل المستخدم
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("uid", uid)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ⚡ إنشاء جلسة انتحال
  await supabase.auth.setSession({
    access_token: profile.impersonate_access_token,
    refresh_token: profile.impersonate_refresh_token,
  });

  return NextResponse.json({ success: true });
}
