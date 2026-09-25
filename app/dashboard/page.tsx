import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard/dashboard-client";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  // If Supabase is not configured
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

  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  let targetUserId = user.id;


  // Fetch data for the target user (either themselves or the impersonated user)
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("full_name, balance, total_referrals, total_trades")
    .eq("uid", targetUserId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError.message);
  }

  // Fallback for name
  const userName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Trader";

  return (
    <>

      <DashboardClient
        userName={userName}
        userId={targetUserId} // Pass the impersonated ID here
        balance={profile?.balance ?? 0}
        totalReferrals={profile?.total_referrals ?? 0}
        totalTrades={profile?.total_trades ?? 0}
      />
    </>
  );
}
