"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";

type Deposit = {
  id: string;
  uid: string;
  username: string;
  email: string;
  amount: number;
  status: string;
  proof_base64?: string;
  created_at: string;
  deposit_wallets?: {
    asset: string;
    address: string;
  } | null;
};

type DepositSettings = {
  is_enabled: boolean;
  min_deposit_amount: number;
};

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<DepositSettings>({
    is_enabled: true,
    min_deposit_amount: 10,
  });
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalAmount: 0,
    todayDeposits: 0,
    todayAmount: 0,
  });

  // ✅ تحميل الإيداعات
  async function loadDeposits() {
    setLoading(true);
    const { data, error } = await supabase
      .from("deposits")
      .select(`
        id,
        uid,
        username,
        email,
        amount,
        status,
        proof_base64,
        created_at,
        deposit_wallets (
          asset,
          address
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      notify.deposit.failed();
    } else {
      setDeposits(data || []);
      calcStats(data || []);
    }
    setLoading(false);
  }

  // ✅ تحميل إعدادات الإيداع
  async function loadSettings() {
    const { data, error } = await supabase
      .from("deposit_settings")
      .select("is_enabled, min_deposit_amount")
      .limit(1)
      .maybeSingle();

    if (!error && data)
      setSettings({
        is_enabled: data.is_enabled,
        min_deposit_amount: Number(data.min_deposit_amount),
      });
  }

  useEffect(() => {
    loadDeposits();
    loadSettings();
  }, []);

  // ✅ حساب الإحصائيات
  function calcStats(data: Deposit[]) {
    const totalDeposits = data.length;
    const totalAmount = data.reduce((sum, d) => sum + Number(d.amount), 0);
    const today = new Date().toISOString().split("T")[0];
    const todayList = data.filter((d) =>
      d.created_at.startsWith(today)
    );
    const todayDeposits = todayList.length;
    const todayAmount = todayList.reduce(
      (sum, d) => sum + Number(d.amount),
      0
    );

    setStats({
      totalDeposits,
      totalAmount,
      todayDeposits,
      todayAmount,
    });
  }

  // ✅ حفظ الإعدادات
  async function saveSettings() {
    const { error } = await supabase
      .from("deposit_settings")
      .update({
        is_enabled: settings.is_enabled,
        min_deposit_amount: settings.min_deposit_amount,
        updated_at: new Date().toISOString(),
      })
      .neq("id", 0); // لتحديث أول صف فقط

    if (error) {
      notify.deposit.failed();
      console.error(error);
    } else {
      notify.deposit.submitted("Settings updated ✅");
    }
  }

  // ✅ الموافقة على الإيداع
  async function approveDeposit(dep: Deposit) {
    try {
      const { error } = await supabase
        .from("deposits")
        .update({ status: "approved" })
        .eq("id", dep.id);

      if (error) throw error;
      notify.deposit.submitted("Deposit approved ✅");
      loadDeposits();
    } catch (err) {
      console.error(err);
      notify.deposit.failed();
    }
  }

  // ❌ رفض الإيداع
  async function rejectDeposit(dep: Deposit) {
    try {
      const { error } = await supabase
        .from("deposits")
        .update({ status: "rejected" })
        .eq("id", dep.id);

      if (error) throw error;
      notify.deposit.submitted("Deposit rejected ❌");
      loadDeposits();
    } catch (err) {
      console.error(err);
      notify.deposit.failed();
    }
  }

  // ✅ فلترة حسب البحث
  const filteredDeposits = deposits.filter((dep) =>
    [dep.username, dep.email, dep.uid]
      .some((field) => field?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      {/* إعدادات الإيداع */}
      <Card className="border-border bg-background/40">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Deposit Settings</span>
            <Button onClick={saveSettings}>Save Changes</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(v) =>
                setSettings((s) => ({ ...s, is_enabled: v }))
              }
            />
            <Label>Deposits Enabled</Label>
          </div>
          <div>
            <Label>Minimum Deposit (USD)</Label>
            <Input
              type="number"
              value={settings.min_deposit_amount}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  min_deposit_amount: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Last Updated: {new Date().toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalDeposits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.totalAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Today Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.todayDeposits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Today Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.todayAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* البحث */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Deposit Requests</h1>
        <Input
          placeholder="Search by username, email or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
      </div>

      {/* قائمة الإيداعات */}
      {loading && <p className="text-muted-foreground">Loading...</p>}

      <div className="grid gap-4">
        {filteredDeposits.map((dep) => (
          <Card key={dep.id} className="bg-background border-border">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>
                  {dep.username} ({dep.email})
                </span>
                <Badge
                  className={
                    dep.status === "pending"
                      ? "bg-yellow-500/20 text-yellow-500"
                      : dep.status === "approved"
                      ? "bg-green-500/20 text-green-500"
                      : "bg-red-500/20 text-red-500"
                  }
                >
                  {dep.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>
                <strong>Asset:</strong> {dep.deposit_wallets?.asset ?? "-"}
              </p>
              <p>
                <strong>Address:</strong> {dep.deposit_wallets?.address ?? "-"}
              </p>
              <p>
                <strong>Amount:</strong> ${dep.amount}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {new Date(dep.created_at).toLocaleString()}
              </p>

              {dep.proof_base64 && (
                <div>
                  <p className="mb-1">
                    <strong>Proof:</strong>
                  </p>
                  <img
                    src={dep.proof_base64}
                    alt="Deposit Proof"
                    className="w-64 rounded border"
                  />
                </div>
              )}

              {dep.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => approveDeposit(dep)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => rejectDeposit(dep)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
