import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency, user_id } = body;

    // 🧩 التحقق من القيم المطلوبة
    if (!amount || !currency || !user_id) {
      console.error("❌ Missing parameters:", { amount, currency, user_id });
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 🔐 جلب مفاتيح البيئة
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!apiKey || !baseUrl) {
      console.error("❌ Missing NOWPayments API key or base URL");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // 🪙 تصحيح العملة لتكون بالتنسيق المطلوب
    const payCurrency = currency.toLowerCase().replace("-", "");

    // 🚀 إنشاء طلب الدفع
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        pay_currency: payCurrency,
        order_id: `${user_id}-${Date.now()}`,
        order_description: "Deposit to XSPY Account",
        ipn_callback_url: `${baseUrl}/api/contact/payment-webhook`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ NOWPayments error:", data);
      return NextResponse.json(
        { error: data.message || "NOWPayments API error", details: data },
        { status: 400 }
      );
    }

    // ✅ نجاح العملية
    console.log("✅ Payment created successfully:", data);

    return NextResponse.json({
      success: true,
      payment_url: data.invoice_url,
      payment_id: data.payment_id,
      pay_currency: payCurrency,
    });
  } catch (error: any) {
    console.error("💥 payment-create error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
