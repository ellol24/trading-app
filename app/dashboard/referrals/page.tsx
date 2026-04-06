// app/dashboard/referrals/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { processNewUserReferral } from "@/lib/actions/handle-referrals";
import ReferralsPage from "./ReferralsPage";

// Privacy helper functions
function obscureName(name: string | null) {
  if (!name || name === "Unnamed") return "Hidden User";
  const parts = name.split(" ");
  return parts.map(p => p.charAt(0) + "***").join(" ");
}

function obscureEmail(email: string | null) {
  if (!email) return "Hidden";
  const [local, dom] = email.split("@");
  if (!dom) return email;
  return local.charAt(0) + "***@" + dom;
}

export default async function Page() {
  const supabase = createClient();

  // جلب session و user من السيرفر (الكوكيز)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Supabase getSession error:", sessionError);
  }
  if (!session || !session.user) {
    redirect("/auth/login");
  }
  const user = session.user;

  // جلب profile, referrals, commissions (قيمة الحقول قد تحتاج تعديل حسب schema)
  const [
    { data: profile, error: profileError },
    { data: referralsRaw, error: referralsError },
    { data: commissionsRaw, error: commissionsError },
    { data: dbRates },
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("uid", user.id).single(),
    supabase
      .from("referrals")
      .select("id, referred_id, referred_email, referral_code, created_at, status, level")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    // تجمع عمولات المستخدم المرتبطة بكونه referrer: في بعض DBs قد تختلف الشروط / المفاتيح
    supabase
      .from("referral_commissions")
      .select("id, commission_amount, created_at, referral_id, level, referrals(referrer_id)")
      .eq("referrals.referrer_id", user.id),
    supabase.from("referral_commission_rates").select("*").order("level", { ascending: true }),
  ]);

  const realRates = [10, 7, 3]; // defaults
  if (dbRates && dbRates.length > 0) {
    dbRates.forEach((r: any) => {
      if (r.level === 1) realRates[0] = Number(r.percentage);
      if (r.level === 2) realRates[1] = Number(r.percentage);
      if (r.level === 3) realRates[2] = Number(r.percentage);
    });
  }

  if (profileError) console.error("profileError:", profileError);
  if (referralsError) console.error("referralsError:", referralsError);
  if (commissionsError) console.error("commissionsError:", commissionsError);

  let referrals = Array.isArray(referralsRaw) ? referralsRaw : [];

  // ================= SELF-HEALING BLOCK =================
  // If the user has legacy users bridging their referral code, but no actual DB rows in `referrals`!
  // We MUST use supabaseAdmin here to bypass Row Level Security (RLS) on user_profiles!
  if (profile?.referral_code) {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: missingLegacy } = await supabaseAdmin
      .from("user_profiles")
      .select("uid, email, referral_code_used")
      .eq("referral_code_used", profile.referral_code);

    let needsRefetch = false;
    if (missingLegacy && missingLegacy.length > 0) {
      for (const missing of missingLegacy) {
        if (!referrals.some((r: any) => r.referred_id === missing.uid)) {
          // Found a direct referral missing their DB row! Build the robust tree silently.
          await processNewUserReferral(missing.uid, missing.email, missing.referral_code_used);
          needsRefetch = true;
        }
      }
    }

    // Automatically re-sync after healing.
    if (needsRefetch) {
      const { data: healed } = await supabase
        .from("referrals")
        .select("id, referred_id, referred_email, referral_code, created_at, status, level")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      if (healed) referrals = healed;
    }
  }
  // =======================================================

  // جلب بروفايلات المـحالين دفعة واحدة (names/emails)
  const referredIds = referrals.map((r: any) => r.referred_id).filter(Boolean);
  let referredProfilesMap: Record<string, any> = {};
  if (referredIds.length > 0) {
    const { data: referredProfiles, error: profErr } = await supabase
      .from("user_profiles")
      .select("uid, full_name, email, referral_code")
      .in("uid", referredIds);
    if (profErr) console.error("referredProfiles err:", profErr);
    (referredProfiles || []).forEach((p: any) => {
      referredProfilesMap[p.uid] = p;
    });
  }

  // جمع عمولات لكل referral_id
  const commissionsForUser = Array.isArray(commissionsRaw) ? commissionsRaw : [];
  const commissionsMap: Record<string, number> = {};
  (commissionsForUser || []).forEach((c: any) => {
    const rid = c.referral_id;
    commissionsMap[rid] = (commissionsMap[rid] || 0) + Number(c.commission_amount ?? c.amount ?? 0);
  });

  // بناء history مبسطة قابلة للـ client (تحويل التواريخ لـ ISO)
  const history = (referrals || []).map((r: any) => {
    const p = referredProfilesMap[r.referred_id] || {};
    return {
      id: r.id,
      referred_uid: r.referred_id,
      referred_email: obscureEmail(r.referred_email ?? p.email ?? null),
      username: obscureName(p.full_name ?? "Unnamed"),
      referral_code: p.referral_code ?? r.referral_code ?? null,
      joinDate: r.created_at ? new Date(r.created_at).toISOString() : null,
      status: r.status === "active" ? "Active" : (r.status ?? "Inactive"),
      totalDeposits: 0,
      yourCommission: commissionsMap[r.id] || 0,
      level: r.level ?? 1,
    };
  });

  // إحصاءات
  const totalInvites = history.length;
  const activeReferrals = history.filter((h) => h.status === "Active").length;
  const totalEarnings = (commissionsForUser || []).reduce((s: number, c: any) => s + Number(c.commission_amount ?? c.amount ?? 0), 0);
  const thisMonthIndex = new Date().getMonth();
  const thisMonthEarnings = (commissionsForUser || []).filter((c: any) => {
    const d = c.created_at ? new Date(c.created_at) : null;
    return d ? d.getMonth() === thisMonthIndex : false;
  }).reduce((s: number, c: any) => s + Number(c.commission_amount ?? c.amount ?? 0), 0);

  const stats = {
    referralsCount: totalInvites,
    totalInvites,
    activeReferrals,
    totalEarnings,
    thisMonthEarnings,
    commissionRate: realRates[0],
    lifetimeCommission: totalEarnings,
    commissionsTotal: totalEarnings,
  };

  // Leaderboard: جلب كل عمولات النظام ثم تجميع بحسب referrer_id
  const { data: allCommissions, error: allCommErr } = await supabase
    .from("referral_commissions")
    .select("commission_amount, referral_id, created_at, referrals(referrer_id)")
    .order("created_at", { ascending: false });
  if (allCommErr) console.error("allCommissions err:", allCommErr);

  const topMap: Record<string, { earnings: number; referrals: number }> = {};
  (allCommissions || []).forEach((c: any) => {
    const rid = c.referrals?.referrer_id;
    if (!rid) return;
    if (!topMap[rid]) topMap[rid] = { earnings: 0, referrals: 0 };
    topMap[rid].earnings += Number(c.commission_amount ?? c.amount ?? 0);
    topMap[rid].referrals += 1;
  });

  const topIds = Object.keys(topMap);
  let topProfiles: Record<string, any> = {};
  if (topIds.length > 0) {
    const { data: tp, error: tpErr } = await supabase
      .from("user_profiles")
      .select("uid, full_name")
      .in("uid", topIds);
    if (tpErr) console.error("top profiles err:", tpErr);
    (tp || []).forEach((p: any) => (topProfiles[p.uid] = p));
  }

  const topReferrers = Object.entries(topMap)
    .map(([id, d], idx) => ({
      rank: 0, // temporary: will set after sorting
      username: obscureName(topProfiles[id]?.full_name ?? "Unknown"),
      referrals: d.referrals,
      earnings: d.earnings,
      avatar: idx === 0 ? "👑" : idx === 1 ? "🏆" : idx === 2 ? "⭐" : "💎",
      isCurrentUser: id === user.id,
      uid: id,
    }))
    .sort((a, b) => b.earnings - a.earnings)
    .map((t, idx) => ({ ...t, rank: idx + 1 }))
    .slice(0, 10);

  // Commission levels (مجموعة مبنية على ال history)
  const levelsMap: Record<number, { users: number; earnings: number }> = {};
  history.forEach((h) => {
    const lvl = Number(h.level || 1);
    if (!levelsMap[lvl]) levelsMap[lvl] = { users: 0, earnings: 0 };
    levelsMap[lvl].users++;
    levelsMap[lvl].earnings += Number(h.yourCommission || 0);
  });

  const commissionLevels = [1, 2, 3].map((level) => {
    const d = levelsMap[level] || { users: 0, earnings: 0 };
    return {
      level,
      users: d.users,
      commission: realRates[level - 1] ?? 0,
      earnings: d.earnings,
    };
  });

  // مرر كل شيء إلى المكوّن العميل
  return (
    <ReferralsPage
      user={user}
      profile={profile ?? null}
      history={history}
      commissions={commissionsForUser ?? []}
      topReferrers={topReferrers}
      commissionLevels={commissionLevels}
      stats={stats}
      rates={realRates}
    />
  );
}
