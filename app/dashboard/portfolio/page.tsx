"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Clock, Target, Award, Activity } from 'lucide-react'

const portfolioData = {
  totalBalance: 15750.00,
  totalInvested: 12500.00,
  totalProfit: 3250.00,
  profitPercentage: 26.0,
  availableBalance: 5750.00,
  todayPnL: 245.50,
  todayPnLPercentage: 1.58
}

const activePositions = [
  {
    id: 1,
    asset: "EUR/USD",
    type: "HIGHER",
    amount: 100,
    entryPrice: 1.0845,
    currentPrice: 1.0852,
    pnl: 85.00,
    pnlPercentage: 85.0,
    timeRemaining: "2:45",
    status: "winning"
  },
  {
    id: 2,
    asset: "BTC/USD",
    type: "LOWER",
    amount: 250,
    entryPrice: 43250,
    currentPrice: 43180,
    pnl: 187.50,
    pnlPercentage: 75.0,
    timeRemaining: "8:12",
    status: "winning"
  },
  {
    id: 3,
    asset: "AAPL",
    type: "HIGHER",
    amount: 150,
    entryPrice: 185.25,
    currentPrice: 184.90,
    pnl: -150.00,
    pnlPercentage: -100.0,
    timeRemaining: "1:23",
    status: "losing"
  }
]

const tradeHistory = [
  {
    id: 1,
    asset: "GBP/USD",
    type: "HIGHER",
    amount: 100,
    result: "WIN",
    pnl: 80.00,
    date: "2024-01-15 14:30",
    duration: "5m"
  },
  {
    id: 2,
    asset: "USD/JPY",
    type: "LOWER",
    amount: 200,
    result: "LOSS",
    pnl: -200.00,
    date: "2024-01-15 13:45",
    duration: "1m"
  },
  {
    id: 3,
    asset: "ETH/USD",
    type: "HIGHER",
    amount: 150,
    result: "WIN",
    pnl: 112.50,
    date: "2024-01-15 12:20",
    duration: "15m"
  },
  {
    id: 4,
    asset: "GOLD",
    type: "LOWER",
    amount: 300,
    result: "WIN",
    pnl: 195.00,
    date: "2024-01-15 11:10",
    duration: "30m"
  },
  {
    id: 5,
    asset: "TSLA",
    type: "HIGHER",
    amount: 100,
    result: "LOSS",
    pnl: -100.00,
    date: "2024-01-15 10:30",
    duration: "5m"
  }
]

const assetAllocation = [
  { asset: "Forex", percentage: 45, amount: 5625, color: "bg-blue-500" },
  { asset: "Crypto", percentage: 30, amount: 3750, color: "bg-purple-500" },
  { asset: "Stocks", percentage: 20, amount: 2500, color: "bg-green-500" },
  { asset: "Commodities", percentage: 5, amount: 625, color: "bg-yellow-500" }
]

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Portfolio</h1>
            <p className="text-blue-200 mt-1">Track your trading performance and positions</p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
            <TrendingUp className="w-4 h-4 mr-2" />
            +{portfolioData.todayPnLPercentage}% Today
          </Badge>
        </div>

        {/* Portfolio Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Balance</p>
                  <p className="text-2xl font-bold text-white">${portfolioData.totalBalance.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Profit</p>
                  <p className="text-2xl font-bold text-green-400">${portfolioData.totalProfit.toLocaleString()}</p>
                  <p className="text-green-400 text-sm">+{portfolioData.profitPercentage}%</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Available Balance</p>
                  <p className="text-2xl font-bold text-white">${portfolioData.availableBalance.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <PieChart className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Today's P&L</p>
                  <p className="text-2xl font-bold text-green-400">+${portfolioData.todayPnL}</p>
                  <p className="text-green-400 text-sm">+{portfolioData.todayPnLPercentage}%</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-background/20 border border-border/30">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary">Overview</TabsTrigger>
            <TabsTrigger value="positions" className="data-[state=active]:bg-primary">Active Positions</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary">Trade History</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Asset Allocation */}
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <PieChart className="w-5 h-5" />
                    <span>Asset Allocation</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assetAllocation.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{item.asset}</span>
                        <span className="text-muted-foreground">{item.percentage}%</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Progress value={item.percentage} className="flex-1" />
                        <span className="text-white font-semibold text-sm">${item.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Performance Chart */}
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Performance Chart</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-gradient-to-br from-slate-800/50 to-blue-900/30 rounded-lg flex items-center justify-center border border-border/30">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                      <p className="text-white font-semibold">Portfolio Performance</p>
                      <p className="text-blue-200 text-sm mt-2">7-day performance chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Active Positions ({activePositions.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activePositions.map((position) => (
                    <div
                      key={position.id}
                      className="p-4 bg-background/20 rounded-lg border border-border/30 hover:bg-background/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-white font-semibold">{position.asset}</h3>
                              <Badge
                                variant="outline"
                                className={position.type === "HIGHER" ? "text-green-400 border-green-400" : "text-red-400 border-red-400"}
                              >
                                {position.type}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Entry: {position.entryPrice} • Current: {position.currentPrice}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="text-white font-semibold">${position.amount}</p>
                              <p className="text-muted-foreground text-sm">Investment</p>
                            </div>
                            <div>
                              <p className={`font-bold ${position.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {position.pnl >= 0 ? "+" : ""}${position.pnl}
                              </p>
                              <p className={`text-sm ${position.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {position.pnlPercentage >= 0 ? "+" : ""}{position.pnlPercentage}%
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-white font-mono">{position.timeRemaining}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Award className="w-5 h-5" />
                  <span>Recent Trades</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tradeHistory.map((trade) => (
                    <div
                      key={trade.id}
                      className="p-4 bg-background/20 rounded-lg border border-border/30 hover:bg-background/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-white font-semibold">{trade.asset}</h3>
                              <Badge
                                variant="outline"
                                className={trade.type === "HIGHER" ? "text-green-400 border-green-400" : "text-red-400 border-red-400"}
                              >
                                {trade.type}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={trade.result === "WIN" ? "text-green-400 border-green-400 bg-green-400/10" : "text-red-400 border-red-400 bg-red-400/10"}
                              >
                                {trade.result}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {trade.date} • {trade.duration}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="text-white font-semibold">${trade.amount}</p>
                              <p className="text-muted-foreground text-sm">Investment</p>
                            </div>
                            <div>
                              <p className={`font-bold text-lg ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {trade.pnl >= 0 ? "+" : ""}${Math.abs(trade.pnl)}
                              </p>
                              <p className="text-muted-foreground text-sm">P&L</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">Trading Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Trades</span>
                    <span className="text-white font-semibold">127</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Winning Trades</span>
                    <span className="text-green-400 font-semibold">86</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Losing Trades</span>
                    <span className="text-red-400 font-semibold">41</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className="text-green-400 font-semibold">67.7%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average Trade</span>
                    <span className="text-white font-semibold">$156</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Best Trade</span>
                    <span className="text-green-400 font-semibold">+$450</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Worst Trade</span>
                    <span className="text-red-400 font-semibold">-$300</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">Monthly Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-gradient-to-br from-slate-800/50 to-blue-900/30 rounded-lg flex items-center justify-center border border-border/30">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                      <p className="text-white font-semibold">Monthly P&L Chart</p>
                      <p className="text-blue-200 text-sm mt-2">Performance over the last 12 months</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
