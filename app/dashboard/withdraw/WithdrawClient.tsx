"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DollarSign, Shield, Wallet, Lock, AlertCircle,
  CheckCircle2, Plus, Loader2, Trash2, Clock, UserCheck, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/language-context";

type Props = { user: any; profile: any };

type WithdrawalWallet = {
  id: string; user_id: string;
  asset: "USDT (TRC20)" | "USDT (BEP20)" | string;
  address: string; label?: string;
  otp_verified: boolean; created_at: string;
};

type WithdrawalRequest = {
  id: string; user_id: string; wallet_id: string;
  amount: number; fee: number; net_amount: number;
  status: "pending" | "approved" | "processing" | "paid" | "rejected";
  created_at: string;
  withdrawal_wallets?: WithdrawalWallet | null;
};

// ─── Profile completeness check ─────────────────────────────────────────────
function isProfileComplete(profile: any): boolean {
  if (!profile) return false;
  return !!(profile.first_name?.trim() && profile.last_name?.trim() &&
    profile.phone?.trim() && profile.country?.trim());
}

// ─── 24-hour wallet freeze check ─────────────────────────────────────────────
function getWalletFreezeInfo(wallet: WithdrawalWallet | undefined): { frozen: boolean; remainingMs: number; remainingLabel: string } {
  if (!wallet) return { frozen: false, remainingMs: 0, remainingLabel: "" };
  const createdAt = new Date(wallet.created_at).getTime();
  const now = Date.now();
  const elapsed = now - createdAt;
  const freezeMs = 24 * 60 * 60 * 1000; // 24 hours
  if (elapsed >= freezeMs) return { frozen: false, remainingMs: 0, remainingLabel: "" };
  const remainingMs = freezeMs - elapsed;
  const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
  const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  return { frozen: true, remainingMs, remainingLabel: `${hrs}h ${mins}m` };
}

