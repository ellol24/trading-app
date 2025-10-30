// app/api/contact/payment-create.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server"; // إذا لديك نسخة server-side من supabase
// أو استبدل بنسخة client إذا تستخدمها بطريقة مختلفة

const NOW_API = "https://api.nowpayments.io/v1";
const NOW_KEY = process.env.NOWPAYMENTS_API_KEY!;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://xspy-trader.com";
const IPN_CALLBACK = `${SITE}/api/contact/payment-webhook`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, amount, currency = "usd", metadata } = body;

    if (!userId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    // (اختياري) أنشئ سجل مؤقت في جدول deposits مع status = 'pending'
    const tmp = await (async () => {
      try {
        const insert = await supabase.from("deposits").insert({
          user_id: userId,
          amount: Number(amount),
          status: "pending",
          metadata: metadata || null,
          // تضع هنا حقل order_id أو external_id إذا أردت ربط الفاتورة لاحقًا
        }).select().single();
        return insert.data;
      } catch {
        return null;
      }
    })();

    // إنشاء invoice في NowPayments
    const payload = {
      price_amount: Number(amount),
      price_currency: currency,
      pay_currency: "usdttrc20", // أو اتركها null لترك اختيار العملة للمستخدم
      order_id: tmp?.id ?? userId, // احفظ order id ليعود لاحقًا في webhook
      order_description: `Deposit for user ${userId}`,
      ipn_callback_url: IPN_CALLBACK,
      success_url: `${SITE}/dashboard/deposit-success`,
      cancel_url: `${SITE}/dashboard/deposit-failed`
    };

    const res = await fetch(`${NOW_API}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": NOW_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("NowPayments create invoice error:", data);
      return NextResponse.json({ error: "nowpayments_error", detail: data }, { status: 500 });
    }

    // ارجع رابط الدفع للعميل (frontend سيقوم بتحويل المستخدم)
    return NextResponse.json({ invoice_url: data.invoice_url, invoice: data });
  } catch (err: any) {
    console.error("payment-create error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
