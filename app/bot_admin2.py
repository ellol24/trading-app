from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)

from storage import add_user, log_trade, log_invest

# =========================
# CONFIG
# =========================
BOT_TOKEN = "PUT_YOUR_TOKEN_HERE"  # ضع التوكن الصحيح هنا

# =========================
# MENUS
# =========================
def main_menu():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📈 حساب صفقة", callback_data="calc_trade")],
        [InlineKeyboardButton("💼 حساب استثمار", callback_data="calc_invest")],
        [InlineKeyboardButton("📊 إحصائياتي", callback_data="my_stats")],
    ])


# =========================
# START
# =========================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    # تسجيل المستخدم (مضمون 100%)
    add_user(user.id)

    await update.message.reply_text(
        "👋 مرحبًا بك في بوت حساب الأرباح\n\n"
        "اختر العملية التي تريدها:",
        reply_markup=main_menu()
    )


# =========================
# CALLBACKS
# =========================
async def callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = query.from_user.id
    add_user(user_id)

    data = query.data

    # -------- TRADE --------
    if data == "calc_trade":
        context.user_data["state"] = "trade"
        await query.edit_message_text(
            "📈 حساب صفقة\n\n"
            "أرسل البيانات بهذا الشكل:\n"
            "`الدخول الخروج الكمية`\n\n"
            "مثال:\n"
            "`100 120 5`",
            parse_mode="Markdown"
        )

    # -------- INVEST --------
    elif data == "calc_invest":
        context.user_data["state"] = "invest"
        await query.edit_message_text(
            "💼 حساب استثمار\n\n"
            "أرسل البيانات بهذا الشكل:\n"
            "`المبلغ نسبة_الربح`\n\n"
            "مثال:\n"
            "`1000 10`",
            parse_mode="Markdown"
        )

    # -------- STATS --------
    elif data == "my_stats":
        trades = context.user_data.get("trades", 0)
        invests = context.user_data.get("invests", 0)

        await query.edit_message_text(
            f"📊 إحصائياتك الشخصية\n\n"
            f"📈 عدد الصفقات: {trades}\n"
            f"💼 عدد الاستثمارات: {invests}",
            reply_markup=main_menu()
        )


# =========================
# TEXT INPUT
# =========================
async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if "state" not in context.user_data:
        return

    text = update.message.text.strip()
    user_id = update.effective_user.id

    # -------- TRADE --------
    if context.user_data["state"] == "trade":
        try:
            entry, exit_price, qty = map(float, text.split())
            profit = (exit_price - entry) * qty

            log_trade(user_id, profit)

            context.user_data["trades"] = context.user_data.get("trades", 0) + 1
            context.user_data.pop("state")

            await update.message.reply_text(
                f"✅ تم حساب الصفقة\n\n"
                f"💰 الربح: {profit:.2f}",
                reply_markup=main_menu()
            )
        except Exception:
            await update.message.reply_text("❌ صيغة غير صحيحة. حاول مرة أخرى.")

    # -------- INVEST --------
    elif context.user_data["state"] == "invest":
        try:
            amount, percent = map(float, text.split())
            profit = amount * (percent / 100)

            log_invest(user_id, profit)

            context.user_data["invests"] = context.user_data.get("invests", 0) + 1
            context.user_data.pop("state")

            await update.message.reply_text(
                f"✅ تم حساب الاستثمار\n\n"
                f"💰 الربح: {profit:.2f}",
                reply_markup=main_menu()
            )
        except Exception:
            await update.message.reply_text("❌ صيغة غير صحيحة. حاول مرة أخرى.")


# =========================
# MAIN
# =========================
def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(callbacks))
    app.add_handler(
        telegram.ext.MessageHandler(
            telegram.ext.filters.TEXT & ~telegram.ext.filters.COMMAND,
            text_handler,
        )
    )

    print("✅ Profit Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()
