import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function updateSession(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = new URL(request.url);
  const pathname = url.pathname;

  // ✅ 1) التعامل مع روابط الإحالة مثل /REF_db109c54
  if (pathname.startsWith("/REF_")) {
    const code = pathname.replace("/REF_", "");
    const redirectUrl = new URL("/auth/register", request.url);
    redirectUrl.searchParams.set("ref", code);
    return NextResponse.redirect(redirectUrl);
  }

  // ✅ 2) الصفحات العامة
  const publicRoutes = ["/", "/auth/login", "/auth/register", "/auth/callback"];
  const isPublicRoute = publicRoutes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // 🛑 3) لو مفيش جلسة والمستخدم في صفحة محمية → روح تسجيل الدخول
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // 🛑 4) لو في جلسة والمستخدم بيحاول يفتح صفحة تسجيل الدخول
  if (session && pathname.startsWith("/auth/login")) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("uid", session.user.id)
      .single();

    if (profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

// ✅ middleware matcher لتشغيله على كل الروابط
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
 
