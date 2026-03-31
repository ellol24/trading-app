import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.xspy-trader.com";

export async function POST(req: Request) {
  try {
    const { amount, currency, user_id } = await req.json();

    if (!amount || !currency || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log("🟦 Creating NOWPayments invoice for:", { amount, currency, user_id });

    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        pay_currency: currency.toLowerCase(), // usdttrc20 or usdtbsc
        order_id: `${user_id}-${Date.now()}`,
        order_description: "Deposit to XSPY Account",
        ipn_callback_url: `${BASE_URL}/api/contact/payment-webhook`,
        success_url: `${BASE_URL}/dashboard/deposit`,
        cancel_url: `${BASE_URL}/dashboard/deposit`,
      }),
    });

    const data = await response.json();
    console.log("🟩 NOWPayments Response:", data);

    // Handle known errors
    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Payment creation failed",
          details: data,
        },
        { status: response.status }
      );
    }

    // Missing invoice_url
    if (!data.invoice_url) {
      return NextResponse.json(
        { error: "Missing invoice URL from NOWPayments", details: data },
        { status: 400 }
      );
    }

    // Save deposit in database
    const { error } = await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json({ error: "Database save failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, invoice_url: data.invoice_url });
  } catch (err: any) {
    console.error("🔥 Internal error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
