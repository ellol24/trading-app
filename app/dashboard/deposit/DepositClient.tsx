"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

import { useLanguage } from "@/contexts/language-context";

type Network = {
  id: string;
  address: string;
  asset?: string | null;
};

type Deposit = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  proof_base64?: string | null;
  deposit_wallets?: {
    asset: string;
    address: string;
  } | null;
};

export default function DepositClient({ user, profile }: any) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [networkId, setNetworkId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [minDeposit, setMinDeposit] = useState(10);
  const { t } = useLanguage();

  // تحميل الإعدادات من لوحة الإدمن
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("deposit_settings")
        .select("is_enabled, min_deposit_amount")
        .limit(1)
        .single();
      if (data) {
        setIsEnabled(data.is_enabled);
        setMinDeposit(Number(data.min_deposit_amount));
      }
    };
    fetchSettings();
  }, []);

  // تحميل المحافظ
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("deposit_wallets")
        .select("id,address,asset");

      if (error) {
        console.error("load wallets error:", error);
        toast.error("❌ Failed to load wallets");
        return;
      }

      const rows = data ?? [];
      setNetworks(rows);
      if (rows.length > 0) setNetworkId(rows[0].id);
    })();
  }, []);

  const selected = useMemo(
    () => networks.find((n) => n.id === networkId),
    [networkId, networks]
  );

  const onUploadChange = (file: File | null) => {
    setScreenshot(file);
    if (file) {
      toast.info(`📸 Screenshot attached`);
    }
  };

  // تحميل سجل الإيداعات
  const loadDeposits = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("deposits")
      .select(`
        id,
        amount,
        status,
        created_at,
        proof_base64,
        deposit_wallets (
          asset,
          address
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
      
    if (error) {
      console.error("History error:", error);
      toast.error("❌ Failed to load deposit history");
    } else {
      setDeposits(data as any ?? []);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    loadDeposits();
  }, [user?.id]);

  // إنشاء عملية إيداع يدوية
  const createPayment = async () => {
    if (!isEnabled) {
      toast.error(`🚫 ${t('wallet.depositsDisabled')}`);
      return;
    }
    if (!amount || Number(amount) < minDeposit) {
      toast.warning(`⚠️ ${t('wallet.minDeposit').replace('${min}', String(minDeposit))}`);
      return;
    }
    if (!screenshot) {
      toast.warning("⚠️ Please attach a screenshot of your transfer");
      return;
    }
    if (!selected?.id) {
      toast.warning("⚠️ Please select a wallet");
      return;
    }

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(screenshot);

      reader.onloadend = async () => {
        const proofBase64 = reader.result as string;

        const insertPayload = {
          user_id: user.id,
          uid: profile?.uid ?? null,
          username: profile?.full_name || user.email || null,
          email: user.email || null,
          network_id: selected.id,
          amount: Number(amount),
          status: "pending",
          proof_base64: proofBase64,
        };

        const { error: insertError } = await supabase
          .from("deposits")
          .insert(insertPayload);

        if (insertError) {
          console.error("insert deposit error:", insertError);
          toast.error("❌ Deposit failed!");
          setIsProcessing(false);
          return;
        }

        setAmount("");
        setScreenshot(null);
        toast.success("✅ Deposit submitted successfully!");
        loadDeposits();
        setIsProcessing(false);
      };
    } catch (err) {
      console.error("submit deposit error:", err);
      toast.error("❌ Something went wrong while submitting deposit");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('wallet.depositTitle')}</h1>
            <p className="text-blue-200 mt-1">
              Choose a wallet, send crypto, then upload proof
            </p>
          </div>
          <Badge
             variant="outline"
             className="text-green-400 border-green-400 bg-green-400/10"
           >
             <CheckCircle2 className="w-4 h-4 mr-2" />
             Secure
           </Badge>
        </div>

        {/* تنبيه في حالة الإيقاف */}
        {!isEnabled && (
          <div className="bg-red-600/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center space-x-3">
            <AlertCircle className="w-5 h-5" />
            <p>{t('wallet.depositsDisabled')}</p>
          </div>
        )}

        {/* Deposit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Wallet & Amount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-white">Select Wallet</Label>
                  <Select value={networkId} onValueChange={setNetworkId}>
                    <SelectTrigger className="h-12 bg-slate-700 text-white border-slate-600">
                      <SelectValue placeholder="Select wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {networks.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.asset ?? "Wallet"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Platform Wallet</Label>
                  <Input
                    readOnly
                    value={selected?.address ?? ""}
                    className="h-12 bg-slate-700 text-white border-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">
                    {t('wallet.depositAmountMin').replace('${min}', String(minDeposit))}
                  </Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t('wallet.minimum').replace('${min}', String(minDeposit))}
                    className="h-12 bg-slate-700 text-white border-slate-600"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
               <CardHeader>
                 <CardTitle className="text-white">Deposit Proof</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 <Input
                   type="file"
                   accept="image/*"
                   className="h-12 bg-slate-700 text-white border-slate-600 file:text-white"
                   onChange={(e) => onUploadChange(e.target.files?.[0] ?? null)}
                 />

                 {screenshot && (
                   <img
                     src={URL.createObjectURL(screenshot)}
                     alt="Proof preview"
                     className="w-full max-w-md rounded border border-slate-600 mt-2"
                   />
                 )}

                 <Button
                   onClick={createPayment}
                   className="w-full h-12 font-semibold text-lg bg-green-600 hover:bg-green-700"
                   disabled={isProcessing || !isEnabled}
                 >
                   {isProcessing ? (
                     <>
                       <Loader2 className="animate-spin h-5 w-5 mr-2" /> {t('wallet.processing')}
                     </>
                   ) : (
                     "I completed payment"
                   )}
                 </Button>
               </CardContent>
             </Card>
          </div>

          {/* Instructions */}
           <div className="space-y-6">
             <Card className="bg-slate-800/50 border-slate-700">
               <CardHeader>
                 <CardTitle className="text-white text-lg">How It Works</CardTitle>
               </CardHeader>
               <CardContent className="text-blue-200 space-y-3 text-sm">
                 <p>1. Select wallet (USDT(TRC20), USDT(BEP20) ...).</p>
                 <p>2. Send crypto to the platform wallet.</p>
                 <p>3. Upload your deposit screenshot.</p>
                 <p>4. Admin will review and confirm your deposit.</p>
               </CardContent>
             </Card>
           </div>
        </div>

        {/* History */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">{t('wallet.depositHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory && <p className="text-gray-300">{t('common.loading')}</p>}
            {!loadingHistory && deposits.length === 0 && (
              <p className="text-gray-400">{t('wallet.noDeposits')}</p>
            )}
            <div className="space-y-3">
              {deposits.map((dep) => (
                <div
                  key={dep.id}
                  className="flex flex-col md:flex-row justify-between p-4 border border-slate-700 rounded-lg bg-slate-700/30 gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-white font-semibold">
                      ${Number(dep.amount).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-400">
                      {new Date(dep.created_at).toLocaleString()}
                    </p>
                    {dep.deposit_wallets && (
                       <p className="text-blue-300 text-sm mt-1">
                         Wallet: {dep.deposit_wallets.asset} &mdash;{" "}
                         <span className="break-all">{dep.deposit_wallets.address}</span>
                       </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <Badge
                      className={
                        dep.status === "approved" || dep.status === "confirmed"
                          ? "bg-green-500/20 text-green-400"
                          : dep.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                      }
                    >
                      {dep.status === "approved" || dep.status === "confirmed" ? t('wallet.statusApproved') :
                        dep.status === "pending" ? t('common.pending') :
                          t('wallet.statusRejected')}
                    </Badge>
                    
                    {dep.proof_base64 && (
                       <img
                         src={dep.proof_base64}
                         alt="Deposit Proof"
                         className="w-24 mt-3 rounded border border-slate-600"
                       />
                     )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
