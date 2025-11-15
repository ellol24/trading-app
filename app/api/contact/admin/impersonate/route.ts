import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "Missing UID" }, { status: 400 });
    }

    const cookieStore = cookies();

    // ⬅️ أنشئ عميل سوپابيس عادي
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set(name, value, options);
          },
          remove(name, options) {
            cookieStore.set(name, "", options);
          },
        },
      }
    );

    // ⬅️ اجلب جلسة المستخدم المطلوب impersonate
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: "",
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
    });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ⬅️ إنشاء جلسة يدوية
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.properties.action_link_token!,
      refresh_token: data.properties.action_link_token!,
    });

    if (sessionError) {
      console.error(sessionError);
      return NextResponse.json({ error: sessionError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
