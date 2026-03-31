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
  const [newPassword, setNewPassword] = useState("");

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

    if (error) alert(error.message);
    else fetchUsers();
  };

  const deleteUser = async (uid: string) => {
    if (!confirm("Are you sure?")) return;
    const { error } = await supabase
      .from("user_profiles")
      .delete()
      .eq("uid", uid);
    if (error) alert(error.message);
    else fetchUsers();
  };

  const handlePasswordChange = async () => {
    if (!selectedUser) return;

    const { error } = await supabase.rpc("update_user_password", {
      target_uid: selectedUser.uid,
      new_password: newPassword,
    });

    if (error) alert(error.message);
    else {
      alert("Password updated successfully!");
      setNewPassword("");
      setActionModalOpen(false);
    }
  };

  const handleBalanceUpdate = async () => {
    if (!selectedUser) return;
    const newBalance = selectedUser.balance + amount;
    await updateUser(selectedUser.uid, { balance: newBalance });
    setAmount(0);
    setActionModalOpen(false);
  };

  const impersonateUser = (uid: string) => {
    window.open(`/dashboard?impersonate=${uid}`, "_blank");
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.includes(search)
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-white">Admin Users Panel</h1>

      <Input
        className="bg-slate-800 text-white"
        placeholder="Search user..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card className="bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-gray-300">
            <thead>
              <tr className="bg-slate-800 text-gray-200">
                <th className="p-2">User</th>
                <th className="p-2">Email</th>
                <th className="p-2">Balance</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="border-b border-slate-800">
                  <td className="p-2">{user.full_name}</td>
                  <td className="p-2">{user.email}</td>
                  <td className="p-2 text-green-400">${user.balance}</td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedUser(user);
                        setActionModalOpen(true);
                      }}
                    >
                      <MoreVertical />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedUser && (
        <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
          <DialogContent className="bg-slate-900 text-white">
            <DialogHeader>
              <DialogTitle>
                Manage User: {selectedUser.full_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Button
                className="bg-blue-600 w-full"
                onClick={() => impersonateUser(selectedUser.uid)}
              >
                <LogIn /> Login as User
              </Button>

              <Button
                className="bg-green-600 w-full"
                onClick={handleBalanceUpdate}
              >
                <DollarSign /> Add Balance (${amount})
              </Button>
              <Input
                type="number"
                className="bg-slate-800"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />

              {/* 🔥 تغيير كلمة مرور المستخدم */}
              <div>
                <Input
                  placeholder="New password"
                  className="bg-slate-800"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  className="bg-yellow-500 w-full mt-2"
                  onClick={handlePasswordChange}
                >
                  <Key /> Change Password
                </Button>
              </div>

              <Button
                className="bg-purple-600 w-full"
                onClick={() =>
                  updateUser(selectedUser.uid, {
                    role: selectedUser.role === "admin" ? "user" : "admin",
                  })
                }
              >
                <RotateCw /> Toggle Role
              </Button>

              <Button
                className="bg-red-600 w-full"
                onClick={() =>
                  updateUser(selectedUser.uid, {
                    status:
                      selectedUser.status === "active"
                        ? "banned"
                        : "active",
                  })
                }
              >
                <Ban /> Toggle Ban
              </Button>

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => deleteUser(selectedUser.uid)}
              >
                <Trash2 /> Delete User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
