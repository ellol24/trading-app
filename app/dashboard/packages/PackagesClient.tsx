"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DollarSign, Clock, Package, PiggyBank, Wallet, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"

function formatUSD(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

export default function PackagesClient({ userId }: { userId: string }) {
  const { toast } = useToast()
  const [wallet, setWallet] = useState<number>(0)
  const [packages, setPackages] = useState<any[]>([])
  const [investments, setInvestments] = useState<any[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({})

  // منع تنفيذ إنهاء الباقة أكثر من مرة محليًا
  const finishedIdsRef = useRef<Set<any>>(new Set())

  // جلب البيانات (الباقات + الاستثمارات + الرصيد)
  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      try {
        // باقات مرئية
        const { data: pkgs, error: pkgErr } = await supabase
          .from("investment_packages")
          .select("*")
          .eq("is_active", true)
        if (pkgErr) console.error("[Packages] packages fetch error:", pkgErr)
        if (pkgs) setPackages(pkgs)

        // استثمارات المستخدم مع relation
        const { data: invs, error: invErr } = await supabase
          .from("investments")
          .select("*, investment_packages(*)")
          .eq("user_id", userId)
        if (invErr) console.error("[Packages] investments fetch error:", invErr)
        if (invs) setInvestments(invs)

        // رصيد المستخدم
        const { data: bal, error: balErr } = await supabase
          .from("user_profiles")
          .select("balance")
          .eq("uid", userId)
          .single()
        if (balErr) console.error("[Packages] balance fetch error:", balErr)
        if (bal && typeof bal.balance !== "undefined") setWallet(Number(bal.balance))
      } catch (err) {
        console.error("[Packages] fetchData error:", err)
      }
    }

    fetchData()
  }, [userId])

  // شراء باقة
  const handleBuy = async (pkg: any) => {
    if (!userId) return
    const amt = amounts[pkg.id] ?? pkg.min_investment ?? 0

    if (amt < (pkg.min_investment ?? 0) || amt > (pkg.max_investment ?? Infinity)) {
      toast({
        title: "Invalid amount",
        description: `Amount must be between ${pkg.min_investment} and ${pkg.max_investment}`,
        variant: "destructive",
      })
      return
    }

    if (wallet < amt) {
      toast({
        title: "Insufficient Balance",
        description: "Your wallet balance is not enough to activate this package.",
        variant: "destructive",
      })
      return
    }

    try {
      // حجز المبلغ أولاً (ببساطة تخفيض الرصيد)
      const { error: balErr } = await supabase
        .from("user_profiles")
        .update({ balance: wallet - amt })
        .eq("uid", userId)

      if (balErr) {
        toast({ title: "Error", description: balErr.message ?? "Unable to update balance", variant: "destructive" })
        return
      }

      // إدخال الاستثمار
      const { error: invErr } = await supabase.from("investments").insert([
        {
          user_id: userId,
          package_id: pkg.id,
          amount: amt,
          status: "active",
          start_date: new Date().toISOString(),
        },
      ])

      if (invErr) {
        // محاولة إعادة الرصيد عند الفشل
        await supabase.from("user_profiles").update({ balance: wallet }).eq("uid", userId)
        toast({ title: "Error", description: invErr.message ?? "Failed to create investment", variant: "destructive" })
        return
      }

      toast({ title: "Package activated", description: `${pkg.title} started.` })
      // تحديث محلي للواجهة
      setWallet((prev) => prev - amt)

      // إعادة جلب الاستثمارات لتحديث القائمة
      const { data: invs } = await supabase
        .from("investments")
        .select("*, investment_packages(*)")
        .eq("user_id", userId)
      if (invs) setInvestments(invs)
    } catch (err) {
      console.error("handleBuy error", err)
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" })
    }
  }

  // عند انتهاء الباقة (يتم استدعاؤها مرة واحدة لكل استثمار)
  const handleInvestmentComplete = async (inv: any) => {
    if (!inv || finishedIdsRef.current.has(inv.id)) return
    finishedIdsRef.current.add(inv.id)

    try {
      const amount = Number(inv.amount || 0)
      const roiDaily = Number(inv.investment_packages?.roi_daily_percentage ?? inv.roi_daily_percentage ?? 0)
      const durationDays = Number(inv.investment_packages?.duration_days ?? inv.duration_days ?? 0)

      const profit = Number(((amount * (roiDaily / 100)) * durationDays).toFixed(2))
      const totalReturn = Number((amount + profit).toFixed(2))

      // تحديث حالة الاستثمار
      const { error: invUpdErr } = await supabase
        .from("investments")
        .update({ status: "completed", profit })
        .eq("id", inv.id)

      if (invUpdErr) {
        console.error("Failed to update investment status:", invUpdErr)
        return
      }

      // تحديث رصيد المستخدم (يمكن تحسين ذلك باستخدام RPC/transaction على Postgres)
      const { data: bal, error: balErr } = await supabase
        .from("user_profiles")
        .select("balance")
        .eq("uid", inv.user_id || userId)
        .single()

      if (balErr) console.error("Failed to read user balance:", balErr)
      const currentBalance = Number(bal?.balance ?? wallet ?? 0)
      const newBalance = Number((currentBalance + totalReturn).toFixed(2))

      const { error: balUpdErr } = await supabase
        .from("user_profiles")
        .update({ balance: newBalance })
        .eq("uid", inv.user_id || userId)

      if (balUpdErr) console.error("Failed to update user balance:", balUpdErr)
      else setWallet(newBalance)

      // إعادة تحميل الاستثمارات
      const { data: invs } = await supabase
        .from("investments")
        .select("*, investment_packages(*)")
        .eq("user_id", userId)
      if (invs) setInvestments(invs)
    } catch (err) {
      console.error("handleInvestmentComplete error", err)
    }
  }

  // مُكوّن صغير للعداد الزمني + شريط التقدم لكل استثمار
  function InvestmentTimer({ inv }: { inv: any }) {
    const [timeLeftText, setTimeLeftText] = useState<string>("")
    const [progress, setProgress] = useState<number>(0)
    const [localDone, setLocalDone] = useState<boolean>(inv.status !== "active")

    useEffect(() => {
      if (!inv) return
      if (localDone) return

      const startTime = new Date(inv.start_date ?? inv.created_at ?? Date.now()).getTime()
      const durationDays = Number(inv.investment_packages?.duration_days ?? inv.duration_days ?? 0)
      const durationMs = durationDays * 24 * 60 * 60 * 1000
      const endTime = startTime + durationMs

      let mounted = true

      const tick = () => {
        if (!mounted) return
        const now = Date.now()
        const diff = endTime - now

        if (diff <= 0) {
          setTimeLeftText("انتهت الباقة")
          setProgress(100)
          setLocalDone(true)
          setTimeout(() => {
            void handleInvestmentComplete(inv)
          }, 300)
          return
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((diff / (1000 * 60)) % 60)
        const seconds = Math.floor((diff / 1000) % 60)
        setTimeLeftText(`${days}d ${hours}h ${minutes}m ${seconds}s`)

        const elapsed = now - startTime
        const pct = durationMs > 0 ? Math.min(100, Math.max(0, (elapsed / durationMs) * 100)) : 0
        setProgress(pct)
      }

      tick()
      const id = setInterval(tick, 1000)
      return () => {
        mounted = false
        clearInterval(id)
      }
    }, [inv, localDone])

    return (
      <div translate="no" data-react-protected>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">Remaining</div>
          <div className="text-sm font-medium text-blue-200">{timeLeftText}</div>
        </div>
        <Progress value={Math.round(progress)} className="h-2" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
      translate="no" // منع الترجمة على مستوى الصفحة
      data-react-protected // وسم لحماية عناصر داخل الصفحة
    >
      <div className="p-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Wallet summary */}
          <Card className="trading-card" translate="no" data-react-protected>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <Wallet className="h-5 w-5" />
                <span>Mining Wallet</span>
              </CardTitle>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400 bg-emerald-400/10">
                <PiggyBank className="h-4 w-4 mr-1" />
                Profits auto-credit daily
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-3xl font-bold text-white">{formatUSD(wallet)}</p>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Profits are credited once per day based on your active packages.
              </div>
            </CardContent>
          </Card>

          {/* Active Packages Overview */}
          <Card className="trading-card" translate="no" data-react-protected>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <Package className="h-5 w-5" />
                <span>Active Packages Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-blue-400">
                    {investments.filter((i) => i.status === "active").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Packages</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-green-400">
                    {formatUSD(investments.reduce((s, i) => s + Number(i.profit || 0), 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-purple-400">
                    {investments.length > 0
                      ? (
                          investments.reduce((s, i) => s + Number(i.investment_packages?.roi_daily_percentage || 0), 0) /
                          investments.length
                        ).toFixed(2)
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Daily ROI</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/10">
                  <p className="text-2xl font-bold text-orange-400">
                    {investments
                      .filter((i) => i.status === "active")
                      .map((i) => i.investment_packages?.duration_days || 0)
                      .reduce((a, b) => a + b, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Remaining Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Packages */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Available Mining Packages</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {packages.map((pkg) => {
                  const amt = amounts[pkg.id] ?? pkg.min_investment
                  return (
                    <Card key={pkg.id} className="trading-card" translate="no" data-react-protected>
                      <CardContent className="p-0">
                        <div className="relative">
                          <img
                            src={pkg.image_url || "/placeholder.svg"}
                            alt={pkg.title ?? "package"}
                            className="w-full h-44 object-cover rounded-t-lg"
                          />
                          <div className="absolute top-4 right-4">
                            <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
                              {pkg.roi_daily_percentage}% daily
                            </Badge>
                          </div>
                        </div>

                        <div className="p-5 space-y-4">
                          <h3 className="text-lg font-semibold text-white">{pkg.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{pkg.description}</p>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center space-x-2 p-3 rounded-lg bg-background/10">
                              <Clock className="h-4 w-4 text-blue-400" />
                              <div>
                                <p className="text-white font-medium">{pkg.duration_days} Days</p>
                                <p className="text-muted-foreground text-xs">Duration</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 p-3 rounded-lg bg-background/10">
                              <DollarSign className="h-4 w-4 text-green-400" />
                              <div>
                                <p className="text-white font-medium">
                                  {formatUSD(pkg.min_investment)} - {formatUSD(pkg.max_investment)}
                                </p>
                                <p className="text-muted-foreground text-xs">Investment Range</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`amount-${pkg.id}`} className="text-muted-foreground">
                              Amount
                            </Label>
                            <Input
                              id={`amount-${pkg.id}`}
                              type="number"
                              min={pkg.min_investment}
                              max={pkg.max_investment}
                              value={amt}
                              onChange={(e) =>
                                setAmounts((prev) => ({ ...prev, [pkg.id]: Number(e.target.value || 0) }))
                              }
                              className="bg-background/20 text-white border-slate-700"
                            />
                          </div>

                          <Button
                            className="w-full h-11 text-base font-semibold professional-gradient"
                            onClick={() => handleBuy(pkg)}
                          >
                            Activate Package
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {packages.length === 0 && (
                  <div className="col-span-1 text-center text-muted-foreground py-8">
                    <p>No packages available</p>
                  </div>
                )}
              </div>
            </div>

            {/* My Packages */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">My Packages</h2>
              {investments.length === 0 ? (
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardContent className="p-6 text-muted-foreground">
                    You have no packages yet. Activate one to start earning daily profits.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {investments.map((inv) => (
                    <Card key={inv.id} className="trading-card" translate="no" data-react-protected>
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-white font-semibold">{inv.investment_packages?.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              Amount {formatUSD(inv.amount)} • Daily ROI {inv.investment_packages?.roi_daily_percentage}% • Duration {inv.investment_packages?.duration_days} days
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Profit</div>
                            <div className="text-lg font-semibold text-green-400">{formatUSD(inv.profit || 0)}</div>
                          </div>
                        </div>

                        {/* عداد + شريط تقدم مرتبط بالاستثمار */}
                        <InvestmentTimer inv={inv} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Helpful Links — يمكنك إضافة روابط مساعدة هنا */}
          <div />
        </div>
      </div>
    </div>
  )
}
