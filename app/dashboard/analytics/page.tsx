"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "@/lib/auth-actions";
import { supabase } from "@/lib/supabase/client";
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

interface ProfileClientProps {
  user: any | null;
  profile: any | null;
  preferences: any | null;
}

export default function ProfileClient({
  user,
  profile,
  preferences,
}: ProfileClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ------------------- UI States -------------------
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ------------------- Profile State -------------------
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

  // ------------------- Preferences State -------------------
  const [prefs, setPrefs] = useState({
    notifications_enabled: true,
    email_notifications: true,
    sms_notifications: false,
    trading_notifications: true,
    two_factor_enabled: false,
    auto_invest_enabled: false,
    risk_tolerance: "medium",
  });

  // ------------------- Password -------------------
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // ------------------- Sync Props → State -------------------
  useEffect(() => {
    setProfileData({
      firstName:
        (profile?.first_name as string) ||
        (user?.user_metadata?.full_name
          ? String(user.user_metadata.full_name).split(" ")[0]
          : "") ||
        "",
      lastName:
        (profile?.last_name as string) ||
        (user?.user_metadata?.full_name
          ? String(user.user_metadata.full_name).split(" ")[1]
          : "") ||
        "",
      email: user?.email ?? "",
      phone: profile?.phone ?? "",
      country: profile?.country ?? "",
      city: profile?.city ?? "",
      address: profile?.address ?? "",
      zipCode: profile?.zip_code ?? "",
    });

    setPrefs({
      notifications_enabled: preferences?.notifications_enabled ?? true,
      email_notifications: preferences?.email_notifications ?? true,
      sms_notifications: preferences?.sms_notifications ?? false,
      trading_notifications: preferences?.trading_notifications ?? true,
      two_factor_enabled: preferences?.two_factor_enabled ?? false,
      auto_invest_enabled: preferences?.auto_invest_enabled ?? false,
      risk_tolerance: preferences?.risk_tolerance ?? "medium",
    });
  }, [user, profile, preferences]);

  // ------------------- Helpers -------------------
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // ------------------- Handlers -------------------
  const handleSave = async () => {
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
      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: `${profileData.firstName} ${profileData.lastName}`,
          phone: profileData.phone,
          country: profileData.country,
          city: profileData.city,
          address: profileData.address,
          email: profileData.email,
        })
        .eq("uid", user.id);

      if (error) throw error;

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

  const handleCancel = () => {
    setProfileData({
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      email: user?.email ?? "",
      phone: profile?.phone ?? "",
      country: profile?.country ?? "",
      city: profile?.city ?? "",
      address: profile?.address ?? "",
      zipCode: profile?.zip_code ?? "",
    });
    setIsEditing(false);
  };

  const updatePreference = async (key: string, value: any) => {
    setPrefs((p) => ({ ...p, [key]: value }));

    try {
      const { error } = await supabase
        .from("user_preferences")
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (err: any) {
      console.error("update pref err:", err);
      toast({
        title: "Preferences error",
        description: err?.message || "Could not update preferences.",
        variant: "destructive",
      });
      setPrefs((p) => ({ ...p, [key]: !value }));
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast({
        title: "Missing fields",
        description: "Please enter current and new passwords.",
        variant: "destructive",
      });
      return;
    }

    setIsPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: "Password updated", description: "Your password has been changed." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      console.error("password change err:", err);
      toast({
        title: "Password error",
        description: err?.message || "Failed to change password.",
        variant: "destructive",
      });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/export", { method: "GET" });
      if (!res.ok) throw new Error("Failed to generate export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${user?.id ?? "data"}.json`;
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

  const handleStartKYC = () => {
    router.push("/dashboard/kyc/start");
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const result = await signOut?.();
      if (result?.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        router.push("/auth/login");
      }
    } catch (err: any) {
      console.error("sign out err:", err);
      try {
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/auth/login");
      } catch (e) {
        toast({
          title: "Logout failed",
          description: "Could not sign out.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ------------------- Render -------------------
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
        <p className="text-white">Please login to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">
                {(profileData.firstName?.charAt(0) || "") +
                  (profileData.lastName?.charAt(0) || "")}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {profileData.firstName} {profileData.lastName}
              </h1>
              <p className="text-blue-200 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                {profileData.email}
              </p>
              <div className="flex items-center space-x-3 mt-2">
                <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {user?.email_confirmed_at ? "Verified Account" : "Unverified Account"}
                </Badge>
                <Badge variant="outline" className="text-blue-400 border-blue-400 bg-blue-400/10">
                  <Clock className="w-3 h-3 mr-1" />
                  Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700/60 bg-transparent"
              onClick={handleExportData}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? "Exporting..." : "Export Data"}
            </Button>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white text-lg">Account Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account Status</span>
                  <Badge className="bg-green-600 text-white">{profile?.status || "Active"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">KYC Status</span>
                  <Badge variant={profile?.kyc_status === "verified" ? "default" : "destructive"}>
                    {profile?.kyc_status === "verified" ? "Verified" : "Not Verified"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">2FA Security</span>
                  <Badge
                    className={
                      prefs?.two_factor_enabled ? "bg-green-600 text-white" : "bg-red-600 text-white"
                    }
                  >
                    {prefs?.two_factor_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-muted-foreground text-sm">Last Login</p>
                  <p className="text-white text-sm">
                    {user?.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleString()
                      : "Never"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    IP: {profile?.last_login_ip || "Unknown"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border border-slate-700 p-2 rounded">
                <TabsTrigger value="profile" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Shield className="w-4 h-4 mr-2" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="notifications" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="kyc" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <FileText className="w-4 h-4 mr-2" />
                  KYC
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Activity className="w-4 h-4 mr-2" />
                  Activity
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile">
                <Card className="trading-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      Personal Information
                    </CardTitle>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (isEditing) handleCancel();
                          else setIsEditing(true);
                        }}
                        className="border-slate-600 text-slate-300 bg-transparent mr-2"
                      >
                        {isEditing ? <X className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
                        {isEditing ? "Cancel" : "Edit Profile"}
                      </Button>

                      {isEditing && (
                        <Button
                          onClick={handleSave}
                          size="sm"
                          disabled={isSaving}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-slate-300">
                          First Name
                        </Label>
                        <Input
                          id="firstName"
                          value={profileData.firstName}
                          onChange={(e) =>
                            setProfileData({ ...profileData, firstName: e.target.value })
                          }
                          disabled={!isEditing}
                          className="bg-slate-800/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-slate-300">
                          Last Name
                        </Label>
                        <Input
                          id="lastName"
                          value={profileData.lastName}
                          onChange={(e) =>
                            setProfileData({ ...profileData, lastName: e.target.value })
                          }
                          disabled={!isEditing}
                          className="bg-slate-800/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-300">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) =>
                            setProfileData({ ...profileData, email: e.target.value })
                          }
                          disabled={!isEditing}
                          className="bg-slate-800/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-slate-300">
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) =>
                            setProfileData({ ...profileData, phone: e.target.value })
                          }
                          disabled={!isEditing}
                          className="bg-slate-800/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country" className="text-slate-300">
                          Country
                        </Label>
                        <Input
                          id="country"
                          value={profileData.country}
                          onChange={(e) =>
                            setProfileData({ ...profileData, country: e.target.value })
                          }
                          disabled={!isEditing}
                          className="bg-slate-800/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-slate-300">
                          City
                        </Label>
                        <Input
                          id="city"
                          value={profileData.city}
                          onChange={(e) =>
                            setProfileData({ ...profileData, city: e.target.value })
                          }
                          disabled={!isEditing}
                          className="bg-slate-800/50 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-slate-300">
                        Address
                      </Label>
                      <Input
                        id="address"
                        value={profileData.address}
                        onChange={(e) =>
                          setProfileData({ ...profileData, address: e.target.value })
                        }
                        disabled={!isEditing}
                        className="bg-slate-800/50 border-slate-600 text-white"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Shield className="w-5 h-5 mr-2" />
                      Security Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                        <div>
                          <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                          <p className="text-slate-400 text-sm">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                        <Switch
                          checked={prefs.two_factor_enabled}
                          onCheckedChange={(val) => {
                            setPrefs((p) => ({ ...p, two_factor_enabled: val }));
                            updatePreference("two_factor_enabled", val);
                          }}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-white font-medium">Change Password</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="currentPassword" className="text-slate-300">
                              Current Password
                            </Label>
                            <div className="relative">
                              <Input
                                id="currentPassword"
                                type={showPassword ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="bg-slate-800/50 border-slate-600 text-white pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-slate-300">
                              New Password
                            </Label>
                            <div className="relative">
                              <Input
                                id="newPassword"
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="bg-slate-800/50 border-slate-600 text-white pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                              >
                                {showNewPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            onClick={handleChangePassword}
                            disabled={isPasswordSaving}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                          >
                            {isPasswordSaving ? "Updating..." : "Update Password"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Bell className="w-5 h-5 mr-2" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(prefs).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700"
                      >
                        <div>
                          <h3 className="text-white font-medium capitalize">
                            {key.replace(/_/g, " ")}
                          </h3>
                        </div>
                        <Switch
                          checked={Boolean(value)}
                          onCheckedChange={(checked) => updatePreference(key, checked)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KYC Tab */}
              <TabsContent value="kyc">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      KYC Verification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-white text-lg font-medium mb-2">
                        {profile?.kyc_status === "verified"
                          ? "KYC Verified"
                          : "Complete Your KYC"}
                      </h3>
                      <p className="text-slate-400 mb-6">
                        {profile?.kyc_status === "verified"
                          ? "Your identity has been successfully verified."
                          : "Verify your identity to unlock all platform features and increase your limits."}
                      </p>
                      {profile?.kyc_status !== "verified" && (
                        <Button
                          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                          onClick={handleStartKYC}
                        >
                          Start KYC Process
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity">
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Activity className="w-5 h-5 mr-2" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-medium">Account Login</p>
                            <p className="text-slate-400 text-sm">
                              {user?.last_sign_in_at
                                ? new Date(user.last_sign_in_at).toLocaleString()
                                : "Never"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-green-400 border-green-400 bg-green-400/10"
                        >
                          Success
                        </Badge>
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
