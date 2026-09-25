// app/dashboard/withdraw/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WithdrawClient from "./WithdrawClient";

export default async function WithdrawPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // ✅ Correct table: user_profiles (not "profiles")
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("uid", user.id)
    .single();

  return <WithdrawClient user={user} profile={profile} />;
}
