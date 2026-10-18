// app/api/admin/broadcast/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

const adminClient = () =>
  createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

async function verifyAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const db = adminClient();
  const { data: profile } = await db
    .from("user_profiles")
    .select("role")
    .eq("uid", session.user.id)
    .single();
  if (profile?.role !== "admin") return null;
  return session.user.id;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const adminId = await verifyAdmin(supabase);
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { title, message, target_type, target_user_id, notification_type } = body;

  if (!title || !message) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  }

  const db = adminClient();

  // Log the broadcast
  await db.from("broadcasts").insert({
    admin_id: adminId,
    title,
    message,
    target_type: target_type ?? "all",
    target_user_id: target_user_id ?? null,
    notification_type: notification_type ?? "info",
  });

  // Get target user IDs
  let userIds: string[] = [];
  if (target_type === "user" && target_user_id) {
    userIds = [target_user_id];
  } else {
    // Send to all non-admin users
    const { data: allUsers } = await db
      .from("user_profiles")
      .select("uid")
      .neq("role", "admin");
    userIds = (allUsers ?? []).map((u: any) => u.uid);
  }

  // Insert notifications in batches of 100
  const batchSize = 100;
  let totalSent = 0;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const notifications = batch.map((uid) => ({
      user_id: uid,
      type: notification_type ?? "broadcast",
      title,
      message,
      metadata: { from_admin: true, admin_id: adminId },
    }));
    const { error } = await db.from("notifications").insert(notifications);
    if (!error) totalSent += batch.length;
  }

  return NextResponse.json({ success: true, sent_to: totalSent });
}

// Update system settings (welcome message, trading alert)
export async function PATCH(req: Request) {
  const supabase = createClient();
  const adminId = await verifyAdmin(supabase);
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { key, value } = body;

  if (!key || !value) {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }

  const db = adminClient();
  const { error } = await db
    .from("system_settings")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = createClient();
  const adminId = await verifyAdmin(supabase);
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const db = adminClient();
  const { data: broadcasts } = await db
    .from("broadcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: settings } = await db
    .from("system_settings")
    .select("*")
    .in("key", ["welcome_message", "trading_alert"]);

  return NextResponse.json({ broadcasts: broadcasts ?? [], settings: settings ?? [] });
}
