// app/[referralCode]/page.tsx
import { redirect } from "next/navigation";

export default function ReferralRedirect({ params }: { params: { referralCode: string } }) {
  const { referralCode } = params;

  if (referralCode.startsWith("REF_")) {
    const code = referralCode.replace("REF_", "");
    redirect(`/auth/register?ref=${code}`);
  }

  // لو الرابط مش صحيح → رجع 404
  return <div>404 | Invalid referral link</div>;
}
