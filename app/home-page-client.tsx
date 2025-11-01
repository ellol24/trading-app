"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"

export function HomePageClient() {
  const { user } = useAuth()

  return (
    <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
      {user ? (
        <Link href="/dashboard">
          <Button size="lg" className="professional-gradient h-auto px-8 py-4 text-lg">
            Go to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      ) : (
        <Link href="/auth/register">
          <Button size="lg" className="professional-gradient h-auto px-8 py-4 text-lg">
            Start Trading Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      )}
      <Link href="/contact">
        <Button
          size="lg"
          variant="outline"
          className="h-auto border-slate-700/60 px-8 py-4 text-lg hover:bg-slate-900/40 bg-transparent"
        >
          <Play className="mr-2 h-5 w-5" />
          Watch Demo
        </Button>
      </Link>
    </div>
  )
}
