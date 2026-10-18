"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, DollarSign, TrendingUp, AlertTriangle, Search,
  RefreshCw, Trophy, BarChart3, Package, Zap, ChevronDown, ChevronRight, Eye,
} from "lucide-react";
import Link from "next/link";

type UserRow = {
  uid: string;
  full_name: string;
  email: string;
  referral_code: string;
  balance: number;
  total_referrals: number;
  active_referrals: number;
  level_breakdown: Record<number, number>;
  deposit_earnings: number;
  trade_earnings: number;
  package_earnings: number;
  milestone_earnings: number;
  total_earnings: number;
  total_deposited: number;
  status: string;
  joined: string;
  discrepancy: { expected: number; actual: number; diff: number } | null;
};

export default function AdminReferralsOverviewPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [discrepancies, setDiscrepancies] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof UserRow>("total_earnings");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState<"overview" | "discrepancies">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/referrals-overview");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
        setDiscrepancies(data.discrepancies ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (col: keyof UserRow) => {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const displayed = [...users]
    .filter((u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.referral_code.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortBy] as number;
      const bv = b[sortBy] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });

  const SortBtn = ({ col, label }: { col: keyof UserRow; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 hover:text-white transition-colors text-xs"
    >
      {label}
      {sortBy === col && (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 rotate-90" />)}
    </button>
  );

  const totalStats = {
    totalEarnings: users.reduce((s, u) => s + u.total_earnings, 0),
    totalReferrals: users.reduce((s, u) => s + u.total_referrals, 0),
    activeReferrals: users.reduce((s, u) => s + u.active_referrals, 0),
    discrepancyCount: discrepancies.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              Referrals Overview
            </h1>
            <p className="text-slate-400 mt-1">Per-user earnings breakdown, active referrals, and discrepancy alerts.</p>
          </div>
          <Button
            onClick={fetchData}
            disabled={loading}
            variant="outline"
            className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Referral Earnings", value: `$${totalStats.totalEarnings.toFixed(2)}`, icon: <DollarSign className="w-5 h-5 text-green-400" />, color: "bg-green-500/20" },
            { label: "Total Referrals", value: totalStats.totalReferrals, icon: <Users className="w-5 h-5 text-blue-400" />, color: "bg-blue-500/20" },
            { label: "Active Referrals", value: totalStats.activeReferrals, icon: <TrendingUp className="w-5 h-5 text-purple-400" />, color: "bg-purple-500/20" },
            { label: "⚠️ Discrepancies", value: totalStats.discrepancyCount, icon: <AlertTriangle className="w-5 h-5 text-red-400" />, color: "bg-red-500/20", alert: totalStats.discrepancyCount > 0 },
          ].map((stat) => (
            <Card key={stat.label} className={`trading-card ${stat.alert ? "border-red-500/40" : ""}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>{stat.icon}</div>
                <div>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Discrepancy Alert Banner */}
        {discrepancies.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/10">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-semibold text-sm">⚠️ {discrepancies.length} Commission Discrepancies Detected</p>
              <p className="text-red-400/80 text-xs mt-0.5">
                Some users have received more or fewer commissions than expected based on their L1 referrals' deposit totals. Click the "Discrepancies" tab to review.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "overview" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("discrepancies")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "discrepancies" ? "bg-red-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
          >
            ⚠️ Discrepancies ({discrepancies.length})
          </button>
        </div>

        {activeTab === "overview" && (
          <Card className="trading-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-white">Referral Earnings by User</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-800 border-slate-600 text-white text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-right"><SortBtn col="total_referrals" label="Referrals" /></th>
                      <th className="px-4 py-3 text-right"><SortBtn col="active_referrals" label="Active" /></th>
                      <th className="px-4 py-3 text-right"><SortBtn col="deposit_earnings" label="Deposit $" /></th>
                      <th className="px-4 py-3 text-right"><SortBtn col="trade_earnings" label="Trade $" /></th>
                      <th className="px-4 py-3 text-right"><SortBtn col="package_earnings" label="Package $" /></th>
                      <th className="px-4 py-3 text-right"><SortBtn col="total_earnings" label="Total $" /></th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
                    ) : displayed.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-slate-400">No data found</td></tr>
                    ) : (
                      displayed.map((u) => (
                        <>
                          <tr
                            key={u.uid}
                            className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${u.discrepancy ? "bg-red-500/5" : ""}`}
                            onClick={() => setExpandedRow(expandedRow === u.uid ? null : u.uid)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {expandedRow === u.uid
                                  ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                  : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                <div>
                                  <p className="text-white font-medium">{u.full_name}</p>
                                  <p className="text-slate-400 text-xs">{u.email}</p>
                                  <code className="text-[10px] text-yellow-400/80">{u.referral_code}</code>
                                </div>
                                {u.discrepancy && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-white">{u.total_referrals}</td>
                            <td className="px-4 py-3 text-right">
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{u.active_referrals}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300">${u.deposit_earnings.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-slate-300">${u.trade_earnings.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-slate-300">${u.package_earnings.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-bold text-green-400">${u.total_earnings.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/admin/users?uid=${u.uid}`}>
                                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700 h-7 text-xs">
                                  <Eye className="w-3 h-3 mr-1" />View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                          {expandedRow === u.uid && (
                            <tr key={`${u.uid}-exp`} className="bg-slate-800/30">
                              <td colSpan={8} className="px-8 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500">Level Breakdown</p>
                                    {[1, 2, 3].map((lvl) => (
                                      <p key={lvl} className="text-xs text-slate-300">L{lvl}: <span className="text-white font-medium">{u.level_breakdown[lvl] ?? 0} users</span></p>
                                    ))}
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500">Financials</p>
                                    <p className="text-xs text-slate-300">Total Deposited: <span className="text-blue-400 font-medium">${u.total_deposited.toFixed(2)}</span></p>
                                    <p className="text-xs text-slate-300">Balance: <span className="text-white font-medium">${u.balance.toFixed(2)}</span></p>
                                    <p className="text-xs text-slate-300">Milestone Bonus: <span className="text-yellow-400 font-medium">${u.milestone_earnings.toFixed(2)}</span></p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500">Account Info</p>
                                    <p className="text-xs text-slate-300">Status: <Badge className="text-[10px] ml-1 bg-green-500/20 text-green-400">{u.status}</Badge></p>
                                    <p className="text-xs text-slate-300">Joined: {new Date(u.joined).toLocaleDateString()}</p>
                                  </div>
                                  {u.discrepancy && (
                                    <div className="space-y-1 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                      <p className="text-xs text-red-400 font-semibold">⚠️ Commission Discrepancy</p>
                                      <p className="text-xs text-slate-300">Expected: <span className="text-white">${u.discrepancy.expected.toFixed(2)}</span></p>
                                      <p className="text-xs text-slate-300">Actual: <span className="text-white">${u.discrepancy.actual.toFixed(2)}</span></p>
                                      <p className="text-xs text-slate-300">Diff: <span className={u.discrepancy.diff > 0 ? "text-red-400" : "text-yellow-400"}>{u.discrepancy.diff > 0 ? "+" : ""}{u.discrepancy.diff.toFixed(2)}</span></p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "discrepancies" && (
          <Card className="trading-card border-red-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Commission Discrepancies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {discrepancies.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-green-400 font-medium">✅ No discrepancies detected — all commissions are accurate.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {discrepancies.map((u) => (
                    <div key={u.uid} className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-semibold">{u.full_name}</p>
                          <p className="text-slate-400 text-xs">{u.email} • <code className="text-yellow-400/80">{u.referral_code}</code></p>
                        </div>
                        <Link href={`/admin/users?uid=${u.uid}`}>
                          <Button size="sm" variant="outline" className="border-red-500/40 text-red-300 bg-transparent hover:bg-red-500/10">
                            Review
                          </Button>
                        </Link>
                      </div>
                      {u.discrepancy && (
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                            <p className="text-slate-400 text-xs">Expected</p>
                            <p className="text-white font-bold">${u.discrepancy.expected.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                            <p className="text-slate-400 text-xs">Actual</p>
                            <p className="text-white font-bold">${u.discrepancy.actual.toFixed(2)}</p>
                          </div>
                          <div className="bg-red-500/20 rounded-lg p-2 text-center">
                            <p className="text-slate-400 text-xs">Difference</p>
                            <p className={`font-bold ${u.discrepancy.diff > 0 ? "text-red-400" : "text-yellow-400"}`}>
                              {u.discrepancy.diff > 0 ? "+" : ""}{u.discrepancy.diff.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
