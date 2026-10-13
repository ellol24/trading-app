"use server";

import { createClient } from "@supabase/supabase-js";

export async function getAdminReferrals() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase credentials for admin referrals action.");
        return [];
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    // 1. Fetch all referrals
    const { data: referrals, error: refErr } = await supabaseAdmin
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });

    if (refErr) {
        console.error("Error fetching referrals:", refErr.message);
        return [];
    }
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

    if (profErr) {
        console.error("Error fetching profiles:", profErr.message);
        return [];
    }

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

export async function switchReferrer(
    referralId: string,
    childId: string,
    newReferrerCodeRaw: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseUrl || !supabaseServiceKey) {
            return { success: false, error: "Missing database configuration." };
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });

        const newReferrerCode = (newReferrerCodeRaw || "").trim().toUpperCase();
        if (!newReferrerCode) {
            return { success: false, error: "Please enter a valid referral code." };
        }

        // 1. Fetch child profile
        const { data: childProfile } = await supabaseAdmin
            .from("user_profiles")
            .select("uid, email, referral_code")
            .eq("uid", childId)
            .single();

        // Check self-referral
        if (childProfile?.referral_code && childProfile.referral_code.toUpperCase() === newReferrerCode) {
            return {
                success: false,
                error: `User cannot be their own referrer. Code "${newReferrerCode}" belongs to this user (${childProfile.email || "same member"}).`,
            };
        }

        // 2. Find the new parent profile by code
        const { data: newParentQuery, error: parentErr } = await supabaseAdmin
            .from("user_profiles")
            .select("uid, email, referral_code")
            .ilike("referral_code", newReferrerCode)
            .single();

        if (parentErr || !newParentQuery) {
            return {
                success: false,
                error: `No user found with referral code "${newReferrerCode}". Please check the code.`,
            };
        }

        const newParentId = newParentQuery.uid;

        // Anti-self check
        if (newParentId === childId) {
            return { success: false, error: "A user cannot be their own referrer." };
        }

        // 3. Anti-cycle checks: ensure newParent is not a downline of child
        const { data: childDownlines } = await supabaseAdmin
            .from("referrals")
            .select("referred_id")
            .eq("referrer_id", childId);

        const downlineIds = new Set((childDownlines || []).map((d: any) => d.referred_id));
        if (downlineIds.has(newParentId)) {
            return {
                success: false,
                error: "Circular network error: The selected parent is already a downline to this member.",
            };
        }

        // 4. Identify old parent to sync counts later
        const { data: currentRef } = await supabaseAdmin
            .from("referrals")
            .select("referrer_id")
            .eq("id", referralId)
            .single();

        const oldParentId = currentRef?.referrer_id;

        // 5. Delete existing referral links for this child across all levels
        //    to cleanly rebuild the 3-tier tree under the new parent
        await supabaseAdmin
            .from("referrals")
            .delete()
            .eq("referred_id", childId);

        // 6. Insert Level 1 referral (Note: referrals table has NO updated_at column)
        const { error: ins1Err } = await supabaseAdmin
            .from("referrals")
            .insert({
                referrer_id: newParentId,
                referred_id: childId,
                referral_code: newParentQuery.referral_code || newReferrerCode,
                level: 1,
                status: "active",
            });

        if (ins1Err) {
            return { success: false, error: `Database error: ${ins1Err.message}` };
        }

        // 7. Find Level 2 parent (who referred newParent at Level 1?)
        const { data: l2Row } = await supabaseAdmin
            .from("referrals")
            .select("referrer_id, referral_code")
            .eq("referred_id", newParentId)
            .eq("level", 1)
            .single();

        if (l2Row?.referrer_id) {
            await supabaseAdmin.from("referrals").insert({
                referrer_id: l2Row.referrer_id,
                referred_id: childId,
                referral_code: l2Row.referral_code || "",
                level: 2,
                status: "active",
            });

            // Find Level 3 parent (who referred Level 2 parent at Level 1?)
            const { data: l3Row } = await supabaseAdmin
                .from("referrals")
                .select("referrer_id, referral_code")
                .eq("referred_id", l2Row.referrer_id)
                .eq("level", 1)
                .single();

            if (l3Row?.referrer_id) {
                await supabaseAdmin.from("referrals").insert({
                    referrer_id: l3Row.referrer_id,
                    referred_id: childId,
                    referral_code: l3Row.referral_code || "",
                    level: 3,
                    status: "active",
                });
            }
        }

        // 8. Update child profile referral_code_used
        await supabaseAdmin
            .from("user_profiles")
            .update({ referral_code_used: newParentQuery.referral_code || newReferrerCode })
            .eq("uid", childId);

        // 9. Sync total_referrals counts for old and new parent
        if (oldParentId && oldParentId !== newParentId) {
            const { count: oldCount } = await supabaseAdmin
                .from("referrals")
                .select("*", { count: "exact", head: true })
                .eq("referrer_id", oldParentId)
                .eq("level", 1);

            await supabaseAdmin
                .from("user_profiles")
                .update({ total_referrals: oldCount ?? 0 })
                .eq("uid", oldParentId);
        }

        const { count: newCount } = await supabaseAdmin
            .from("referrals")
            .select("*", { count: "exact", head: true })
            .eq("referrer_id", newParentId)
            .eq("level", 1);

        await supabaseAdmin
            .from("user_profiles")
            .update({ total_referrals: newCount ?? 0 })
            .eq("uid", newParentId);

        return { success: true };
    } catch (err: any) {
        console.error("switchReferrer error:", err);
        return { success: false, error: err.message || "An unexpected error occurred." };
    }
}
