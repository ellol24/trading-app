"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function ContactPage() {
  const [state, setState] = useState<{ sending: boolean; done?: boolean; error?: string }>({
    sending: false,
  })

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setState({ sending: true })
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        body: fd,
      })
      if (!res.ok) throw new Error("Failed to send message")
      setState({ sending: false, done: true })
      e.currentTarget.reset()
    } catch (err: any) {
      setState({ sending: false, error: err?.message ?? "Unexpected error" })
    }
  }

  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Contact</h1>
      <p className="mb-10 text-slate-300">Questions? Get in touch and we’ll respond promptly.</p>

      <Card className="max-w-xl border-slate-800 bg-slate-900/60">
        <form onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle className="text-white">Send us a message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input name="name" placeholder="Your name" required />
            <Input type="email" name="email" placeholder="Your email" required />
            <Textarea name="message" placeholder="How can we help?" required className="min-h-[120px]" />
            {state.error && (
              <p className="text-sm text-red-400" role="alert">
                {state.error}
              </p>
            )}
            {state.done && (
              <p className="text-sm text-emerald-400">Thanks! We received your message.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={state.sending}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500"
            >
              {state.sending ? "Sending..." : "Send Message"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  )
}

