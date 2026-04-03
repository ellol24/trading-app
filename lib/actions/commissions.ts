"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Automatically processes referral commissions up to 3 levels deep
 * when a user's deposit is approved.
 */
export async function processDepositCommissions(userId: string, depositAmount: number) {
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

        // 1. Fetch active deposit rates
        const { data: dbRates } = await supabaseAdmin
            .from("referral_commission_rates")
            .select("*")
            .order("level", { ascending: true });

        const rates = [10, 7, 3]; // Default fallback percentages map
        if (dbRates && dbRates.length > 0) {
            dbRates.forEach((r: any) => {
                if (r.level === 1) rates[0] = Number(r.percentage);
                if (r.level === 2) rates[1] = Number(r.percentage);
                if (r.level === 3) rates[2] = Number(r.percentage);
            });
        }

        // Process up to 3 levels of referrals recursively
        let currentReferredId = userId;

        for (let level = 1; level <= 3; level++) {
            // Find who referred the current user
            const { data: referralRow, error: refError } = await supabaseAdmin
                .from("referrals")
                .select("id, referrer_id")
                .eq("referred_id", currentReferredId)
                .single();

            if (refError || !referralRow || !referralRow.referrer_id) {
                // No parent referrer found (chain broken), stop distributing.
                break;
            }

            const referrerId = referralRow.referrer_id;
            const commissionAmount = parseFloat(((depositAmount * rates[level - 1]) / 100).toFixed(2));

            if (commissionAmount > 0) {
                // A. Insert record into `referral_commissions` using `id` from the `referrals` table
                await supabaseAdmin.from("referral_commissions").insert({
                    referral_id: referralRow.id,
                    commission_amount: commissionAmount,
                    level: level
                });

                // B. Add funds directly to referrer's wallet
                await supabaseAdmin.rpc("update_wallet_balance", {
                    p_user_id: referrerId,
                    p_currency: "USD", // System typically holds commissions in USD
                    p_amount: commissionAmount,
                    p_transaction_type: "referral_commission",
                });
            }

            // Move up the tree for the next level: The parent becomes the new child
            currentReferredId = referrerId;
        }

        return { success: true };
    } catch (err: any) {
        console.error("Failed to process deposit commissions:", err);
        return { success: false, error: err.message };
    }
}
