import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next();

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
  const impersonateId = url.searchParams.get("impersonate");

  // --------------------------------------------------------
  // 1️⃣  Impersonation Logic
  // --------------------------------------------------------
  if (impersonateId) {
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    const { data: adminProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("uid", session.user.id)
      .single();

    // ❌ لو الشخص الحالي ليس Admin → رفض العملية
    if (adminProfile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // 🔥 تسجيل خروج الأدمن
    await supabase.auth.signOut();

    // 🔥 تسجيل دخول مستخدم impersonated
    await supabase.auth.signInWithIdToken({
      provider: "user",
      token: impersonateId,
    });

    // 🔁 إعادة التوجيه للداشبورد كمستخدم
    const redirect = new URL("/dashboard", request.url);
    return NextResponse.redirect(redirect);
  }

  // --------------------------------------------------------
  // 2️⃣  Public routes
  // --------------------------------------------------------
  const publicRoutes = ["/", "/auth/login", "/auth/register", "/auth/callback"];
  const isPublic = publicRoutes.some((p) => pathname.startsWith(p));

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // --------------------------------------------------------
  // 3️⃣ لو المستخدم في صفحة login وهو بالفعل مسجل
  // --------------------------------------------------------
  if (session && pathname.startsWith("/auth/login")) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("uid", session.user.id)
      .single();

    return NextResponse.redirect(
      new URL(
        profile?.role === "admin" ? "/admin/dashboard" : "/dashboard",
        request.url
      )
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
