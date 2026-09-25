import { isSupabaseConfigured } from "@/lib/supabase/server"
import LoginForm from "@/components/auth/login-form"

export default async function LoginPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <h1 className="text-2xl font-bold mb-4 text-white">
          Connect Supabase to get started
        </h1>
      </div>
    )
  }

  // ✅ لاحظ أن هنا مفيش redirect
  // الميدل وير (middleware.ts) هو اللي هيعمل التوجيه

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <LoginForm />
    </div>
  )
}
