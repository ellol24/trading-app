"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, Search, Filter, CheckCircle2, XCircle, Clock, Send, ShieldAlert, Info, UserRound, FileText, Wallet, Hash, Mail, KeyRound } from 'lucide-react'
import { CopyButton } from "@/components/ui/copy-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"

type Withdrawal = {
  id: string
  username: string
  email: string
  walletLabel: string
  asset: "BTC" | "ETH" | "USDT" | "USDC"
  address: string
  requestedAmount: number
  feePct: number
  netAmount: number
  otpVerified: boolean
  kycStatus: "approved" | "pending" | "rejected"
  status: "pending" | "approved" | "processing" | "paid" | "rejected"
  createdAt: string
}

type OtpRequest = {
  id: string
  username: string
  email: string
  emailOtp: string
  telegramOtp: string
  amount: number
  used: boolean
  expiresAt: string
  createdAt: string
}

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState<"all" | Withdrawal["status"]>("all")
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<Withdrawal[]>([])
  const [otps, setOtps] = useState<OtpRequest[]>([])
  const [selected, setSelected] = useState<Withdrawal | null>(null)
  const [action, setAction] = useState<"approve" | "reject" | "processing" | "paid" | null>(null)
  const [txId, setTxId] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true)

  const [detailsFor, setDetailsFor] = useState<Withdrawal | null>(null)
  const [userFor, setUserFor] = useState<Withdrawal | null>(null)

  const { toast } = useToast()

  const fetchWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select(`
        id,
        requested_amount,
        fee_pct,
        net_amount,
        status,
        otp_verified,
        kyc_status,
        created_at,
        withdrawal_wallets (
          label,
          asset,
          address
        ),
        users (
          username,
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const formatted: Withdrawal[] = data.map((w: any) => ({
      id: w.id,
      username: w.users?.username || "Unknown",
      email: w.users?.email || "—",
      walletLabel: w.withdrawal_wallets?.label || "",
      asset: w.withdrawal_wallets?.asset || "USDT",
      address: w.withdrawal_wallets?.address || "",
      requestedAmount: w.requested_amount,
      feePct: w.fee_pct,
      netAmount: w.net_amount,
      otpVerified: w.otp_verified,
      kycStatus: w.kyc_status,
      status: w.status,
      createdAt: w.created_at,
    }))

    setItems(formatted)
  }

  const fetchOtps = async () => {
    const { data, error } = await supabase
      .from("withdrawal_otps")
      .select(`
        id,
        email_otp,
        telegram_otp,
        amount,
        used,
        expires_at,
        created_at,
        user_id
      `)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("OTP fetch error", error)
      return
    }

    // Fetch user profiles for these OTPs
    const userIds = [...new Set(data.map((o: any) => o.user_id))]
    let userMap: Record<string, any> = {}
    
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from("user_profiles")
        .select("uid, first_name, last_name, email")
        .in("uid", userIds)
        
      if (usersData) {
        usersData.forEach((u: any) => {
          userMap[u.uid] = {
            username: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : "User",
            email: u.email || "—"
          }
        })
      }
    }

    setOtps(data.map((o: any) => ({
      id: o.id,
      username: userMap[o.user_id]?.username || "Unknown",
      email: userMap[o.user_id]?.email || "—",
      emailOtp: o.email_otp,
      telegramOtp: o.telegram_otp,
      amount: o.amount,
      used: o.used,
      expiresAt: o.expires_at,
      createdAt: o.created_at,
    })))
  }

  useEffect(() => {
    fetchWithdrawals()
    fetchOtps()

    const channel = supabase
      .channel("admin-withdrawals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast({
              title: "New Withdrawal Request",
              description: "A user has requested a new withdrawal.",
            });
            fetchWithdrawals();
          } else {
            fetchWithdrawals();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_otps" },
        () => {
          fetchOtps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [])

  const filtered = useMemo(() => {
    return items.filter((w) => {
      const matchStatus = status === "all" || w.status === status
      const q = query.toLowerCase().trim()
      const matchQ =
        !q ||
        w.username.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        w.address.toLowerCase().includes(q)
      return matchStatus && matchQ
    })
  }, [items, status, query])

  const openAction = (w: Withdrawal, type: typeof action) => {
    setSelected(w)
    setAction(type)
    setTxId("")
    setRejectReason("")
  }

  const closeDialog = () => {
    setSelected(null)
    setAction(null)
    setTxId("")
    setRejectReason("")
  }

  const applyAction = async () => {
    if (!selected || !action) return

    const newStatus =
      action === "approve"
        ? "approved"
        : action === "processing"
          ? "processing"
          : action === "paid"
            ? "paid"
            : "rejected"

    const { error } = await supabase
      .from("withdrawals")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", selected.id)

    if (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to update withdrawal status", variant: "destructive" })
    } else {
      toast({ title: "Updated", description: `Status changed to ${newStatus}` })
      fetchWithdrawals()
    }

    closeDialog()
  }

  const StatusBadge = ({ value }: { value: Withdrawal["status"] }) => (
    <Badge
      variant="outline"
      className={cn(
        value === "pending" && "text-yellow-600 border-yellow-600",
        value === "approved" && "text-blue-600 border-blue-600",
        value === "processing" && "text-purple-600 border-purple-600",
        value === "paid" && "text-green-600 border-green-600",
        value === "rejected" && "text-red-600 border-red-600"
      )}
    >
      {value}
    </Badge>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Withdrawals & Security Logs</h1>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={withdrawalsEnabled ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}
          >
            {withdrawalsEnabled ? "Withdrawals: Enabled" : "Withdrawals: Disabled"}
          </Badge>
          <Button variant={withdrawalsEnabled ? "destructive" : "default"} onClick={() => setWithdrawalsEnabled((v) => !v)}>
            {withdrawalsEnabled ? "Disable Withdrawals" : "Enable Withdrawals"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="bg-muted/50 border">
          <TabsTrigger value="requests">Finalized Requests</TabsTrigger>
          <TabsTrigger value="otps">OTP Security Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by username, email, request ID or address..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-4 h-4 mr-2" /> Requests ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filtered.map((w) => (
                <div key={w.id} className="p-4 rounded-lg border bg-card/50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <UserRound className="w-5 h-5 text-muted-foreground" />
                      <p className="font-semibold">
                        {w.username} <span className="text-muted-foreground">({w.email})</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        ${w.requestedAmount} requested
                      </Badge>
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        Fee {w.feePct}%
                      </Badge>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Net ${w.netAmount}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={w.status} />
                      <Badge variant="outline" className={w.otpVerified ? "text-green-600 border-green-600" : "text-yellow-600 border-yellow-600"}>
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        OTP {w.otpVerified ? "Verified" : "Unverified"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          w.kycStatus === "approved"
                            ? "text-green-600 border-green-600"
                            : w.kycStatus === "pending"
                              ? "text-yellow-600 border-yellow-600"
                              : "text-red-600 border-red-600"
                        }
                      >
                        KYC {w.kycStatus}
                      </Badge>
                      <span className="ml-auto text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-2">
                      <div className="rounded-md border bg-muted/30 p-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Wallet className="h-3.5 w-3.5" /> {w.asset} • {w.walletLabel}
                          </span>
                          <CopyButton value={w.address} tooltip="Copy address" aria-label="Copy address" />
                        </div>
                        <div className="mt-1 font-mono text-sm break-all">{w.address}</div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3.5 w-3.5" /> Request ID
                          </span>
                          <CopyButton value={w.id} tooltip="Copy request ID" aria-label="Copy request ID" />
                        </div>
                        <div className="mt-1 font-mono text-sm">{w.id}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openAction(w, "approve")}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAction(w, "processing")}>
                      <Clock className="w-4 h-4 mr-1" /> Mark Processing
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAction(w, "paid")}>
                      <Send className="w-4 h-4 mr-1" /> Mark Paid
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openAction(w, "reject")}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDetailsFor(w)}>
                      <FileText className="w-4 h-4 mr-1" /> View Details
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setUserFor(w)}>
                      <Info className="w-4 h-4 mr-1" /> User Info
                    </Button>
                  </div>
                </div>
              ))}

              {!filtered.length && <p className="text-sm text-muted-foreground">No withdrawals match your filters.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OTP Security Logs Tab */}
        <TabsContent value="otps">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-500" /> Recent OTP Sent Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {otps.map((o) => (
                  <div key={o.id} className="p-4 rounded-lg border bg-card/50 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserRound className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{o.username}</span> 
                        <span className="text-muted-foreground text-sm">({o.email})</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          o.used 
                            ? "bg-green-500/10 text-green-600 border-green-600" 
                            : (new Date(o.expiresAt) < new Date() ? "bg-red-500/10 text-red-600 border-red-600" : "bg-yellow-500/10 text-yellow-600 border-yellow-600")
                        }
                      >
                        {o.used ? "✅ Verified" : (new Date(o.expiresAt) < new Date() ? "❌ Expired" : "⏳ Pending Verification")}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/20 p-3 rounded-md border">
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Amount</div>
                        <div className="font-semibold">${o.amount}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Time Created</div>
                        <div>{new Date(o.createdAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Email Code</div>
                        <div className="font-mono bg-background px-2 py-1 rounded inline-block border">{o.emailOtp}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Telegram Code</div>
                        <div className="font-mono bg-background px-2 py-1 rounded inline-block border">{o.telegramOtp}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {!otps.length && <p className="text-sm text-muted-foreground">No OTP requests found.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!action} onOpenChange={(open) => { if (!open) { setAction(null); setSelected(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" && "Approve Withdrawal"}
              {action === "processing" && "Mark as Processing"}
              {action === "paid" && "Mark as Paid"}
              {action === "reject" && "Reject Withdrawal"}
            </DialogTitle>
            <DialogDescription>
              {selected ? `Request ${selected.id} • ${selected.username} • $${selected.requestedAmount}` : ""}
            </DialogDescription>
          </DialogHeader>

          {action === "paid" && (
            <div className="space-y-2">
              <Label>Transaction ID / Hash</Label>
              <Input placeholder="Enter payout TxID" value={txId} onChange={(e) => setTxId(e.target.value)} />
              {selected && (
                <div className="text-xs text-muted-foreground">
                  Paying to:
                  <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                    <span className="font-mono text-sm break-all flex-1">{selected.address}</span>
                    <CopyButton value={selected.address} tooltip="Copy address" aria-label="Copy address" />
                  </div>
                </div>
              )}
            </div>
          )}

          {action === "reject" && (
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Input placeholder="Provide reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={applyAction}>
              {action === "approve" && "Approve"}
              {action === "processing" && "Set Processing"}
              {action === "paid" && "Set Paid"}
              {action === "reject" && "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!detailsFor} onOpenChange={(open) => !open && setDetailsFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdrawal Details</DialogTitle>
            <DialogDescription>Full information for manual verification</DialogDescription>
          </DialogHeader>
          {detailsFor && (
            <div className="space-y-4">
              <div className="grid gap-3">
                <DetailRow label="Request ID" icon={<Hash className="h-4 w-4" />} value={detailsFor.id} copy />
                <DetailRow label="User" icon={<UserRound className="h-4 w-4" />} value={detailsFor.username} />
                <DetailRow label="Email" icon={<Mail className="h-4 w-4" />} value={detailsFor.email} />
                <DetailRow
                  label="Wallet"
                  icon={<Wallet className="h-4 w-4" />}
                  value={`${detailsFor.asset} • ${detailsFor.walletLabel}`}
                />
                <DetailRow label="Address" icon={<Wallet className="h-4 w-4" />} value={detailsFor.address} copy mono />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={detailsFor.status} />
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  Requested ${detailsFor.requestedAmount}
                </Badge>
                <Badge variant="outline" className="text-red-600 border-red-600">
                  Fee {detailsFor.feePct}%
                </Badge>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Net ${detailsFor.netAmount}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">Created: {new Date(detailsFor.createdAt).toLocaleString()}</div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Info Dialog */}
      <Dialog open={!!userFor} onOpenChange={(open) => !open && setUserFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Information</DialogTitle>
            <DialogDescription>Quick view for the selected user</DialogDescription>
          </DialogHeader>
          {userFor && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-semibold">{userFor.username}</div>
                  <div className="text-sm text-muted-foreground">{userFor.email}</div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="text-xs text-muted-foreground">KYC</div>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        userFor.kycStatus === "approved" && "text-green-600 border-green-600",
                        userFor.kycStatus === "pending" && "text-yellow-600 border-yellow-600",
                        userFor.kycStatus === "rejected" && "text-red-600 border-red-600"
                      )}
                    >
                      {userFor.kycStatus}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="text-xs text-muted-foreground">OTP</div>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={userFor.otpVerified ? "text-green-600 border-green-600" : "text-yellow-600 border-yellow-600"}
                    >
                      {userFor.otpVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setUserFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({
  label,
  value,
  icon,
  copy,
  mono,
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
  copy?: boolean
  mono?: boolean
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        {copy ? <CopyButton value={String(value)} /> : null}
      </div>
      <div className={cn("mt-1 text-sm", mono && "font-mono break-all")}>{String(value)}</div>
    </div>
  )
}
