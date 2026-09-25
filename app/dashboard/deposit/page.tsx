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

  // ✅ جلب بيانات البروفايل
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("uid", user.id)
    .single()

  if (error) {
    console.error(error)
  }

  return (
    <DepositClient 
      user={user}
      profile={profile}
    />
  )
}
