"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  DollarSign,
  Clock,
  Package,
  PiggyBank,
  Wallet,
  Info,
  TrendingUp,
  Calculator,
  CalendarCheck,
  Coins,
  CheckCircle2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase/client"
import { processReferralCommissions } from "@/lib/actions/commissions"
import { useLanguage } from "@/contexts/language-context"

function formatUSD(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

/** Format milliseconds into "Xd Xh Xm Xs" */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00"
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export default function PackagesClient({ userId }: { userId: string }) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [wallet, setWallet] = useState<number>(0)
  const [packages, setPackages] = useState<any[]>([])
  const [investments, setInvestments] = useState<any[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({})

  // Helper to dynamically proxy user-created titles through the translation system
  const translateDynamic = (text: string | null | undefined, ns: string = "packages") => {
    if (!text) return text
    const key = `${ns}.${text}`
    const translated = t(key)
    return translated === key ? text : translated
  }

  // Fetch packages + investments + balance
  const fetchData = async () => {
    if (!userId) return
    try {
      // Trigger a server sync to settle any mature 24h profit credits
      await fetch("/api/packages/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch((e) => console.warn("[Packages] Sync warning:", e))

      const [pkgRes, invRes, balRes] = await Promise.all([
        supabase.from("investment_packages").select("*").eq("is_active", true),
        supabase
          .from("investments")
          .select("*, investment_packages(*)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("user_profiles").select("balance").eq("uid", userId).single(),
      ])

      if (pkgRes.data) setPackages(pkgRes.data)
      if (invRes.data) setInvestments(invRes.data)
      if (balRes.data && typeof balRes.data.balance !== "undefined") setWallet(Number(balRes.data.balance))
    } catch (err) {
      console.error("[Packages] fetchData error:", err)
    }
  }

  useEffect(() => {
    fetchData()
    // Refresh data every 60 seconds to pick up server-side credits
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Purchase / activate a package
  const handleBuy = async (pkg: any) => {
    if (!userId) return
    const amt = amounts[pkg.id] ?? pkg.min_investment ?? 0

    if (amt < (pkg.min_investment ?? 0) || amt > (pkg.max_investment ?? Infinity)) {
      toast({
        title: t("packages.invalidAmountTitle"),
        description: t("packages.invalidAmountDesc")
          .replace("{min}", pkg.min_investment)
          .replace("{max}", pkg.max_investment),
        variant: "destructive",
      })
      return
    }

    if (wallet < amt) {
      toast({
        title: t("packages.insufficientBalanceTitle"),
        description: t("packages.insufficientBalanceDesc"),
        variant: "destructive",
      })
      return
    }

    // Check if same package is already active
    const isAlreadyActive = investments.some((inv) => inv.package_id === pkg.id && inv.status === "active")
    if (isAlreadyActive) {
      toast({
        title: t("packages.alreadyActiveTitle") || "Package Already Active",
        description:
          t("packages.alreadyActiveDesc") ||
          "You already have an active investment with this package. Please wait for it to expire.",
        variant: "destructive",
      })
      return
    }

    try {
      // Deduct balance first
      const { error: balErr } = await supabase
        .from("user_profiles")
        .update({ balance: wallet - amt })
        .eq("uid", userId)

      if (balErr) {
        toast({ title: t("common.error"), description: balErr.message, variant: "destructive" })
        return
      }

      // Create investment record
      const { error: invErr } = await supabase.from("investments").insert([
        {
          user_id: userId,
          package_id: pkg.id,
          amount: amt,
          status: "active",
          start_date: new Date().toISOString(),
          days_credited: 0,
          total_profit_credited: 0,
          profit: 0,
          // last_profit_at is NULL on creation — cron will use start_date as baseline
        },
      ])

      if (invErr) {
        // Rollback balance on failure
        await supabase.from("user_profiles").update({ balance: wallet }).eq("uid", userId)
        toast({ title: t("common.error"), description: invErr.message, variant: "destructive" })
        return
      }

      toast({
        title: t("packages.activationSuccessTitle"),
        description: t("packages.activationSuccessDesc").replace("{title}", translateDynamic(pkg.title) || ""),
      })
      setWallet((prev) => prev - amt)
      await fetchData()
    } catch (err) {
      console.error("handleBuy error", err)
      toast({ title: t("common.error"), description: t("common.error"), variant: "destructive" })
    }
  }

  // ─── Investment Card with daily profit display ───────────────────────────────
  function InvestmentCard({ inv }: { inv: any }) {
    const [now, setNow] = useState(Date.now())
    const { t } = useLanguage()

    // Tick every second
    useEffect(() => {
      const id = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(id)
    }, [])

    if (!inv) return null

    const pkg = inv.investment_packages
    const amount = Number(inv.amount ?? 0)
    const roiDaily = Number(pkg?.roi_daily_percentage ?? 0)
    const durationDays = Number(pkg?.duration_days ?? 0)
    const dailyProfit = Number(((amount * roiDaily) / 100).toFixed(4))
    const daysCredited = Number(inv.days_credited ?? 0)
    const totalProfitCredited = Number(inv.total_profit_credited ?? inv.profit ?? 0)

    // Progress through full duration
    const daysProgress = durationDays > 0 ? Math.min(100, (daysCredited / durationDays) * 100) : 0

    // Next profit countdown (24h from last_profit_at or start_date)
    const lastProfitAt = inv.last_profit_at
      ? new Date(inv.last_profit_at).getTime()
      : new Date(inv.start_date ?? inv.created_at ?? now).getTime()
    const nextProfitAt = lastProfitAt + 24 * 60 * 60 * 1000
    const msUntilNext = nextProfitAt - now
    const isCompleted = inv.status === "completed"
    const isWaiting = !isCompleted && msUntilNext > 0

    return (
      <Card className="trading-card" translate="no" data-react-protected>
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-white font-semibold">{translateDynamic(pkg?.title)}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("common.amount")} {formatUSD(amount)} &bull; {t("packages.dailyRoi")} {roiDaily}% &bull;{" "}
                {t("packages.duration")} {durationDays} {t("packages.days")}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                isCompleted
                  ? "text-green-400 border-green-400 bg-green-400/10 shrink-0"
                  : "text-blue-400 border-blue-400 bg-blue-400/10 shrink-0"
              }
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t("packages.statusCompleted")}
                </>
              ) : (
                <>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {t("packages.statusActive")}
                </>
              )}
            </Badge>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-background/10">
              <p className="text-xs text-muted-foreground">{t("packages.profitCredited")}</p>
              <p className="text-sm font-bold text-green-400">{formatUSD(totalProfitCredited)}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/10">
              <p className="text-xs text-muted-foreground">{t("packages.dailyProfit")}</p>
              <p className="text-sm font-bold text-blue-400">+{formatUSD(dailyProfit)}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/10">
              <p className="text-xs text-muted-foreground">{t("packages.daysCredited")}</p>
              <p className="text-sm font-bold text-purple-400">
                {daysCredited}/{durationDays}
              </p>
            </div>
          </div>

          {/* Duration progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarCheck className="h-3 w-3" />
                {t("packages.packageProgress")}
              </span>
              <span className="text-xs text-white font-medium">{Math.round(daysProgress)}%</span>
            </div>
            <Progress value={Math.round(daysProgress)} className="h-2" />
          </div>

          {/* Next profit / principal return info */}
          {!isCompleted && (
            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                isWaiting ? "bg-amber-500/10 border border-amber-500/20" : "bg-green-500/10 border border-green-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                {isWaiting ? (
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                ) : (
                  <Coins className="h-4 w-4 text-green-400 shrink-0" />
                )}
                <span className="text-xs text-muted-foreground">
                  {daysCredited + 1 >= durationDays
                    ? t("packages.nextCreditFinalDay")
                    : t("packages.nextDailyCredit")}
                </span>
              </div>
              <span
                className={`text-sm font-bold tabular-nums ${isWaiting ? "text-amber-300" : "text-green-400"}`}
              >
                {isWaiting ? formatCountdown(msUntilNext) : t("packages.processingCredit")}
              </span>
            </div>
          )}

          {/* Completed state — principal returned */}
          {isCompleted && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <span className="text-xs text-green-300">
                {t("packages.principalReturned").replace("{amount}", formatUSD(amount))}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
      translate="no"
      data-react-protected
    >
      <div className="p-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Wallet summary */}
          <Card className="trading-card" translate="no" data-react-protected>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-white">
                <Wallet className="h-5 w-5" />
                <span>{t("packages.miningWallet")}</span>
              </CardTitle>
              <Badge variant="outline" className="w-fit text-emerald-400 border-emerald-400 bg-emerald-400/10">
                <PiggyBank className="h-4 w-4 mr-1 shrink-0" />
                <span>{t("packages.profitsAutoCredit")}</span>
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("dashboard.availableBalance")}</p>
                <p className="text-3xl font-bold text-white">{formatUSD(wallet)}</p>
              </div>
              <div className="text-xs text-muted-foreground flex items-start sm:items-center gap-2 max-w-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                <span>{t("packages.profitsInfo")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Packages Overview */}
          <Card className="trading-card" translate="no" data-react-protected>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <Package className="h-5 w-5" />
                <span>{t("packages.activeOverview")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-blue-400">
                    {investments.filter((i) => i.status === "active").length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("packages.activePackagesStats")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-green-400">
                    {formatUSD(
                      investments.reduce((s, i) => s + Number(i.total_profit_credited ?? i.profit ?? 0), 0)
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("packages.totalEarnings")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-purple-400">
                    {investments.length > 0
                      ? (
                          investments.reduce(
                            (s, i) => s + Number(i.investment_packages?.roi_daily_percentage || 0),
                            0
                          ) / investments.length
                        ).toFixed(2)
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-muted-foreground">{t("packages.avgDailyRoi")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-orange-400">
                    {investments
                      .filter((i) => i.status === "active")
                      .reduce(
                        (s, i) =>
                          s +
                          Math.max(
                            0,
                            Number(i.investment_packages?.duration_days || 0) - Number(i.days_credited ?? 0)
                          ),
                        0
                      )}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("packages.totalRemainingDays")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Packages */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">{t("packages.availableMiningPackages")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {packages.map((pkg) => {
                  const amt = amounts[pkg.id] ?? pkg.min_investment
                  const min = Number(pkg.min_investment ?? 0)
                  const max = Number(pkg.max_investment ?? min)
                  const roiDaily = Number(pkg.roi_daily_percentage ?? 0)
                  const durationDays = Number(pkg.duration_days ?? 0)
                  const projectedProfit = Number(((amt * (roiDaily / 100)) * durationDays).toFixed(2))
                  const hasActive = investments.some((inv) => inv.package_id === pkg.id && inv.status === "active")
                  return (
                    <Card key={pkg.id} className="trading-card" translate="no" data-react-protected>
                      <CardContent className="p-0">
                        <div className="relative">
                          {pkg.image_url ? (
                            <img
                              src={pkg.image_url}
                              alt={translateDynamic(pkg.title) ?? "package"}
                              className="w-full h-44 object-cover rounded-t-lg"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ) : (
                            <div className="w-full h-44 rounded-t-lg bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
                              <TrendingUp className="w-16 h-16 text-white/30" />
                            </div>
                          )}
                          <div className="absolute top-4 right-4">
                            <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
                              {pkg.roi_daily_percentage}
                              {t("packages.percentDaily")}
                            </Badge>
                          </div>
                        </div>

                        <div className="p-5 space-y-4">
                          <h3 className="text-lg font-semibold text-white">{translateDynamic(pkg.title)}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {translateDynamic(pkg.description)}
                          </p>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center space-x-2 p-3 rounded-lg bg-background/10">
                              <Clock className="h-4 w-4 text-blue-400" />
                              <div>
                                <p className="text-white font-medium">
                                  {pkg.duration_days} {t("packages.days")}
                                </p>
                                <p className="text-muted-foreground text-xs">{t("packages.duration")}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 p-3 rounded-lg bg-background/10">
                              <DollarSign className="h-4 w-4 text-green-400" />
                              <div>
                                <p className="text-white font-medium">
                                  {formatUSD(pkg.min_investment)} - {formatUSD(pkg.max_investment)}
                                </p>
                                <p className="text-muted-foreground text-xs">{t("packages.investmentRange")}</p>
                              </div>
                            </div>
                          </div>

                          {/* Amount Input + Slider */}
                          <div className="space-y-3">
                            <Label htmlFor={`amount-${pkg.id}`} className="text-muted-foreground">
                              {t("common.amount")}
                            </Label>
                            <Input
                              id={`amount-${pkg.id}`}
                              type="number"
                              min={min}
                              max={max}
                              value={amt}
                              onChange={(e) => {
                                const v = Math.min(max, Math.max(min, Number(e.target.value || min)))
                                setAmounts((prev) => ({ ...prev, [pkg.id]: v }))
                              }}
                              className="bg-background/20 text-white border-slate-700"
                            />
                            {max > min && (
                              <Slider
                                min={min}
                                max={max}
                                step={Math.max(1, Math.round((max - min) / 100))}
                                value={[amt]}
                                onValueChange={([v]) => setAmounts((prev) => ({ ...prev, [pkg.id]: v }))}
                                className="w-full"
                              />
                            )}
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>
                                {t("packages.minLabel")} {formatUSD(min)}
                              </span>
                              <span>
                                {t("packages.maxLabel")} {formatUSD(max)}
                              </span>
                            </div>
                          </div>

                          {/* Profit Calculator */}
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                              <Calculator className="w-3.5 h-3.5" />
                              {t("packages.profitCalculator")}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-400 text-xs">{t("packages.dailyProfit")}</span>
                                <span className="text-white text-xs font-medium">
                                  +{formatUSD((amt * roiDaily) / 100)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 text-xs">{t("packages.totalProfit")}</span>
                                <span className="text-green-400 text-xs font-medium">
                                  +{formatUSD(projectedProfit)}
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-green-500/20">
                              <span className="text-slate-300 text-xs">
                                {t("packages.principalReturnedAt").replace("{n}", durationDays.toString())}
                              </span>
                              <span className="text-blue-400 font-bold text-sm">{formatUSD(amt)}</span>
                            </div>
                          </div>

                          <Button
                            className="w-full h-11 text-base font-semibold professional-gradient"
                            onClick={() => handleBuy(pkg)}
                            disabled={hasActive}
                          >
                            {hasActive ? t("packages.alreadyActive") : t("packages.activatePackage")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {packages.length === 0 && (
                  <div className="col-span-1 text-center text-muted-foreground py-8">
                    <p>{t("dashboard.noPackages")}</p>
                  </div>
                )}
              </div>
            </div>

            {/* My Packages */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">{t("packages.myPackages")}</h2>
              {investments.length === 0 ? (
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardContent className="p-6 text-muted-foreground">{t("packages.noPackagesDesc")}</CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {investments.map((inv) => (
                    <InvestmentCard key={inv.id} inv={inv} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div />
        </div>
      </div>
    </div>
  )
}
