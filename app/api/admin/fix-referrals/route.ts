// app/api/admin/fix-referrals/route.ts
// ⚠️ ADMIN ONLY - PROTECTED ENDPOINT
// Audits the referrals table and backfills any missing rows from user_profiles

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
    // Simple secret guard - caller must pass ?secret=FIX2026
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== "FIX2026") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const report: any = {
        user_profiles: [],
        referrals_before: [],
        referral_commissions: [],
        referral_commission_rates: [],
        users_with_referral_code: [],
        missing_bridged: [],
        errors: [],
    };

    // 1. Fetch all user_profiles
    const { data: allProfiles, error: pe } = await supabaseAdmin
        .from("user_profiles")
        .select("uid, email, referral_code, referral_code_used, total_referrals, referral_earnings")
        .order("created_at", { ascending: false });

    if (pe) report.errors.push({ source: "user_profiles", error: pe });
    report.user_profiles = allProfiles || [];

    // 2. Fetch current referrals table
    const { data: existingReferrals, error: re } = await supabaseAdmin
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });

    if (re) report.errors.push({ source: "referrals", error: re });
    report.referrals_before = existingReferrals || [];

    // 3. Fetch commission rates
    const { data: rates, error: rte } = await supabaseAdmin
        .from("referral_commission_rates")
        .select("*");
    if (rte) report.errors.push({ source: "referral_commission_rates", error: rte });
    report.referral_commission_rates = rates || [];

    // 4. Fetch commissions
    const { data: comms, error: ce } = await supabaseAdmin
        .from("referral_commissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
    if (ce) report.errors.push({ source: "referral_commissions", error: ce });
    report.referral_commissions = comms || [];

    // 5. Find users who registered with a referral code
    const usersWithCode = (allProfiles || []).filter((u: any) => u.referral_code_used);
    report.users_with_referral_code = usersWithCode;

    // 6. Build a referral code → uid lookup map
    const codeToUid: Record<string, string> = {};
    (allProfiles || []).forEach((u: any) => {
        if (u.referral_code) codeToUid[u.referral_code] = u.uid;
    });

    // 7. For each user who used a code, check if they have a referrals row
    const existingReferredIds = new Set((existingReferrals || []).map((r: any) => r.referred_id + "|" + r.level));

    for (const user of usersWithCode) {
        const code = user.referral_code_used;
        const level1Uid = codeToUid[code];

        if (!level1Uid) {
            report.missing_bridged.push({ email: user.email, code, error: "code_not_found_in_profiles" });
            continue;
        }

        // Check / insert Level 1
        if (!existingReferredIds.has(user.uid + "|1")) {
            const { error: ins1 } = await supabaseAdmin.from("referrals").insert({
                referrer_id: level1Uid,
                referred_id: user.uid,
                referred_email: user.email,
                status: "active",
                level: 1,
            }).select();
            report.missing_bridged.push({ referred: user.email, level: 1, referrer_uid: level1Uid, inserted: !ins1, error: ins1?.message });
        }

        // Find level 2 referrer (who referred level1Uid at level 1?)
        const level2Row = (existingReferrals || []).find((r: any) => r.referred_id === level1Uid && r.level === 1);
        const level2Uid = level2Row?.referrer_id;

        if (level2Uid && !existingReferredIds.has(user.uid + "|2")) {
            const { error: ins2 } = await supabaseAdmin.from("referrals").insert({
                referrer_id: level2Uid,
                referred_id: user.uid,
                referred_email: user.email,
                status: "active",
                level: 2,
            }).select();
            report.missing_bridged.push({ referred: user.email, level: 2, referrer_uid: level2Uid, inserted: !ins2, error: ins2?.message });
        }

        // Find level 3 referrer
        const level3Row = level2Uid ? (existingReferrals || []).find((r: any) => r.referred_id === level2Uid && r.level === 1) : null;
        const level3Uid = level3Row?.referrer_id;

        if (level3Uid && !existingReferredIds.has(user.uid + "|3")) {
            const { error: ins3 } = await supabaseAdmin.from("referrals").insert({
                referrer_id: level3Uid,
                referred_id: user.uid,
                referred_email: user.email,
                status: "active",
                level: 3,
            }).select();
            report.missing_bridged.push({ referred: user.email, level: 3, referrer_uid: level3Uid, inserted: !ins3, error: ins3?.message });
        }
    }

    // 8. Fetch final referrals state after backfill
    const { data: finalReferrals } = await supabaseAdmin
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });

    report.referrals_after = finalReferrals || [];

    return NextResponse.json(report, { status: 200 });
}
