"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Package,
  Wallet,
  PieChart,
  CreditCard,
} from "lucide-react"
import Link from "next/link"
import { marketDataService, type MarketData } from "@/lib/market-data"
import { supabase } from "@/lib/supabase/client"

interface UserProfile {
  balance: number
  total_referrals: number
  total_trades: number
}

interface UserWallet {
  currency: string
  balance: number
  total_profit: number
  total_loss: number
  total_deposited: number
}

interface BinaryTrade {
  id: string
  asset: string
  type: string
  amount: number
  profit_loss: number | null
  created_at: string
  roi_percentage: number | null
  result: string | null
}

interface InvestmentPackage {
  id: string
  title: string
  min_investment: number
  max_investment: number
  roi_daily_percentage: number
  duration_days: number
  image_url: string | null
  is_active: boolean
}

interface UserPackagePurchase {
  id: string
  amount: number
  status: string
  daily_profit: number
  total_credited: number
  days_completed: number
  package: InvestmentPackage
}

type DashboardClientProps = {
  userName: string
  userId: string
  balance: number
  totalReferrals: number
  totalTrades: number
}

export default function DashboardClient({
  userName,
  userId,
  balance,
  totalReferrals,
  totalTrades,
}: DashboardClientProps) {
  const [marketData, setMarketData] = useState<MarketData[]>([])
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [recentTrades, setRecentTrades] = useState<BinaryTrade[]>([])
  const [totalTradesCount, setTotalTradesCount] = useState<number>(totalTrades)
  const [packages, setPackages] = useState<InvestmentPackage[]>([])
  const [userPackages, setUserPackages] = useState<UserPackagePurchase[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserData = async () => {
    try {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("balance, total_referrals, total_trades")
        .eq("uid", userId)
        .single()
      if (profileData) setProfile(profileData)

      const { data: walletsData } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", userId)
      setWallets(walletsData || [])

      const { data: tradesRows } = await supabase
        .from("trades")
        .select("id, asset, type, amount, profit_loss, created_at, roi_percentage, result")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(4)
      setRecentTrades(tradesRows || [])

      const { count: tradesCount } = await supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
      setTotalTradesCount(tradesCount ?? 0)
      setProfile((prev) => (prev ? { ...prev, total_trades: tradesCount ?? 0 } : prev))

      const { data: packagesData } = await supabase
        .from("investment_packages")
        .select("*")
        .eq("is_active", true)
        .limit(3)
      setPackages(packagesData || [])

      const { data: userPackagesData } = await supabase
        .from("user_package_purchases")
        .select(`*, package:investment_packages(*)`)
        .eq("user_id", userId)
        .in("status", ["active", "running"])
      setUserPackages(userPackagesData || [])
    } catch (err) {
      console.error("[Dashboard] fetchUserData exception:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) return
    if (typeof window === "undefined") return
    if (!supabase || !supabase.channel) return

    let channel: any = null
    try {
      channel = supabase
        .channel("trades_changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "trades", filter: `user_id=eq.${userId}` },
          () => {
            fetchUserData().catch((e) => console.error("[Dashboard] fetchUserData error", e))
          }
        )
        .subscribe()
    } catch (err) {
      console.error("[Dashboard] realtime subscribe failed:", err)
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch (e) {
        console.warn("[Dashboard] removeChannel failed:", e)
      }
    }
  }, [userId])

  useEffect(() => {
    const initialData = marketDataService.getAllMarketData()
    setMarketData(initialData)

    const cryptoPairs = ["BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD"]
    const unsubscribers = cryptoPairs.map((symbol) =>
      marketDataService.subscribe(symbol, (updatedData) => {
        setMarketData((prev) =>
          prev.map((item) => (item.symbol === updatedData.symbol ? updatedData : item))
        )
      })
    )

    fetchUserData()
    return () => {
      try {
        unsubscribers.forEach((unsub) => unsub && unsub())
      } catch (e) {
        console.warn("[Dashboard] market unsub error:", e)
      }
    }
  }, [userId])

  const totalBalance = profile?.balance ?? balance
  const todayProfit = wallets.reduce((sum, w) => sum + (w.total_profit ?? 0), 0)
  const todayProfitPercent = totalBalance > 0 ? (todayProfit / totalBalance) * 100 : 0

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24 flex items-center justify-center"
        translate="no"
        data-react-protected
      >
        <div className="text-white text-xl">Loading your dashboard...</div>
      </div>
    )
  }

  const cryptoData = marketData
    .filter((item) => ["BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD", "XAU/USD"].includes(item.symbol))
    .slice(0, 5)

  
      

     
  

  // ---------------- UI ----------------
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24"
      translate="no"
      data-react-protected
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Welcome Back, {userName}!</h1>
          <p className="text-blue-200">Here's your trading overview for today</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Balance */}
          <Card className="trading-card" translate="no">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-300">Total Balance</h2>
                  <p className="text-3xl font-bold text-white mt-2">
                    ${Number(totalBalance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-full">
                  <Wallet className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Referrals */}
          <Card className="trading-card" translate="no">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-300">Total Referrals</h2>
                  <p className="text-3xl font-bold text-white mt-2">{totalReferrals}</p>
                  <p className={`text-sm flex items-center ${todayProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {todayProfit >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {todayProfit >= 0 ? "+" : ""}
                    {todayProfitPercent.toFixed(2)}%
                  </p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-full">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Trades */}
          <Card className="trading-card" translate="no">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Trades</p>
                  <p className="text-2xl font-bold text-white">{totalTradesCount}</p>
                </div>
                <div className="p-3 bg-orange-500/20 rounded-full">
                  <PieChart className="w-6 h-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Assets */}
        <Card className="trading-card" translate="no">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Top Assets</CardTitle>
              <Link href="/dashboard/trading">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700/60 bg-transparent">
                  <Eye className="w-4 h-4 mr-2" />
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {cryptoData.map((asset) => {
              const price = Number(asset.price ?? 0)
              return (
                <div key={asset.symbol} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {asset.symbol.includes("/") ? asset.symbol.split("/")[0].slice(0, 2) : asset.symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{asset.symbol}</p>
                      <p className="text-muted-foreground text-sm">Vol: {(asset.volume ?? 0 / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">
                      {asset.symbol.includes("XAU")
                        ? `$${price.toFixed(1)}`
                        : asset.symbol.includes("JPY")
                        ? price.toFixed(2)
                        : price >= 1000
                        ? `$${price.toLocaleString()}`
                        : `$${price.toFixed(4)}`}
                    </p>
                    <p className={`text-sm flex items-center justify-end ${(asset.changePercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(asset.changePercent ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                      {(asset.changePercent ?? 0) >= 0 ? "+" : ""}
                      {(asset.changePercent ?? 0).toFixed(2)}%
                    </p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent Trading Activity */}
        <Card className="trading-card" translate="no">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Recent Trading Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentTrades.length > 0 ? (
              recentTrades.map((trade) => (
                <div key={trade.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="text-white font-medium">{trade.asset}</span>
                      <Badge variant={trade.type === "CALL" ? "default" : "secondary"} className="text-xs">
                        {trade.type}
                      </Badge>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        (trade.profit_loss ?? 0) > 0 ? "text-green-400" : (trade.profit_loss ?? 0) < 0 ? "text-red-400" : "text-slate-300"
                      }`}
                    >
                      {trade.result === "win"
                        ? `+$${(trade.profit_loss ?? 0).toFixed(2)}`
                        : trade.result === "lose"
                        ? `-$${Math.abs(trade.profit_loss ?? 0).toFixed(2)}`
                        : "Pending"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Amount: ${Number(trade.amount ?? 0).toFixed(2)}</span>
                    <span>ROI: {trade.roi_percentage ?? 0}%</span>
                    <span>{trade.created_at ? new Date(trade.created_at).toLocaleString() : ""}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent trades found</p>
                <p className="text-sm">Start trading to see your activity here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Investment Packages */}
        <Card className="trading-card" translate="no">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Investment Packages
              </CardTitle>
              <Link href="/dashboard/packages">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700/60 bg-transparent">
                  <Eye className="w-4 h-4 mr-2" />
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.length > 0 ? (
                packages.map((pkg) => (
                  <div key={pkg.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-medium">{pkg.title}</h3>
                      <Badge variant="secondary">Available</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-muted-foreground">Min</p>
                        <p className="text-white font-medium">${pkg.min_investment.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="text-white font-medium">{pkg.duration_days} days</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Daily ROI</p>
                        <p className="text-green-400 font-medium">{pkg.roi_daily_percentage}%</p>
                      </div>
                    </div>
                    <Link href="/dashboard/packages">
                      <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" size="sm">
                        Invest Now
                      </Button>
                    </Link>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center text-muted-foreground py-8">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No investment packages available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="trading-card" translate="no">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/dashboard/trading">
                <Button className="w-full h-16 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                  <div className="text-center">
                    <TrendingUp className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Buy Crypto</span>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/trading">
                <Button className="w-full h-16 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700">
                  <div className="text-center">
                    <TrendingDown className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Sell Crypto</span>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/deposit">
                <Button className="w-full h-16 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                  <div className="text-center">
                    <CreditCard className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Deposit</span>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/withdraw">
                <Button className="w-full h-16 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700">
                  <div className="text-center">
                    <DollarSign className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Withdraw</span>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