export default function WithdrawClient({ user, profile }: Props) {
  const { t } = useLanguage();
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<WithdrawalWallet | null>(null);
  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState<number>(21);
  const [liveBalance, setLiveBalance] = useState<number>(profile?.balance ?? 0);
  const [nextWithdrawTime, setNextWithdrawTime] = useState<string | null>(null);
  const [, forceRender] = useState<number>(0); // for freeze countdown

  const [newWallet, setNewWallet] = useState<{
    asset: WithdrawalWallet["asset"] | ""; address: string; label: string;
  }>({ asset: "", address: "", label: "" });

  // Tick every minute so freeze countdown refreshes
  useEffect(() => {
    const timer = setInterval(() => forceRender(n => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Initial data load ───────────────────────────────────────────────────
  useEffect(() => {
    // Control & settings
    supabase.from("withdrawal_control").select("is_enabled").limit(1).single()
      .then(({ data, error }) => { if (!error && data) setWithdrawEnabled(Boolean(data.is_enabled)); });

    supabase.from("withdrawal_settings").select("fee_percentage, min_withdraw_amount")
      .order("updated_at", { ascending: false }).limit(1).single()
      .then(({ data, error }) => {
        if (!error && data) {
          if (data.fee_percentage != null) setFeePercentage(Number(data.fee_percentage));
          if (data.min_withdraw_amount != null) setMinWithdrawAmount(Number(data.min_withdraw_amount));
        }
      });
  }, []);

  const fetchWallets = useCallback(async () => {
    const { data, error } = await supabase
      .from("withdrawal_wallets").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (!error && data) setWallets(data);
  }, [user.id]);

  const loadWithdrawals = useCallback(async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*, withdrawal_wallets(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(`❌ ${t("wallet.historyLoadError")}`);
    else setWithdrawals((data as any) ?? []);
  }, [user.id, t]);

  const fetchBalance = useCallback(async () => {
    const { data } = await supabase.from("user_profiles")
      .select("balance").eq("uid", user.id).single();
    if (data) setLiveBalance(Number(data.balance) || 0);
  }, [user.id]);

  useEffect(() => {
    fetchWallets();
    loadWithdrawals();
    fetchBalance();
  }, [fetchWallets, loadWithdrawals, fetchBalance]);

  // ─── Real-time subscriptions ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    // Live balance
    const balCh = supabase.channel(`withdraw-balance-${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `uid=eq.${user.id}` },
        (p) => { if (p.new?.balance !== undefined) setLiveBalance(Number(p.new.balance)); }
      ).subscribe();

    // Withdrawal status changes
    const wdCh = supabase.channel(`withdraw-history-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${user.id}` },
        () => loadWithdrawals()
      ).subscribe();

    return () => {
      supabase.removeChannel(balCh);
      supabase.removeChannel(wdCh);
    };
  }, [user?.id, loadWithdrawals]);

  // ─── Computed values ─────────────────────────────────────────────────────
  const selectedWallet = useMemo(() => wallets.find((w) => w.id === selectedWalletId), [wallets, selectedWalletId]);
  const fee = amount ? Math.max(0, Number(amount) * (feePercentage / 100)) : 0;
  const net = amount ? Math.max(0, Number(amount) - fee) : 0;
  const profileComplete = isProfileComplete(profile);
  const freezeInfo = getWalletFreezeInfo(selectedWallet);
  const canSubmit = withdrawEnabled && profileComplete && !freezeInfo.frozen && !!selectedWallet && !!amount && Number(amount) >= minWithdrawAmount && !isSubmitting;

  const startOfTodayISO = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  };

  const midnightResetTime = () => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " " + d.toLocaleDateString();
  };

  // ─── Submit Withdrawal ───────────────────────────────────────────────────
  const submitWithdrawal = async () => {
    const amt = Number(amount);
    if (!withdrawEnabled) { toast.error(`🚫 ${t("wallet.withdrawalsDisabled")}`); return; }
    if (!selectedWallet || !amount || isNaN(amt) || amt < minWithdrawAmount) {
      toast.warning(`⚠️ ${t("wallet.amountMinLabel").replace('{min}', String(minWithdrawAmount))}`); return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading(`⏳ ${t("wallet.submittingRequest")}`);

    try {
      // Check daily limit
      const { data: todayRows, error: todayErr } = await supabase
        .from("withdrawals").select("id").eq("user_id", user.id).gte("created_at", startOfTodayISO());
      if (todayErr) throw todayErr;
      if (todayRows && todayRows.length > 0) {
        const resetTime = midnightResetTime();
        setNextWithdrawTime(resetTime);
        toast.error(`🚫 One withdrawal per day. You can submit again after ${resetTime}`);
        return;
      }

      // Fetch fresh balance
      const { data: profileRow, error: profileErr } = await supabase
        .from("user_profiles").select("uid, balance").eq("uid", user.id).limit(1).single();
      if (profileErr || !profileRow) throw profileErr || new Error("Profile not found");

      const currentBalance = Number(profileRow.balance || 0);
      if (currentBalance < amt) {
        toast.error(`⚠️ ${t("wallet.insufficientBalance")} (Available: $${currentBalance.toFixed(2)})`);
        return;
      }

      // Deduct balance
      const newBalance = currentBalance - amt;
      const { error: updErr } = await supabase
        .from("user_profiles").update({ balance: newBalance }).eq("uid", user.id);
      if (updErr) throw updErr;

      // Insert withdrawal row
      const { error: insertErr } = await supabase.from("withdrawals").insert([{
        user_id: user.id, wallet_id: selectedWalletId,
        amount: amt, fee, net_amount: net, status: "pending",
      }]);

      if (insertErr) {
        // Rollback
        await supabase.from("user_profiles").update({ balance: currentBalance }).eq("uid", user.id);
        throw insertErr;
      }

      setAmount("");
      toast.success(`✅ ${t("wallet.withdrawalSubmitted")}`);
    } catch (err: any) {
      toast.error(`❌ ${t("wallet.withdrawalFailed")} ${err?.message || ""}`);
    } finally {
      toast.dismiss(loadingToast);
      setIsSubmitting(false);
    }
  };

  // ─── Add Wallet ──────────────────────────────────────────────────────────
  const addWallet = async () => {
    if (!newWallet.asset || !newWallet.address) {
      toast.warning(`⚠️ ${t("wallet.fillWalletDetails")}`); return;
    }
    const loadingToast = toast.loading(`🔗 ${t("wallet.addingWallet")}`);
    const { error } = await supabase.from("withdrawal_wallets").insert([{
      user_id: user.id, asset: newWallet.asset,
      address: newWallet.address, label: newWallet.label || null, otp_verified: true,
    }]);
    toast.dismiss(loadingToast);
    if (error) { toast.error(`❌ ${t("wallet.walletAddError")} ${error.message}`); }
    else {
      await fetchWallets();
      toast.success(`✅ ${t("wallet.walletAdded")}`);
      setNewWallet({ asset: "", address: "", label: "" });
      setAddWalletOpen(false);
    }
  };

  // ─── Delete Wallet ───────────────────────────────────────────────────────
  const deleteWallet = async (wallet: WithdrawalWallet) => {
    const loadingToast = toast.loading(`${t("common.loading")}`);
    const { error } = await supabase
      .from("withdrawal_wallets").delete().eq("id", wallet.id);
    toast.dismiss(loadingToast);
    if (error) { toast.error(`❌ ${t("common.error")}: ${error.message}`); }
    else {
      toast.success(`✅ ${t("common.success")}`);
      setDeleteDialog(null);
      if (selectedWalletId === wallet.id) setSelectedWalletId("");
      await fetchWallets();
    }
  };

  // ─── Status badge helper ─────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    if (status === "paid" || status === "approved")
      return <Badge className="bg-green-500/20 text-green-400 border-green-400">✅ Paid</Badge>;
    if (status === "rejected")
      return <Badge className="bg-red-500/20 text-red-400 border-red-400">❌ Rejected</Badge>;
    if (status === "processing")
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-400">🔄 Processing</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-400">⏳ Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24" translate="no" data-react-protected>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{t("wallet.withdrawTitle")}</h1>
            <p className="text-blue-200 mt-1">{t("wallet.withdrawSubtitle")}</p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
            <Shield className="w-4 h-4 mr-2" /> {t("wallet.sslSecured")}
          </Badge>
        </div>

        {/* Admin disabled banner */}
        {!withdrawEnabled && (
          <Alert className="bg-red-600/20 border-red-600/40 text-red-300">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>{t("wallet.withdrawalsDisabledTitle")}</AlertTitle>
            <AlertDescription>{t("wallet.withdrawalsDisabledDesc")}</AlertDescription>
          </Alert>
        )}

        {/* Profile incomplete banner */}
        {!profileComplete && (
          <Alert className="bg-orange-600/20 border-orange-500/50 text-orange-200">
            <UserCheck className="h-5 w-5 text-orange-400" />
            <AlertTitle className="text-orange-300 font-semibold">{t("common.profileIncompleteTitle")}</AlertTitle>
            <AlertDescription className="text-orange-200 mt-1">
              {t("common.profileIncompleteDesc")}
              <Link href="/dashboard/profile" className="inline-flex items-center gap-1 ml-2 text-orange-300 underline underline-offset-2 hover:text-orange-100 font-medium">
                {t("common.goToProfile")} <ExternalLink className="w-3 h-3" />
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Wallet 24-hour security freeze banner */}
        {freezeInfo.frozen && (
          <Alert className="bg-blue-700/20 border-blue-500/40 text-blue-200">
            <Shield className="h-5 w-5 text-blue-400" />
            <AlertTitle className="text-blue-300 font-semibold">{t("wallet.securityFreezeTitle").replace('{time}', freezeInfo.remainingLabel)}</AlertTitle>
            <AlertDescription className="text-blue-200">
              {t("wallet.securityFreezeDesc")}
            </AlertDescription>
          </Alert>
        )}

        {/* Daily limit banner */}
        {nextWithdrawTime && (
          <Alert className="bg-slate-600/20 border-slate-500/40 text-slate-300">
            <Clock className="h-4 w-4" />
            <AlertTitle>{t("wallet.dailyLimitTitle")}</AlertTitle>
            <AlertDescription>{t("wallet.dailyLimitDesc")} <strong>{nextWithdrawTime}</strong></AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="withdraw" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-background/20 border border-border/30">
                <TabsTrigger value="withdraw" className="data-[state=active]:bg-primary">{t("common.withdraw")}</TabsTrigger>
                <TabsTrigger value="wallets" className="data-[state=active]:bg-primary">{t("wallet.withdrawalWallets")}</TabsTrigger>
              </TabsList>

              {/* Withdraw Tab */}
              <TabsContent value="withdraw">
                <Card className="trading-card" translate="no">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" /> {t("wallet.requestWithdrawal")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Live balance display */}
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-blue-400" />
                        <span className="text-blue-200">{t("wallet.availableBalance")}</span>
                      </div>
                      <span className="text-white font-bold text-xl">${liveBalance.toFixed(2)}</span>
                    </div>

                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">{t("common.important")}</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        {t("wallet.feeWarning").replace('{fee}', String(feePercentage)).replace('{min}', String(minWithdrawAmount))} {t("wallet.oneWithdrawalPerDay")}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Wallet select */}
                      <div className="space-y-2">
                        <Label className="text-white">{t("wallet.selectWallet")}</Label>
                        <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                          <SelectTrigger className="h-12 bg-background/50 border-border/50">
                            <SelectValue placeholder={t("wallet.chooseWallet")} />
                          </SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label || w.asset} — {w.address.slice(0, 8)}…{w.address.slice(-4)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!wallets.length && (
                          <p className="text-sm text-red-400">{t("wallet.addWalletFirst")}</p>
                        )}
                      </div>

                      {/* Amount + Max button */}
                      <div className="space-y-2">
                        <Label className="text-white">{t("wallet.amountUSD")}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={t("wallet.enterAmount")}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-12 bg-background/50 border-border/50 text-white flex-1"
                            min={minWithdrawAmount}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-12 px-3 border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700 shrink-0"
                            onClick={() => setAmount(String(liveBalance))}
                            title="Use max balance"
                          >
                            MAX
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Min: ${minWithdrawAmount}</p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-background/20 rounded-lg border border-border/30 space-y-2">
                      <h3 className="text-white font-semibold">{t("common.summary")}</h3>
                      {[
                        { label: t("wallet.requestedAmount"), value: `$${amount || "0.00"}`, cls: "text-white" },
                        { label: t("wallet.fee").replace('{fee}', String(feePercentage)), value: `-$${fee.toFixed(2)}`, cls: "text-red-400" },
                        { label: t("wallet.youWillReceive"), value: `$${net.toFixed(2)}`, cls: "text-green-400 font-bold" },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={cls}>{value}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-semibold professional-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={submitWithdrawal}
                      disabled={!canSubmit}
                    >
                      {isSubmitting
                        ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("common.submitting")}</>
                        : !withdrawEnabled
                          ? t("wallet.withdrawalsDisabledTitle")
                          : !profileComplete
                            ? <><UserCheck className="mr-2 h-5 w-5" /> {t("common.profileIncompleteTitle")}</>
                            : freezeInfo.frozen
                              ? <><Clock className="mr-2 h-5 w-5" /> {t("wallet.securityFreezeTitle").replace('{time}', freezeInfo.remainingLabel)}</>
                              : t("wallet.submitRequest")}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Wallets Tab */}
              <TabsContent value="wallets">
                <Card className="trading-card">
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center">
                      <Wallet className="w-5 h-5 mr-2" /> {t("wallet.manageWallets")}
                    </CardTitle>
                    <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="w-4 h-4 mr-2" /> {t("wallet.addNewWallet")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("wallet.addWalletTitle")}</DialogTitle>
                          <DialogDescription>{t("wallet.addWalletDesc")}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 py-3">
                          <div className="space-y-2">
                            <Label>{t("common.asset")}</Label>
                            <Select value={newWallet.asset} onValueChange={(v) => setNewWallet((p) => ({ ...p, asset: v as any }))}>
                              <SelectTrigger><SelectValue placeholder={t("wallet.selectAsset")} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USDT (TRC20)">USDT (TRC20)</SelectItem>
                                <SelectItem value="USDT (BEP20)">USDT (BEP20)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("wallet.walletLabel")} (optional)</Label>
                            <Input placeholder={t("wallet.walletLabelPlaceholder")} value={newWallet.label} onChange={(e) => setNewWallet((p) => ({ ...p, label: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("common.address")}</Label>
                            <Input placeholder={t("wallet.addressPlaceholder")} value={newWallet.address} onChange={(e) => setNewWallet((p) => ({ ...p, address: e.target.value }))} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={addWallet} disabled={!newWallet.asset || !newWallet.address}>
                            {t("wallet.saveWallet")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {wallets.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-6">No wallets added yet</p>
                    )}
                    {wallets.map((w) => (
                      <div key={w.id} className="p-4 rounded-xl bg-background/10 border border-border/30 hover:bg-background/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-white font-semibold">{w.label || w.asset}</p>
                            <p className="text-muted-foreground text-xs break-all mt-1">{w.address}</p>
                            <p className="text-slate-500 text-xs mt-1">{w.asset}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={w.otp_verified ? "text-green-400 border-green-400" : "text-yellow-400 border-yellow-400"}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {w.otp_verified ? t("common.verified") : t("common.pending")}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 h-8 w-8"
                              onClick={() => setDeleteDialog(w)}
                              title="Delete wallet"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Recent Withdrawals — FIXED: now shows wallet asset from join */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg">{t("wallet.recentWithdrawals")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {withdrawals.length === 0 && (
                  <p className="text-muted-foreground text-xs text-center py-4">{t("common.noWithdrawalsYet")}</p>
                )}
                {withdrawals.map((r) => (
                  <div key={r.id} className="p-3 bg-background/20 rounded-lg border border-border/30 hover:bg-background/30 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">${Number(r.amount).toFixed(2)}</span>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {r.withdrawal_wallets?.label || r.withdrawal_wallets?.asset || "—"} •{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground text-xs">Net: ${Number(r.net_amount).toFixed(2)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center">
                  <Lock className="w-5 h-5 mr-2" /> {t("wallet.securityTips")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• {t("wallet.securityTip1")}</p>
                <p>• {t("wallet.securityTip2")}</p>
                <p>• {t("wallet.securityTip3")}</p>
                <p>• {t("wallet.securityTip4")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete wallet confirmation dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Wallet</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to remove <strong className="text-white">{deleteDialog?.label || deleteDialog?.asset}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-slate-600 text-slate-300 bg-transparent" onClick={() => setDeleteDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteDialog && deleteWallet(deleteDialog)}>
              <Trash2 className="w-4 h-4 mr-2" /> {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
