import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGroupBotToken } from "@/lib/telegram-tokens";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const GROUP_BOT_TOKEN = getGroupBotToken();

// ─── GET /api/admin/bots/settings ─────────────────────────────────────────────
export async function GET() {
  try {
    const { data: groupSetting } = await adminClient
      .from("system_settings")
      .select("value")
      .eq("key", "telegram_group_chat_id")
      .maybeSingle();

    const groupChatId = (groupSetting?.value as string) || process.env.TELEGRAM_GROUP_CHAT_ID || "";

    return NextResponse.json({
      ok: true,
      telegramGroupChatId: groupChatId,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ─── POST /api/admin/bots/settings ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, groupChatId } = body;

    // 1. Manually Save Group Chat ID
    if (action === "save_group_id") {
      if (!groupChatId || !String(groupChatId).trim()) {
        return NextResponse.json(
          { ok: false, message: "معرف مجموعة تيليجرام لا يمكن أن يكون فارغاً" },
          { status: 400 }
        );
      }

      const cleanId = String(groupChatId).trim();
      const { error } = await adminClient
        .from("system_settings")
        .upsert({ key: "telegram_group_chat_id", value: cleanId }, { onConflict: "key" });

      if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "تم حفظ معرف مجموعة تيليجرام بنجاح",
        groupChatId: cleanId,
      });
    }

    // 2. Auto-Detect Group ID from Telegram Updates
    if (action === "auto_detect") {
      if (!GROUP_BOT_TOKEN) {
        return NextResponse.json(
          { ok: false, message: "رمز بوت المجموعة غير مهيأ" },
          { status: 400 }
        );
      }

      // 1. First check if any group messages were logged in admin_notifications
      const { data: logs } = await adminClient
        .from("admin_notifications")
        .select("data")
        .order("created_at", { ascending: false })
        .limit(20);

      if (logs) {
        for (const log of logs) {
          const cid = log.data?.chatId || log.data?.groupChatId;
          if (cid && (String(cid).startsWith("-") || Number(cid) < 0)) {
            const cleanId = String(cid);
            await adminClient
              .from("system_settings")
              .upsert({ key: "telegram_group_chat_id", value: cleanId }, { onConflict: "key" });

            return NextResponse.json({
              ok: true,
              detectedChatId: cleanId,
              source: "recent_activity",
              message: `تم اكتشاف معرف المجموعة تلقائياً وحفظه: ${cleanId}`,
            });
          }
        }
      }

      return NextResponse.json({
        ok: false,
        message: "لم يتم العثور على مجموعة بعد. أضف البوت @XSpyAIBot لمجموعتك وأرسل رسالة داخل المجموعة، أو اكتب معرف المجموعة يدوياً.",
      });
    }

    return NextResponse.json({ ok: false, message: "إجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
