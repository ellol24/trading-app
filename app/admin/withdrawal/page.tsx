"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableRow, TableHead,
  TableBody, TableCell
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [feePercentage, setFeePercentage] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  const [withdrawEnabled, setWithdrawEnabled] = useState(true);

  // ✅ تحميل إعداد السحب
  useEffect(() => {
    async function loadSetting() {
      const { data } = await supabase
        .from("withdrawal_settings")
        .select("withdraw_enabled")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (data) setWithdrawEnabled(data.withdraw_enabled);
    }

    loadSetting();
  }, []);

  // ✅ تبديل حالة السحب
  const toggleWithdraw = async () => {
    const newState = !withdrawEnabled;

    const { error } = await supabase.from("withdrawal_settings").insert([
      {
        fee_percentage,
        withdraw_enabled: newState,
      },
    ]);

    if (error) {
      alert("Error updating withdrawal state");
      return;
    }

    setWithdrawEnabled(newState);
  };

  // ✅ تحميل السحوبات
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setWithdrawals(data);
    }

    load();
  }, []);

  // ✅ تحديث حالة السحب (Approve / Reject)
  const updateStatus = async (id, status) => {
    await supabase.from("withdrawals").update({ status }).eq("id", id);

    setWithdrawals((ws) =>
      ws.map((w) => (w.id === id ? { ...w, status } : w))
    );
  };

  // ✅ حفظ نسبة العمولة
  const saveFeePercentage = async () => {
    setIsSaving(true);

    await supabase.from("withdrawal_settings").insert([
      {
        fee_percentage,
        withdraw_enabled,
      },
    ]);

    setIsSaving(false);
  };

  return (
    <div className="p-6 space-y-6">

      {/* ✅ زر تشغيل/تعطيل السحب */}
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

      {/* ✅ إعدادات العمولة */}
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

      {/* ✅ جدول السحوبات */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-xs">{w.id}</TableCell>
                  <TableCell>{w.user_id}</TableCell>
                  <TableCell>${w.amount}</TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        w.status === "approved"
                          ? "text-green-600 border-green-600"
                          : w.status === "rejected"
                          ? "text-red-600 border-red-600"
                          : "text-yellow-600 border-yellow-600"
                      }
                    >
                      {w.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateStatus(w.id, "approved")}
                    >
                      Approve
                    </Button>

                    <Button
                      size="sm"
                      className="text-red-600"
                      onClick={() => updateStatus(w.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
