import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    
    const plisioSecret = process.env.PLISIO_SECRET_KEY;
    
    if (!plisioSecret) {
      console.error("⚠️ Plisio Secret Key not set");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Plisio verifies webhooks by concatenating all POST parameters into an array,
    // sorting them alphabetically by array key, and signing them.
    // However, the easiest way Plisio uses is the `verify_hash` that they send in the payload!
    const verifyHash = payload.verify_hash;
    
    // Safety check
    if (!verifyHash) {
       console.error("❌ Missing Plisio verify_hash");
       return NextResponse.json({ error: "Missing Signature" }, { status: 403 });
    }

    // Reconstruct the signature based on Plisio docs
    const postData = { ...payload };
    delete postData.verify_hash;

    // Generate string from sorted keys
    const sortedKeys = Object.keys(postData).sort();
    let dataString = '';
    for (const key of sortedKeys) {
        dataString += postData[key];
    }

    const hmac = crypto.createHmac("sha1", plisioSecret);
    hmac.update(dataString);
    const expectedHash = hmac.digest("hex");

    if (expectedHash !== verifyHash) {
        console.error("❌ Invalid Plisio Signature", { expectedHash, verifyHash });
        return NextResponse.json({ error: "Invalid Signature" }, { status: 403 });
    }

    console.log("📥 Plisio Webhook received status:", payload.status);

    // Plisio status: 'completed' or 'mismatch' (if partially paid, but completed covers full)
    if (payload.status !== "completed") {
      console.log(`⏳ Ignoring non-final event: ${payload.status}`);
      return NextResponse.json({ message: "Event ignored" }, { status: 200 });
    }

    const amount = Number(payload.source_amount); // USD amount
    const currency = payload.source_currency || "USD";
    const tempDepositId = payload.order_number;
    const txn_id = payload.txn_id;

    if (!tempDepositId || !amount) {
      return NextResponse.json({ error: "Invalid payload metadata" }, { status: 400 });
    }

    // We must use the Service Role Key here because we are in a backend process that needs to override RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Get the deposit to find the user_id
    let deposit = null;
    const { data: depositData, error: fetchError } = await supabaseAdmin
        .from("deposits")
        .select("user_id, status")
        .eq("id", tempDepositId)
        .single();
        
    if (fetchError || !depositData) {
        // Fallback: search by txn_id
        const { data: fallbackData } = await supabaseAdmin.from("deposits").select("user_id, status").eq("transaction_id", txn_id).single();
        if (!fallbackData) {
            console.error("❌ Deposit not found");
            return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
        }
        deposit = fallbackData;
    } else {
        deposit = depositData;
    }

    if (deposit.status === "confirmed") {
        return NextResponse.json({ message: "Already confirmed" }, { status: 200 });
    }

    const user_id = deposit.user_id;

    // 1. Update the deposit status in 'deposits' table
    const { error: updateError } = await supabaseAdmin
      .from("deposits")
      .update({ 
        status: "confirmed", 
        confirmed_at: new Date().toISOString() 
      })
      .eq("id", tempDepositId);

    if (updateError) {
      console.error("❌ Supabase update error:", updateError);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    // 2. Update User Wallet Balance via RPC
    const { error: rpcError } = await supabaseAdmin.rpc("update_wallet_balance", {
      p_user_id: user_id,
      p_currency: currency,
      p_amount: amount,
      p_transaction_type: "deposit"
    });

    if (rpcError) {
      console.error("❌ Balance update failed:", rpcError);
      return NextResponse.json({ error: "Balance update failed" }, { status: 500 });
    }

    console.log(`✅ Plisio Deposit of ${amount} ${currency} securely credited to user ${user_id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Plisio webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
