"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock, KeyRound, ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { signIn, verifyAccountOtp, resendVerificationCode } from "@/lib/auth-actions";
import type { ActionState } from "@/lib/auth-actions";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/language-context";

type Props = {
  initialEmail?: string;
  initialVerify?: boolean;
};

export default function LoginForm({ initialEmail = "", initialVerify = false }: Props) {
  const router = useRouter();
  const [isVerifyMode, setIsVerifyMode] = useState(Boolean(initialVerify));
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [cooldown, setCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ error?: string; success?: string } | null>(null);

  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const { t } = useLanguage();

  // Cooldown timer countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle normal sign in
  async function handleSignIn(formData: FormData) {
    const inputEmail = (formData.get("email") as string) || email;
    setEmail(inputEmail);

    startTransition(async () => {
      const result = await signIn(state, formData);
      setState(result);

      if (result?.requiresVerification) {
        setIsVerifyMode(true);
        setCooldown(60); // Code was automatically resent
        return;
      }

      if (result?.success) {
        if (result.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/dashboard");
        }
      }
    });
  }

  // Handle OTP verification
  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResendMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("otp", otp);
      if (password) formData.set("password", password);

      const result = await verifyAccountOtp(state, formData);
      setState(result);

      if (result?.success) {
        if (result.userId) {
          // Logged in directly
          if (result.role === "admin") {
            router.push("/admin/dashboard");
          } else {
            router.push("/dashboard");
          }
        } else {
          // Verified successfully! Switch back to login form with email ready
          setIsVerifyMode(false);
        }
      }
    });
  }

  // Handle manual resend of code
  async function handleResend() {
    if (!email || cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendMessage(null);

    try {
      const res = await resendVerificationCode(email);
      if (res?.error) {
        setResendMessage({ error: res.error });
      } else {
        setResendMessage({ success: res.success || t("auth.codeResent") || "Verification code sent!" });
        setCooldown(60);
      }
    } catch (err: any) {
      setResendMessage({ error: "Failed to resend code." });
    } finally {
      setResendLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. VERIFY MODE VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (isVerifyMode) {
    return (
      <Card className="w-full max-w-md trading-card border-blue-500/30">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {t("auth.verifyEmail") || "Verify Your Email"}
          </CardTitle>
          <CardDescription className="text-slate-300 text-sm">
            {t("auth.verifySubtitle") || "Enter the 6-digit verification code sent to your email address."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleVerify} className="space-y-4">
            {state?.error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                {state.error}
              </div>
            )}

            {state?.success && (
              <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg text-sm">
                {state.success}
              </div>
            )}

            {resendMessage?.error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2.5 rounded-lg text-xs">
                {resendMessage.error}
              </div>
            )}

            {resendMessage?.success && (
              <div className="bg-blue-500/10 border border-blue-500/50 text-blue-400 px-4 py-2.5 rounded-lg text-xs">
                {resendMessage.success}
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1.5">
              <Label htmlFor="verifyEmail" className="text-slate-200 font-medium text-xs">
                {t("auth.emailAddress") || "Email Address"}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="verifyEmail"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="professional-input pl-10 h-11 text-sm"
                />
              </div>
            </div>

            {/* 6-Digit Verification Code */}
            <div className="space-y-1.5">
              <Label htmlFor="otp" className="text-slate-200 font-medium text-xs">
                {t("auth.verificationCode") || "Verification Code"}
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="otp"
                  name="otp"
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  required
                  className="professional-input pl-10 h-14 text-center text-2xl font-mono tracking-[0.4em] font-bold text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Optional Password to sign in immediately */}
            <div className="space-y-1.5">
              <Label htmlFor="verifyPassword" className="text-slate-300 font-medium text-xs flex justify-between">
                <span>{t("auth.password") || "Password"}</span>
                <span className="text-slate-400 text-[11px] font-normal">
                  ({t("common.optional") || "optional - to log in directly"})
                </span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="verifyPassword"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="professional-input pl-10 h-11 text-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending || otp.length < 6}
              className="w-full professional-gradient h-12 text-base font-medium"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.verifying") || "Verifying..."}
                </>
              ) : (
                t("auth.verifyButton") || "Verify Account"
              )}
            </Button>
          </form>

          {/* Resend and Back actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resendLoading || !email}
              className="text-blue-400 hover:text-blue-300 disabled:text-slate-500 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resendLoading ? "animate-spin" : ""}`} />
              {cooldown > 0
                ? `${t("auth.resendIn") || "Resend in"} ${cooldown}s`
                : t("auth.resendCode") || "Resend Code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsVerifyMode(false);
                setState({});
                setResendMessage(null);
              }}
              className="text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("auth.backToSignIn") || "Back to Sign In"}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. STANDARD SIGN IN VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <Card className="w-full max-w-md trading-card">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-3xl font-bold text-white">{t("auth.welcomeBack")}</CardTitle>
        <CardDescription className="text-slate-300">
          {t("auth.signInSubtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <form action={handleSignIn} className="space-y-4">
          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg text-sm">
              {state.success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200 font-medium">
              {t("auth.emailAddress")}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={email}
                placeholder="you@example.com"
                required
                className="professional-input pl-10 h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200 font-medium">
              {t("auth.password")}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
                className="professional-input pl-10 h-12"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full professional-gradient h-12 text-base font-medium"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("auth.signingIn")}
              </>
            ) : (
              t("auth.signIn")
            )}
          </Button>
        </form>

        <div className="space-y-2 pt-2 border-t border-slate-800 text-center text-sm">
          {/* Quick link to verification mode */}
          <div className="text-xs text-slate-400">
            {t("auth.needVerification") || "Need to verify your email?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsVerifyMode(true);
                setState({});
              }}
              className="text-blue-400 hover:text-blue-300 font-medium underline transition-colors"
            >
              {t("auth.verifyAccountLink") || "Enter verification code"}
            </button>
          </div>

          <div className="text-slate-400 text-sm">
            {t("auth.dontHaveAccount")}{" "}
            <Link
              href="/auth/register"
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {t("auth.createAccount")}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
