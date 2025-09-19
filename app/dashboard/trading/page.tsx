import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TradingClient from "./TradingClient"

export default async function TradingPage() {
  if (!isSupabaseConfigured) {
    return <div>Connect Supabase to get started</div>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // ✅ ممكن تجيب بيانات إضافية إذا تحتاجها
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("uid", user.id)
    .single()

  if (error) console.error(error)

  return (
    <TradingClient user={user} profile={profile} />
  )
}
