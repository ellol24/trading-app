import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InstantDepositClient from "./InstantDepositClient";

export const metadata = {
  title: "Instant Crypto Deposit | XSpy Trader",
  description: "Automated instant USDT deposits on TRON and BNB Chain",
};

export default async function InstantDepositPage() {
  if (!isSupabaseConfigured) {
    return <div>Connect Supabase to get started</div>;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Pre-fetch profile, settings, and existing instant deposits in parallel
  const [profileRes, settingsRes, depositsRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("uid", user.id)
      .maybeSingle(),
    supabase
      .from("deposit_settings")
      .select("is_enabled, min_deposit_amount")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("deposits")
      .select("*")
      .eq("user_id", user.id)
      .eq("payment_method", "nexus")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <InstantDepositClient
      user={user}
      profile={profileRes.data}
      initialSettings={settingsRes.data}
      initialDeposits={depositsRes.data || []}
    />
  );
}
