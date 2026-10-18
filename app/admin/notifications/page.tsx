"use client";

import AdminNotificationCenter from "@/components/dashboard/AdminNotificationCenter";
import { Bell } from "lucide-react";

export default function AdminNotificationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-blue-400" />
            Notification Center
          </h1>
          <p className="text-slate-400 mt-1">All broadcast messages sent by administrators.</p>
        </div>
        <AdminNotificationCenter />
      </div>
    </div>
  );
}
