"use server";

import { createClient } from "@supabase/supabase-js";
import { getServerAuth } from "@/lib/supabase/server";

export async function saveAdminSettings(
  depositRows: any[],
  tradeRows: any[],
  packageRows: any[],
  welcomeBonus: { enabled: boolean; amount: number }
) {
  try {
    // 1. Verify authentication
    const { user } = await getServerAuth();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // 2. Use the Service Role Key to bypass RLS!
    // This allows the admin settings to save even if no SQL policies explicitly allow it.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey.includes("placeholder")) {
      return { success: false, error: "Missing authentic Supabase admin credentials" };
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 3. Perform Upserts bypassing RLS
    // Add onConflict to tell Supabase how to upsert when no ID is provided
    const { error: depErr } = await supabaseAdmin.from("referral_commission_rates").upsert(depositRows, { onConflict: "level" });
    if (depErr) return { success: false, error: depErr.message };

    const { error: tradeErr } = await supabaseAdmin.from("trade_profit_commission_rates").upsert(tradeRows, { onConflict: "level" });
    if (tradeErr) return { success: false, error: tradeErr.message };

    const { error: pkgErr } = await supabaseAdmin.from("package_referral_commission_rates").upsert(packageRows, { onConflict: "level" });
    if (pkgErr) return { success: false, error: pkgErr.message };

    const { error: settingsErr } = await supabaseAdmin.from("system_settings").upsert({
      key: "welcome_bonus",
      value: { enabled: welcomeBonus.enabled, amount: welcomeBonus.amount },
      description: "Automatically applied welcome bonus for new user registrations",
      category: "user_management"
    }, { onConflict: "key" });
    if (settingsErr) return { success: false, error: settingsErr.message };

    return { success: true };
  } catch (error: any) {
    console.error("Server Action saveAdminSettings error:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}
