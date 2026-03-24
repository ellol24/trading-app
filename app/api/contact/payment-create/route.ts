import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const COINBASE_API_KEY = process.env.COINBASE_COMMERCE_API_KEY;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://xspy-trader.com";

    if (!supabaseUrl || !supabaseKey || !COINBASE_API_KEY) {
      console.error("Missing env vars for payment-create (Ensure COINBASE_COMMERCE_API_KEY is set)");
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { amount, user_id } = await req.json();

    if (!amount || !user_id) {
      return NextResponse.json({ error: "Missing amount or user ID" }, { status: 400 });
    }

    console.log("🟦 Creating Coinbase Commerce charge for:", { amount, user_id });

    // Step 1: Pre-generate a deposit ID in our database
    const tempDepositId = `dep_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Step 2: Create the Charge with Coinbase Commerce
    const payload = {
      name: "Account Deposit",
      description: "Fund your XSPY Trading Account",
      pricing_type: "fixed_price",
      local_price: {
        amount: String(amount),
        currency: "USD",
      },
      metadata: {
        customer_id: user_id,
        internal_deposit_id: tempDepositId,
      },
      redirect_url: `${BASE_URL}/dashboard/deposit?success=true`,
      cancel_url: `${BASE_URL}/dashboard/deposit?canceled=true`,
    };

    const response = await fetch("https://api.commerce.coinbase.com/charges", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CC-Api-Key": COINBASE_API_KEY,
            "X-CC-Version": "2018-03-22",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.data?.hosted_url) {
      console.error("❌ Coinbase Commerce Error:", data);
      return NextResponse.json({ error: "Failed to initialize Coinbase checkout" }, { status: 500 });
    }

    // Step 3: Insert Pending Deposit into Supabase
    const checkoutId = data.data.id;
    const hostedUrl = data.data.hosted_url;

    const { error: insertError } = await supabase.from("deposits").insert({
      id: tempDepositId,     // Ensure your schema allows uuid OR custom IDs. If not, omit this and rely on transaction_id.
      user_id,
      amount: Number(amount),
      status: "pending",
      transaction_id: checkoutId,
      network_label: "Coinbase Commerce",
      currency: "USD",
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      // If the 'id' column strictly requires UUID, we fallback to dropping the 'id' param and letting the DB generate it
      console.error("❌ DB Insert warning with custom ID, retrying safely:", insertError.message);
      
      const { error: retryError } = await supabase.from("deposits").insert({
        user_id,
        amount: Number(amount),
        status: "pending",
        transaction_id: checkoutId,
        network_label: "Coinbase Checkout",
        currency: "USD",
        created_at: new Date().toISOString(),
      });

      if (retryError) {
         return NextResponse.json({ error: "Database save failed" }, { status: 500 });
      }
    }

    // Return the hosted URL to the frontend for redirection
    return NextResponse.json({ success: true, invoice_url: hostedUrl });
  } catch (err: any) {
    console.error("🔥 Internal error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
