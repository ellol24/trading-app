import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/server"

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const supabase = createClient()
    const body = await req.json()

    const { fullName, email, password } = body

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // إنشاء المستخدم في auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // إدخال بيانات في جدول user_profiles
    if (data?.user) {
      const { error: profileError } = await supabase.from("user_profiles").insert({
        uid: data.user.id,
        full_name: fullName,
      })

      if (profileError) {
        console.error("Profile insert error:", profileError.message)
        return NextResponse.json(
          { error: "Account created, but failed to save profile" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { success: "Account created successfully! Please check your email." },
      { status: 200 }
    )
  } catch (err: any) {
    console.error("Register route error:", err)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
