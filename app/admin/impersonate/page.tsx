"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";

export default function ImpersonatePage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid;

  useEffect(() => {
    async function impersonate() {
      try {
        const res = await fetch(`/api/admin/impersonate?uid=${uid}`);

        if (!res.ok) {
          alert("حدث خطأ أثناء تفعيل تسجيل الدخول كمستخدم");
          return;
        }

        router.push("/dashboard");
      } catch {
        alert("حدث خطأ أثناء تفعيل المستخدم");
      }
    }

    impersonate();
  }, [uid, router]);

  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-semibold">جاري تسجيل دخول المستخدم...</h2>
    </div>
  );
}
