// app/admin/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AdminDashboardClient from "./AdminDashboardClient"

type Overview = {
  totalUsers: number
  totalAdmins: number
  activeInvestments: number
  totalDeposits: number
  totalWithdrawals: number
  pendingWithdrawals: number
  platformRevenue: number
  monthlyGrowth: number
  recentUsers: Array<{
    id: string
    name: string | null
    email: string | null
    country: string | null
    joinDate: string
    status: string | null
    balance: number
    role: string
    plain_password?: string
    last_ip?: string
  }>
  pendingActions: Array<{
    id: string
    type: "withdrawal" | "kyc" | "deposit" | "support"
    user: string
    amount?: number
    method?: string
    timestamp: string
    priority: "high" | "medium" | "low"
  }>
  systemAlerts: Array<{
    id: string | number
    type: "warning" | "info" | "success"
    message: string
    timestamp: string
    status: "active" | "resolved"
  }>
  recentActivity: Array<{ id: string; ts: string; text: string }>
}

export default async function AdminPage() {
  const supabase = createClient()

  // 1) تحقق من الجلسة
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  // 2) بروفايل الأدمن
  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("uid, role, full_name")
    .eq("uid", session.user.id)
    .single()

  if (profileErr || profile?.role !== "admin") redirect("/dashboard")

  // Helpers
  const safeCount = async (table: string, match?: Record<string, any>) => {
    const query = supabase.from(table).select("*", { count: "exact", head: true })
    const { count, error } = match ? await query.match(match) : await query
    if (error && error.code === "42P01") return 0
    if (error) return 0
    return count || 0
  }

  const safeSelect = async <T,>(table: string, select: string) => {
    const { data, error } = await supabase.from(table).select(select)
    if (error && error.code === "42P01") return [] as T[]
    if (error) return [] as T[]
    return (data || []) as T[]
  }

  const sumAmount = (rows: any[], field = "amount") =>
    rows.reduce((s, r) => s + Number(r?.[field] ?? 0), 0)

  // 3) إجمع البيانات
  const totalUsers = await safeCount("user_profiles")
  const totalAdmins = await safeCount("user_profiles", { role: "admin" }) // ✅ عدد الأدمن

  const investmentsActive = await safeCount("investments", { status: "active" })

  const depositsRows = await safeSelect<any>("deposits", "amount, status, created_at, user_id, method")
  const totalDeposits = sumAmount(depositsRows)

  const withdrawalsRows = await safeSelect<any>("withdrawals", "amount, status, created_at, user_id, method")
  const totalWithdrawals = sumAmount(withdrawalsRows.filter((w) => w.status === "completed"))
  const pendingWithdrawals = sumAmount(withdrawalsRows.filter((w) => w.status === "pending"))

  const platformRevenue = Math.max(totalDeposits - totalWithdrawals, 0)

  // Monthly growth
  const now = new Date()
  const d30 = new Date(now); d30.setDate(now.getDate() - 30)
  const d60 = new Date(now); d60.setDate(now.getDate() - 60)

  const depLast30 = depositsRows.filter(r => new Date(r.created_at) >= d30)
  const depPrev30 = depositsRows.filter(r => new Date(r.created_at) >= d60 && new Date(r.created_at) < d30)
  const vLast30 = sumAmount(depLast30)
  const vPrev30 = sumAmount(depPrev30)
  const monthlyGrowth = vPrev30 > 0 ? ((vLast30 - vPrev30) / vPrev30) * 100 : 0

  // Users
  const users = await safeSelect<any>(
    "user_profiles",
    "uid, full_name, email, country, created_at, status, role, plain_password, last_ip"
  )

  const balances = await safeSelect<any>("balances", "user_id, available, balance, total")
  const balanceMap = new Map<string, number>()
  for (const b of balances) {
    const v = Number(b?.available ?? b?.balance ?? b?.total ?? 0)
    balanceMap.set(b.user_id, v)
  }

  const recentUsers = users
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((u) => ({
      id: u.uid,
      name: u.full_name ?? null,
      email: u.email ?? null,
      country: u.country ?? null,
      joinDate: new Date(u.created_at).toISOString().slice(0, 10),
      status: u.status ?? null,
      balance: balanceMap.get(u.uid) ?? 0,
      role: u.role ?? "user",
      plain_password: u.plain_password ?? "N/A", // ✅ كلمة المرور بدون تشفير
      last_ip: u.last_ip ?? "N/A",               // ✅ آخر IP
    }))

  // Pending actions
  const pendingActions: Overview["pendingActions"] = []

  withdrawalsRows
    .filter((w) => w.status === "pending")
    .slice(0, 5)
    .forEach((w, idx) =>
      pendingActions.push({
        id: `wd-${idx}`,
        type: "withdrawal",
        user: String(w.user_id ?? "user"),
        amount: Number(w.amount ?? 0),
        method: String(w.method ?? "Unknown"),
        timestamp: new Date(w.created_at).toISOString().replace("T", " ").slice(0, 16),
        priority: "high",
      })
    )

  const kycRows = await safeSelect<any>("kyc_verifications", "user_id, status, document_type, created_at")
  kycRows
    .filter((k) => (k.status ?? "").toLowerCase() === "pending")
    .slice(0, 5)
    .forEach((k, idx) =>
      pendingActions.push({
        id: `kyc-${idx}`,
        type: "kyc",
        user: String(k.user_id ?? "user"),
        timestamp: new Date(k.created_at).toISOString().replace("T", " ").slice(0, 16),
        priority: "medium",
      })
    )

  depositsRows
    .filter((d) => (d.status ?? "").toLowerCase() === "pending")
    .slice(0, 5)
    .forEach((d, idx) =>
      pendingActions.push({
        id: `dp-${idx}`,
        type: "deposit",
        user: String(d.user_id ?? "user"),
        amount: Number(d.amount ?? 0),
        method: String(d.method ?? "Unknown"),
        timestamp: new Date(d.created_at).toISOString().replace("T", " ").slice(0, 16),
        priority: "low",
      })
    )

  const alerts: Overview["systemAlerts"] = [
    {
      id: 1,
      type: "info",
      message: "System online",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 16),
      status: "active",
    },
  ]

  const recentActivity: Overview["recentActivity"] = []
  depositsRows.slice(0, 3).forEach((d, i) => {
    recentActivity.push({
      id: `evt-dep-${i}`,
      ts: new Date(d.created_at).toISOString().replace("T", " ").slice(0, 16),
      text: `User ${d.user_id} deposited $${Number(d.amount ?? 0).toFixed(2)} (${d.method ?? "method"})`,
    })
  })
  withdrawalsRows.slice(0, 2).forEach((w, i) => {
    recentActivity.push({
      id: `evt-wd-${i}`,
      ts: new Date(w.created_at).toISOString().replace("T", " ").slice(0, 16),
      text: `User ${w.user_id} requested withdrawal $${Number(w.amount ?? 0).toFixed(2)} (${w.status})`,
    })
  })

  const data: Overview = {
    totalUsers,
    totalAdmins,
    activeInvestments: investmentsActive,
    totalDeposits,
    totalWithdrawals,
    pendingWithdrawals,
    platformRevenue,
    monthlyGrowth,
    recentUsers,
    pendingActions,
    systemAlerts: alerts,
    recentActivity,
  }

  return <AdminDashboardClient adminName={profile?.full_name ?? "Admin"} data={data} />
}
