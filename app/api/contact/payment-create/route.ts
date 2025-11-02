import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ✅ Webhook لاستقبال إشعارات الدفع من NOWPayments
 * يتم استدعاؤه تلقائيًا من النظام بعد اكتمال عملية الدفع
 */
export async function POST(req: Request) {
  try {
    const supabase = createClient();

    // 🧩 قراءة بيانات الـ webhook
    const body = await req.json();
    console.log("📩 Received NOWPayments webhook:", body);

    // ✅ التحقق من وجود البيانات الأساسية
    const { payment_status, order_id, price_amount } = body;

    if (!payment_status || !order_id) {
      console.error("❌ Missing required fields in webhook:", body);
      return NextResponse.json({ error: "Invalid webhook data" }, { status: 400 });
    }

    // ✅ إذا لم يكن الدفع مكتملًا فلا نفعل شيئًا
    if (payment_status !== "finished") {
      console.log("⚠️ Payment not completed yet, status:", payment_status);
      return NextResponse.json({ message: "Payment not completed" }, { status: 200 });
    }

    // 🔍 استخراج user_id من order_id (يكون مثل "userId-1234567890")
    const [user_id] = order_id.split("-");
    const amount = Number(price_amount) || 0;

    console.log("💰 Confirmed payment for user:", user_id, "amount:", amount);

    // ✅ إدخال سجل الإيداع في قاعدة بيانات Supabase
    const { error } = await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "approved",
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save deposit" }, { status: 500 });
    }

    console.log("✅ Deposit recorded successfully for user:", user_id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("💥 payment-webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
