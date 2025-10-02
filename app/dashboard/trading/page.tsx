import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TradingClient from "./TradingClient"

// 🔒 دالة تنظيف البيانات لتكون قابلة للتسلسل
function sanitizeForClient(obj: any) {
  if (!obj) return null
  return JSON.parse(JSON.stringify(obj, (_, value) => {
    if (typeof value === "bigint") return value.toString()
    return value
  }))
}

export default async function TradingPage() {
  if (!isSupabaseConfigured) {
    return <div>Connect Supabase to get started</div>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("uid", user.id)
    .single()

  if (error) console.error(error)

  // ✅ نرسل نسخة نظيفة فقط
  const safeUser = user ? {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata || {},
    last_sign_in_at: user.last_sign_in_at,
  } : null

  const safeProfile = sanitizeForClient(profile)

  return (
    <TradingClient user={safeUser} profile={safeProfile} />
  )
}
