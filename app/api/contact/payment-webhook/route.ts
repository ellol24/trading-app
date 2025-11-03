import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const ipnSignature = req.headers.get("x-nowpayments-sig");
    const ipnKey = process.env.NOWPAYMENTS_IPN_KEY!;

    // ✅ تحقق من التوقيع
    const calculatedSignature = crypto
      .createHmac("sha512", ipnKey)
      .update(rawBody)
      .digest("hex");

    if (calculatedSignature !== ipnSignature) {
      console.error("❌ Invalid IPN signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const data = JSON.parse(rawBody);
    console.log("📦 Webhook Data:", data);

    if (data.payment_status !== "finished") {
      console.log("⏳ Payment still pending, skipping update.");
      return NextResponse.json({ message: "Payment pending" }, { status: 200 });
    }

    const supabase = createClient();

    const orderId = data.order_id;
    const amount = data.price_amount;
    const [user_id] = orderId.split("-");

    // ✅ تحقق إن لم يتم تسجيل هذا الدفع مسبقًا
    const { data: existing } = await supabase
      .from("deposits")
      .select("id")
      .eq("user_id", user_id)
      .eq("amount", amount)
      .eq("status", "approved");

    if (existing && existing.length > 0) {
      console.log("⚠️ Deposit already recorded, skipping duplicate.");
      return NextResponse.json({ message: "Already recorded" });
    }

    // ✅ أضف الإيداع إلى قاعدة البيانات
    await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "approved",
    });

    console.log("💰 Deposit added successfully for user:", user_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("payment-webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
