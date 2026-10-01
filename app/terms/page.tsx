import type { Metadata } from "next"
import Link from "next/link"
import { BRAND_NAME, CURRENT_YEAR } from "@/lib/brand"
import { Scale, Shield, AlertTriangle, FileText, Users, Globe, RefreshCw, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: `Terms of Service — ${BRAND_NAME}`,
  description: `Read the Terms of Service for ${BRAND_NAME}. Understand your rights and obligations when using our professional trading platform.`,
}

const sections = [
  {
    icon: FileText,
    title: "1. Acceptance of Terms",
    content: `By accessing or using the ${BRAND_NAME} platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service. These Terms apply to all visitors, users, and others who access or use the Service. We reserve the right to update these Terms at any time. Continued use of the platform after changes constitutes acceptance of the new Terms.`,
  },
  {
    icon: Users,
    title: "2. Eligibility & Account Registration",
    content: `To use our Service, you must be at least 18 years of age and have the legal capacity to enter into binding contracts. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You agree to provide accurate, current, and complete information during registration. ${BRAND_NAME} reserves the right to suspend or terminate accounts that provide false or misleading information. Each individual may maintain only one account.`,
  },
  {
    icon: Scale,
    title: "3. Trading & Investment Activities",
    content: `${BRAND_NAME} provides binary options trading and investment package services. All trades are final upon confirmation. You acknowledge that trading involves substantial risk and that past performance does not guarantee future results. Profits from winning trades will be credited to your account balance. Losses will be deducted from your balance accordingly. The platform is for entertainment and investment purposes only. You are solely responsible for all trading decisions made on the platform.`,
  },
  {
    icon: Shield,
    title: "4. Referral Program",
    content: `Our referral program allows users to earn commissions when referred users complete qualifying activities including deposits, trades, and package purchases. Commissions are processed up to three referral levels. Commission rates are subject to change with notice. Abuse of the referral program, including creating fake accounts or self-referrals, will result in immediate account termination and forfeiture of all earnings. ${BRAND_NAME} reserves the right to withhold commissions pending investigation of suspicious activity.`,
  },
  {
    icon: Globe,
    title: "5. Deposits & Withdrawals",
    content: `Deposits are processed after administrative review and confirmation. Withdrawal requests are subject to verification checks. ${BRAND_NAME} reserves the right to request identity verification documents before processing withdrawals. We are not responsible for delays caused by third-party payment processors. Users are responsible for any fees charged by external payment services. Minimum deposit and withdrawal amounts apply as specified on the platform.`,
  },
  {
    icon: AlertTriangle,
    title: "6. Prohibited Activities",
    content: `You agree not to: (a) use the platform for fraudulent purposes; (b) attempt to manipulate or interfere with the platform's systems; (c) create multiple accounts to abuse promotional offers; (d) share account access with third parties; (e) use automated tools, bots, or scripts to interact with the platform; (f) engage in money laundering or other illegal financial activities; (g) harass, abuse, or harm other users. Violation of these prohibitions may result in immediate account suspension and legal action.`,
  },
  {
    icon: RefreshCw,
    title: "7. Modifications to the Service",
    content: `${BRAND_NAME} reserves the right to modify, suspend, or discontinue the Service or any feature thereof at any time, with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Service. We may also modify commission rates, package terms, and other platform parameters at our discretion with reasonable prior notice to users.`,
  },
  {
    icon: Mail,
    title: "8. Limitation of Liability",
    content: `To the maximum extent permitted by applicable law, ${BRAND_NAME} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including lost profits, loss of data, or loss of goodwill. Our total liability to you shall not exceed the amount deposited in your account in the twelve months preceding the claim. Some jurisdictions do not allow the exclusion of certain warranties or the limitation of liability, so the above limitations may not apply to you.`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-blue-500/20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium mb-6">
            <Scale className="w-4 h-4" />
            Legal Document
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Please read these terms carefully before using the {BRAND_NAME} platform.
          </p>
          <p className="text-slate-500 text-sm mt-4">
            Last updated: January 1, {CURRENT_YEAR}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        {/* Intro card */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-amber-400 font-semibold mb-1">Important Notice</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Trading binary options involves significant risk. You may lose all of your invested capital. These Terms govern your use of the {BRAND_NAME} platform. By registering an account, you confirm that you have read, understood, and agree to be bound by these Terms.
              </p>
            </div>
          </div>
        </div>

        {/* Sections */}
        {sections.map((section, index) => {
          const Icon = section.icon
          return (
            <div
              key={index}
              className="rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm p-6 hover:border-blue-500/30 transition-colors duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-semibold text-lg mb-3">{section.title}</h2>
                  <p className="text-slate-400 leading-relaxed text-sm">{section.content}</p>
                </div>
              </div>
            </div>
          )
        })}

        {/* Contact section */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/10 to-purple-600/10 p-8 text-center">
          <h3 className="text-white font-semibold text-xl mb-2">Questions About These Terms?</h3>
          <p className="text-slate-400 text-sm mb-6">
            If you have any questions about these Terms of Service, please contact our support team.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors duration-200"
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </Link>
        </div>

        {/* Footer nav */}
        <div className="flex flex-wrap items-center justify-center gap-6 py-6 border-t border-slate-700/50">
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← Back to Home
          </Link>
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Privacy Policy
          </Link>
          <Link href="/auth/login" className="text-slate-400 hover:text-white text-sm transition-colors">
            Sign In
          </Link>
        </div>

        <p className="text-center text-slate-600 text-xs pb-4">
          © {CURRENT_YEAR} {BRAND_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  )
}
