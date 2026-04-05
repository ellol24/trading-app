"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Automatically processes referral commissions up to 3 levels deep
 * when a user deposits, earns a trading profit, or buys a package.
 */
export async function processReferralCommissions(
    userId: string, 
    baseAmount: number, 
    commissionType: "deposit" | "trade" | "package"
) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing Supabase credentials for commissions.");
            return { success: false, error: "Missing config" };
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });

        // Determine which rates table to query
        let tableName = "referral_commission_rates";
        if (commissionType === "trade") tableName = "trade_profit_commission_rates";
        if (commissionType === "package") tableName = "package_referral_commission_rates";

        // 1. Fetch active rates
        const { data: dbRates } = await supabaseAdmin
            .from(tableName)
            .select("*")
            .order("level", { ascending: true });

        const rates = [0, 0, 0]; // Default fallback percentages map
        if (dbRates && dbRates.length > 0) {
            dbRates.forEach((r: any) => {
                if (r.level === 1) rates[0] = Number(r.percentage);
                if (r.level === 2) rates[1] = Number(r.percentage);
                if (r.level === 3) rates[2] = Number(r.percentage);
            });
        }

        // Fetch all ancestor referrals referencing this user
        const { data: ancestors, error: ancestorsErr } = await supabaseAdmin
            .from("referrals")
            .select("id, referrer_id, level")
            .eq("referred_id", userId);

        if (ancestorsErr || !ancestors || ancestors.length === 0) {
            return { success: true, message: "No active referrers found." };
        }

        // Apply commissions concurrently
        for (const record of ancestors) {
            const lvl = record.level ?? 1;
            const percentage = rates[lvl - 1];
            if (!percentage) continue;

            const commissionAmount = parseFloat(((baseAmount * percentage) / 100).toFixed(2));
            if (commissionAmount > 0) {
                // A. Insert record into `referral_commissions`
                await supabaseAdmin.from("referral_commissions").insert({
                    referral_id: record.id,
                    commission_amount: commissionAmount,
                    level: lvl
                });

                // B. Add funds directly to referrer's wallet
                await supabaseAdmin.rpc("update_wallet_balance", {
                    p_user_id: record.referrer_id,
                    p_currency: "USD",
                    p_amount: commissionAmount,
                    p_transaction_type: "referral_commission",
                });
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error("Failed to process deposit commissions:", err);
        return { success: false, error: err.message };
    }
}
