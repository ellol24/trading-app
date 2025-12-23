// app/admin/users/page.tsx
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
  RotateCw,
  Trash2,
  LogIn,
  Key,
  Download,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/language-context";
import { toast } from "sonner";

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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: deposits } = await supabase
        .from("deposits")
        .select("user_id, amount, status");

      const totals: Record<string, number> = {};
      (deposits || []).forEach((d: any) => {
        if (d.status === "approved") {
          totals[d.user_id] = (totals[d.user_id] || 0) + Number(d.amount);
        }
      });

      const enriched = (profiles || []).map((u: any) => ({
        ...u,
        total_deposits: totals[u.uid] || 0,
      }));

      setUsers(enriched);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUser = async (uid: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("uid", uid);

    if (error) toast.error(error.message);
    else {
      toast.success(t('admin.statusUpdated'));
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
      setActionModalOpen(false);
    }
  };

  const handleBalanceUpdate = async () => {
    if (!selectedUser) return;
    const newBalance = selectedUser.balance + amount;
    await updateUser(selectedUser.uid, { balance: newBalance });
    toast.success(t('admin.balanceUpdated'));
    setAmount(0);
    setActionModalOpen(false);
  };

  const impersonateUser = (uid: string) => {
    window.open(`/dashboard?impersonate=${uid}`, "_blank");
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


  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.includes(search)
  );

  if (loading) return <p className="p-6 text-white">{t('common.loading')}</p>;
  if (error) return <p className="p-6 text-red-500">{t('common.error')}: {error}</p>;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-slate-950">
      <h1 className="text-3xl font-bold text-white">{t('admin.userManagement')}</h1>

      <Input
        className="bg-slate-900 border-slate-700 text-white"
        placeholder={t('admin.searchUser')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">{t('admin.allUsers')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-gray-300">
              <thead className="text-left">
                <tr className="bg-slate-800 text-gray-200">
                  <th className="p-3 rounded-tl-lg">{t('admin.name')}</th>
                  <th className="p-3">{t('admin.email')}</th>
                  <th className="p-3">{t('admin.balance')}</th>
                  <th className="p-3 rounded-tr-lg">{t('admin.actions_th')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-medium text-white">{user.full_name || "N/A"}</td>
                    <td className="p-3">{user.email || "N/A"}</td>
                    <td className="p-3 text-green-400 font-mono">${user.balance.toFixed(2)}</td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-slate-700"
                        onClick={() => {
                          setSelectedUser(user);
                          setActionModalOpen(true);
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
          <DialogContent className="bg-slate-900 text-white border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {t('admin.manageUser')}: {selectedUser.full_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 w-full"
                  onClick={() => impersonateUser(selectedUser.uid)}
                >
                  <LogIn className="w-4 h-4 mr-2" /> {t('admin.loginAsUser')}
                </Button>

                <Button variant="outline" className="border-slate-600 hover:bg-slate-800 text-slate-300" onClick={handleExportUserData} disabled={isExporting}>
                  <Download className="w-4 h-4 mr-2" /> {t('admin.exportData')}
                </Button>
              </div>

              <div className="bg-slate-800 p-4 rounded-lg space-y-3">
                <p className="font-semibold text-sm text-slate-400">{t('admin.balance')}</p>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    className="bg-slate-950 border-slate-700 text-white"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                  <Button
                    className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                    onClick={handleBalanceUpdate}
                  >
                    <DollarSign className="w-4 h-4 mr-1" /> {t('admin.addBalance')}
                  </Button>
                </div>
              </div>

              <div className="bg-slate-800 p-4 rounded-lg space-y-3">
                <p className="font-semibold text-sm text-slate-400">{t('admin.changePassword')}</p>
                <div className="space-y-2">
                  <Input
                    placeholder="New password"
                    className="bg-slate-950 border-slate-700 text-white"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    className="bg-yellow-600 hover:bg-yellow-700 w-full"
                    onClick={handlePasswordChange}
                  >
                    <Key className="w-4 h-4 mr-2" /> {t('admin.changePassword')}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 w-full"
                  onClick={() =>
                    updateUser(selectedUser.uid, {
                      role: selectedUser.role === "admin" ? "user" : "admin",
                    })
                  }
                >
                  <RotateCw className="w-4 h-4 mr-2" /> {t('admin.toggleRole')}
                </Button>

                <Button
                  className={`${selectedUser.status === 'banned' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} w-full`}
                  onClick={() =>
                    updateUser(selectedUser.uid, {
                      status:
                        selectedUser.status === "active"
                          ? "banned"
                          : "active",
                    })
                  }
                >
                  <Ban className="w-4 h-4 mr-2" /> {t('admin.toggleBan')}
                </Button>
              </div>

              <Button
                variant="destructive"
                className="w-full mt-4"
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
