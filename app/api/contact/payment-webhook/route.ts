import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-CC-Webhook-Signature");
    const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("⚠️ Coinbase Commerce Webhook Secret not set");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!signature) {
      console.error("❌ Missing Coinbase Signature");
      return NextResponse.json({ error: "Missing Signature" }, { status: 403 });
    }

    // Verify Coinbase Commerce Webhook Signature
    try {
      const hmac = crypto.createHmac("sha256", webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest("hex");
      
      if (signature !== expectedSignature) {
          console.error("❌ Invalid Coinbase Signature", { expectedSignature, signature });
          return NextResponse.json({ error: "Invalid Signature" }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log("📥 Coinbase Webhook received event:", event.type);

    // Filter by completed charge events
    if (event.type !== "charge:confirmed" && event.type !== "charge:resolved") {
      console.log(`⏳ Ignoring non-final event: ${event.type}`);
      return NextResponse.json({ message: "Event ignored" }, { status: 200 });
    }

    const charge = event.data;
    const amount = Number(charge.pricing.local.amount);
    const currency = charge.pricing.local.currency;
    const checkoutId = charge.id;
    
    // Extract the metadata we sent during creation
    const metadata = charge.metadata || {};
    const user_id = metadata.customer_id;
    const tempDepositId = metadata.internal_deposit_id;

    if (!user_id || !amount) {
      return NextResponse.json({ error: "Invalid payload metadata" }, { status: 400 });
    }

    // We must use the Service Role Key here because we are in a backend process that needs to override RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // 1. Update the deposit status in 'deposits' table
    const { error: updateError } = await supabaseAdmin
      .from("deposits")
      .update({ 
        status: "confirmed", 
        confirmed_at: new Date().toISOString() 
      })
      .eq("transaction_id", checkoutId); // Target the checkout ID we saved

    if (updateError) {
      console.error("❌ Supabase update error:", updateError);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    // 2. Update User Wallet Balance via RPC
    const { error: rpcError } = await supabaseAdmin.rpc("update_wallet_balance", {
      p_user_id: user_id,
      p_currency: currency || "USD",
      p_amount: amount,
      p_transaction_type: "deposit"
    });

    if (rpcError) {
      console.error("❌ Balance update failed:", rpcError);
      return NextResponse.json({ error: "Balance update failed" }, { status: 500 });
    }

    console.log(`✅ Coinbase Deposit of ${amount} ${currency} securely credited to user ${user_id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Coinbase webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
