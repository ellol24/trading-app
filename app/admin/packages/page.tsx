"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// استيراد أي مكونات UI متوفرة عندك (إذا لم تتوفر، يمكن استبدالها بعناصر HTML عادية)
// هنا أستخدم أصغر كمية ممكنة من المكونات الافتراضية
import { Plus, Edit, Trash2, Percent, Calendar, Coins, Users, DollarSign, TrendingUp, Package } from "lucide-react";

type DBPackage = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  risk_level: string | null;
  min_investment: number | null;
  max_investment: number | null;
  duration_days: number | null;
  roi_daily_percentage: number | null;
  total_roi_percentage: number | null;
  is_active: boolean | null;
  max_purchases_per_user: number | null;
  total_capacity: number | null;
  current_invested: number | null;
  features: any | null;
  created_at: string | null;
};

type PackageItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  roiDailyPercent: number;
  durationDays: number;
  minInvestment: number;
  maxInvestment: number;
  active: boolean;
  totalPurchases?: number;
  totalInvested?: number;
  activePurchases?: number;
  features?: string[];
  raw?: DBPackage;
};

const BUCKET = "package-images";

export default function AdminPackagesPage() {
  const [items, setItems] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PackageItem | null>(null);
  const [statistics, setStatistics] = useState({
    totalPackages: 0,
    activePackages: 0,
    totalPurchases: 0,
    totalRevenue: 0,
  });

  // نموذج محلي للمودال
  const [form, setForm] = useState({
    title: "",
    description: "",
    roiDailyPercent: 0,
    durationDays: 30,
    minInvestment: 0,
    maxInvestment: 0,
    imageUrl: "/placeholder.svg",
    active: true,
    maxPurchasesPerUser: 0,
    totalCapacity: 0,
    currentInvested: 0,
    featuresText: "",
  });

  useEffect(() => {
    void loadData();
    // (اختياري) يمكنك إعداد Realtime subscription هنا إن أردت
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // جلب الباقات + الاستثمارات لحساب الإحصاءات
      const [{ data: packages }, { data: investments }] = await Promise.all([
        supabase.from("investment_packages").select("*").order("created_at", { ascending: false }),
        supabase.from("investments").select("*"),
      ]);

      const pkgs = (packages || []) as DBPackage[];
      const invs = (investments || []) as any[];

      // احسب الإحصاءات العامة
      const totalPackages = pkgs.length;
      const activePackages = pkgs.filter((p) => !!p.is_active).length;
      const totalPurchases = invs.length;
      const totalRevenue = invs.reduce((s, i) => s + Number(i.amount || 0), 0);

      // دمج بيانات الباقة مع إحصاءات خاصة بكل باقة
      const mapped: PackageItem[] = pkgs.map((p) => {
        const related = invs.filter((i) => String(i.package_id) === String(p.id));
        return {
          id: p.id,
          title: p.title,
          description: p.description,
          imageUrl: p.image_url,
          roiDailyPercent: Number(p.roi_daily_percentage || 0),
          durationDays: Number(p.duration_days || 0),
          minInvestment: Number(p.min_investment || 0),
          maxInvestment: Number(p.max_investment || 0),
          active: !!p.is_active,
          totalPurchases: related.length,
          totalInvested: related.reduce((s, r) => s + Number(r.amount || 0), 0),
          activePurchases: related.filter((r) => r.status === "active").length,
          features: Array.isArray(p.features) ? p.features : [],
          raw: p,
        };
      });

      setItems(mapped);
      setStatistics({
        totalPackages,
        activePackages,
        totalPurchases,
        totalRevenue,
      });
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      roiDailyPercent: 1,
      durationDays: 30,
      minInvestment: 0,
      maxInvestment: 0,
      imageUrl: "/placeholder.svg",
      active: true,
      maxPurchasesPerUser: 0,
      totalCapacity: 0,
      currentInvested: 0,
      featuresText: "",
    });
    setOpen(true);
  }

  function startEdit(p: PackageItem) {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description || "",
      roiDailyPercent: p.roiDailyPercent || 0,
      durationDays: p.durationDays || 0,
      minInvestment: p.minInvestment || 0,
      maxInvestment: p.maxInvestment || 0,
      imageUrl: p.imageUrl || "/placeholder.svg",
      active: p.active,
      maxPurchasesPerUser: p.raw?.max_purchases_per_user || 0,
      totalCapacity: p.raw?.total_capacity || 0,
      currentInvested: p.raw?.current_invested || 0,
      featuresText: (p.features || []).join(", "),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title) {
      alert("الاسم مطلوب");
      return;
    }
    setProcessing(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      image_url: form.imageUrl || null,
      min_investment: Number(form.minInvestment),
      max_investment: Number(form.maxInvestment),
      duration_days: Number(form.durationDays),
      roi_daily_percentage: Number(form.roiDailyPercent),
      total_roi_percentage: Number((Number(form.roiDailyPercent) * Number(form.durationDays)).toFixed(4)),
      is_active: Boolean(form.active),
      max_purchases_per_user: Number(form.maxPurchasesPerUser) || null,
      total_capacity: Number(form.totalCapacity) || null,
      current_invested: Number(form.currentInvested) || 0,
      features: form.featuresText ? form.featuresText.split(",").map((s) => s.trim()) : [],
    };

    try {
      if (editing) {
        const { error } = await supabase.from("investment_packages").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investment_packages").insert(payload);
        if (error) throw error;
      }
      await loadData();
      setOpen(false);
    } catch (err: any) {
      console.error("save error", err);
      alert(err?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setProcessing(false);
    }
  }

  async function remove(pkgId: string) {
    if (!confirm("هل تريد حذف هذه الباقة؟ هذا قد يفشل إن كانت هناك مشتريات نشطة.")) return;
    setProcessing(true);
    try {
      const { error } = await supabase.from("investment_packages").delete().eq("id", pkgId);
      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "خطأ في الحذف");
    } finally {
      setProcessing(false);
    }
  }

  async function toggleActive(pkg: PackageItem) {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("investment_packages")
        .update({ is_active: !pkg.active })
        .eq("id", pkg.id);
      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "خطأ في تغيير الحالة");
    } finally {
      setProcessing(false);
    }
  }

  // رفع صورة إلى storage (اختياري)
  async function uploadImage(file: File) {
    if (!file) return;
    setProcessing(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `pkg_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (data?.publicUrl) {
        setForm((f) => ({ ...f, imageUrl: data.publicUrl }));
      }
    } catch (err) {
      console.error("upload image error", err);
      alert("فشل رفع الصورة");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">إدارة الباقات</h1>
          <p className="text-sm text-blue-200">أنشئ وحرِّر الباقات الاستثمارية هنا</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={startCreate}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            <Plus className="w-4 h-4" /> إضافة باقة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-200">إجمالي الباقات</div>
              <div className="text-2xl font-bold">{statistics.totalPackages}</div>
            </div>
            <Package className="w-6 h-6 text-blue-300" />
          </div>
          <div className="text-sm text-blue-200 mt-2">{statistics.activePackages} مفعلة</div>
        </div>

        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-200">إجمالي المشتريات</div>
              <div className="text-2xl font-bold">{statistics.totalPurchases}</div>
            </div>
            <Users className="w-6 h-6 text-blue-300" />
          </div>
          <div className="text-sm text-blue-200 mt-2">كل الأوقات</div>
        </div>

        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-200">إجمالي الإيرادات</div>
              <div className="text-2xl font-bold">${statistics.totalRevenue.toLocaleString()}</div>
            </div>
            <DollarSign className="w-6 h-6 text-blue-300" />
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-200">متوسط الاستثمار</div>
              <div className="text-2xl font-bold">
                ${statistics.totalPurchases ? Math.round(statistics.totalRevenue / statistics.totalPurchases) : 0}
              </div>
            </div>
            <TrendingUp className="w-6 h-6 text-blue-300" />
          </div>
        </div>
      </div>

      {/* قائمة الباقات */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div>جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="text-slate-300">لا توجد باقات</div>
        ) : (
          items.map((p) => (
            <div key={p.id} className="bg-slate-800 rounded p-4 border border-slate-700 shadow">
              <div className="flex gap-4">
                <img src={p.imageUrl || "/placeholder.svg"} alt={p.title} className="w-28 h-20 object-cover rounded" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-white">{p.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${p.active ? "bg-green-600 text-green-100" : "bg-red-600 text-red-100"}`}>
                      {p.active ? "مفعل" : "معطل"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">{p.description}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-blue-200">
                    <div>⏳ {p.durationDays} يوم</div>
                    <div>📈 {p.roiDailyPercent}% يومياً</div>
                    <div>💰 {p.minInvestment} - {p.maxInvestment} $</div>
                    <div>🔢 مشتريات: {p.totalPurchases || 0}</div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button onClick={() => startEdit(p)} className="flex-1 px-3 py-2 bg-yellow-600 rounded hover:bg-yellow-700 text-sm">
                      <Edit className="inline w-4 h-4 mr-1" /> تعديل
                    </button>
                    <button onClick={() => toggleActive(p)} className="flex-1 px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm">
                      {p.active ? "تعطيل" : "تفعيل"}
                    </button>
                    <button onClick={() => remove(p.id)} className="flex-1 px-3 py-2 bg-red-600 rounded hover:bg-red-700 text-sm">
                      <Trash2 className="inline w-4 h-4 mr-1" /> حذف
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* مودال الإضافة / التعديل */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-700 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <h2 className="text-lg font-semibold">{editing ? "تعديل باقة" : "إضافة باقة"}</h2>
              <button onClick={() => setOpen(false)} className="px-3 py-1 rounded border border-slate-600 hover:bg-slate-800">إغلاق</button>
            </div>

            {/* Body */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
              <TextField label="الاسم" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
              <NumberField label="المدة (يوم)" value={form.durationDays} onChange={(v) => setForm({ ...form, durationDays: v })} />
              <NumberField label="النسبة اليومية %" value={form.roiDailyPercent} onChange={(v) => setForm({ ...form, roiDailyPercent: v })} />
              <NumberField label="الحد الأدنى" value={form.minInvestment} onChange={(v) => setForm({ ...form, minInvestment: v })} />
              <NumberField label="الحد الأقصى" value={form.maxInvestment} onChange={(v) => setForm({ ...form, maxInvestment: v })} />
              <NumberField label="الحد الأقصى لكل مستخدم" value={form.maxPurchasesPerUser} onChange={(v) => setForm({ ...form, maxPurchasesPerUser: v })} />
              <NumberField label="السعة الإجمالية" value={form.totalCapacity} onChange={(v) => setForm({ ...form, totalCapacity: v })} />
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">رابط الصورة</label>
                <input className="w-full p-2 rounded bg-slate-800 border border-slate-700" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                <input type="file" className="mt-2" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">الوصف</label>
                <textarea className="w-full p-2 rounded bg-slate-800 border border-slate-700" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span>تفعيل الباقة</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-3 border-t border-slate-700">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded border border-slate-600 hover:bg-slate-800">إلغاء</button>
              <button onClick={save} disabled={processing} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700">{processing ? "جارٍ الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-800 p-4 rounded border border-slate-700 flex items-center justify-between">
      <div>
        <div className="text-sm text-blue-200">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
      <div className="text-blue-300">{icon}</div>
    </div>
  );
}

function TextField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}{required ? " *" : ""}</label>
      <input className="w-full p-2 rounded bg-slate-800 border border-slate-700" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input type="number" className="w-full p-2 rounded bg-slate-800 border border-slate-700" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}


/* === Components بسيطة === */


