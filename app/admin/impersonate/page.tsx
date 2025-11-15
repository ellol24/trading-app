"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ImpersonateContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");

  useEffect(() => {
    async function impersonate() {
      const res = await fetch("/api/admin/impersonate?uid=" + uid, {
        method: "POST",
      });

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        alert("حدث خطأ أثناء تسجيل دخول المستخدم");
      }
    }

    impersonate();
  }, [uid]);

  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-semibold">جاري تسجيل دخول المستخدم...</h2>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ImpersonateContent />
    </Suspense>
  );
}
