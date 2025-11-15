import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = url.searchParams.get("uid");

  if (!uid) {
    return NextResponse.json({ error: "Missing UID" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });

  // الحصول على المستخدم المراد impersonate
  const { data: userData, error: userError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("uid", uid)
    .single();

  if (userError || !userData) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // تسجيل الدخول كمستخدم مستهدف
  const { error: signInError } = await supabase.auth.signInWithIdToken({
    token: userData.id_token,
    provider: "email",
  });

  if (signInError) {
    return NextResponse.json(
      { error: "Failed to impersonate" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
