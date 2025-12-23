"use client";

import { useLanguage } from "@/contexts/language-context";

export default function ReferralsLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <p className="text-white text-lg animate-pulse">
        {t('referrals.loadingReferrals')}
      </p>
    </div>
  );
}
