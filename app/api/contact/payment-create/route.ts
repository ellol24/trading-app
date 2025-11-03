import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency, user_id } = body;

    if (!amount || !currency || !user_id) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const supabase = createClient();

    // 🟡 أضف الإيداع كـ "pending" مباشرة في قاعدة البيانات
    const { error: insertError } = await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "pending",
    });

    if (insertError) {
      console.error("❌ Error inserting pending deposit:", insertError);
    }

    // 🚀 إرسال الطلب إلى NOWPayments
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        pay_currency: currency.toLowerCase(),
        order_id: `${user_id}-${Date.now()}`,
        order_description: "Deposit to XSPY Account",
        ipn_callback_url: `${baseUrl}/api/contact/payment-webhook`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("NOWPayments error:", data);
      return NextResponse.json({ error: data.message || "NOWPayments request failed" }, { status: 400 });
    }

    // ✅ عرض رابط الدفع للمستخدم (الذي يحتوي على QR والبيانات)
    return NextResponse.json({ payment_url: data.invoice_url || data.pay_address });
  } catch (error) {
    console.error("payment-create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
