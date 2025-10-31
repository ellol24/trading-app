import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const ipnKey = process.env.NOWPAYMENTS_IPN_KEY
    const supabase = createClient()

    const body = await req.json()
    const receivedKey = req.headers.get("x-nowpayments-sig")

    // تحقق من التوقيع السري IPN
    if (!ipnKey || !receivedKey) {
      return NextResponse.json({ error: "Missing IPN security key" }, { status: 401 })
    }

    // تحقق أن المفتاح يطابق المفتاح المضاف في NOWPayments
    if (receivedKey.trim() !== ipnKey.trim()) {
      return NextResponse.json({ error: "Invalid IPN key" }, { status: 403 })
    }

    const {
      payment_status,
      payment_id,
      order_id,
      pay_currency,
      actually_paid,
      price_amount,
    } = body

    console.log("📩 IPN received:", body)

    // فقط لو تم الدفع فعليًا
    if (payment_status === "finished" || payment_status === "confirmed") {
      const { error } = await supabase.from("deposits").insert({
        user_id: order_id,
        amount: price_amount || actually_paid,
        currency: pay_currency,
        status: "approved",
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.error("Supabase insert error:", error)
        return NextResponse.json({ error: "Failed to update deposit" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // إذا لم يكن الدفع مكتمل بعد
    return NextResponse.json({ message: "Payment not completed yet" })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
