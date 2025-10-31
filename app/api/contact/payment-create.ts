import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { amount, currency, user_id } = await req.json()

    if (!amount || !currency || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://xspy-trader.com"

    if (!apiKey) {
      return NextResponse.json({ error: "Missing NOWPayments API key" }, { status: 500 })
    }

    // إنشاء طلب الدفع في NOWPayments
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency: currency,
        order_id: user_id,
        order_description: `Deposit by user ${user_id}`,
        ipn_callback_url: `${baseUrl}/api/contact/payment-webhook`,
        success_url: `${baseUrl}/dashboard/deposit-success`,
        cancel_url: `${baseUrl}/dashboard/deposit-failed`,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("NOWPayments error:", data)
      return NextResponse.json({ error: "Failed to create payment" }, { status: 400 })
    }

    return NextResponse.json({
      payment_url: data.invoice_url,
      payment_id: data.payment_id,
      status: "created",
    })
  } catch (error) {
    console.error("Payment create error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
