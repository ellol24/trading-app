from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# =========================
# CONFIG
# =========================
TOKEN = "8373548565:AAGPEOu0mT0VodEyS3-4CSwXXoV9N7XIfp8"

# =========================
# DATA
# =========================
user_state = {}
user_data = {}
history = {}

PACKAGES = {
    "p1": {"name": "45 Days Investment", "min": 50, "max": 100, "rate": 2.5, "days": 45},
    "p2": {"name": "60 Days Investment", "min": 100, "max": 500, "rate": 3.0, "days": 60},
    "p3": {"name": "90 Days Investment", "min": 500, "max": 2000, "rate": 3.5, "days": 90},
}

TRADING = {
    "trade_30": {"seconds": 30, "rate": 2},
    "trade_60": {"seconds": 60, "rate": 2.5},
    "trade_120": {"seconds": 120, "rate": 2.8},
}

# =========================
# UI
# =========================
def main_menu():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 Trading Profits", callback_data="trading")],
        [InlineKeyboardButton("💼 Investment Packages", callback_data="invest")],
        [InlineKeyboardButton("🧮 Calculate Your Profit", callback_data="calculator")],
        [InlineKeyboardButton("📜 History", callback_data="history")],
        [InlineKeyboardButton("ℹ️ Terms & Conditions", callback_data="terms")],
    ])

def back_button():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⬅️ Back to Main Menu", callback_data="back_main")]
    ])

# =========================
# COMMANDS
# =========================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to XSPY Trader Profit Bot\n\nPlease choose an option:",
        reply_markup=main_menu()
    )

# =========================
# CALLBACK HANDLERS
# =========================
async def callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    data = query.data

    # MAIN MENU
    if data == "back_main":
        user_state.pop(uid, None)
        await query.edit_message_text(
            "Main Menu:",
            reply_markup=main_menu()
        )

    # TRADING MENU
    elif data == "trading":
        await query.edit_message_text(
            "📊 Choose Trading Duration:",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("⏱ 30 Seconds – 2%", callback_data="trade_30")],
                [InlineKeyboardButton("⏱ 60 Seconds – 2.5%", callback_data="trade_60")],
                [InlineKeyboardButton("⏱ 120 Seconds – 2.8%", callback_data="trade_120")],
                [InlineKeyboardButton("⬅️ Back", callback_data="back_main")],
            ])
        )

    elif data in TRADING:
        user_state[uid] = "trade_amount"
        user_data[uid] = TRADING[data]
        await query.edit_message_text(
            f"💵 Enter trade amount for {TRADING[data]['seconds']} seconds:",
        )

    # INVESTMENT MENU
    elif data == "invest":
        buttons = []
        for k, v in PACKAGES.items():
            buttons.append([
                InlineKeyboardButton(
                    f"{v['name']} ({v['rate']}%)",
                    callback_data=f"pkg_{k}"
                )
            ])
        buttons.append([InlineKeyboardButton("⬅️ Back", callback_data="back_main")])

        await query.edit_message_text(
            "💼 Choose Investment Package:",
            reply_markup=InlineKeyboardMarkup(buttons)
        )

    elif data.startswith("pkg_"):
        pkg = PACKAGES[data.split("_")[1]]
        user_state[uid] = "invest_amount"
        user_data[uid] = pkg

        await query.edit_message_text(
            f"""
📦 {pkg['name']}
📅 Duration: {pkg['days']} days
📈 Rate: {pkg['rate']}%
💰 Min: ${pkg['min']}
💰 Max: ${pkg['max']}

Enter investment amount:
"""
        )

    # CALCULATOR
    elif data == "calculator":
        user_state[uid] = "calculator"
        await query.edit_message_text(
            "🧮 Enter amount to calculate daily profit:",
        )

    # HISTORY
    elif data == "history":
        logs = history.get(uid, [])
        text = "📜 Your History:\n\n" + ("\n".join(logs[-10:]) if logs else "No records yet.")
        await query.edit_message_text(text, reply_markup=back_button())

    # TERMS
    elif data == "terms":
        await query.edit_message_text(
            "ℹ️ Terms & Conditions\n\n"
            "• All calculations are estimates\n"
            "• This bot does not hold funds\n"
            "• Trading involves risk",
            reply_markup=back_button()
        )

# =========================
# TEXT HANDLER
# =========================
async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.message.from_user.id
    text = update.message.text

    if uid not in user_state:
        return

    try:
        amount = float(text)
    except ValueError:
        await update.message.reply_text("❌ Please enter a valid number.")
        return

    # TRADING
    if user_state[uid] == "trade_amount":
        trade = user_data[uid]
        profit = amount * trade["rate"] / 100
        final = amount + profit

        msg = (
            f"📊 Trading Result\n\n"
            f"⏱ Duration: {trade['seconds']} seconds\n"
            f"💰 Amount: ${amount}\n"
            f"📈 Profit: ${profit:.2f}\n"
            f"✅ Final Balance: ${final:.2f}"
        )

    # INVESTMENT
    elif user_state[uid] == "invest_amount":
        pkg = user_data[uid]
        if amount < pkg["min"] or amount > pkg["max"]:
            await update.message.reply_text(
                f"❌ Amount must be between ${pkg['min']} and ${pkg['max']}"
            )
            return

        daily = amount * pkg["rate"] / 100
        total = daily * pkg["days"]

        msg = (
            f"💼 Investment Result\n\n"
            f"📦 Package: {pkg['name']}\n"
            f"💰 Amount: ${amount}\n"
            f"📈 Daily Profit: ${daily:.2f}\n"
            f"📅 Total Profit: ${total:.2f}"
        )

    # CALCULATOR
    elif user_state[uid] == "calculator":
        daily = amount * 0.025
        msg = (
            f"🧮 Profit Calculator\n\n"
            f"💰 Amount: ${amount}\n"
            f"📈 Estimated Daily Profit: ${daily:.2f}"
        )

    history.setdefault(uid, []).append(msg.replace("\n", " | "))
    user_state.pop(uid)

    await update.message.reply_text(msg, reply_markup=back_button())

# =========================
# RUN
# =========================
def main():
    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(callbacks))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    print("Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()
