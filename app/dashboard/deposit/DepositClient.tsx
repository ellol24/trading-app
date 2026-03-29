"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, CheckCircle2, AlertCircle, Copy, Check,
  Upload, ZoomIn, Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/contexts/language-context";

type Network = { id: string; address: string; asset?: string | null };
type Deposit = {
  id: string; amount: number; status: string; created_at: string;
  proof_base64?: string | null;
  deposit_wallets?: { asset: string; address: string } | null;
};

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/jpg"];

export default function DepositClient({ user, profile }: any) {
  const { t } = useLanguage();
  const [networks, setNetworks]       = useState<Network[]>([]);
  const [networkId, setNetworkId]     = useState<string>("");
  const [amount, setAmount]           = useState<string>("");
  const [screenshot, setScreenshot]   = useState<File | null>(null);
  const [fileError, setFileError]     = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deposits, setDeposits]       = useState<Deposit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEnabled, setIsEnabled]     = useState(true);
  const [minDeposit, setMinDeposit]   = useState(10);
  const [addressCopied, setAddressCopied] = useState(false);
  const [previewImg, setPreviewImg]   = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number>(0);

  useEffect(() => {
    supabase.from("deposit_settings").select("is_enabled, min_deposit_amount").limit(1).single()
      .then(({ data }) => {
        if (data) { setIsEnabled(data.is_enabled); setMinDeposit(Number(data.min_deposit_amount)); }
      });
    supabase.from("deposit_wallets").select("id,address,asset")
      .then(({ data, error }) => {
        if (error) { toast.error("❌ Failed to load wallets"); return; }
        const rows = data ?? [];
        setNetworks(rows);
        if (rows.length > 0) setNetworkId(rows[0].id);
      });

    // Fetch initial balance
    if (user?.id) {
      supabase.from("user_profiles").select("balance").eq("uid", user.id).single()
        .then(({ data }) => { if (data) setLiveBalance(Number(data.balance) || 0); });
    }
  }, [user?.id]);

  const selected = useMemo(() => networks.find((n) => n.id === networkId), [networkId, networks]);

  const copyAddress = async () => {
    if (!selected?.address) return;
    await navigator.clipboard.writeText(selected.address);
    setAddressCopied(true);
    toast.success(`✅ Address copied!`);
    setTimeout(() => setAddressCopied(false), 2500);
  };

  const validateFile = (file: File): string => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Only PNG, JPG and WEBP images are allowed.";
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `File must be smaller than ${MAX_FILE_SIZE_MB}MB.`;
    return "";
  };

  const onFileChange = (file: File | null) => {
    setFileError("");
    if (!file) { setScreenshot(null); return; }
    const err = validateFile(file);
    if (err) { setFileError(err); setScreenshot(null); toast.error(`⚠️ ${err}`); return; }
    setScreenshot(file);
  };

  const loadDeposits = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("deposits")
      .select("id, amount, status, created_at, proof_base64, deposit_wallets(asset, address)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("❌ Failed to load deposit history");
    else setDeposits((data as any) ?? []);
    setLoadingHistory(false);
  }, [user?.id]);

  useEffect(() => { loadDeposits(); }, [loadDeposits]);

  // Real-time: listen for deposit status changes + balance updates
  useEffect(() => {
    if (!user?.id) return;

    const depositsCh = supabase
      .channel(`deposit-realtime-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${user.id}` },
        () => loadDeposits()
      )
      .subscribe();

    // Live balance: instant update when admin approves deposit
    const balanceCh = supabase
      .channel(`deposit-balance-${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `uid=eq.${user.id}` },
        (payload) => {
          if (payload.new?.balance !== undefined) {
            setLiveBalance(Number(payload.new.balance));
            toast.success("💰 Your balance has been updated!");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(depositsCh);
      supabase.removeChannel(balanceCh);
    };
  }, [user?.id, loadDeposits]);

  const createPayment = async () => {
    if (!isEnabled) { toast.error(`🚫 ${t("wallet.depositsDisabled")}`); return; }
    if (!amount || Number(amount) < minDeposit) {
      toast.warning(`⚠️ Minimum deposit is $${minDeposit}`); return;
    }
    if (!screenshot) { toast.warning("⚠️ Please attach a screenshot of your transfer"); return; }
    if (!selected?.id)  { toast.warning("⚠️ Please select a wallet"); return; }

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(screenshot);
      reader.onloadend = async () => {
        const { error } = await supabase.from("deposits").insert({
          user_id:    user.id,
          uid:        profile?.uid ?? null,
          username:   profile?.full_name || user.email || null,
          email:      user.email || null,
          network_id: selected.id,
          amount:     Number(amount),
          status:     "pending",
          proof_base64: reader.result as string,
        });
        if (error) { toast.error("❌ Deposit failed!"); }
        else {
          setAmount(""); setScreenshot(null);
          toast.success("✅ Deposit submitted! Awaiting admin approval.");
          loadDeposits();
        }
        setIsProcessing(false);
      };
    } catch { toast.error("❌ Something went wrong"); setIsProcessing(false); }
  };

  const formDisabled = !isEnabled || isProcessing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-20" translate="no">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{t("wallet.depositTitle")}</h1>
            <p className="text-blue-200 mt-1">Select a wallet, transfer crypto, then upload proof</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-2">
              <span className="text-blue-300 text-sm">Balance</span>
              <span className="text-white font-bold">${liveBalance.toFixed(2)}</span>
            </div>
            <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Secure &amp; Manual
            </Badge>
          </div>
        </div>

        {/* Deposits disabled banner */}
        {!isEnabled && (
          <div className="bg-red-600/10 border border-red-500 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Deposits are currently disabled</p>
              <p className="text-sm">{t("wallet.depositsDisabled")}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <fieldset disabled={formDisabled} className={formDisabled ? "opacity-50 pointer-events-none" : ""}>
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">1. Select Wallet &amp; Enter Amount</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Wallet select */}
                  <div className="space-y-2">
                    <Label className="text-white">Payment Network</Label>
                    <Select value={networkId} onValueChange={setNetworkId}>
                      <SelectTrigger className="h-12 bg-slate-700 text-white border-slate-600">
                        <SelectValue placeholder="Select wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        {networks.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.asset ?? "Wallet"} — {n.address.slice(0, 12)}…
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Wallet address + copy */}
                  {selected?.address && (
                    <div className="space-y-2">
                      <Label className="text-white">Platform Wallet Address</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={selected.address}
                          className="h-12 bg-slate-700 text-white border-slate-600 font-mono text-sm flex-1"
                        />
                        <Button
                          type="button"
                          onClick={copyAddress}
                          className="h-12 px-4 bg-blue-600 hover:bg-blue-700 shrink-0"
                        >
                          {addressCopied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Info className="w-3.5 h-3.5" />
                        Send only {selected.asset ?? "crypto"} to this address. Sending other assets may result in permanent loss.
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="text-white">
                      Amount (USD) — Min ${minDeposit}
                    </Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={`Minimum $${minDeposit}`}
                      min={minDeposit}
                      className="h-12 bg-slate-700 text-white border-slate-600"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Upload proof */}
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle className="text-white">2. Upload Payment Proof</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <div
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                        fileError ? "border-red-500 bg-red-500/5" : "border-slate-600 hover:border-blue-500 bg-slate-800/40"
                      }`}
                      onClick={() => document.getElementById("proof-upload")?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-white text-sm font-medium">
                        {screenshot ? screenshot.name : "Click to upload screenshot"}
                      </p>
                      <p className="text-slate-500 text-xs mt-1">PNG, JPG, WEBP — Max 5MB</p>
                    </div>
                    <input
                      id="proof-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                    />
                    {fileError && <p className="text-red-400 text-xs mt-1">{fileError}</p>}
                  </div>

                  {screenshot && (
                    <div className="relative">
                      <img
                        src={URL.createObjectURL(screenshot)}
                        alt="Proof preview"
                        className="w-full max-h-48 object-contain rounded-lg border border-slate-600"
                      />
                    </div>
                  )}

                  <Button
                    onClick={createPayment}
                    className="w-full h-12 font-semibold text-base bg-green-600 hover:bg-green-700"
                    disabled={formDisabled || !screenshot || !amount}
                  >
                    {isProcessing
                      ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />{t("wallet.processing")}</>
                      : "✅ I've Completed the Payment"}
                  </Button>
                </CardContent>
              </Card>
            </fieldset>
          </div>

          {/* Instructions sidebar */}
          <div className="space-y-6">
            <Card className="trading-card border border-blue-500/20">
              <CardHeader>
                <CardTitle className="text-white text-base">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="text-blue-200 space-y-3 text-sm">
                {[
                  "Select a payment network (e.g. USDT TRC20).",
                  "Copy the wallet address and send your crypto.",
                  "Upload a clear screenshot of the completed transfer.",
                  "Submit — admin will review and credit your balance.",
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p>{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="trading-card border border-yellow-500/20">
              <CardContent className="p-4 space-y-2 text-xs text-yellow-300">
                <p className="font-semibold text-yellow-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Important Notes</p>
                <p>• Only send the exact network shown (e.g. TRC20 ≠ BEP20).</p>
                <p>• Minimum deposit: <strong>${minDeposit}</strong></p>
                <p>• Deposits are reviewed within 1–24 hours.</p>
                <p>• Balance is credited after admin confirmation.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* History */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white">{t("wallet.depositHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory && <p className="text-slate-400 text-sm py-4">Loading history...</p>}
            {!loadingHistory && deposits.length === 0 && (
              <p className="text-slate-500 text-sm py-4">{t("wallet.noDeposits")}</p>
            )}
            <div className="space-y-3">
              {deposits.map((dep) => (
                <div key={dep.id} className="flex flex-col md:flex-row justify-between p-4 border border-slate-700 rounded-xl bg-slate-700/30 gap-4 hover:bg-slate-700/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-white font-bold text-lg">${Number(dep.amount).toFixed(2)}</p>
                    <p className="text-slate-400 text-sm">{new Date(dep.created_at).toLocaleString()}</p>
                    {dep.deposit_wallets && (
                      <p className="text-blue-300 text-xs">
                        {dep.deposit_wallets.asset} · {dep.deposit_wallets.address.slice(0, 20)}…
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-between gap-2">
                    <Badge className={
                      dep.status === "approved" || dep.status === "confirmed"
                        ? "bg-green-500/20 text-green-400 border-green-400"
                        : dep.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-400"
                          : "bg-red-500/20 text-red-400 border-red-400"
                    }>
                      {dep.status === "approved" || dep.status === "confirmed" ? "✅ Approved" :
                        dep.status === "pending" ? "⏳ Pending" : "❌ Rejected"}
                    </Badge>
                    {dep.proof_base64 && (
                      <button
                        onClick={() => setPreviewImg(dep.proof_base64!)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ZoomIn className="w-3.5 h-3.5" /> View Proof
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proof Lightbox */}
      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Deposit Proof</DialogTitle>
          </DialogHeader>
          {previewImg && (
            <img src={previewImg} alt="Deposit proof" className="w-full rounded-lg object-contain max-h-[70vh]" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
