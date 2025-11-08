"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [feePercentage, setFeePercentage] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [withdrawEnabled, setWithdrawEnabled] = useState(true);

  // ✅ تحميل إعدادات السحب
  useEffect(() => {
    async function loadSetting() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage, withdraw_enabled")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setWithdrawEnabled(data.withdraw_enabled);
        setFeePercentage(data.fee_percentage);
      }
    }

    loadSetting();
  }, []);

  // ✅ تشغيل / تعطيل السحب
  const toggleWithdraw = async () => {
    const newState = !withdrawEnabled;

    const { error } = await supabase.from("withdrawal_settings").insert([
      {
        fee_percentage: feePercentage,
        withdraw_enabled: newState,
      },
    ]);

    if (error) {
      alert("Error updating withdrawal state");
      return;
    }

    setWithdrawEnabled(newState);
  };

  // ✅ تحميل السحوبات + بيانات المحفظة + بيانات المستخدم
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("withdrawals")
        .select(`
          *,
          withdrawal_wallets(*),
          user_profiles(id, full_name, email, username)
        `)
        .order("created_at", { ascending: false });

      if (data) setWithdrawals(data);
    }

    load();
  }, []);

  // ✅ تحديث حالة طلب السحب
  const updateStatus = async (id, status) => {
    await supabase.from("withdrawals").update({ status }).eq("id", id);

    setWithdrawals((current) =>
      current.map((w) => (w.id === id ? { ...w, status } : w))
    );
  };

  // ✅ حفظ النسبة
  const saveFeePercentage = async () => {
    setIsSaving(true);

    await supabase.from("withdrawal_settings").insert([
      {
        fee_percentage: feePercentage,
        withdraw_enabled: withdrawEnabled,
      },
    ]);

    setIsSaving(false);
  };

  return (
    <div className="p-6 space-y-6">

      {/* ✅ التحكم بالسحب */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle>Withdraw Control</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={toggleWithdraw}
            className={withdrawEnabled ? "bg-red-600" : "bg-green-600"}
          >
            {withdrawEnabled ? "Disable Withdrawals" : "Enable Withdrawals"}
          </Button>

          <p className="mt-2 text-sm text-gray-600">
            Status: {withdrawEnabled ? "✅ Enabled" : "⛔ Disabled"}
          </p>
        </CardContent>
      </Card>

      {/* ✅ الإعدادات */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Settings</CardTitle>
        </CardHeader>

        <CardContent className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium">Fee Percentage (%)</label>
            <Input
              type="number"
              value={feePercentage}
              onChange={(e) => setFeePercentage(Number(e.target.value))}
              className="w-32"
            />
          </div>

          <Button onClick={saveFeePercentage} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      {/* ✅ طلبات السحب */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          {withdrawals.map((w) => (
            <div
              key={w.id}
              className="p-4 border border-gray-700 rounded-lg bg-gray-900/40 space-y-3"
            >
              {/* ✅ المبلغ والحالة */}
              <div className="flex items-center justify-between">
                <h2 className="text-white text-lg font-semibold">
                  ${w.amount}
                </h2>

                <Badge
                  variant="outline"
                  className={
                    w.status === "approved"
                      ? "text-green-400 border-green-400"
                      : w.status === "rejected"
                      ? "text-red-400 border-red-400"
                      : "text-yellow-400 border-yellow-400"
                  }
                >
                  {w.status}
                </Badge>
              </div>

              {/* ✅ بيانات المستخدم */}
              <div className="text-sm text-gray-300">
                <p><strong>User:</strong> {w.user?.full_name || w.user?.username || "Unknown"}</p>
                <p><strong>Email:</strong> {w.user?.email}</p>
                <p><strong>User ID:</strong> {w.user?.id}</p>
              </div>

              {/* ✅ بيانات المحفظة */}
              <div className="text-sm text-gray-300">
                <p><strong>Network:</strong> {w.wallet?.asset}</p>
                <p><strong>Address:</strong> {w.wallet?.address}</p>
              </div>

              {/* ✅ التفاصيل المالية */}
              <div className="text-sm text-gray-400 space-y-1">
                <p>Fee: ${w.fee}</p>
                <p>Net Amount: ${w.net_amount}</p>
                <p>Date: {new Date(w.created_at).toLocaleString()}</p>
              </div>

              {/* ✅ أزرار التحكم */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="bg-green-600"
                  onClick={() => updateStatus(w.id, "approved")}
                >
                  Approve
                </Button>

                <Button
                  size="sm"
                  className="bg-red-600"
                  onClick={() => updateStatus(w.id, "rejected")}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}

          {withdrawals.length === 0 && (
            <p className="text-gray-400 text-center py-4 text-sm">
              No withdrawals yet
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
