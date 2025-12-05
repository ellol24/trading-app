// app/dashboard/profile/profile-client.tsx
"use client";

import React, { useEffect, useState } from "react";
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

import {
  Mail,
  CheckCircle,
  Clock,
  Download,
  LogOut,
  User,
  Shield,
  Bell,
  Activity,
  FileText,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

/**
 * التحسينات المضافة:
 * - translate="no" على الحاوية الأساسية وبعض المكونات المهمة لمنع Google Translate من التلاعب بالمحتوى.
 * - data-react-protected على الحاويات الحسّاسة للإشارة إلى ProtectionScript/ClientProviders بعدم حذف عناصر React.
 * - لم أغير منطق Supabase أو الواجهات الأصلية — فقط أضفت سمات حماية وتعليقات.
 */

interface ProfileClientProps {
  user: any | null; // supabase user object
  profile?: any | null; // optional preloaded profile row
  preferences?: any | null; // optional preloaded preferences row
}

export default function ProfileClient({ user, profile, preferences }: ProfileClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // UI states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // language state
  const [language, setLanguage] = useState("en");


  // local form state
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

  // preferences local
  const [prefs, setPrefs] = useState({
    notifications_enabled: true,
    email_notifications: true,
    sms_notifications: false,
    trading_notifications: true,
    two_factor_enabled: false,
    auto_invest_enabled: false,
    risk_tolerance: "medium",
  });

  // password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // whether to show KYC tab in UI (you said temporarily hide — change to true to enable)
  const showKyc = false;

  // populate local state from incoming props OR fetch directly if not provided
  useEffect(() => {
    const loadIfMissing = async () => {
      if (!user) return;

      // if profile props provided, use them; otherwise fetch from DB
      let profileRow = profile ?? null;
      if (!profileRow) {
        const { data, error } = await supabase.from("user_profiles").select("*").eq("uid", user.id).single();
        if (!error) profileRow = data;
      }

      let prefsRow = preferences ?? null;
      if (!prefsRow) {
        const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).single();
        if (!error) prefsRow = data;
      }

      setProfileData({
        firstName:
          profileRow?.first_name ??
          (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).split(" ")[0] : ""),
        lastName:
          profileRow?.last_name ??
          (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).split(" ")[1] : ""),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // load language from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("app_language") || localStorage.getItem("lang");
      if (saved) setLanguage(saved);
    } catch (e) {
      // ignore (SSR or disabled storage)
    }
  }, []);


  // helper: basic email validation
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Save profile directly to Supabase
  const handleSave = async () => {
    if (!user) return;
    if (!isValidEmail(profileData.email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // build payload (match your DB column names)
      const payload: any = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        phone: profileData.phone,
        country: profileData.country,
        city: profileData.city,
        address: profileData.address,
        zip_code: profileData.zipCode,
      };

      // attempt update by uid (your schema screenshot used uid)
      const { data, error } = await supabase.from("user_profiles").update(payload).eq("uid", user.id);

      if (error) {
        // attempt alternate key if your schema uses user_id
        const alt = await supabase.from("user_profiles").update(payload).eq("user_id", user.id);
        if (alt.error) throw alt.error;
      }

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      console.error("save profile error:", err);
      toast({
        title: "Save failed",
        description: err?.message || "Could not save profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // update or create preferences (upsert)
  const updatePreference = async (key: string, value: any) => {
    if (!user) return;
    setPrefs((p) => ({ ...p, [key]: value })); // optimistic UI

    try {
      // upsert row for user_id
      const upsertPayload: any = { user_id: user.id, updated_at: new Date().toISOString() };
      upsertPayload[key] = value;

      const { error } = await supabase.from("").upsert(upsertPayload, { onConflict: "user_id" });
      if (error) throw error;
    } catch (err: any) {
      console.error("update pref err:", err);
      toast({
        title: "Preferences error",
        description: err?.message || "Could not update preferences.",
        variant: "destructive",
      });
      // rollback optimistic
      setPrefs((p) => ({ ...p, [key]: !value }));
    }
  };

  // Change password using supabase auth (client)
  const handleChangePassword = async () => {
    if (!newPassword) {
      toast({
        title: "Missing field",
        description: "Please enter a new password.",
        variant: "destructive",
      });
      return;
    }

    setIsPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });

      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      console.error("password change error:", err);
      toast({
        title: "Password error",
        description: err?.message || "Failed to change password.",
        variant: "destructive",
      });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  // Export data client-side (no server route)
  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const [{ data: profileRow }, { data: prefsRow }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("uid", user.id).single(),
        supabase.from("").select("*").eq("user_id", user.id).single(),
      ]);

      const exportObj = {
        user: {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
        },
        profile: profileRow ?? null,
        preferences: prefsRow ?? null,
      };

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${user.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Export ready", description: "Your data download started." });
    } catch (err: any) {
      console.error("export err:", err);
      toast({
        title: "Export failed",
        description: err?.message || "Could not export data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // start KYC flow
  const handleStartKYC = () => {
    router.push("/dashboard/kyc/start");
  };

  // sign out
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // تسجيل الخروج من Supabase
      await supabase.auth.signOut();

      // ✅ إعادة التوجيه مباشرة إلى login
      router.replace("/auth/login");
    } catch (err: any) {
      console.error("sign out err:", err);
      toast({
        title: "Logout failed",
        description: err?.message || "Could not sign out.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };


  const handleLanguageChange = (lang: string) => {
    try {
      setLanguage(lang);
      localStorage.setItem("app_language", lang);
      // trigger a refresh so that any server-side data depending on language updates
      try { router.refresh(); } catch (e) {}
    } catch (e) {
      console.error("language change error", e);
    }
  };

  // If not logged in show message
  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6"
        translate="no" // ⛔️ منع الترجمة لهذه الحاوية
        data-react-protected // ⛔️ علامة حماية لتتوافق مع ProtectionScript
      >
        <p className="text-white">Please login to view your profile.</p>
      </div>
    );
  }

  // ---------- Render ----------
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24"
      translate="no" // ⛔️ منع ترجمة الصفحة بالكامل
      data-react-protected // ⛔️ حماية إضافية: تمنع الحذف الخاطئ لعناصر React من قبل سكربتات خارجية
    >
      <div className="max-w-6xl mx-auto space-y-6" translate="no" data-react-protected>
        {/* Header */}
        <div
          className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0"
          translate="no"
        >
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">
                {(profileData.firstName?.charAt(0) || "") + (profileData.lastName?.charAt(0) || "")}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{profileData.firstName} {profileData.lastName}</h1>
              <p className="text-blue-200 flex items-center"><Mail className="w-4 h-4 mr-2" />{profileData.email}</p>
              <div className="flex items-center space-x-3 mt-2">
                <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
                  <CheckCircle className="w-3 h-3 mr-1" />{user?.email_confirmed_at ? "Verified Account" : "Unverified Account"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700/60 bg-transparent" onClick={handleExportData} disabled={isExporting}>
              <Download className="w-4 h-4 mr-2" />{isExporting ? "Exporting..." : "Export Data"}
            </Button>

            {/* Language selector */}
            <div className="flex items-center">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                disabled={!isEditing}
                aria-label="Select language"
                className="ml-3 bg-slate-800/50 border border-slate-600 text-white rounded-lg p-2"
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
                <option value="fr">Français</option>
              </select>
            </div>

            <Button
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-600/10 bg-transparent"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isLoggingOut ? "Signing Out..." : "Sign Out"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" translate="no">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="trading-card" translate="no" data-react-protected>
              <CardHeader>
                <CardTitle className="text-white text-lg">Account Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account Status</span>
                  <Badge className="bg-green-600 text-white">{profile?.status || "Active"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  
                  
                </div>
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-muted-foreground text-sm">Last Login</p>
                  <p className="text-white text-sm">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="profile" className="space-y-6" >
              {/* Responsive grid: on small screens 2 columns (so two per row), on md+ show 5 */}
              <TabsList
                className="
                  flex justify-between w-full 
                  bg-gradient-to-r from-slate-800/60 to-slate-900/60 
                  backdrop-blur-sm border border-slate-700/50 
                  p-2 rounded-xl shadow-inner
                "
                translate="no"
              >
                <TabsTrigger value="profile" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg">
                  <User className="w-4 h-4" /> Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg">
                  <Shield className="w-4 h-4" /> Security
                </TabsTrigger>
                
                {/* Uncomment KYC / Activity if needed */}
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" translate="no">
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center"><User className="w-5 h-5 mr-2" />Personal Information</CardTitle>
                    <div>
                      <Button variant="outline" size="sm" onClick={() => (isEditing ? setIsEditing(false) : setIsEditing(true))} className="mr-2 border-slate-600 text-slate-300 bg-transparent">
                        {isEditing ? (<><X className="w-4 h-4 mr-2" /> Cancel</>) : (<><Edit className="w-4 h-4 mr-2" /> Edit Profile</>)}
                      </Button>
                      {isEditing && (
                        <Button onClick={handleSave} size="sm" disabled={isSaving} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                          <Save className="w-4 h-4 mr-2" />{isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
                        <Input id="firstName" value={profileData.firstName} onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
                        <Input id="lastName" value={profileData.lastName} onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                        <Input id="email" type="email" value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} disabled className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                        <Input id="phone" value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country" className="text-slate-300">Country</Label>
                        <Input id="country" value={profileData.country} onChange={(e) => setProfileData({ ...profileData, country: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-slate-300">City</Label>
                        <Input id="city" value={profileData.city} onChange={(e) => setProfileData({ ...profileData, city: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-slate-300">Address</Label>
                      <Input id="address" value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zipCode" className="text-slate-300">Zip Code</Label>
                      <Input id="zipCode" value={profileData.zipCode} onChange={(e) => setProfileData({ ...profileData, zipCode: e.target.value })} disabled={!isEditing} className="bg-slate-800/50 border-slate-600 text-white" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security" translate="no">
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center"><Shield className="w-5 h-5 mr-2" />Security Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    

                    <div className="space-y-4">
                      <h3 className="text-white font-medium">Change Password</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword" className="text-slate-300">Current Password</Label>
                          <div className="relative">
                            <Input id="currentPassword" type={showPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-slate-800/50 border-slate-600 text-white pr-10" />
                            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newPassword" className="text-slate-300">New Password</Label>
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
                          {isPasswordSaving ? "Updating..." : "Update Password"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications" translate="no">
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center"><Bell className="w-5 h-5 mr-2" />Notification Preferences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(prefs).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                        <div>
                          <h3 className="text-white font-medium capitalize">{key.replace(/_/g, " ")}</h3>
                          <p className="text-slate-400 text-sm">{/* optional descriptions */}</p>
                        </div>
                        <Switch checked={Boolean(value)} onCheckedChange={(checked) => updatePreference(key, checked)} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KYC (optional hide) */}
              {showKyc && (
                <TabsContent value="kyc" translate="no">
                  <Card className="trading-card" translate="no" data-react-protected>
                    <CardHeader>
                      <CardTitle className="text-white flex items-center"><FileText className="w-5 h-5 mr-2" />KYC Verification</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-slate-400" /></div>
                        <h3 className="text-white text-lg font-medium mb-2">{profile?.kyc_status === "verified" ? "KYC Verified" : "Complete Your KYC"}</h3>
                        <p className="text-slate-400 mb-6">{profile?.kyc_status === "verified" ? "Your identity has been successfully verified." : "Verify your identity to unlock all platform features and increase your limits."}</p>
                        {profile?.kyc_status !== "verified" && <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white" onClick={handleStartKYC}>Start KYC Process</Button>}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Activity */}
              <TabsContent value="activity" translate="no">
                <Card className="trading-card" translate="no" data-react-protected>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center"><Activity className="w-5 h-5 mr-2" />Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center"><CheckCircle className="w-4 h-4 text-white" /></div>
                          <div>
                            <p className="text-white font-medium">Account Login</p>
                            <p className="text-slate-400 text-sm">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never"}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">Success</Badge>
                      </div>
                    </div>
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
