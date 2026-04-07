"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    UserCircle,
    Search,
    RefreshCw,
    ArrowRightLeft,
    Users,
    Shield,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/language-context";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getAdminReferrals, switchReferrer } from "@/app/actions/admin-referrals";

export type AdminReferralData = {
    id: string;
    referrer_id: string;
    referred_id: string;
    level: number;
    status: string;
    created_at: string;
    referrer_email: string;
    referrer_name: string;
    referrer_code: string;
    referred_email: string;
    referred_name: string;
    referred_code: string;
};

export default function AdminReferralsPage() {
    const { t } = useLanguage();
    const [referrals, setReferrals] = useState<AdminReferralData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [switchModalOpen, setSwitchModalOpen] = useState(false);
    const [selectedRef, setSelectedRef] = useState<AdminReferralData | null>(null);
    const [newReferrerCode, setNewReferrerCode] = useState("");
    const [switching, setSwitching] = useState(false);

    const fetchRefs = async () => {
        setLoading(true);
        try {
            const data = await getAdminReferrals();
            setReferrals(data);
        } catch (err: any) {
            toast.error("Failed to fetch referrals: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRefs();
    }, []);

    const handleSwitch = async () => {
        if (!selectedRef) return;
        if (!newReferrerCode.trim()) {
            toast.error("Please enter a new referral code.");
            return;
        }

        setSwitching(true);
        try {
            await switchReferrer(selectedRef.id, selectedRef.referred_id, newReferrerCode.trim());
            toast.success("Successfully transferred referral.");
            setSwitchModalOpen(false);
            setNewReferrerCode("");
            fetchRefs();
        } catch (err: any) {
            toast.error(err.message || "Failed to switch referrer.");
        } finally {
            setSwitching(false);
        }
    };

    const filtered = referrals.filter(
        (r) =>
            r.referrer_email.toLowerCase().includes(search.toLowerCase()) ||
            r.referred_email.toLowerCase().includes(search.toLowerCase()) ||
            r.referrer_code.toLowerCase().includes(search.toLowerCase()) ||
            r.referred_code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Users className="h-8 w-8 text-blue-400" />
                        Referral Network Editor
                    </h2>
                    <p className="text-slate-400">Manage all system referrals and transfer downlines.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={fetchRefs} disabled={loading} variant="outline" className="bg-slate-800 text-white border-slate-700">
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-white">All Active Referrals</CardTitle>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <Input
                                placeholder="Search by email or code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-slate-900 border-slate-700 text-white"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900 text-slate-300">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-slate-700">Referred User (Downline)</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Referrer (Parent)</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Level</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Joined</th>
                                        <th className="px-4 py-3 border-b border-slate-700 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700 bg-slate-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-slate-400">Loading network data...</td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-slate-400">No referrals found matching search.</td>
                                        </tr>
                                    ) : (
                                        filtered.map((ref) => (
                                            <tr key={ref.id} className="hover:bg-slate-700/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-slate-700 p-2 rounded-full">
                                                            <UserCircle className="h-5 w-5 text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-white">{ref.referred_name || "Unknown"}</div>
                                                            <div className="text-xs text-slate-400">{ref.referred_email}</div>
                                                            <code className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded mt-1 inline-block">{ref.referred_code}</code>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Shield className="h-4 w-4 text-yellow-500" />
                                                        <div>
                                                            <div className="font-medium text-white">{ref.referrer_name || "Unknown"}</div>
                                                            <div className="text-xs text-slate-400">{ref.referrer_email}</div>
                                                            <code className="text-[10px] text-yellow-500/70 bg-slate-900 px-1 py-0.5 rounded mt-1 inline-block">{ref.referrer_code}</code>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant="outline" className={`
                            ${ref.level === 1 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : ""}
                            ${ref.level === 2 ? "bg-slate-400/10 text-slate-300 border-slate-400/20" : ""}
                            ${ref.level === 3 ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : ""}
                          `}>
                                                        Level {ref.level}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-slate-300">
                                                    {new Date(ref.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedRef(ref);
                                                            setSwitchModalOpen(true);
                                                        }}
                                                        size="sm"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                                    >
                                                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                                                        Transfer
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={switchModalOpen} onOpenChange={setSwitchModalOpen}>
                <DialogContent className="bg-slate-800 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Transfer Referral</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Move {selectedRef?.referred_email} to a new referrer network. They will become a Level 1 referral under the new network.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-slate-900 p-3 rounded border border-slate-700">
                            <p className="text-xs text-slate-400 mb-1">Current Referrer:</p>
                            <p className="font-medium">{selectedRef?.referrer_email}</p>
                            <p className="text-xs text-yellow-500 mt-1">Code: {selectedRef?.referrer_code}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">New Parent Referral Code</label>
                            <Input
                                type="text"
                                placeholder="Enter new referrer's exact code..."
                                value={newReferrerCode}
                                onChange={(e) => setNewReferrerCode(e.target.value)}
                                className="bg-slate-900 border-slate-700"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSwitchModalOpen(false)} className="border-slate-600 text-slate-300">
                            Cancel
                        </Button>
                        <Button onClick={handleSwitch} disabled={switching || !newReferrerCode} className="bg-blue-600 hover:bg-blue-700">
                            {switching ? "Processing..." : "Confirm Transfer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
