"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { QrCode, Plus, Eye, EyeOff, Copy } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@supabase/supabase-js"

// ✅ Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// النوع في قاعدة البيانات
type PlatformWallet = {
  id: string
  asset: "USDT(TRC20)" | "USDT(BEB20)"
  address: string
  visible: boolean
  created_at?: string
}

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<PlatformWallet[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ asset: PlatformWallet["asset"] | ""; address: string }>({ asset: "", address: "" })
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // ✅ جلب المحافظ من قاعدة البيانات
  useEffect(() => {
    fetchWallets()
  }, [])

  const fetchWallets = async () => {
    const { data, error } = await supabase.from("deposit_wallets").select("*").order("created_at", { ascending: false })
    if (!error && data) setWallets(data as PlatformWallet[])
  }

  // ✅ إضافة محفظة جديدة
  const add = async () => {
    if (!form.asset || !form.address) return
    setLoading(true)
    const { data, error } = await supabase.from("deposit_wallets").insert([
      { asset: form.asset, address: form.address, visible: true }
    ]).select().single()
    if (!error && data) {
      setWallets(prev => [data as PlatformWallet, ...prev])
      setForm({ asset: "", address: "" })
      setOpen(false)
      toast({ title: "Wallet Added", description: "The wallet has been successfully created." })
    }
    setLoading(false)
  }

  // ✅ إخفاء/إظهار محفظة
  const toggleVisible = async (id: string) => {
    const wallet = wallets.find(w => w.id === id)
    if (!wallet) return
    const { data, error } = await supabase.from("deposit_wallets").update({ visible: !wallet.visible }).eq("id", id).select().single()
    if (!error && data) {
      setWallets(prev => prev.map(w => w.id === id ? (data as PlatformWallet) : w))
    }
  }

  // ✅ حذف محفظة
  const handleDeleteWallet = async (id: string) => {
    setLoading(true)
    await supabase.from("deposit_wallets").delete().eq("id", id)
    setWallets((prev) => prev.filter((w) => w.id !== id))
    toast({ title: "Wallet Deleted", description: "The wallet has been successfully deleted." })
    setLoading(false)
  }

  // ✅ البحث
  const filteredWallets = useMemo(() => {
    return wallets.filter(
      (wallet) =>
        wallet.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wallet.address.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [wallets, searchTerm])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wallet Management</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Wallet</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Deposit Wallet</DialogTitle>
              <DialogDescription>These wallets are displayed to users for deposits.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3">
              <div className="space-y-2">
                <Label>Asset</Label>
                <Select value={form.asset} onValueChange={(v) => setForm(prev => ({ ...prev, asset: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT(TRC20)">USDT(TRC20)</SelectItem>
                    <SelectItem value="USDT(BEB20)">USDT(BEB20)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input placeholder="Enter address" value={form.address} onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={add} disabled={!form.asset || !form.address || loading}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* إحصائيات المحافظ */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets.length}</div>
            <p className="text-xs text-muted-foreground">Total deposit wallets configured</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Visible Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets.filter(w => w.visible).length}</div>
            <p className="text-xs text-muted-foreground">Currently visible to users</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Supported Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(wallets.map(w => w.asset)).size}</div>
            <p className="text-xs text-muted-foreground">Different crypto types</p>
          </CardContent>
        </Card>
      </div>

      {/* جدول المحافظ */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Deposit Wallets</CardTitle>
          <CardDescription>Manage the cryptocurrency deposit addresses.</CardDescription>
          <div className="relative mt-4">
            <Input
              placeholder="Search wallets by asset or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWallets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No wallets found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredWallets.map((wallet) => (
                  <TableRow key={wallet.id}>
                    <TableCell className="font-medium">{wallet.asset}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      <span className="truncate max-w-[200px] md:max-w-none">{wallet.address}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigator.clipboard.writeText(wallet.address)}
                        className="h-7 w-7 shrink-0"
                        aria-label="Copy address"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <QrCode className="h-10 w-10 rounded-sm" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={wallet.visible ? "text-green-600 border-green-600" : "text-gray-500 border-gray-500"}>
                        {wallet.visible ? "Visible" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleVisible(wallet.id)}>
                        {wallet.visible ? <><EyeOff className="w-4 h-4 mr-1" /> Hide</> : <><Eye className="w-4 h-4 mr-1" /> Show</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteWallet(wallet.id)} className="text-destructive">
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
