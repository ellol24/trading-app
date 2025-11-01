import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const testimonials = [
  {
    name: "A. Malik",
    role: "Trader",
    quote:
      "Clean UI and responsive charts. It’s the first platform I actually enjoy using every day.",
  },
  {
    name: "S. Rivera",
    role: "Investor",
    quote:
      "Package management is straightforward and the analytics helped me optimize my entries.",
  },
  {
    name: "D. Chen",
    role: "Analyst",
    quote:
      "Fast, stable, and thoughtfully designed. The attention to detail is impressive.",
  },
];

export default function ReviewsPage() {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Reviews</h1>
      <p className="mb-10 text-slate-300">What users say about the experience.</p>
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((t) => (
          <Card
            key={`${t.name}-${t.role}`}
            className="border-slate-800 bg-slate-900/60"
          >
            <CardHeader>
              <CardTitle className="text-white">{t.name}</CardTitle>
              <p className="text-xs text-slate-400">{t.role}</p>
            </CardHeader>
            <CardContent className="text-slate-300">
              <blockquote className="italic">“{t.quote}”</blockquote>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

