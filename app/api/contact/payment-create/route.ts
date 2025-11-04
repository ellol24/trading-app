import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📥 Received body:", body);

    const { amount, currency, user_id } = body;

    if (!amount || !currency || !user_id) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // ✅ تأكد أن العملة كلها lowercase
    const payCurrency = currency.toLowerCase();

    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey!,
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
    console.log("💬 NOWPayments response:", data);

    // ✅ إذا الـ API لم يرجع invoice_url نعرض رسالة مناسبة
    if (!response.ok || !data.invoice_url) {
      console.error("❌ NOWPayments error:", data);
      return NextResponse.json(
        { error: data.message || "Missing invoice URL from NOWPayments" },
        { status: 400 }
      );
    }

    // ✅ إرجاع رابط الدفع إلى الواجهة
    return NextResponse.json({ payment_url: data.invoice_url });
  } catch (error) {
    console.error("payment-create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
