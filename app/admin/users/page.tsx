"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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
  total_deposits?: number; // ✅ إجمالي الإيداعات
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // للتحكم في المودال
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ نجيب كل المستخدمين
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // ✅ نجيب إجمالي الإيداعات الموافق عليها لكل مستخدم
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

      // ✅ نضيفها للـ users
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
    const { error } = await supabase.from("user_profiles").delete().eq("uid", uid);

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

    setModalOpen(false);
    setAmount(0);
    setSelectedUser(null);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.toLowerCase().includes(search.toLowerCase()) ||
      u.referral_code?.toLowerCase().includes(search.toLowerCase()) ||
      u.referral_code_used?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="p-4">Loading users...</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-white">
        👑 Admin Dashboard - Users
      </h1>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or UID..."
          className="w-full p-2 border rounded bg-slate-800 text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-700 rounded-lg bg-slate-900 text-sm text-gray-300">
          <thead className="bg-slate-800 text-gray-200">
            <tr>
              <th className="border p-2">UID</th>
              <th className="border p-2">Full Name</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Role</th>
              <th className="border p-2">Balance</th>
              <th className="border p-2">Referral Earnings</th>
              <th className="border p-2">Total Deposits</th> {/* ✅ جديد */}
              <th className="border p-2">Referral Code</th>
              <th className="border p-2">Referral Used</th>
              <th className="border p-2">Total Referrals</th>
              <th className="border p-2">IP</th>
              <th className="border p-2">Status</th>
              <th className="border p-2">Created At</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.uid} className="hover:bg-slate-800 transition-colors">
                <td className="border p-2 font-mono text-xs">{user.uid}</td>
                <td className="border p-2">{user.full_name ?? "-"}</td>
                <td className="border p-2">{user.email ?? "-"}</td>
                <td className="border p-2">
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
                <td className="border p-2 text-green-400 font-semibold">
                  ${user.balance.toFixed(2)}
                </td>
                <td className="border p-2 text-purple-400 font-semibold">
                  ${user.referral_earnings?.toFixed(2) ?? "0.00"}
                </td>
                <td className="border p-2 text-yellow-400 font-semibold">
                  ${user.total_deposits?.toFixed(2) ?? "0.00"}
                </td>
                <td className="border p-2 font-mono">{user.referral_code ?? "-"}</td>
                <td className="border p-2 font-mono">
                  {user.referral_code_used ?? "-"}
                </td>
                <td className="border p-2 text-blue-400 font-semibold">
                  {user.total_referrals ?? 0}
                </td>
                <td className="border p-2">{user.ip_address ?? "-"}</td>
                <td className="border p-2">
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
                <td className="border p-2 text-xs">
                  {new Date(user.created_at).toLocaleString()}
                </td>
                <td className="border p-2 space-x-2">
                  <button
                    className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                    onClick={() =>
                      updateUser(user.uid, {
                        role: user.role === "admin" ? "user" : "admin",
                      })
                    }
                  >
                    Toggle Role
                  </button>
                  <button
                    className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs"
                    onClick={() =>
                      updateUser(user.uid, {
                        status: user.status === "active" ? "banned" : "active",
                      })
                    }
                  >
                    {user.status === "active" ? "Ban" : "Unban"}
                  </button>
                  <button
                    className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs"
                    onClick={() => {
                      setSelectedUser(user);
                      setModalOpen(true);
                    }}
                  >
                    Update Balance
                  </button>
                  <button
                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                    onClick={() => deleteUser(user.uid)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* المودال الخاص بالرصيد */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-slate-800 p-6 w-96 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-white">
              Update Balance for {selectedUser.full_name}
            </h2>
            <input
              type="number"
              className="w-full border p-2 mb-4 bg-slate-700 text-white rounded"
              placeholder="Enter amount (e.g. 100 or -50)"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded"
                onClick={handleBalanceUpdate}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
