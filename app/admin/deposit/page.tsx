"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase/client"
import { notify } from "@/lib/notify"

type Deposit = {
  id: string
  uid: string
  username: string
  email: string
  amount: number
  status: string
  proof_base64?: string
  created_at: string
  deposit_wallets?: {
    asset: string
    address: string
  } | null
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  async function loadDeposits() {
    setLoading(true)
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
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      notify.deposit.failed()
    } else {
      setDeposits(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDeposits()
  }, [])

  // ✅ Admin Approve Deposit (trigger سيقوم بتحديث الرصيد)
  async function approveDeposit(dep: Deposit) {
    try {
      const { error: updateError } = await supabase
        .from("deposits")
        .update({ status: "approved" })
        .eq("id", dep.id)

      if (updateError) throw updateError

      notify.deposit.submitted("Deposit approved ✅ (Balance updated by trigger)")
      loadDeposits()
    } catch (err) {
      console.error(err)
      notify.deposit.failed()
    }
  }

  // ❌ Reject Deposit
  async function rejectDeposit(dep: Deposit) {
    try {
      const { error } = await supabase
        .from("deposits")
        .update({ status: "rejected" })
        .eq("id", dep.id)

      if (error) throw error

      notify.deposit.submitted("Deposit rejected ❌")
      loadDeposits()
    } catch (err) {
      console.error(err)
      notify.deposit.failed()
    }
  }

  // ✅ فلترة حسب البحث (username / email / uid)
  const filteredDeposits = deposits.filter((dep) =>
    [dep.username, dep.email, dep.uid]
      .some((field) => field?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-6">
      {/* الهيدر مع محرك البحث */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Deposit Requests</h1>
        <Input
          placeholder="Search by username, email or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
      </div>

      {loading && <p className="text-muted-foreground">Loading...</p>}

      <div className="grid gap-4">
        {filteredDeposits.map((dep) => (
          <Card key={dep.id} className="bg-background border-border">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{dep.username} ({dep.email})</span>
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
              <p><strong>Asset:</strong> {dep.deposit_wallets?.asset ?? "-"}</p>
              <p><strong>Address:</strong> {dep.deposit_wallets?.address ?? "-"}</p>
              <p><strong>Amount:</strong> {dep.amount}</p>
              <p><strong>Date:</strong> {new Date(dep.created_at).toLocaleString()}</p>

              {dep.proof_base64 && (
                <div>
                  <p className="mb-1"><strong>Proof:</strong></p>
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
  )
}
