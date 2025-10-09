"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  user_profiles?: {
    full_name: string;
    email: string;
  } | null;
  wallet?: {
    asset: string;
    address: string;
  } | null;
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [feePercentage, setFeePercentage] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ تحميل السحوبات مع بيانات المستخدم والمحفظة
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("withdrawals")
        .select(
          `
          id,
          user_id,
          amount,
          status,
          created_at,
          user_profiles(full_name, email)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading withdrawals:", error);
        return;
      }

      // ✅ الآن نضيف بيانات المحفظة لكل مستخدم من جدول withdrawal_wallets
      const userIds = data?.map((w) => w.user_id);
      const { data: wallets } = await supabase
        .from("withdrawal_wallets")
        .select("user_id, asset, address")
        .in("user_id", userIds || []);

      const enriched = data?.map((w) => ({
        ...w,
        wallet: wallets?.find((ww) => ww.user_id === w.user_id) || null,
      }));

      setWithdrawals(enriched || []);
    }

    load();
  }, []);

  // ✅ تحميل إعدادات العمولة
  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await supabase
        .from("withdrawal_settings")
        .select("fee_percentage")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setFeePercentage(Number(data.fee_percentage));
      }
    }
    loadSettings();
  }, []);

  // ✅ تحديث حالة السحب
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("withdrawals").update({ status }).eq("id", id);
    if (error) {
      alert("Error updating status: " + error.message);
      return;
    }
    setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
  };

  // ✅ تحديث نسبة العمولة
  const saveFeePercentage = async () => {
    setIsSaving(true);
    const { error } = await supabase.from("withdrawal_settings").insert([{ fee_percentage: feePercentage }]);
    setIsSaving(false);
    if (error) {
      alert("Error updating fee: " + error.message);
    } else {
      alert("Fee percentage updated successfully ✅");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* ⚙️ إعدادات العمولة */}
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
              min={0}
              max={100}
            />
          </div>
          <Button onClick={saveFeePercentage} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      {/* 💸 جدول السحوبات */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-xs">{w.id}</TableCell>
                  <TableCell>
                    {w.user_profiles?.full_name || "Unknown"} <br />
                    <span className="text-xs text-muted-foreground">{w.user_profiles?.email}</span>
                  </TableCell>
                  <TableCell>{w.wallet?.asset || "—"}</TableCell>
                  <TableCell className="truncate max-w-[160px]">{w.wallet?.address || "—"}</TableCell>
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
                    <Button size="sm" variant="outline" onClick={() => updateStatus(w.id, "approved")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(w.id, "rejected")}
                      className="text-destructive"
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
