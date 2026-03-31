# ===============================
# XSPY Trader Profit Bot
# Interactive Trading + Investment
# EN / AR | Inline Only | JSON History | Production Ready
# ===============================

import json
import os
from datetime import datetime
from admin import admin_handlers
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# ---------------- CONFIG ----------------
TOKEN = "8373548565:AAGPEOu0mT0VodEyS3-4CSwXXoV9N7XIfp8"
DATA_FILE = "data.json"

# ---------------- DATA ----------------
PACKAGES = {
    "p1": {"days": 45, "min": 50, "max": 100, "rate": 2.5},
    "p2": {"days": 60, "min": 101, "max": 200, "rate": 2.8},
}

TRADING = {
    "t30": {"seconds": 30, "rate": 2},
    "t60": {"seconds": 60, "rate": 2.5},
    "t120": {"seconds": 120, "rate": 2.8},
}

# ---------------- TRANSLATION ----------------
TEXT = {
    "choose_lang": {"en": "Choose your language", "ar": "اختر اللغة"},
    "welcome": {
        "en": "Welcome to XSPY Trader Profit Bot\nChoose an option:",
        "ar": "مرحبًا بك في بوت XSPY لحساب الأرباح\nاختر أحد الخيارات:",
    },
    "menu": {
        "trading": {"en": "📊 Trading Profits", "ar": "📊 أرباح التداول"},
        "invest": {"en": "💼 Investment Packages", "ar": "💼 باقات الاستثمار"},
        "history": {"en": "📜 History", "ar": "📜 السجل"},
        "terms": {"en": "ℹ️ Terms & Conditions", "ar": "ℹ️ الشروط والأحكام"},
        "lang": {"en": "🌐 Change Language", "ar": "🌐 تغيير اللغة"},
        "back": {"en": "⬅ Back", "ar": "⬅ رجوع"},
    },
    "enter_amount": {"en": "Enter amount:", "ar": "أدخل المبلغ:"},
    "invalid": {"en": "Invalid amount", "ar": "مبلغ غير صالح"},
    "no_history": {"en": "No history yet", "ar": "لا يوجد سجل بعد"},
}

# ---------------- STORAGE ----------------

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ---------------- HELPERS ----------------

def lang(ctx):
    return ctx.user_data.get("lang", "en")


def main_menu(l):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(TEXT["menu"]["trading"][l], callback_data="trading")],
        [InlineKeyboardButton(TEXT["menu"]["invest"][l], callback_data="invest")],
        [InlineKeyboardButton(TEXT["menu"]["history"][l], callback_data="history")],
        [InlineKeyboardButton(TEXT["menu"]["terms"][l], callback_data="terms")],
        [InlineKeyboardButton(TEXT["menu"]["lang"][l], callback_data="change_lang")],
    ])


def back(l):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(TEXT["menu"]["back"][l], callback_data="back")]
    ])

# ---------------- HANDLERS ----------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("🇬🇧 English", callback_data="lang_en")],
        [InlineKeyboardButton("🇸🇦 العربية", callback_data="lang_ar")],
    ])
    await update.message.reply_text(TEXT["choose_lang"]["en"], reply_markup=kb)


async def set_lang(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    context.user_data.clear()
    context.user_data["lang"] = "ar" if q.data == "lang_ar" else "en"
    await q.edit_message_text(TEXT["welcome"][lang(context)], reply_markup=main_menu(lang(context)))


async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    l = lang(context)
    d = q.data

    if d == "back":
        await q.edit_message_text(TEXT["welcome"][l], reply_markup=main_menu(l))

    elif d == "trading":
        kb = [
            [InlineKeyboardButton("30s • 2%", callback_data="trade_t30")],
            [InlineKeyboardButton("60s • 2.5%", callback_data="trade_t60")],
            [InlineKeyboardButton("120s • 2.8%", callback_data="trade_t120")],
            [InlineKeyboardButton(TEXT['menu']['back'][l], callback_data="back")],
        ]
        await q.edit_message_text(TEXT['menu']['trading'][l], reply_markup=InlineKeyboardMarkup(kb))

    elif d.startswith("trade_"):
        context.user_data["mode"] = "trade"
        context.user_data["trade"] = TRADING[d.split("_")[1]]
        await q.edit_message_text(TEXT["enter_amount"][l])

    elif d == "invest":
        kb = []
        for k, p in PACKAGES.items():
            kb.append([InlineKeyboardButton(f"{p['days']} Days • {p['rate']}%", callback_data=f"pkg_{k}")])
        kb.append([InlineKeyboardButton(TEXT['menu']['back'][l], callback_data="back")])
        await q.edit_message_text(TEXT['menu']['invest'][l], reply_markup=InlineKeyboardMarkup(kb))

    elif d.startswith("pkg_"):
        context.user_data["mode"] = "invest"
        context.user_data["pkg"] = PACKAGES[d.split("_")[1]]
        await q.edit_message_text(TEXT["enter_amount"][l])

    elif d == "history":
        data = load_data()
        uid = str(q.from_user.id)
        logs = data.get(uid, [])
        if not logs:
            await q.edit_message_text(TEXT["no_history"][l], reply_markup=back(l))
        else:
            await q.edit_message_text("\n\n".join(logs[-10:]), reply_markup=back(l))

    elif d == "terms":
        await q.edit_message_text(
            "• Calculations only\n• No real investments\n• Trading has risks",
            reply_markup=back(l),
        )

    elif d == "change_lang":
        await start(q, context)


async def text_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if "mode" not in context.user_data:
        return

    l = lang(context)
    try:
        amount = float(update.message.text)
    except ValueError:
        await update.message.reply_text(TEXT["invalid"][l])
        return

    data = load_data()
    uid = str(update.effective_user.id)
    data.setdefault(uid, [])

    if context.user_data["mode"] == "trade":
        t = context.user_data["trade"]
        profit = amount * t["rate"] / 100
        final = amount + profit
        msg = (
            f"Trading Result\n"
            f"Duration: {t['seconds']}s\n"
            f"Amount: {amount}$\n"
            f"Profit: {profit:.2f}$\n"
            f"Final: {final:.2f}$"
        )

    else:
        p = context.user_data["pkg"]
        if not (p["min"] <= amount <= p["max"]):
            await update.message.reply_text(TEXT["invalid"][l])
            return
        daily = amount * p["rate"] / 100
        total = daily * p["days"]
        final = amount + total
        msg = (
            f"Investment Result\n"
            f"Amount: {amount}$\n"
            f"Daily: {daily:.2f}$\n"
            f"Total: {total:.2f}$\n"
            f"Final: {final:.2f}$"
        )

    data[uid].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {msg}")
    save_data(data)
    context.user_data.clear()
    context.user_data["lang"] = l

    await update.message.reply_text(msg, reply_markup=main_menu(l))


# ---------------- RUN ----------------

def main():
    app = ApplicationBuilder().token(TOKEN).build()

    # admin handlers
    admin_handlers(app)

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(set_lang, pattern="^lang_"))
    app.add_handler(CallbackQueryHandler(menu))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_input))

    print("Bot is running...")
    
    app.run_polling()


if __name__ == "__main__":
    main()
