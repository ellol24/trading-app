"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle2, XCircle, ImageIcon, Clock, DollarSign, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { processDepositCommissions } from "@/lib/actions/commissions";

type RealDeposit = {
  id: string;
  user_id: string;
  amount: number;
  status: "pending" | "confirmed" | "rejected" | "expired";
  payment_method: string;
  transaction_id: string | null;
  proof_url: string | null;
  rejection_reason: string | null;
  created_at: string;
  user_profiles?: {
    full_name: string | null;
    email: string | null;
  };
};

export default function AdminDepositsPage() {
  const [items, setItems] = useState<RealDeposit[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "confirmed" | "rejected">("all");

  const [selected, setSelected] = useState<RealDeposit | null>(null);
  const [viewProof, setViewProof] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [txId, setTxId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  const fetchDeposits = async () => {
    const { data, error } = await supabase
      .from("deposits")
      .select(`
        *,
        user_profiles (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching deposits", description: error.message, variant: "destructive" });
    } else {
      setItems(data || []);
    }
  };

  useEffect(() => {
    fetchDeposits();

    const channel = supabase
      .channel("admin-deposits")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deposits" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast({
              title: "New Deposit Alert",
              description: "A new deposit request has just arrived.",
            });
            fetchDeposits();
          } else {
            // Re-fetch on updates or deletes
            fetchDeposits();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((d) => {
      const matchQ =
        !q ||
        d.id.toLowerCase().includes(q) ||
        (d.user_profiles?.full_name?.toLowerCase().includes(q) ?? false) ||
        (d.user_profiles?.email?.toLowerCase().includes(q) ?? false) ||
        (d.transaction_id?.toLowerCase().includes(q) ?? false);
      const matchStatus = status === "all" || d.status === status;
      return matchQ && matchStatus;
    });
  }, [items, query, status]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((d) => d.status === "pending").length,
      confirmed: items.filter((d) => d.status === "confirmed").length,
      rejected: items.filter((d) => d.status === "rejected").length,
      totalAmount: items.reduce((sum, d) => sum + Number(d.amount), 0),
    };
  }, [items]);

  const statusBadge = (s: RealDeposit["status"]) => {
    switch (s) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-600">Pending</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500/20 text-green-600 border-green-600">Confirmed</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-600 border-red-600">Rejected</Badge>;
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  };

  const openConfirm = (d: RealDeposit) => {
    setSelected(d);
    setTxId(d.transaction_id || "");
    setConfirmOpen(true);
  };

  const openReject = (d: RealDeposit) => {
    setSelected(d);
    setReason(d.rejection_reason || "");
    setRejectOpen(true);
  };

  const doConfirm = async () => {
    if (!selected) return;
    setLoading(true);

    // 1. Update deposit status
    const { error: updateErr } = await supabase
      .from("deposits")
      .update({ status: "confirmed", transaction_id: txId })
      .eq("id", selected.id);

    if (updateErr) {
      toast({ title: "Error", description: updateErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // 2. Fund user's wallet
    const { error: rpcErr } = await supabase.rpc("update_wallet_balance", {
      p_user_id: selected.user_id,
      p_currency: "USD",
      p_amount: selected.amount,
      p_transaction_type: "deposit",
    });

    if (rpcErr) {
      toast({ title: "Wallet Error", description: "Deposit marked confirmed, but balance update failed: " + rpcErr.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Deposit confirmed and funds added to user wallet." });

      // 3. Process any applicable referral commissions silently in the background
      await processDepositCommissions(selected.user_id, Number(selected.amount));

      fetchDeposits();
    }

    setConfirmOpen(false);
    setSelected(null);
    setTxId("");
    setLoading(false);
  };

  const doReject = async () => {
    if (!selected) return;
    setLoading(true);

    const { error } = await supabase
      .from("deposits")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", selected.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Deposit request rejected." });
      fetchDeposits();
    }

    setRejectOpen(false);
    setSelected(null);
    setReason("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Deposits</h1>
            <p className="text-slate-400 mt-1">Review and approve user deposit requests from the database.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/50 bg-yellow-400/10 py-1.5 px-3">
              <Clock className="w-3.5 h-3.5 mr-2" />
              {counts.pending} Pending
            </Badge>
            <Badge variant="outline" className="text-green-400 border-green-400/50 bg-green-400/10 py-1.5 px-3">
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              {counts.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} Total Vol
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white text-lg">Filters & Search</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <Input
                  placeholder="Search by ID, user, email, or TXID"
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-200 focus:ring-indigo-500/50 block h-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 h-10">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectItem value="all">All Deposits</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Records */}
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-white text-lg">Records ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800/50">
              {filtered.map((d) => (
                <div key={d.id} className="p-5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-white flex items-center gap-2">
                        {d.user_profiles?.full_name || "Unknown User"}
                        <span className="text-slate-500 font-normal text-sm">({d.user_profiles?.email || "No email"})</span>
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs">{d.payment_method || "crypto"}</span>
                        <span>•</span>
                        <span className="font-mono text-xs" title="Transaction ID">
                          {d.transaction_id ? d.transaction_id : "No TXID"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-mono">ID: {d.id}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right mr-4">
                        <div className="text-2xl font-bold text-emerald-400">${Number(d.amount).toFixed(2)}</div>
                        <div className="text-xs text-slate-500">{new Date(d.created_at).toLocaleString()}</div>
                      </div>

                      <div className="w-24 flex justify-end">
                        {statusBadge(d.status)}
                      </div>

                      <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
                        {d.proof_url && (
                          <Button size="sm" variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-white" onClick={() => { setSelected(d); setViewProof(true); }}>
                            <ImageIcon className="w-4 h-4 mr-2" /> Proof
                          </Button>
                        )}
                        {d.status === "pending" && (
                          <>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openConfirm(d)}>
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
                            </Button>
                            <Button size="sm" variant="destructive" className="bg-red-900/50 hover:bg-red-900/80 text-red-400" onClick={() => openReject(d)}>
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {d.rejection_reason && (
                    <div className="mt-4 p-3 rounded-md bg-red-950/30 border border-red-900/50 flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Rejection Reason</p>
                        <p className="text-sm text-slate-300">{d.rejection_reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  No deposits match your search criteria.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proof Dialog */}
        <Dialog open={viewProof} onOpenChange={setViewProof}>
          <DialogContent className="max-w-3xl bg-slate-950 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>Payment Proof</DialogTitle>
              <DialogDescription className="text-slate-400">
                {selected ? `Reviewing proof for deposit of $${selected.amount}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4 bg-slate-900 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected?.proof_url || "/placeholder.svg"}
                alt="Payment proof"
                className="max-h-[70vh] rounded shadow-2xl object-contain"
              />
            </div>
            {selected?.proof_url && (
              <DialogFooter>
                <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => window.open(selected.proof_url!, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" /> Open Original
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="bg-slate-950 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Confirm Deposit
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {selected ? `Approving this will instantly add $${selected.amount} to ${selected.user_profiles?.full_name || "the user"}'s wallet.` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label className="text-sm text-slate-300">Transaction Hash (Optional)</Label>
              <Input
                placeholder="0x..."
                className="bg-slate-900 border-slate-700 text-white focus:ring-emerald-500/50"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setConfirmOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={doConfirm} disabled={loading}>
                {loading ? "Approving..." : "Confirm & Fund Wallet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="bg-slate-950 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Reject Deposit
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {selected ? `This will permanently reject the $${selected.amount} deposit request.` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label className="text-sm text-slate-300">Rejection Reason</Label>
              <Input
                placeholder="E.g., Proof invalid, funds not received..."
                className="bg-slate-900 border-slate-700 text-white focus:ring-red-500/50"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setRejectOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="destructive" className="bg-red-900/80 hover:bg-red-900 text-red-100" onClick={doReject} disabled={loading}>
                {loading ? "Rejecting..." : "Reject Deposit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
