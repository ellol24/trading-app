"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, ExternalLink, Sparkles } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export function HomePageClient() {
  const { user } = useAuth()
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <>
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

        <Button
          size="lg"
          variant="outline"
          onClick={() => setDemoOpen(true)}
          className="group relative h-auto border-blue-500/40 bg-slate-900/60 px-8 py-4 text-lg text-white backdrop-blur transition-all duration-300 hover:border-blue-400 hover:bg-blue-600/10 hover:shadow-lg hover:shadow-blue-500/20"
        >
          <span className="relative flex items-center">
            <span className="mr-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
              <Play className="h-4 w-4 fill-current ml-0.5" />
            </span>
            Watch Demo
          </span>
        </Button>
      </div>

      {/* Video Demo Modal */}
      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent className="max-w-4xl border-slate-800 bg-slate-950/95 p-6 text-white backdrop-blur-xl sm:rounded-2xl">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                  <Sparkles className="h-4 w-4" />
                </span>
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-white bg-clip-text text-transparent">
                  Xspy-trader Platform Walkthrough
                </DialogTitle>
              </div>
              <a
                href="/Intro.mp4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors pr-6"
                title="Open video directly in new browser tab"
              >
                <span>Fullscreen Tab</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <DialogDescription className="text-slate-400 text-sm">
              Watch how our automated binary options and daily mining packages deliver consistent performance.
            </DialogDescription>
          </DialogHeader>

          {/* Video Player Container */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800/80 bg-black shadow-2xl shadow-blue-950/50">
            <video
              src="/Intro.mp4"
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            >
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>Featuring automated mining returns, instant USDT gateway deposits, and live execution.</p>
            <Button
              size="sm"
              className="professional-gradient text-xs px-4"
              onClick={() => {
                setDemoOpen(false)
                window.location.href = user ? "/dashboard" : "/auth/register"
              }}
            >
              {user ? "Go to Dashboard" : "Create Free Account"}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
