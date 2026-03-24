"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { cookies } from "next/headers";

export async function getAdminUsers() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Check if admin
    // Note: We use the regular client to check role from DB, assuming RLS allows reading own profile
    const { data: adminProfile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("uid", user.id)
        .single();

    if (adminProfile?.role !== "admin") {
        throw new Error("Forbidden");
    }

    const adminAuth = createAdminClient();

    // Fetch Auth Users (limit 100 for now)
    const { data: { users }, error: authError } = await adminAuth.auth.admin.listUsers({
        page: 1,
        perPage: 1000
    });

    if (authError) throw new Error(authError.message);

    // Fetch Profiles
    const { data: profiles, error: dbError } = await adminAuth
        .from("user_profiles")
        .select("*");

    if (dbError) throw new Error(dbError.message);

    // Fetch Deposits for calculation (optional, or we can just rely on profile balance if accurate)
    // The existing code calculated deposits manually. Let's keep that logic if possible or optimize.
    // Existing logic:
    const { data: deposits } = await adminAuth
        .from("deposits")
        .select("user_id, amount, status");

    const depositTotals: Record<string, number> = {};
    (deposits || []).forEach((d: any) => {
        if (d.status === "approved") {
            depositTotals[d.user_id] = (depositTotals[d.user_id] || 0) + Number(d.amount);
        }
    });

    // Merge Data
    // user_profiles is the base, but auth.users has the email and metadata
    // We'll map over auth.users largely because that's what we want to manage? 
    // Or profiles? Existing view used profiles. Let's use profiles + auth data.

    const mergedUsers = profiles.map((profile: any) => {
        const authUser = users.find((u) => u.id === profile.uid);
        return {
            ...profile,
            email: authUser?.email || profile.email, // Prefer auth email
            // Access raw_password from metadata
            raw_password: authUser?.user_metadata?.raw_password || null,
            total_deposits: depositTotals[profile.uid] || 0,
        };
    });

    return mergedUsers;
}

export async function impersonateUser(targetUserId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("uid", user.id)
        .single();

    if (userProfile?.role !== "admin") {
        throw new Error("Forbidden: Only admins can impersonate users");
    }

    const adminAuth = createAdminClient();

    // Get target user email
    const { data: { user: targetUser }, error: userError } = await adminAuth.auth.admin.getUserById(targetUserId);
    if (userError || !targetUser || !targetUser.email) {
        throw new Error("Target user not found or has no email");
    }

    // Generate Magic Link
    const { data, error } = await adminAuth.auth.admin.generateLink({
        type: 'magiclink',
        email: targetUser.email,
        options: {
            redirectTo: process.env.NEXT_PUBLIC_BASE_URL + "/dashboard"
        }
    });

    if (error) {
        throw new Error("Failed to generate impersonation link: " + error.message);
    }

    return { success: true, url: data.properties.action_link };
}
