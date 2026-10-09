import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processReferralCommissions } from "@/lib/actions/commissions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== "FIXCOMM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Find all approved or confirmed deposits
  const { data: deposits } = await supabaseAdmin
    .from('deposits')
    .select('*')
    .in('status', ['approved', 'confirmed']);

  const report: any = { processed: 0, skipped: 0, errors: [] };

  for (const d of (deposits || [])) {
    // We check via the API logic to see if referral_commissions already processed it
    // Wait, metadata->>reason doesn't always work if it's stored as text, let's just pull and filter in JS
    const { data: existing } = await supabaseAdmin
      .from('referral_commissions')
      .select('id, metadata')
      .eq('source_uid', d.user_id);
      
    const hasDepositComm = (existing || []).some((e: any) => e.metadata?.reason === 'deposit');
    if (hasDepositComm) {
      report.skipped++;
      continue;
    }

    try {
      const res = await processReferralCommissions(d.user_id, Number(d.amount), "deposit");
      if(res.success) {
        report.processed++;
      } else {
        report.errors.push({ deposit_id: d.id, error: res.error });
      }
    } catch(e: any) {
      report.errors.push({ deposit_id: d.id, error: String(e) });
    }
  }

  return NextResponse.json(report);
}
