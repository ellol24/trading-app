"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserCircle,
  Search,
  RefreshCw,
  ArrowRightLeft,
  Users,
  Shield,
  Star,
  Plus,
  Pencil,
  Trash2,
  Gift,
  RotateCcw,
  TrendingUp,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/language-context";
import { toast } from "sonner";
import { getAdminReferrals, switchReferrer } from "@/app/actions/admin-referrals";

export type AdminReferralData = {
  id: string;
  referrer_id: string;
  referred_id: string;
  level: number;
  status: string;
  created_at: string;
  referrer_email: string;
  referrer_name: string;
  referrer_code: string;
  referred_email: string;
  referred_name: string;
  referred_code: string;
};

export type MilestoneTier = {
  count: number;
  reward: number;
};

export default function AdminReferralsPage() {
  const { t } = useLanguage();

  // ── Network State ────────────────────────────────────────────────────────────
  const [referrals, setReferrals] = useState<AdminReferralData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [selectedRef, setSelectedRef] = useState<AdminReferralData | null>(null);
  const [newReferrerCode, setNewReferrerCode] = useState("");
  const [switching, setSwitching] = useState(false);

  // ── Milestone Tiers State ───────────────────────────────────────────────────
  const [milestones, setMilestones] = useState<MilestoneTier[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(true);
  const [savingMilestone, setSavingMilestone] = useState(false);

  // Add / Edit Modal State
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneTier | null>(null);
  const [formCount, setFormCount] = useState<string>("");
  const [formReward, setFormReward] = useState<string>("");

  // Delete Confirm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCount, setDeletingCount] = useState<number | null>(null);

  // ── Fetch Referrals Network ─────────────────────────────────────────────────
  const fetchRefs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminReferrals();
      setReferrals(data);
    } catch (err: any) {
      toast.error("Failed to fetch referrals: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch Milestone Tiers ────────────────────────────────────────────────────
  const fetchMilestones = useCallback(async () => {
    setLoadingMilestones(true);
    try {
      const res = await fetch("/api/admin/referral-milestones");
      if (res.ok) {
        const data = await res.json();
        setMilestones(data.milestones ?? []);
      }
    } catch (err: any) {
      toast.error("Failed to fetch milestone rewards: " + err.message);
    } finally {
      setLoadingMilestones(false);
    }
  }, []);

  useEffect(() => {
    fetchRefs();
    fetchMilestones();
  }, [fetchRefs, fetchMilestones]);

  // ── Save Milestone (Add / Edit) ──────────────────────────────────────────────
  const handleSaveMilestone = async () => {
    const count = parseInt(formCount, 10);
    const reward = parseFloat(formReward);

    if (isNaN(count) || count <= 0) {
      toast.error("Please enter a valid positive number of active referrals.");
      return;
    }
    if (isNaN(reward) || reward <= 0) {
      toast.error("Please enter a valid reward amount in USD.");
      return;
    }

    setSavingMilestone(true);
    try {
      if (editingMilestone) {
        // Edit existing tier
        const res = await fetch("/api/admin/referral-milestones", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldCount: editingMilestone.count,
            count,
            reward,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update milestone");
        toast.success(t("admin.milestoneSaved") || "Milestone reward updated successfully!");
        setMilestones(data.milestones);
      } else {
        // Add new tier
        const res = await fetch("/api/admin/referral-milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count, reward }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to add milestone");
        toast.success(t("admin.milestoneSaved") || "New milestone tier created successfully!");
        setMilestones(data.milestones);
      }
      setMilestoneModalOpen(false);
      setEditingMilestone(null);
      setFormCount("");
      setFormReward("");
    } catch (err: any) {
      toast.error(err.message || "Failed to save milestone");
    } finally {
      setSavingMilestone(false);
    }
  };

  // ── Delete Milestone ─────────────────────────────────────────────────────────
  const handleDeleteMilestone = async () => {
    if (!deletingCount) return;
    setSavingMilestone(true);
    try {
      const res = await fetch(`/api/admin/referral-milestones?count=${deletingCount}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete milestone");
      toast.success(t("admin.milestoneDeleted") || "Milestone tier deleted successfully!");
      setMilestones(data.milestones);
      setDeleteModalOpen(false);
      setDeletingCount(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete milestone");
    } finally {
      setSavingMilestone(false);
    }
  };

  // ── Reset Milestones to Defaults ─────────────────────────────────────────────
  const handleResetDefaults = async () => {
    if (!confirm("Are you sure you want to reset milestone rewards to default tiers?")) return;
    setSavingMilestone(true);
    try {
      const res = await fetch("/api/admin/referral-milestones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset");
      toast.success("Milestones reset to default tiers!");
      setMilestones(data.milestones);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset");
    } finally {
      setSavingMilestone(false);
    }
  };

  // ── Switch Referrer ─────────────────────────────────────────────────────────
  const handleSwitch = async () => {
    if (!selectedRef) return;
    const codeTrimmed = newReferrerCode.trim().toUpperCase();
    if (!codeTrimmed) {
      toast.error("Please enter a new referral code.");
      return;
    }

    if (selectedRef.referred_code && selectedRef.referred_code.toUpperCase() === codeTrimmed) {
      toast.error(`A user cannot be their own referrer! Code "${codeTrimmed}" belongs to ${selectedRef.referred_name || selectedRef.referred_email}.`);
      return;
    }

    setSwitching(true);
    try {
      const res = await switchReferrer(selectedRef.id, selectedRef.referred_id, codeTrimmed);
      if (!res.success) {
        toast.error(res.error || "Failed to switch referrer.");
        return;
      }
      toast.success("Successfully transferred referral.");
      setSwitchModalOpen(false);
      setNewReferrerCode("");
      fetchRefs();
    } catch (err: any) {
      toast.error(err.message || "Failed to switch referrer.");
    } finally {
      setSwitching(false);
    }
  };

  const filtered = referrals.filter(
    (r) =>
      r.referrer_email.toLowerCase().includes(search.toLowerCase()) ||
      r.referred_email.toLowerCase().includes(search.toLowerCase()) ||
      r.referrer_code.toLowerCase().includes(search.toLowerCase()) ||
      r.referred_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-400" />
            {t("admin.referralMilestonesTitle") || "Referrals & Milestone Rewards"}
          </h2>
          <p className="text-slate-400">
            {t("admin.referralMilestonesSubtitle") || "Configure progressive milestone cash rewards and manage network referrals."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              fetchRefs();
              fetchMilestones();
            }}
            disabled={loading || loadingMilestones}
            variant="outline"
            className="bg-slate-800 text-white border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading || loadingMilestones ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="milestones" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <TabsTrigger
            value="milestones"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-600 data-[state=active]:to-amber-600 data-[state=active]:text-white"
          >
            <Star className="w-4 h-4 text-yellow-400" />
            {t("admin.milestoneTabTitle") || "Milestone Rewards"}
            <Badge className="ml-1 bg-yellow-500/20 text-yellow-300 border-0 text-[10px]">
              {milestones.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="network"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <Users className="w-4 h-4 text-blue-400" />
            {t("admin.networkTabTitle") || "Referral Network"}
            <Badge className="ml-1 bg-blue-500/20 text-blue-300 border-0 text-[10px]">
              {referrals.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: MILESTONE REWARDS MANAGER
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="milestones" className="space-y-6">
          {/* Milestone Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">{t("admin.totalTiers") || "Total Tiers"}</p>
                  <p className="text-2xl font-bold text-white mt-1">{milestones.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <Star className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">{t("admin.minMilestone") || "Minimum Milestone"}</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {milestones.length > 0 ? `${milestones[0].count} refs → $${milestones[0].reward.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">{t("admin.maxMilestone") || "Maximum Milestone"}</p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">
                    {milestones.length > 0
                      ? `${milestones[milestones.length - 1].count} refs → $${milestones[milestones.length - 1].reward.toFixed(2)}`
                      : "—"}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Milestone Tiers Card */}
          <Card className="bg-slate-900/70 border-slate-800 shadow-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Gift className="w-5 h-5 text-yellow-400" />
                  {t("admin.referralMilestonesTitle") || "Milestone Reward Tiers"}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  Users automatically unlock each reward when they reach the required active referrals.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={handleResetDefaults}
                  disabled={savingMilestone}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  {t("admin.resetMilestones") || "Reset Defaults"}
                </Button>
                <Button
                  onClick={() => {
                    setEditingMilestone(null);
                    setFormCount("");
                    setFormReward("");
                    setMilestoneModalOpen(true);
                  }}
                  size="sm"
                  className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-slate-950 font-bold text-xs"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("admin.addMilestone") || "+ Add Milestone"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">{t("admin.milestoneTier") || "Tier"}</th>
                      <th className="px-6 py-3.5">{t("admin.requiredReferrals") || "Required Active Referrals"}</th>
                      <th className="px-6 py-3.5">{t("admin.rewardAmount") || "Reward Amount ($)"}</th>
                      <th className="px-6 py-3.5">{t("admin.perReferralValue") || "Value / Referral"}</th>
                      <th className="px-6 py-3.5 text-right">{t("admin.actions_th") || "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingMilestones ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
                          Loading milestone tiers...
                        </td>
                      </tr>
                    ) : milestones.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400">
                          No milestone rewards configured. Click "+ Add Milestone" to create one.
                        </td>
                      </tr>
                    ) : (
                      milestones.map((m, idx) => (
                        <tr key={m.count} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-semibold text-white">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex items-center justify-center text-xs font-mono font-bold">
                                #{idx + 1}
                              </span>
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-blue-400" />
                              <span className="text-white font-medium text-base">
                                {m.count}
                              </span>
                              <span className="text-slate-400 text-xs">
                                {t("admin.activeReferralsNeeded")?.replace("{n}", "") || "active referrals"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-lg text-emerald-400 font-mono">
                              ${m.reward.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-400">
                            ${(m.reward / m.count).toFixed(2)} / referral
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-blue-400 hover:text-blue-300"
                                onClick={() => {
                                  setEditingMilestone(m);
                                  setFormCount(m.count.toString());
                                  setFormReward(m.reward.toString());
                                  setMilestoneModalOpen(true);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                {t("admin.editMilestone") || "Edit"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300"
                                onClick={() => {
                                  setDeletingCount(m.count);
                                  setDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: REFERRAL NETWORK & TRANSFER
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="network" className="space-y-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">All Active Referrals</CardTitle>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search by email or code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 border-b border-slate-700">Referred User (Downline)</th>
                        <th className="px-4 py-3 border-b border-slate-700">Referrer (Parent)</th>
                        <th className="px-4 py-3 border-b border-slate-700">Level</th>
                        <th className="px-4 py-3 border-b border-slate-700">Joined</th>
                        <th className="px-4 py-3 border-b border-slate-700 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 bg-slate-800">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">Loading network data...</td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">No referrals found matching search.</td>
                        </tr>
                      ) : (
                        filtered.map((ref) => (
                          <tr key={ref.id} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="bg-slate-700 p-2 rounded-full">
                                  <UserCircle className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                  <div className="font-medium text-white">{ref.referred_name || "Unknown"}</div>
                                  <div className="text-xs text-slate-400">{ref.referred_email}</div>
                                  <code className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded mt-1 inline-block">{ref.referred_code}</code>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-yellow-500" />
                                <div>
                                  <div className="font-medium text-white">{ref.referrer_name || "Unknown"}</div>
                                  <div className="text-xs text-slate-400">{ref.referrer_email}</div>
                                  <code className="text-[10px] text-yellow-500/70 bg-slate-900 px-1 py-0.5 rounded mt-1 inline-block">{ref.referrer_code}</code>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`
                                ${ref.level === 1 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : ""}
                                ${ref.level === 2 ? "bg-slate-400/10 text-slate-300 border-slate-400/20" : ""}
                                ${ref.level === 3 ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : ""}
                              `}>
                                Level {ref.level}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {new Date(ref.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                onClick={() => {
                                  setSelectedRef(ref);
                                  setSwitchModalOpen(true);
                                }}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Transfer
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add / Edit Milestone Dialog ────────────────────────────────────── */}
      <Dialog open={milestoneModalOpen} onOpenChange={setMilestoneModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Gift className="w-5 h-5 text-yellow-400" />
              {editingMilestone ? (t("admin.editMilestone") || "Edit Milestone Reward") : (t("admin.addMilestone") || "Add New Milestone Reward")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Configure the active referral target and corresponding cash reward amount.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                {t("admin.milestoneCountLabel") || "Active Referrals Target"}
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 5, 10, 20, 50, 100..."
                value={formCount}
                onChange={(e) => setFormCount(e.target.value)}
                className="bg-slate-800/80 border-slate-700 text-white font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Number of level-1 referrals with at least 1 approved deposit required to unlock this reward.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                {t("admin.milestoneRewardLabel") || "Reward Amount in USD ($)"}
              </label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 2.00, 5.00, 12.00..."
                value={formReward}
                onChange={(e) => setFormReward(e.target.value)}
                className="bg-slate-800/80 border-slate-700 text-white font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Cash balance credited directly to the user when they claim this milestone.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setMilestoneModalOpen(false)}
              className="border-slate-700 text-slate-300 bg-transparent hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMilestone}
              disabled={savingMilestone || !formCount || !formReward}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-slate-950 font-bold"
            >
              {savingMilestone ? "Saving..." : editingMilestone ? "Save Changes" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Milestone Confirmation Dialog ────────────────────────────── */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <Trash2 className="w-5 h-5 text-rose-400" />
              {t("admin.deleteMilestone") || "Delete Milestone Tier"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {(t("admin.confirmDeleteMilestone") || "Are you sure you want to delete the milestone for {count} referrals?").replace("{count}", deletingCount?.toString() || "")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeletingCount(null);
              }}
              className="border-slate-700 text-slate-300 bg-transparent hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteMilestone}
              disabled={savingMilestone}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {savingMilestone ? "Deleting..." : "Delete Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Referral Network Dialog ─────────────────────────────────── */}
      <Dialog open={switchModalOpen} onOpenChange={setSwitchModalOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Transfer Referral</DialogTitle>
            <DialogDescription className="text-slate-400">
              Move {selectedRef?.referred_email} to a new referrer network. They will become a Level 1 referral under the new network.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-2">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Member (Downline):</p>
                <p className="font-medium text-white">{selectedRef?.referred_name || "Member"} ({selectedRef?.referred_email})</p>
                <p className="text-xs text-blue-400 mt-0.5">Member's Own Code: <code className="bg-slate-950 px-1 py-0.5 rounded">{selectedRef?.referred_code || "—"}</code></p>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 mb-0.5">Current Parent Referrer:</p>
                <p className="font-medium">{selectedRef?.referrer_email}</p>
                <p className="text-xs text-yellow-500 mt-0.5">Code: {selectedRef?.referrer_code}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">New Parent Referral Code</label>
              <Input
                type="text"
                placeholder="Enter target parent's referral code..."
                value={newReferrerCode}
                onChange={(e) => setNewReferrerCode(e.target.value.toUpperCase())}
                className="bg-slate-900 border-slate-700 uppercase tracking-wider"
              />
              {selectedRef?.referred_code && newReferrerCode.trim() === selectedRef.referred_code.toUpperCase() && (
                <p className="text-xs text-rose-400 font-medium">
                  ⚠️ This is the member's own code! A user cannot be their own referrer.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchModalOpen(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleSwitch} disabled={switching || !newReferrerCode} className="bg-blue-600 hover:bg-blue-700">
              {switching ? "Processing..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
