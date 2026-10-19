"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { QrCode, Plus, Eye, EyeOff, Copy, Pencil, Trash2, StickyNote } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@supabase/supabase-js"
import { useLanguage } from "@/contexts/language-context"

// ✅ Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type PlatformWallet = {
  id: string
  asset: "USDT(TRC20)" | "USDT(BEB20)"
  address: string
  visible: boolean
  label?: string | null
  admin_notes?: string | null
  created_at?: string
}

type WalletFormState = {
  asset: PlatformWallet["asset"] | ""
  address: string
  label: string
  admin_notes: string
}

const emptyForm: WalletFormState = { asset: "", address: "", label: "", admin_notes: "" }

// ── Defined OUTSIDE AdminWalletsPage so React never remounts it on re-render ──
type WalletFormFieldsProps = {
  form: WalletFormState
  setForm: React.Dispatch<React.SetStateAction<WalletFormState>>
  t: (key: string) => string
}

function WalletFormFields({ form, setForm, t }: WalletFormFieldsProps) {
  return (
    <div className="grid gap-4 py-3">
      <div className="space-y-2">
        <Label>{t("admin.asset") || "Asset / Network"}</Label>
        <Select
          value={form.asset}
          onValueChange={(v) => setForm(prev => ({ ...prev, asset: v as PlatformWallet["asset"] }))}
        >
          <SelectTrigger><SelectValue placeholder={t("admin.selectAssetPlaceholder") || "Select asset"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="USDT(TRC20)">USDT (TRC20)</SelectItem>
            <SelectItem value="USDT(BEB20)">USDT (BEP20)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("admin.address") || "Wallet Address"}</Label>
        <Input
          placeholder={t("admin.walletAddress") || "Enter wallet address"}
          value={form.address}
          onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
          className="font-mono text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-blue-400" />
          {t("admin.walletLabel") || "Label (Admin only)"}
        </Label>
        <Input
          placeholder={t("admin.walletLabelPlaceholder") || 'e.g. "Bybit Main", "Binance Backup"'}
          value={form.label}
          onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {t("admin.walletLabelHint") || "A short friendly name visible only to admins."}
        </p>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-amber-400" />
          {t("admin.walletNotes") || "Admin Notes (internal only)"}
        </Label>
        <Textarea
          placeholder={t("admin.walletNotesPlaceholder") || "e.g. Rotation schedule, source exchange, remarks..."}
          value={form.admin_notes}
          onChange={(e) => setForm(prev => ({ ...prev, admin_notes: e.target.value }))}
          rows={3}
          className="resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {t("admin.walletNotesHint") || "These notes are never shown to users — only visible to admins."}
        </p>
      </div>
    </div>
  )
}

