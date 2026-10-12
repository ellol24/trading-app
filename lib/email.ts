import { Resend } from "resend";

// Verified production domain sender — do not change this address.
const FROM_ADDRESS = "Xspy Trader Security <no-reply@xspy-trader.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends a transactional email via the Resend SDK using our verified
 * production domain (xspy-trader.com).
 *
 * Falls back gracefully if RESEND_API_KEY is absent (e.g. local dev
 * without credentials).
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.startsWith("re_placeholder")) {
    console.warn(
      "[email] RESEND_API_KEY not configured — skipping email dispatch."
    );
    return { ok: true, skipped: true };
  }

  try {
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("[email] Resend SDK error:", error);
      return { ok: false, error };
    }

    console.log("[email] Email dispatched via Resend. ID:", data?.id);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] Unexpected Resend error:", err);
    return { ok: false, error: err };
  }
}
