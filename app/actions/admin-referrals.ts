"use server";

import { createClient } from "@supabase/supabase-js";

export async function getAdminReferrals() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase credentials for admin referrals action.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    // 1. Fetch all referrals
    const { data: referrals, error: refErr } = await supabaseAdmin
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });

    if (refErr) throw new Error(refErr.message);
    if (!referrals || referrals.length === 0) return [];

    // 2. Fetch all unique profiles
    const profileIds = new Set<string>();
    referrals.forEach((r: any) => {
        if (r.referrer_id) profileIds.add(r.referrer_id);
        if (r.referred_id) profileIds.add(r.referred_id);
    });

    const { data: profiles, error: profErr } = await supabaseAdmin
        .from("user_profiles")
        .select("uid, email, full_name, referral_code")
        .in("uid", Array.from(profileIds));

    if (profErr) throw new Error(profErr.message);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
        profileMap[p.uid] = p;
    });

    // 3. Map into AdminReferralData
    return referrals.map((r: any) => {
        const parent = profileMap[r.referrer_id] || {};
        const child = profileMap[r.referred_id] || {};

        return {
            id: r.id,
            referrer_id: r.referrer_id,
            referred_id: r.referred_id,
            level: r.level,
            status: r.status,
            created_at: r.created_at,
            referrer_email: parent.email || "Unknown",
            referrer_name: parent.full_name || "Unknown",
            referrer_code: parent.referral_code || "—",
            referred_email: child.email || "Unknown",
            referred_name: child.full_name || "Unknown",
            referred_code: child.referral_code || "—",
        };
    });
}

export async function switchReferrer(referralId: string, childId: string, newReferrerCode: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    // 1. Find the new parent profile by code
    const { data: newParentQuery, error: parentErr } = await supabaseAdmin
        .from("user_profiles")
        .select("uid, email")
        .eq("referral_code", newReferrerCode)
        .single();

    if (parentErr || !newParentQuery) {
        throw new Error("Could not find a user with the provided referral code.");
    }

    const newParentId = newParentQuery.uid;

    // 2. Anti-cycle checks
    if (newParentId === childId) {
        throw new Error("A user cannot be their own referrer.");
    }

    // Check if new parent is a descendant of the child (prevents circular loops)
    // Simple check for 1 level deep:
    const { data: childDownline } = await supabaseAdmin
        .from("referrals")
        .select("referred_id")
        .eq("referrer_id", childId)
        .eq("referred_id", newParentId);

    if (childDownline && childDownline.length > 0) {
        throw new Error("Circular reference detected. The new parent is currently downline to this user.");
    }

    // 3. Update the referral
    const { error: updateErr } = await supabaseAdmin
        .from("referrals")
        .update({
            referrer_id: newParentId,
            level: 1, // Reset level to 1 for direct switches
            updated_at: new Date().toISOString()
        })
        .eq("id", referralId);

    if (updateErr) {
        throw new Error("Database error: " + updateErr.message);
    }

    // 4. Update the child's `referral_code_used` on their profile
    await supabaseAdmin
        .from("user_profiles")
        .update({ referral_code_used: newReferrerCode })
        .eq("uid", childId);

    return { success: true };
}
