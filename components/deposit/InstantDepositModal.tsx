"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import {
  Copy,
  Check,
  ExternalLink,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Info,
} from "lucide-react";
import { NexusInvoiceData, getHostedCheckoutUrl } from "@/lib/nexus";
import { useLanguage } from "@/contexts/language-context";
import { toast } from "sonner";

interface InstantDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: NexusInvoiceData | null;
  onInvoiceUpdated?: (updated: NexusInvoiceData) => void;
  onRegenerate?: () => void;
}

export function InstantDepositModal({
  isOpen,
  onClose,
  invoice,
  onInvoiceUpdated,
  onRegenerate,
}: InstantDepositModalProps) {
  const { t } = useLanguage();
  const [currentInvoice, setCurrentInvoice] = useState<NexusInvoiceData | null>(invoice);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 mins default
  const [isRefreshing, setIsRefreshing] = useState(false);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    setCurrentInvoice(invoice);
    confettiFiredRef.current = false;
  }, [invoice]);

  // Calculate countdown timer based on invoice expiresAt
  useEffect(() => {
    if (!currentInvoice?.expiresAt) return;

    const updateTimer = () => {
      const expiry = new Date(currentInvoice.expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setSecondsRemaining(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentInvoice?.expiresAt]);

  const isConfirmed =
    currentInvoice?.status === "CONFIRMED" ||
    parseFloat(currentInvoice?.paidCryptoAmount || "0") > 0 ||
    !!currentInvoice?.txHash;

  const isDetected = currentInvoice?.status === "DETECTED" && !isConfirmed;
  const isExpired =
    (currentInvoice?.status === "EXPIRED" || secondsRemaining <= 0) && !isConfirmed;

  // Trigger celebration confetti on payment confirmation
  useEffect(() => {
    if (isConfirmed && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6"],
        });
      } catch (err) {
        console.debug("Confetti skipped:", err);
      }
    }
  }, [isConfirmed]);

  // Poll live invoice status from our backend endpoint every 3 seconds while modal is open and pending
  useEffect(() => {
    if (!isOpen || !currentInvoice?.invoiceId || isConfirmed || isExpired) return;

    let isMounted = true;
    const pollStatus = async () => {
      try {
        const res = await fetch(
          `/api/nexus/check-status?invoiceId=${encodeURIComponent(
            currentInvoice.invoiceId
          )}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json.success && json.data && isMounted) {
          setCurrentInvoice(json.data);
          onInvoiceUpdated?.(json.data);
        }
      } catch (err) {
        console.debug("[ModalPoller] polling issue:", err);
      }
    };

    const interval = setInterval(pollStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, currentInvoice?.invoiceId, isConfirmed, isExpired, onInvoiceUpdated]);

  const handleManualRefresh = async () => {
    if (!currentInvoice?.invoiceId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(
        `/api/nexus/check-status?invoiceId=${encodeURIComponent(
          currentInvoice.invoiceId
        )}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentInvoice(json.data);
        onInvoiceUpdated?.(json.data);
        toast.success(t("common.updated") || "Status refreshed");
      }
    } catch {
      toast.error(t("common.error") || "Failed to refresh");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const copyToClipboard = async (text: string, type: "address" | "amount" | "id") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "address") {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
        toast.success(t("wallet.addressCopiedToast") || "Deposit address copied!");
      } else if (type === "amount") {
        setCopiedAmount(true);
        setTimeout(() => setCopiedAmount(false), 2000);
        toast.success(t("wallet.amountCopiedToast") || "Amount copied!");
      } else {
        setCopiedInvoiceId(true);
        setTimeout(() => setCopiedInvoiceId(false), 2000);
        toast.success("Invoice ID copied!");
      }
    } catch {
      // ignore
    }
  };

  if (!currentInvoice) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTimer = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isTron = currentInvoice.network === "TRON";
  const networkName = isTron ? "TRON (TRC-20)" : "BNB Chain (BEP-20)";
  const networkBadgeColor = isTron
    ? "bg-red-500/20 text-red-300 border-red-500/40"
    : "bg-amber-500/20 text-amber-300 border-amber-500/40";

  const explorerUrl = isTron
    ? `https://tronscan.org/#/address/${currentInvoice.depositAddress}`
    : `https://bscscan.com/address/${currentInvoice.depositAddress}`;

  const hostedCheckoutUrl = getHostedCheckoutUrl(currentInvoice.invoiceId);

  // Dynamic URI scheme for wallets
  const qrUri = isTron
    ? currentInvoice.depositAddress
    : `ethereum:${currentInvoice.depositAddress}?amount=${currentInvoice.expectedCryptoAmount}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-full bg-slate-900 border border-slate-700/80 text-white shadow-2xl p-6 rounded-3xl overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Glow Background */}
        <div
          className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-25 pointer-events-none ${
            isTron ? "bg-red-500" : "bg-amber-400"
          }`}
        />

        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                {t("wallet.invoiceNumber") || "Invoice #"}{" "}
                <button
                  type="button"
                  onClick={() => copyToClipboard(currentInvoice.invoiceId, "id")}
                  className="hover:text-blue-400 underline font-semibold transition-colors cursor-pointer"
                  title="Click to copy Invoice ID"
                >
                  {currentInvoice.invoiceId.slice(-8)}
                </button>
              </span>
              <Badge variant="outline" className={`text-xs py-0.5 px-2 ${networkBadgeColor}`}>
                {networkName}
              </Badge>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`}
              />
            </button>
          </div>

          <DialogTitle className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            {t("wallet.paymentModalTitle") || "Instant Crypto Checkout"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {t("wallet.instantDepositSubtitle") ||
              "Automated instant USDT deposits on TRON (TRC-20) and BNB Chain (BEP-20)"}
          </DialogDescription>
        </DialogHeader>

        {/* Status Banner */}
        {isConfirmed ? (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-center space-y-2 animate-in fade-in zoom-in duration-300">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {t("wallet.statusConfirmed") || "Deposit Confirmed!"}
            </h3>
            <p className="text-xs text-emerald-300/90">
              {t("wallet.paymentConfirmedDesc") ||
                "Your funds have been credited to your balance."}
            </p>
            {currentInvoice.txHash && (
              <a
                href={
                  isTron
                    ? `https://tronscan.org/#/transaction/${currentInvoice.txHash}`
                    : `https://bscscan.com/tx/${currentInvoice.txHash}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 underline font-mono mt-1"
              >
                <span>TxHash: {currentInvoice.txHash.slice(0, 10)}...{currentInvoice.txHash.slice(-8)}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ) : isDetected ? (
          <div className="p-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-white">
                {t("wallet.statusDetected") || "Payment Detected on Blockchain!"}
              </p>
              <p className="text-cyan-300/80">
                Confirmations: {currentInvoice.confirmations || 1} / {isTron ? 20 : 3}
              </p>
            </div>
          </div>
        ) : isExpired ? (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
            <h4 className="font-bold text-white">
              {t("wallet.statusExpired") || "Invoice Expired"}
            </h4>
            <p className="text-xs text-rose-300">
              The 15-minute payment window has ended.
            </p>
            {onRegenerate && (
              <Button
                onClick={onRegenerate}
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white mt-1"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {t("wallet.regenerateInvoice") || "Generate New Address"}
              </Button>
            )}
          </div>
        ) : (
          /* Countdown Timer Bar */
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Clock
                className={`w-4 h-4 ${
                  secondsRemaining < 180 ? "text-amber-400 animate-pulse" : "text-blue-400"
                }`}
              />
              <span>{t("wallet.depositTimer") || "Payment Window"}:</span>
            </div>
            <span
              className={`font-mono text-sm font-bold ${
                secondsRemaining < 180 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {formattedTimer}
            </span>
          </div>
        )}

        {/* QR Code and Deposit Details (Shown if not confirmed) */}
        {!isConfirmed && (
          <>
            {/* Dynamic QR Code Card */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-lg border border-slate-200 mx-auto w-fit">
              <QRCodeSVG
                value={qrUri}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Exact Amount to Send */}
            <div className="bg-slate-800/90 rounded-2xl p-3.5 border border-slate-700/80 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t("wallet.totalExpected") || "Total Amount to Send"}</span>
                <span className="text-amber-400 font-medium">
                  {t("wallet.sendExactAmountWarning") || "Send exact amount"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-white tracking-tight">
                    {currentInvoice.expectedCryptoAmount}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {currentInvoice.cryptoCurrency} ({isTron ? "TRC-20" : "BEP-20"})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(currentInvoice.expectedCryptoAmount, "amount")
                  }
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
                >
                  {copiedAmount ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">{t("common.copied") || "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t("common.copy") || "Copy"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Fee Breakdown Details */}
              <div className="pt-2 mt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Base: ${Number(currentInvoice.baseAmount || 0).toFixed(2)} + Gas Fee: $
                  {Number(currentInvoice.feeAmount || 0).toFixed(2)}
                </span>
                <span className="text-emerald-400 font-medium">Instant On-Chain Auto-Credit</span>
              </div>
            </div>

            {/* Deposit Address Box */}
            <div className="bg-slate-800/90 rounded-2xl p-3.5 border border-slate-700/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t("wallet.selectWallet") || "Deposit Address"}</span>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <span>{t("wallet.viewInExplorer") || "Explorer"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900/90 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 break-all select-all border border-slate-700/50">
                  {currentInvoice.depositAddress}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(currentInvoice.depositAddress, "address")
                  }
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shrink-0"
                  title="Copy Address"
                >
                  {copiedAddress ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Privacy Architecture Notice */}
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-950/40 border border-blue-900/50 text-[11px] text-blue-200/80">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                {t("wallet.depositExpiresNotice") ||
                  "A unique ephemeral HD wallet address is derived for this payment. Funds are automatically forwarded to cold storage."}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href={hostedCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 bg-slate-800/40"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  {t("wallet.openDedicatedPage") || "Open Dedicated Checkout"}
                </Button>
              </a>
              <Button
                variant="default"
                size="sm"
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {t("wallet.closeModal") || "Done"}
              </Button>
            </div>
          </>
        )}

        {/* Confirmed State Actions */}
        {isConfirmed && (
          <div className="pt-2">
            <Button
              onClick={onClose}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5"
            >
              <Check className="w-4 h-4 mr-2" />
              {t("wallet.closeModal") || "Continue to Dashboard"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
