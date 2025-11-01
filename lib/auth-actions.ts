"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        referral_code_used: referralCodeUsed,
        ip_address: ip,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Account created successfully!" };
}

// 🟢 تسجيل الدخول
export async function signIn(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const ip = (headers().get("x-forwarded-for") ?? "unknown").split(",")[0];

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
    
  };
}

// 🟢 تسجيل الخروج
export async function signOut(): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  return { success: "Logged out successfully!" };
}
