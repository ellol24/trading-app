"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Star,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"

interface Testimonial {
  id: string
  name: string
  role: string
  content: string
  rating: number
  active: boolean
  created_at?: string
}

export default function AdminTestimonialsPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Testimonial | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    role: "Platform Trader",
    content: "",
    rating: 5,
    active: true,
  })

  // Delete Confirm Dialog
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const fetchTestimonials = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/testimonials")
      const data = await res.json()
      if (data.success && Array.isArray(data.testimonials)) {
        setTestimonials(data.testimonials)
      } else {
        toast({ title: "Failed to load", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTestimonials()
  }, [])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormData({
      name: "",
      role: "Platform Trader",
      content: "",
      rating: 5,
      active: true,
    })
    setDialogOpen(true)
  }

  const handleOpenEdit = (item: Testimonial) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      role: item.role,
      content: item.content,
      rating: item.rating,
      active: item.active !== false,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both a user name and a comment text.",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      const isEdit = Boolean(editingItem)
      const url = "/api/admin/testimonials"
      const method = isEdit ? "PUT" : "POST"
      const payload = isEdit ? { id: editingItem?.id, ...formData } : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (data.success) {
        toast({
          title: isEdit ? "Review Updated" : "Review Added",
          description: `Successfully saved review for "${formData.name}".`,
        })
        setDialogOpen(false)
        fetchTestimonials()
      } else {
        toast({ title: "Save Failed", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Network Error", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (item: Testimonial) => {
    try {
      const updatedStatus = !item.active
      const res = await fetch("/api/admin/testimonials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active: updatedStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setTestimonials((prev) =>
          prev.map((t) => (t.id === item.id ? { ...t, active: updatedStatus } : t))
        )
        toast({
          title: updatedStatus ? "Review Activated" : "Review Deactivated",
          description: `"${item.name}" is now ${updatedStatus ? "visible" : "hidden"} on the landing page.`,
        })
      }
    } catch (err: any) {
      toast({ title: "Toggle Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/testimonials?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setTestimonials((prev) => prev.filter((t) => t.id !== id))
        toast({ title: "Deleted", description: "Review has been removed." })
        setDeleteConfirmId(null)
      } else {
        toast({ title: "Delete Failed", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleResetDefaults = async () => {
    if (!confirm("Reset testimonials to the recommended professional presets?")) return
    try {
      setLoading(true)
      const res = await fetch("/api/admin/testimonials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testimonials: [
            {
              id: "testi-1",
              name: "Sarah Johnson",
              role: "Professional Trader",
              content:
                "Xspy-trader has completely transformed how I manage my investments. The automated daily returns and instant execution are unmatched.",
              rating: 5,
              active: true,
            },
            {
              id: "testi-2",
              name: "Marcus Vance",
              role: "Crypto Asset Manager",
              content:
                "Clean UI, high security, and exceptional reliability. The daily package profit distribution is the smoothest in the industry.",
              rating: 5,
              active: true,
            },
            {
              id: "testi-3",
              name: "Elena Rostova",
              role: "VIP Investor",
              content:
                "Outstanding customer service and ultra-fast crypto gateway deposits. Highly recommended for serious crypto traders.",
              rating: 5,
              active: true,
            },
          ],
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Reset Complete", description: "Default showcase reviews have been restored." })
        fetchTestimonials()
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const activeCount = testimonials.filter((t) => t.active !== false).length
  const avgRating =
    testimonials.length > 0
      ? (testimonials.reduce((sum, t) => sum + (t.rating || 5), 0) / testimonials.length).toFixed(1)
      : "5.0"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-white bg-clip-text text-transparent flex items-center gap-2.5">
            <MessageSquareQuote className="h-7 w-7 text-blue-400" />
            User Reviews & Testimonials
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage the user names, comments, and star ratings displayed in the &ldquo;What Our Traders Say&rdquo; section of the homepage and reviews page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="border-slate-700 hover:bg-slate-800 text-slate-300"
            title="Restore professional showcase reviews"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Reset Defaults
          </Button>
          <Button onClick={handleOpenAdd} className="professional-gradient text-white shadow-lg shadow-blue-500/20">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Review
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Total Reviews</CardDescription>
            <CardTitle className="text-3xl font-bold text-white">{testimonials.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Stored in platform database</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Active on Homepage</CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-400">{activeCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-500/80">Currently visible to visitors</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Average Rating</CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-400 flex items-center gap-1.5">
              {avgRating}
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Based on active testimonials</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center justify-between">
            <span>Displayed Reviews</span>
            <span className="text-xs font-normal text-slate-400">
              Changes reflect immediately on the live homepage
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
              <span>Loading testimonials...</span>
            </div>
          ) : testimonials.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p>No testimonials configured yet.</p>
              <Button onClick={handleResetDefaults} variant="link" className="text-blue-400 mt-2">
                Click here to populate recommended presets
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonials.map((item) => (
                <div
                  key={item.id}
                  className={`group relative rounded-xl border p-5 transition-all duration-200 ${
                    item.active !== false
                      ? "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                      : "border-slate-800/40 bg-slate-950/30 opacity-60"
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      {[...Array(item.rating || 5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          item.active !== false
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                        title="Click to toggle visibility"
                      >
                        {item.active !== false ? "Active" : "Hidden"}
                      </button>
                    </div>
                  </div>

                  {/* Comment Quote */}
                  <p className="text-sm text-slate-200 leading-relaxed italic mb-4 min-h-[4rem]">
                    &ldquo;{item.content}&rdquo;
                  </p>

                  {/* User Info & Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/70">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-xs font-bold text-white uppercase">
                        {item.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white leading-tight">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenEdit(item)}
                        className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Edit Review"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        title="Delete Review"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg border-slate-800 bg-slate-950 p-6 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingItem ? "Edit Testimonial / تعديل التقييم" : "Add New Testimonial / إضافة تقييم جديد"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Configure the user profile details and quote that appear on the homepage showcase.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-name" className="text-xs text-slate-300">
                  User Name / اسم المستخدم
                </Label>
                <Input
                  id="t-name"
                  placeholder="e.g. Sarah Johnson"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-role" className="text-xs text-slate-300">
                  User Role / صفة المستخدم
                </Label>
                <Input
                  id="t-role"
                  placeholder="e.g. Crypto Trader, VIP Member"
                  value={formData.role}
                  onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>

            {/* Star Rating Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Rating / التقييم بالنجوم</Label>
              <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-700">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, rating: star }))}
                    className="p-1 hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= formData.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600 hover:text-slate-400"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-semibold text-amber-400 ml-2">
                  {formData.rating} / 5 Stars
                </span>
              </div>
            </div>

            {/* Comment Text */}
            <div className="space-y-1.5">
              <Label htmlFor="t-content" className="text-xs text-slate-300">
                Review Comment / نص التعليق أو الرأي
              </Label>
              <Textarea
                id="t-content"
                rows={4}
                placeholder="Write the trader's testimonial or review here..."
                value={formData.content}
                onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                className="bg-slate-900 border-slate-700 text-white leading-relaxed resize-none"
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div>
                <p className="text-xs font-medium text-white">Active on Website / مفعّل على الموقع</p>
                <p className="text-[11px] text-slate-400">
                  When enabled, this review will be visible in the homepage carousel.
                </p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, active: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-700 hover:bg-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="professional-gradient text-white"
            >
              {saving ? "Saving..." : editingItem ? "Update Review" : "Add Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirmId)} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md border-slate-800 bg-slate-950 p-6 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-400">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Are you sure you want to remove this review from the homepage? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="border-slate-700 hover:bg-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
