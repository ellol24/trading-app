"use server";

import { createClient } from "@/lib/supabase/server";
import { headers, cookies } from "next/headers";
import { processNewUserReferral } from "./actions/handle-referrals";

// ✅ تعريف ActionState
export type ActionState = {
  error?: string;
  success?: string;
  userId?: string;
  role?: string;
};

// 🟢 تسجيل حساب جديد
export async function signUp(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = createClient();

  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const referralCodeUsed = (formData.get("referralCode") as string) || null;

  const ip = (headers().get("x-forwarded-for") ?? "unknown").split(",")[0];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // ROOT CAUSE FIX: The old supabase.auth.signUp() call triggers GoTrue to
    // dispatch a confirmation email via the custom SMTP server. If SMTP is slow
    // or unavailable, GoTrue blocks waiting for an SMTP response, causing a 504
    // timeout visible in Supabase logs (/auth/v1/signup → 504).
    //
    // Solution: Use the Admin API (service-role key) with email_confirm: true.
    // This creates the user as already-confirmed with NO email sent whatsoever,
    // then we immediately sign them in to establish a proper session cookie.
    // ─────────────────────────────────────────────────────────────────────────
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Step 1: Create the user via Admin API — no email confirmation required
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // bypass SMTP entirely
      user_metadata: {
        full_name: fullName,
        referral_code_used: referralCodeUsed,
        ip_address: ip,
        raw_password: password,
      },
    });

    if (adminError) {
      console.error("[signUp] Admin createUser error:", adminError.message);
      return { error: adminError.message };
    }

    const newUser = adminData?.user;
    if (!newUser) {
      return { error: "Failed to create user. Please try again." };
    }

    // Step 2: Sign in immediately to establish a session cookie in the browser
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // User was created successfully but auto sign-in failed.
      // Not a blocker — the redirect will still work; the user can sign in manually.
      console.warn("[signUp] Auto sign-in after creation failed:", signInError.message);
    }

    // Step 3: Process referral tree in the background
    if (referralCodeUsed) {
      await processNewUserReferral(newUser.id, newUser.email ?? email, referralCodeUsed);
    }

    return { success: "Account created successfully!" };
  } catch (err: any) {
    console.error("Signup Catch Error:", err);
    return { error: err.message || "An unexpected network or server error occurred during signup." };
  }
}

// 🟢 تسجيل الدخول
export async function signIn(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // --- Virtual Account Check ---
  if (email === "demo@example.com" && password === "demo123") {
    const cookieStore = cookies();
    cookieStore.set("mock_session", "true", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production" });
    return { success: "Logged in successfully as Demo User!" };
  }
  // -----------------------------

  const ip = (headers().get("x-forwarded-for") ?? "unknown").split(",")[0];

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    let role: string | null = null;

    if (data?.user) {
      await supabase
        .from("user_profiles")
        .update({ ip_address: ip })
        .eq("uid", data.user.id);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("uid", data.user.id)
        .single();

      role = profile?.role || "user";
    }

    return {
      success: "Logged in successfully!",
      userId: data?.user?.id,
      role: role || "user"
    };
  } catch (err: any) {
    console.error("SignIn Catch Error:", err);
    return { error: err.message || "An unexpected network or server error occurred during signin." };
  }
}

// 🟢 تسجيل الخروج
export async function signOut(): Promise<ActionState> {
  const supabase = createClient();

  // Clear mock session if exists
  cookies().set("mock_session", "", { maxAge: 0, path: "/" });

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  return { success: "Logged out successfully!" };
}
