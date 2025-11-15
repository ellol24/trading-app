import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { uid } = await req.json();

    if (!uid) return NextResponse.json({ error: "Missing UID" }, { status: 400 });

    // Admin client (SUPER KEY)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // IMPORTANT
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Step 1: Get user email
    const { data: user, error: userError } = await admin
      .from("user_profiles")
      .select("email")
      .eq("uid", uid)
      .single();

    if (userError || !user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Step 2: Generate magic link session for this user
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email
    });

    if (linkError) {
      console.error(linkError);
      return NextResponse.json({ error: "Failed to generate session" }, { status: 500 });
    }

    const token = linkData?.properties?.token;
    if (!token) {
      return NextResponse.json({ error: "No token generated" }, { status: 500 });
    }

    return NextResponse.json({ token });
  } catch (e) {
    console.error("impersonate API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
