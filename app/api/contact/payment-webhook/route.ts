import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const body = await req.json();

    // ✅ تحقق من مفتاح الـ IPN الأمني
    const ipnSecret = process.env.NOWPAYMENTS_IPN_KEY;
    const providedKey = req.headers.get("x-nowpayments-sig");

    if (!ipnSecret) {
      console.error("❌ Missing IPN Secret Key in environment");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (!providedKey || providedKey !== ipnSecret) {
      console.warn("⚠️ Invalid or missing IPN signature");
      return NextResponse.json({ error: "Unauthorized IPN" }, { status: 401 });
    }

    // ✅ تحقق من حالة الدفع
    const paymentStatus = body.payment_status;
    if (paymentStatus !== "finished") {
      console.log("ℹ️ Payment not completed:", paymentStatus);
      return NextResponse.json({ message: "Payment not finished" }, { status: 200 });
    }

    // ✅ استخراج البيانات الأساسية
    const orderId = body.order_id;
    const paymentId = body.payment_id;
    const amount = body.price_amount;
    const paidAmount = body.actually_paid;
    const currency = body.pay_currency?.toUpperCase();
    const [user_id] = orderId.split("-");

    if (!user_id || !amount) {
      console.error("❌ Invalid webhook data:", body);
      return NextResponse.json({ error: "Invalid webhook data" }, { status: 400 });
    }

    // ✅ تحقق من أن المستخدم موجود فعلاً
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("uid")
      .eq("uid", user_id)
      .single();

    if (!userProfile) {
      console.error("❌ User not found:", user_id);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ تحقق من أن نفس الدفع لم يُسجل مسبقًا
    const { data: existing } = await supabase
      .from("deposits")
      .select("id")
      .eq("user_id", user_id)
      .eq("amount", amount)
      .eq("status", "approved")
      .limit(1);

    if (existing && existing.length > 0) {
      console.log("⚠️ Duplicate payment ignored:", paymentId);
      return NextResponse.json({ message: "Duplicate payment ignored" }, { status: 200 });
    }

    // ✅ أضف السجل في جدول الإيداعات
    const { error: insertError } = await supabase.from("deposits").insert({
      user_id,
      amount: Number(paidAmount || amount),
      status: "approved",
      payment_id: paymentId,
      currency,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("❌ Error inserting deposit:", insertError.message);
      return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
    }

    console.log("✅ Deposit recorded successfully:", {
      user_id,
      paymentId,
      amount,
      currency,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("💥 payment-webhook error:", err);
    return NextResponse.json({ error: "Webhook Error", details: err.message }, { status: 500 });
  }
}
