"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, Send, Mail, MessageSquare, AlertCircle } from "lucide-react"

export default function ContactPage() {
  const [state, setState] = useState<{
    sending: boolean
    done?: boolean
    error?: string
  }>({
    sending: false,
  })

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)

    setState({ sending: true, error: undefined })
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        body: fd,
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message. Please try again.")
      }

      setState({ sending: false, done: true })
      form.reset()
    } catch (err: any) {
      setState({
        sending: false,
        error: err?.message || "Failed to send message. Please try again.",
      })
    }
  }

  return (
    <section className="py-12 px-4 max-w-7xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-extrabold text-white flex items-center justify-center gap-2.5">
          <Mail className="h-8 w-8 text-blue-400" />
          Get in Touch
        </h1>
        <p className="mx-auto max-w-xl text-slate-300">
          Have a question or need assistance with your account? Send us a message and our support team will reply promptly.
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="w-full max-w-xl border-slate-800 bg-slate-900/70 backdrop-blur shadow-2xl">
          <form onSubmit={onSubmit}>
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-400" />
                Send Us a Message
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Fill out the form below. We typically respond within a few hours.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {state.done && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 animate-in fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Message Sent Successfully!</p>
                    <p className="text-xs text-emerald-400/90 mt-0.5">
                      Thank you for contacting us. We have received your inquiry and sent a confirmation to your email.
                    </p>
                  </div>
                </div>
              )}

              {state.error && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 animate-in fade-in">
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{state.error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Your Name</label>
                <Input
                  name="name"
                  placeholder="e.g. John Doe"
                  required
                  className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Your Email Address</label>
                <Input
                  type="email"
                  name="email"
                  placeholder="e.g. john@example.com"
                  required
                  className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Message</label>
                <Textarea
                  name="message"
                  placeholder="Describe your inquiry, issue, or feedback in detail..."
                  required
                  rows={5}
                  className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 resize-none leading-relaxed"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                disabled={state.sending}
                className="w-full professional-gradient text-white h-11 font-semibold shadow-lg shadow-blue-500/20"
              >
                {state.sending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending Message...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Message
                  </span>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </section>
  )
}
