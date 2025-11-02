import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency, user_id } = body;

    // ✅ التحقق من المدخلات الأساسية
    if (!amount || !currency || !user_id) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // ✅ تصحيح رموز العملات لتوافق NOWPayments
    // لأن BEP20 تُعرف باسم BSC في النظام
    let fixedCurrency = currency.trim().toUpperCase();
    if (fixedCurrency === "USDTBEP20") fixedCurrency = "USDTBSC";

    // ✅ إعداد المفاتيح البيئية
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!apiKey || !baseUrl) {
      console.error("❌ Missing NOWPayments or BASE_URL environment variables.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // ✅ طلب إنشاء الفاتورة
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        pay_currency: fixedCurrency, // ✅ بعد التصحيح
        order_id: `${user_id}-${Date.now()}`,
        order_description: "Deposit to XSPY Account",
        ipn_callback_url: `${baseUrl}/api/contact/payment-webhook`,
      }),
    });

    const data = await response.json();

    // ✅ التحقق من الرد من NOWPayments
    if (!response.ok || !data.invoice_url) {
      console.error("NOWPayments API Error:", data);
      return NextResponse.json(
        { error: data.message || "NOWPayments request failed" },
        { status: 400 }
      );
    }

    // ✅ إرجاع رابط الدفع للعميل
    return NextResponse.json({ payment_url: data.invoice_url });
  } catch (error) {
    console.error("💥 payment-create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
