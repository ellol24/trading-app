import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📩 Webhook received:", body);

    // ✅ التحقق من وجود مفتاح الـ IPN
    const ipnSecret = process.env.NOWPAYMENTS_IPN_KEY;
    if (!ipnSecret) {
      console.error("❌ Missing NOWPAYMENTS_IPN_KEY in environment");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // ✅ تحقق من أن الطلب يحتوي على المفاتيح الأساسية
    if (!body || !body.payment_status || !body.order_id) {
      console.error("❌ Invalid webhook body:", body);
      return NextResponse.json({ error: "Invalid webhook body" }, { status: 400 });
    }

    // ✅ قبول فقط الطلبات القادمة من NOWPayments
    // (يمكنك لاحقًا استخدام تحقق HMAC رسمي لمزيد من الأمان)
    const allowedStatuses = ["finished", "partially_paid"];
    if (!allowedStatuses.includes(body.payment_status)) {
      console.log(`⚠️ Ignored payment with status: ${body.payment_status}`);
      return NextResponse.json({ message: "Ignored non-final status" }, { status: 200 });
    }

    // ✅ استخراج user_id من order_id
    const orderId = body.order_id;
    const [user_id] = orderId.split("-");
    const amount = Number(body.price_amount) || 0;

    if (!user_id || !amount) {
      console.error("❌ Missing user_id or amount in webhook");
      return NextResponse.json({ error: "Missing user info" }, { status: 400 });
    }

    // ✅ إدخال الإيداع في قاعدة البيانات
    const supabase = createClient();
    const { error } = await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "approved",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    console.log(`✅ Deposit recorded for user ${user_id} (${amount}$)`);

    // ✅ الرد بنجاح إلى NOWPayments
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ payment-webhook error:", error);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
