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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

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
  wallet_id: string;
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
  const [minWithdrawAmount, setMinWithdrawAmount] = useState<number>(21);
  const [isSaving, setIsSaving] = useState(false);

  // search / filter / sort
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_desc");

  // modal details
  const [openId, setOpenId] = useState<string | null>(null);
  const activeWithdrawal = useMemo(
    () => withdrawals.find((w) => w.id === openId) || null,
    [withdrawals, openId]
  );

  // --- load control (withdrawal_control)
  useEffect(() => {
    const loadControl = async () => {
      try {
        const { data, error } = await supabase
          .from("withdrawal_control")
          .select("is_enabled")
          .limit(1)
          .single();
        if (!error && data) setWithdrawEnabled(Boolean(data.is_enabled));
      } catch (err) {
        console.error("loadControl error", err);
      }
    };
    loadControl();
  }, []);

  // --- load settings (fee and min)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("withdrawal_settings")
          .select("fee_percentage, min_withdraw_amount")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          if (data.fee_percentage !== undefined && data.fee_percentage !== null)
            setFeePercentage(Number(data.fee_percentage));
          if (
            data.min_withdraw_amount !== undefined &&
            data.min_withdraw_amount !== null
          )
            setMinWithdrawAmount(Number(data.min_withdraw_amount));
        }
      } catch (err) {
        console.error("loadSettings error", err);
      }
    };
    loadSettings();
  }, []);

  // --- load withdrawals manual and merge users+wallets
  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const { data: wdRows, error: wdErr } = await supabase
        .from<WithdrawalRow>("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });

      if (wdErr) {
        console.error("Failed to fetch withdrawals", wdErr);
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

      const userIds = Array.from(new Set(wd.map((r) => r.user_id).filter(Boolean)));
      const walletIds = Array.from(new Set(wd.map((r) => r.wallet_id).filter(Boolean)));

      const { data: users, error: usersErr } = await supabase
        .from<UserProfile>("user_profiles")
        .select("uid, full_name, email, balance")
        .in("uid", userIds);

      if (usersErr) console.error("Failed to fetch users", usersErr);

      const { data: wallets, error: walletsErr } = await supabase
        .from<Wallet>("withdrawal_wallets")
        .select("id, user_id, asset, address, label")
        .in("id", walletIds);

      if (walletsErr) console.error("Failed to fetch wallets", walletsErr);

      const enriched: EnrichedWithdrawal[] = wd.map((r) => {
        const user = users?.find((u) => u.uid === r.user_id) ?? null;
        const wallet = wallets?.find((w) => w.id === r.wallet_id) ?? null;
        return { ...r, user, wallet };
      });

      setWithdrawals(enriched);
    } catch (err) {
      console.error("loadWithdrawals unexpected", err);
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  // toggle withdraw: update withdrawal_control (single row)
  const toggleWithdraw = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("withdrawal_control").upsert(
        { id: 1, is_enabled: !withdrawEnabled, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      if (error) throw error;
      setWithdrawEnabled((s) => !s);
      toast.success(`Withdrawals ${!withdrawEnabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      console.error("toggleWithdraw error", err);
      toast.error("Error updating withdrawal control.");
    } finally {
      setIsSaving(false);
    }
  };

  // save settings: insert new row in withdrawal_settings (keeps history)
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("withdrawal_settings").insert([
        { fee_percentage: feePercentage, min_withdraw_amount: minWithdrawAmount, withdraw_enabled: withdrawEnabled },
      ]);
      if (error) throw error;
      toast.success("Settings saved.");
    } catch (err) {
      console.error("saveSettings error", err);
      toast.error("Error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // Approve: mark approved (balance was deducted at creation)
  const approveWithdrawal = async (id: string) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w) return toast.error("Withdrawal not found.");
    if (w.status !== "pending") return toast.error("Only pending withdrawals can be approved.");

    const t = toast.loading("Approving withdrawal...");
    try {
      const { error } = await supabase
        .from("withdrawals")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await loadWithdrawals();
      toast.success("Withdrawal approved.");
    } catch (err) {
      console.error("approveWithdrawal error", err);
      toast.error("Error approving withdrawal.");
    } finally {
      toast.dismiss(t);
    }
  };

  // Reject: refund (since we deducted at creation), then mark rejected
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

      const newBalance = Number(userRow.balance || 0) + Number(w.amount);

      const { error: updUserErr } = await supabase
        .from("user_profiles")
        .update({ balance: newBalance })
        .eq("uid", w.user_id);

      if (updUserErr) throw updUserErr;

      const { error: updWErr } = await supabase
        .from("withdrawals")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updWErr) throw updWErr;

      await loadWithdrawals();
      toast.success("Withdrawal rejected and refunded.");
    } catch (err) {
      console.error("rejectWithdrawal error", err);
      toast.error("Error rejecting withdrawal.");
    } finally {
      toast.dismiss(t);
    }
  };

  // search/filter/sort computed
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
    if (statusFilter !== "all") list = list.filter((w) => w.status === statusFilter);
    if (sortBy === "created_desc") list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sortBy === "created_asc") list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sortBy === "amount_desc") list.sort((a, b) => Number(b.amount) - Number(a.amount));
    if (sortBy === "amount_asc") list.sort((a, b) => Number(a.amount) - Number(b.amount));
    return list;
  }, [withdrawals, query, statusFilter, sortBy]);

  // ---------------------
  // Statistics (UTC)
  // ---------------------
  const stats = useMemo(() => {
    // total withdrawals sum of amount (all statuses)
    const total = withdrawals.reduce((acc, w) => acc + Number(w.amount || 0), 0);

    // counts by status
    const pendingCount = withdrawals.filter((w) => w.status === "pending").length;
    const approvedCount = withdrawals.filter((w) => w.status === "approved").length;
    const rejectedCount = withdrawals.filter((w) => w.status === "rejected").length;

    // today's range in UTC
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDate = now.getUTCDate();
    const dayStartUtc = Date.UTC(utcYear, utcMonth, utcDate, 0, 0, 0, 0);
    const dayEndUtc = dayStartUtc + 24 * 60 * 60 * 1000;

    const todays = withdrawals.filter((w) => {
      const t = new Date(w.created_at).getTime();
      return t >= dayStartUtc && t < dayEndUtc;
    });

    const totalToday = todays.reduce((acc, w) => acc + Number(w.amount || 0), 0);
    const countToday = todays.length;

    return {
      total,
      totalToday,
      countToday,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  }, [withdrawals]);

  const fmt = (n: number) => {
    // basic formatting with 2 decimals for amounts
    return isFinite(n) ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Statistics Card (top) */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawals Statistics (UTC)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 border rounded">
            <div className="text-sm text-muted-foreground">Total Withdrawals</div>
            <div className="text-xl font-semibold">${fmt(stats.total)}</div>
          </div>

          <div className="p-3 border rounded">
            <div className="text-sm text-muted-foreground">Total Withdrawals Today (UTC)</div>
            <div className="text-xl font-semibold">${fmt(stats.totalToday)}</div>
            <div className="text-xs text-muted-foreground mt-1">Count today: {stats.countToday}</div>
          </div>

          <div className="p-3 border rounded grid grid-cols-1 gap-2">
            <div className="flex justify-between">
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="font-semibold">{stats.pendingCount}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-sm text-muted-foreground">Approved</div>
              <div className="font-semibold">{stats.approvedCount}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-sm text-muted-foreground">Rejected</div>
              <div className="font-semibold">{stats.rejectedCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <label className="text-sm">Min Withdraw (USD)</label>
            <Input type="number" className="w-28" value={minWithdrawAmount} onChange={(e) => setMinWithdrawAmount(Number(e.target.value || 0))} />
            <Button onClick={saveSettings} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
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
              <Input placeholder="Search by user, email, wallet, id..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest first</SelectItem>
                <SelectItem value="created_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Amount desc</SelectItem>
                <SelectItem value="amount_asc">Amount asc</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">{filtered.length} results</div>
          </div>

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

      <Dialog open={!!openId} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdrawal Details</DialogTitle>
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
