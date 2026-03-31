"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { reviewKyc, listKyc, subscribeKyc, type KYCStatus, type KycRecord } from "@/lib/kyc-store"
import { CheckCircle2, FileSearch, Image, ShieldCheck, XCircle } from 'lucide-react'

export default function AdminKycPage() {
  const { toast } = useToast()
  const [records, setRecords] = useState<KycRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<"all" | KYCStatus>("all")
  const [search, setSearch] = useState("")

  useEffect(() => {
    setRecords(listKyc())
    const unsub = subscribeKyc(() => setRecords(listKyc()))
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter
      const q = search.trim().toLowerCase()
      const matchSearch =
        q.length === 0 ||
        r.email?.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        r.documentNumber.toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [records, statusFilter, search])

  function mark(id: string, status: "approved" | "rejected") {
    reviewKyc(id, status)
    toast({
      title: `KYC ${status === "approved" ? "Approved" : "Rejected"}`,
      description: "The user has been notified.",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7" /> KYC Reviews
          </h1>
          <div className="flex items-center gap-3">
            <Input placeholder="Search name, email or document #" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 bg-background/50 border-border/50" />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-40 bg-background/50 border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="not_submitted">Not Submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white">Submissions ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="hover:bg-white/5">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-white font-semibold">
                            {r.firstName} {r.lastName}
                          </div>
                          <div className="text-xs text-blue-200">{r.email || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.documentType.toUpperCase()} • {r.documentNumber}
                      </TableCell>
                      <TableCell className="text-sm">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        {r.status === "approved" ? (
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                          </Badge>
                        ) : r.status === "rejected" ? (
                          <Badge variant="outline" className="text-red-400 border-red-400">
                            <XCircle className="w-3 h-3 mr-1" /> Rejected
                          </Badge>
                        ) : r.status === "pending" ? (
                          <Badge variant="outline" className="text-yellow-300 border-yellow-300">Pending</Badge>
                        ) : (
                          <Badge variant="outline" className="text-blue-300 border-blue-300">Not Submitted</Badge>
                        )}
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <FileSearch className="w-4 h-4 mr-1" /> View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Image className="w-5 h-5" /> Documents • {r.firstName} {r.lastName}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {r.frontImage && <img src={r.frontImage || "/placeholder.svg"} alt="Front ID" className="w-full rounded-lg border border-border/40" />}
                              {r.backImage && <img src={r.backImage || "/placeholder.svg"} alt="Back ID" className="w-full rounded-lg border border-border/40" />}
                              {r.selfieImage && <img src={r.selfieImage || "/placeholder.svg"} alt="Selfie" className="w-full rounded-lg border border-border/40" />}
                              {r.proofOfAddressImage && <img src={r.proofOfAddressImage || "/placeholder.svg"} alt="Proof of Address" className="w-full rounded-lg border border-border/40" />}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Document</Label>
                                <div className="text-sm">{r.documentType.toUpperCase()}</div>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Number</Label>
                                <div className="text-sm">{r.documentNumber}</div>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Submitted</Label>
                                <div className="text-sm">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</div>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button className="professional-gradient" onClick={() => mark(r.id, "approved")}>
                                Approve
                              </Button>
                              <Button variant="destructive" onClick={() => mark(r.id, "rejected")}>
                                Reject
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
