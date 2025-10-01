"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Share, Users, Target, DollarSign, Copy, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import ReferralsLoading from "./loading"; // ✅ شاشة التحميل

type ReferralHistory = {
  id: string;
  referred_uid?: string;
  referred_email?: string | null;
  username: string;
  referral_code?: string | null;
  joinDate?: string | null;
  status: string;
  totalDeposits: number;
  yourCommission: number;
  level: number;
};

type ReferralStats = {
  referralsCount: number;
  activeReferrals?: number;
  totalEarnings?: number;
  commissionsTotal?: number;
};

export default function ReferralsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<ReferralHistory[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [stats, setStats] = useState<ReferralStats>({
    referralsCount: 0,
    commissionsTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 🟢 1. المستخدم الحالي
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.error("Auth error", userError);
          setLoading(false);
          return;
        }
        const userId = userData.user.id;

        // 🟢 2. البروفايل
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("uid", userId)
          .single();

        setProfile(profileData);

        // 🟢 3. المستوى الأول (Level 1 referrals)
        const { data: level1 } = await supabase
          .from("user_profiles")
          .select("uid, email, full_name, created_at, referral_code, referral_code_used")
          .eq("referral_code_used", profileData?.referral_code);

        const level1Refs: ReferralHistory[] =
          level1?.map((r) => ({
            id: r.uid,
            referred_uid: r.uid,
            referred_email: r.email,
            username: r.full_name || "Unknown",
            referral_code: r.referral_code,
            joinDate: r.created_at,
            status: "Active",
            totalDeposits: 0,
            yourCommission: 0,
            level: 1,
          })) ?? [];

        // 🟢 4. المستوى الثاني (Level 2 referrals)
        let level2Refs: ReferralHistory[] = [];
        if (level1 && level1.length > 0) {
          const { data: level2 } = await supabase
            .from("user_profiles")
            .select("uid, email, full_name, created_at, referral_code, referral_code_used")
            .in("referral_code_used", level1.map((r) => r.referral_code));

          level2Refs =
            level2?.map((r) => ({
              id: r.uid,
              referred_uid: r.uid,
              referred_email: r.email,
              username: r.full_name || "Unknown",
              referral_code: r.referral_code,
              joinDate: r.created_at,
              status: "Active",
              totalDeposits: 0,
              yourCommission: 0,
              level: 2,
            })) ?? [];
        }

        // 🟢 5. المستوى الثالث (Level 3 referrals)
        let level3Refs: ReferralHistory[] = [];
        if (level2Refs.length > 0) {
          const { data: level3 } = await supabase
            .from("user_profiles")
            .select("uid, email, full_name, created_at, referral_code, referral_code_used")
            .in("referral_code_used", level2Refs.map((r) => r.referral_code));

          level3Refs =
            level3?.map((r) => ({
              id: r.uid,
              referred_uid: r.uid,
              referred_email: r.email,
              username: r.full_name || "Unknown",
              referral_code: r.referral_code,
              joinDate: r.created_at,
              status: "Active",
              totalDeposits: 0,
              yourCommission: 0,
              level: 3,
            })) ?? [];
        }

        // 🟢 6. دمج الكل
        const allRefs = [...level1Refs, ...level2Refs, ...level3Refs];
        setHistory(allRefs);

        // 🟢 7. العمولات
        const { data: commissionsData } = await supabase
          .from("referral_commissions")
          .select("amount")
          .eq("recipient_uid", userId);

        const totalCommission = (commissionsData || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0
        );

        setCommissions(commissionsData || []);
        setStats({
          referralsCount: allRefs.length,
          activeReferrals: allRefs.length,
          totalEarnings: totalCommission,
          commissionsTotal: totalCommission,
        });

        setLoading(false);
      } catch (err) {
        console.error("Error loading referrals page:", err);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const referralCode = profile?.referral_code ?? "";
  const referralLink = `https://xspy-trader.com/ref/${referralCode}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text || "");
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const shareReferralLink = async () => {
    if (!referralLink) {
      toast.error("Referral link not ready");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Xspy-trader",
          text: "Earn lifetime commissions by inviting traders.",
          url: referralLink,
        });
      } catch {
        copyToClipboard(referralLink);
      }
    } else {
      copyToClipboard(referralLink);
    }
  };

  // ✅ شاشة التحميل
  if (loading) {
    return <ReferralsLoading />;
  }

  if (!profile) {
    return (
      <div className="p-6" translate="no" data-react-protected>
        <p className="text-white">Please login to view referrals.</p>
      </div>
    );
  }

  // ✅ عرض الصفحة مع حماية الترجمة
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pb-20"
      translate="no"
      data-react-protected
    >
      <div className="p-6 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between" translate="no">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Professional Referral Program
              </h1>
              <p className="text-gray-400 mt-1">
                Earn lifetime commissions by inviting traders to Xspy-trader
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-green-400 border-green-400 bg-green-400/10 px-4 py-2"
            >
              <Trophy className="w-4 h-4 mr-2" />
              3 Levels Commission
            </Badge>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" translate="no">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <Users className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Referrals</p>
                    <p className="text-2xl font-bold text-white">
                      {stats.referralsCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-green-500/20">
                    <Target className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Active Traders</p>
                    <p className="text-2xl font-bold text-white">
                      {stats.activeReferrals ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-purple-500/20">
                    <DollarSign className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Earned</p>
                    <p className="text-2xl font-bold text-white">
                      ${(stats.totalEarnings ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Referral Link */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm" translate="no">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Share className="h-5 w-5" />
                <span>Your Referral Link</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="flex-1 bg-slate-700/50 border-slate-600 text-white font-mono text-sm"
                />
                <Button
                  onClick={() => copyToClipboard(referralLink)}
                  size="icon"
                  className="bg-blue-600 hover:bg-blue-700"
                  title="Copy Link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  onClick={shareReferralLink}
                  size="icon"
                  className="bg-green-600 hover:bg-green-700"
                  title="Share Link"
                >
                  <Share className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* History by Level */}
          <Card className="bg-slate-800/50 border-slate-700" translate="no">
            <CardHeader>
              <CardTitle className="text-white">Referral History</CardTitle>
            </CardHeader>
            <CardContent>
              {[1, 2, 3].map((level) => (
                <div key={level} className="mb-6">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">
                    Level {level}
                  </h3>
                  {history.filter((r) => r.level === level).length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      No referrals at this level.
                    </p>
                  ) : (
                    history
                      .filter((r) => r.level === level)
                      .map((ref) => (
                        <div
                          key={ref.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-slate-700/30 border border-slate-600 mb-2"
                        >
                          <div>
                            <p className="text-white font-semibold">
                              {ref.username}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {ref.referred_email}
                            </p>
                            <p className="text-xs text-gray-500">
                              Joined:{" "}
                              {ref.joinDate
                                ? new Date(ref.joinDate).toLocaleString()
                                : "—"}
                            </p>
                          </div>
                          <div className="text-right">
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
    </div>
  );
}
