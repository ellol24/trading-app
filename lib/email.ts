import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  // If SMTP is configured, use nodemailer
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `"Xspy-Trader" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      return { ok: true, id: info.messageId };
    } catch (error) {
      console.error("[email] Nodemailer Error:", error);
      return { ok: false, error };
    }
  }

  // Fallback to Resend if no SMTP is configured but Resend is
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("re_placeholder")) {
    console.warn("[email] Neither SMTP_USER nor RESEND_API_KEY configured — skipping email.");
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Xspy-Trader <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    console.error("[email] Resend Fetch Error:", error);
    return { ok: false, error };
  }
}
