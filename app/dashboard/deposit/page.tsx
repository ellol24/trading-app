import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import DepositClient from "./DepositClient"

export default async function DepositPage() {
  if (!isSupabaseConfigured) {
    return <div>Connect Supabase to get started</div>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Pre-fetch profile, settings, and active wallets in parallel on server for instant rendering
  const [profileRes, settingsRes, walletsRes] = await Promise.all([
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
      .from("deposit_wallets")
      .select("id, address, asset")
      .eq("visible", true),
  ]);

  return (
    <DepositClient 
      user={user}
      profile={profileRes.data}
      initialSettings={settingsRes.data}
      initialWallets={walletsRes.data || []}
    />
  )
}
