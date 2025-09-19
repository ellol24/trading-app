"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TrendingUp } from "lucide-react"
import { BRAND_NAME } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { UserNav } from "@/components/auth/user-nav"

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/packages", label: "Packages" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const { user, loading } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/50 bg-slate-950/70 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
            <TrendingUp className="h-5 w-5 text-white" />
          </span>
          <span className="text-base font-semibold text-white">{BRAND_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative text-sm text-slate-300 transition-colors hover:text-white",
                  active && "text-white",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute -bottom-2 left-0 h-[2px] w-full rounded bg-gradient-to-r from-blue-500 to-purple-600" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-10 w-20 bg-slate-700/50 animate-pulse rounded" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" className="text-slate-200 hover:text-white">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserNav user={user} />
            </div>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-slate-200 hover:text-white">
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button
                asChild
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500"
              >
                <Link href="/auth/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
