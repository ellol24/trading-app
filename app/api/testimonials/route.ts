import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const defaultTestimonials = [
  {
    id: "testi-1",
    name: "Sarah Johnson",
    role: "Professional Trader",
    content: "Xspy-trader has completely transformed how I manage my investments. The automated daily returns and instant execution are unmatched.",
    rating: 5,
    active: true,
  },
  {
    id: "testi-2",
    name: "Marcus Vance",
    role: "Crypto Asset Manager",
    content: "Clean UI, high security, and exceptional reliability. The daily package profit distribution is the smoothest in the industry.",
    rating: 5,
    active: true,
  },
  {
    id: "testi-3",
    name: "Elena Rostova",
    role: "VIP Investor",
    content: "Outstanding customer service and ultra-fast crypto gateway deposits. Highly recommended for serious crypto traders.",
    rating: 5,
    active: true,
  },
];

export async function GET() {
  try {
    const { data, error } = await adminClient
      .from("system_settings")
      .select("value")
      .eq("key", "homepage_testimonials")
      .single();

    if (error || !data?.value || !Array.isArray(data.value)) {
      return NextResponse.json({ success: true, testimonials: defaultTestimonials });
    }

    const activeOnly = data.value.filter((t: any) => t.active !== false);
    return NextResponse.json({
      success: true,
      testimonials: activeOnly.length > 0 ? activeOnly : defaultTestimonials,
    });
  } catch (err: any) {
    console.error("[TestimonialsAPI] Error:", err?.message || err);
    return NextResponse.json({ success: true, testimonials: defaultTestimonials });
  }
}
