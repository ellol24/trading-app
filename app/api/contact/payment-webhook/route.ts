import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const ipnKeyHeader = req.headers.get("x-nowpayments-sig");
    const ipnSecret = process.env.NOWPAYMENTS_IPN_KEY;

    // 🔒 تحقق من توقيع الطلب (الأمان)
    if (!ipnKeyHeader || ipnKeyHeader !== ipnSecret) {
      console.error("❌ Invalid IPN signature");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("📦 Webhook payload:", body);

    // فقط عند اكتمال الدفع
    if (body.payment_status !== "finished") {
      console.log(`ℹ️ Payment not finished yet: ${body.payment_status}`);
      return NextResponse.json({ message: "Payment not completed" }, { status: 200 });
    }

    const orderId = body.order_id;
    const amount = body.price_amount;
    const [user_id] = orderId.split("-");

    const supabase = createClient();

    // 🔍 تحقق إذا كان هناك إيداع سابق لنفس المستخدم والمبلغ
    const { data: existing, error: findError } = await supabase
      .from("deposits")
      .select("id, status")
      .eq("user_id", user_id)
      .eq("amount", amount)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("❌ Database lookup error:", findError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (existing) {
      if (existing.status !== "approved") {
        // ✅ تحديث الحالة إلى approved + وقت الموافقة
        const { error: updateError } = await supabase
          .from("deposits")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("❌ Error updating deposit:", updateError);
          return NextResponse.json({ error: "Update error" }, { status: 500 });
        }

        console.log(`✅ Deposit updated to approved for user ${user_id}`);
      } else {
        console.log("⚠️ Deposit already approved, skipping update.");
      }
    } else {
      // ✅ إنشاء سجل إيداع جديد إذا لم يكن موجودًا
      const { error: insertError } = await supabase.from("deposits").insert({
        user_id,
        amount,
        status: "approved",
        approved_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("❌ Insert error:", insertError);
        return NextResponse.json({ error: "Insert error" }, { status: 500 });
      }

      console.log(`✅ New deposit inserted for user ${user_id} - ${amount}$`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
