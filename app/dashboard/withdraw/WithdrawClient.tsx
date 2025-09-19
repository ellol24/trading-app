"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DollarSign, Shield, Wallet, Lock, AlertCircle, CheckCircle2, Plus } from "lucide-react"

type Props = {
  user: any
  profile: any
}

type WithdrawalWallet = {
  id: string
  user_id: string
  asset: "BTC" | "ETH" | "USDT" | "USDC"
  address: string
  label?: string
  otp_verified: boolean
  created_at: string
}

type WithdrawalRequest = {
  id: string
  user_id: string
  wallet_id: string
  amount: number
  fee: number
  net_amount: number
  status: "pending" | "approved" | "processing" | "paid" | "rejected"
  created_at: string
  wallet?: WithdrawalWallet
}

export default function WithdrawClient({ user }: Props) {
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addWalletOpen, setAddWalletOpen] = useState(false)
  const [feePercentage, setFeePercentage] = useState<number>(10) // ✅ القيمة من قاعدة البيانات
  const [newWallet, setNewWallet] = useState<{ asset: WithdrawalWallet["asset"] | ""; address: string; label: string }>({
    asset: "",
    address: "",
    label: "",
  })

  // ✅ تحميل المحافظ
  useEffect(() => {
    const fetchWallets = async () => {
      const { data, error } = await supabase.from("withdrawal_wallets").select("*").eq("user_id", user.id)
      if (!error && data) setWallets(data)
    }
    fetchWallets()
  }, [user.id])

  // ✅ تحميل عمليات السحب
  useEffect(() => {
    const fetchWithdrawals = async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*, wallet:withdrawal_wallets(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (!error && data) setWithdrawals(data)
    }
    fetchWithdrawals()
  }, [user.id])

  // ✅ تحميل إعدادات العمولة
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      if (!error && data) setFeePercentage(Number(data.fee_percentage))
    }

    fetchSettings()
  }, [])

  const selectedWallet = useMemo(() => wallets.find((w) => w.id === selectedWalletId), [wallets, selectedWalletId])
  const fee = amount ? Math.max(0, Number.parseFloat(amount) * (feePercentage / 100)) : 0
  const net = amount ? Math.max(0, Number.parseFloat(amount) - fee) : 0

  // ✅ إرسال طلب سحب (بدون OTP)
  const submitWithdrawal = async () => {
    if (!selectedWallet || !amount || Number.parseFloat(amount) < 10) return
    setIsSubmitting(true)

    const { error } = await supabase.from("withdrawals").insert([
      {
        user_id: user.id,
        wallet_id: selectedWalletId,
        amount: Number(amount),
        fee: fee,
        net_amount: net,
        status: "pending",
      },
    ])

    setIsSubmitting(false)
    if (error) {
      alert("Error submitting withdrawal: " + error.message)
    } else {
      setAmount("")
      alert("Withdrawal request submitted successfully.")

      // ✅ إعادة تحميل الهيستوري
      const { data } = await supabase
        .from("withdrawals")
        .select("*, wallet:withdrawal_wallets(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (data) setWithdrawals(data)
    }
  }

  // ✅ إضافة محفظة جديدة
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) return

    const { error } = await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        address: newWallet.address,
        label: newWallet.label || null,
        otp_verified: true, // مؤقتاً
      },
    ])

    if (error) {
      alert("Error adding wallet: " + error.message)
    } else {
      const { data } = await supabase.from("withdrawal_wallets").select("*").eq("user_id", user.id)
      if (data) setWallets(data)
      setNewWallet({ asset: "", address: "", label: "" })
      setAddWalletOpen(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Withdraw Funds</h1>
            <p className="text-blue-200 mt-1">Send funds to your verified crypto wallet</p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" />
            SSL Secured
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-background/20 border border-border/30">
                <TabsTrigger value="withdraw" className="data-[state=active]:bg-primary">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets" className="data-[state=active]:bg-primary">Withdrawal Wallets</TabsTrigger>
              </TabsList>

              {/* ✅ صفحة السحب */}
              <TabsContent value="withdraw">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" /> Request Withdrawal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">Important</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        A {feePercentage}% withdrawal fee is deducted from the amount sent, not from your platform balance.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Select Wallet</Label>
                        <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                          <SelectTrigger className="h-12 bg-background/50 border-border/50">
                            <SelectValue placeholder="Choose wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || `${w.asset} Wallet`} — {w.address.slice(0, 8)}...{w.address.slice(-4)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!wallets.length && <p className="text-sm text-red-400">Add a withdrawal wallet first.</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Amount (USD)</Label>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-background/50 border-border/50"
                          min={10}
                        />
                        <p className="text-xs text-muted-foreground">Minimum withdrawal: $10</p>
                      </div>
                    </div>

                    <div className="p-4 bg-background/20 rounded-lg border border-border/30 space-y-2">
                      <h3 className="text-white font-semibold">Summary</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Requested Amount</span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fee ({feePercentage}%)</span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border/30 pt-2">
                        <span className="text-muted-foreground">You Will Receive</span>
                        <span className="text-green-400 font-bold">${net.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-semibold professional-gradient"
                      onClick={submitWithdrawal}
                      disabled={!selectedWallet || !amount || Number.parseFloat(amount) < 10 || isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Withdrawal Request"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ✅ صفحة المحافظ */}
              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" /> Manage Withdrawal Wallets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-end">
                      <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" /> Add New Wallet
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Withdrawal Wallet</DialogTitle>
                            <DialogDescription>Temporarily added without email verification ✅</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 py-3">
                            <div className="space-y-2">
                              <Label>Asset</Label>
                              <Select value={newWallet.asset} onValueChange={(v) => setNewWallet((prev) => ({ ...prev, asset: v as any }))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select asset" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="BTC">BTC</SelectItem>
                                  <SelectItem value="ETH">ETH</SelectItem>
                                  <SelectItem value="USDT">USDT</SelectItem>
                                  <SelectItem value="USDC">USDC</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Label (optional)</Label>
                              <Input
                                placeholder="e.g. Primary USDT (TRC20)"
                                value={newWallet.label}
                                onChange={(e) => setNewWallet((prev) => ({ ...prev, label: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Address</Label>
                              <Input
                                placeholder="Paste withdrawal address"
                                value={newWallet.address}
                                onChange={(e) => setNewWallet((prev) => ({ ...prev, address: e.target.value }))}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={addWallet} disabled={!newWallet.asset || !newWallet.address}>
                              Save Wallet
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="space-y-3">
                      {wallets.map((w) => (
                        <div key={w.id} className="p-4 rounded-lg bg-background/10 border border-border/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-semibold">{w.label || `${w.asset} Wallet`}</p>
                              <p className="text-muted-foreground text-sm break-all">{w.address}</p>
                            </div>
                            <Badge variant="outline" className={w.otp_verified ? "text-green-400 border-green-400" : "text-yellow-400 border-yellow-400"}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {w.otp_verified ? "Verified" : "Pending Verification"}
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

          {/* ✅ الشريط الجانبي */}
          <div className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg">Recent Withdrawals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {withdrawals.map((r: WithdrawalRequest) => (
                  <div key={r.id} className="p-3 bg-background/20 rounded-lg border border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">${r.amount}</span>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "paid" || r.status === "approved"
                            ? "text-green-400 border-green-400 bg-green-400/10"
                            : r.status === "rejected"
                            ? "text-red-400 border-red-400 bg-red-400/10"
                            : "text-yellow-400 border-yellow-400 bg-yellow-400/10"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">{r.wallet?.asset} • {r.created_at}</p>
                    <p className="text-muted-foreground text-xs">Net: ${r.net_amount}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> Security Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Only withdraw to wallets you control.</p>
                <p>• Enable 2FA for additional protection.</p>
                <p>• We will never DM you asking for your OTP.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
