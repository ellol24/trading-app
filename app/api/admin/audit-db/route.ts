import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  
  const { data } = await supabase.from('deposits').select('*').limit(1);
  return NextResponse.json({ keys: data ? Object.keys(data[0] || {}) : [], data });
}
