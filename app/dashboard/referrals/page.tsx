// app/dashboard/referrals/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { processNewUserReferral } from "@/lib/actions/handle-referrals";
import ReferralsPage from "./ReferralsPage";

// Privacy helpers
function obscureName(name: string | null) {
  if (!name || name === "Unnamed") return "Hidden User";
  return name.split(" ").map((p) => p.charAt(0) + "***").join(" ");
}
function obscureEmail(email: string | null) {
  if (!email) return "Hidden";
  const [local, dom] = email.split("@");
  if (!dom) return email;
  return local.charAt(0) + "***@" + dom;
}

export default async function Page() {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) redirect("/auth/login");
  const user = session.user;

  // Always use admin client to bypass RLS for full data access
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Fetch current user's profile
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("uid", user.id)
    .single();

  // 2. Fetch commission rates
  const { data: dbRates } = await supabaseAdmin
    .from("referral_commission_rates")
    .select("*")
    .order("level", { ascending: true });

  const realRates = [10, 7, 3];
  if (dbRates && dbRates.length > 0) {
    dbRates.forEach((r: any) => {
      if (r.level === 1) realRates[0] = Number(r.percentage);
      if (r.level === 2) realRates[1] = Number(r.percentage);
      if (r.level === 3) realRates[2] = Number(r.percentage);
    });
  }

  // 3. Self-healing: Find all users who used this user's referral code
  //    but do not yet have a row in the referrals table
  if (profile?.referral_code) {
    const { data: codeUsers } = await supabaseAdmin
      .from("user_profiles")
      .select("uid, email, referral_code_used")
      .eq("referral_code_used", profile.referral_code);

    const { data: existingDirect } = await supabaseAdmin
      .from("referrals")
      .select("referred_id")
      .eq("referrer_id", user.id)
      .eq("level", 1);

    const alreadyLinked = new Set((existingDirect || []).map((r: any) => r.referred_id));

    for (const cu of (codeUsers || [])) {
      if (!alreadyLinked.has(cu.uid)) {
        // This user registered with our code but has no referrals row — bridge them!
        await processNewUserReferral(cu.uid, cu.email, cu.referral_code_used);
      }
    }
  }

  // 4. Fetch all referrals where this user is the referrer (all 3 levels)
  const { data: referralsRaw } = await supabaseAdmin
    .from("referrals")
    .select("id, referred_id, status, level, created_at")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const referrals = Array.isArray(referralsRaw) ? referralsRaw : [];

  // 5. Fetch referred users' profiles in one batch
  const referredIds = referrals.map((r: any) => r.referred_id).filter(Boolean);
  const referredProfilesMap: Record<string, any> = {};
  if (referredIds.length > 0) {
    const { data: referredProfiles } = await supabaseAdmin
      .from("user_profiles")
      .select("uid, full_name, email, referral_code")
      .in("uid", referredIds);
    (referredProfiles || []).forEach((p: any) => {
      referredProfilesMap[p.uid] = p;
    });
  }

  // 6. Fetch commissions for this user using REAL column names:
  //    referral_commissions: id, recipient_uid, source_uid, amount, percentage, level, type, created_at
  const { data: commissionsRaw } = await supabaseAdmin
    .from("referral_commissions")
    .select("id, amount, level, type, created_at, source_uid")
    .eq("recipient_uid", user.id)
    .order("created_at", { ascending: false });

  const commissionsForUser = Array.isArray(commissionsRaw) ? commissionsRaw : [];

  // 7. Build history for each referral
  const history = referrals.map((r: any) => {
    const p = referredProfilesMap[r.referred_id] || {};
    // Commission earned from this specific user (by source_uid match)
    const commissionFromUser = commissionsForUser
      .filter((c: any) => c.source_uid === r.referred_id)
      .reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);

    return {
      id: r.id,
      referred_uid: r.referred_id,
      referred_email: obscureEmail(p.email ?? null),
      username: obscureName(p.full_name ?? "Unnamed"),
      referral_code: p.referral_code ?? null,
      joinDate: r.created_at ? new Date(r.created_at).toISOString() : null,
      status: r.status === "active" ? "Active" : (r.status ?? "Inactive"),
      totalDeposits: 0,
      yourCommission: commissionFromUser,
      level: r.level ?? 1,
    };
  });

  // 8. Compute stats
  const totalInvites = referrals.length;
  const activeReferrals = history.filter((h) => h.status === "Active").length;
  const totalEarnings = commissionsForUser.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const depositEarnings = commissionsForUser.filter((c: any) => c.type === "deposit").reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const tradeEarnings = commissionsForUser.filter((c: any) => c.type === "trade").reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const packageEarnings = commissionsForUser.filter((c: any) => c.type === "package").reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const thisMonthIndex = new Date().getMonth();
  const thisMonthEarnings = commissionsForUser
    .filter((c: any) => c.created_at && new Date(c.created_at).getMonth() === thisMonthIndex)
    .reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);

  const stats = {
    referralsCount: totalInvites,
    totalInvites,
    activeReferrals,
    totalEarnings,
    depositEarnings,
    tradeEarnings,
    packageEarnings,
    thisMonthEarnings,
    commissionRate: realRates[0],
    lifetimeCommission: totalEarnings,
    commissionsTotal: totalEarnings,
  };

  // 9. Leaderboard — use real columns
  const { data: allCommissions } = await supabaseAdmin
    .from("referral_commissions")
    .select("recipient_uid, amount, created_at")
    .order("created_at", { ascending: false });

  const topMap: Record<string, { earnings: number; referrals: number }> = {};
  (allCommissions || []).forEach((c: any) => {
    const rid = c.recipient_uid;
    if (!rid) return;
    if (!topMap[rid]) topMap[rid] = { earnings: 0, referrals: 0 };
    topMap[rid].earnings += Number(c.amount ?? 0);
    topMap[rid].referrals += 1;
  });

  const topIds = Object.keys(topMap);
  const topProfilesMap: Record<string, any> = {};
  if (topIds.length > 0) {
    const { data: tp } = await supabaseAdmin
      .from("user_profiles")
      .select("uid, full_name")
      .in("uid", topIds);
    (tp || []).forEach((p: any) => (topProfilesMap[p.uid] = p));
  }

  const topReferrers = Object.entries(topMap)
    .map(([id, d], idx) => ({
      rank: 0,
      username: obscureName(topProfilesMap[id]?.full_name ?? "Unknown"),
      referrals: d.referrals,
      earnings: d.earnings,
      avatar: idx === 0 ? "👑" : idx === 1 ? "🏆" : idx === 2 ? "⭐" : "💎",
      isCurrentUser: id === user.id,
      uid: id,
    }))
    .sort((a, b) => b.earnings - a.earnings)
    .map((t, idx) => ({ ...t, rank: idx + 1 }))
    .slice(0, 10);

  // 10. Commission levels breakdown
  const levelsMap: Record<number, { users: number; earnings: number }> = {};
  referrals.forEach((r: any) => {
    const lvl = Number(r.level || 1);
    if (!levelsMap[lvl]) levelsMap[lvl] = { users: 0, earnings: 0 };
    levelsMap[lvl].users++;
  });
  commissionsForUser.forEach((c: any) => {
    const lvl = Number(c.level || 1);
    if (!levelsMap[lvl]) levelsMap[lvl] = { users: 0, earnings: 0 };
    levelsMap[lvl].earnings += Number(c.amount ?? 0);
  });

  const commissionLevels = [1, 2, 3].map((level) => {
    const d = levelsMap[level] || { users: 0, earnings: 0 };
    return { level, users: d.users, commission: realRates[level - 1] ?? 0, earnings: d.earnings };
  });

  return (
    <ReferralsPage
      user={user}
      profile={profile ?? null}
      history={history}
      commissions={commissionsForUser}
      topReferrers={topReferrers}
      commissionLevels={commissionLevels}
      stats={stats}
      rates={realRates}
    />
  );
}
