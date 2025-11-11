"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  CheckCircle2,
  Plus,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";

type Props = {
  user: any;
  profile: any;
};

type WithdrawalWallet = {
  id: string;
  user_id: string;
  asset: string;
  address: string;
  label?: string;
  otp_verified: boolean;
};

type WithdrawalRequest = {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  wallet?: WithdrawalWallet;
};

export default function WithdrawClient({ user }: Props) {
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");

  const [amount, setAmount] = useState("");
  const [feePercentage, setFeePercentage] = useState(10);
  const [withdrawEnabled, setWithdrawEnabled] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);

  const [newWallet, setNewWallet] = useState({
    asset: "",
    address: "",
    label: "",
  });

  // ✅ Load withdraw control
  useEffect(() => {
    async function loadControl() {
      const { data } = await supabase
        .from("withdrawal_control")
        .select("is_enabled")
        .eq("id", 1)
        .single();

      setWithdrawEnabled(data?.is_enabled ?? true);
    }
    loadControl();
  }, []);

  // ✅ Load Fee percentage
  useEffect(() => {
    async function loadFee() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (data) setFeePercentage(Number(data.fee_percentage));
    }

    loadFee();
  }, []);

  // ✅ Load wallets manually
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

  // ✅ Load withdrawals (manual merge)
  const loadWithdrawals = async () => {
    const { data: wData, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return;

    if (!wData.length) {
      setWithdrawals([]);
      return;
    }

    const walletIds = Array.from(new Set(wData.map((r) => r.wallet_id)));

    const { data: walletRows } = await supabase
      .from("withdrawal_wallets")
      .select("*")
      .in("id", walletIds);

    const merged = wData.map((r) => ({
      ...r,
      wallet: walletRows?.find((w) => w.id === r.wallet_id) || null,
    }));

    setWithdrawals(merged);
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user.id]);

  // ✅ one-withdrawal-per-day check
  const checkDailyLimit = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("withdrawals")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString())
      .limit(1);

    return data && data.length > 0;
  };

  // ✅ Compute fee & net
  const fee = amount ? Number(amount) * (feePercentage / 100) : 0;
  const net = amount ? Number(amount) - fee : 0;

  // ✅ Submit withdrawal
  const submitWithdrawal = async () => {
    if (!withdrawEnabled) {
      toast.error("Withdrawals disabled.");
      return;
    }

    if (!(selectedWalletId && amount && Number(amount) >= 21)) {
      toast.error("Min withdrawal is $21.");
      return;
    }

    const usedToday = await checkDailyLimit();
    if (usedToday) {
      toast.error("You can withdraw once per day.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("withdrawals").insert([
      {
        user_id: user.id,
        wallet_id: selectedWalletId,
        amount: Number(amount),
        fee,
        net_amount: net,
        status: "pending",
      },
    ]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Withdrawal submitted.");
      setAmount("");
      loadWithdrawals();
    }

    setIsSubmitting(false);
  };

  // ✅ Add wallet
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) return;

    await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        address: newWallet.address,
        label: newWallet.label || null,
        otp_verified: true,
      },
    ]);

    const { data } = await supabase
      .from("withdrawal_wallets")
      .select("*")
      .eq("user_id", user.id);

    if (data) setWallets(data);

    setNewWallet({ asset: "", address: "", label: "" });
    setAddWalletOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Withdraw Funds</h1>
            <p className="text-blue-200 mt-1">Send funds to your wallet</p>
          </div>
          <Badge className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" /> Secure
          </Badge>
        </div>

        {!withdrawEnabled && (
          <Alert className="bg-red-500/20 border-red-500/40">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle className="text-red-300">
              Withdrawals Disabled
            </AlertTitle>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw">
              <TabsList className="grid w-full grid-cols-2 bg-background/20">
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="wallets">Wallets</TabsTrigger>
              </TabsList>

              {/* Withdraw Page */}
              <TabsContent value="withdraw">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="mr-2" /> Request Withdrawal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription className="text-yellow-200">
                        Fee {feePercentage}% is deducted from amount.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <div>
                        <Label className="text-white">Wallet</Label>
                        <Select
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select wallet" />
                          </SelectTrigger>

                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem value={w.id} key={w.id}>
                                {w.label || w.asset} — {w.address.slice(0, 8)}...
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-white">Amount</Label>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-slate-800 text-white"
                          placeholder="Min 21"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800 border border-slate-700 rounded">
                      <div className="flex justify-between text-sm">
                        <span>Amount</span>
                        <span>${amount || "0"}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Fee</span>
                        <span>${fee.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm mt-2 border-t pt-2">
                        <span>You receive</span>
                        <span className="text-green-400">${net.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 bg-green-600"
                      disabled={isSubmitting}
                      onClick={submitWithdrawal}
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "Submit Withdrawal"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Wallets Page */}
              <TabsContent value="wallets">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="mr-2" /> Manage Wallets
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">

                    <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 w-4 h-4" /> Add Wallet
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Wallet</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-3">
                          <Label>Asset</Label>
                          <Select
                            value={newWallet.asset}
                            onValueChange={(v) =>
                              setNewWallet({ ...newWallet, asset: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose asset" />
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

                          <Label>Label</Label>
                          <Input
                            value={newWallet.label}
                            onChange={(e) =>
                              setNewWallet({
                                ...newWallet,
                                label: e.target.value,
                              })
                            }
                          />

                          <Label>Address</Label>
                          <Input
                            value={newWallet.address}
                            onChange={(e) =>
                              setNewWallet({
                                ...newWallet,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>

                        <DialogFooter>
                          <Button onClick={addWallet}>Save</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {wallets.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 border border-slate-700 rounded bg-slate-800"
                      >
                        <div className="text-white font-semibold">
                          {w.label || w.asset}
                        </div>
                        <div className="text-xs text-gray-300 break-all">
                          {w.address}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Recent Withdrawals */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-white">Recent Withdrawals</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {withdrawals.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-800 rounded">
                    <div className="flex justify-between">
                      <span className="text-white">${r.amount}</span>
                      <Badge>{r.status}</Badge>
                    </div>

                    <div className="text-xs text-gray-300">
                      {r.wallet?.asset} •{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-300">
                      Net: ${r.net_amount}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Lock className="w-4 h-4 mr-2" /> Security Tips
                </CardTitle>
              </CardHeader>

              <CardContent className="text-sm text-gray-300">
                <p>• Withdraw only to your own wallets.</p>
                <p>• Never share your private key.</p>
                <p>• Admins never DM you for codes.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
