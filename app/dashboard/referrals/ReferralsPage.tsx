"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Share, Users, DollarSign, Copy, Trophy,
  TrendingUp, Package, BarChart3, Wallet,
  Check, MessageCircle, Send, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/language-context";
import { supabase } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReferralHistory = {
  id: string;
  referred_uid?: string;
  referred_email?: string | null;
  username: string;
  joinDate?: string | null;
  status: string;
  balance?: number;
  totalReferrals?: number;
  yourCommission: number;
  level: number;
};

type ReferralStats = {
  referralsCount: number;
  activeReferrals?: number;
  totalEarnings?: number;
  commissionsTotal?: number;
  depositEarnings?: number;
  tradeEarnings?: number;
  packageEarnings?: number;
  thisMonthEarnings?: number;
};

type TopReferrer = {
  rank: number;
  username: string;
  referrals: number;
  earnings: number;
  avatar: string;
  isCurrentUser: boolean;
};

type CommissionLevel = {
  level: number;
  users: number;
  commission: number;
  earnings: number;
};

type ReferralsPageProps = {
  user: any;
  profile: any;
  history: ReferralHistory[];
  commissions: any[];
  topReferrers: TopReferrer[];
  commissionLevels: CommissionLevel[];
  stats: ReferralStats;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const STAT_ICON_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/20 text-blue-400",
  yellow: "bg-yellow-500/20 text-yellow-400",
  purple: "bg-purple-500/20 text-purple-400",
  teal: "bg-teal-500/20 text-teal-400",
  green: "bg-green-500/20 text-green-400",
};

