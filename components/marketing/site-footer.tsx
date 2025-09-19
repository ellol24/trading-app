import { TrendingUp } from 'lucide-react'
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
              {/* Removed the Trading link as requested */}
              <li>
                <Link href="/packages" className="transition-colors hover:text-white">
                  Mining Packages
                </Link>
              </li>
              <li>
                <Link href="/features#analytics" className="transition-colors hover:text-white">
                  Analytics
                </Link>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Mobile App
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Support</h3>
            <ul className="space-y-2 text-slate-300">
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Help Center
                </a>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white">
                  Contact Us
                </Link>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Live Chat
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Legal</h3>
            <ul className="space-y-2 text-slate-300">
              <li><a href="#" className="transition-colors hover:text-white">Terms of Service</a></li>
              <li><a href="#" className="transition-colors hover:text-white">Privacy Policy</a></li>
              <li><a href="#" className="transition-colors hover:text-white">Risk Disclosure</a></li>
              <li><a href="#" className="transition-colors hover:text-white">Compliance</a></li>
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
