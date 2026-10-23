import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createNexusInvoice, NexusNetwork } from "@/lib/nexus";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key);
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, network } = body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Valid deposit amount is required." },
        { status: 400 }
      );
    }

    if (network !== "TRON" && network !== "BSC") {
      return NextResponse.json(
        { error: "Invalid network. Supported networks are TRON and BSC." },
        { status: 400 }
      );
    }

    const adminSupabase = getAdminSupabase();

    // Check deposit settings (enabled status and min deposit)
    const { data: settings } = await adminSupabase
      .from("deposit_settings")
      .select("is_enabled, min_deposit_amount")
      .limit(1)
      .maybeSingle();

    if (settings && settings.is_enabled === false) {
      return NextResponse.json(
        { error: "Deposits are currently disabled by administration." },
        { status: 403 }
      );
    }

    const minDeposit = Number(settings?.min_deposit_amount ?? 10);
    if (parsedAmount < minDeposit) {
      return NextResponse.json(
        { error: `Minimum deposit amount is $${minDeposit}.` },
        { status: 400 }
      );
    }

    // Fetch user profile for user name / uid
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("uid, full_name, username, email")
      .eq("uid", user.id)
      .maybeSingle();

    const siteUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.xspy-trader.com";
    const webhookUrl = `${siteUrl.replace(/\/+$/, "")}/api/nexus/webhook`;

    // Create invoice via Nexus Gateway
    const invoice = await createNexusInvoice({
      userId: user.id,
      amount: parsedAmount,
      network: network as NexusNetwork,
      webhookUrl,
      metadata: {
        userId: user.id,
        userEmail: user.email,
        userName: profile?.full_name || profile?.username || user.email,
      },
    });

    // Record initial pending deposit in the database
    const networkLabel =
      network === "TRON" ? "USDT (TRC-20)" : "USDT (BEP-20)";

    const { error: insertErr } = await adminSupabase.from("deposits").insert({
      user_id: user.id,
      uid: profile?.uid || user.id,
      username: profile?.full_name || profile?.username || user.email?.split("@")[0] || "Trader",
      email: user.email,
      amount: invoice.baseAmount || parsedAmount,
      currency: "USDT",
      network_label: networkLabel,
      payment_method: "nexus",
      transaction_id: invoice.invoiceId,
      status: "pending",
    });

    if (insertErr) {
      console.warn("[Nexus/create-invoice] Error recording deposit record:", insertErr);
    }

    return NextResponse.json({
      success: true,
      data: invoice,
    });
  } catch (err: any) {
    console.error("[Nexus/create-invoice] Exception:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create crypto deposit invoice." },
      { status: 500 }
    );
  }
}
