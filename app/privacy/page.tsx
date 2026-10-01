import type { Metadata } from "next"
import Link from "next/link"
import { BRAND_NAME, CURRENT_YEAR } from "@/lib/brand"
import { Shield, Eye, Lock, Database, Cookie, UserCheck, Share2, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: `Privacy Policy — ${BRAND_NAME}`,
  description: `Learn how ${BRAND_NAME} collects, uses, and protects your personal information. Your privacy is our priority.`,
}

const sections = [
  {
    icon: Database,
    title: "1. Information We Collect",
    items: [
      {
        subtitle: "Account Information",
        text: "When you register, we collect your name, email address, and password. We also record the referral code used during registration.",
      },
      {
        subtitle: "Transaction Data",
        text: "We record all deposits, withdrawals, trades, and package purchases associated with your account, including amounts, timestamps, and status.",
      },
      {
        subtitle: "Usage Information",
        text: "We automatically collect your IP address, browser type, device information, and pages visited to improve platform security and performance.",
      },
      {
        subtitle: "Communications",
        text: "If you contact our support team, we retain records of that correspondence to assist with future inquiries.",
      },
    ],
  },
  {
    icon: Eye,
    title: "2. How We Use Your Information",
    items: [
      {
        subtitle: "Platform Operation",
        text: "To provide, maintain, and improve our trading platform and investment services.",
      },
      {
        subtitle: "Account Management",
        text: "To create and manage your account, process transactions, and credit referral commissions accurately.",
      },
      {
        subtitle: "Security & Fraud Prevention",
        text: "To detect and prevent fraudulent activity, unauthorized access, and violations of our Terms of Service.",
      },
      {
        subtitle: "Communications",
        text: "To send you important account notifications, deposit confirmations, and service updates.",
      },
    ],
  },
  {
    icon: Share2,
    title: "3. Information Sharing",
    items: [
      {
        subtitle: "We Do Not Sell Your Data",
        text: `${BRAND_NAME} does not sell, rent, or trade your personal information to third parties for their marketing purposes.`,
      },
      {
        subtitle: "Service Providers",
        text: "We may share information with trusted third-party service providers (such as payment processors and hosting providers) who assist us in operating the platform, subject to confidentiality agreements.",
      },
      {
        subtitle: "Legal Compliance",
        text: "We may disclose your information when required by law, court order, or governmental authority.",
      },
    ],
  },
  {
    icon: Lock,
    title: "4. Data Security",
    items: [
      {
        subtitle: "Encryption",
        text: "All data transmitted between your browser and our servers is encrypted using industry-standard TLS/SSL protocols.",
      },
      {
        subtitle: "Access Controls",
        text: "Access to your personal data is restricted to authorized personnel only, on a need-to-know basis.",
      },
      {
        subtitle: "Incident Response",
        text: "In the event of a data breach that may affect your rights, we will notify you as required by applicable law.",
      },
    ],
  },
  {
    icon: Cookie,
    title: "5. Cookies & Tracking",
    items: [
      {
        subtitle: "Essential Cookies",
        text: "We use session cookies to maintain your login state and provide core platform functionality. These cannot be disabled.",
      },
      {
        subtitle: "Analytics",
        text: "We may use analytics tools to understand how users interact with our platform, helping us improve the experience.",
      },
      {
        subtitle: "Your Choices",
        text: "You can control cookie preferences through your browser settings. Note that disabling cookies may affect platform functionality.",
      },
    ],
  },
  {
    icon: UserCheck,
    title: "6. Your Rights",
    items: [
      {
        subtitle: "Access & Portability",
        text: "You have the right to request a copy of the personal data we hold about you.",
      },
      {
        subtitle: "Correction",
        text: "You may request correction of inaccurate or incomplete personal information.",
      },
      {
        subtitle: "Deletion",
        text: "You may request deletion of your account and associated personal data, subject to legal retention obligations.",
      },
      {
        subtitle: "Objection",
        text: "You have the right to object to certain types of data processing, including direct marketing.",
      },
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-blue-500/20">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-purple-600/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Legal Document
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            We are committed to protecting your privacy and handling your data with transparency and care.
          </p>
          <p className="text-slate-500 text-sm mt-4">
            Last updated: January 1, {CURRENT_YEAR}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        {/* Intro card */}
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-purple-400 font-semibold mb-1">Our Commitment to You</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                At {BRAND_NAME}, your privacy matters. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our platform. We encourage you to read this document carefully and contact us with any questions.
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
              className="rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm p-6 hover:border-purple-500/30 transition-colors duration-300"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-white font-semibold text-lg">{section.title}</h2>
              </div>
              <div className="space-y-4 pl-13">
                {section.items.map((item, i) => (
                  <div key={i} className="pl-0 md:pl-2">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-2" />
                      <div>
                        <span className="text-slate-200 font-medium text-sm">{item.subtitle}: </span>
                        <span className="text-slate-400 text-sm leading-relaxed">{item.text}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Children's Privacy */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <UserCheck className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg mb-2">7. Children's Privacy</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child under 18 has provided us with personal information, we will take steps to delete such information immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Changes */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg mb-2">8. Changes to This Policy</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of the platform after changes take effect constitutes your acceptance of the revised policy.
              </p>
            </div>
          </div>
        </div>

        {/* Contact section */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-600/10 to-blue-600/10 p-8 text-center">
          <h3 className="text-white font-semibold text-xl mb-2">Privacy Questions?</h3>
          <p className="text-slate-400 text-sm mb-6">
            If you have any questions about this Privacy Policy or how we handle your data, our team is here to help.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors duration-200"
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
          <Link href="/terms" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
            Terms of Service
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
