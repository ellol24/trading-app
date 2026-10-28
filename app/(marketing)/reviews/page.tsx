import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star, MessageSquareQuote } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const fallbackTestimonials = [
  {
    name: "Sarah Johnson",
    role: "Professional Trader",
    content: "Xspy-trader has completely transformed how I manage my investments. The automated daily returns and instant execution are unmatched.",
    rating: 5,
  },
  {
    name: "Marcus Vance",
    role: "Crypto Asset Manager",
    content: "Clean UI, high security, and exceptional reliability. The daily package profit distribution is the smoothest in the industry.",
    rating: 5,
  },
  {
    name: "Elena Rostova",
    role: "VIP Investor",
    content: "Outstanding customer service and ultra-fast crypto gateway deposits. Highly recommended for serious crypto traders.",
    rating: 5,
  },
]

export default async function ReviewsPage() {
  const supabase = createClient()
  let testimonials = fallbackTestimonials

  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "homepage_testimonials")
      .maybeSingle()

    if (data?.value && Array.isArray(data.value)) {
      const active = data.value.filter((t: any) => t.active !== false)
      if (active.length > 0) {
        testimonials = active.map((t: any) => ({
          name: t.name || "Verified Trader",
          role: t.role || "Platform User",
          content: t.content || "",
          rating: Number(t.rating) || 5,
        }))
      }
    }
  } catch (err) {
    console.warn("[ReviewsPage] Error fetching testimonials, using fallback:", err)
  }

  return (
    <section className="py-12 px-4 max-w-7xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-extrabold text-white flex items-center justify-center gap-2.5">
          <MessageSquareQuote className="h-8 w-8 text-blue-400" />
          Trader Reviews & Experiences
        </h1>
        <p className="mx-auto max-w-2xl text-slate-300">
          Discover genuine feedback from verified members trading and earning daily on Xspy-trader.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t, idx) => (
          <Card
            key={idx}
            className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700 transition-all hover:translate-y-[-2px]"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1 mb-2">
                {[...Array(t.rating || 5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="text-slate-200 text-sm leading-relaxed italic">
                &ldquo;{t.content}&rdquo;
              </blockquote>
            </CardHeader>
            <CardContent className="pt-2 border-t border-slate-800/60 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-sm font-bold text-white uppercase">
                {t.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <CardTitle className="text-white text-base font-semibold">{t.name}</CardTitle>
                <p className="text-xs text-slate-400">{t.role}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
