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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin Withdrawals Page
 * - يربط المحافظ باستخدام user_id (كما طلبت)
 * - يستخدم جدول withdrawal_control لتمكين/تعطيل السحب (single row)
 * - يستخدم جدول withdrawal_settings لحفظ/قراءة fee_percentage
 * - تحميل يدوي: withdrawals -> users -> wallets -> دمج محلي
 * - Approve/Reject مع تعديل رصيد المستخدمين
 *
 * ملاحظة: تأكد أن جداولك تحتوي الحقول المذكورة.
 */

// Types
type Wallet = {
  id: string;
  user_id: string;
  asset?: string | null;
  address?: string | null;
  label?: string | null;
};

type UserProfile = {
  uid: string;
  full_name?: string | null;
  email?: string | null;
  balance?: number | null;
};

type WithdrawalRow = {
  id: string;
  user_id: string;
  wallet_id: string | null;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  updated_at?: string;
};

type EnrichedWithdrawal = WithdrawalRow & {
  user?: UserProfile | null;
  wallet?: Wallet | null;
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<EnrichedWithdrawal[]>([]);
  const [loading, setLoading] = useState(false);

  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);
  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);

  // search/filter/sort
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_desc");

  // modal
  const [openId, setOpenId] = useState<string | null>(null);
  const active = useMemo(
    () => withdrawals.find((w) => w.id === openId) || null,
    [withdrawals, openId]
  );

  // --------- load settings ----------
  useEffect(() => {
    async function loadSettings() {
      try {
        // 1) withdrawal_control (single row controlling enable/disable)
        const { data: controlData, error: controlErr } = await supabase
          .from("withdrawal_control")
          .select("is_enabled")
          .limit(1)
          .single();

        if (!controlErr && controlData && controlData.is_enabled !== undefined) {
          setWithdrawEnabled(Boolean(controlData.is_enabled));
        }

        // 2) withdrawal_settings (fee percentage latest row)
        const { data: setData, error: setErr } = await supabase
          .from("withdrawal_settings")
          .select("fee_percentage")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (!setErr && setData && setData.fee_percentage !== undefined) {
          setFeePercentage(Number(setData.fee_percentage));
        }
      } catch (err) {
        console.error("loadSettings error", err);
      }
    }
    loadSettings();
  }, []);

  // --------- load withdrawals (manual merge using user_id) ----------
  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      // 1. fetch withdrawals
      const { data: wdRows, error: wdErr } = await supabase
        .from<WithdrawalRow>("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });

      if (wdErr) {
        console.error("Failed to fetch withdrawals", wdErr);
        toast.error("فشل تحميل طلبات السحب.");
        setWithdrawals([]);
        setLoading(false);
        return;
      }

      const wd = wdRows || [];
      if (wd.length === 0) {
        setWithdrawals([]);
        setLoading(false);
        return;
      }

      // 2. collect unique user_ids
      const userIds = Array.from(new Set(wd.map((r) => r.user_id).filter(Boolean)));

      // 3. fetch users
      const { data: users, error: usersErr } = await supabase
        .from<UserProfile>("user_profiles")
        .select("uid, full_name, email, balance")
        .in("uid", userIds);

      if (usersErr) {
        console.error("Failed to fetch users", usersErr);
      }

      // 4. fetch wallets by user_id (we will match wallet by user_id)
      const { data: wallets, error: walletsErr } = await supabase
        .from<Wallet>("withdrawal_wallets")
        .select("id, user_id, asset, address, label")
        .in("user_id", userIds);

      if (walletsErr) {
        console.error("Failed to fetch wallets", walletsErr);
      }

      // 5. merge manually: find wallet by user_id (as you requested)
      const enriched: EnrichedWithdrawal[] = wd.map((r) => {
        const user = users?.find((u) => u.uid === r.user_id) ?? null;
        // choose wallet by user_id — if multiple wallets exist, pick first (you can adjust)
        const wallet = wallets?.find((w) => w.user_id === r.user_id) ?? null;
        return { ...r, user, wallet };
      });

      setWithdrawals(enriched);
    } catch (err) {
      console.error("loadWithdrawals unexpected", err);
      toast.error("خطأ غير متوقع أثناء تحميل السحوبات.");
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  // --------- toggle withdraw control (update withdrawal_control table)
  const toggleWithdraw = async () => {
    setIsSaving(true);
    try {
      const newState = !withdrawEnabled;

      // update existing row if exists else insert
      // try update id = 1
      const { error: updErr } = await supabase
        .from("withdrawal_control")
        .upsert({ id: 1, is_enabled: newState }, { onConflict: "id" });

      if (updErr) throw updErr;

      // also insert a settings row to keep history of fee state optionally
      await supabase.from("withdrawal_settings").insert([
        { fee_percentage: feePercentage, withdraw_enabled: newState },
      ]);

      setWithdrawEnabled(newState);
      toast.success(newState ? "Withdrawals enabled" : "Withdrawals disabled");
    } catch (err) {
      console.error("toggleWithdraw error", err);
      toast.error("خطأ أثناء تحديث حالة السحب");
    } finally {
      setIsSaving(false);
    }
  };

  // --------- save fee percentage only (insert history)
  const saveFeePercentage = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("withdrawal_settings").insert([
        { fee_percentage: feePercentage, withdraw_enabled: withdrawEnabled },
      ]);
      if (error) throw error;
      toast.success("تم حفظ نسبة العمولة");
    } catch (err) {
      console.error("saveFeePercentage error", err);
      toast.error("خطأ أثناء حفظ نسبة العمولة");
    } finally {
      setIsSaving(false);
    }
  };

  // --------- approve withdrawal: deduct balance and set approved
  const approveWithdrawal = async (id: string) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w) return toast.error("Withdrawal not found.");
    if (w.status !== "pending") return toast.error("Only pending withdrawals can be approved.");

    const t = toast.loading("Approving withdrawal...");
    try {
      // fetch fresh user row
      const { data: userRow, error: userErr } = await supabase
        .from<UserProfile>("user_profiles")
        .select("uid, balance")
        .eq("uid", w.user_id)
        .limit(1)
        .single();

      if (userErr || !userRow) throw userErr || new Error("User not found");

      const currentBalance = Number(userRow.balance || 0);

      // Deduct amount from balance
      const newBalance = currentBalance - Number(w.amount);

      // update user balance
      const { error: updUserErr } = await supabase
        .from("user_profiles")
        .update({ balance: newBalance })
        .eq("uid", w.user_id);

      if (updUserErr) throw updUserErr;

      // update withdrawal status
      const { error: updWErr } = await supabase
        .from("withdrawals")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updWErr) throw updWErr;

      await loadWithdrawals();
      toast.success("Withdrawal approved and balance updated.");
    } catch (err) {
      console.error("approveWithdrawal error", err);
      toast.error("Error approving withdrawal.");
    } finally {
      toast.dismiss(t);
    }
  };

  // --------- reject withdrawal: refund and set rejected
  const rejectWithdrawal = async (id: string) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w) return toast.error("Withdrawal not found.");
    if (w.status !== "pending") return toast.error("Only pending withdrawals can be rejected.");

    const t = toast.loading("Rejecting withdrawal...");
    try {
      // fetch fresh user
      const { data: userRow, error: userErr } = await supabase
        .from<UserProfile>("user_profiles")
        .select("uid, balance")
        .eq("uid", w.user_id)
        .limit(1)
        .single();

      if (userErr || !userRow) throw userErr || new Error("User not found");

      // refund amount back
      const newBalance = Number(userRow.balance || 0) + Number(w.amount);

      const { error: updUserErr } = await supabase
        .from("user_profiles")
        .update({ balance: newBalance })
        .eq("uid", w.user_id);

      if (updUserErr) throw updUserErr;

      // update withdrawal status
      const { error: updWErr } = await supabase
        .from("withdrawals")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updWErr) throw updWErr;

      await loadWithdrawals();
      toast.success("Withdrawal rejected and amount refunded.");
    } catch (err) {
      console.error("rejectWithdrawal error", err);
      toast.error("Error rejecting withdrawal.");
    } finally {
      toast.dismiss(t);
    }
  };

  // --------- filtered list (search, filter, sort) ----------
  const filtered = useMemo(() => {
    let list = [...withdrawals];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((w) => {
        const name = (w.user?.full_name || "").toLowerCase();
        const email = (w.user?.email || "").toLowerCase();
        const addr = (w.wallet?.address || "").toLowerCase();
        const id = (w.id || "").toLowerCase();
        return name.includes(q) || email.includes(q) || addr.includes(q) || id.includes(q);
      });
    }

    if (statusFilter !== "all") {
      list = list.filter((w) => w.status === statusFilter);
    }

    if (sortBy === "created_desc") list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sortBy === "created_asc") list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else if (sortBy === "amount_desc") list.sort((a, b) => Number(b.amount) - Number(a.amount));
    else if (sortBy === "amount_asc") list.sort((a, b) => Number(a.amount) - Number(b.amount));

    return list;
  }, [withdrawals, query, statusFilter, sortBy]);

  // ---------- UI ----------
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Control</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <Button
              onClick={toggleWithdraw}
              className={withdrawEnabled ? "bg-red-600" : "bg-green-600"}
            >
              {isSaving ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Saving...</> : (withdrawEnabled ? "Disable Withdrawals" : "Enable Withdrawals")}
            </Button>

            <div className="text-sm text-muted-foreground mt-2 sm:mt-0">
              Status: {withdrawEnabled ? <span className="text-green-400">Enabled</span> : <span className="text-red-400">Disabled</span>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
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

      {/* Search / Filter / Sort */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search />
              <Input
                placeholder="Search by user, email, wallet, id..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="flex gap-2 items-center">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="h-10 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                <SelectTrigger className="h-10 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">Newest first</SelectItem>
                  <SelectItem value="created_asc">Oldest first</SelectItem>
                  <SelectItem value="amount_desc">Amount desc</SelectItem>
                  <SelectItem value="amount_asc">Amount asc</SelectItem>
                </SelectContent>
              </Select>

              <div className="ml-auto text-sm text-muted-foreground hidden md:block">{filtered.length} results</div>
            </div>
          </div>

          {/* Cards responsive list */}
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
          ) : (
            <div className="space-y-3">
              {filtered.map((w) => (
                <div key={w.id} className="p-4 rounded-lg border bg-background/5 flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                      <div className="text-xl font-semibold">${Number(w.amount).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {w.user?.full_name || w.user?.email || "Unknown user"}
                        <div className="text-xs">{w.user?.email}</div>
                      </div>
                      <div className="ml-0 sm:ml-4 text-xs text-muted-foreground mt-2 sm:mt-0">
                        Wallet: {w.wallet?.label || w.wallet?.asset || "-"}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      Fee: ${Number(w.fee).toFixed(2)} • Net: ${Number(w.net_amount).toFixed(2)}
                      <div className="text-xs mt-1">Date: {new Date(w.created_at).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Badge className={
                      w.status === "approved" ? "bg-green-600 text-white" :
                      w.status === "rejected" ? "bg-red-600 text-white" :
                      "bg-yellow-500 text-black"
                    }>
                      {w.status}
                    </Badge>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setOpenId(w.id)}>Details</Button>
                      {w.status === "pending" && (
                        <>
                          <Button size="sm" className="bg-green-600" onClick={() => approveWithdrawal(w.id)}>Approve</Button>
                          <Button size="sm" className="bg-red-600" onClick={() => rejectWithdrawal(w.id)}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && <div className="p-6 text-center text-muted-foreground">لا توجد نتائج</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={!!openId} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdrawal Details</DialogTitle>
            <DialogDescription>تفاصيل الطلب والمستخدم والمحفظة</DialogDescription>
          </DialogHeader>

          {active ? (
            <div className="space-y-4 pt-4">
              <Card>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm text-muted-foreground">Amount</h4>
                      <div className="font-semibold text-lg">${Number(active.amount).toFixed(2)}</div>
                    </div>
                    <div>
                      <h4 className="text-sm text-muted-foreground">Fee</h4>
                      <div className="text-lg"> ${Number(active.fee).toFixed(2)}</div>
                    </div>

                    <div>
                      <h4 className="text-sm text-muted-foreground">Net Amount</h4>
                      <div className="text-lg text-green-400">${Number(active.net_amount).toFixed(2)}</div>
                    </div>

                    <div>
                      <h4 className="text-sm text-muted-foreground">Status</h4>
                      <div className="text-lg">{active.status}</div>
                    </div>
                  </div>

                  <hr className="my-3" />

                  <h5 className="text-sm text-muted-foreground">User</h5>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{active.user?.full_name || "-"}</div>
                      <div className="text-sm text-muted-foreground">{active.user?.email || "-"}</div>
                      <div className="text-xs text-muted-foreground">Balance: ${Number(active.user?.balance || 0).toFixed(2)}</div>
                    </div>
                  </div>

                  <hr className="my-3" />

                  <h5 className="text-sm text-muted-foreground">Wallet</h5>
                  <div>
                    <div>{active.wallet?.label || active.wallet?.asset || "-"}</div>
                    <div className="text-xs break-all">{active.wallet?.address || "-"}</div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                {active.status === "pending" && (
                  <>
                    <Button className="bg-green-600" onClick={() => { approveWithdrawal(active.id); setOpenId(null); }}>Approve</Button>
                    <Button className="bg-red-600" onClick={() => { rejectWithdrawal(active.id); setOpenId(null); }}>Reject</Button>
                  </>
                )}
                <Button onClick={() => setOpenId(null)}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">Loading...</div>
          )}

          <DialogFooter />
        </DialogContent>
      </Dialog>
    </div>
  );
}
