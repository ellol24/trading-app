import { NextRequest, NextResponse } from "next/server";
import { runDailyProfitCycle } from "@/app/api/cron/package-profits/route";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const result = await runDailyProfitCycle(userId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[PackagesSync] Error:", err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}
