// app/dashboard/profile/profile-client.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/contexts/language-context";
import {
  Mail, CheckCircle, LogOut, User, Shield, Bell,
  Activity, Edit, Save, X, Eye, EyeOff,
  ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertCircle,
} from "lucide-react";

interface ProfileClientProps {
  user: any | null;
  profile?: any | null;
  preferences?: any | null;
}

export default function ProfileClient({ user, profile, preferences }: ProfileClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();

  // UI states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Activity state
  const [activityDeposits, setActivityDeposits] = useState<any[]>([]);
  const [activityWithdrawals, setActivityWithdrawals] = useState<any[]>([]);
  const [activityTrades, setActivityTrades] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>(profile?.kyc_status ?? "not_verified");
  const [balance, setBalance] = useState<number>(profile?.balance || 0);

  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    address: "",
    zipCode: "",
  });

  // Preferences state (explicit type to allow risk_tolerance)
  const [prefs, setPrefs] = useState<{
    notifications_enabled: boolean;
    email_notifications: boolean;
    sms_notifications: boolean;
    trading_notifications: boolean;
    two_factor_enabled: boolean;
    auto_invest_enabled: boolean;
    risk_tolerance: string;
  }>({
    notifications_enabled: true,
    email_notifications: true,
    sms_notifications: false,
    trading_notifications: true,
    two_factor_enabled: false,
    auto_invest_enabled: false,
    risk_tolerance: "medium",
  });

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Populate state from props or fetch from DB
  useEffect(() => {
    const loadIfMissing = async () => {
      if (!user) return;

      let profileRow = profile ?? null;
      if (!profileRow) {
        const { data } = await supabase.from("user_profiles").select("*").eq("uid", user.id).single();
        if (data) profileRow = data;
      }

      let prefsRow = preferences ?? null;
      if (!prefsRow) {
        const { data } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).single();
        if (data) prefsRow = data;
      }

      setProfileData({
        firstName: profileRow?.first_name ?? (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).split(" ")[0] : ""),
        lastName: profileRow?.last_name ?? (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).split(" ")[1] : ""),
        email: user?.email ?? "",
        phone: profileRow?.phone ?? "",
        country: profileRow?.country ?? "",
        city: profileRow?.city ?? "",
        address: profileRow?.address ?? "",
        zipCode: profileRow?.zip_code ?? "",
      });

      if (prefsRow) {
        setPrefs({
          notifications_enabled: prefsRow.notifications_enabled ?? true,
          email_notifications: prefsRow.email_notifications ?? true,
          sms_notifications: prefsRow.sms_notifications ?? false,
          trading_notifications: prefsRow.trading_notifications ?? true,
          two_factor_enabled: prefsRow.two_factor_enabled ?? false,
          auto_invest_enabled: prefsRow.auto_invest_enabled ?? false,
          risk_tolerance: prefsRow.risk_tolerance ?? "medium",
        });
      }
    };
    loadIfMissing();
  }, [user]);

  // Fetch activity (deposits, withdrawals, trades, balance, kyc)
  const fetchActivity = useCallback(async () => {
    if (!user) return;
    setActivityLoading(true);
    try {
      const [depRes, wdRes, tradeRes, profRes] = await Promise.all([
        supabase.from("deposits").select("id, amount, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
        supabase.from("withdrawals").select("id, amount, status, created_at, net_amount").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
        supabase.from("trades").select("id, asset, type, amount, result, profit_loss, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
        supabase.from("user_profiles").select("balance, kyc_status").eq("uid", user.id).single(),
      ]);
      if (depRes.data) setActivityDeposits(depRes.data);
      if (wdRes.data) setActivityWithdrawals(wdRes.data);
      if (tradeRes.data) setActivityTrades(tradeRes.data);
      if (profRes.data) {
        setBalance(Number(profRes.data.balance) || 0);
        setKycStatus(profRes.data.kyc_status || "not_verified");
      }
    } finally {
      setActivityLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Real-time: listen for balance/kyc changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`profile-realtime-${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `uid=eq.${user.id}` },
        (payload) => {
          if (payload.new?.balance !== undefined) setBalance(Number(payload.new.balance));
          if (payload.new?.kyc_status !== undefined) setKycStatus(payload.new.kyc_status);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSave = async () => {
    if (!user) return;
    if (!isValidEmail(profileData.email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        phone: profileData.phone,
        country: profileData.country,
        city: profileData.city,
        address: profileData.address,
        zip_code: profileData.zipCode,
      };
      const { error } = await supabase.from("user_profiles").update(payload).eq("uid", user.id);
      if (error) {
        const alt = await supabase.from("user_profiles").update(payload).eq("user_id", user.id);
        if (alt.error) throw alt.error;
      }
      toast({ title: "Profile Updated", description: "Your profile information has been saved successfully." });
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Could not save profile.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // FIXED: was using empty string "" as table name — now correctly uses "user_preferences"
  const updatePreference = async (key: string, value: any) => {
    if (!user) return;
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      const upsertPayload: any = { user_id: user.id, updated_at: new Date().toISOString(), [key]: value };
      const { error } = await supabase.from("user_preferences").upsert(upsertPayload, { onConflict: "user_id" });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Preferences error", description: err?.message || "Could not update preferences.", variant: "destructive" });
      setPrefs((p) => ({ ...p, [key]: !value }));
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      toast({ title: "Missing field", description: "Please enter a new password.", variant: "destructive" });
      return;
    }
    setIsPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Password error", description: err?.message || "Failed to change password.", variant: "destructive" });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleStartKYC = () => router.push("/dashboard/kyc/start");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/auth/login");
    } catch (err: any) {
      toast({ title: "Logout failed", description: err?.message || "Could not sign out.", variant: "destructive" });
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
        <p className="text-white">{t('auth.login')}</p>
      </div>
    );
  }

  const prefLabels: Record<string, string> = {
    notifications_enabled: "All Notifications",
    email_notifications: "Email Notifications",
    sms_notifications: "SMS Notifications",
    trading_notifications: "Trading Alerts",
    two_factor_enabled: "Two-Factor Authentication",
    auto_invest_enabled: "Auto Invest",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24" data-react-protected>
      <div className="max-w-6xl mx-auto space-y-6" translate="no" data-react-protected>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0" translate="no">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">
                {(profileData.firstName?.charAt(0) || "") + (profileData.lastName?.charAt(0) || "")}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{profileData.firstName} {profileData.lastName}</h1>
              <p className="text-blue-200 flex items-center"><Mail className="w-4 h-4 mr-2" />{profileData.email}</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {user?.email_confirmed_at ? t('profile.verifiedAccount') : t('profile.unverifiedAccount')}
                </Badge>
                <Badge variant="outline" className="text-blue-400 border-blue-400 bg-blue-400/10">
                  {t("profile.balance")}: ${balance.toFixed(2)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <LanguageSwitcher />
            <Button
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-600/10 bg-transparent"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isLoggingOut ? t('common.loading') : t('auth.logout')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" translate="no">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="trading-card" translate="no" data-react-protected>
              <CardHeader>
                <CardTitle className="text-white text-lg">{t('profile.accountOverview')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("profile.balance")}</span>
                  <span className="text-white font-bold">${balance.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('common.status')}</span>
                  <Badge className="bg-green-600 text-white">{profile?.status || t("common.status_active")}</Badge>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="flex justify-between w-full bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 p-2 rounded-xl shadow-inner" translate="no">
                <TabsTrigger value="profile" className="flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg">
                  <User className="w-4 h-4" /> {t('profile.profile')}
                </TabsTrigger>
                <TabsTrigger value="security" className="flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg">
                  <Shield className="w-4 h-4" /> {t('profile.security')}
                </TabsTrigger>

                <TabsTrigger value="activity" className="flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg">
                  <Activity className="w-4 h-4" /> {t("profile.activity")}
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" translate="no">
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center"><User className="w-5 h-5 mr-2" />{t('profile.personalInformation')}</CardTitle>
                    <div>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} className="mr-2 border-slate-600 text-slate-300 bg-transparent">
                        {isEditing ? <><X className="w-4 h-4 mr-2" />{t('common.cancel')}</> : <><Edit className="w-4 h-4 mr-2" />{t('profile.editProfile')}</>}
                      </Button>
                      {isEditing && (
                        <Button onClick={handleSave} size="sm" disabled={isSaving} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                          <Save className="w-4 h-4 mr-2" />{isSaving ? t('common.saving') : t('profile.saveChanges')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { id: "firstName", label: t('auth.firstName'), key: "firstName" },
                        { id: "lastName", label: t('auth.lastName'), key: "lastName" },
                        { id: "phone", label: t('auth.phone'), key: "phone" },
                        { id: "country", label: t('auth.country'), key: "country" },
                        { id: "city", label: t('profile.city'), key: "city" },
                      ].map(({ id, label, key }) => (
                        <div key={id} className="space-y-2">
                          <Label htmlFor={id} className="text-slate-300">{label}</Label>
                          <Input
                            id={id}
                            value={(profileData as any)[key]}
                            onChange={(e) => setProfileData({ ...profileData, [key]: e.target.value })}
                            disabled={!isEditing}
                            className="bg-slate-800/50 border-slate-600 text-white"
                          />
                        </div>
                      ))}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-300">{t('auth.email')}</Label>
                        <Input id="email" type="email" value={profileData.email} disabled className="bg-slate-800/50 border-slate-600 text-white opacity-60" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="address" className="text-slate-300">{t('common.address')}</Label>
                        <Input id="address" value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode" className="text-slate-300">{t('profile.zipCode')}</Label>
                        <Input id="zipCode" value={profileData.zipCode} onChange={(e) => setProfileData({ ...profileData, zipCode: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" translate="no">
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center"><Shield className="w-5 h-5 mr-2" />{t('profile.security')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-white font-medium">{t('profile.changePassword')}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword" className="text-slate-300">{t('profile.currentPassword')}</Label>
                          <div className="relative">
                            <Input id="currentPassword" type={showPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-slate-800/50 border-slate-600 text-white pr-10" />
                            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newPassword" className="text-slate-300">{t('profile.newPassword')}</Label>
                          <div className="relative">
                            <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-slate-800/50 border-slate-600 text-white pr-10" />
                            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2" onClick={() => setShowNewPassword(!showNewPassword)}>
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white" onClick={handleChangePassword} disabled={isPasswordSaving}>
                          {isPasswordSaving ? t('common.updating') : t('profile.updatePassword')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>



              {/* Activity Tab */}
              <TabsContent value="activity" translate="no">
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center"><Activity className="w-5 h-5 mr-2" />{t("profile.activity")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activityLoading ? (
                      <p className="text-muted-foreground text-sm text-center py-6">{t("common.loading")}</p>
                    ) : (
                      <>
                        {activityDeposits.map((d) => (
                          <div key={`dep-${d.id}`} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-green-600/20 rounded-full flex items-center justify-center shrink-0">
                                <ArrowDownCircle className="w-4 h-4 text-green-400" />
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">{t("wallet.deposit")}</p>
                                <p className="text-slate-400 text-xs">{new Date(d.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-green-400 font-semibold">+${Number(d.amount).toFixed(2)}</p>
                              <Badge className={`text-xs ${d.status === "approved" || d.status === "confirmed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{d.status}</Badge>
                            </div>
                          </div>
                        ))}

                        {activityWithdrawals.map((w) => (
                          <div key={`wd-${w.id}`} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-red-600/20 rounded-full flex items-center justify-center shrink-0">
                                <ArrowUpCircle className="w-4 h-4 text-red-400" />
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">{t("wallet.withdraw")}</p>
                                <p className="text-slate-400 text-xs">{new Date(w.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-red-400 font-semibold">-${Number(w.amount).toFixed(2)}</p>
                              <Badge className={`text-xs ${w.status === "paid" || w.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{w.status}</Badge>
                            </div>
                          </div>
                        ))}

                        {activityTrades.map((tr) => (
                          <div key={`tr-${tr.id}`} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-blue-600/20 rounded-full flex items-center justify-center shrink-0">
                                <TrendingUp className="w-4 h-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">{tr.asset} · {tr.type}</p>
                                <p className="text-slate-400 text-xs">{new Date(tr.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white text-sm">${tr.amount}</p>
                              <Badge className={`text-xs ${tr.result === "win" ? "bg-green-500/20 text-green-400" : tr.result === "lose" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"}`}>
                                {tr.result || t("common.pending")}
                              </Badge>
                            </div>
                          </div>
                        ))}

                        {activityDeposits.length === 0 && activityWithdrawals.length === 0 && activityTrades.length === 0 && (
                          <div className="text-center py-10 text-muted-foreground">
                            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No activity yet</p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
