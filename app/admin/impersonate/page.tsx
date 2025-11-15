"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ImpersonatePage() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");

  useEffect(() => {
    async function impersonate() {
      if (!uid) return;

      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        alert("حدث خطأ أثناء انتحال المستخدم");
      }
    }

    impersonate();
  }, [uid]);

  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-semibold">جارٍ تسجيل دخول المستخدم…</h2>
    </div>
  );
}
