// app/api/cron/package-profits/route.ts
// Vercel Cron Job — runs every hour, credits daily profits for active mining packages
// Schedule: "0 * * * *" (every hour, checks if 24h have passed for each investment)
//
// Logic:
// 1. Find all active investments
// 2. For each: check if 24h have passed since last_profit_at (or start_date)
// 3. If yes: credit daily_profit to user balance, increment days_credited
// 4. If days_credited == duration_days: return principal, mark as completed
//
// SECURITY: Only callable by Vercel Cron (checks CRON_SECRET header) OR internal (admin token)

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { processReferralCommissions } from "@/lib/actions/commissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, "public", any>;

const CRON_SECRET = process.env.CRON_SECRET;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  // Vercel sends the secret in Authorization header as Bearer token
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyProfitCycle();
  return NextResponse.json(result);
}

// Also allow POST for manual admin trigger
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyProfitCycle();
  return NextResponse.json(result);
}

export async function runDailyProfitCycle(targetUserId?: string) {
  const supabase = getAdminClient();
  const now = new Date();

  console.log(`[CronProfits] Starting cycle at ${now.toISOString()}${targetUserId ? ` for user ${targetUserId}` : ""}`);

  // Fetch all active investments with their package details
  let query = supabase
    .from("investments")
    .select(
      `
      id,
      user_id,
      package_id,
      amount,
      status,
      start_date,
      created_at,
      last_profit_at,
      days_credited,
      total_profit_credited,
      profit,
      investment_packages (
        id,
        roi_daily_percentage,
        duration_days,
        title
      )
    `
    )
    .eq("status", "active");

  if (targetUserId) {
    query = query.eq("user_id", targetUserId);
  }

  const { data: activeInvestments, error: fetchErr } = await query;

  if (fetchErr) {
    console.error("[CronProfits] Failed to fetch active investments:", fetchErr.message);
    return { success: false, error: fetchErr.message, processed: 0, completed: 0 };
  }

  if (!activeInvestments || activeInvestments.length === 0) {
    console.log("[CronProfits] No active investments found.");
    return { success: true, message: "No active investments", processed: 0, completed: 0 };
  }

  console.log(`[CronProfits] Found ${activeInvestments.length} active investments`);

  let processed = 0;
  let completed = 0;
  const errors: string[] = [];

  for (const inv of activeInvestments) {
    try {
      const pkg = (inv as any).investment_packages;
      if (!pkg) {
        console.warn(`[CronProfits] Investment ${inv.id} has no linked package, skipping`);
        continue;
      }

      const amount = Number(inv.amount ?? 0);
      const roiDaily = Number(pkg.roi_daily_percentage ?? 0);
      const durationDays = Number(pkg.duration_days ?? 0);

      if (amount <= 0 || roiDaily <= 0 || durationDays <= 0) {
        console.warn(`[CronProfits] Investment ${inv.id} has invalid values (amount=${amount}, roi=${roiDaily}, dur=${durationDays}), skipping`);
        continue;
      }

      // Determine the reference time for last credit
      const lastProfitAt = (inv as any).last_profit_at
        ? new Date((inv as any).last_profit_at)
        : new Date(inv.start_date ?? inv.created_at ?? now);

      const hoursSinceLast = (now.getTime() - lastProfitAt.getTime()) / (1000 * 60 * 60);

      // Only credit if at least 24 hours have passed
      if (hoursSinceLast < 24) {
        console.log(
          `[CronProfits] Investment ${inv.id}: ${hoursSinceLast.toFixed(1)}h since last credit — skipping (need 24h)`
        );
        continue;
      }

      const daysCredited = Number((inv as any).days_credited ?? 0);
      const totalProfitCredited = Number((inv as any).total_profit_credited ?? 0);

      // Has this investment already run its full duration?
      if (daysCredited >= durationDays) {
        // Should already be completed — mark it now to fix stale data
        console.log(`[CronProfits] Investment ${inv.id} is overdue for completion — marking completed`);
        await finalizeInvestment(supabase, inv, amount, totalProfitCredited, durationDays);
        completed++;
        continue;
      }

      // Calculate today's profit
      const dailyProfit = Number(((amount * (roiDaily / 100))).toFixed(6));
      const newDaysCredited = daysCredited + 1;
      const newTotalProfit = Number((totalProfitCredited + dailyProfit).toFixed(6));
      const isLastDay = newDaysCredited >= durationDays;

      console.log(
        `[CronProfits] Investment ${inv.id}: Day ${newDaysCredited}/${durationDays}, profit=$${dailyProfit.toFixed(4)}, isLastDay=${isLastDay}`
      );

      // --- Credit daily profit to user balance ---
      const { data: userProfile, error: profileErr } = await supabase
        .from("user_profiles")
        .select("balance")
        .eq("uid", inv.user_id)
        .single();

      if (profileErr || !userProfile) {
        console.error(`[CronProfits] Cannot fetch profile for user ${inv.user_id}:`, profileErr?.message);
        errors.push(`inv=${inv.id}: profile fetch failed`);
        continue;
      }

      const currentBalance = Number(userProfile.balance ?? 0);

      if (isLastDay) {
        // Last day: credit daily profit + return principal
        const totalCredit = Number((dailyProfit + amount).toFixed(2));
        const newBalance = Number((currentBalance + totalCredit).toFixed(2));

        // Update user balance (profit + principal)
        const { error: balErr } = await supabase
          .from("user_profiles")
          .update({ balance: newBalance })
          .eq("uid", inv.user_id);

        if (balErr) {
          console.error(`[CronProfits] Balance update failed for ${inv.user_id}:`, balErr.message);
          errors.push(`inv=${inv.id}: balance update failed`);
          continue;
        }

        // Mark investment as completed
        const { error: invErr } = await supabase
          .from("investments")
          .update({
            status: "completed",
            profit: Number(newTotalProfit.toFixed(2)),
            days_credited: newDaysCredited,
            total_profit_credited: Number(newTotalProfit.toFixed(2)),
            last_profit_at: now.toISOString(),
          })
          .eq("id", inv.id);

        if (invErr) {
          console.error(`[CronProfits] Investment status update failed for ${inv.id}:`, invErr.message);
          errors.push(`inv=${inv.id}: status update failed`);
          continue;
        }

        // Log the profit transaction
        await logProfitTransaction(supabase, inv.user_id, inv.id, dailyProfit, "daily_profit", newDaysCredited, durationDays);
        await logProfitTransaction(supabase, inv.user_id, inv.id, amount, "principal_return", newDaysCredited, durationDays);

        // Grant referral commissions on the total profit
        if (newTotalProfit > 0) {
          await processReferralCommissions(inv.user_id, newTotalProfit, "package").catch((e) =>
            console.error("[CronProfits] Commission error:", e)
          );
        }

        completed++;
        processed++;
        console.log(
          `[CronProfits] ✅ Investment ${inv.id} COMPLETED — credited $${dailyProfit.toFixed(4)} profit + $${amount} principal back to user ${inv.user_id}`
        );
      } else {
        // Normal day: credit daily profit only
        const newBalance = Number((currentBalance + dailyProfit).toFixed(2));

        const { error: balErr } = await supabase
          .from("user_profiles")
          .update({ balance: newBalance })
          .eq("uid", inv.user_id);

        if (balErr) {
          console.error(`[CronProfits] Balance update failed for ${inv.user_id}:`, balErr.message);
          errors.push(`inv=${inv.id}: balance update failed`);
          continue;
        }

        // Update investment tracking fields
        const { error: invErr } = await supabase
          .from("investments")
          .update({
            profit: Number(newTotalProfit.toFixed(2)),
            days_credited: newDaysCredited,
            total_profit_credited: Number(newTotalProfit.toFixed(2)),
            last_profit_at: now.toISOString(),
          })
          .eq("id", inv.id);

        if (invErr) {
          console.error(`[CronProfits] Investment update failed for ${inv.id}:`, invErr.message);
          errors.push(`inv=${inv.id}: investment update failed`);
          continue;
        }

        // Log the profit transaction
        await logProfitTransaction(supabase, inv.user_id, inv.id, dailyProfit, "daily_profit", newDaysCredited, durationDays);

        processed++;
        console.log(
          `[CronProfits] ✅ Investment ${inv.id}: credited $${dailyProfit.toFixed(4)} to user ${inv.user_id} (day ${newDaysCredited}/${durationDays})`
        );
      }
    } catch (err: any) {
      console.error(`[CronProfits] Unexpected error for investment ${inv.id}:`, err.message);
      errors.push(`inv=${inv.id}: ${err.message}`);
    }
  }

  const summary = {
    success: true,
    timestamp: now.toISOString(),
    totalActive: activeInvestments.length,
    processed,
    completed,
    errors: errors.length > 0 ? errors : undefined,
  };

  console.log("[CronProfits] Cycle complete:", JSON.stringify(summary));
  return summary;
}

