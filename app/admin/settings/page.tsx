"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ProfessionalButton } from "@/components/ui/professional-button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, ShieldCheck, Gift, Percent } from "lucide-react";
import {
  getSettings,
  setBroadcastMessage,
  subscribeSettings,
  updateSetting,
  type PlatformSettings,
} from "@/lib/settings-store";

const mockActivityLogs = [
  { id: 1, timestamp: "2024-07-30 10:30 AM", action: "Trading enabled by AdminUser1" },
  { id: 2, timestamp: "2024-07-29 03:15 PM", action: "Broadcast message updated by AdminUser2" },
  { id: 3, timestamp: "2024-07-28 09:00 AM", action: "Maintenance mode activated by AdminUser1" },
];

export default function AdminPlatformControlsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(getSettings());
  const [broadcastInput, setBroadcastInput] = useState(settings.broadcastMessage);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // ✅ مزامنة الإعدادات بين علامات التبويب
  useEffect(() => {
    const unsub = subscribeSettings(() => setSettings(getSettings()));
    return () => unsub();
  }, []);

  // ✅ تحميل نسب الإحالات (الإيداع + أرباح التداول)
  useEffect(() => {
    const fetchReferralRates = async () => {
      setLoading(true);

      // جلب نسب إحالات الإيداع
      const { data: depositRates, error: depErr } = await supabase
        .from("referral_commission_rates")
        .select("level, percentage")
        .order("level", { ascending: true });

      // جلب نسب إحالات أرباح التداول
      const { data: tradeRates, error: tradeErr } = await supabase
        .from("trade_profit_commission_rates")
        .select("level, percentage")
        .order("level", { ascending: true });

      if (depErr || tradeErr) {
        toast({
          title: "Error Loading Referral Rates",
          description: depErr?.message || tradeErr?.message,
          variant: "destructive",
        });
      } else {
        const next = { ...settings };
        depositRates?.forEach((row) => {
          next[`referralLevel${row.level}Commission`] = Number(row.percentage);
        });
        tradeRates?.forEach((row) => {
          next[`tradeReferralLevel${row.level}Commission`] = Number(row.percentage);
        });
        setSettings(next);
      }

      setLoading(false);
    };

    fetchReferralRates();
  }, []);

  // ✅ تحديث نسبة إحالة الإيداع
  const handleReferralChange = async (level: number, percentage: number) => {
    setLoading(true);
    const { error } = await supabase.from("referral_commission_rates").upsert({ level, percentage });
    if (error) {
      toast({
        title: "Error Updating Referral Rate",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const next = { ...settings, [`referralLevel${level}Commission`]: percentage };
      setSettings(next);
      toast({
        title: "Referral Rate Updated",
        description: `Level ${level} deposit commission set to ${percentage.toFixed(2)}%.`,
      });
    }
    setLoading(false);
  };

  // ✅ تحديث نسبة إحالة أرباح التداول
  const handleTradeReferralChange = async (level: number, percentage: number) => {
    setLoading(true);
    const { error } = await supabase.from("trade_profit_commission_rates").upsert({ level, percentage });
    if (error) {
      toast({
        title: "Error Updating Trade Profit Commission",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const next = { ...settings, [`tradeReferralLevel${level}Commission`]: percentage };
      setSettings(next);
      toast({
        title: "Trade Profit Commission Updated",
        description: `Level ${level} trading profit commission set to ${percentage.toFixed(2)}%.`,
      });
    }
    setLoading(false);
  };

  // ✅ تحديث الإعدادات الأخرى
  const handleSettingChange = async (key: keyof PlatformSettings, value: PlatformSettings[typeof key]) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 200));
    const next = updateSetting(key, value as any);
    setSettings(next);
    toast({
      title: "Setting Updated",
      description: `${String(key)
        .replace(/([A-Z])/g, " $1")
        .toLowerCase()} has been ${typeof value === "boolean" ? (value ? "enabled" : "disabled") : "updated"}.`,
    });
    setLoading(false);
  };

  // ✅ إرسال رسالة البث
  const handleBroadcastMessage = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    setBroadcastMessage(broadcastInput);
    toast({ title: "Message Broadcasted", description: "Your message has been sent to all users." });
    setLoading(false);
  };

  // ✅ تسجيل الخروج الإجباري
  const handleForceLogout = async () => {
    if (!window.confirm("Are you sure you want to force logout all users? This action cannot be undone.")) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    toast({
      title: "All Users Logged Out",
      description: "All active user sessions have been terminated.",
      variant: "destructive",
    });
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Controls</h1>
      </div>

      {/* 🔧 Core Toggles */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Core Functionality Toggles</CardTitle>
          <CardDescription>Enable or disable key features across the entire platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {[
            ["Trading Enabled", "tradingEnabled"],
            ["Withdrawals Enabled", "withdrawalsEnabled"],
            ["Deposits Enabled", "depositsEnabled"],
            ["User Registrations Enabled", "registrationsEnabled"],
          ].map(([label, key]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={settings[key as keyof PlatformSettings] as boolean}
                onCheckedChange={(v) => handleSettingChange(key as keyof PlatformSettings, v)}
                disabled={loading}
              />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Label htmlFor="maintenance-toggle">Maintenance Mode</Label>
            <Switch
              id="maintenance-toggle"
              checked={settings.maintenanceMode}
              onCheckedChange={(v) => handleSettingChange("maintenanceMode", v)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="kyc-toggle" className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> KYC Required
            </Label>
            <Switch
              id="kyc-toggle"
              checked={settings.kycRequired}
              onCheckedChange={(v) => handleSettingChange("kycRequired", v)}
              disabled={loading}
            />
          </div>

          {settings.maintenanceMode && (
            <Alert className="mt-2">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Heads up!</AlertTitle>
              <AlertDescription>
                When maintenance mode is active, only administrators can access the platform.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 🎁 Welcome Bonus */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Welcome Bonus</CardTitle>
          <CardDescription>
            Automatically credit new users with a configurable welcome balance on account creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="welcome-bonus-toggle" className="flex items-center gap-2">
              <Gift className="w-4 h-4" /> Enable Welcome Bonus
            </Label>
            <Switch
              id="welcome-bonus-toggle"
              checked={settings.welcomeBonusEnabled}
              onCheckedChange={(v) => handleSettingChange("welcomeBonusEnabled", v)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-[220px_1fr] items-center">
            <Label htmlFor="welcome-bonus-amount">Welcome Amount</Label>
            <div className="flex items-center gap-2">
              <Input
                id="welcome-bonus-amount"
                type="number"
                min={0}
                step="1"
                className="w-40"
                value={Number.isFinite(settings.welcomeBonusAmount) ? settings.welcomeBonusAmount : 0}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  handleSettingChange("welcomeBonusAmount", Number.isFinite(n) ? n : 0);
                }}
                disabled={loading || !settings.welcomeBonusEnabled}
              />
              <span className="text-sm text-muted-foreground">Units: account currency</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 💸 Referral Commission Levels (Deposits) */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Referral Commission Levels (Deposits)</CardTitle>
          <CardDescription>Define commission percentages for deposit referrals.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {[1, 2, 3].map((level) => (
            <div key={level} className="grid gap-2 md:grid-cols-[220px_1fr] items-center">
              <Label htmlFor={`referral-l${level}`} className="flex items-center gap-2">
                <Percent className="w-4 h-4" /> Level {level} Deposit Commission (%)
              </Label>
              <Input
                id={`referral-l${level}`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                className="w-40"
                value={settings[`referralLevel${level}Commission`] ?? ""}
                onChange={(e) => handleReferralChange(level, Number(e.target.value))}
                disabled={loading}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 💹 Trading Profit Referral Commissions */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Trading Profit Referral Levels</CardTitle>
          <CardDescription>Set commission rates for referral earnings from users' trading profits.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {[1, 2, 3].map((level) => (
            <div key={level} className="grid gap-2 md:grid-cols-[220px_1fr] items-center">
              <Label htmlFor={`trade-referral-l${level}`} className="flex items-center gap-2">
                <Percent className="w-4 h-4" /> Level {level} Trade Profit Commission (%)
              </Label>
              <Input
                id={`trade-referral-l${level}`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                className="w-40"
                value={settings[`tradeReferralLevel${level}Commission`] ?? ""}
                onChange={(e) => handleTradeReferralChange(level, Number(e.target.value))}
                disabled={loading}
              />
            </div>
          ))}

          <Alert className="mt-2">
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              These commissions apply only on users’ trading profits and are separate from deposit referral earnings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 📢 Broadcast Message */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Broadcast Message</CardTitle>
          <CardDescription>Send a global announcement message to all users.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Textarea
            placeholder="Type your message here..."
            value={broadcastInput}
            onChange={(e) => setBroadcastInput(e.target.value)}
            rows={4}
            className="bg-background/50"
          />
          <ProfessionalButton
            onClick={handleBroadcastMessage}
            loading={loading}
            disabled={broadcastInput.trim() === ""}
          >
            Broadcast Message
          </ProfessionalButton>
        </CardContent>
      </Card>

      {/* 🧾 Admin Logs */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Admin Activity Logs</CardTitle>
          <CardDescription>Recent administrative actions on the platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {mockActivityLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{log.timestamp}</span>
              <span>{log.action}</span>
            </div>
          ))}
          <ProfessionalButton variant="ghost" className="mt-2 w-fit">
            View Full Logs (Coming Soon)
          </ProfessionalButton>
        </CardContent>
      </Card>

      {/* ⚠️ Critical Actions */}
      <Card className="bg-card/50 backdrop-blur-md border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Critical Actions</CardTitle>
          <CardDescription>Actions that have significant impact on the platform. Use with caution.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfessionalButton variant="destructive" onClick={handleForceLogout} loading={loading}>
            Force Logout All Users
          </ProfessionalButton>
        </CardContent>
      </Card>
    </div>
  );
}
