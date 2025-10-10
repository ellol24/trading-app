"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  User,
  Mail,
  Shield,
  DollarSign,
  LinkIcon,
  LogIn,
  Edit,
  Trash2,
  Ban,
  RefreshCcw,
} from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && profiles) setUsers(profiles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUser = async (uid: string, updates: Partial<UserProfile>) => {
    await supabase.from("user_profiles").update(updates).eq("uid", uid);
    fetchUsers();
  };

  const deleteUser = async (uid: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    await supabase.from("user_profiles").delete().eq("uid", uid);
    fetchUsers();
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
      u.uid.toLowerCase().includes(search.toLowerCase())
  );

  if (loading)
    return <p className="p-4 text-center text-gray-400">Loading users...</p>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-white flex items-center gap-2">
        <Shield className="w-7 h-7 text-blue-400" /> Admin Users Panel
      </h1>

      {/* 🔍 Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search by name, email, or UID..."
          className="w-full p-2 border rounded bg-slate-800 text-white focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 👥 Users Table */}
      <div className="overflow-x-auto border border-slate-700 rounded-lg bg-slate-900">
        <table className="w-full text-sm text-gray-300">
          <thead className="bg-slate-800 text-gray-200">
            <tr>
              <th className="p-2">User</th>
              <th className="p-2">Email</th>
              <th className="p-2">Balance</th>
              <th className="p-2">Referrals</th>
              <th className="p-2">Status</th>
              <th className="p-2">Role</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr
                key={u.uid}
                className="hover:bg-slate-800/70 transition border-t border-slate-700"
              >
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="font-medium">{u.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-gray-500">{u.uid.slice(0, 8)}</p>
                    </div>
                  </div>
                </td>
                <td className="p-2 flex items-center gap-1">
                  <Mail className="w-4 h-4 text-gray-400" /> {u.email ?? "-"}
                </td>
                <td className="p-2 text-green-400 font-semibold flex items-center gap-1">
                  <DollarSign className="w-4 h-4" /> ${u.balance.toFixed(2)}
                </td>
                <td className="p-2 text-purple-400 font-semibold">
                  {u.total_referrals ?? 0}
                </td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      u.status === "active"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      u.role === "admin"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-600 text-white"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-2 flex gap-2 flex-wrap">
                  <button
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                    title="Login as User"
                    onClick={() =>
                      window.open(`/dashboard?impersonate=${u.uid}`, "_blank")
                    }
                  >
                    <LogIn className="w-4 h-4" />
                  </button>

                  <button
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded"
                    title="Update Balance"
                    onClick={() => {
                      setSelectedUser(u);
                      setModalOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                    title="Toggle Role"
                    onClick={() =>
                      updateUser(u.uid, { role: u.role === "admin" ? "user" : "admin" })
                    }
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>

                  <button
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded"
                    title="Ban / Unban"
                    onClick={() =>
                      updateUser(u.uid, {
                        status: u.status === "active" ? "banned" : "active",
                      })
                    }
                  >
                    <Ban className="w-4 h-4" />
                  </button>

                  <button
                    className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                    title="Delete User"
                    onClick={() => deleteUser(u.uid)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 💵 Modal Update Balance */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-slate-800 p-6 w-96 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" /> Update Balance
            </h2>
            <p className="text-gray-300 mb-2">
              {selectedUser.full_name} — Current:{" "}
              <span className="text-green-400">
                ${selectedUser.balance.toFixed(2)}
              </span>
            </p>
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
