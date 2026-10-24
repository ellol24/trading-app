/**
 * Helper to resolve active Telegram bot tokens safely.
 * If Vercel environment variables still hold older revoked tokens,
 * this automatically resolves to the latest verified secure tokens.
 */

export const ACTIVE_OTP_BOT_TOKEN = "8975286636:AAERxgkIFALNBgZ4bhA8e5pwJLLuXU65REA";
export const ACTIVE_GROUP_BOT_TOKEN = "8255653698:AAFCHHvC0elMQTgehiidoqqEQjucjB4xxPw";

export function getOtpBotToken(): string {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (
    !env ||
    env.startsWith("8935322771") ||
    env.startsWith("8255653698") ||
    env === "8975286636:AAH1osEvgu81sfey7rgQqAS_Apehb_wkOQk"
  ) {
    return ACTIVE_OTP_BOT_TOKEN;
  }
  return env;
}

export function getGroupBotToken(): string {
  const env = process.env.TELEGRAM_GROUP_BOT_TOKEN?.trim();
  if (
    !env ||
    env === "8255653698:AAGYOKx-s7rclcq4FbCx5edlM0WQxg0Guu8" ||
    env.startsWith("8935322771")
  ) {
    return ACTIVE_GROUP_BOT_TOKEN;
  }
  return env;
}
