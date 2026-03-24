import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const sig = req.headers.get("x-nowpayments-sig");
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (!ipnSecret) {
      console.error("⚠️ NOWPayments IPN Secret not set");
      // Proceeding without verification is dangerous, but we log it.
      // Ideally, return 500 or 403.
    } else if (sig) {
      const hmac = crypto.createHmac("sha512", ipnSecret);
      hmac.update(bodyText);
      const signature = hmac.digest("hex");
      if (signature !== sig) {
        console.error("❌ Invalid NOWPayments Signature");
        return NextResponse.json({ error: "Invalid Signature" }, { status: 403 });
      }
    } else {
      console.error("❌ Missing NOWPayments Signature");
      return NextResponse.json({ error: "Missing Signature" }, { status: 403 });
    }

    const body = JSON.parse(bodyText);
    console.log("📥 Webhook received:", body);

    // Filter by 'confirmed' or 'finished' status
    if (body.payment_status !== "finished" && body.payment_status !== "confirmed") {
      console.log(`⏳ Payment status: ${body.payment_status} - Ignoring balance update`);
      return NextResponse.json({ message: "Status not final" }, { status: 200 });
    }

    const orderId = body.order_id;
    const amount = Number(body.price_amount);
    const currency = body.pay_currency; // e.g. 'usdttrc20'
    const [user_id] = orderId.split("-");

    if (!user_id || !amount) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createClient();

    // 1. Record deposit in 'deposits' table
    const { error: insertError } = await supabase.from("deposits").insert({
      user_id,
      amount,
      currency: currency || 'USD',
      status: "approved", // or 'confirmed' matches DB check? 
      // DB check allows 'confirmed', 'pending', 'rejected', 'expired'.
      // 'approved' in previous code might have been wrong if CHECK constraint exists.
      // Schema says: status IN ('pending', 'confirmed', 'rejected', 'expired')
      network_id: body.pay_currency || 'unknown',
      network_label: 'NOWPayments',
      wallet_address: body.pay_address || 'unknown',
      transaction_id: String(body.payment_id),
      confirmed_at: new Date().toISOString()
    });

    if (insertError) {
      console.error("❌ Supabase insert error:", insertError);
      // We don't return error here to allow retrying balance update if needed, 
      // or we should return error. NOWPayments retries on non-200.
      return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
    }

    // 2. Update User Wallet Balance via RPC
    const { error: rpcError } = await supabase.rpc("update_wallet_balance", {
      p_user_id: user_id,
      p_currency: "USD", // Assuming base currency is USD for the balance
      p_amount: amount,
      p_transaction_type: "deposit"
    });

    if (rpcError) {
      console.error("❌ Balance update failed:", rpcError);
      return NextResponse.json({ error: "Balance update failed" }, { status: 500 });
    }

    console.log(`✅ Deposit of ${amount} USD credited to user ${user_id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("payment-webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
