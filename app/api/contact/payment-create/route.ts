import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const PLISIO_API_KEY = process.env.PLISIO_API_KEY;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://xspy-trader.com";

    if (!supabaseUrl || !supabaseKey || !PLISIO_API_KEY) {
      console.error("Missing env vars (Ensure PLISIO_API_KEY is set)");
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { amount, currency, user_id } = await req.json();

    if (!amount || !user_id || !currency) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log("🟦 Creating Plisio charge for:", { amount, currency, user_id });

    const tempDepositId = `dep_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Plisio API endpoint via GET request
    // Requires parameters in the URL query string
    const params = new URLSearchParams({
      source_currency: "USD",
      source_amount: String(amount),
      order_name: "Account Deposit",
      order_number: tempDepositId,
      currency: currency, // e.g. USDT_TRX or USDT_BSC
      callback_url: `${BASE_URL}/api/contact/payment-webhook`,
      success_url: `${BASE_URL}/dashboard/deposit?success=true`,
      cancel_url: `${BASE_URL}/dashboard/deposit?canceled=true`,
      api_key: PLISIO_API_KEY
    });

    const response = await fetch(`https://api.plisio.net/api/v1/invoices/new?${params.toString()}`, {
        method: "GET"
    });

    const data = await response.json();

    if (data.status !== "success" || !data.data?.invoice_url) {
      console.error("❌ Plisio Error:", data);
      return NextResponse.json({ error: "Failed to initialize Plisio checkout" }, { status: 500 });
    }

    const checkoutId = data.data.txn_id;
    const hostedUrl = data.data.invoice_url;

    const { error: insertError } = await supabase.from("deposits").insert({
      id: tempDepositId,
      user_id,
      amount: Number(amount),
      status: "pending",
      transaction_id: checkoutId,
      network_label: "Plisio",
      currency: "USD",
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("❌ DB Insert warning with custom ID, retrying safely:", insertError.message);
      
      const { error: retryError } = await supabase.from("deposits").insert({
        user_id,
        amount: Number(amount),
        status: "pending",
        transaction_id: checkoutId,
        network_label: "Plisio",
        currency: "USD",
        created_at: new Date().toISOString(),
      });

      if (retryError) {
         return NextResponse.json({ error: "Database save failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, invoice_url: hostedUrl });
  } catch (err: any) {
    console.error("🔥 Internal error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

