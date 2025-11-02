import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📥 Received body:", body);

    const { amount, currency, user_id } = body;

    if (!amount || !currency || !user_id) {
      console.error("❌ Missing parameters:", { amount, currency, user_id });
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!apiKey || !baseUrl) {
      console.error("❌ Missing NOWPayments API key or BASE URL", {
        apiKey: !!apiKey,
        baseUrl: !!baseUrl,
      });
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const ipnUrl = `${baseUrl}/api/contact/payment-webhook`;
    console.log("🌐 Using IPN URL:", ipnUrl);

    // ✅ استبدل /payment بـ /invoice
    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        pay_currency: currency.toLowerCase(),
        order_id: `${user_id}-${Date.now()}`,
        order_description: "Deposit to XSPY Account",
        ipn_callback_url: ipnUrl,
        success_url: `${baseUrl}/dashboard/deposit?success=true`,
        cancel_url: `${baseUrl}/dashboard/deposit?cancel=true`,
      }),
    });

    console.log("📡 NOWPayments status:", response.status);

    const data = await response.json();
    console.log("💬 NOWPayments response data:", data);

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "NOWPayments request failed", details: data },
        { status: response.status }
      );
    }

    if (!data.invoice_url) {
      console.error("❌ Missing invoice_url in response:", data);
      return NextResponse.json(
        { error: "No invoice URL returned from NowPayments", data },
        { status: 400 }
      );
    }

    return NextResponse.json({ payment_url: data.invoice_url });
  } catch (error) {
    console.error("💥 payment-create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
