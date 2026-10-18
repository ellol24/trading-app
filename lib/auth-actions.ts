"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { headers, cookies } from "next/headers";
import { processNewUserReferral } from "./actions/handle-referrals";
import { sendEmail } from "@/lib/email";

// ✅ تعريف ActionState
export type ActionState = {
  error?: string;
  success?: string;
  userId?: string;
  role?: string;
  requiresVerification?: boolean;
  verified?: boolean;
  email?: string;
};

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

async function sendVerificationEmail(to: string, fullName: string, otp: string) {
  return sendEmail({
    to,
    subject: "🔐 Your Verification Code – Xspy Trader",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 0;">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:28px 36px;text-align:center;border-bottom:1px solid #1e293b;">
                  <p style="margin:0;font-size:22px;font-weight:700;color:#60a5fa;letter-spacing:1px;">🔐 Xspy Trader</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#64748b;">Account Security Verification</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px 36px;">
                  <p style="margin:0 0 8px;font-size:15px;color:#cbd5e1;">Hello <strong style="color:#e2e8f0;">${fullName || "Trader"}</strong>,</p>
                  <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
                    Thank you for signing up with Xspy Trader. To verify your email address and activate your account, please enter the one-time code below:
                  </p>
                  <!-- OTP Block -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#1e3a5f;border:1px solid #3b82f6;border-radius:12px;padding:28px;text-align:center;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#60a5fa;letter-spacing:2px;text-transform:uppercase;">Your Verification Code</p>
                        <p style="margin:12px 0 4px;font-size:48px;font-weight:900;letter-spacing:14px;color:#ffffff;font-variant-numeric:tabular-nums;">${otp}</p>
                        <p style="margin:8px 0 0;font-size:12px;color:#f59e0b;">⏱ Expires in 15 minutes</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
                    If you did not request this account, please disregard this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 36px;border-top:1px solid #1e293b;text-align:center;">
                  <p style="margin:0;font-size:11px;color:#334155;">© 2025 Xspy Trader · <a href="https://xspy-trader.com" style="color:#475569;text-decoration:none;">xspy-trader.com</a></p>
                  <p style="margin:4px 0 0;font-size:10px;color:#1e293b;">Sent from no-reply@xspy-trader.com</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
}

async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  const normalized = email.trim().toLowerCase();

  // 1. Try finding by user_profiles
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("uid")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.uid) {
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(profile.uid);
    if (user) return user;
  }

  // 2. Fallback: scan user list in auth
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!error && users) {
    const match = users.find((u: any) => u.email?.toLowerCase() === normalized);
    if (match) return match;
  }

  return null;
}

// 🟢 تسجيل حساب جديد — sends 6-digit OTP verification email via Resend
export async function signUp(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const fullName = (formData.get("fullName") as string)?.trim();
  const rawEmail = (formData.get("email") as string)?.trim();
  const email = rawEmail?.toLowerCase();
  const password = formData.get("password") as string;
  const referralCodeUsed = (formData.get("referralCode") as string)?.trim() || null;

  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }

  const ip = (headers().get("x-forwarded-for") ?? "unknown").split(",")[0];

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    // Check if user already exists
    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (existingUser) {
      if (existingUser.email_confirmed_at) {
        return { error: "An account with this email already exists. Please sign in." };
      }

      // Unconfirmed account re-registering: issue fresh OTP and resend
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: {
          ...existingUser.user_metadata,
          full_name: fullName,
          raw_password: password,
          ip_address: ip,
          email_otp: otp,
          email_otp_expires_at: expiresAt.toISOString(),
        },
      });

      await sendVerificationEmail(email, fullName, otp);

      return {
        success: "A 6-digit verification code has been sent to your email.",
        requiresVerification: true,
        email,
      };
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create user unconfirmed — email_confirm: false
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        referral_code_used: referralCodeUsed,
        ip_address: ip,
        raw_password: password,
        email_otp: otp,
        email_otp_expires_at: expiresAt.toISOString(),
      },
    });

    if (error) {
      return { error: error.message };
    }

    // Process referral tree
    if (data?.user && referralCodeUsed) {
      await processNewUserReferral(data.user.id, data.user.email ?? email, referralCodeUsed);
    }

    // Send welcome notification (after profile is created by trigger)
    if (data?.user) {
      try {
        const { data: welcomeSetting } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", "welcome_message")
          .single();

        if (welcomeSetting?.value?.enabled !== false) {
          const val = welcomeSetting?.value || {};
          const title = val.title ?? "Welcome to Xspy Trader! 🚀";
          const message = val.message ?? "We're excited to have you! Start earning today through trading sessions, investment packages, and our referral program.";
          const translations = val.translations || null;
          // Insert via service role directly
          await supabaseAdmin.from("notifications").insert({
            user_id: data.user.id,
            type: "welcome",
            title,
            message,
            metadata: { type: "welcome", ...(translations ? { translations } : {}) },
          });
        }
      } catch {
        // Silently ignore — welcome notification is non-critical
      }
    }

    // Send verification email via Resend
    await sendVerificationEmail(email, fullName, otp);

    return {
      success: "Account created! A 6-digit verification code has been sent to your email.",
      requiresVerification: true,
      email,
    };
  } catch (err: any) {
    console.error("Signup Catch Error:", err);
    return { error: err.message || "An unexpected network or server error occurred during signup." };
  }
}

