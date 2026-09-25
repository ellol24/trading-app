"use client"

import { useEffect, type ReactNode } from "react"
import { toast } from "@/hooks/use-toast"

/**
 * Intercepts any window.alert() calls anywhere in the app (user + admin)
 * and shows a professional in-app toast instead of the intrusive browser modal.
 */
export function AlertToToastProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const original = window.alert
    window.alert = (message?: any) => {
      const description =
        typeof message === "string" ? message : JSON.stringify(message)
      toast({
        title: "Notification",
        description,
      })
    }
    return () => {
      window.alert = original
    }
  }, [])

  return <>{children}</>
}
