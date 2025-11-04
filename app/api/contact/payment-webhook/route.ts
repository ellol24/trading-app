import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📬 Webhook received:", body);

    if (!body || !body.payment_status || !body.order_id) {
      return NextResponse.json({ error: "Invalid webhook data" }, { status: 400 });
    }

    const signature = req.headers.get("x-nowpayments-sig");
    if (!signature) {
      console.error("❌ Invalid IPN signature");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (body.payment_status !== "finished") {
      console.log("⚠️ Payment not completed yet, skipping...");
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const [user_id] = body.order_id.split("-");
    const amount = body.price_amount;
    const supabase = createClient();

    await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "approved",
    });

    console.log("✅ Deposit approved and saved for user:", user_id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("payment-webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
