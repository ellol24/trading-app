import { TrendingUp, MessageCircle, Send } from "lucide-react"
import Link from "next/link"
import { BRAND_NAME, BRAND_SHORT_DESCRIPTION, CURRENT_YEAR } from "@/lib/brand"

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800/50 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">{BRAND_NAME}</span>
            </div>
            <p className="max-w-xs text-sm text-slate-300">{BRAND_SHORT_DESCRIPTION}</p>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Platform</h3>
            <ul className="space-y-2 text-slate-300">
              <li>
                <Link href="/packages" className="transition-colors hover:text-white">
                  Mining Packages
                </Link>
              </li>
              <li>
                <Link href="/features" className="transition-colors hover:text-white">
                  Analytics & Features
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="transition-colors hover:text-white">
                  Trader Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Support & Community</h3>
            <ul className="space-y-2 text-slate-300">
              <li>
                <Link href="/contact" className="transition-colors hover:text-white">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white">
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="https://t.me/XSpyAIBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-blue-400 flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5 text-blue-400" />
                  <span>Telegram Support</span>
                </a>
              </li>
              <li>
                <Link href="/reviews" className="transition-colors hover:text-white">
                  Trader Reviews
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Legal & Compliance</h3>
            <ul className="space-y-2 text-slate-300">
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  Risk Disclosure
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  Compliance Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800/50 pt-8 text-center">
          <p className="text-sm text-slate-400">
            © {CURRENT_YEAR} {BRAND_NAME}. All rights reserved. Trading involves risk and may not be suitable for all investors.
          </p>
        </div>
      </div>
    </footer>
  )
}
