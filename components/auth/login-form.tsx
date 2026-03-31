"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mail, Lock } from "lucide-react"
import Link from "next/link"
import { signIn } from "@/lib/auth-actions"
import type { ActionState } from "@/lib/auth-actions"
import { useRouter } from "next/navigation"

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full professional-gradient h-12 text-base font-medium"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing In...
        </>
      ) : (
        "Sign In"
      )}
    </Button>
  )
}

export default function LoginForm() {
  const router = useRouter()
  const [state, setState] = useState<ActionState>({})
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signIn(state, formData)
      setState(result)

      if (result?.success) {
        // ✅ التوجيه حسب الدور
        if (result.role === "admin") {
          router.push("/admin/dashboard")
        } else {
          router.push("/dashboard")
        }
      }
    })
  }

  return (
    <Card className="w-full max-w-md trading-card">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-3xl font-bold text-white">Welcome Back</CardTitle>
        <CardDescription className="text-slate-300">
          Sign in to continue trading
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <form action={handleSubmit} className="space-y-4">
          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
              {state.success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200 font-medium">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="professional-input pl-10 h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200 font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Your password"
                required
                minLength={8}
                className="professional-input pl-10 h-12"
              />
            </div>
          </div>

          <SubmitButton pending={isPending} />
        </form>

        <div className="text-center text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Create one
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
