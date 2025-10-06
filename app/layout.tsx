// app/dashboard/layout.tsx
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import BottomNavigation from "@/components/bottom-navigation.tsx";
import ClientProviders from "@/components/ClientProviders";

/**
 * ✅ Dashboard Layout
 * هذا الملف مسؤول عن تغليف كل صفحات لوحة التحكم فقط.
 * - يحتوي على الشريط السفلي.
 * - يخفي الشريط في صفحات معينة (مثل الإيداع والسحب).
 * - يضمن بقاء الإشعارات (Toaster) عاملة من خلال ClientProviders.
 */

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // ✅ الصفحات التي لا نريد فيها الشريط السفلي
  const hideBottomNav = [
    "/dashboard/deposit",
    "/dashboard/withdraw",
    "/dashboard/deposits",
    "/dashboard/withdraws",
  ];

  // ✅ تحقق مما إذا كنا في صفحة يجب فيها إخفاء الشريط
  const shouldHideNav = hideBottomNav.some((path) => pathname.startsWith(path));

  return (
    <ClientProviders>
      <div
        className="min-h-screen relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
        translate="no"
        data-react-protected
      >
        {/* ✅ المحتوى الرئيسي */}
        <main className="pb-20">{children}</main>

        {/* ✅ الشريط السفلي يظهر فقط إذا لم تكن الصفحة من صفحات الإيداع أو السحب */}
        {!shouldHideNav && (
          <div className="fixed bottom-0 left-0 w-full z-50">
            <BottomNavigation />
          </div>
        )}
      </div>
    </ClientProviders>
  );
}
