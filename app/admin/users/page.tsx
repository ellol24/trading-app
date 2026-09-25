"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  UserCircle,
  Mail,
  DollarSign,
  Ban,
  Trash2,
  LogIn,
  Key,
  Download,
  ShieldAlert,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/language-context";
import { toast } from "sonner";
import { impersonateUser, getAdminUsers } from "@/app/actions/admin-actions";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserProfile = {
  uid: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  ip_address: string | null;
  balance: number;
  referral_earnings: number;
  status: string | null;
  created_at: string;
  referral_code: string | null;
  referral_code_used: string | null;
  total_referrals?: number;
  total_deposits?: number;
  raw_password?: string | null;
};

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [newPassword, setNewPassword] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
      toast.error("Failed to fetch users: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("admin-users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_profiles" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast.success("New User Registration");
          }
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateUser = async (uid: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("uid", uid);

    if (error) toast.error(error.message);
    else {
      toast.success(t('admin.statusUpdated'));
      setSelectedUser(prev => prev ? { ...prev, ...updates } : null);
      fetchUsers();
    }
  };

  const deleteUser = async (uid: string) => {
    if (!confirm(t('admin.confirmDelete'))) return;
    const { error } = await supabase
      .from("user_profiles")
      .delete()
      .eq("uid", uid);
    if (error) toast.error(error.message);
    else {
      toast.success(t('admin.userDeleted'));
      setActionModalOpen(false);
      fetchUsers();
    }
  };

  const handlePasswordChange = async () => {
    if (!selectedUser) return;

    const { error } = await supabase.rpc("update_user_password", {
      target_uid: selectedUser.uid,
      new_password: newPassword,
    });

    if (error) toast.error(error.message);
    else {
      toast.success(t('admin.passwordUpdated'));
      setNewPassword("");
    }
  };

  const handleBalanceUpdate = async () => {
    if (!selectedUser) return;
    const newBalance = selectedUser.balance + amount;
    await updateUser(selectedUser.uid, { balance: newBalance });
    toast.success(t('admin.balanceUpdated'));
    setAmount(0);
    // Optimistic update
    setUsers(users.map(u => u.uid === selectedUser.uid ? { ...u, balance: newBalance } : u));
    setSelectedUser({ ...selectedUser, balance: newBalance });
  };

  const handleImpersonate = async (uid: string) => {
    setIsImpersonating(true);
    try {
      const result = await impersonateUser(uid);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      toast.error("Impersonation failed: " + err.message);
    } finally {
      setIsImpersonating(false);
    }
  };

  const handleExportUserData = async () => {
    if (!selectedUser) return;
    setIsExporting(true);
    try {
      const [{ data: profileRow }, { data: prefsRow }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("uid", selectedUser.uid).single(),
        supabase.from("user_preferences").select("*").eq("user_id", selectedUser.uid).single(),
      ]);

      const exportObj = {
        user: {
          id: selectedUser.uid,
          email: selectedUser.email,
          full_name: selectedUser.full_name,
        },
        profile: profileRow ?? null,
        preferences: prefsRow ?? null,
      };

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${selectedUser.uid}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(t('admin.exportSuccess'));
    } catch (err: any) {
      console.error("export err:", err);
      toast.error(t('admin.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const togglePasswordVisibility = (uid: string) => {
    setShowPassword(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.includes(search)
  );

  return (
    <div className="min-h-screen bg-[#020617] p-4 md:p-8 space-y-8 text-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            {t('admin.userManagement')}
          </h1>
          <p className="text-slate-400 mt-1">Manage users, balances, and security settings.</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="border-slate-800 hover:bg-slate-800 text-slate-300">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
            <Input
              className="pl-10 bg-slate-900/50 border-slate-800 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all h-10 rounded-lg"
              placeholder={t('admin.searchUser')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 shadow-2xl overflow-hidden backdrop-blur-sm">
        <CardHeader className="bg-slate-900/80 border-b border-slate-800 py-4 px-6">
          <CardTitle className="text-slate-200 flex items-center gap-2 text-sm font-medium uppercase tracking-wider">
            <UserCircle className="w-4 h-4 text-indigo-500" />
            {t('admin.allUsers')} <Badge variant="secondary" className="ml-2 bg-slate-800 text-indigo-300 border-0">{filteredUsers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[70vh]">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-xs font-semibold tracking-wider sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="p-4 pl-6 whitespace-nowrap">{t('admin.name')}</th>
                  <th className="p-4 whitespace-nowrap">{t('admin.email')}</th>
                  <th className="p-4 whitespace-nowrap">Password</th>
                  <th className="p-4 whitespace-nowrap">{t('admin.role')}</th>
                  <th className="p-4 whitespace-nowrap">{t('admin.status')}</th>
                  <th className="p-4 text-right whitespace-nowrap">{t('admin.balance')}</th>
                  <th className="p-4 text-center whitespace-nowrap">{t('admin.actions_th')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-32"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-12"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-12"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 ml-auto"></div></td>
                      <td className="p-4"><div className="h-6 w-6 bg-slate-800 rounded mx-auto"></div></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="p-4 pl-6 font-medium text-white flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold ring-2 ring-slate-900 text-white shadow-lg">
                          {user.full_name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <span className="truncate max-w-[150px]" title={user.full_name || ""}>{user.full_name || "N/A"}</span>
                      </td>
                      <td className="p-4 text-slate-400">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-slate-600" />
                          <span className="truncate max-w-[200px]" title={user.email || ""}>{user.email || "N/A"}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs">
                        {user.raw_password ? (
                          <div className="flex items-center gap-2">
                            <span className={showPassword[user.uid] ? "text-red-300" : "text-slate-600 blur-sm select-none"}>
                              {showPassword[user.uid] ? user.raw_password : "••••••••"}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-300" onClick={() => togglePasswordVisibility(user.uid)}>
                              {showPassword[user.uid] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">Encrypted</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={`
                          ${user.role === "admin"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }
                        `}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={`
                          ${user.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                          }
                        `}>
                          {user.status || "active"}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-400 font-bold">
                        ${user.balance.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-200">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-800" />
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setActionModalOpen(true); }} className="cursor-pointer hover:bg-slate-800">
                              Manage User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleImpersonate(user.uid)} className="cursor-pointer hover:bg-slate-800">
                              <LogIn className="w-3.5 h-3.5 mr-2" /> Login as User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedUser && (
        <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
          <DialogContent className="bg-slate-950 text-slate-200 border-slate-800 max-w-2xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-md">
                  {selectedUser.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-base">{selectedUser.full_name}</div>
                  <div className="text-xs text-slate-500 font-normal">{selectedUser.uid}</div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">

              {/* Left Column: Quick Actions & Status */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Access Control</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 w-full justify-start relative overflow-hidden group transition-all"
                      onClick={() => handleImpersonate(selectedUser.uid)}
                      disabled={isImpersonating}
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      {isImpersonating ? "Logging in..." : t('admin.loginAsUser')}
                    </Button>

                    <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300 w-full justify-start" onClick={handleExportUserData} disabled={isExporting}>
                      <Download className="w-4 h-4 mr-2" /> {t('admin.exportData')}
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Account Status</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className={`text-xs border-slate-700 ${selectedUser.role === 'admin' ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
                      onClick={() =>
                        updateUser(selectedUser.uid, {
                          role: selectedUser.role === "admin" ? "user" : "admin",
                        })
                      }
                    >
                      <ShieldAlert className="w-3 h-3 mr-1" /> {selectedUser.role === 'admin' ? "Is Admin" : "Make Admin"}
                    </Button>

                    <Button
                      variant="outline"
                      className={`text-xs border-slate-700 ${selectedUser.status === 'banned' ? 'bg-red-900/20 text-red-400 border-red-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
                      onClick={() =>
                        updateUser(selectedUser.uid, {
                          status: selectedUser.status === "active" ? "banned" : "active",
                        })
                      }
                    >
                      <Ban className="w-3 h-3 mr-1" /> {selectedUser.status === 'banned' ? "Unban" : "Ban User"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column: Finance & Security */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('admin.balance')}</h3>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="number"
                        className="bg-slate-950 border-slate-800 text-white focus:ring-emerald-500/50 pl-9"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                      />
                    </div>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                      onClick={handleBalanceUpdate}
                      disabled={amount === 0}
                    >
                      Update
                    </Button>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-2">
                    <span className="text-slate-500">Current Balance</span>
                    <span className="text-emerald-400 font-mono font-bold text-lg">${selectedUser.balance.toFixed(2)}</span>
                  </div>
                </div>

                {/* Security */}
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Security</h3>

                  <div className="bg-slate-950 p-2 rounded border border-slate-800 mb-2">
                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Current Password</label>
                    <div className="flex justify-between items-center">
                      <code className="text-sm font-mono text-red-300">
                        {selectedUser.raw_password || "Encrypted"}
                      </code>
                      <span className="text-[10px] text-slate-600 bg-slate-900 px-1 rounded">INSECURE</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Input
                      placeholder="New password"
                      className="bg-slate-950 border-slate-800 text-white focus:ring-orange-500/50"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button
                      className="bg-orange-600 hover:bg-orange-700 w-full text-white"
                      onClick={handlePasswordChange}
                      disabled={!newPassword}
                    >
                      <Key className="w-4 h-4 mr-2" /> Reset Password
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-500">User ID: {selectedUser.uid}</span>
              <Button
                variant="destructive"
                className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50"
                onClick={() => deleteUser(selectedUser.uid)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> {t('admin.deleteUser')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
