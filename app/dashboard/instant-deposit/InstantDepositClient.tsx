"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  FileText,
  Wallet,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  Coins,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { InstantDepositModal } from "@/components/deposit/InstantDepositModal";
import { NexusInvoiceData, NexusNetwork } from "@/lib/nexus";
import { toast } from "sonner";

interface InstantDepositClientProps {
  user: any;
  profile: any;
  initialSettings: any;
  initialDeposits: any[];
}

const PRESET_AMOUNTS = [25, 50, 100, 250, 500, 1000];

export default function InstantDepositClient({
  user,
  profile,
  initialSettings,
  initialDeposits,
}: InstantDepositClientProps) {
  const { t } = useLanguage();
  const [selectedNetwork, setSelectedNetwork] = useState<NexusNetwork>("TRON");
  const [amount, setAmount] = useState<string>("100");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<NexusInvoiceData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deposits, setDeposits] = useState<any[]>(initialDeposits || []);
  const [liveBalance, setLiveBalance] = useState<number>(Number(profile?.balance || 0));
  const isEnabled = initialSettings?.is_enabled ?? true;
  const minDeposit = Number(initialSettings?.min_deposit_amount ?? 10);

  // Sync user balance with live changes
  useEffect(() => {
    if (!user?.id) return;

    // Fetch initial balance
    supabase
      .from("user_profiles")
      .select("balance")
      .eq("uid", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLiveBalance(Number(data.balance) || 0);
      });

    // Real-time balance updates
    const channel = supabase
      .channel(`instant-deposit-profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
          filter: `uid=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.balance !== undefined) {
            setLiveBalance(Number(payload.new.balance));
            toast.success(t("wallet.balanceUpdated") || "Balance updated!");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, t]);

  // Load and subscribe to automated deposit history
  const loadDeposits = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("user_id", user.id)
      .eq("payment_method", "nexus")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setDeposits(data);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`instant-deposits-table-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposits",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadDeposits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadDeposits]);

  // Estimate network fee and total expected
  const parsedAmount = parseFloat(amount) || 0;
  const estimatedFee = useMemo(() => {
    if (parsedAmount <= 0) return 0;
    // TRON: 2% with $2 min; BSC: 1% with $1 min
    if (selectedNetwork === "TRON") {
      return Math.max(2, parsedAmount * 0.02);
    }
    return Math.max(1, parsedAmount * 0.01);
  }, [parsedAmount, selectedNetwork]);

  const totalExpectedAmount = (parsedAmount + estimatedFee).toFixed(6);

  const handleGenerateInvoice = async () => {
    if (!isEnabled) {
      toast.error(t("wallet.depositsDisabled") || "Deposits are disabled.");
      return;
    }

    if (parsedAmount < minDeposit) {
      toast.error(
        `${t("wallet.minDepositWarning") || "Minimum deposit is $"}${minDeposit}`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/nexus/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          network: selectedNetwork,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate deposit invoice");
      }

      setActiveInvoice(json.data);
      setIsModalOpen(true);
      loadDeposits();
      toast.success(
        t("wallet.generatingInvoice") || "Deposit address generated successfully!"
      );
    } catch (err: any) {
      console.error("[InstantDepositClient] Error creating invoice:", err);
      toast.error(err.message || "Failed to initiate deposit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenExistingInvoice = (dep: any) => {
    const isTron = dep.network_label?.includes("TRC-20") || dep.network_label?.includes("TRON");
    const syntheticInvoice: NexusInvoiceData = {
      invoiceId: dep.transaction_id || `inv_${dep.id.slice(0, 16)}`,
      depositAddress: dep.wallet_id || "Available on verification",
      expectedCryptoAmount: String(dep.amount),
      baseAmount: Number(dep.amount),
      feeAmount: 0,
      cryptoCurrency: "USDT",
      network: isTron ? "TRON" : "BSC",
      status:
        dep.status === "confirmed" || dep.status === "approved"
          ? "CONFIRMED"
          : dep.status === "detected"
          ? "DETECTED"
          : "PENDING",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: dep.created_at,
    };

    setActiveInvoice(syntheticInvoice);
    setIsModalOpen(true);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24 text-white"
      translate="no"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Switcher between Instant and Manual */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md">
                <Zap className="w-5 h-5 fill-current" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  {t("wallet.instantDepositTitle") || "Instant Crypto Deposit"}
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] uppercase font-semibold">
                    Automated
                  </Badge>
                </h1>
                <p className="text-xs text-blue-200/80">
                  {t("wallet.instantDepositSubtitle") ||
                    "Automated instant USDT deposits on TRON (TRC-20) and BNB Chain (BEP-20)"}
                </p>
              </div>
            </div>
          </div>

          {/* Balance Pill */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-inner flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-blue-400" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                  {t("dashboard.totalBalance") || "Balance"}
                </span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  ${liveBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent text-xs"
              >
                ← {t("nav.dashboard") || "Dashboard"}
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-800/70 border border-slate-700/60 max-w-md mx-auto">
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 text-white font-medium text-xs shadow-md transition-all cursor-default"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
            <span>{t("wallet.tabInstant") || "Instant Automated"}</span>
          </button>
          <Link
            href="/dashboard/deposit"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/50 font-medium text-xs transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>{t("wallet.tabManual") || "Manual Deposit"}</span>
          </Link>
        </div>

        {/* Disabled Warning if any */}
        {!isEnabled && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <p className="text-sm">{t("wallet.depositsDisabled") || "Deposits are disabled."}</p>
          </div>
        )}

        {/* Main Deposit Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-900/90 border border-slate-800 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-slate-800/60 pb-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  {t("wallet.selectNetwork") || "Select Blockchain Network"}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Choose your preferred network for transferring USDT
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Network Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* TRON (TRC-20) */}
                  <div
                    onClick={() => setSelectedNetwork("TRON")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      selectedNetwork === "TRON"
                        ? "bg-red-500/10 border-red-500 shadow-lg shadow-red-500/10"
                        : "bg-slate-800/40 border-slate-700 hover:border-slate-600 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-sm">
                          TRX
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">
                            {t("wallet.tronNetwork") || "TRON (TRC-20)"}
                          </h4>
                          <span className="text-[11px] text-slate-400">USDT Tether</span>
                        </div>
                      </div>
                      {selectedNetwork === "TRON" && (
                        <CheckCircle2 className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{t("wallet.tronDesc") || "Fast & widespread"}</span>
                      <span className="text-red-300 font-mono">20 confirmations</span>
                    </div>
                  </div>

                  {/* BNB Chain (BEP-20) */}
                  <div
                    onClick={() => setSelectedNetwork("BSC")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      selectedNetwork === "BSC"
                        ? "bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10"
                        : "bg-slate-800/40 border-slate-700 hover:border-slate-600 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                          BNB
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">
                            {t("wallet.bscNetwork") || "BNB Chain (BEP-20)"}
                          </h4>
                          <span className="text-[11px] text-slate-400">USDT Tether</span>
                        </div>
                      </div>
                      {selectedNetwork === "BSC" && (
                        <CheckCircle2 className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{t("wallet.bscDesc") || "Low gas fees"}</span>
                      <span className="text-amber-300 font-mono">3 confirmations</span>
                    </div>
                  </div>
                </div>

                {/* Amount Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      {t("wallet.enterDepositAmount") || "Deposit Amount (USDT)"}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {t("wallet.minDepositAmountNotice")?.replace("${min}", String(minDeposit)) ||
                        `Min: $${minDeposit}`}
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRESET_AMOUNTS.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmount(String(val))}
                        className={`py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                          amount === String(val)
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        ${val}
                      </button>
                    ))}
                  </div>

                  {/* Custom Input */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      $
                    </span>
                    <Input
                      type="number"
                      step="any"
                      min={minDeposit}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-8 bg-slate-800/90 border-slate-700 text-white font-mono text-lg rounded-xl h-12 focus-visible:ring-blue-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      USDT
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleGenerateInvoice}
                  disabled={isSubmitting || !isEnabled || parsedAmount < minDeposit}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm shadow-xl shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("wallet.generatingInvoice") || "Generating Unique Deposit Address..."}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2 text-yellow-300 fill-yellow-300" />
                      {t("wallet.generateDepositInvoice") || "Generate Instant Deposit Address"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Fee Breakdown and Security Info */}
          <div className="space-y-6">
            <Card className="bg-slate-900/90 border border-slate-800 shadow-xl rounded-3xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Fee & Transfer Summary
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>{t("wallet.baseAmount") || "Deposit Amount"}:</span>
                  <span className="font-mono font-semibold text-white">
                    ${parsedAmount.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>{t("wallet.networkFeeBreakdown") || "Network Gas Fee"}:</span>
                  <span className="font-mono font-semibold text-amber-400">
                    +${estimatedFee.toFixed(2)} USDT
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-white">
                    {t("wallet.totalExpected") || "Total Expected"}:
                  </span>
                  <span className="font-mono font-bold text-sm text-emerald-400">
                    ${totalExpectedAmount} USDT
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Each transaction uses an HD BIP-44 derived ephemeral address for strict privacy.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Payments are credited in real-time as soon as blockchain confirmations are reached.
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick Switch to Manual Deposit */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white">
                  {t("wallet.tabManual") || "Manual Deposit & Proof"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {t("wallet.switchToManual") || "Prefer manual transfer & proof upload?"}
                </p>
              </div>
              <Link href="/dashboard/deposit">
                <Button size="sm" variant="outline" className="border-slate-700 text-xs">
                  Switch →
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Instant Deposits History */}
        <Card className="bg-slate-900/90 border border-slate-800 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/60 pb-4">
            <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                {t("wallet.instantDepositHistory") || "Automated Deposit History"}
              </span>
              <span className="text-xs font-normal text-slate-400">
                {deposits.length} record(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {deposits.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {t("wallet.noDeposits") || "No instant crypto deposits yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">{t("wallet.network") || "Network"}</th>
                      <th className="py-3 px-4">{t("wallet.baseAmount") || "Amount"}</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">{t("wallet.txHash") || "Transaction / Invoice"}</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {deposits.map((dep) => {
                      const isConfirmed =
                        dep.status === "confirmed" || dep.status === "approved";
                      const isPending = dep.status === "pending" || dep.status === "detected";
                      const isTron =
                        dep.network_label?.includes("TRC-20") || dep.network_label?.includes("TRON");

                      return (
                        <tr key={dep.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-300 font-mono">
                            {new Date(dep.created_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isTron
                                  ? "bg-red-500/10 text-red-300 border-red-500/30"
                                  : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {dep.network_label || (isTron ? "TRC-20" : "BEP-20")}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-bold font-mono text-white">
                            ${Number(dep.amount).toFixed(2)} USDT
                          </td>
                          <td className="py-3 px-4">
                            {isConfirmed ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                                Confirmed ✅
                              </Badge>
                            ) : dep.status === "detected" ? (
                              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] animate-pulse">
                                Detected 🔄
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-[10px]">
                                Pending ⏳
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {dep.transaction_id ? (
                              <span className="text-slate-300">
                                {dep.transaction_id.slice(0, 16)}...
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isPending ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenExistingInvoice(dep)}
                                className="h-7 text-[11px] px-2.5 border-blue-500/40 text-blue-300 hover:bg-blue-600 hover:text-white"
                              >
                                View Checkout
                              </Button>
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Dialog for Checkout */}
        <InstantDepositModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          invoice={activeInvoice}
          onInvoiceUpdated={(updated) => {
            setActiveInvoice(updated);
            loadDeposits();
          }}
          onRegenerate={handleGenerateInvoice}
        />
      </div>
    </div>
  );
}
