"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Share,
  Users,
  Target,
  DollarSign,
  Copy,
  Trophy,
  TrendingUp,
  Package,
  Wallet,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import ReferralsLoading from "./loading";

// 🧱 أنواع البيانات
type ReferralHistory = {
  id: string;
  referred_uid?: string;
  referred_email?: string | null;
  username: string;
  referral_code?: string | null;
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
};

import { useLanguage } from "@/contexts/language-context";

export default function ReferralsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<ReferralHistory[]>([]);
  const [stats, setStats] = useState<ReferralStats>({
    referralsCount: 0,
    commissionsTotal: 0,
    depositEarnings: 0,
    tradeEarnings: 0,
    packageEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  // ✉️ إخفاء الإيميل جزئياً
  const maskEmail = (email: string | null) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return name.length > 2
      ? `${name.slice(0, 2)}***@${domain}`
      : `${name[0]}***@${domain}`;
  };

  // 👤 إخفاء الاسم جزئياً
  const maskName = (name: string) => {
    if (!name) return "Unknown";
    if (name.length <= 2) return name;
    return `${name.slice(0, 2)}***${name.slice(-1)}`;
  };

  // 🚀 تحميل البيانات
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) return setLoading(false);

        const userId = userData.user.id;

        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("uid", userId)
          .single();

        setProfile(profileData);

        // جلب الإحالات حسب المستويات
        const getReferrals = async (refCodes: string[], level: number) => {
          const { data } = await supabase
            .from("user_profiles")
            .select(
              "uid, email, full_name, created_at, referral_code, referral_code_used, balance, total_referrals"
            )
            .in("referral_code_used", refCodes);
          return (
            data?.map((r) => ({
              id: r.uid,
              referred_uid: r.uid,
              referred_email: r.email,
              username: r.full_name || "Unknown",
              referral_code: r.referral_code,
              joinDate: r.created_at,
              status: "Active",
              balance: r.balance ?? 0,
              totalReferrals: r.total_referrals ?? 0,
              yourCommission: 0,
              level,
            })) ?? []
          );
        };

        // المستوى 1
        const { data: level1 } = await supabase
          .from("user_profiles")
          .select(
            "uid, email, full_name, created_at, referral_code, referral_code_used, balance, total_referrals"
          )
          .eq("referral_code_used", profileData?.referral_code);

        const level1Refs = level1 ? await getReferrals([profileData.referral_code], 1) : [];
        const level2Refs =
          level1 && level1.length > 0
            ? await getReferrals(level1.map((r) => r.referral_code), 2)
            : [];
        const level3Refs =
          level2Refs.length > 0
            ? await getReferrals(level2Refs.map((r) => r.referral_code), 3)
            : [];

        const allRefs = [...level1Refs, ...level2Refs, ...level3Refs];
        setHistory(allRefs);

        // 💰 حساب الأرباح من الجداول الثلاثة
        const { data: depositCommissions } = await supabase
          .from("referral_commissions")
          .select("amount")
          .eq("recipient_uid", userId);

        const { data: tradeCommissions } = await supabase
          .from("trade_referral_commissions")
          .select("amount")
          .eq("user_id", userId);

        const { data: packageCommissions } = await supabase
          .from("package_referral_commissions")
          .select("amount")
          .eq("user_id", userId);

        const depositTotal = (depositCommissions || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0
        );
        const tradeTotal = (tradeCommissions || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0
        );
        const packageTotal = (packageCommissions || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0
        );

        const totalEarnings = depositTotal + tradeTotal + packageTotal;

        setStats({
          referralsCount: allRefs.length,
          activeReferrals: allRefs.length,
          depositEarnings: depositTotal,
          tradeEarnings: tradeTotal,
          packageEarnings: packageTotal,
          totalEarnings,
        });
      } catch (err) {
        console.error("Referral page error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const referralLink = profile?.referral_code
    ? `https://xspy-trader.com/auth/register?ref=${encodeURIComponent(profile.referral_code)}`
    : "";

  const copyLink = async () => {
    if (!referralLink) return toast.error(t('referrals.referralLinkNotReady'));
    await navigator.clipboard.writeText(referralLink);
    toast.success(t('dashboard.linkCopied'));
  };

  if (loading) return <ReferralsLoading />;

  // 🎨 واجهة الصفحة
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pb-20" translate="no">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">{t('referrals.referralProgram')}</h1>
          <Badge
            variant="outline"
            className="text-green-400 border-green-400 bg-green-400/10 px-4 py-2"
          >
            <Trophy className="w-4 h-4 mr-2" /> {t('referrals.threeLevelsCommission')}
          </Badge>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title={t('dashboard.totalReferrals')} value={stats.referralsCount} icon={<Users />} color="blue" />
          <StatCard title={t('referrals.depositEarnings')} value={stats.depositEarnings} icon={<DollarSign />} color="yellow" />
          <StatCard title={t('referrals.tradingEarnings')} value={stats.tradeEarnings} icon={<TrendingUp />} color="purple" />
          <StatCard title={t('referrals.packageEarnings')} value={stats.packageEarnings} icon={<Package />} color="teal" />
          <StatCard title={t('referrals.totalEarnings')} value={stats.totalEarnings} icon={<BarChart3 />} color="green" />
        </div>

        {/* Referral Link */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Share className="h-5 w-5" />
              <span>{t('referrals.yourReferralLink')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex space-x-2">
            <Input
              value={referralLink}
              readOnly
              className="flex-1 bg-slate-700/50 border-slate-600 text-white font-mono text-sm"
            />
            <Button onClick={copyLink} className="bg-blue-600 hover:bg-blue-700">
              <Copy className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Referral History */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">{t('referrals.referralHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {[1, 2, 3].map((level) => (
              <div key={level} className="mb-6">
                <h3 className="text-lg font-semibold text-blue-400 mb-3">{t('referrals.level')} {level}</h3>
                {history.filter((r) => r.level === level).length === 0 ? (
                  <p className="text-gray-400 text-sm">{t('referrals.noReferralsAtLevel')}</p>
                ) : (
                  history
                    .filter((r) => r.level === level)
                    .map((ref) => (
                      <div
                        key={ref.id}
                        className="flex justify-between items-center p-4 rounded-lg bg-slate-700/30 border border-slate-600 mb-2 hover:bg-slate-700/50 transition"
                      >
                        <div>
                          <p className="text-white font-semibold">{maskName(ref.username)}</p>
                          <p className="text-gray-400 text-sm">{maskEmail(ref.referred_email ?? null)}</p>
                          <p className="text-xs text-gray-500">
                            {t('referrals.joined')}{" "}
                            {ref.joinDate
                              ? new Date(ref.joinDate).toLocaleString()
                              : "—"}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center justify-end space-x-2">
                            <Wallet className="h-4 w-4 text-yellow-400" />
                            <span className="text-sm text-yellow-400 font-medium">
                              ${ref.balance?.toFixed(2) ?? "0.00"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {t('referrals.referralsCountLabel')} {ref.totalReferrals ?? 0}
                          </p>
                          <Badge className="bg-green-600">{ref.status}</Badge>
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
  );
}

// 🧩 بطاقة إحصاء صغيرة
function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | undefined;
  icon: JSX.Element;
  color: string;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-4 flex items-center space-x-3">
        <div className={`p-3 rounded-lg bg-${color}-500/20`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">${(value ?? 0).toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