export default function AdminWalletsPage() {
  const { t } = useLanguage()
  const [wallets, setWallets] = useState<PlatformWallet[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PlatformWallet | null>(null)
  const [form, setForm] = useState<WalletFormState>(emptyForm)
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { toast } = useToast()

  // ── Fetch ───────────────────────────────────────────────────────────────────
  useEffect(() => { fetchWallets() }, [])

  const fetchWallets = async () => {
    const { data, error } = await supabase
      .from("deposit_wallets")
      .select("*")
      .order("created_at", { ascending: false })
    if (!error && data) setWallets(data as PlatformWallet[])
  }

  // ── Add new wallet ──────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.asset || !form.address.trim()) return
    setLoading(true)
    const { data, error } = await supabase.from("deposit_wallets").insert([{
      asset: form.asset,
      address: form.address.trim(),
      visible: true,
      label: form.label.trim() || null,
      admin_notes: form.admin_notes.trim() || null,
    }]).select().single()
    if (!error && data) {
      setWallets(prev => [data as PlatformWallet, ...prev])
      setForm(emptyForm)
      setAddOpen(false)
      toast({ title: "✅ Wallet Added", description: "The wallet has been successfully created." })
    } else {
      toast({ title: "❌ Error", description: error?.message || "Failed to add wallet.", variant: "destructive" })
    }
    setLoading(false)
  }

  // ── Open edit dialog ────────────────────────────────────────────────────────
  const openEdit = (wallet: PlatformWallet) => {
    setEditTarget(wallet)
    setForm({
      asset: wallet.asset,
      address: wallet.address,
      label: wallet.label ?? "",
      admin_notes: wallet.admin_notes ?? "",
    })
  }

  // ── Save edits ──────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editTarget || !form.asset || !form.address.trim()) return
    setLoading(true)
    const { data, error } = await supabase.from("deposit_wallets").update({
      asset: form.asset,
      address: form.address.trim(),
      label: form.label.trim() || null,
      admin_notes: form.admin_notes.trim() || null,
    }).eq("id", editTarget.id).select().single()
    if (!error && data) {
      setWallets(prev => prev.map(w => w.id === editTarget.id ? (data as PlatformWallet) : w))
      setEditTarget(null)
      setForm(emptyForm)
      toast({ title: "✅ Wallet Updated", description: "Changes saved successfully." })
    } else {
      toast({ title: "❌ Error", description: error?.message || "Failed to save changes.", variant: "destructive" })
    }
    setLoading(false)
  }

  // ── Toggle visibility ───────────────────────────────────────────────────────
  const toggleVisible = async (id: string) => {
    const wallet = wallets.find(w => w.id === id)
    if (!wallet) return
    const { data, error } = await supabase
      .from("deposit_wallets")
      .update({ visible: !wallet.visible })
      .eq("id", id).select().single()
    if (!error && data) {
      setWallets(prev => prev.map(w => w.id === id ? (data as PlatformWallet) : w))
      toast({ title: wallet.visible ? "🙈 Wallet Hidden" : "👁️ Wallet Visible", description: "Visibility updated." })
    }
  }

  // ── Delete wallet ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setLoading(true)
    const { error } = await supabase.from("deposit_wallets").delete().eq("id", id)
    if (!error) {
      setWallets(prev => prev.filter(w => w.id !== id))
      toast({ title: "🗑️ Wallet Deleted", description: "The wallet has been removed." })
    } else {
      toast({ title: "❌ Error", description: error.message, variant: "destructive" })
    }
    setDeleteConfirmId(null)
    setLoading(false)
  }

  // ── Search filter ───────────────────────────────────────────────────────────
  const filteredWallets = useMemo(() => wallets.filter(w =>
    w.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.label ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  ), [wallets, searchTerm])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("admin.walletManagementTitle") || "Wallet Management"}</h1>

        {/* Add Wallet Dialog */}
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm(emptyForm) }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> {t("admin.addWalletBtn") || "Add Wallet"}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("admin.addNewDepositWallet") || "Add New Deposit Wallet"}</DialogTitle>
              <DialogDescription>{t("admin.depositWalletsDesc") || "Manage wallet addresses shown to users for deposits."}</DialogDescription>
            </DialogHeader>
            <WalletFormFields form={form} setForm={setForm} t={t} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>{t("common.cancel") || "Cancel"}</Button>
              <Button onClick={handleAdd} disabled={!form.asset || !form.address.trim() || loading}>
                {loading ? "Saving…" : (t("common.save") || "Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader><CardTitle className="text-sm font-medium">{t("admin.totalWallets") || "Total Wallets"}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets.length}</div>
            <p className="text-xs text-muted-foreground">{t("admin.totalDepositWalletsConfig") || "Total deposit wallets configured"}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader><CardTitle className="text-sm font-medium">{t("admin.visibleWallets") || "Visible Wallets"}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets.filter(w => w.visible).length}</div>
            <p className="text-xs text-muted-foreground">{t("admin.currentlyVisibleToUsers") || "Currently shown to users"}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-md">
          <CardHeader><CardTitle className="text-sm font-medium">{t("admin.supportedAssets") || "Supported Assets"}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(wallets.map(w => w.asset)).size}</div>
            <p className="text-xs text-muted-foreground">{t("admin.differentCryptoTypes") || "Different crypto types"}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Wallets table ── */}
      <Card className="bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle>{t("admin.depositWallets") || "Deposit Wallets"}</CardTitle>
          <CardDescription>{t("admin.depositWalletsDesc") || "Manage cryptocurrency deposit addresses."}</CardDescription>
          <div className="relative mt-4">
            <Input
              placeholder={t("admin.searchWalletsPlaceholder") || "Search by asset, label, or address…"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.asset") || "Asset / Network"}</TableHead>
                <TableHead>{t("admin.address") || "Address"}</TableHead>
                <TableHead>{t("admin.walletLabel") || "Label"}</TableHead>
                <TableHead>{t("admin.walletNotes") || "Notes"}</TableHead>
                <TableHead>{t("admin.qrCode") || "QR"}</TableHead>
                <TableHead>{t("admin.status") || "Status"}</TableHead>
                <TableHead className="text-right">{t("admin.actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWallets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t("common.noData") || "No wallets found."}
                  </TableCell>
                </TableRow>
              ) : filteredWallets.map((wallet) => (
                <TableRow key={wallet.id} className={!wallet.visible ? "opacity-60" : ""}>
                  {/* Asset */}
                  <TableCell className="font-medium whitespace-nowrap">{wallet.asset}</TableCell>

                  {/* Address */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs truncate max-w-[160px] md:max-w-[220px]">{wallet.address}</span>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => { navigator.clipboard.writeText(wallet.address); toast({ title: "Copied!" }) }}
                        className="h-7 w-7 shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>

                  {/* Label (admin only) */}
                  <TableCell>
                    {wallet.label
                      ? <span className="text-sm text-blue-400 font-medium">{wallet.label}</span>
                      : <span className="text-xs text-muted-foreground italic">—</span>}
                  </TableCell>

                  {/* Notes preview (admin only) */}
                  <TableCell>
                    {wallet.admin_notes ? (
                      <span
                        className="text-xs text-amber-400/80 max-w-[140px] truncate block"
                        title={wallet.admin_notes}
                      >
                        📝 {wallet.admin_notes}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </TableCell>

                  {/* QR */}
                  <TableCell>
                    <QrCode className="h-9 w-9 rounded-sm text-muted-foreground" />
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={wallet.visible
                        ? "text-green-500 border-green-500"
                        : "text-gray-500 border-gray-500"}
                    >
                      {wallet.visible
                        ? (t("admin.visible") || "Visible")
                        : (t("admin.hidden") || "Hidden")}
                    </Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit */}
                      <Button size="sm" variant="outline" onClick={() => openEdit(wallet)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        {t("admin.edit") || "Edit"}
                      </Button>

                      {/* Toggle visibility */}
                      <Button size="sm" variant="outline" onClick={() => toggleVisible(wallet.id)}>
                        {wallet.visible
                          ? <><EyeOff className="w-3.5 h-3.5 mr-1" />{t("admin.hide") || "Hide"}</>
                          : <><Eye className="w-3.5 h-3.5 mr-1" />{t("admin.unhide") || "Show"}</>}
                      </Button>

                      {/* Delete with confirm */}
                      {deleteConfirmId === wallet.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(wallet.id)}
                            disabled={loading}
                          >
                            {t("admin.confirmDelete") || "Confirm"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                            {t("common.cancel") || "Cancel"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(wallet.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          {t("admin.delete") || "Delete"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Edit Wallet Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setForm(emptyForm) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.editWallet") || "Edit Wallet"}</DialogTitle>
            <DialogDescription>
              {t("admin.editWalletDesc") || "Update wallet details. Changes apply immediately."}
            </DialogDescription>
          </DialogHeader>
          <WalletFormFields form={form} setForm={setForm} t={t} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTarget(null); setForm(emptyForm) }}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button onClick={handleEdit} disabled={!form.asset || !form.address.trim() || loading}>
              {loading ? "Saving…" : (t("common.saveChanges") || "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
