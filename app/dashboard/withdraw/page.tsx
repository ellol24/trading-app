// ✅ app/withdraw/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import WithdrawClient from "./WithdrawClient"

export default async function WithdrawPage() {
  const supabase = createClient()

  // ✅ جلب الجلسة
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/auth/login")
  }

  // ✅ جلب البروفايل
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single()

  return <WithdrawClient user={session.user} profile={profile} />
}
