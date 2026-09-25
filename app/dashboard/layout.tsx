import type React from "react"
import BottomNavigation from "@/components/bottom-navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <main>{children}</main>
      <BottomNavigation />
    </div>
  )
}
