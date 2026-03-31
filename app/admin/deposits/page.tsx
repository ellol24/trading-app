"use client"

import { useMemo, useState } from "react"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, CheckCircle2, XCircle, ImageIcon, Clock, DollarSign } from 'lucide-react'
import { useDepositsStore, type DepositRequest } from "@/lib/deposits-store"

export default function AdminDepositsPage() {
  const items = useDepositsStore((s) => s.items)
  const update = useDepositsStore((s) => s.updateDeposit)

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "pending" | "confirmed" | "rejected">("all")

  const [selected, setSelected] = useState<DepositRequest | null>(null)
  const [viewProof, setViewProof] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [txId, setTxId] = useState("")
  const [reason, setReason] = useState("")

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter((d) => {
      const matchQ =
        !q ||
        d.id.toLowerCase().includes(q) ||
        (d.username?.toLowerCase().includes(q) ?? false) ||
        (d.email?.toLowerCase().includes(q) ?? false) ||
        d.networkLabel.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q)
      const matchStatus = status === "all" || d.status === status
      return matchQ && matchStatus
    })
  }, [items, query, status])

  const counts = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((d) => d.status === "pending").length,
      confirmed: items.filter((d) => d.status === "confirmed").length,
      rejected: items.filter((d) => d.status === "rejected").length,
      totalAmount: items.reduce((sum, d) => sum + d.amount, 0),
    }
  }, [items])

  const statusBadge = (s: DepositRequest["status"]) => {
    switch (s) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-600">pending</Badge>
      case "confirmed":
        return <Badge className="bg-green-500/20 text-green-600 border-green-600">confirmed</Badge>
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-600 border-red-600">rejected</Badge>
    }
  }

  const openConfirm = (d: DepositRequest) => {
    setSelected(d)
    setTxId(d.txId || "")
    setConfirmOpen(true)
  }

  const openReject = (d: DepositRequest) => {
    setSelected(d)
    setReason(d.rejectionReason || "")
    setRejectOpen(true)
  }

  const doConfirm = () => {
    if (!selected) return
    update(selected.id, { status: "confirmed", txId })
    setConfirmOpen(false)
    setSelected(null)
    setTxId("")
  }

  const doReject = () => {
    if (!selected) return
    update(selected.id, { status: "rejected", rejectionReason: reason })
    setRejectOpen(false)
    setSelected(null)
    setReason("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Deposits</h1>
            <p className="text-blue-200">Review and approve user deposit requests</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-yellow-400 border-yellow-400 bg-yellow-400/10">
              <Clock className="w-3 h-3 mr-1" />
              {counts.pending} pending
            </Badge>
            <Badge variant="outline" className="text-green-400 border-green-400 bg-green-400/10">
              <DollarSign className="w-3 h-3 mr-1" />
              ${counts.totalAmount.toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by ID, user, email, network, or address"
                  className="pl-9 bg-background/50 border-border/50"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Records */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white">Records ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.map((d) => (
              <div key={d.id} className="p-4 rounded-lg bg-background/10 border border-border/20">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">
                      {d.username || "User"}{" "}
                      <span className="text-muted-foreground">({d.email || "no-email"})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {d.networkLabel} • {d.address}
                    </p>
                    <p className="text-xs text-muted-foreground">ID: {d.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-blue-300 border-blue-300 bg-blue-300/10">
                      ${d.amount}
                    </Badge>
                    {statusBadge(d.status)}
                  </div>
                </div>

                {d.rejectionReason && (
                  <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-300">Rejection: {d.rejectionReason}</p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-transparent border-border/50"
                    onClick={() => {
                      setSelected(d)
                      setViewProof(true)
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-1" /> View Proof
                  </Button>
                  {d.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-border/50"
                        onClick={() => openConfirm(d)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openReject(d)}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Proof Dialog */}
        <Dialog open={viewProof} onOpenChange={setViewProof}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Payment Proof</DialogTitle>
              <DialogDescription>
                {selected ? `${selected.networkLabel} • $${selected.amount} • ${selected.id}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected?.proofDataUrl || "/placeholder.svg?height=400&width=400&query=payment%20proof"}
                alt="Payment proof"
                className="max-h-[70vh] rounded border border-border/40"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirm Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deposit</DialogTitle>
              <DialogDescription>
                {selected ? `Confirm ${selected.username || "User"} • $${selected.amount} on ${selected.networkLabel}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-sm">Transaction ID / Hash</Label>
              <Input
                placeholder="Enter on-chain TxID (optional for manual confirm)"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={doConfirm}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Deposit</DialogTitle>
              <DialogDescription>
                {selected ? `Reject ${selected.username || "User"} • $${selected.amount} on ${selected.networkLabel}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-sm">Reason</Label>
              <Input
                placeholder="Provide rejection reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={doReject}>
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
