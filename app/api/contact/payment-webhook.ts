// app/api/contact/payment-webhook.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

const NOW_API = "https://api.nowpayments.io/v1";
const NOW_KEY = process.env.NOWPAYMENTS_API_KEY!;
const NOW_IPN_KEY = process.env.NOWPAYMENTS_IPN_KEY || ""; // إذا تستخدم IPN key validation

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // 1) (اختياري) التحقق من header أو ipn_key إذا كان يأتي في payload
    // بعض بوابات ترسل ipn_key في body: if (payload.ipn_key !== NOW_IPN_KEY) { ... }

    // 2) خذ ال invoice id أو order_id من payload
    // NowPayments قد يرسل "invoice_id" أو "id" أو "order_id" — طبعاً افحص ال payload الذي تتلقاه
    const invoiceId = payload.id ?? payload.invoice_id;
    const orderId = payload.order_id ?? payload.orderId;

    // 3) احصل التفاصيل من NowPayments للتأكيد (OPTIONAL but recommended)
    if (invoiceId) {
      const verifyRes = await fetch(`${NOW_API}/invoice/${invoiceId}`, {
        headers: { "x-api-key": NOW_KEY },
      });
      const invoice = await verifyRes.json();

      // تحقق من حالة الفاتورة
      const status = invoice?.payment_status ?? payload?.payment_status ?? payload?.status;
      // الحالة التي تدلّ على إتمام الدفع في NOWPayments عادة "finished" أو "confirmed" أو "paid"
      const paid = (status === "finished" || status === "paid" || status === "confirmed");

      if (!paid) {
        // ليس مدفوعاً فعلاً — لا نفعل شيئاً
        return NextResponse.json({ ok: true });
      }

      // احصل المعلومات المراد حفظها
      const amount = Number(invoice.price_amount ?? payload.price_amount ?? payload.amount ?? 0);
      const userIdReference = invoice.order_id ?? orderId;

      if (!userIdReference) {
        console.warn("Webhook: no order_id/user reference", payload);
        return NextResponse.json({ ok: false, error: "no_order_id" }, { status: 400 });
      }

      // Idempotency: تأكد أننا لم ندرج نفس الإيداع مرتين
      // افترض أن جدول deposits لديه حقل now_invoice_id أو order_id
      const { data: existing } = await supabase
        .from("deposits")
        .select("*")
        .or(`now_invoice_id.eq.${invoiceId},order_id.eq.${userIdReference}`)
        .limit(1);

      if (existing && existing.length > 0) {
        // إذا وجدنا سجل موافق أو متطابق - نحدّثه فقط إلى approved إن لم يكن كذلك
        const existingRow = existing[0];
        if (existingRow.status !== "approved") {
          await supabase.from("deposits").update({
            status: "approved",
            now_invoice_id: invoiceId,
            updated_at: new Date().toISOString(),
          }).eq("id", existingRow.id);
        }
        return NextResponse.json({ ok: true });
      }

      // إدخال سجل جديد في deposits (approved)
      const insertPayload: any = {
        user_id: userIdReference,
        amount,
        status: "approved",
        now_invoice_id: invoiceId,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from("deposits").insert(insertPayload);
      if (insertError) {
        console.error("Webhook insert deposit error:", insertError);
        return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
      }

      // بعد إدخال row في deposits، يجب أن تعمل التريجرات الموجودة لديك (توزيع عمولات الإحالة للإيداعات)
      // إن لم تعمل التريجرات، يمكنك استدعاء دالة داخل DB هنا (perform) عبر RPC إذا كان مقبولاً.

      return NextResponse.json({ success: true });
    } else {
      // إذا لم يكن invoiceId متوفر — ردّ بسيط
      return NextResponse.json({ ok: true });
    }
  } catch (err: any) {
    console.error("payment-webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
