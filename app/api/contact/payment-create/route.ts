import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // ✅ قراءة بيانات الطلب من العميل
    const body = await req.json();
    const { amount, currency, user_id } = body;

    // ✅ التحقق من وجود كل الحقول المطلوبة
    if (!amount || !currency || !user_id) {
      return NextResponse.json(
        { error: "❌ Missing parameters" },
        { status: 400 }
      );
    }

    // ✅ تأكيد وجود مفاتيح البيئة
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!apiKey) {
      console.error("❌ Missing NOWPayments API Key");
      return NextResponse.json(
        { error: "Server misconfiguration (no API key)" },
        { status: 500 }
      );
    }

    if (!baseUrl) {
      console.error("❌ Missing BASE URL");
      return NextResponse.json(
        { error: "Server misconfiguration (no BASE URL)" },
        { status: 500 }
      );
    }

    // ✅ تحويل رموز العملات لتتوافق مع تنسيق NOWPayments
    const coinMap: Record<string, string> = {
      USDTTRC20: "usdt_trc20",
      USDTBEP20: "usdt_bep20",
    };

    const payCurrency = coinMap[currency] || currency;

    // ✅ طباعة القيم في السيرفر لتسهيل التحقق (لن تظهر للمستخدم)
    console.log("Creating NOWPayments order with:", {
      amount,
      currency,
      payCurrency,
      user_id,
      baseUrl,
    });

    // ✅ إرسال الطلب إلى NOWPayments
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

    // ✅ تحليل الاستجابة من API
    const data = await response.json();

    console.log("NOWPayments response:", data);

    // ❌ إذا كان هناك خطأ من واجهة NOWPayments
    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || "NOWPayments error" },
        { status: 400 }
      );
    }

    // ✅ في حال النجاح
    if (data.invoice_url) {
      return NextResponse.json({ payment_url: data.invoice_url });
    } else {
      return NextResponse.json(
        { error: "Failed to retrieve payment URL" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("payment-create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
