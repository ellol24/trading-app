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
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner"; // مكتبة الإشعارات الحديثة

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // الإيداعات السابقة
  const [history, setHistory] = useState<Deposit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // تحميل المحافظ المتاحة
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("deposit_wallets")
        .select("id,address,asset");

      if (error) {
        console.error("load wallets error:", error);
        toast.error("❌ Failed to load wallets. Please refresh.");
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
      toast.info(`📸 Attached: ${file.name}`);
    }
  };

  // دالة قراءة الصورة وتحويلها إلى Base64
  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // تنفيذ عملية الإيداع
  const onCompletedPayment = async () => {
    if (!user?.id || !amount || Number(amount) <= 0 || !screenshot || !selected?.id) {
      toast.error("⚠️ Please fill all required fields correctly.");
      return;
    }

    setIsSubmitting(true);
    toast.loading("💸 Submitting your deposit... Please wait", { id: "deposit" });

    try {
      const proofBase64 = await readFileAsBase64(screenshot);

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

      const { error: insertError } = await supabase.from("deposits").insert(insertPayload);

      if (insertError) {
        console.error("insert deposit error:", insertError);
        toast.error("❌ Deposit failed! Please try again.", { id: "deposit" });
        return;
      }

      setAmount("");
      setScreenshot(null);

      toast.success("✅ Your deposit has been submitted successfully and is under review!", {
        id: "deposit",
      });

      loadHistory(); // تحديث السجل بعد العملية
    } catch (err) {
      console.error("submit deposit error:", err);
      toast.error("❌ Something went wrong while submitting deposit.", { id: "deposit" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // تحميل سجل الإيداعات السابقة
  async function loadHistory() {
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
      console.error("history error:", error);
      toast.error("❌ Failed to load deposit history.");
    } else {
      setHistory(data ?? []);
    }
    setLoadingHistory(false);
  }

  useEffect(() => {
    loadHistory();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24" translate="no">
      <div className="max-w-5xl mx-auto space-y-6" translate="no">
        {/* Header */}
        <div className="flex items-center justify-between" translate="no">
          <div>
            <h1 className="text-3xl font-bold text-white">Deposit</h1>
            <p className="text-blue-200 mt-1">
              Choose a wallet, send crypto, then upload proof
            </p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Secure
          </Badge>
        </div>

        {/* Deposit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" translate="no">
          <div className="lg:col-span-2 space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">Wallet & Amount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Select Wallet */}
                <div className="space-y-2">
                  <Label className="text-white">Select Wallet</Label>
                  <Select value={networkId} onValueChange={(v) => setNetworkId(v)}>
                    <SelectTrigger className="h-12 bg-background/50 border-border/50 text-white">
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

                {/* Platform Wallet */}
                <div className="space-y-2">
                  <Label className="text-white">Platform Wallet</Label>
                  <Input
                    readOnly
                    value={selected?.address ?? ""}
                    className="h-12 bg-background/50 border-border/50 text-white"
                  />
                </div>

                {/* Deposit Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-white">
                    Deposit Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 bg-background/50 border-border/50 text-white"
                    min={1}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Deposit Proof */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">Deposit Proof</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="file"
                  accept="image/*"
                  className="h-12 bg-background/50 border-border/50 text-white file:text-white"
                  onChange={(e) => onUploadChange(e.target.files?.[0] ?? null)}
                />

                {screenshot && (
                  <img
                    src={URL.createObjectURL(screenshot)}
                    alt="Proof preview"
                    className="w-full max-w-md rounded border border-border/30 mt-2"
                  />
                )}

                <Button
                  className="w-full h-12 text-base font-semibold professional-gradient flex items-center justify-center"
                  onClick={onCompletedPayment}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                  {isSubmitting ? "Submitting..." : "I completed payment"}
                </Button>
              </CardContent>
            </Card>

            {/* Deposit History */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white">My Deposit History</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistory && <p className="text-blue-200">Loading...</p>}
                {!loadingHistory && history.length === 0 && (
                  <p className="text-blue-200">No deposits yet.</p>
                )}
                <div className="space-y-4">
                  {history.map((dep) => (
                    <div
                      key={dep.id}
                      className="p-4 border border-border/30 rounded-md bg-background/30"
                    >
                      <p className="text-white">
                        <strong>Amount:</strong> {dep.amount}
                      </p>
                      <p className="text-white">
                        <strong>Date:</strong>{" "}
                        {new Date(dep.created_at).toLocaleString()}
                      </p>
                      <p className="text-white flex items-center gap-2">
                        <strong>Status:</strong>
                        <Badge
                          className={
                            dep.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : dep.status === "approved"
                              ? "bg-green-500/20 text-green-500"
                              : "bg-red-500/20 text-red-500"
                          }
                        >
                          {dep.status}
                        </Badge>
                      </p>
                      {dep.proof_base64 && (
                        <img
                          src={dep.proof_base64}
                          alt="Deposit Proof"
                          className="w-32 mt-2 rounded border border-border/30"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <div className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="text-blue-200 space-y-3 text-sm">
                <p>1. Select wallet (USDT, BTC, ETH, etc.).</p>
                <p>2. Send crypto to the platform wallet.</p>
                <p>3. Upload your deposit screenshot.</p>
                <p>4. Admin will review and confirm your deposit.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
