import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const tiers = [
  { name: "Starter", price: "$100", features: ["Basic analytics", "Email support", "Beginner-friendly"] },
  { name: "Professional", price: "$500", features: ["Advanced charts", "Priority support", "Better yields"], highlight: true },
  { name: "VIP", price: "$2,000", features: ["Dedicated manager", "Deep analytics", "Top tier limits"] },
]

export default function PackagesPage() {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Packages</h1>
      <p className="mb-10 text-slate-300">Choose a package that fits your strategy.</p>
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <Card
            key={t.name}
            className={`border-slate-800 bg-slate-900/60 ${t.highlight ? "ring-1 ring-purple-500/40" : ""}`}
          >
            <CardHeader>
              <CardTitle className="text-white">{t.name}</CardTitle>
              <div className="text-3xl font-bold">{t.price}</div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                {t.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href="/auth/register" className="w-full">
                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500">
                  Get Started
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  )
}
