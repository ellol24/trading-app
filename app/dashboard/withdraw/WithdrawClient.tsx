"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  DollarSign,
  Shield,
  Wallet,
  Lock,
  AlertCircle,
  Plus,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";

// -----------------------------------------------------------
// TYPES
// -----------------------------------------------------------

type Props = {
  user: any;
};

type WithdrawalWallet = {
  id: string;
  user_id: string;
  asset: string;
  address: string;
  label?: string;
  otp_verified: boolean;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  user_id: string;
  wallet_id: string | null;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
};

// بعد الدمج اليدوي
type WithdrawalMerged = WithdrawalRow & {
  wallet?: WithdrawalWallet | null;
};

// -----------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------

export default function WithdrawClient({ user }: Props) {
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalMerged[]>([]);

  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);
  const [feePercentage, setFeePercentage] = useState<number>(10);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);

  const [newWallet, setNewWallet] = useState({
    asset: "",
    address: "",
    label: "",
  });

  // -----------------------------------------------------------
  // ✅ تحميل حالة السحب من جدول withdrawal_control
  // -----------------------------------------------------------

  useEffect(() => {
    async function loadControl() {
      const { data, error } = await supabase
        .from("withdrawal_control")
        .select("is_enabled")
        .limit(1)
        .single();

      if (!error && data) {
        setWithdrawEnabled(Boolean(data.is_enabled));
      }
    }
    loadControl();
  }, []);

  // -----------------------------------------------------------
  // ✅ تحميل نسبة العمولة من withdrawal_settings
  // -----------------------------------------------------------

  useEffect(() => {
    async function loadFee() {
      const { data, error } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setFeePercentage(Number(data.fee_percentage));
      }
    }
    loadFee();
  }, []);

  // -----------------------------------------------------------
  // ✅ تحميل محافظ المستخدم
  // -----------------------------------------------------------

  useEffect(() => {
    async function loadWallets() {
      const { data, error } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) setWallets(data);
    }
    loadWallets();
  }, [user.id]);

  // -----------------------------------------------------------
  // ✅ تحميل عمليات السحب + دمج يدوي للمحافظ عبر user_id
  // -----------------------------------------------------------

  const loadWithdrawals = async () => {
    const { data: wdRows, error } = await supabase
      .from<WithdrawalRow>("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error loading withdrawals");
      return;
    }

    const merged: WithdrawalMerged[] = (wdRows || []).map((w) => {
      const wallet = wallets.find((wt) => wt.id === w.wallet_id) || null;
      return { ...w, wallet };
    });

    setWithdrawals(merged);
  };

  useEffect(() => {
    loadWithdrawals();
  }, [wallets]);

  // -----------------------------------------------------------
  // ✅ حساب fee و net amount
  // -----------------------------------------------------------

  const fee = amount ? Number(amount) * (feePercentage / 100) : 0;
  const net = amount ? Number(amount) - fee : 0;

  // -----------------------------------------------------------
  // ✅ إرسال طلب سحب عبر RPC
  // -----------------------------------------------------------

  const submitWithdrawal = async () => {
    if (!withdrawEnabled) {
      toast.error("Withdrawals are disabled.");
      return;
    }

    if (!selectedWalletId || !amount || Number(amount) < 10) {
      toast.warning("Invalid amount or wallet.");
      return;
    }

    setIsSubmitting(true);
    const load = toast.loading("Submitting...");

    const { data, error } = await supabase.rpc("withdraw_funds", {
      p_user_id: user.id,
      p_wallet_id: selectedWalletId,
      p_amount: Number(amount),
      p_fee: fee,
      p_net_amount: net,
    });

    if (error || data?.success === false) {
      toast.error(data?.error || error?.message);
    } else {
      toast.success("Withdrawal submitted");
      setAmount("");
      loadWithdrawals();
    }

    toast.dismiss(load);
    setIsSubmitting(false);
  };

  // -----------------------------------------------------------
  // ✅ إضافة محفظة جديدة
  // -----------------------------------------------------------

  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) {
      toast.warning("Fill all fields");
      return;
    }

    const { error } = await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        address: newWallet.address,
        label: newWallet.label,
        otp_verified: true,
      },
    ]);

    if (error) toast.error(error.message);
    else {
      toast.success("Wallet added");
      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);

      setWallets(data || []);
      setAddWalletOpen(false);
      setNewWallet({ asset: "", address: "", label: "" });
    }
  };

  // -----------------------------------------------------------
  // ✅ UI
  // -----------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* TITLE */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Withdraw Funds</h1>
            <p className="text-blue-200 mt-1">Send funds to your crypto wallet</p>
          </div>

          <Badge
            variant="outline"
            className="text-green-400 border-green-400 bg-green-400/10"
          >
            <Shield className="w-4 h-4 mr-2" />
            Secure
          </Badge>
        </div>

        {/* DISABLED WARNING */}
        {!withdrawEnabled && (
          <Alert className="bg-red-600/20 border-red-600/40 text-red-300">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Withdrawals Disabled</AlertTitle>
            <AlertDescription>
              Withdrawals are temporarily disabled by the administration.
            </AlertDescription>
          </Alert>
        )}

        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT SIDE */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw" className="space-y-6">
              <TabsList className="grid grid-cols-2 bg-background/20 border border-border/30">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Withdrawal Wallets</TabsTrigger>
              </TabsList>

              {/* WITHDRAW TAB */}
              <TabsContent value="withdraw">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" />
                      Request Withdrawal
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-6">

                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">Important</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        A {feePercentage}% withdrawal fee is deducted from the amount sent.
                      </AlertDescription>
                    </Alert>

                    {/* FORM */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Wallet */}
                      <div>
                        <Label className="text-white">Select Wallet</Label>
                        <Select
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-background/50">
                            <SelectValue placeholder="Choose wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || w.asset} — {w.address.slice(0, 6)}...{w.address.slice(-4)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Amount */}
                      <div>
                        <Label className="text-white">Amount (USD)</Label>
                        <Input
                          value={amount}
                          type="number"
                          min={21}
                          placeholder="Enter amount"
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-background/50 text-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Minimum withdrawal: $21
                        </p>
                      </div>
                    </div>

                    {/* SUMMARY */}
                    <div className="p-4 bg-background/20 rounded-lg border border-border/30">
                      <h3 className="text-white font-semibold">Summary</h3>

                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-300">Requested Amount</span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Fee ({feePercentage}%)</span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm mt-2 border-t border-border/30 pt-2">
                        <span className="text-gray-300">You Receive</span>
                        <span className="text-green-400 font-semibold">${net.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={submitWithdrawal}
                      disabled={
                        !withdrawEnabled ||
                        !selectedWallet ||
                        !amount ||
                        Number(amount) < 21 ||
                        isSubmitting
                      }
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        "Submit Withdrawal Request"
                      )}
                    </Button>

                  </CardContent>
                </Card>
              </TabsContent>

              {/* WALLETS TAB */}
              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" />
                      Manage Withdrawal Wallets
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">

                    <div className="flex justify-end">
                      <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" /> Add Wallet
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Withdrawal Wallet</DialogTitle>
                          </DialogHeader>

                          <div className="grid gap-4 py-4">
                            <div>
                              <Label>Asset</Label>
                              <Select
                                value={newWallet.asset}
                                onValueChange={(v) =>
                                  setNewWallet({ ...newWallet, asset: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select network" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USDT (TRC20)">
                                    USDT (TRC20)
                                  </SelectItem>
                                  <SelectItem value="USDT (BEP20)">
                                    USDT (BEP20)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Label (optional)</Label>
                              <Input
                                value={newWallet.label}
                                onChange={(e) =>
                                  setNewWallet({ ...newWallet, label: e.target.value })
                                }
                              />
                            </div>

                            <div>
                              <Label>Address</Label>
                              <Input
                                value={newWallet.address}
                                onChange={(e) =>
                                  setNewWallet({ ...newWallet, address: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button onClick={addWallet}>Save Wallet</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Wallet List */}
                    {wallets.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 rounded-lg bg-background/10 border border-border/30"
                      >
                        <p className="text-white font-semibold">{w.label || w.asset}</p>
                        <p className="text-gray-300 text-sm break-all">{w.address}</p>

                        <Badge
                          variant="outline"
                          className={
                            w.otp_verified
                              ? "text-green-400 border-green-400"
                              : "text-yellow-400 border-yellow-400"
                          }
                        >
                          {w.otp_verified ? "Verified" : "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-6">

            {/* RECENT WITHDRAWALS */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  Recent Withdrawals
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {withdrawals.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-background/20 rounded-lg border border-border/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">${r.amount}</span>

                      <Badge
                        variant="outline"
                        className={
                          r.status === "paid" || r.status === "approved"
                            ? "text-green-400 border-green-400"
                            : r.status === "rejected"
                            ? "text-red-400 border-red-400"
                            : "text-yellow-400 border-yellow-400"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>

                    <p className="text-gray-300 text-xs">
                      {r.wallet?.asset} • {new Date(r.created_at).toLocaleString()}
                    </p>

                    <p className="text-gray-400 text-xs">Net: ${r.net_amount}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* SECURITY TIPS */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Lock className="w-5 h-5 mr-2" />
                  Security Tips
                </CardTitle>
              </CardHeader>

              <CardContent className="text-gray-300 text-sm space-y-2">
                <p>• Only withdraw to wallets you control.</p>
                <p>• Keep your private keys secure.</p>
                <p>• We never DM you for OTP codes.</p>
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </div>
  );
}
