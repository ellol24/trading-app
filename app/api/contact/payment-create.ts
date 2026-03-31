import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency, user_id } = body;

    if (!amount || !currency || !user_id) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!apiKey) {
      console.error("❌ Missing NOWPAYMENTS_API_KEY");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // 🧠 تأكد من تنسيق البيانات بشكل دقيق
    const payload = {
      price_amount: Number(amount),
      price_currency: "usd",
      pay_currency: currency.toUpperCase(),
      order_id: `${user_id}-${Date.now()}`,
      order_description: "Deposit to XSPY Account",
      ipn_callback_url: `${baseUrl}/api/contact/payment-webhook`,
    };

    console.log("📦 Sending to NOWPayments:", payload);

    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // 🔍 اطبع الاستجابة لمعرفة السبب الدقيق للخطأ
    console.log("💬 NOWPayments Response:", data);

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "NOWPayments request failed", details: data },
        { status: 400 }
      );
    }

    return NextResponse.json({ payment_url: data.invoice_url });
  } catch (error) {
    console.error("💥 payment-create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
