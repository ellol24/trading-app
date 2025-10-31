import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { amount, currency, userId, email } = await req.json()

    if (!amount || !currency || !userId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "NOWPayments API key not configured" }, { status: 500 })
    }

    // إنشاء الطلب في NOWPayments
    const res = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        pay_currency: currency, // مثل USDTTRC20 أو USDTBEP20
        order_id: `${userId}-${Date.now()}`,
        order_description: `Deposit for user ${email}`,
        ipn_callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/contact/payment-webhook`,
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/deposit?status=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/deposit?status=cancel`,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error("NOWPayments error:", errorText)
      return NextResponse.json({ error: "Failed to create payment" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("Payment create error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
