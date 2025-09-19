import type { ReactNode } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-12">{children}</main>
      <SiteFooter />
    </div>
  )
}
