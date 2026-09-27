"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Processes referral commissions up to 3 levels deep.
 *
 * Commission types:
 * - "deposit"  → uses referral_commission_rates table
 * - "trade"    → uses trade_profit_commission_rates table
 * - "package"  → uses package_referral_commission_rates table
 *
 * Real DB schema:
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
            console.error("[Commissions] Missing Supabase credentials.");
            return { success: false, error: "Missing config" };
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });

        // 1. Fetch all ancestor referrals for this user (up to 3 levels)
        const { data: ancestors, error: ancestorsErr } = await supabaseAdmin
            .from("referrals")
            .select("id, referrer_id, level")
            .eq("referred_id", userId)
            .eq("status", "active");

        if (ancestorsErr) {
            console.error("[Commissions] Error fetching ancestors:", ancestorsErr.message);
            return { success: false, error: ancestorsErr.message };
        }

        if (!ancestors || ancestors.length === 0) {
            return { success: true, message: "No active referrers found." };
        }

        // 2. Fetch commission rates from the correct table based on type
        const rateTable =
            commissionType === "package"
                ? "package_referral_commission_rates"
                : commissionType === "trade"
                ? "trade_profit_commission_rates"
                : "referral_commission_rates";

        const { data: dbRates, error: ratesErr } = await supabaseAdmin
            .from(rateTable)
            .select("level, percentage")
            .order("level", { ascending: true });

        if (ratesErr) {
            console.error(`[Commissions] Error fetching rates from ${rateTable}:`, ratesErr.message);
        }

        // Default rates fallback
        const defaultRates: Record<number, number> = { 1: 10, 2: 5, 3: 2 };
        const rates: Record<number, number> = { ...defaultRates };

        if (dbRates && dbRates.length > 0) {
            dbRates.forEach((r: any) => {
                rates[Number(r.level)] = Number(r.percentage);
            });
        }

        // 3. Apply commissions for each ancestor level (max 3 levels)
        let commissionsGranted = 0;
        for (const record of ancestors) {
            const lvl = Number(record.level ?? 1);
            if (lvl > 3) continue; // Only process up to 3 levels

            const percentage = rates[lvl] ?? 0;
            if (!percentage) continue;

            const commissionAmount = parseFloat(((baseAmount * percentage) / 100).toFixed(2));
            if (commissionAmount <= 0) continue;

            // A. Insert into referral_commissions for tracking
            const { error: insertErr } = await supabaseAdmin
                .from("referral_commissions")
                .insert({
                    recipient_uid: record.referrer_id,
                    source_uid: userId,
                    amount: commissionAmount,
                    percentage: percentage,
                    level: lvl,
                    metadata: { reason: commissionType, base_amount: baseAmount },
                });

            if (insertErr) {
                console.error(`[Commissions] Error inserting commission record (L${lvl}):`, insertErr.message);
                continue;
            }

            // B. Add funds to referrer's balance
            const { data: referrer, error: refFetchErr } = await supabaseAdmin
                .from("user_profiles")
                .select("balance, referral_earnings")
                .eq("uid", record.referrer_id)
                .single();

            if (refFetchErr || !referrer) {
                console.error(`[Commissions] Referrer profile not found for ${record.referrer_id}:`, refFetchErr?.message);
                continue;
            }

            const { error: updateErr } = await supabaseAdmin
                .from("user_profiles")
                .update({
                    balance: Number(referrer.balance ?? 0) + commissionAmount,
                    referral_earnings: Number(referrer.referral_earnings ?? 0) + commissionAmount,
                })
                .eq("uid", record.referrer_id);

            if (updateErr) {
                console.error(`[Commissions] Error updating referrer balance (L${lvl}):`, updateErr.message);
            } else {
                commissionsGranted++;
                console.log(
                    `[Commissions] L${lvl} ${commissionType} commission: $${commissionAmount} → ${record.referrer_id}`
                );
            }
        }

        return { success: true, commissionsGranted };
    } catch (err: any) {
        console.error("[Commissions] Unexpected error:", err.message);
        return { success: false, error: err.message };
    }
}
