import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // ❗ التأكد من إعدادات supabase
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: (name, value, options) => response.cookies.set({ name, value, ...options }),
      remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
    },
  });

  // 🔍 الحصول على الجلسة الفعلية
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = new URL(request.url);
  const pathname = url.pathname;

  // =============================
  // 1) معالجة روابط الإحالة
  // =============================
  if (pathname.startsWith("/REF_")) {
    const code = pathname.replace("/REF_", "");
    const redirect = new URL("/auth/register", request.url);
    redirect.searchParams.set("ref", code);
    return NextResponse.redirect(redirect);
  }

  // =============================
  // 2) الصفحات العامة
  // =============================
  const publicRoutes = [
    "/",
    "/auth/login",
    "/auth/register",
    "/auth/callback",
  ];

  const isPublic = publicRoutes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // =============================
  // 3) ممنوع دخول الصفحات المحمية بدون جلسة
  // =============================
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // =============================
  // 4) لو هناك جلسة وفتح صفحة /auth/login → نعمل توجيه حسب الدور
  // =============================
  if (session && pathname.startsWith("/auth/login")) {
    const { data: roleData } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("uid", session.user.id)
      .single();

    if (!roleData) return response;

    if (roleData.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

// تشغيله على كل الروابط
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
