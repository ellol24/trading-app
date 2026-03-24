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
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { t } = useLanguage()

  const sidebarItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: t('admin.dashboard') },
    { href: "/admin/users", icon: Users, label: t('admin.userManagement') },
    { href: "/admin/packages", icon: Package, label: t('admin.packageManagement') },
    { href: "/admin/trading", icon: TrendingUp, label: t('admin.tradingControls') },
    { href: "/admin/withdrawals", icon: DollarSign, label: t('admin.withdrawals') },
    { href: "/admin/withdrawal", icon: DollarSign, label: t('admin.withdrawal') },
    { href: "/admin/wallets", icon: Wallet, label: t('admin.walletManagement') },
    { href: "/admin/deposit", icon: Wallet, label: t('admin.deposit') },
    { href: "/admin/settings", icon: Settings, label: t('admin.platformControls') },
  ]

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
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            {t('admin.adminPanel')}
          </h2>
          <Button variant="ghost" size="sm" className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="p-4 space-y-2">
          {sidebarItems.map((item) => (
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
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
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
        <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-30">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-slate-200" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.adminPanel')}</h1>
          <div className="w-8" /> {/* Spacer */}
        </div>

        <main className="min-h-screen bg-slate-950">{children}</main>
      </div>
    </div>
  )
}
