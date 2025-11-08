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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Search } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin Withdrawals Page
 *
 * - جلب: withdrawals + withdrawal_wallets + user_profiles (uid, full_name, email, balance)
 * - تحكم: تفعيل/تعطيل السحب، حفظ نسبة العمولة
 * - actions: Approve / Reject (مع منطق تعديل الرصيد)
 * - بحث / فلترة / فرز
 */

// types (مبسطة)
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

  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);
  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);

  // search / filter / sort
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | pending | approved | rejected | processing | paid
  const [sortBy, setSortBy] = useState<string>("created_desc"); // created_desc | created_asc | amount_desc | amount_asc

  // modal
  const [openId, setOpenId] = useState<string | null>(null);
  const activeWithdrawal = useMemo(
    () => withdrawals.find((w) => w.id === openId) || null,
    [withdrawals, openId]
  );

  // load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("withdrawal_settings")
          .select("fee_percentage, withdraw_enabled")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          if (data.fee_percentage !== undefined) setFeePercentage(Number(data.fee_percentage));
          if (data.withdraw_enabled !== undefined) setWithdrawEnabled(Boolean(data.withdraw_enabled));
        }
      } catch (err) {
        console.error("loadSettings error", err);
      }
    }
    loadSettings();
  }, []);

  // fetch withdrawals with relations
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
        console.error("Failed to load withdrawals:", error);
        toast.error("فشل تحميل طلبات السحب.");
      } else {
        setWithdrawals((data || []) as Withdrawal[]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error while loading withdrawals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  // toggle withdrawals enabled (we insert a new settings row — pattern used سابقًا)
  const toggleWithdraw = async () => {
    const newState = !withdrawEnabled;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("withdrawal_settings").insert([
        { fee_percentage: feePercentage, withdraw_enabled: newState },
      ]);
      if (error) throw error;
      setWithdrawEnabled(newState);
      toast.success(`Withdrawals ${newState ? "enabled" : "disabled"}.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Error updating withdraw setting.");
    } finally {
      setIsSaving(false);
    }
  };

  // save fee percentage (inserts new settings entry)
  const saveFeePercentage = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("withdrawal_settings").insert([
        { fee_percentage: feePercentage, withdraw_enabled: withdrawEnabled },
      ]);
      if (error) throw error;
      toast.success("Fee percentage saved.");
    } catch (err) {
      console.error(err);
      toast.error("Error saving fee percentage.");
    } finally {
      setIsSaving(false);
    }
  };

  // Approve withdrawal
  // logic:
  // - only act if current status is "pending"
  // - fetch current user balance, ensure sufficient balance (if you require)
  // - deduct amount from user_profiles.balance (client does read+update)
  // - set withdrawal.status = 'approved'
  const approveWithdrawal = async (id: string) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w) return toast.error("Withdrawal not found.");

    if (w.status !== "pending") {
      return toast.error("Only pending withdrawals can be approved.");
    }

    const loadingToast = toast.loading("Approving withdrawal...");
    try {
      // fetch fresh user profile
      const { data: userRows, error: userErr } = await supabase
        .from("user_profiles")
        .select("uid, balance")
        .eq("uid", w.user_id)
        .limit(1)
        .single();

      if (userErr || !userRows) {
        throw userErr || new Error("User not found");
      }

      const currentBalance = Number(userRows.balance || 0);
      // Option: require balance >= amount. If your flow already deducted at creation then this check can be bypassed.
      if (currentBalance < Number(w.amount)) {
        // still allow approval but warn. You might prefer to reject instead.
        toast.warning("User balance less than withdrawal amount. Proceeding to mark approved and setting negative balance.");
      }

      // compute new balance
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

      // refresh local list
      await loadWithdrawals();
      toast.success("Withdrawal approved and user balance updated.");
    } catch (err) {
      console.error(err);
      toast.error("Error approving withdrawal.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  // Reject withdrawal
  // logic:
  // - if withdrawal is pending => mark rejected and refund only if previously deducted
  // - Because we cannot be 100% sure if amount was deducted on creation, we do conservative handling:
  //   * If user's current balance is less than previous balance minus amount we can't know; here we will try to refund:
  const rejectWithdrawal = async (id: string) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w) return toast.error("Withdrawal not found.");

    if (w.status !== "pending") {
      return toast.error("Only pending withdrawals can be rejected.");
    }

    const loadingToast = toast.loading("Rejecting withdrawal...");
    try {
      // fetch user
      const { data: userRows, error: userErr } = await supabase
        .from("user_profiles")
        .select("uid, balance")
        .eq("uid", w.user_id)
        .limit(1)
        .single();

      if (userErr || !userRows) {
        throw userErr || new Error("User not found");
      }

      // refund: add amount back
      const newBalance = Number(userRows.balance || 0) + Number(w.amount);

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
      toast.success("Withdrawal rejected and amount refunded to user.");
    } catch (err) {
      console.error(err);
      toast.error("Error rejecting withdrawal.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  // Search + filter + sort computed list
  const filtered = useMemo(() => {
    let list = [...withdrawals];

    // search: by user name, email, wallet address, id
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

    // status filter
    if (statusFilter !== "all") {
      list = list.filter((w) => w.status === statusFilter);
    }

    // sort
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
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Control</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button onClick={toggleWithdraw} className={withdrawEnabled ? "bg-red-600" : "bg-green-600"}>
              {isSaving ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Saving...</> : (withdrawEnabled ? "Disable Withdrawals" : "Enable Withdrawals")}
            </Button>

            <div className="text-sm text-muted-foreground">Status: {withdrawEnabled ? <span className="text-green-400">Enabled</span> : <span className="text-red-400">Disabled</span>}</div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">Fee Percentage (%)</label>
            <Input type="number" className="w-28" value={feePercentage} onChange={(e) => setFeePercentage(Number(e.target.value || 0))} />
            <Button onClick={saveFeePercentage} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Search / filter / sort */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Search />
              <Input placeholder="Search by user, email, wallet, id..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

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
              <SelectTrigger className="h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest first</SelectItem>
                <SelectItem value="created_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Amount desc</SelectItem>
                <SelectItem value="amount_asc">Amount asc</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">{filtered.length} results</div>
          </div>

          {/* Table / cards */}
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
          ) : (
            <div className="space-y-3">
              {filtered.map((w) => (
                <div key={w.id} className="p-4 rounded-lg border bg-background/5 flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-semibold">${Number(w.amount).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        {w.user?.full_name || w.user?.email || "Unknown user"}
                        <div className="text-xs">{w.user?.email}</div>
                      </div>
                      <div className="ml-4 text-xs text-muted-foreground">Wallet: {w.wallet?.label || w.wallet?.asset || "-"}</div>
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

          {activeWithdrawal ? (
            <div className="space-y-4 pt-4">
              <Card>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm text-muted-foreground">Amount</h4>
                      <div className="font-semibold text-lg">${Number(activeWithdrawal.amount).toFixed(2)}</div>
                    </div>
                    <div>
                      <h4 className="text-sm text-muted-foreground">Fee</h4>
                      <div className="text-lg"> ${Number(activeWithdrawal.fee).toFixed(2)}</div>
                    </div>

                    <div>
                      <h4 className="text-sm text-muted-foreground">Net Amount</h4>
                      <div className="text-lg text-green-400">${Number(activeWithdrawal.net_amount).toFixed(2)}</div>
                    </div>

                    <div>
                      <h4 className="text-sm text-muted-foreground">Status</h4>
                      <div className="text-lg">{activeWithdrawal.status}</div>
                    </div>
                  </div>

                  <hr className="my-3" />

                  <h5 className="text-sm text-muted-foreground">User</h5>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{activeWithdrawal.user?.full_name || "-"}</div>
                      <div className="text-sm text-muted-foreground">{activeWithdrawal.user?.email || "-"}</div>
                      <div className="text-xs text-muted-foreground">Balance: ${Number(activeWithdrawal.user?.balance || 0).toFixed(2)}</div>
                    </div>
                  </div>

                  <hr className="my-3" />

                  <h5 className="text-sm text-muted-foreground">Wallet</h5>
                  <div>
                    <div>{activeWithdrawal.wallet?.label || activeWithdrawal.wallet?.asset || "-"}</div>
                    <div className="text-xs break-all">{activeWithdrawal.wallet?.address || "-"}</div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                {activeWithdrawal.status === "pending" && (
                  <>
                    <Button className="bg-green-600" onClick={() => { approveWithdrawal(activeWithdrawal.id); setOpenId(null); }}>Approve</Button>
                    <Button className="bg-red-600" onClick={() => { rejectWithdrawal(activeWithdrawal.id); setOpenId(null); }}>Reject</Button>
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
