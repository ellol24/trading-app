// app/api/admin/translate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  translateToAllLanguages,
  translateMessagePair,
  detectLanguage,
  type SupportedLanguage,
} from "@/lib/translator";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("uid", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, text, sourceLang } = body;

    if (title !== undefined && message !== undefined) {
      const translations = await translateMessagePair(
        title,
        message,
        sourceLang as SupportedLanguage
      );
      const detected = sourceLang || detectLanguage(`${title} ${message}`);
      return NextResponse.json({ translations, detected });
    }

    if (text) {
      const translations = await translateToAllLanguages(
        text,
        sourceLang as SupportedLanguage
      );
      const detected = sourceLang || detectLanguage(text);
      return NextResponse.json({ translations, detected });
    }

    return NextResponse.json(
      { error: "Provide either { title, message } or { text }" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[API translate] error:", error);
    return NextResponse.json(
      { error: error.message || "Translation failed" },
      { status: 500 }
    );
  }
}
