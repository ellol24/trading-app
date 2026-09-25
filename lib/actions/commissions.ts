"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Automatically processes referral commissions up to 3 levels deep
 * when a user deposits, earns a trading profit, or buys a package.
 *
 * Real DB schema (from live audit):
 * - referrals: id, referrer_id, referred_id, status, level, created_at
 * - referral_commissions: id, recipient_uid, source_uid, amount, percentage, level, metadata, created_at
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

        // 1. Fetch all ancestor referrals referencing this user (up to 3 levels)
        const { data: ancestors, error: ancestorsErr } = await supabaseAdmin
            .from("referrals")
            .select("id, referrer_id, level")
            .eq("referred_id", userId);

        if (ancestorsErr || !ancestors || ancestors.length === 0) {
            return { success: true, message: "No active referrers found." };
        }

        // 2. Fetch commission rates from the unified referral_commission_rates table
        const { data: dbRates } = await supabaseAdmin
            .from("referral_commission_rates")
            .select("*")
            .order("level", { ascending: true });

        // Default rates if table is empty
        const defaultRates: Record<number, number> = { 1: 10, 2: 7, 3: 3 };
        const rates: Record<number, number> = { ...defaultRates };

        if (dbRates && dbRates.length > 0) {
            dbRates.forEach((r: any) => {
                rates[r.level] = Number(r.percentage);
            });
        }

        // 3. Apply commissions for each ancestor
        for (const record of ancestors) {
            const lvl = record.level ?? 1;
            const percentage = rates[lvl] ?? 0;
            if (!percentage) continue;

            const commissionAmount = parseFloat(((baseAmount * percentage) / 100).toFixed(2));
            if (commissionAmount <= 0) continue;

            // A. Insert record into referral_commissions using REAL column names
            await supabaseAdmin.from("referral_commissions").insert({
                recipient_uid: record.referrer_id,
                source_uid: userId,
                amount: commissionAmount,
                percentage: percentage,
                level: lvl,
                metadata: { reason: commissionType },
            });

            // B. Add funds directly to referrer's balance on user_profiles
            const { data: referrer } = await supabaseAdmin
                .from("user_profiles")
                .select("balance, referral_earnings")
                .eq("uid", record.referrer_id)
                .single();

            if (referrer) {
                await supabaseAdmin
                    .from("user_profiles")
                    .update({
                        balance: (Number(referrer.balance) + commissionAmount),
                        referral_earnings: (Number(referrer.referral_earnings ?? 0) + commissionAmount),
                    })
                    .eq("uid", record.referrer_id);
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error("Failed to process referral commissions:", err);
        return { success: false, error: err.message };
    }
}
