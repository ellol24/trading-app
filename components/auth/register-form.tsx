"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Mail, Lock, User } from "lucide-react";
import Link from "next/link";
import { signUp, type ActionState } from "@/lib/auth-actions";

import { useLanguage } from "@/contexts/language-context";

type Props = {
  referralCode?: string;
};

function SubmitButton({ pending, t }: { pending: boolean, t: (key: string) => string }) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full professional-gradient h-12 text-base font-medium"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('auth.creatingAccount')}
        </>
      ) : (
        t('auth.createAccount')
      )}
    </Button>
  );
}

export default function RegisterForm({ referralCode: referralCodeFromUrl }: Props) {
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const [referralCode, setReferralCode] = useState(referralCodeFromUrl || "");
  const { t } = useLanguage();

  async function handleSubmit(formData: FormData) {
    // ✅ تحقق أن كود الإحالة موجود
    if (!referralCode) {
      setState({ error: t('auth.referralRequired') });
      return;
    }

    startTransition(async () => {
      formData.set("referralCode", referralCode);
      const result = await signUp(state, formData);
      setState(result);
    });
  }

  return (
    <Card className="w-full max-w-md trading-card">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-3xl font-bold text-white">{t('auth.getStarted')}</CardTitle>
        <CardDescription className="text-slate-300">
          {t('auth.createAccountSubtitle')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <form action={handleSubmit} className="space-y-4">
          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
              {state.success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-slate-200 font-medium">
              {t('auth.username')}
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder={t('auth.enterName')}
                required
                className="professional-input pl-10 h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200 font-medium">
              {t('auth.emailAddress')}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t('auth.enterEmail')}
                required
                className="professional-input pl-10 h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200 font-medium">
              {t('auth.password')}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={t('auth.enterPassword')}
                required
                minLength={8}
                className="professional-input pl-10 h-12"
              />
            </div>
          </div>

          {/* Referral Code (إجباري) */}
          <div className="space-y-2">
            <Label htmlFor="referralCode" className="text-slate-200 font-medium">
              {t('auth.inviteCode')}
            </Label>
            <Input
              id="referralCode"
              name="referralCode"
              type="text"
              placeholder={t('auth.enterInviteCode')}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              readOnly={!!referralCodeFromUrl} // إذا جاي من الرابط → لا يتعدل
              required
              className="professional-input h-12"
            />
          </div>

          <div className="text-xs text-slate-400 leading-relaxed">
            {t('auth.agreeTermsStart')}{" "}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">
              {t('auth.termsOfService')}
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
              {t('auth.privacyPolicy')}
            </Link>
            .
          </div>

          <SubmitButton pending={isPending} t={t} />
        </form>

        <div className="text-center text-slate-400">
          {t('auth.alreadyHaveAccount')}{" "}
          <Link
            href="/auth/login"
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            {t('auth.signIn')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