/** Fallback: finalize an overdue investment that somehow stayed active */
async function finalizeInvestment(
  supabase: AdminClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inv: any,
  amount: number,
  totalProfitCredited: number,
  durationDays: number
) {
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("balance")
    .eq("uid", inv.user_id)
    .single();

  if (!userProfile) return;

  const currentBalance = Number(userProfile.balance ?? 0);
  const newBalance = Number((currentBalance + amount).toFixed(2));

  await supabase.from("user_profiles").update({ balance: newBalance }).eq("uid", inv.user_id);
  await supabase
    .from("investments")
    .update({ status: "completed", profit: Number(totalProfitCredited.toFixed(2)), days_credited: durationDays })
    .eq("id", inv.id);

  await logProfitTransaction(supabase, inv.user_id, inv.id, amount, "principal_return", durationDays, durationDays);
}

/** Log profit transactions for audit trail in investment_transactions table (if it exists, silently skip if not) */
async function logProfitTransaction(
  supabase: AdminClient,
  userId: string,
  investmentId: string,
  amount: number,
  type: "daily_profit" | "principal_return",
  dayCurrent: number,
  dayTotal: number
) {
  try {
    await supabase.from("investment_transactions").insert({
      user_id: userId,
      investment_id: investmentId,
      amount: Number(amount.toFixed(2)),
      type,
      day_number: dayCurrent,
      total_days: dayTotal,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Table may not exist yet — that's OK, not critical
  }
}
