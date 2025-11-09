"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

// types
type Withdrawal = {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;

  user?: {
    uid: string;
    full_name: string | null;
    email: string | null;
    balance: number | null;
  };

  wallet?: {
    user_id: string;
    asset: string | null;
    address: string | null;
    label: string | null;
  };
};

export default function AdminWithdrawalsPage() {

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);

  const [withdrawEnabled, setWithdrawEnabled] = useState(true);
  const [feePercentage, setFeePercentage] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_desc");

  const [openId, setOpenId] = useState<string | null>(null);

  // ✅ Load Withdrawal Settings (fee_percentage)
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (data?.fee_percentage !== undefined) {
        setFeePercentage(Number(data.fee_percentage));
      }
    }
    load();
  }, []);

  // ✅ Load Withdraw Control (withdraw_enabled)
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("withdrawal_control")
        .select("is_enabled")
        .eq("id", 1)
        .single();

      if (data) {
        setWithdrawEnabled(Boolean(data.is_enabled));
      }
    }
    load();
  }, []);

  // ✅ Toggle withdrawal control
  const toggleWithdraw = async () => {
    const newState = !withdrawEnabled;

    const { error } = await supabase
      .from("withdrawal_control")
      .update({ is_enabled: newState, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (error) return toast.error("Error updating withdraw state");

    setWithdrawEnabled(newState);
    toast.success(newState ? "Withdrawals enabled" : "Withdrawals disabled");
  };

  // ✅ Save fee percentage
  const saveFeePercentage = async () => {
    const { error } = await supabase
      .from("withdrawal_settings")
      .insert([{ fee_percentage: feePercentage }]);

    if (error) return toast.error("Error saving fee percentage");

    toast.success("Fee percentage updated");
  };

  // ✅ Load withdrawals WITHOUT any joins
  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      // 1️⃣ Fetch withdrawals
      const { data: wd, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (!wd?.length) {
        setWithdrawals([]);
        return;
      }

      const userIds = wd.map(w => w.user_id);
      const walletIds = wd.map(w => w.user_id);

      // 2️⃣ Fetch users
      const { data: users } = await supabase
        .from("user_profiles")
        .select("uid, full_name, email, balance")
        .in("uid", userIds);

      // 3️⃣ Fetch wallets
      const { data: wallets } = await supabase
        .from("withdrawal_wallets")
        .select("user_id, asset, address, label")
        .in("user_id", walletIds);

      // 4️⃣ Merge
      const enriched = wd.map(w => ({
        ...w,
        user: users?.find(u => u.uid === w.user_id) || null,
        wallet: wallets?.find(wa => wa.user_id === w.user_id) || null,
      }));

      setWithdrawals(enriched as Withdrawal[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  // ✅ Approve withdrawal
  const approve = async (id: string) => {
    const w = withdrawals.find(x => x.id === id);
    if (!w) return;

    const { data: usr } = await supabase
      .from("user_profiles")
      .select("balance")
      .eq("uid", w.user_id)
      .single();

    const newBalance = Number(usr.balance) - Number(w.amount);

    await supabase.from("user_profiles")
      .update({ balance: newBalance })
      .eq("uid", w.user_id);

    await supabase.from("withdrawals")
      .update({ status: "approved" })
      .eq("id", id);

    loadWithdrawals();
  };

  // ✅ Reject withdrawal
  const reject = async (id: string) => {
    const w = withdrawals.find(x => x.id === id);
    if (!w) return;

    const { data: usr } = await supabase
      .from("user_profiles")
      .select("balance")
      .eq("uid", w.user_id)
      .single();

    const newBalance = Number(usr.balance) + Number(w.amount);

    await supabase.from("user_profiles")
      .update({ balance: newBalance })
      .eq("uid", w.user_id);

    await supabase.from("withdrawals")
      .update({ status: "rejected" })
      .eq("id", id);

    loadWithdrawals();
  };

  // ✅ Filters + Search
  const filtered = useMemo(() => {
    let list = [...withdrawals];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(w =>
        (w.user?.full_name || "").toLowerCase().includes(q) ||
        (w.user?.email || "").toLowerCase().includes(q) ||
        (w.wallet?.address || "").toLowerCase().includes(q) ||
        (w.id || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter(w => w.status === statusFilter);
    }

    if (sortBy === "created_desc")
      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    if (sortBy === "created_asc")
      list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

    if (sortBy === "amount_desc")
      list.sort((a, b) => Number(b.amount) - Number(a.amount));

    if (sortBy === "amount_asc")
      list.sort((a, b) => Number(a.amount) - Number(b.amount));

    return list;
  }, [withdrawals, query, statusFilter, sortBy]);

  return (
    <div className="p-6 space-y-6">

      {/* ✅ Withdraw Control */}
      <Card>
        <CardHeader><CardTitle>Withdraw Control</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={toggleWithdraw} className={withdrawEnabled ? "bg-red-600" : "bg-green-600"}>
            {withdrawEnabled ? "Disable Withdrawals" : "Enable Withdrawals"}
          </Button>

          <div>Status: {withdrawEnabled ? "✅ Enabled" : "⛔ Disabled"}</div>

          <div className="flex items-center gap-2 ml-auto">
            <span>Fee %</span>
            <Input
              type="number"
              className="w-20"
              value={feePercentage}
              onChange={(e) => setFeePercentage(Number(e.target.value))}
            />
            <Button onClick={saveFeePercentage}>Save</Button>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Search + Filters */}
      <Card>
        <CardHeader><CardTitle>Withdrawals</CardTitle></CardHeader>

        <CardContent className="space-y-4">

          {/* Search */}
          <div className="flex gap-3 items-center">
            <Search />
            <Input
              placeholder="Search by user, email, wallet, id..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest</SelectItem>
                <SelectItem value="created_asc">Oldest</SelectItem>
                <SelectItem value="amount_desc">Amount high</SelectItem>
                <SelectItem value="amount_asc">Amount low</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm opacity-60">{filtered.length} results</div>
          </div>

          {/* ✅ Withdrawal Cards */}
          {loading ? (
            <div className="text-center py-10"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {filtered.map(w => (
                <div key={w.id} className="p-4 border rounded-lg bg-gray-900/30 flex justify-between">

                  {/* Left section */}
                  <div>
                    <div className="text-xl">${Number(w.amount).toFixed(2)}</div>
                    <div className="text-sm opacity-70">
                      {w.user?.full_name || "Unknown"} — {w.user?.email}
                    </div>

                    <div className="text-xs opacity-70 mt-1">
                      Wallet: {w.wallet?.asset} — {w.wallet?.address}
                    </div>

                    <div className="text-xs opacity-60 mt-1">
                      Fee: ${w.fee} — Net: ${w.net_amount}
                    </div>

                    <div className="text-xs opacity-60">
                      {new Date(w.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Right section */}
                  <div className="flex flex-col items-end gap-2">
                    <Badge>
                      {w.status}
                    </Badge>

                    {w.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600" onClick={() => approve(w.id)}>Approve</Button>
                        <Button size="sm" className="bg-red-600" onClick={() => reject(w.id)}>Reject</Button>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
