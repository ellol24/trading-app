"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Package,
  TrendingUp,
  DollarSign,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Megaphone,
  Trophy,
  Activity,
  Eye,
  ChevronDown,
  ChevronRight,
  Zap,
  Bot,
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [engagementOpen, setEngagementOpen] = useState(true)
  const { t } = useLanguage()

  const coreItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: t('admin.dashboard') },
    { href: "/admin/bots", icon: Bot, label: t('admin.telegramBots') || "Telegram Bots Hub" },
    { href: "/admin/users", icon: Users, label: t('admin.userManagement') },
    { href: "/admin/impersonate", icon: Eye, label: t('admin.testAsUser') || "Switch to User View" },
    { href: "/admin/packages", icon: Package, label: t('admin.packageManagement') },
    { href: "/admin/trading", icon: TrendingUp, label: t('admin.tradingControls') },
    { href: "/admin/withdrawals", icon: DollarSign, label: t('admin.withdrawals') },
    { href: "/admin/wallets", icon: Wallet, label: t('admin.walletManagement') },
    { href: "/admin/deposit", icon: Wallet, label: t('admin.deposit') },
    { href: "/admin/settings", icon: Settings, label: t('admin.platformControls') },
  ]

  const engagementItems = [
    { href: "/admin/referrals", icon: Users, label: t('admin.referralNetwork') || "Referral Network" },
    { href: "/admin/referrals-overview", icon: Trophy, label: t('admin.referralsOverview') || "Referrals Overview" },
    { href: "/admin/broadcast", icon: Megaphone, label: t('admin.broadcastCenter') || "Broadcast Center" },
    { href: "/admin/notifications", icon: Bell, label: t('admin.notificationCenter') || "Notification Center" },
    { href: "/admin/users-activity", icon: Activity, label: t('admin.usersActivity') || "User Activity" },
  ]

  const handleWeeklyWinner = async () => {
    const res = await fetch("/api/admin/weekly-winner", { method: "POST" })
    const data = await res.json()
    if (res.ok && data.winner) {
      alert(`🏆 Weekly Winner: ${data.winner.name} (${data.winner.active_referrals_this_week} referrals). Notification sent!`)
    } else {
      alert(data.message ?? data.error ?? "Error")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("userRole")
    window.location.href = "/auth/login"
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {t('admin.adminPanel')}
              </h2>
              <div className="mt-1">
                <LanguageSwitcher />
              </div>
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Link
            href="/admin/impersonate"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold shadow-sm transition-all"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('admin.testAsUser') || "Switch to User View (Test)"}</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* Core items */}
          {coreItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                pathname === item.href
                  ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-400 border border-blue-500/20 shadow-sm"
                  : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200",
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Engagement & Analytics collapsible group */}
          <div className="pt-2">
            <button
              onClick={() => setEngagementOpen(!engagementOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-purple-400" />
                {t('admin.engagementAnalytics') || "Engagement & Analytics"}
              </span>
              {engagementOpen
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {engagementOpen && (
              <div className="mt-1 space-y-1">
                {engagementItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ml-2",
                      pathname === item.href
                        ? "bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-purple-400 border border-purple-500/20 shadow-sm"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}

                {/* Weekly winner trigger button */}
                <button
                  onClick={handleWeeklyWinner}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ml-2 text-yellow-400 hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/20"
                >
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span>{t('admin.announceWeeklyWinner') || "Announce Weekly Winner"}</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent border-slate-700 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50 transition-all"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('admin.logout')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 transition-all duration-200">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-30 gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-slate-200" />
          </Button>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t('admin.adminPanel')}</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/impersonate"
              className="p-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1"
              title={t('admin.testAsUser') || "Switch to User View"}
            >
              <Eye className="w-4 h-4 text-blue-400" />
            </Link>
            <LanguageSwitcher />
          </div>
        </div>

        <main className="min-h-screen bg-slate-950">{children}</main>
      </div>
    </div>
  )
}
