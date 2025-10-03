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

        // 🟢 باقي خطوات تحميل الإحالات (كما في كودك)
        // ...

        setLoading(false);
      } catch (err) {
        console.error("Error loading referrals page:", err);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const referralCode = profile?.referral_code ?? "";
  // ✅ الرابط الجديد: يحول مباشرة لصفحة التسجيل مع الكود كـ query param
  const referralLink = `https://xspy-trader.com/auth/register?ref=${referralCode}`;

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

          {/* باقي الكود (التاريخ والإحصائيات) */}
        </div>
      </div>
    </div>
  );
}
