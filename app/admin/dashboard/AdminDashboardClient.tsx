// app/admin/AdminDashboardClient.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Package, DollarSign, TrendingUp, Activity, Wallet, Settings, Clock, Shield } from "lucide-react"

type Props = {
  adminName: string
  data: {
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
}

export default function AdminDashboardClient({ adminName, data }: Props) {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-blue-200 mt-1">Welcome, {adminName}</p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="text-blue-500 border-blue-500">
              Full Control Enabled
            </Badge>
            <Button className="professional-gradient">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Users</p>
                  <p className="text-2xl font-bold text-white">{data.totalUsers.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Admins</p>
                  <p className="text-2xl font-bold text-white">{data.totalAdmins.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Active Investments</p>
                  <p className="text-2xl font-bold text-white">{data.activeInvestments.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Deposits</p>
                  <p className="text-2xl font-bold text-white">
                    ${data.totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Pending Withdrawals</p>
                  <p className="text-2xl font-bold text-white text-orange-500">
                    ${data.pendingWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-background/20 border border-border/30">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary">Overview</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary">Users</TabsTrigger>
            <TabsTrigger value="actions" className="data-[state=active]:bg-primary">Pending Actions</TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-primary">System</TabsTrigger>
          </TabsList>

          {/* Users Section */}
          <TabsContent value="users">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border border-slate-700 rounded-lg">
                    <thead className="bg-slate-800 text-white">
                      <tr>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-3">Role</th>
                        <th className="py-2 px-3">Password</th>
                        <th className="py-2 px-3">IP Address</th>
                        <th className="py-2 px-3">Country</th>
                        <th className="py-2 px-3">Join Date</th>
                        <th className="py-2 px-3">Balance</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentUsers.map((user) => (
                        <tr key={user.id} className="border-t border-slate-700">
                          <td className="py-2 px-3">{user.name ?? "Unnamed"}</td>
                          <td className="py-2 px-3">{user.email ?? "N/A"}</td>
                          <td className="py-2 px-3">{user.role}</td>
                          <td className="py-2 px-3">{user.plain_password ?? "N/A"}</td>
                          <td className="py-2 px-3">{user.last_ip ?? "N/A"}</td>
                          <td className="py-2 px-3">{user.country ?? "Unknown"}</td>
                          <td className="py-2 px-3">{user.joinDate}</td>
                          <td className="py-2 px-3">${user.balance.toLocaleString()}</td>
                          <td className="py-2 px-3">{user.status ?? "n/a"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 trading-card">
                <CardHeader><CardTitle className="text-white">Recent Activity</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.recentActivity.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border-b last:border-0 pb-3">
                      <span className="text-sm text-muted-foreground">{r.ts}</span>
                      <span className="text-sm text-white">{r.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          

          <TabsContent value="users">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">Recent Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="p-4 bg-background/20 rounded-lg border border-border/30 hover:bg-background/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {(user.name ?? "U N").split(" ").map(n => n[0]).join("")}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">{user.name ?? "Unnamed"}</h3>
                            <p className="text-muted-foreground text-sm">{user.email ?? "No email"}</p>
                            <p className="text-muted-foreground text-xs">
                              {user.country ?? "Unknown"} • Joined {user.joinDate}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold">
                            ${user.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                          <Badge variant="outline" className="text-blue-300 border-blue-300">
                            {user.status ?? "n/a"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Pending Actions ({data.pendingActions.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.pendingActions.map((action) => (
                    <div
                      key={action.id}
                      className="p-4 bg-background/20 rounded-lg border border-border/30 hover:bg-background/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              action.priority === "high"
                                ? "bg-red-400"
                                : action.priority === "medium"
                                ? "bg-yellow-400"
                                : "bg-green-400"
                            }`}
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-white font-semibold capitalize">{action.type}</h3>
                              <Badge variant="outline" className="text-xs">{action.priority}</Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {action.user} • {action.timestamp}
                            </p>
                            {"amount" in action && action.amount !== undefined && (
                              <p className="text-green-400 text-sm">
                                ${action.amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {action.method ? `via ${action.method}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">View</Button>
                          <Button size="sm" className="professional-gradient">Process</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <Card className="trading-card">
              <CardHeader><CardTitle className="text-white">System Alerts</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.systemAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 bg-background/20 rounded-lg border border-border/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{alert.message}</p>
                          <p className="text-muted-foreground text-sm">{alert.timestamp}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            alert.status === "active"
                              ? "text-yellow-400 border-yellow-400"
                              : "text-green-400 border-green-400"
                          }
                        >
                          {alert.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
