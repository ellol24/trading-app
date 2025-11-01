"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ProfessionalButton } from "@/components/ui/professional-button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Percent, Package } from "lucide-react";

export default function AdminPlatformControlsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [commissions, setCommissions] = useState({
    deposit: { 1: 0, 2: 0, 3: 0 },
    trade: { 1: 0, 2: 0, 3: 0 },
    package: { 1: 0, 2: 0, 3: 0 },
  });

  // ✅ تحميل النسب الحالية من قاعدة البيانات
  useEffect(() => {
    const fetchAllRates = async () => {
      setLoading(true);

      const [depositRes, tradeRes, packageRes] = await Promise.all([
        supabase
          .from("referral_commission_rates")
          .select("level, percentage")
          .order("level"),
        supabase
          .from("trade_profit_commission_rates")
          .select("level, percentage")
          .order("level"),
        supabase
          .from("package_referral_commission_rates")
          .select("level, percentage")
          .order("level"),
      ]);

      if (depositRes.error || tradeRes.error || packageRes.error) {
        toast({
          title: "Error Loading Data",
          description:
            depositRes.error?.message ||
            tradeRes.error?.message ||
            packageRes.error?.message,
          variant: "destructive",
        });
      } else {
        const newCommissions = {
          deposit: {},
          trade: {},
          package: {},
        } as any;
        depositRes.data.forEach(
          (r) => (newCommissions.deposit[r.level] = r.percentage)
        );
        tradeRes.data.forEach(
          (r) => (newCommissions.trade[r.level] = r.percentage)
        );
        packageRes.data.forEach(
          (r) => (newCommissions.package[r.level] = r.percentage)
        );
        setCommissions((prev) => ({ ...prev, ...newCommissions }));
      }

      setLoading(false);
    };

    fetchAllRates();
  }, [toast]);

  // ✅ تحديث القيم محليًا عند الكتابة
  const handleInputChange = (
    type: "deposit" | "trade" | "package",
    level: number,
    value: number
  ) => {
    setCommissions((prev) => ({
      ...prev,
      [type]: { ...prev[type], [level]: value },
    }));
  };

  // ✅ حفظ كل النسب دفعة واحدة
  const handleSaveAll = async () => {
    setLoading(true);

    const depositRows = [1, 2, 3].map((l) => ({
      level: l,
      percentage: commissions.deposit[l] ?? 0,
    }));
    const tradeRows = [1, 2, 3].map((l) => ({
      level: l,
      percentage: commissions.trade[l] ?? 0,
    }));
    const packageRows = [1, 2, 3].map((l) => ({
      level: l,
      percentage: commissions.package[l] ?? 0,
    }));

    const { error: depErr } = await supabase
      .from("referral_commission_rates")
      .upsert(depositRows);
    const { error: tradeErr } = await supabase
      .from("trade_profit_commission_rates")
      .upsert(tradeRows);
    const { error: pkgErr } = await supabase
      .from("package_referral_commission_rates")
      .upsert(packageRows);

    if (depErr || tradeErr || pkgErr) {
      toast({
        title: "Error Saving Commissions",
        description:
          depErr?.message || tradeErr?.message || pkgErr?.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "✅ All Commissions Saved Successfully",
        description:
          "Deposit, Trade, and Package referral percentages updated successfully.",
      });
    }

    setLoading(false);
  };

  // ✅ مكون لإظهار مدخلات النسب بشكل موحد
  const CommissionSection = ({
    type,
    title,
    description,
    icon: Icon,
  }: {
    type: "deposit" | "trade" | "package";
    title: string;
    description: string;
    icon: any;
  }) => (
    <Card className="bg-card/50 backdrop-blur-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {[1, 2, 3].map((level) => (
          <div
            key={`${type}-${level}`}
            className="grid gap-2 md:grid-cols-[220px_1fr] items-center"
          >
            <Label
              htmlFor={`${type}-${level}`}
              className="flex items-center gap-2"
            >
              <Icon className="w-4 h-4" /> Level {level} (%)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${type}-${level}`}
                type="number"
                min={0}
                step="0.1"
                className="w-40"
                value={commissions[type][level] ?? ""}
                onChange={(e) =>
                  handleInputChange(type, level, Number(e.target.value))
                }
                disabled={loading}
              />
              <span className="text-gray-400">%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Referral Commission Settings</h1>

      {/* 💰 قسم الإيداع */}
      <CommissionSection
        type="deposit"
        title="Deposit Referral Commissions"
        description="Set referral commission rates for deposits at each level."
        icon={Percent}
      />

      {/* 📈 قسم التداول */}
      <CommissionSection
        type="trade"
        title="Trading Profit Referral Commissions"
        description="Define commission percentages from users’ trading profits."
        icon={Percent}
      />

      {/* 💼 قسم الباقات */}
      <CommissionSection
        type="package"
        title="Package Referral Commissions"
        description="Define commission rates for referral earnings from investment packages."
        icon={Package}
      />

      {/* 💾 زر الحفظ */}
      <div className="flex justify-end">
        <ProfessionalButton
          onClick={handleSaveAll}
          loading={loading}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          💾 Save All Commissions
        </ProfessionalButton>
      </div>

      <Alert className="mt-4">
        <AlertTitle>Note</AlertTitle>
        <AlertDescription>
          All commission rates for Deposits, Trading Profits, and Packages will
          be saved together with this button.
        </AlertDescription>
      </Alert>
    </div>
  );
}
