"use client";

import { useEffect, useState } from "react";
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

const SUPPORTED_COINS = [
  { code: "usdttrc20", name: "USDT (TRC20)" },
  { code: "usdtbsc", name: "USDT (BEP20)" },
];

export default function DepositClient({ user }: any) {
  const [coin, setCoin] = useState("usdttrc20");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [networkFee, setNetworkFee] = useState<number>(0);
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

  // تحميل سجل الإيداعات
  const loadDeposits = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("deposits")
      .select("id, amount, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setDeposits(data || []);
    setLoadingHistory(false);
  };

  useEffect(() => {
    loadDeposits();
  }, [user?.id]);

  // إنشاء عملية إيداع
  const createPayment = async () => {
    if (!isEnabled) {
      toast.error(`🚫 ${t('wallet.depositsDisabled')}`);
      return;
    }
    if (!amount || Number(amount) < minDeposit) {
      toast.warning(`⚠️ ${t('wallet.minDeposit').replace('${min}', String(minDeposit))}`);
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/contact/payment-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          currency: coin,
          user_id: user.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.invoice_url) {
        toast.success(t('wallet.redirectingPayment'));
        window.location.href = data.invoice_url;
      } else toast.error(data.error || t('wallet.createPaymentFailed'));
    } catch (err) {
      toast.error(t('wallet.paymentCreationFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (amount) setNetworkFee(Number(amount) * 0.001);
  }, [amount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('wallet.depositTitle')}</h1>
            <p className="text-blue-200 mt-1">
              {t('wallet.depositSubtitle')}
            </p>
          </div>
          <Badge
            variant="outline"
            className="text-green-400 border-green-400 bg-green-400/10"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> {t('wallet.auto')}
          </Badge>
        </div>

        {/* تنبيه في حالة الإيقاف */}
        {!isEnabled && (
          <div className="bg-red-600/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center space-x-3">
            <AlertCircle className="w-5 h-5" />
            <p>{t('wallet.depositsDisabled')}</p>
          </div>
        )}

        {/* Form */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">{t('wallet.depositInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-white">{t('wallet.selectCurrency')}</Label>
              <Select value={coin} onValueChange={setCoin}>
                <SelectTrigger className="h-12 bg-slate-700 text-white border-slate-600">
                  <SelectValue placeholder={t('wallet.chooseCoin')} />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COINS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {amount && (
                <p className="text-blue-300 text-sm">
                  {t('wallet.networkFee')
                    .replace('${fee}', networkFee.toFixed(2))
                    .replace('${total}', (Number(amount) - networkFee).toFixed(2))}
                </p>
              )}
            </div>

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
                t('wallet.depositNow')
              )}
            </Button>
          </CardContent>
        </Card>

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
                  className="flex justify-between p-3 border border-slate-700 rounded-lg bg-slate-700/30"
                >
                  <div>
                    <p className="text-white font-semibold">
                      ${Number(dep.amount).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-400">
                      {new Date(dep.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    className={
                      dep.status === "approved"
                        ? "bg-green-500/20 text-green-400"
                        : dep.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                    }
                  >
                    {dep.status === "approved" ? t('wallet.statusApproved') :
                      dep.status === "pending" ? t('common.pending') :
                        t('wallet.statusRejected')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