// 🟢 تأكيد كود التحقق وتفعيل الحساب
export async function verifyAccountOtp(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const otp = (formData.get("otp") as string)?.trim();
  const password = (formData.get("password") as string) || "";

  if (!email || !otp) {
    return { error: "Please enter both your email address and the 6-digit verification code." };
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    const user = await findAuthUserByEmail(supabaseAdmin, email);
    if (!user) {
      return { error: "No account found with this email address." };
    }

    if (user.email_confirmed_at) {
      return {
        success: "Your account is already verified! You can sign in.",
        verified: true,
        email,
      };
    }

    const storedOtp = user.user_metadata?.email_otp;
    const expiresAt = user.user_metadata?.email_otp_expires_at;

    if (!storedOtp) {
      return { error: "No verification code was requested. Please click 'Resend Code'." };
    }

    if (storedOtp !== otp) {
      return { error: "Invalid verification code. Please check your email and try again." };
    }

    if (expiresAt && new Date() > new Date(expiresAt)) {
      return { error: "Verification code has expired. Please request a new code." };
    }

    // Confirm the user in Supabase auth and remove the used OTP
    const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        email_otp: null,
        email_otp_expires_at: null,
      },
    });

    if (confirmErr) {
      console.error("Confirmation error:", confirmErr);
      return { error: "Failed to confirm account: " + confirmErr.message };
    }

    // If password was also provided, sign them in immediately
    if (password) {
      const supabase = createClient();
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInErr && signInData?.user) {
        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("role")
          .eq("uid", user.id)
          .single();

        return {
          success: "Account verified and logged in successfully!",
          userId: user.id,
          role: profile?.role || "user",
          verified: true,
        };
      }
    }

    return {
      success: "Your account has been verified successfully! You can now log in.",
      verified: true,
      email,
    };
  } catch (err: any) {
    console.error("Verify OTP Catch Error:", err);
    return { error: err.message || "An unexpected error occurred during verification." };
  }
}

// 🟢 إعادة إرسال كود التحقق
export async function resendVerificationCode(email: string): Promise<ActionState> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { error: "Please provide a valid email address." };
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    const user = await findAuthUserByEmail(supabaseAdmin, normalized);
    if (!user) {
      return { error: "No account found with this email address." };
    }

    if (user.email_confirmed_at) {
      return { success: "Account is already verified! Please sign in.", verified: true, email: normalized };
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        email_otp: otp,
        email_otp_expires_at: expiresAt.toISOString(),
      },
    });

    await sendVerificationEmail(normalized, user.user_metadata?.full_name || "Trader", otp);

    return { success: "A new verification code has been sent to your email.", email: normalized };
  } catch (err: any) {
    console.error("Resend Catch Error:", err);
    return { error: err.message || "Failed to resend verification code." };
  }
}

// 🟢 تسجيل الدخول
export async function signIn(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = createClient();

  const email = (formData.get("email") as string)?.trim().toLowerCase();
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
      // If user is unconfirmed, automatically dispatch a code and guide them to verify
      if (error.message.toLowerCase().includes("email not confirmed")) {
        const supabaseAdmin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );
        const user = await findAuthUserByEmail(supabaseAdmin, email);
        if (user) {
          const otp = generateOtp();
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...user.user_metadata,
              email_otp: otp,
              email_otp_expires_at: expiresAt.toISOString(),
            },
          });
          await sendVerificationEmail(email, user.user_metadata?.full_name || "Trader", otp);
        }

        return {
          error: "Your email is not verified yet. We have sent a verification code to your email.",
          requiresVerification: true,
          email,
        };
      }

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
      role: role || "user",
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
