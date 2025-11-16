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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [amount, setAmount] = useState<number>(0);

  // ⭐ جديد: تخزين كلمة المرور الجديدة
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: deposits, error: depositsError } = await supabase
        .from("deposits")
        .select("user_id, amount, status");

      if (depositsError) throw depositsError;

      const depositsTotals: Record<string, number> = {};
      (deposits || []).forEach((d: any) => {
        if (d.status === "approved") {
          depositsTotals[d.user_id] =
            (depositsTotals[d.user_id] || 0) + Number(d.amount);
        }
      });

      const enrichedUsers = (profiles || []).map((u: any) => ({
        ...u,
        total_deposits: depositsTotals[u.uid] || 0,
      }));

      setUsers(enrichedUsers as UserProfile[]);
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

    if (error) {
      alert("Error updating user: " + error.message);
    } else {
      fetchUsers();
    }
  };

  const deleteUser = async (uid: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const { error } = await supabase
      .from("user_profiles")
      .delete()
      .eq("uid", uid);

    if (error) {
      alert("Error deleting user: " + error.message);
    } else {
      fetchUsers();
    }
  };

  const handleBalanceUpdate = async () => {
    if (!selectedUser) return;
    const newBalance = selectedUser.balance + amount;
    await updateUser(selectedUser.uid, { balance: newBalance });

    setAmount(0);
    setActionModalOpen(false);
    setSelectedUser(null);
  };

  const impersonateUser = async (uid: string) => {
    window.open(`/dashboard?impersonate=${uid}`, "_blank");
  };

  // ⭐⭐ الوظيفة الجديدة: تغيير كلمة المرور
  const changePassword = async () => {
    if (!newPassword || !selectedUser) {
      alert("Please enter a password.");
      return;
    }

    const { error } = await supabase.auth.admin.updateUserById(
      selectedUser.uid,
      { password: newPassword }
    );

    if (error) {
      alert("Error changing password: " + error.message);
    } else {
      alert("Password updated successfully!");
      setNewPassword("");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.toLowerCase().includes(search.toLowerCase()) ||
      u.referral_code?.toLowerCase().includes(search.toLowerCase()) ||
      u.referral_code_used?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading)
    return <p className="p-4 text-center text-gray-400">Loading users...</p>;
  if (error)
    return <p className="p-4 text-center text-red-500">Error: {error}</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-white flex items-center gap-2">
        👑 Admin Users Panel
      </h1>

      <Input
        placeholder="Search by name, email, or UID..."
        className="bg-slate-800 text-white border-slate-700"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">All Users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300 border-collapse">
            <thead>
              <tr className="bg-slate-800 text-gray-200">
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-center">Balance</th>
                <th className="p-2 text-center">Referrals</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-center">Role</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.uid}
                  className="border-b border-slate-800 hover:bg-slate-800/60"
                >
                  <td className="p-2 flex items-center gap-2">
                    <UserCircle className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="font-semibold">{user.full_name ?? "-"}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {user.uid.slice(0, 8)}
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {user.email ?? "-"}
                    </div>
                  </td>
                  <td className="p-2 text-center text-green-400 font-semibold">
                    ${user.balance.toFixed(2)}
                  </td>
                  <td className="p-2 text-center text-blue-400 font-semibold">
                    {user.total_referrals ?? 0}
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.status === "active"
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.role === "admin"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-600 text-white"
                      }`}
                    >
                      {user.role ?? "user"}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedUser(user);
                        setActionModalOpen(true);
                      }}
                    >
                      <MoreVertical className="w-5 h-5 text-slate-300" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ------- Dialog ------- */}
      {selectedUser && (
        <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
          <DialogContent className="bg-slate-900 text-white border border-slate-700 rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-blue-300">
                Manage User: {selectedUser.full_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">

              {/* ⭐ جديد: تغيير كلمة المرور */}
              <div className="space-y-2">
                <Input
                  placeholder="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-800 border-slate-600"
                />
                <Button
                  className="bg-purple-600 hover:bg-purple-700 w-full flex items-center gap-2"
                  onClick={changePassword}
                >
                  <Key className="w-4 h-4" /> Change Password
                </Button>
              </div>

              <Button
                className="bg-blue-600 hover:bg-blue-700 w-full flex items-center gap-2"
                onClick={() => impersonateUser(selectedUser.uid)}
              >
                <LogIn className="w-4 h-4" /> Login as User
              </Button>

              <Button
                className="bg-green-600 hover:bg-green-700 w-full flex items-center gap-2"
                onClick={() => handleBalanceUpdate()}
              >
                <DollarSign className="w-4 h-4" /> Add Balance (${amount || 0})
              </Button>
              <Input
                placeholder="Amount (+/-)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />

              <Button
                className="bg-yellow-500 hover:bg-yellow-600 w-full flex items-center gap-2"
                onClick={() =>
                  updateUser(selectedUser.uid, {
                    role:
                      selectedUser.role === "admin" ? "user" : "admin",
                  })
                }
              >
                <RotateCw className="w-4 h-4" /> Toggle Role
              </Button>

              <Button
                className="bg-red-600 hover:bg-red-700 w-full flex items-center gap-2"
                onClick={() =>
                  updateUser(selectedUser.uid, {
                    status:
                      selectedUser.status === "active"
                        ? "banned"
                        : "active",
                  })
                }
              >
                <Ban className="w-4 h-4" />{" "}
                {selectedUser.status === "active" ? "Ban User" : "Unban User"}
              </Button>

              <Button
                variant="destructive"
                className="w-full flex items-center gap-2"
                onClick={() => deleteUser(selectedUser.uid)}
              >
                <Trash2 className="w-4 h-4" /> Delete User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
