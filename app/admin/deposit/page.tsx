"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/language-context";
import { Eye, Check, X, Loader2, RefreshCw, ZoomIn, DollarSign, Wallet, Calendar } from "lucide-react";

type Deposit = {
  id: string;
  uid: string;
  user_id?: string;
  username: string;
  email: string;
  amount: number;
  status: string;
  has_proof?: boolean;
  created_at: string;
  deposit_wallets?: {
    asset: string;
    address: string;
    label?: string | null;
  } | null;
};

type DepositSettings = {
  is_enabled: boolean;
  min_deposit_amount: number;
};

export default function AdminDepositsPage() {
  const { t } = useLanguage();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<DepositSettings>({
    is_enabled: true,
    min_deposit_amount: 10,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalAmount: 0,
    todayDeposits: 0,
    todayAmount: 0,
  });

  // Proof Lightbox state
  const [activeProofId, setActiveProofId] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofCache, setProofCache] = useState<Record<string, string>>({});

  // Action processing state
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Notification tracker
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ─── Fetch Deposits via Ultra-Fast Server API ──────────────────────────────
  const loadDeposits = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const res = await fetch("/api/admin/deposits");
      if (!res.ok) throw new Error("Failed to load deposits");
      const data = await res.json();

      if (data.ok) {
        const list: Deposit[] = data.deposits || [];

        // Check for new incoming deposits during polling
        if (isPolling && knownIdsRef.current.size > 0) {
          const newItems = list.filter((d) => !knownIdsRef.current.has(d.id));
          if (newItems.length > 0) {
            toast.info(`🔔 ${newItems.length} new deposit request${newItems.length > 1 ? "s" : ""} received!`);
            knownIdsRef.current = new Set(list.map((d) => d.id));
          }
        } else {
          knownIdsRef.current = new Set(list.map((d) => d.id));
        }

        setDeposits(list);
        if (data.stats) setStats(data.stats);
        if (data.settings) setSettings(data.settings);
      }
    } catch (err: any) {
      console.error("[AdminDepositsPage] fetch error:", err);
      if (!isPolling) toast.error("Error loading deposit data");
    } finally {
      if (!isPolling) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDeposits();

    // Lightweight polling every 6 seconds — transfers only tiny JSON metadata
    const interval = setInterval(() => {
      loadDeposits(true);
    }, 6000);

    return () => clearInterval(interval);
  }, [loadDeposits]);

  // ─── View Proof Screenshot (Lazy-loaded on demand) ────────────────────────
  const handleViewProof = async (depositId: string) => {
    setActiveProofId(depositId);

    // If already in memory cache, show instantly
    if (proofCache[depositId]) return;

    setProofLoading(true);
    try {
      const res = await fetch(`/api/admin/deposits?proofFor=${depositId}`);
      const data = await res.json();
      if (data.ok && data.proof_base64) {
        setProofCache((prev) => ({ ...prev, [depositId]: data.proof_base64 }));
      } else {
        toast.error("Failed to load proof image");
      }
    } catch (err) {
      toast.error("Error loading proof");
    } finally {
      setProofLoading(false);
    }
  };

  // ─── Save Settings ────────────────────────────────────────────────────────
  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_settings",
          is_enabled: settings.is_enabled,
          min_deposit_amount: settings.min_deposit_amount,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(t("admin.settingsSaved") || "Settings saved successfully ✅");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (err) {
      toast.error("Error saving settings");
    } finally {
      setSavingSettings(false);
    }
  }

  // ─── Approve Deposit ──────────────────────────────────────────────────────
  async function approveDeposit(dep: Deposit) {
    setProcessingId(dep.id);
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          depositId: dep.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Deposit of $${dep.amount} approved! Balance credited ✅`);
        loadDeposits(true);
      } else {
        toast.error(data.error || "Failed to approve deposit");
      }
    } catch (err) {
      toast.error("Error approving deposit");
    } finally {
      setProcessingId(null);
    }
  }

  // ─── Reject Deposit ───────────────────────────────────────────────────────
  async function rejectDeposit(dep: Deposit) {
    setProcessingId(dep.id);
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          depositId: dep.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Deposit rejected ❌");
        loadDeposits(true);
      } else {
        toast.error(data.error || "Failed to reject deposit");
      }
    } catch (err) {
      toast.error("Error rejecting deposit");
    } finally {
      setProcessingId(null);
    }
  }

  // ─── Search Filter ────────────────────────────────────────────────────────
  const filteredDeposits = deposits.filter((dep) => {
    const q = search.toLowerCase();
    return (
      (dep.username || "").toLowerCase().includes(q) ||
      (dep.email || "").toLowerCase().includes(q) ||
      (dep.uid || "").toLowerCase().includes(q) ||
      (dep.id || "").toLowerCase().includes(q) ||
      (dep.deposit_wallets?.asset || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Settings Card ── */}
      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span className="text-lg font-bold">{t("admin.depositSettings") || "Deposit Settings"}</span>
            <Button onClick={saveSettings} disabled={savingSettings} size="sm">
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {t("common.save") || "Save Changes"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, is_enabled: v }))}
            />
            <Label className="cursor-pointer">{t("admin.depositsEnabled") || "Deposits Enabled"}</Label>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("admin.minDeposit") || "Minimum Deposit (USD)"}</Label>
            <Input
              type="number"
              min="1"
              value={settings.min_deposit_amount}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  min_deposit_amount: Number(e.target.value) || 0,
                }))
              }
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              {t("admin.totalDeposits") || "Total Deposits"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold">{stats.totalDeposits}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              {t("admin.totalRevenue") || "Total Amount"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold text-green-500">
              ${stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              {t("admin.todayDeposits") || "Today's Deposits"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold">{stats.todayDeposits}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              {t("admin.todayAmount") || "Today's Amount"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold text-blue-400">
              ${stats.todayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Search & Controls Bar ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold">{t("admin.depositRequests") || "Deposit Requests"}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              loadDeposits();
            }}
            disabled={refreshing || loading}
            className="h-8 px-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Input
          placeholder={t("admin.searchDepositsPlaceholder") || "Search by username, email, ID..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80"
        />
      </div>

      {/* ── Loading Spinner ── */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t("common.loading") || "Loading deposits…"}</span>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && filteredDeposits.length === 0 && (
        <Card className="bg-card/30 border-dashed text-center py-12">
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">{t("common.noData") || "No deposit requests found."}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Deposits Cards Grid ── */}
      {!loading && (
        <div className="grid gap-4">
          {filteredDeposits.map((dep) => {
            const isProcessing = processingId === dep.id;
            return (
              <Card key={dep.id} className="bg-card/60 backdrop-blur-md border-border hover:border-slate-600 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap justify-between items-center gap-2 text-base">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{dep.username || "Trader"}</span>
                      <span className="text-xs text-muted-foreground">({dep.email})</span>
                    </div>
                    <Badge
                      className={
                        dep.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-400/40"
                          : dep.status === "approved" || dep.status === "confirmed"
                            ? "bg-green-500/20 text-green-400 border-green-400/40"
                            : "bg-red-500/20 text-red-400 border-red-400/40"
                      }
                    >
                      {dep.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">{t("admin.asset") || "Asset / Network"}</span>
                      <span className="font-medium text-white">{dep.deposit_wallets?.asset ?? "USDT"}</span>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground block">{t("dashboard.amount") || "Amount"}</span>
                      <span className="font-bold text-green-400 text-base">
                        ${Number(dep.amount).toFixed(2)}
                      </span>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <span className="text-xs text-muted-foreground block">{t("admin.address") || "Wallet"}</span>
                      <span className="font-mono text-xs text-slate-300 truncate block max-w-[200px]" title={dep.deposit_wallets?.address || ""}>
                        {dep.deposit_wallets?.address ?? "—"}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground block">Date</span>
                      <span className="text-xs text-slate-300">
                        {dep.created_at ? new Date(dep.created_at).toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Proof View */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProof(dep.id)}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      {t("admin.viewProof") || "View Proof Screenshot"}
                    </Button>

                    {dep.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => approveDeposit(dep)}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                          {t("admin.approveBtn") || "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isProcessing}
                          onClick={() => rejectDeposit(dep)}
                          className="text-xs h-8 px-3"
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <X className="w-3.5 h-3.5 mr-1" />}
                          {t("admin.rejectBtn") || "Reject"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Proof Modal Lightbox ── */}
      <Dialog open={!!activeProofId} onOpenChange={(open) => !open && setActiveProofId(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-blue-400" />
              {t("admin.depositProof") || "Deposit Proof Screenshot"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center min-h-[300px] max-h-[75vh] overflow-auto p-2 bg-slate-950/60 rounded-lg">
            {proofLoading && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                <span className="text-sm">Loading screenshot…</span>
              </div>
            )}

            {!proofLoading && activeProofId && proofCache[activeProofId] && (
              <img
                src={proofCache[activeProofId]}
                alt="Deposit proof"
                className="max-h-[70vh] w-auto max-w-full rounded object-contain"
              />
            )}

            {!proofLoading && activeProofId && !proofCache[activeProofId] && (
              <p className="text-muted-foreground text-sm">No proof screenshot found for this deposit.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
