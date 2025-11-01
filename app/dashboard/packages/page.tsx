// app/dashboard/packages/page.tsx
import PackagesClient from "./PackagesClient"
import { createClient } from "@/lib/supabase/server"

export default async function PackagesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // لو مفيش يوزر → يترمي على تسجيل الدخول
  if (!user) {
    return <div className="p-6 text-red-500">Please log in to view packages.</div>
  }

  return <PackagesClient userId={user.id} />
}
