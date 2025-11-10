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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Withdraw</h1>
            <p className="text-gray-400">Send funds to your crypto wallet</p>
          </div>

          <Badge className="bg-green-600/20 text-green-400 border-green-400">
            <Shield className="w-4 h-4 mr-2" /> Secure
          </Badge>
        </div>

        {/* Blocked */}
        {!withdrawEnabled && (
          <Alert className="bg-red-500/20 border-red-500/40">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-red-400">Withdrawals Disabled</AlertTitle>
            <AlertDescription className="text-red-200">
              Withdrawals are temporarily disabled by the administration.
            </AlertDescription>
          </Alert>
        )}

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Tabs */}
          <div className="lg:col-span-2 space-y-6">

            <Tabs defaultValue="withdraw">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800 border border-gray-700">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Wallets</TabsTrigger>
              </TabsList>

              {/* ------------------ Withdraw Tab ------------------ */}
              <TabsContent value="withdraw">
                <Card className="bg-slate-800/50 border-slate-700>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" /> Withdraw funds
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-6">

                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">Fee</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        Withdrawal fee: {feePercentage}%.
                      </AlertDescription>
                    </Alert>

                    {/* Wallet + Amount */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Wallet */}
                      <div>
                        <Label>Wallet</Label>
                        <Select
                          disabled={!withdrawEnabled}
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12 bg-gray-800 text-white">
                            <SelectValue placeholder="Select wallet" />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || w.asset} — {w.address.slice(0, 10)}...
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Amount */}
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          min={10}
                          disabled={!withdrawEnabled}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-gray-800 text-white"
                        />
                      </div>

                    </div>

                    {/* SUMMARY */}
                    <div className="p-4 bg-gray-800 border border-gray-700 rounded">
                      <div className="flex justify-between">
                        <span>Amount</span>
                        <span>${amount || "0"}</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Fee</span>
                        <span className="text-red-400">${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-700">
                        <span>You Receive</span>
                        <span className="text-green-400 font-semibold">
                          ${net.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 bg-green-600"
                      disabled={
                        !withdrawEnabled ||
                        !selectedWalletId ||
                        !amount ||
                        Number(amount) < 10 ||
                        isSubmitting
                      }
                      onClick={submitWithdrawal}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : null}
                      Submit Withdrawal
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ------------------ Wallets Tab ------------------ */}
              <TabsContent value="wallets">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader className="flex justify-between items-center">
                    <CardTitle>Wallets</CardTitle>

                    <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600">
                          <Plus className="w-4 h-4 mr-2" /> Add Wallet
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Wallet</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">

                          <div>
                            <Label>Network</Label>
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
                            <Label>Label</Label>
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
                          <Button onClick={addWallet}>Save</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {wallets.map((w) => (
                      <div key={w.id} className="p-4 bg-gray-800 border border-gray-700 rounded">
                        <div className="font-semibold">{w.label || w.asset}</div>
                        <div className="text-sm text-gray-300 break-all">{w.address}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column: recent withdrawals */}
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle>Recent Withdrawals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {withdrawals.map((w) => (
                  <div key={w.id} className="p-3 bg-gray-800 border border-gray-700 rounded">
                    <div className="flex justify-between">
                      <span>${w.amount}</span>
                      <Badge
                        className={
                          w.status === "approved" || w.status === "paid"
                            ? "bg-green-600"
                            : w.status === "rejected"
                            ? "bg-red-600"
                            : "bg-yellow-600"
                        }
                      >
                        {w.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-gray-400 mt-1">
                      {w.wallet?.asset} — {w.wallet?.address?.slice(0, 10)}...
                    </div>

                    <div className="text-xs text-gray-400">Net: ${w.net_amount}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(w.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="w-5 h-5 mr-2" />
                  Security Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>• Only withdraw to your own wallets.</p>
                <p>• Never share private keys.</p>
                <p>• Use 2FA for stronger security.</p>
              </CardContent>
            </Card>
          </div>
          </div>
                </div>
              </div>
  );
}
