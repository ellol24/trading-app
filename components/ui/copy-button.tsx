"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, Copy } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type CopyButtonProps = {
  value: string
  className?: string
  size?: "icon" | "sm" | "default" | "lg"
  variant?: "ghost" | "secondary" | "outline" | "default" | "destructive" | "link"
  tooltip?: string
  "aria-label"?: string
}

export function CopyButton({
  value,
  className,
  size = "icon",
  variant = "outline",
  tooltip = "Copy",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast({
        title: "Copied",
        description: "Value copied to clipboard.",
      })
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
      })
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            onClick={onCopy}
            className={cn("h-8 w-8", className)}
            {...props}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only">{props["aria-label"] ?? "Copy to clipboard"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
