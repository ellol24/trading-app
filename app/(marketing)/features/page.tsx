import { Shield, ChartLine, Settings, Cpu, BarChart3, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND_NAME } from "@/lib/brand";

const features = [
  { icon: ChartLine, title: "Real-time Charts", desc: "Responsive, high-contrast charts with multiple intervals and overlays." },
  { icon: BarChart3, title: "Analytics", desc: "Performance metrics, profit tracking, and rich history views." },
  { icon: Shield, title: "Security", desc: "2FA-ready flows, role-based screens, and safe client/server patterns." },
  { icon: Cpu, title: "Scalable", desc: "Built on Next.js App Router and shadcn/ui, ready to scale." },
  { icon: Bell, title: "Alerts", desc: "Price move and order-state notifications with in-app toasts." },
  { icon: Settings, title: "Customizable", desc: "Tailwind-powered themes with simple tokens and utilities." },
];

export default function FeaturesPage() {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Features</h1>
      <p className="mb-10 text-slate-300">
        Powerful capabilities to help you trade and manage packages on {BRAND_NAME ?? "our platform"}.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="border-slate-800 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-md bg-gradient-to-r from-blue-600 to-purple-600 p-2" aria-hidden="true">
                {/* Icon is decorative */}
                <Icon className="h-5 w-5 text-white" aria-hidden="true" focusable="false" />
              </div>
              <CardTitle className="text-white">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">{desc}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
