// scripts/reclaim-and-setup-bot.js
const fs = require('fs');
const path = require('path');

const token = process.argv[2] || process.env.NEW_BOT_TOKEN;

if (!token) {
  console.error("Usage: node scripts/reclaim-and-setup-bot.js <BOT_TOKEN>");
  process.exit(1);
}

async function tg(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data;
}

async function main() {
  console.log("1. Checking bot identity...");
  const me = await tg('getMe');
  console.log("getMe:", me);

  if (!me.ok) {
    console.error("Error: Token is invalid or Telegram API returned an error:", me);
    process.exit(1);
  }

  console.log(`Verified bot: @${me.result.username} (${me.result.first_name})`);

  console.log("\n2. Setting bot display name...");
  const setName = await tg('setMyName', { name: "XSPY AI Assistant" });
  console.log("setMyName:", setName);

  console.log("\n3. Setting bot description (welcome page text)...");
  const desc = "Welcome to XSPY Trader AI Assistant! 🚀\n\nYour 24/7 intelligent guide for trading sessions, cloud mining packages, deposits, withdrawals, and account security.\n\nPress START to explore the platform!";
  const setDesc = await tg('setMyDescription', { description: desc });
  console.log("setMyDescription (default):", setDesc);

  // Clear any Russian / Arabic descriptions that may have been saved under language codes
  for (const lang of ['ru', 'ar', 'es', 'fr', 'de']) {
    await tg('setMyDescription', { description: desc, language_code: lang });
  }

  console.log("\n4. Setting bot short description (about / bio)...");
  const shortDesc = "Official 24/7 AI Assistant & Community Guide for XSPY Trader (https://xspy-trader.com).";
  const setShort = await tg('setMyShortDescription', { short_description: shortDesc });
  console.log("setMyShortDescription:", setShort);
  for (const lang of ['ru', 'ar', 'es', 'fr', 'de']) {
    await tg('setMyShortDescription', { short_description: shortDesc, language_code: lang });
  }

  console.log("\n5. Setting bot commands...");
  const commands = [
    { command: "start", description: "Open main menu & interactive guide" },
    { command: "help", description: "How to use the platform & FAQ" },
    { command: "plans", description: "View Cloud Mining & VIP plans" },
    { command: "deposit", description: "Learn how to deposit funds" },
    { command: "withdraw", description: "Learn how to withdraw earnings" },
    { command: "support", description: "Contact official 24/7 support" }
  ];
  const setCmds = await tg('setMyCommands', { commands });
  console.log("setMyCommands:", setCmds);

  console.log("\n6. Setting webhook to production backend...");
  const webhookUrl = "https://www.xspy-trader.com/api/telegram/group-bot";
  const setWh = await tg('setWebhook', {
    url: webhookUrl,
    drop_pending_updates: true,
    allowed_updates: ["message", "edited_message", "callback_query", "chat_member", "my_chat_member"]
  });
  console.log("setWebhook:", setWh);

  console.log("\n7. Verifying Webhook Info...");
  const whInfo = await tg('getWebhookInfo');
  console.log("getWebhookInfo:", JSON.stringify(whInfo, null, 2));

  console.log("\nAll Telegram Bot API settings applied successfully!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