function StatCard({ title, value, icon, color, isMoney = true }: {
  title: string; value: number | undefined; icon: React.ReactNode; color: string; isMoney?: boolean;
}) {
  const cls = STAT_ICON_CLASSES[color] ?? "bg-slate-500/20 text-slate-400";
  return (
    <Card className="trading-card">
      <CardContent className="p-4 flex items-center space-x-3">
        <div className={`p-3 rounded-lg ${cls}`}>{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-bold text-white">
            {isMoney ? `$${(value ?? 0).toFixed(2)}` : (value ?? 0)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Commission structure moved inside component for translations

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReferralsPage({
  user, profile, history, topReferrers, commissionLevels, stats,
}: ReferralsPageProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // Commission structure
  const COMMISSION_STRUCTURE = useMemo(() => [
    { level: 1, pct: "10%", emoji: "🥇", description: t("referrals.directReferrals") },
    { level: 2, pct: "5%", emoji: "🥈", description: t("referrals.secondDegreeReferrals") },
    { level: 3, pct: "2%", emoji: "🥉", description: t("referrals.thirdDegreeReferrals") },
  ], [t]);

  const referralLink = useMemo(() =>
    profile?.referral_code
      ? `https://xspy-trader.com/auth/register?ref=${encodeURIComponent(profile.referral_code)}`
      : "",
    [profile?.referral_code]
  );

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const maskEmail = useCallback((email: string | null) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return name.length > 2 ? `${name.slice(0, 2)}***@${domain}` : `${name[0]}***@${domain}`;
  }, []);

  const maskName = useCallback((name: string) => {
    if (!name) return "Unknown";
    if (name.length <= 2) return name;
    return `${name.slice(0, 2)}***${name.slice(-1)}`;
  }, []);

  const copyLink = useCallback(async () => {
    if (!referralLink) return toast.error(t("referrals.referralLinkNotReady"));
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(t("dashboard.linkCopied"));
    setTimeout(() => setCopied(false), 2500);
  }, [referralLink, t]);

  const shareVia = useCallback((platform: "whatsapp" | "telegram") => {
    if (!referralLink) return toast.error(t("referrals.referralLinkNotReady"));
    const msg = encodeURIComponent(`${t("referrals.shareMessage") || "Join me on XSpy Trader and start earning!"} ${referralLink}`);
    const urls = {
      whatsapp: `https://wa.me/?text=${msg}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${msg}`,
    };
    window.open(urls[platform], "_blank");
  }, [referralLink, t]);

  // ─── Real-time: trigger server-component refresh on new referral/commission ─
  useEffect(() => {
    if (!user?.id) return;

    const referralsChannel = supabase
      .channel(`referrals-rt-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "referrals", filter: `referrer_id=eq.${user.id}` },
        () => {
          toast.info("🔔 New referral activity detected!");
          router.refresh();
        }
      )
      .subscribe();

    const commissionsChannel = supabase
      .channel(`commissions-rt-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "referral_commissions" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(referralsChannel);
      supabase.removeChannel(commissionsChannel);
    };
  }, [user?.id, router]);

  // ─── Grouped history by level (memoized) ──────────────────────────────────
  const historyByLevel = useMemo(() => {
    return [1, 2, 3].map((level) => ({
      level,
      refs: history.filter((r) => r.level === level),
    }));
  }, [history]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pb-24" translate="no">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">{t("referrals.referralProgram")}</h1>
            <p className="text-blue-200 mt-1">{t("referrals.inviteSubtitle")}</p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10 px-4 py-2">
            <Trophy className="w-4 h-4 mr-2" /> {t("referrals.threeLevelsCommission")}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title={t("dashboard.totalReferrals")} value={stats.referralsCount} icon={<Users className="w-5 h-5" />} color="blue" isMoney={false} />
          <StatCard title={t("referrals.depositEarnings")} value={stats.depositEarnings} icon={<DollarSign className="w-5 h-5" />} color="yellow" />
          <StatCard title={t("referrals.tradingEarnings")} value={stats.tradeEarnings} icon={<TrendingUp className="w-5 h-5" />} color="purple" />
          <StatCard title={t("referrals.packageEarnings")} value={stats.packageEarnings} icon={<Package className="w-5 h-5" />} color="teal" />
          <StatCard title={t("referrals.totalEarnings")} value={stats.totalEarnings} icon={<BarChart3 className="w-5 h-5" />} color="green" />
        </div>

        {/* Referral Link + Share Buttons */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Link2 className="h-5 w-5" />
              <span>{t("referrals.yourReferralLink")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                value={referralLink}
                readOnly
                className="flex-1 bg-slate-700/50 border-slate-600 text-white font-mono text-sm"
              />
              <Button onClick={copyLink} className="bg-blue-600 hover:bg-blue-700 shrink-0 min-w-[44px]">
                {copied ? <Check className="h-4 w-4 text-green-300" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={() => shareVia("whatsapp")}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                size="sm"
              >
                <MessageCircle className="w-4 h-4" />
                {t("referrals.shareOnWhatsApp")}
              </Button>
              <Button
                onClick={() => shareVia("telegram")}
                className="bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-2"
                size="sm"
              >
                <Send className="w-4 h-4" />
                {t("referrals.shareOnTelegram")}
              </Button>
              <Button onClick={copyLink} variant="outline" className="border-slate-600 text-slate-300 bg-transparent flex items-center gap-2" size="sm">
                <Share className="w-4 h-4" />
                {t("referrals.copyLinkBtn")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Commission Structure */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              {t("referrals.howItWorksStructure")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COMMISSION_STRUCTURE.map((lvl) => {
                const levelData = commissionLevels.find((cl) => cl.level === lvl.level);
                return (
                  <div key={lvl.level} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 text-center space-y-2">
                    <span className="text-3xl">{lvl.emoji}</span>
                    <p className="text-white font-bold text-lg">Level {lvl.level}</p>
                    <p className="text-4xl font-bold text-green-400">{lvl.pct}</p>
                    <p className="text-slate-400 text-sm">{lvl.description}</p>
                    <div className="pt-2 border-t border-slate-700 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t("referrals.yourReferrals")}</span>
                        <span className="text-white font-medium">{levelData?.users ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t("referrals.earned")}</span>
                        <span className="text-green-400 font-medium">${(levelData?.earnings ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <Card className="trading-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <Trophy className="w-5 h-5 text-yellow-400" />
                {t("referrals.topReferrersBoard")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topReferrers.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">{t("referrals.noLeaderboardData")}</p>
              ) : (
                topReferrers.slice(0, 8).map((ref) => (
                  <div
                    key={ref.rank}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${ref.isCurrentUser
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-slate-700 bg-slate-800/30 hover:bg-slate-800/50"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-8 text-center">{ref.avatar}</span>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {ref.isCurrentUser ? t("common.youStar") : maskName(ref.username)}
                        </p>
                        <p className="text-slate-400 text-xs">{t("common.referralsCount").replace('{n}', ref.referrals.toString())}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">${ref.earnings.toFixed(2)}</p>
                      <p className="text-slate-500 text-xs">{t("common.rankLabel").replace('{n}', ref.rank.toString())}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Referral History by Level */}
          <Card className="trading-card">
            <CardHeader>
              <CardTitle className="text-white">{t("referrals.referralHistory")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
              {historyByLevel.map(({ level, refs }) => (
                <div key={level}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-blue-400">
                      {t("referrals.levelLabel").replace('{n}', level.toString())}
                    </h3>
                    <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                      {t("referrals.usersCount").replace('{n}', refs.length.toString())}
                    </Badge>
                  </div>
                  {refs.length === 0 ? (
                    <p className="text-slate-500 text-xs mb-3">{t("referrals.noReferralsAtLevel")}</p>
                  ) : (
                    refs.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex justify-between items-center p-3 rounded-lg bg-slate-700/30 border border-slate-600 mb-2 hover:bg-slate-700/50 transition"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{maskName(ref.username)}</p>
                          <p className="text-slate-400 text-xs">{maskEmail(ref.referred_email ?? null)}</p>
                          <p className="text-slate-500 text-xs">
                            {t("referrals.joined")} {ref.joinDate ? new Date(ref.joinDate).toLocaleDateString() : "—"}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center justify-end gap-1">
                            <Wallet className="h-3 w-3 text-yellow-400" />
                            <span className="text-xs text-yellow-400">${(ref.balance ?? 0).toFixed(2)}</span>
                          </div>
                          <Badge className="bg-green-600 text-white text-xs">{ref.status}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
