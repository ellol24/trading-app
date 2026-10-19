"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ShieldAlert,
  Info,
  UserRound,
  FileText,
  Wallet,
  Hash,
  Mail,
  KeyRound,
  Settings2,
  Power,
  PowerOff,
  Save,
  Pencil,
  Loader2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/contexts/language-context";

export type Withdrawal = {
  id: string;
  userId: string;
  walletId: string;
  username: string;
  email: string;
  userBalance: number;
  userCountry?: string;
  walletLabel: string;
  asset: string;
  address: string;
  amount: number;
  fee: number;
  feePct: number;
  netAmount: number;
  otpVerified: boolean;
  kycStatus: "approved" | "pending" | "rejected";
  status: "pending" | "approved" | "processing" | "paid" | "rejected";
  rejectionReason?: string | null;
  txId?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type OtpRequest = {
  id: string;
  username: string;
  email: string;
  emailOtp: string;
  telegramOtp: string;
  amount: number;
  used: boolean;
  expiresAt: string;
  createdAt: string;
};

type WithdrawalStats = {
  totalAll: number;
  totalApproved: number;
  pendingCount: number;
  todaysTotal: number;
  todaysCount: number;
};

export default function AdminWithdrawalsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [status, setStatus] = useState<"all" | Withdrawal["status"]>("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [otps, setOtps] = useState<OtpRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Control & Settings state
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);
  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState<number>(21);
  const [isSavingControl, setIsSavingControl] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Statistics
  const [stats, setStats] = useState<WithdrawalStats>({
    totalAll: 0,
    totalApproved: 0,
    pendingCount: 0,
    todaysTotal: 0,
    todaysCount: 0,
  });

  // Action dialog state
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "processing" | "paid" | null>(null);
  const [txId, setTxId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isApplyingAction, setIsApplyingAction] = useState(false);

  // Edit Amount dialog state
  const [editItem, setEditItem] = useState<Withdrawal | null>(null);
  const [editAmount, setEditAmount] = useState<string>("0");
  const [editFee, setEditFee] = useState<string>("0");
  const [editNet, setEditNet] = useState<string>("0");
  const [editNote, setEditNote] = useState<string>("");
  const [isSavingAmount, setIsSavingAmount] = useState(false);

  // Detail modals
  const [detailsFor, setDetailsFor] = useState<Withdrawal | null>(null);
  const [userFor, setUserFor] = useState<Withdrawal | null>(null);

  // ─── Fetch All Data via Admin API ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/withdrawals");
      if (!res.ok) {
        throw new Error("Failed to load withdrawal data");
      }
      const data = await res.json();
      if (data.ok) {
        setWithdrawalsEnabled(Boolean(data.control?.is_enabled));
        setFeePercentage(Number(data.settings?.fee_percentage ?? 10));
        setMinWithdrawAmount(Number(data.settings?.min_withdraw_amount ?? 21));
        if (data.stats) setStats(data.stats);
        if (data.withdrawals) setItems(data.withdrawals);
      }
    } catch (err: any) {
      console.error("[AdminWithdrawalsPage] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch OTP Logs ────────────────────────────────────────────────────────
  const fetchOtps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("withdrawal_otps")
        .select(`
          id,
          email_otp,
          telegram_otp,
          amount,
          used,
          expires_at,
          created_at,
          user_id
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("OTP fetch error", error);
        return;
      }

      const userIds = [...new Set(data.map((o: any) => o.user_id))];
      let userMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("user_profiles")
          .select("uid, full_name, first_name, last_name, email")
          .in("uid", userIds);

        if (usersData) {
          usersData.forEach((u: any) => {
            userMap[u.uid] = {
              username: u.full_name || (u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : "User"),
              email: u.email || "—",
            };
          });
        }
      }

      setOtps(
        data.map((o: any) => ({
          id: o.id,
          username: userMap[o.user_id]?.username || "Unknown",
          email: userMap[o.user_id]?.email || "—",
          emailOtp: o.email_otp,
          telegramOtp: o.telegram_otp,
          amount: Number(o.amount || 0),
          used: Boolean(o.used),
          expiresAt: o.expires_at,
          createdAt: o.created_at,
        }))
      );
    } catch (err) {
      console.error("Error fetching OTPs", err);
    }
  }, []);

  // ─── Realtime Subscriptions & Mount ────────────────────────────────────────
  useEffect(() => {
    fetchData();
    fetchOtps();

    const channel = supabase
      .channel("admin-withdrawals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast({
              title: t("admin.newWithdrawalTitle") || "طلب سحب جديد",
              description: t("admin.newWithdrawalDesc") || "قام أحد المستخدمين بتقديم طلب سحب جديد.",
            });
          }
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_control" },
        () => {
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_otps" },
        () => {
          fetchOtps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, fetchOtps, t, toast]);

  // ─── Toggle Withdrawal Enable / Disable ─────────────────────────────────────
  const toggleWithdraw = async () => {
    setIsSavingControl(true);
    const nextState = !withdrawalsEnabled;
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_control",
          isEnabled: nextState,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update withdrawal control");
      }

      setWithdrawalsEnabled(nextState);
      toast({
        title: nextState
          ? (t("admin.withdrawalsEnabled") || "السحوبات: مفعلة")
          : (t("admin.withdrawalsDisabled") || "السحوبات: معطلة"),
        description: nextState
          ? "تم تفعيل عمليات السحب لجميع المستخدمين في المنصة بنجاح."
          : "تم إيقاف وتعطيل طلبات السحب من المستخدمين مؤقتاً.",
      });
    } catch (err: any) {
      console.error("toggleWithdraw error:", err);
      toast({
        title: t("common.error") || "خطأ",
        description: err.message || "فشل تحديث حالة السحوبات",
        variant: "destructive",
      });
    } finally {
      setIsSavingControl(false);
    }
  };

  // ─── Save Settings (Min Amount & Fee %) ─────────────────────────────────────
  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_settings",
          feePercentage,
          minWithdrawAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      toast({
        title: t("admin.saveSettings") || "تم حفظ الإعدادات",
        description: `الحد الأدنى: $${minWithdrawAmount} | نسبة الرسوم: ${feePercentage}%`,
      });
    } catch (err: any) {
      console.error("saveSettings error:", err);
      toast({
        title: t("common.error") || "خطأ",
        description: err.message || "فشل حفظ إعدادات السحب",
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ─── Open Edit Amount Dialog ────────────────────────────────────────────────
  const openEditAmountDialog = (w: Withdrawal) => {
    setEditItem(w);
    setEditAmount(String(w.amount));
    setEditFee(String(w.fee));
    setEditNet(String(w.netAmount));
    setEditNote("");
  };

  // ─── Handle Amount Change in Edit Dialog ─────────────────────────────────────
  const handleAmountInputChange = (valStr: string) => {
    setEditAmount(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      // Auto-recalculate fee using platform fee percentage
      const calculatedFee = Math.round((num * (feePercentage / 100)) * 100) / 100;
      setEditFee(String(calculatedFee));
      setEditNet(String(Math.max(0, num - calculatedFee)));
    }
  };

  const handleFeeInputChange = (valStr: string) => {
    setEditFee(valStr);
    const numFee = parseFloat(valStr);
    const numAmt = parseFloat(editAmount);
    if (!isNaN(numFee) && !isNaN(numAmt)) {
      setEditNet(String(Math.max(0, numAmt - numFee)));
    }
  };

  // ─── Save Edited Amount ─────────────────────────────────────────────────────
  const saveEditedAmount = async () => {
    if (!editItem) return;

    const numAmount = parseFloat(editAmount);
    const numFee = parseFloat(editFee);
    const numNet = parseFloat(editNet);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: t("common.error") || "خطأ",
        description: "يرجى إدخال مبلغ صحيح أكبر من الصفر",
        variant: "destructive",
      });
      return;
    }

    setIsSavingAmount(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_amount",
          withdrawalId: editItem.id,
          newAmount: numAmount,
          newFee: isNaN(numFee) ? 0 : numFee,
          newNetAmount: isNaN(numNet) ? numAmount : numNet,
          note: editNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل تعديل مبلغ السحب");
      }

      toast({
        title: t("admin.amountUpdatedSuccess") || "تم تعديل المبلغ بنجاح",
        description: `المبلغ الجديد: $${numAmount} | الصافي: $${data.net_amount}`,
      });

      setEditItem(null);
      await fetchData();
    } catch (err: any) {
      console.error("saveEditedAmount error:", err);
      toast({
        title: t("common.error") || "خطأ",
        description: err.message || "حدث خطأ أثناء تعديل المبلغ",
        variant: "destructive",
      });
    } finally {
      setIsSavingAmount(false);
    }
  };

  // ─── Filtered List ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return items.filter((w) => {
      const matchStatus = status === "all" || w.status === status;
      const q = query.toLowerCase().trim();
      const matchQ =
        !q ||
        w.username.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        w.address.toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
  }, [items, status, query]);

  // ─── Action Handlers (Approve, Processing, Paid, Reject) ────────────────────
  const openAction = (w: Withdrawal, type: typeof action) => {
    setSelected(w);
    setAction(type);
    setTxId("");
    setRejectReason("");
  };

  const closeDialog = () => {
    setSelected(null);
    setAction(null);
    setTxId("");
    setRejectReason("");
  };

  const applyAction = async () => {
    if (!selected || !action) return;

    const newStatus =
      action === "approve"
        ? "approved"
        : action === "processing"
        ? "processing"
        : action === "paid"
        ? "paid"
        : "rejected";

    setIsApplyingAction(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          withdrawalId: selected.id,
          status: newStatus,
          txId: txId.trim() || undefined,
          rejectReason: rejectReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update withdrawal status");
      }

      toast({
        title: "تم تحديث الحالة بنجاح",
        description:
          newStatus === "rejected"
            ? `تم رفض الطلب واسترجاع مبلغ $${selected.amount} تلقائياً إلى رصيد المستخدم.`
            : `تم تغيير حالة الطلب إلى ${newStatus}.`,
      });

      closeDialog();
      await fetchData();
    } catch (err: any) {
      console.error("applyAction error:", err);
      toast({
        title: t("common.error") || "خطأ",
        description: err.message || "فشل تحديث الحالة",
        variant: "destructive",
      });
    } finally {
      setIsApplyingAction(false);
    }
  };

  const StatusBadge = ({ value }: { value: Withdrawal["status"] }) => (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold text-xs px-2.5 py-0.5",
        value === "pending" && "text-amber-400 border-amber-500/40 bg-amber-500/10",
        value === "approved" && "text-sky-400 border-sky-500/40 bg-sky-500/10",
        value === "processing" && "text-purple-400 border-purple-500/40 bg-purple-500/10",
        value === "paid" && "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
        value === "rejected" && "text-rose-400 border-rose-500/40 bg-rose-500/10"
      )}
    >
      {value === "pending" && "⏳ معلق (Pending)"}
      {value === "approved" && "✅ موافق عليه (Approved)"}
      {value === "processing" && "🔄 قيد المعالجة (Processing)"}
      {value === "paid" && "💸 تم الدفع (Paid)"}
      {value === "rejected" && "❌ مرفوض (Rejected)"}
    </Badge>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ─── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("admin.withdrawalsTitle") || "طلبات السحب وسجلات الأمان"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة طلبات السحب، تعديل المبالغ، وتفعيل أو إيقاف السحوبات للمنصة
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "px-3 py-1 font-semibold text-xs",
              withdrawalsEnabled
                ? "text-emerald-400 border-emerald-500/50 bg-emerald-500/10"
                : "text-rose-400 border-rose-500/50 bg-rose-500/10"
            )}
          >
            {withdrawalsEnabled
              ? (t("admin.withdrawalsEnabled") || "السحوبات: مفعلة")
              : (t("admin.withdrawalsDisabled") || "السحوبات: معطلة")}
          </Badge>
          <Button
            variant={withdrawalsEnabled ? "destructive" : "default"}
            onClick={toggleWithdraw}
            disabled={isSavingControl}
            className={cn(
              "font-medium shadow-sm transition-all",
              withdrawalsEnabled
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            {isSavingControl ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("common.saving") || "جاري التحديث..."}
              </>
            ) : withdrawalsEnabled ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                {t("admin.disableWithdrawals") || "تعطيل السحوبات"}
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                {t("admin.enableWithdrawals") || "تفعيل السحوبات"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ─── Withdraw Control & Settings Card (Requested Element) ─────────────── */}
      <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings2 className="w-5 h-5 text-primary" />
                {t("admin.withdrawControlTitle") || "إعدادات وضوابط السحب (Withdraw Control)"}
              </CardTitle>
              <CardDescription>
                {t("admin.withdrawControlDesc") ||
                  "التحكم المباشر في تفعيل أو إيقاف السحوبات وتعديل الحد الأدنى ونسبة الرسوم لكافة المستخدمين"}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "px-2.5 py-0.5 text-xs w-fit",
                withdrawalsEnabled
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                  : "border-rose-500/40 text-rose-400 bg-rose-500/5"
              )}
            >
              {withdrawalsEnabled ? "● البوابة تعمل وتستقبل الطلبات" : "○ البوابة مغلقة وموقوفة حالياً"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-3 border-t border-border/40">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("admin.minWithdrawAmount") || "الحد الأدنى للسحب ($)"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  $
                </span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={minWithdrawAmount}
                  onChange={(e) => setMinWithdrawAmount(Number(e.target.value) || 0)}
                  className="pl-7 font-mono font-medium"
                  placeholder="21"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("admin.feePercentage") || "نسبة الرسوم (%)"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  %
                </span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={feePercentage}
                  onChange={(e) => setFeePercentage(Number(e.target.value) || 0)}
                  className="pl-7 font-mono font-medium"
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <Button
                onClick={saveSettings}
                disabled={isSavingSettings}
                className="w-full sm:w-auto font-medium"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("common.saving") || "جاري الحفظ..."}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t("admin.saveSettings") || "حفظ الإعدادات"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Statistics Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-border/50 bg-card/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>{t("admin.statsTotalWithdrawals") || "إجمالي مبالغ السحب"}</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1">${stats.totalAll.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">مجموع كافة الطلبات المسجلة</div>
        </Card>

        <Card className="p-4 border-border/50 bg-card/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>{t("admin.statsTotalApproved") || "إجمالي السحوبات المقبولة"}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-emerald-400">
            ${stats.totalApproved.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">المقبولة والمدفوعة بنجاح</div>
        </Card>

        <Card className="p-4 border-border/50 bg-card/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>{t("admin.statsPending") || "الطلبات المعلقة"}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-amber-400">{stats.pendingCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">تحتاج إلى موافقة الإدارة</div>
        </Card>

        <Card className="p-4 border-border/50 bg-card/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>{t("admin.statsToday") || "سحوبات اليوم"}</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1">${stats.todaysTotal.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{stats.todaysCount} طلب سحب اليوم</div>
        </Card>
      </div>

      {/* ─── Main Tabs ───────────────────────────────────────────────────────── */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="bg-muted/40 border border-border/40 p-1">
          <TabsTrigger value="requests" className="font-medium text-sm">
            {t("admin.finalizedRequests") || "الطلبات المكتملة والمعلقة"} ({items.length})
          </TabsTrigger>
          <TabsTrigger value="otps" className="font-medium text-sm">
            <KeyRound className="w-4 h-4 mr-1.5" />
            {t("admin.otpSecurityLogs") || "سجلات أمان OTP"} ({otps.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Requests ───────────────────────────────────────────────── */}
        <TabsContent value="requests" className="space-y-6">
          {/* Filters */}
          <Card className="border-border/50">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Filter className="w-4 h-4 text-muted-foreground" /> {t("admin.filters") || "تصفية وبحث"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={
                      t("admin.searchWithdrawalsPlaceholder") ||
                      "البحث باسم المستخدم، البريد، معرف الطلب، أو العنوان..."
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.status") || "الحالة"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.all") || "الكل"}</SelectItem>
                    <SelectItem value="pending">{t("admin.pending") || "معلق"}</SelectItem>
                    <SelectItem value="approved">{t("admin.approved") || "موافق عليه"}</SelectItem>
                    <SelectItem value="processing">{t("admin.processing") || "قيد المعالجة"}</SelectItem>
                    <SelectItem value="paid">{t("admin.paid") || "تم الدفع"}</SelectItem>
                    <SelectItem value="rejected">{t("admin.rejected") || "مرفوض"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* List of Withdrawals */}
          <Card className="border-border/50">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-1 text-primary" />
                  {t("admin.requestsCount") || "الطلبات"} ({filtered.length})
                </span>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filtered.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-xl border border-border/50 bg-card/40 hover:bg-card/70 transition-all space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/30 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-primary/10 text-primary">
                        <UserRound className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {w.username}
                          <span className="text-xs text-muted-foreground font-normal">({w.email})</span>
                          {w.userCountry && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {w.userCountry}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          رصيد المستخدم الحالي:{" "}
                          <span className="font-mono text-emerald-400 font-medium">${w.userBalance}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Badges (Accurate amount & fee calculation) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-blue-400 border-blue-500/30 bg-blue-500/10 font-mono font-medium text-xs px-2.5 py-0.5"
                      >
                        {t("admin.requested") || "المطلوب"}: ${w.amount}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-rose-400 border-rose-500/30 bg-rose-500/10 font-mono font-medium text-xs px-2.5 py-0.5"
                      >
                        {t("admin.fee") || "الرسوم"}: ${w.fee} ({w.feePct}%)
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono font-bold text-xs px-2.5 py-0.5"
                      >
                        {t("admin.netAmount") || "الصافي"}: ${w.netAmount}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusBadge value={w.status} />
                      <Badge
                        variant="outline"
                        className={
                          w.otpVerified
                            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                        }
                      >
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        OTP {w.otpVerified ? (t("admin.approved") || "مقبول") : "غير موثق"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          w.kycStatus === "approved"
                            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            : w.kycStatus === "pending"
                            ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                            : "text-rose-400 border-rose-500/30 bg-rose-500/10"
                        }
                      >
                        KYC {w.kycStatus}
                      </Badge>
                      {w.rejectionReason && (
                        <span className="text-xs text-rose-300 italic">({w.rejectionReason})</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground font-mono">
                        {new Date(w.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-2 pt-1">
                      <div className="rounded-md border border-border/40 bg-muted/20 p-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Wallet className="h-3.5 w-3.5" /> {w.asset} • {w.walletLabel}
                          </span>
                          <CopyButton value={w.address} tooltip="نسخ العنوان" aria-label="نسخ العنوان" />
                        </div>
                        <div className="mt-1 font-mono text-sm break-all font-medium">{w.address}</div>
                      </div>
                      <div className="rounded-md border border-border/40 bg-muted/20 p-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3.5 w-3.5" /> {t("admin.requestId") || "معرف الطلب #"}
                          </span>
                          <CopyButton value={w.id} tooltip="نسخ المعرف" aria-label="نسخ المعرف" />
                        </div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">{w.id}</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-border/30">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                      onClick={() => openAction(w, "approve")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("admin.approveBtn") || "موافقة"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-purple-400 border-purple-500/40 hover:bg-purple-500/10"
                      onClick={() => openAction(w, "processing")}
                    >
                      <Clock className="w-3.5 h-3.5 mr-1" /> {t("admin.markProcessingBtn") || "تحديد كـ قيد المعالجة"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-400 border-blue-500/40 hover:bg-blue-500/10"
                      onClick={() => openAction(w, "paid")}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" /> {t("admin.markPaidBtn") || "تحديد كـ تم الدفع"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openAction(w, "reject")}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> {t("admin.rejectBtn") || "رفض"}
                    </Button>

                    {/* NEW: Edit Amount Button on Pending Requests */}
                    {w.status === "pending" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30"
                        onClick={() => openEditAmountDialog(w)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" /> {t("admin.editAmountBtn") || "تعديل المبلغ"}
                      </Button>
                    )}

                    <Button size="sm" variant="ghost" onClick={() => setDetailsFor(w)}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> {t("admin.viewDetailsBtn") || "عرض التفاصيل"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setUserFor(w)}>
                      <Info className="w-3.5 h-3.5 mr-1" /> {t("admin.userInfoBtn") || "بيانات المستخدم"}
                    </Button>
                  </div>
                </div>
              ))}

              {!filtered.length && !loading && (
                <div className="text-center py-12 text-sm text-muted-foreground border rounded-lg border-dashed">
                  {t("admin.noWithdrawalsMatch") || "لا توجد طلبات سحب تطابق خيارات التصفية الحالية."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: OTP Security Logs ───────────────────────────────────────── */}
        <TabsContent value="otps">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="w-4 h-4 text-blue-400" /> سجلات رموز التحقق (OTP) المرسلة للسحب
              </CardTitle>
              <CardDescription>
                مراقبة رموز الأمان المرسلة عبر البريد الإلكتروني وتيليجرام لكل طلب سحب
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {otps.map((o) => (
                  <div
                    key={o.id}
                    className="p-3.5 rounded-lg border border-border/40 bg-card/40 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserRound className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{o.username}</span>
                        <span className="text-muted-foreground text-xs">({o.email})</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs px-2 py-0.5",
                          o.used
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                            : new Date(o.expiresAt) < new Date()
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/40"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/40"
                        )}
                      >
                        {o.used
                          ? "✅ تم التحقق (Verified)"
                          : new Date(o.expiresAt) < new Date()
                          ? "❌ منتهي الصلاحية (Expired)"
                          : "⏳ بانتظار التأكيد (Pending)"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/20 p-2.5 rounded-md border border-border/30">
                      <div>
                        <div className="text-muted-foreground text-[11px] mb-0.5">المبلغ</div>
                        <div className="font-mono font-bold text-sm">${o.amount}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] mb-0.5">وقت الإنشاء</div>
                        <div className="font-mono">{new Date(o.createdAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] mb-0.5">رمز البريد (Email OTP)</div>
                        <div className="font-mono bg-background px-2 py-0.5 rounded border inline-block font-semibold">
                          {o.emailOtp || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] mb-0.5">رمز تيليجرام (Telegram OTP)</div>
                        <div className="font-mono bg-background px-2 py-0.5 rounded border inline-block font-semibold">
                          {o.telegramOtp || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {!otps.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    لا توجد سجلات OTP مسجلة حالياً.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Amount Dialog (Requested Feature) ─────────────────────────── */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-400" />
              {t("admin.editAmountDialogTitle") || "تعديل مبلغ طلب السحب"}
            </DialogTitle>
            <DialogDescription>
              {t("admin.editAmountDialogDesc") ||
                "يمكنك تعديل المبلغ المطلوب والرسوم وصافي السحب لهذا الطلب مع ضبط رصيد المستخدم تلقائياً."}
            </DialogDescription>
          </DialogHeader>

          {editItem && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المستخدم:</span>
                  <span className="font-semibold">{editItem.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الرصيد الحالي:</span>
                  <span className="font-mono font-bold text-emerald-400">${editItem.userBalance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المبلغ الأصلي المطلوب:</span>
                  <span className="font-mono font-bold text-blue-400">${editItem.amount}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t("admin.newAmount") || "المبلغ المطلوب الجديد ($)"}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editAmount}
                      onChange={(e) => handleAmountInputChange(e.target.value)}
                      className="pl-7 font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t("admin.newFee") || "مبلغ الرسوم ($)"}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFee}
                      onChange={(e) => handleFeeInputChange(e.target.value)}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("admin.newNetAmount") || "صافي المبلغ المستحق دفعه للمستخدم ($)"}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editNet}
                    onChange={(e) => setEditNet(e.target.value)}
                    className="pl-7 font-mono font-bold text-emerald-400 text-base"
                  />
                </div>
              </div>

              {/* Dynamic balance adjustment feedback */}
              {(() => {
                const diff = parseFloat(editAmount) - editItem.amount;
                if (isNaN(diff) || diff === 0) return null;
                if (diff < 0) {
                  return (
                    <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>
                        سيتم إعادة فرق المبلغ (<strong>${Math.abs(diff)}</strong>) تلقائياً إلى رصيد المستخدم.
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        سيتم خصم فرق المبلغ (<strong>${diff}</strong>) من رصيد المستخدم الحالي.
                      </span>
                    </div>
                  );
                }
              })()}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("admin.adminNote") || "ملاحظة المسؤول (اختياري)"}
                </Label>
                <Input
                  placeholder="سبب تعديل المبلغ..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={isSavingAmount}>
              إلغاء
            </Button>
            <Button onClick={saveEditedAmount} disabled={isSavingAmount} className="bg-amber-600 hover:bg-amber-700">
              {isSavingAmount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  {t("admin.saveAmountChanges") || "حفظ وتعديل المبلغ"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Status Action Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" && "الموافقة على طلب السحب (Approve)"}
              {action === "processing" && "تحديد كـ قيد المعالجة (Processing)"}
              {action === "paid" && "تحديد كـ تم الدفع (Mark Paid)"}
              {action === "reject" && "رفض طلب السحب (Reject & Refund)"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `طلب رقم: ${selected.id} • المستخدم: ${selected.username} • المبلغ: $${selected.amount}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {action === "paid" && (
            <div className="space-y-2">
              <Label>معرف المعاملة على البلوكتشين (TxID / Hash)</Label>
              <Input
                placeholder="0x... أو TxID"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
              />
              {selected && (
                <div className="text-xs text-muted-foreground">
                  العنوان المراد التحويل إليه:
                  <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                    <span className="font-mono text-xs break-all flex-1">{selected.address}</span>
                    <CopyButton value={selected.address} tooltip="نسخ العنوان" aria-label="نسخ العنوان" />
                  </div>
                </div>
              )}
            </div>
          )}

          {action === "reject" && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  ملاحظة أمنية: عند الرفض، سيتم استرجاع مبلغ السحب (<strong>${selected?.amount}</strong>) تلقائياً
                  إلى رصيد حساب المستخدم بالكامل.
                </span>
              </div>
              <div className="space-y-1.5">
                <Label>سبب الرفض</Label>
                <Input
                  placeholder="يرجى كتابة سبب الرفض لتوضيحه للمستخدم..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={isApplyingAction}>
              إلغاء
            </Button>
            <Button onClick={applyAction} disabled={isApplyingAction}>
              {isApplyingAction && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {action === "approve" && "تأكيد الموافقة"}
              {action === "processing" && "تأكيد وضع قيد المعالجة"}
              {action === "paid" && "تأكيد إتمام الدفع"}
              {action === "reject" && "تأكيد الرفض والاسترجاع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Details Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!detailsFor} onOpenChange={(open) => !open && setDetailsFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل طلب السحب</DialogTitle>
            <DialogDescription>المعلومات الكاملة لتدقيق الطلب يدوياً</DialogDescription>
          </DialogHeader>
          {detailsFor && (
            <div className="space-y-4">
              <div className="grid gap-2.5">
                <DetailRow label="معرف الطلب" icon={<Hash className="h-4 w-4" />} value={detailsFor.id} copy />
                <DetailRow label="المستخدم" icon={<UserRound className="h-4 w-4" />} value={detailsFor.username} />
                <DetailRow label="البريد الإلكتروني" icon={<Mail className="h-4 w-4" />} value={detailsFor.email} />
                <DetailRow
                  label="المحفظة"
                  icon={<Wallet className="h-4 w-4" />}
                  value={`${detailsFor.asset} • ${detailsFor.walletLabel}`}
                />
                <DetailRow
                  label="عنوان المحفظة"
                  icon={<Wallet className="h-4 w-4" />}
                  value={detailsFor.address}
                  copy
                  mono
                />
                {detailsFor.txId && (
                  <DetailRow label="معرف المعاملة (TxID)" icon={<Hash className="h-4 w-4" />} value={detailsFor.txId} copy mono />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <StatusBadge value={detailsFor.status} />
                <Badge variant="outline" className="text-blue-400 border-blue-500/40">
                  المطلوب: ${detailsFor.amount}
                </Badge>
                <Badge variant="outline" className="text-rose-400 border-rose-500/40">
                  الرسوم: ${detailsFor.fee} ({detailsFor.feePct}%)
                </Badge>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 font-bold">
                  الصافي: ${detailsFor.netAmount}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                تاريخ الطلب: {new Date(detailsFor.createdAt).toLocaleString()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsFor(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── User Info Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!userFor} onOpenChange={(open) => !open && setUserFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بيانات المستخدم والحساب</DialogTitle>
            <DialogDescription>نظرة سريعة على حساب المستخدم للتحقق من أمان العملية</DialogDescription>
          </DialogHeader>
          {userFor && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <UserRound className="h-8 w-8 text-muted-foreground p-1 bg-primary/10 rounded-full text-primary" />
                <div>
                  <div className="font-semibold">{userFor.username}</div>
                  <div className="text-xs text-muted-foreground">{userFor.email}</div>
                  <div className="text-xs mt-0.5">
                    الرصيد المتاح:{" "}
                    <span className="font-mono text-emerald-400 font-bold">${userFor.userBalance}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-muted/20 p-2.5">
                  <div className="text-xs text-muted-foreground">حالة KYC</div>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        userFor.kycStatus === "approved" && "text-emerald-400 border-emerald-500/40",
                        userFor.kycStatus === "pending" && "text-amber-400 border-amber-500/40",
                        userFor.kycStatus === "rejected" && "text-rose-400 border-rose-500/40"
                      )}
                    >
                      {userFor.kycStatus}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/20 p-2.5">
                  <div className="text-xs text-muted-foreground">التحقق بخطوتين (OTP)</div>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={
                        userFor.otpVerified
                          ? "text-emerald-400 border-emerald-500/40"
                          : "text-amber-400 border-amber-500/40"
                      }
                    >
                      {userFor.otpVerified ? "✅ تم التحقق" : "⏳ غير موثق"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setUserFor(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
  copy,
  mono,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  copy?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 p-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        {copy ? <CopyButton value={String(value)} /> : null}
      </div>
      <div className={cn("mt-1 text-sm font-medium", mono && "font-mono break-all")}>
        {String(value)}
      </div>
    </div>
  );
}
