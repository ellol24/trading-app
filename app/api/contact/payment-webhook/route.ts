import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const body = await req.json();

    if (body.payment_status !== "finished") {
      return NextResponse.json({ message: "Payment not completed" }, { status: 200 });
    }

    const orderId = body.order_id;
    const amount = body.price_amount;
    const [user_id] = orderId.split("-");

    await supabase.from("deposits").insert({
      user_id,
      amount,
      status: "approved",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("payment-webhook error:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
