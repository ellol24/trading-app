import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.xspy-trader.com";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency, user_id } = body;

    if (!amount || !currency || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log("💰 Creating NOWPayments invoice:", body);

    // --- Step 1: Create invoice from NOWPayments ---
    const invoiceRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(amount),
        price_currency: "usd",
        pay_currency: currency.toLowerCase(), // e.g. usdttrc20 or usdtbsc
        order_id: `${user_id}-${Date.now()}`,
        order_description: "Deposit to XSPY Account",
        ipn_callback_url: `${BASE_URL}/api/contact/payment-webhook`,
        success_url: `${BASE_URL}/dashboard/deposit`,
        cancel_url: `${BASE_URL}/dashboard/deposit`,
      }),
    });

    const invoiceData = await invoiceRes.json();
    console.log("🧾 NOWPayments invoice response:", invoiceData);

    if (!invoiceData.invoice_url) {
      return NextResponse.json(
        { error: "Missing invoice URL from NOWPayments", details: invoiceData },
        { status: 400 }
      );
    }

    // --- Step 2: Save pending deposit in Supabase ---
    const { error } = await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ Error saving deposit:", error);
      return NextResponse.json({ error: "Failed to save deposit" }, { status: 500 });
    }

    // --- Step 3: Return invoice URL to client ---
    return NextResponse.json({
      success: true,
      invoice_url: invoiceData.invoice_url,
    });
  } catch (err: any) {
    console.error("🔥 Server Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
