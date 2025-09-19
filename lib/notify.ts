"use client"

import { toast } from "@/hooks/use-toast"

type BaseOptions = {
  title?: string
  description?: string
  duration?: number
}

function success(opts: BaseOptions) {
  return toast({
    title: opts.title ?? "Success",
    description: opts.description,
    duration: opts.duration ?? 5000,
  })
}

function info(opts: BaseOptions) {
  return toast({
    title: opts.title ?? "Notice",
    description: opts.description,
    duration: opts.duration ?? 5000,
  })
}

function error(opts: BaseOptions) {
  return toast({
    title: opts.title ?? "Something went wrong",
    description: opts.description,
    variant: "destructive",
    duration: opts.duration ?? 6000,
  })
}

/**
 * Opinionated, reusable notifications for common flows.
 * Use in pages/components for consistent, professional copy.
 */
export const notify = {
  success,
  info,
  error,
  deposit: {
    invalidAmount: () =>
      error({
        title: "Invalid amount",
        description: "Please enter a valid deposit amount.",
      }),
    proofMissing: () =>
      error({
        title: "Payment proof required",
        description: "Upload a screenshot of your payment to continue.",
      }),
    submitted: (id?: string) =>
      success({
        title: "Deposit submitted",
        description: id
          ? `Your request ${id} has been sent for review. We'll notify you once it's approved.`
          : "Your request has been sent for review. We'll notify you once it's approved.",
      }),
    failed: () =>
      error({
        title: "Submission failed",
        description: "We couldn't submit your deposit. Please try again.",
      }),
    screenshotAttached: () =>
      info({
        title: "Screenshot attached",
        description: "Your payment screenshot has been added.",
      }),
    networkChanged: (label: string) =>
      info({
        title: "Network updated",
        description: `You selected ${label}. Make sure your transfer matches this network.`,
      }),
  },
  admin: {
    depositApproved: (id: string) =>
      success({
        title: "Deposit approved",
        description: `Deposit ${id} was approved successfully.`,
      }),
    depositRejected: (id: string) =>
      info({
        title: "Deposit rejected",
        description: `Deposit ${id} was rejected.`,
      }),
  },
}
