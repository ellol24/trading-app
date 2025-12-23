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
  DialogDescription,
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
  asset: "USDT (TRC20)" | "USDT (BEP20)" | string;
  address: string;
  label?: string;
  otp_verified: boolean;
  created_at: string;
};

type WithdrawalRequest = {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: "pending" | "approved" | "processing" | "paid" | "rejected";
  created_at: string;
  wallet?: WithdrawalWallet;
};

import { useLanguage } from "@/contexts/language-context";

export default function WithdrawClient({ user, profile }: Props) {
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState<number>(21);
  const { t } = useLanguage();

  const [newWallet, setNewWallet] = useState<{
    asset: WithdrawalWallet["asset"] | "";
    address: string;
    label: string;
  }>({
    asset: "",
    address: "",
    label: "",
  });

  // load withdrawal_control.is_enabled
  useEffect(() => {
    const loadControl = async () => {
      try {
        const { data, error } = await supabase
          .from("withdrawal_control")
          .select("is_enabled")
          .limit(1)
          .single();
        if (!error && data) setWithdrawEnabled(Boolean(data.is_enabled));
      } catch (err) {
        // keep default true on error
        console.error("loadControl error", err);
      }
    };
    loadControl();
  }, []);

  // load settings: fee_percentage and min_withdraw_amount from withdrawal_settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("withdrawal_settings")
          .select("fee_percentage, min_withdraw_amount")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          if (data.fee_percentage !== undefined && data.fee_percentage !== null)
            setFeePercentage(Number(data.fee_percentage));
          if (
            data.min_withdraw_amount !== undefined &&
            data.min_withdraw_amount !== null
          )
            setMinWithdrawAmount(Number(data.min_withdraw_amount));
        }
      } catch (err) {
        console.error("loadSettings error", err);
      }
    };
    loadSettings();
  }, []);

  // load wallets (manual)
  useEffect(() => {
    const fetchWallets = async () => {
      const { data, error } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error(`❌ ${t('wallet.walletsLoadError')}`);
      } else if (data) setWallets(data);
    };
    fetchWallets();
  }, [user.id]);

  // load withdrawals (manual)
  const loadWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(`❌ ${t('wallet.historyLoadError')}`);
    } else if (data) setWithdrawals(data);
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user.id]);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId),
    [wallets, selectedWalletId]
  );

  const fee = amount ? Math.max(0, Number(amount) * (feePercentage / 100)) : 0;
  const net = amount ? Math.max(0, Number(amount) - fee) : 0;

  // helper: start of today in ISO for server compare
  const startOfTodayISO = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  // submit withdrawal: immediate deduction, single-per-day enforcement
  const submitWithdrawal = async () => {
    const amt = Number(amount);
    if (!withdrawEnabled) {
      toast.error(`🚫 ${t('wallet.withdrawalsDisabled')}`);
      return;
    }

    if (!selectedWallet || !amount || Number.isNaN(amt) || amt < minWithdrawAmount) {
      toast.warning(
        `⚠️ ${t('wallet.selectWalletWarning').replace('${min}', String(minWithdrawAmount))}`
      );
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading(`⏳ ${t('wallet.submittingRequest')}`);

    try {
      // 1) check daily limit: ensure no withdrawal created today by this user
      const { data: todayRows, error: todayErr } = await supabase
        .from("withdrawals")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", startOfTodayISO());

      if (todayErr) {
        throw todayErr;
      }
      if (todayRows && todayRows.length > 0) {
        toast.error(`🚫 ${t('wallet.oneWithdrawalPerDay')}`);
        return;
      }

      // 2) fetch fresh user balance
      const { data: profileRow, error: profileErr } = await supabase
        .from("user_profiles")
        .select("uid, balance")
        .eq("uid", user.id)
        .limit(1)
        .single();

      if (profileErr || !profileRow) {
        throw profileErr || new Error("Profile not found");
      }

      const currentBalance = Number(profileRow.balance || 0);
      if (currentBalance < amt) {
        toast.error(`⚠️ ${t('wallet.insufficientBalance')}`);
        return;
      }

      // 3) deduct balance first
      const newBalance = currentBalance - amt;
      const { error: updErr } = await supabase
        .from("user_profiles")
        .update({ balance: newBalance })
        .eq("uid", user.id);

      if (updErr) {
        throw updErr;
      }

      // 4) insert withdrawal row
      const { error: insertErr } = await supabase.from("withdrawals").insert([
        {
          user_id: user.id,
          wallet_id: selectedWalletId,
          amount: amt,
          fee: fee,
          net_amount: net,
          status: "pending",
        },
      ]);

      if (insertErr) {
        // rollback balance update
        await supabase
          .from("user_profiles")
          .update({ balance: currentBalance })
          .eq("uid", user.id);
        throw insertErr;
      }

      // success
      setAmount("");
      toast.success(`✅ ${t('wallet.withdrawalSubmitted')}`);
      await loadWithdrawals();
    } catch (err: any) {
      console.error("submitWithdrawal error", err);
      toast.error(`❌ ${t('wallet.withdrawalFailed')} ` + (err?.message || ""));
    } finally {
      toast.dismiss(loadingToast);
      setIsSubmitting(false);
    }
  };

  // add wallet (keeps original UI choices)
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) {
      toast.warning(`⚠️ ${t('wallet.fillWalletDetails')}`);
      return;
    }
    const loadingToast = toast.loading(`🔗 ${t('wallet.addingWallet')}`);
    const { error } = await supabase.from("withdrawal_wallets").insert([
      {
        user_id: user.id,
        asset: newWallet.asset,
        address: newWallet.address,
        label: newWallet.label || null,
        otp_verified: true,
      },
    ]);
    toast.dismiss(loadingToast);
    if (error) {
      toast.error(`❌ ${t('wallet.walletAddError')}` + error.message);
    } else {
      const { data } = await supabase
        .from("withdrawal_wallets")
        .select("*")
        .eq("user_id", user.id);
      if (data) setWallets(data);
      toast.success(`✅ ${t('wallet.walletAdded')}`);
      setNewWallet({ asset: "", address: "", label: "" });
      setAddWalletOpen(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24"
      translate="no"
      data-react-protected
    >
      <div className="max-w-6xl mx-auto space-y-6" translate="no">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('wallet.withdrawTitle')}</h1>
            <p className="text-blue-200 mt-1">{t('wallet.withdrawSubtitle')}</p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" />
            {t('wallet.sslSecured')}
          </Badge>
        </div>

        {!withdrawEnabled && (
          <Alert className="bg-red-600/20 border-red-600/40 text-red-300">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>{t('wallet.withdrawalsDisabledTitle')}</AlertTitle>
            <AlertDescription>{t('wallet.withdrawalsDisabledDesc')}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" translate="no">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-background/20 border border-border/30">
                <TabsTrigger value="withdraw" className="data-[state=active]:bg-primary">{t('common.withdraw')}</TabsTrigger>
                <TabsTrigger value="wallets" className="data-[state=active]:bg-primary">{t('wallet.withdrawalWallets')}</TabsTrigger>
              </TabsList>

              <TabsContent value="withdraw">
                <Card className="trading-card" translate="no">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" /> {t('wallet.requestWithdrawal')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">{t('common.important')}</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        {t('wallet.feeWarning').replace('{fee}', String(feePercentage)).replace('${min}', String(minWithdrawAmount))}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">{t('wallet.selectWallet')}</Label>
                        <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                          <SelectTrigger className="h-12 bg-background/50 border-border/50">
                            <SelectValue placeholder={t('wallet.chooseWallet')} />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || t('wallet.walletLabelDefault').replace('{asset}', w.asset)} — {w.address.slice(0, 8)}...{w.address.slice(-4)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!wallets.length && <p className="text-sm text-red-400">{t('wallet.addWalletFirst')}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white">{t('wallet.amountUSD')}</Label>
                        <Input
                          type="number"
                          placeholder={t('wallet.enterAmount')}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-12 bg-background/50 border-border/50 text-white"
                          min={minWithdrawAmount}
                        />
                        <p className="text-xs text-muted-foreground">{t('wallet.minWithdraw').replace('${min}', String(minWithdrawAmount))}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-background/20 rounded-lg border border-border/30 space-y-2">
                      <h3 className="text-white font-semibold">{t('common.summary')}</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('wallet.requestedAmount')}</span>
                        <span className="text-white">${amount || "0.00"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('wallet.fee').replace('{fee}', String(feePercentage))}</span>
                        <span className="text-red-400">-${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border/30 pt-2">
                        <span className="text-muted-foreground">{t('wallet.youWillReceive')}</span>
                        <span className="text-green-400 font-bold">${net.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-semibold professional-gradient flex items-center justify-center"
                      onClick={submitWithdrawal}
                      disabled={
                        !withdrawEnabled ||
                        !selectedWallet ||
                        !amount ||
                        Number.parseFloat(amount) < minWithdrawAmount ||
                        isSubmitting
                      }
                    >
                      {!withdrawEnabled ? (
                        t('wallet.withdrawalsDisabledTitle')
                      ) : isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {t('common.submitting')}
                        </>
                      ) : (
                        t('wallet.submitRequest')
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" /> {t('wallet.manageWallets')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-end">
                      <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="w-4 h-4 mr-2" /> {t('wallet.addNewWallet')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('wallet.addWalletTitle')}</DialogTitle>
                            <DialogDescription>{t('wallet.addWalletDesc')}</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 py-3">
                            <div className="space-y-2">
                              <Label>{t('common.asset')}</Label>
                              <Select
                                value={newWallet.asset}
                                onValueChange={(v) =>
                                  setNewWallet((prev) => ({ ...prev, asset: v as any }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('wallet.selectAsset')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USDT (TRC20)">USDT (TRC20)</SelectItem>
                                  <SelectItem value="USDT (BEP20)">USDT (BEP20)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>{t('wallet.walletLabel')}</Label>
                              <Input
                                placeholder={t('wallet.walletLabelPlaceholder')}
                                value={newWallet.label}
                                onChange={(e) => setNewWallet((prev) => ({ ...prev, label: e.target.value }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>{t('common.address')}</Label>
                              <Input
                                placeholder={t('wallet.addressPlaceholder')}
                                value={newWallet.address}
                                onChange={(e) => setNewWallet((prev) => ({ ...prev, address: e.target.value }))}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={addWallet} disabled={!newWallet.asset || !newWallet.address}>
                              {t('wallet.saveWallet')}
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
                              <p className="text-white font-semibold">{w.label || t('wallet.walletLabelDefault').replace('{asset}', w.asset)}</p>
                              <p className="text-muted-foreground text-sm break-all">{w.address}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={w.otp_verified ? "text-green-400 border-green-400" : "text-yellow-400 border-yellow-400"}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {w.otp_verified ? t('common.verified') : t('common.pendingVerification')}
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

          <div className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg">{t('wallet.recentWithdrawals')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {withdrawals.map((r) => (
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
                        {r.status === "paid" || r.status === "approved" ? t('wallet.statusApproved') :
                          r.status === "rejected" ? t('wallet.statusRejected') :
                            t('common.pending')}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {r.wallet?.asset} • {new Date(r.created_at).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground text-xs">Net: ${r.net_amount}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> {t('wallet.securityTips')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• {t('wallet.securityTip1')}</p>
                <p>• {t('wallet.securityTip2')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
