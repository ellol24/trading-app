import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📥 Webhook received:", body);

    // ✅ التحقق من حالة الدفع
    if (body.payment_status !== "finished") {
      console.log("⏳ Payment not completed yet");
      return NextResponse.json({ message: "Payment not completed" }, { status: 200 });
    }

    // ✅ استخراج بيانات الطلب
    const orderId = body.order_id;
    const amount = body.price_amount;
    const [user_id] = orderId.split("-");

    const supabase = createClient();

    // ✅ إضافة الإيداع إلى قاعدة البيانات
    const { error } = await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "approved",
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
    }

    console.log("✅ Deposit recorded successfully");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("payment-webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
