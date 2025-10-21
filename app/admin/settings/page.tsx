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

// نشاط إداري تجريبي فقط للعرض
const mockActivityLogs = [
  { id: 1, timestamp: "2024-07-30 10:30 AM", action: "Trading enabled by AdminUser1" },
  { id: 2, timestamp: "2024-07-29 03:15 PM", action: "Broadcast message updated by AdminUser2" },
  { id: 3, timestamp: "2024-07-28 09:00 AM", action: "Referral rates adjusted by AdminUser1" },
];

export default function AdminPlatformControlsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(getSettings());
  const [broadcastInput, setBroadcastInput] = useState(settings.broadcastMessage);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // ✅ مزامنة الإعدادات محليًا
  useEffect(() => {
    const unsub = subscribeSettings(() => setSettings(getSettings()));
    return () => unsub();
  }, []);

  // ✅ تحميل نسب الإحالة من قاعدة البيانات
  useEffect(() => {
    const fetchReferralRates = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("settings").select("*").single();

      if (error && error.code !== "PGRST116") {
        toast({
          title: "Error Loading Referral Rates",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setSettings((prev) => ({
          ...prev,
          referralLevel1Commission: data?.level1_commission ?? 5,
          referralLevel2Commission: data?.level2_commission ?? 2,
          referralLevel3Commission: data?.level3_commission ?? 1,
        }));
      }

      setLoading(false);
    };

    fetchReferralRates();
  }, []);

  // ✅ تحديث نسبة عمولة إحالة معينة في قاعدة البيانات
  const handleReferralChange = async (level: number, percentage: number) => {
    setLoading(true);

    const columnName =
      level === 1 ? "level1_commission" : level === 2 ? "level2_commission" : "level3_commission";

    const { error } = await supabase
      .from("settings")
      .upsert({ id: 1, [columnName]: percentage }, { onConflict: "id" });

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
        title: "Referral Commission Updated",
        description: `Level ${level} commission set to ${percentage.toFixed(2)}%.`,
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
      description: `${String(key).replace(/([A-Z])/g, " $1").toLowerCase()} updated.`,
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
    if (!window.confirm("Are you sure you want to force logout all users?")) return;
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

      {/* 💸 Referral Commission Levels */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Referral Profit Commission</CardTitle>
          <CardDescription>
            Define commission percentages for up to three referral levels.  
            These apply on users' **winning trade profits**.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {[1, 2, 3].map((level) => (
            <div key={level} className="grid gap-2 md:grid-cols-[220px_1fr] items-center">
              <Label htmlFor={`referral-l${level}`} className="flex items-center gap-2">
                <Percent className="w-4 h-4" /> Level {level} Profit Commission (%)
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

          <Alert className="mt-2 border-blue-500/30">
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              Commissions are applied only on **user trade profits** after winning rounds.  
              Updating these values affects future rounds only.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 🔧 Other Core Toggles */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Core Functionality Toggles</CardTitle>
          <CardDescription>Enable or disable main platform features.</CardDescription>
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
        </CardContent>
      </Card>

      {/* 📢 Broadcast Message */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Broadcast Message</CardTitle>
          <CardDescription>Send a message to all users.</CardDescription>
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

      {/* ⚠️ Critical Actions */}
      <Card className="bg-card/50 backdrop-blur-md border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Critical Actions</CardTitle>
          <CardDescription>Danger zone — use with caution.</CardDescription>
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
