"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, Search, ArrowLeft, ShieldAlert, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ImpersonatePage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const searchUsers = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (uid: string, name: string) => {
    setImpersonating(uid);
    try {
      const res = await fetch("/api/contact/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to switch user.");
        return;
      }

      // Store admin impersonation flag
      localStorage.setItem("_admin_impersonating", uid);
      localStorage.setItem("_admin_impersonating_name", name);
      toast.success(`Switching to: ${name}...`);

      // If we got an action link, navigate to it (magic link login)
      if (data.action_link) {
        window.location.href = data.action_link;
      } else {
        // Fallback: just go to dashboard (may use existing session)
        router.push("/dashboard");
      }
    } catch {
      toast.error("Network error during impersonation.");
    } finally {
      setImpersonating(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 bg-transparent hover:bg-slate-700"
            onClick={() => router.push("/admin/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Eye className="w-6 h-6 text-blue-400" />
              Switch to User View
            </h1>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <ShieldAlert className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">Admin Only Feature</p>
            <p className="text-yellow-400/80 text-xs mt-0.5">
              This allows you to view the platform from a specific user's perspective. You will be viewing their dashboard.
              To return to admin mode, use the "Return to Admin" button in the user dashboard.
            </p>
          </div>
        </div>

        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Search User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                  className="pl-9 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <Button
                onClick={searchUsers}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>

            {users.length > 0 && (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                        {(u.full_name ?? u.email ?? "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{u.full_name ?? "Unnamed"}</p>
                        <p className="text-slate-400 text-xs">{u.email}</p>
                        <Badge className="text-[10px] bg-slate-700 text-slate-300 border-slate-600 mt-0.5">
                          ${Number(u.balance ?? 0).toFixed(2)} balance
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleImpersonate(u.uid, u.full_name ?? u.email ?? "User")}
                      disabled={impersonating === u.uid}
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      {impersonating === u.uid ? "Switching..." : "View as User"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {users.length === 0 && search && !loading && (
              <p className="text-slate-400 text-sm text-center py-4">No users found matching "{search}"</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
