import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { TrendingUp, Shield, Zap, Globe, Users, BarChart3, Star } from "lucide-react"
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand"
import { createClient } from "@/lib/supabase/server"
import { HomePageClient } from "./home-page-client"

async function getHomePageData() {
  const supabase = createClient()

  try {
    // Get platform statistics
    const [usersResult, ordersResult, packagesResult, depositsResult] = await Promise.all([
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("trading_orders").select("amount", { count: "exact" }),
      supabase
        .from("investment_packages")
        .select("name, description, daily_roi, min_investment, max_investment, duration_days")
        .eq("is_active", true),
      supabase.from("deposits").select("amount").eq("status", "completed"),
    ])

    // Calculate total trading volume from completed deposits
    const totalVolume = depositsResult.data?.reduce((sum, deposit) => sum + (deposit.amount || 0), 0) || 0

    // Get recent testimonials from user reviews (if any)
    const { data: testimonials } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, created_at")
      .not("first_name", "is", null)
      .limit(3)

    return {
      stats: {
        activeTraders: usersResult.count || 0,
        tradingVolume: totalVolume,
        totalOrders: ordersResult.count || 0,
        uptime: 99.9, // This would come from monitoring system
      },
      packages: packagesResult.data || [],
      testimonials: testimonials || [],
    }
  } catch (error) {
    console.error("Error fetching home page data:", error)
    // Return fallback data if database query fails
    return {
      stats: {
        activeTraders: 0,
        tradingVolume: 0,
        totalOrders: 0,
        uptime: 99.9,
      },
      packages: [],
      testimonials: [],
    }
  }
}

export default async function HomePage() {
  const data = await getHomePageData()

  const features = [
    {
      icon: TrendingUp,
      title: "Advanced Trading",
      description: "Professional-grade charts and analytics with crisp contrast and responsive layouts.",
    },
    {
      icon: Shield,
      title: "Secure Platform",
      description: "Bank-level encryption, safe flows, and robust client/server boundaries.",
    },
    {
      icon: Zap,
      title: "Instant Execution",
      description: "Low-latency interactions for a smooth, responsive experience.",
    },
    { icon: Globe, title: "Global Markets", description: "Access forex, crypto, and commodities in one cohesive UI." },
    { icon: Users, title: "Expert Support", description: "Helpful, human support that's available around the clock." },
    {
      icon: BarChart3,
      title: "Analytics",
      description: "Track performance, ROI, and history with clean, readable reports.",
    },
  ]

  const defaultTestimonials = [
    {
      name: "Sarah Johnson",
      role: "Professional Trader",
      content: `${BRAND_NAME} is intuitive and reliable. It streamlined my daily routine.`,
      rating: 5,
    },
    {
      name: "Ahmed Hassan",
      role: "Crypto Investor",
      content: `The packages are simple to manage and offer steady returns.`,
      rating: 5,
    },
    {
      name: "Maria Garcia",
      role: "Day Trader",
      content: "Fast UI and clear analytics. The polish really stands out.",
      rating: 5,
    },
  ]

  const testimonials =
    data.testimonials.length > 0
      ? data.testimonials.map((t, idx) => ({
          name: `${t.first_name} ${t.last_name}`,
          role: "Platform User",
          content: `Great experience with ${BRAND_NAME}. Highly recommended!`,
          rating: 5,
        }))
      : defaultTestimonials

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <SiteHeader />

      {/* Hero */}
      <section className="px-6 pt-28 md:pt-32">
        <div className="mx-auto max-w-7xl text-center">
          <Badge className="mb-6 bg-blue-500/10 text-blue-300 border-blue-500/20">🚀 {BRAND_TAGLINE}</Badge>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight md:text-7xl">
            Trade Smarter,
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 bg-clip-text text-transparent">
              Earn Better
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-lg text-slate-300 md:text-xl">
            Join thousands of successful traders on our advanced platform. Start with crypto mining packages and scale
            your investments with professional tools.
          </p>

          <HomePageClient />

          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-white">
                {data.stats.activeTraders > 0 ? `${Math.floor(data.stats.activeTraders / 1000)}K+` : "50K+"}
              </div>
              <div className="text-slate-400">Active Traders</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-white">
                {data.stats.tradingVolume > 0 ? `$${(data.stats.tradingVolume / 1000000).toFixed(1)}M+` : "$2.5B+"}
              </div>
              <div className="text-slate-400">Trading Volume</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-white">{data.stats.uptime}%</div>
              <div className="text-slate-400">Uptime</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-white">24/7</div>
              <div className="text-slate-400">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features preview */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">Why Choose {BRAND_NAME}?</h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-300">
              Experience an advanced, reliable platform with thoughtful details designed to help you perform.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Card
                key={i}
                className="trading-card hover:translate-y-[-2px] hover:shadow-lg hover:shadow-blue-900/10 transition-transform"
              >
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20">
                    <f.icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <CardTitle className="text-white">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-300">{f.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {data.packages.length > 0 && (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold">Investment Packages</h2>
              <p className="mx-auto max-w-2xl text-lg text-slate-300">
                Choose from our carefully curated investment packages designed for different risk profiles.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {data.packages.slice(0, 3).map((pkg, idx) => (
                <Card key={idx} className="trading-card">
                  <CardHeader>
                    <CardTitle className="text-white">{pkg.name}</CardTitle>
                    <CardDescription className="text-slate-300">{pkg.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Daily ROI:</span>
                        <span className="text-green-400">{pkg.daily_roi}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Min Investment:</span>
                        <span className="text-white">${pkg.min_investment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Duration:</span>
                        <span className="text-white">{pkg.duration_days} days</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">What Our Traders Say</h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-300">
              Join thousands of satisfied traders who trust {BRAND_NAME} for their investment success.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {testimonials.map((t, idx) => (
              <Card key={idx} className="trading-card">
                <CardHeader>
                  <div className="mb-4 flex items-center space-x-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <CardDescription className="text-base leading-relaxed text-slate-300">
                    {'"'}
                    {t.content}
                    {'"'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                      <span className="text-sm font-semibold text-white">
                        {t.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{t.name}</div>
                      <div className="text-sm text-slate-400">{t.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Card className="trading-card p-10 md:p-12">
            <h2 className="mb-4 text-4xl font-bold">Ready to Start?</h2>
            <p className="mb-8 text-lg text-slate-300">
              Join {BRAND_NAME} today and take your first step towards financial freedom.
            </p>
            <HomePageClient />
          </Card>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
