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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

type Wallet = {
  id: string;
  asset: string | null;
  address: string | null;
  label: string | null;
};

type UserProfile = {
  uid: string;
  full_name?: string | null;
  email?: string | null;
  balance?: number | null;
};

type Withdrawal = {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  wallet?: Wallet | null;
  user?: UserProfile | null;
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ من جدول withdrawal_control
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);

  // ✅ من جدول withdrawal_settings
  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);

  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_desc");

  const [openId, setOpenId] = useState<string | null>(null);
  const activeWithdrawal = useMemo(
    () => withdrawals.find((w) => w.id === openId) || null,
    [withdrawals, openId]
  );

  // ✅ تحميل حالة السحب من جدول withdrawal_control
  useEffect(() => {
    async function loadControl() {
      const { data, error } = await supabase
        .from("withdrawal_control")
        .select("is_enabled")
        .eq("id", 1)
        .single();

      if (!error && data) {
        setWithdrawEnabled(data.is_enabled);
      }
    }
    loadControl();
  }, []);

  // ✅ تحميل نسبة الخصم من جدول withdrawal_settings
  useEffect(() => {
    async function loadFee() {
      const { data, error } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setFeePercentage(Number(data.fee_percentage));
      }
    }
    loadFee();
  }, []);

  // ✅ تحميل السحوبات مع علاقات المستخدم والمحفظة
  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("withdrawals")
        .select(`
          id,
          user_id,
          wallet_id,
          amount,
          fee,
          net_amount,
          status,
          created_at,
          wallet:withdrawal_wallets (
            id, asset, address, label
          ),
          user:user_profiles (
            uid, full_name, email, balance
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        toast.error("Error loading withdrawals.");
      } else {
        setWithdrawals(data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  // ✅ تبديل حالة السحب باستخدام جدول withdrawal_control
  const toggleWithdraw = async () => {
    const newState = !withdrawEnabled;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("withdrawal_control")
        .update({
          is_enabled: newState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw error;

      setWithdrawEnabled(newState);
      toast.success(newState ? "Withdraw enabled" : "Withdraw disabled");
    } catch {
      toast.error("Error updating withdraw control");
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ حفظ نسبة الخصم داخل withdrawal_settings فقط
  const saveFeePercentage = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("withdrawal_settings").insert([
        { fee_percentage: feePercentage },
      ]);

      if (error) throw error;
      toast.success("Fee updated.");
    } catch {
      toast.error("Error saving fee.");
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ الموافقة على السحب
  const approveWithdrawal = async (id: string) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w) return toast.error("Withdrawal not found.");

    if (w.status !== "pending") return toast.error("Only pending allowed.");

    const loadingToast = toast.loading("Approving...");
    try {
      const { data: userRows, error: userErr } = await supabase
        .from("user_profiles")
        .select("uid, balance")
        .eq("uid", w.user_id)
        .single();

      if (userErr || !userRows) throw userErr;

      const newBalance = Number(userRows.balance || 0) - Number(w.amount);

      const { error: updUserErr } = await supabase
        .from("user_profiles")
        .update({ balance: newBalance })
        .eq("uid", w.user_id);

      if (updUserErr) throw updUserErr;

      const { error: updWErr } = await supabase
        .from("withdrawals")
        .update({ status: "approved" })
        .eq("id", id);

      if (updWErr) throw updWErr;

      await loadWithdrawals();
      toast.success("Approved.");
    } catch {
      toast.error("Error.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  // ✅ رفض السحب
  const rejectWithdrawal = async (id: string) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w) return toast.error("Withdrawal not found.");

    if (w.status !== "pending") return toast.error("Only pending allowed.");

    const loadingToast = toast.loading("Rejecting...");
    try {
      const { data: userRows } = await supabase
        .from("user_profiles")
        .select("uid, balance")
        .eq("uid", w.user_id)
        .single();

      const newBalance = Number(userRows.balance || 0) + Number(w.amount);

      await supabase
        .from("user_profiles")
        .update({ balance: newBalance })
        .eq("uid", w.user_id);

      await supabase
        .from("withdrawals")
        .update({ status: "rejected" })
        .eq("id", id);

      await loadWithdrawals();
      toast.success("Rejected.");
    } catch {
      toast.error("Error.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const filtered = useMemo(() => {
    let list = [...withdrawals];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((w) => {
        return (
          (w.user?.full_name || "").toLowerCase().includes(q) ||
          (w.user?.email || "").toLowerCase().includes(q) ||
          (w.wallet?.address || "").toLowerCase().includes(q) ||
          w.id.toLowerCase().includes(q)
        );
      });
    }

    if (statusFilter !== "all") {
      list = list.filter((w) => w.status === statusFilter);
    }

    if (sortBy === "created_desc") {
      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sortBy === "created_asc") {
      list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else if (sortBy === "amount_desc") {
      list.sort((a, b) => Number(b.amount) - Number(a.amount));
    } else if (sortBy === "amount_asc") {
      list.sort((a, b) => Number(a.amount) - Number(b.amount));
    }

    return list;
  }, [withdrawals, query, statusFilter, sortBy]);

  return (
    <div className="p-6 space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Withdraw Control</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={toggleWithdraw}
              className={withdrawEnabled ? "bg-red-600" : "bg-green-600"}
            >
              {isSaving ? "Saving..." : withdrawEnabled ? "Disable Withdrawals" : "Enable Withdrawals"}
            </Button>
            <div className="text-sm">
              Status:
              {withdrawEnabled ? (
                <span className="text-green-400 ml-2">Enabled</span>
              ) : (
                <span className="text-red-400 ml-2">Disabled</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">Fee Percentage (%)</label>
            <Input
              type="number"
              className="w-28"
              value={feePercentage}
              onChange={(e) => setFeePercentage(Number(e.target.value || 0))}
            />
            <Button onClick={saveFeePercentage} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Search />
              <Input
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest</SelectItem>
                <SelectItem value="created_asc">Oldest</SelectItem>
                <SelectItem value="amount_desc">Amount ↓</SelectItem>
                <SelectItem value="amount_asc">Amount ↑</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm">{filtered.length} results</div>
          </div>

          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="animate-spin h-6 w-6 mx-auto" />
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-lg border bg-background/5 flex justify-between items-start gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-semibold">
                        ${Number(w.amount).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {w.user?.full_name || w.user?.email || "Unknown"}
                        <div className="text-xs">{w.user?.email}</div>
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      Fee: ${Number(w.fee).toFixed(2)} • Net: $
                      {Number(w.net_amount).toFixed(2)}
                      <div className="text-xs mt-1">
                        Date: {new Date(w.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Badge
                      className={
                        w.status === "approved"
                          ? "bg-green-600 text-white"
                          : w.status === "rejected"
                          ? "bg-red-600 text-white"
                          : "bg-yellow-500 text-black"
                      }
                    >
                      {w.status}
                    </Badge>

                    <div className="flex gap-2">
                      {w.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600"
                            onClick={() => approveWithdrawal(w.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600"
                            onClick={() => rejectWithdrawal(w.id)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  No results
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
