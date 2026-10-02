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
  InputOTP, InputOTPGroup, InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  DollarSign, Shield, Wallet, Lock, AlertCircle,
  CheckCircle2, Plus, Loader2, Trash2, Clock, UserCheck, ExternalLink,
  Send, MessageCircle, Mail, KeyRound, ShieldCheck, Timer,
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
  const freezeMs = 24 * 60 * 60 * 1000;
  if (elapsed >= freezeMs) return { frozen: false, remainingMs: 0, remainingLabel: "" };
  const remainingMs = freezeMs - elapsed;
  const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
  const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  return { frozen: true, remainingMs, remainingLabel: `${hrs}h ${mins}m` };
}

// ─── OTP Verification Modal ──────────────────────────────────────────────────
interface OtpModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
  sessionId: string;
  hasTelegram: boolean;
  expiresAt: string;
  amount: number;
  netAmount: number;
}

function OtpVerificationModal({ open, onClose, onSuccess, sessionId, hasTelegram, expiresAt, amount, netAmount }: OtpModalProps) {
  const [emailCode, setEmailCode] = useState("");
  const [telegramCode, setTelegramCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);

  // Countdown timer
  useEffect(() => {
    if (!open) return;
    const expiry = new Date(expiresAt).getTime();
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [open, expiresAt]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setEmailCode("");
      setTelegramCode("");
      setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }
  }, [open, expiresAt]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const expired = secondsLeft === 0;
  const canVerify = emailCode.length === 6 && (!hasTelegram || telegramCode.length === 6) && !expired && !isVerifying;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch("/api/withdraw/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, emailCode, telegramCode: hasTelegram ? telegramCode : emailCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`❌ ${data.error || "Verification failed"}`);
      } else {
        toast.success("✅ Withdrawal verified and submitted successfully!");
        onSuccess(data.newBalance);
        onClose();
      }
    } catch (err: any) {
      toast.error(`❌ ${err.message || "Network error"}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isVerifying) onClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white text-xl">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            Security Verification
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Two verification codes have been sent. Enter both below to authorize your withdrawal of{" "}
            <strong className="text-white">${amount.toFixed(2)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Timer */}
          <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${expired ? "bg-red-500/10 border-red-500/40 text-red-400" : "bg-blue-500/10 border-blue-500/30 text-blue-300"}`}>
            <Timer className="w-4 h-4" />
            <span className="font-mono text-sm font-semibold">
              {expired ? "Code Expired — Close and retry" : `Codes expire in ${mins}:${secs}`}
            </span>
          </div>

          {/* Summary */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Withdrawal Amount</span>
              <span className="text-white font-semibold">${amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">You will receive</span>
              <span className="text-green-400 font-bold">${netAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Email OTP */}
          <div className="space-y-3">
            <Label className="text-slate-200 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              Email Verification Code
            </Label>
            <p className="text-xs text-slate-500">Check your registered email inbox for a 6-digit code.</p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={emailCode}
                onChange={setEmailCode}
                disabled={expired}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="border-slate-600 bg-slate-800 text-white text-lg" />
                  <InputOTPSlot index={1} className="border-slate-600 bg-slate-800 text-white text-lg" />
                  <InputOTPSlot index={2} className="border-slate-600 bg-slate-800 text-white text-lg" />
                  <InputOTPSlot index={3} className="border-slate-600 bg-slate-800 text-white text-lg" />
                  <InputOTPSlot index={4} className="border-slate-600 bg-slate-800 text-white text-lg" />
                  <InputOTPSlot index={5} className="border-slate-600 bg-slate-800 text-white text-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          {/* Telegram OTP */}
          {hasTelegram ? (
            <div className="space-y-3">
              <Label className="text-slate-200 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-sky-400" />
                Telegram Verification Code
              </Label>
              <p className="text-xs text-slate-500">Check your Telegram bot for a separate 6-digit code.</p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={telegramCode}
                  onChange={setTelegramCode}
                  disabled={expired}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="border-slate-600 bg-slate-800 text-white text-lg" />
                    <InputOTPSlot index={1} className="border-slate-600 bg-slate-800 text-white text-lg" />
                    <InputOTPSlot index={2} className="border-slate-600 bg-slate-800 text-white text-lg" />
                    <InputOTPSlot index={3} className="border-slate-600 bg-slate-800 text-white text-lg" />
                    <InputOTPSlot index={4} className="border-slate-600 bg-slate-800 text-white text-lg" />
                    <InputOTPSlot index={5} className="border-slate-600 bg-slate-800 text-white text-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <MessageCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                No Telegram account linked. Only email verification is required.{" "}
                <Link href="/dashboard/profile" className="underline text-amber-400 hover:text-amber-200">
                  Link Telegram in your profile
                </Link>{" "}
                for enhanced security.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-800"
            onClick={onClose}
            disabled={isVerifying}
          >
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold flex-1"
            onClick={handleVerify}
            disabled={!canVerify}
          >
            {isVerifying ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
            ) : (
              <><KeyRound className="mr-2 h-4 w-4" /> Confirm Withdrawal</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
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
  const [, forceRender] = useState<number>(0);

  // OTP Modal state
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpSession, setOtpSession] = useState<{
    sessionId: string; hasTelegram: boolean; expiresAt: string;
  } | null>(null);

  const [newWallet, setNewWallet] = useState<{
    asset: WithdrawalWallet["asset"] | ""; address: string; label: string;
  }>({ asset: "", address: "", label: "" });

  useEffect(() => {
    const timer = setInterval(() => forceRender(n => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Initial data load ───────────────────────────────────────────────────
  useEffect(() => {
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
      .select("*")
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

    const balCh = supabase.channel(`withdraw-balance-${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `uid=eq.${user.id}` },
        (p) => { if (p.new?.balance !== undefined) setLiveBalance(Number(p.new.balance)); }
      ).subscribe();

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

  const midnightResetTime = () => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " " + d.toLocaleDateString();
  };

  // ─── Submit Withdrawal → triggers OTP flow ───────────────────────────────
  const submitWithdrawal = async () => {
    const amt = Number(amount);
    if (!withdrawEnabled) { toast.error(`🚫 ${t("wallet.withdrawalsDisabled")}`); return; }
    if (!selectedWallet || !amount || isNaN(amt) || amt < minWithdrawAmount) {
      toast.warning(`⚠️ ${t("wallet.amountMinLabel").replace("{min}", String(minWithdrawAmount))}`); return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("⏳ Sending verification codes…");

    try {
      const res = await fetch("/api/withdraw/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId: selectedWalletId,
          amount: amt,
          fee,
          netAmount: net,
        }),
      });

      const data = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        if (res.status === 429) {
          const resetTime = midnightResetTime();
          setNextWithdrawTime(resetTime);
          toast.error(`🚫 ${t("wallet.oneWithdrawalPerDayDesc").replace("{time}", resetTime)}`);
        } else {
          toast.error(`❌ ${data.error || "Failed to send verification codes"}`);
        }
        return;
      }

      // Codes sent — open the verification modal
      setOtpSession({
        sessionId: data.sessionId,
        hasTelegram: data.hasTelegram,
        expiresAt: data.expiresAt,
      });
      setOtpModalOpen(true);
      toast.success("✅ Verification codes sent! Check your email" + (data.hasTelegram ? " and Telegram." : "."));

    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(`❌ ${err.message || "Network error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── OTP Verified → withdrawal finalized ────────────────────────────────
  const handleOtpSuccess = (newBalance: number) => {
    setLiveBalance(newBalance);
    setAmount("");
    setOtpSession(null);
    loadWithdrawals();
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
      return <Badge className="bg-green-500/20 text-green-400 border-green-400">{t("wallet.statusBadgeApproved") || "✅ Paid"}</Badge>;
    if (status === "rejected")
      return <Badge className="bg-red-500/20 text-red-400 border-red-400">{t("wallet.statusBadgeRejected") || "❌ Rejected"}</Badge>;
    if (status === "processing")
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-400">{t("wallet.statusBadgeProcessing") || "🔄 Processing"}</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-400">{t("wallet.statusBadgePending") || "⏳ Pending"}</Badge>;
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
              <Shield className="w-4 h-4 mr-2" /> {t("wallet.sslSecured")}
            </Badge>
            <Badge variant="outline" className="text-blue-400 border-blue-400 bg-blue-400/10">
              <ShieldCheck className="w-4 h-4 mr-2" /> 2FA Protected
            </Badge>
          </div>
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
            <AlertTitle className="text-blue-300 font-semibold">{t("wallet.securityFreezeTitle").replace("{time}", freezeInfo.remainingLabel)}</AlertTitle>
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

                    {/* 2FA security notice */}
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30">
                      <ShieldCheck className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-blue-300 font-semibold text-sm">Dual 2FA Security Active</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          Every withdrawal requires verification codes sent simultaneously to your{" "}
                          <span className="text-blue-300">Email</span>
                          {profile?.telegram_chat_id && <> and <span className="text-sky-300">Telegram</span></>}.
                          {!profile?.telegram_chat_id && (
                            <> <Link href="/dashboard/profile" className="text-amber-400 underline hover:text-amber-300">Link Telegram</Link> for maximum security.</>
                          )}
                        </p>
                      </div>
                    </div>

                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-yellow-400">{t("common.important")}</AlertTitle>
                      <AlertDescription className="text-yellow-200">
                        {t("wallet.feeWarning").replace("{fee}", String(feePercentage)).replace("{min}", String(minWithdrawAmount))} {t("wallet.oneWithdrawalPerDay")}
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
                        { label: t("wallet.fee").replace("{fee}", String(feePercentage)), value: `-$${fee.toFixed(2)}`, cls: "text-red-400" },
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
                        ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sending Verification Codes…</>
                        : !withdrawEnabled
                          ? t("wallet.withdrawalsDisabledTitle")
                          : !profileComplete
                            ? <><UserCheck className="mr-2 h-5 w-5" /> {t("common.profileIncompleteTitle")}</>
                            : freezeInfo.frozen
                              ? <><Clock className="mr-2 h-5 w-5" /> {t("wallet.securityFreezeTitle").replace("{time}", freezeInfo.remainingLabel)}</>
                              : <><Send className="mr-2 h-5 w-5" /> {t("wallet.submitRequest")} (2FA)</>}
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
                      {(wallets.find(w => w.id === r.wallet_id)?.label || wallets.find(w => w.id === r.wallet_id)?.asset) || "—"} •{" "}
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
                <p className="text-blue-400 text-xs mt-3">• All withdrawals require dual 2FA (Email + Telegram)</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {otpSession && (
        <OtpVerificationModal
          open={otpModalOpen}
          onClose={() => { setOtpModalOpen(false); setOtpSession(null); }}
          onSuccess={handleOtpSuccess}
          sessionId={otpSession.sessionId}
          hasTelegram={otpSession.hasTelegram}
          expiresAt={otpSession.expiresAt}
          amount={Number(amount)}
          netAmount={net}
        />
      )}

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
