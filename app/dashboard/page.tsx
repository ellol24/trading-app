import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  // إذا لم يتم إعداد Supabase
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <h1 className="text-2xl font-bold mb-4 text-white">
          Connect Supabase to get started
        </h1>
      </div>
    );
  }

  const supabase = createClient();

  // ✅ جلب المستخدم الحالي
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // ✅ جلب البيانات من user_profiles
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("full_name, balance, total_referrals, total_trades")
    .eq("uid", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError.message);
  }

  // إذا الاسم غير موجود في profile خذه من metadata أو من الإيميل
  const userName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Trader";

  return (
    <DashboardClient
      userName={userName}
      userId={user.id}
      balance={profile?.balance ?? 0}
      totalReferrals={profile?.total_referrals ?? 0}
      totalTrades={profile?.total_trades ?? 0}
    />
  );
}
