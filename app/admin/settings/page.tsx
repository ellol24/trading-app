"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { saveAdminSettings } from "@/lib/actions/admin-settings";
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
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Percent, Package, Gift, Star } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

export default function AdminPlatformControlsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [commissions, setCommissions] = useState<Record<string, Record<number, number>>>({
    deposit: { 1: 0, 2: 0, 3: 0 },
    trade: { 1: 0, 2: 0, 3: 0 },
    package: { 1: 0, 2: 0, 3: 0 },
  });

  const [welcomeBonus, setWelcomeBonus] = useState({
    enabled: false,
    amount: 10,
  });

  // ✅ Load all rates and settings from DB
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);

      const [depositRes, tradeRes, packageRes, settingsRes] = await Promise.all([
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
        supabase
          .from("system_settings")
          .select("value")
          .eq("key", "welcome_bonus")
          .maybeSingle(),
      ]);

      if (depositRes.error || tradeRes.error || packageRes.error) {
        toast({
          title: "Error Loading Commissions",
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
        depositRes.data.forEach((r) => (newCommissions.deposit[r.level] = r.percentage));
        tradeRes.data.forEach((r) => (newCommissions.trade[r.level] = r.percentage));
        packageRes.data.forEach((r) => (newCommissions.package[r.level] = r.percentage));
        setCommissions((prev) => ({ ...prev, ...newCommissions }));
      }

      // Load Welcome Bonus Settings
      if (settingsRes.error) {
        console.error("Failed to load welcome bonus settings", settingsRes.error);
      } else if (settingsRes.data && settingsRes.data.value) {
        const value = settingsRes.data.value as any;
        setWelcomeBonus({
          enabled: Boolean(value.enabled),
          amount: Number(value.amount) || 0,
        });
      }

      setLoading(false);
    };

    fetchAllData();
  }, [toast]);

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

    // Wait until the secure server action processes the save bypassing RLS
    const result = await saveAdminSettings(depositRows, tradeRows, packageRows, welcomeBonus);

    if (!result.success) {
      toast({
        title: "Error Saving Settings",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "✅ Platform Settings Saved",
        description: "All commission rates and welcome bonus settings have been successfully updated.",
      });
    }

    setLoading(false);
  };

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
    <Card className="bg-card/50 backdrop-blur-md border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {[1, 2, 3].map((level) => (
          <div key={`${type}-${level}`} className="grid gap-2 md:grid-cols-[220px_1fr] items-center">
            <Label htmlFor={`${type}-${level}`} className="flex items-center gap-2 text-slate-300">
              <Icon className="w-4 h-4 text-blue-400" /> {t('admin.level') || "Level"} {level} (%)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${type}-${level}`}
                type="number"
                min={0}
                step="0.1"
                className="w-40 bg-slate-800 border-slate-700 text-white"
                value={commissions[type][level] ?? ""}
                onChange={(e) => handleInputChange(type, level, Number(e.target.value))}
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
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-slate-900 min-h-screen text-white">
      <div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 mb-2">
          {t('admin.platformSettingsTitle') || "Platform Controls & Settings"}
        </h1>
        <p className="text-slate-400">
          {t('admin.platformSettingsDesc') || "Manage welcome bonuses and multi-level referral commissions globally across your platform."}
        </p>
      </div>

      {/* 🌟 Referral Milestone Rewards Quick Card */}
      <Card className="bg-amber-950/20 backdrop-blur-md border-amber-500/30 shadow-lg shadow-amber-500/10">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              {t('admin.referralMilestonesTitle') || "Referral Milestone Rewards"}
            </CardTitle>
            <CardDescription className="text-amber-200/80 text-xs mt-1">
              {t('admin.referralMilestonesSubtitle') || "Configure automatic cash rewards unlocked when users reach active referral goals."}
            </CardDescription>
          </div>
          <Link href="/admin/referrals">
            <Button className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-bold text-xs shrink-0">
              <Star className="w-4 h-4 mr-1.5" />
              {t('admin.manageMilestonesBtn') || "Manage Milestone Tiers →"}
            </Button>
          </Link>
        </CardHeader>
      </Card>

      {/* 🎁 Welcome Bonus Section */}
      <Card className="bg-indigo-950/30 backdrop-blur-md border-indigo-500/30 shadow-lg shadow-indigo-500/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-indigo-400" /> 
            {t('admin.welcomeBonusTitle') || "Welcome Registration Bonus"}
          </CardTitle>
          <CardDescription className="text-indigo-200">
            {t('admin.welcomeBonusDesc') || "Define a reward amount that is instantly credited to a new user's balance upon completing registration."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[220px_1fr] items-center">
          <div className="space-y-4">
            <Label className="flex items-center justify-between text-slate-300">
              <span className="font-semibold text-lg">{t('admin.enableBonus') || "Enable Bonus"}</span>
              <Switch 
                checked={welcomeBonus.enabled}
                onCheckedChange={(checked) => setWelcomeBonus(prev => ({ ...prev, enabled: checked }))}
                disabled={loading}
                className="data-[state=checked]:bg-indigo-500"
              />
            </Label>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label className="text-slate-300">{t('admin.rewardAmount') || "Reward Amount ($)"}</Label>
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold">$</span>
              <Input
                type="number"
                min={0}
                step="1"
                className="bg-slate-800 border-slate-700 text-white text-lg font-bold placeholder:font-normal"
                value={welcomeBonus.amount}
                onChange={(e) => setWelcomeBonus(prev => ({ ...prev, amount: Number(e.target.value) }))}
                disabled={loading || !welcomeBonus.enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 💰 Deposit Commission */}
      <CommissionSection
        type="deposit"
        title={t('admin.depositCommissions') || "Deposit Referral Commissions"}
        description={t('admin.depositCommissionsDesc') || "Set referral commission rates for deposits at each level."}
        icon={Percent}
      />

      {/* 📈 Trade Profit Commission */}
      <CommissionSection
        type="trade"
        title={t('admin.tradeCommissions') || "Trading Profit Referral Commissions"}
        description={t('admin.tradeCommissionsDesc') || "Define commission percentages from users’ trading profits."}
        icon={Percent}
      />

      {/* 💼 Package Commission */}
      <CommissionSection
        type="package"
        title={t('admin.packageCommissions') || "Package Referral Commissions"}
        description={t('admin.packageCommissionsDesc') || "Define commission rates for referral earnings from investment packages."}
        icon={Package}
      />

      {/* 💾 Save Button */}
      <div className="flex justify-end sticky bottom-6 z-10">
        <ProfessionalButton
          onClick={handleSaveAll}
          loading={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 text-lg shadow-xl shadow-blue-600/20"
        >
          💾 {t('admin.saveSettingsBtn') || "Save Platform Settings"}
        </ProfessionalButton>
      </div>

      <Alert className="bg-slate-800/80 border-slate-700 mt-4 text-slate-400">
        <AlertTitle className="text-slate-300 font-semibold">Note</AlertTitle>
        <AlertDescription>
          All settings (Welcome Bonus and multi-level Commissions) are saved together using the master save button above.
        </AlertDescription>
      </Alert>
    </div>
  );
}
