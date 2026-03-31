from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from storage import get_users, get_stats

# =========================
# CONFIG
# =========================
ADMIN_IDS = {
    6888766058,  # ضع ID الأدمن / الأدمنز هنا
}

# حالة الأدمن (Broadcast)
ADMIN_STATE = {}

# =========================
# HELPERS
# =========================
def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def admin_menu():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📣 Broadcast Message", callback_data="admin_broadcast")],
        [InlineKeyboardButton("📊 Bot Statistics", callback_data="admin_stats")],
        [InlineKeyboardButton("⬅️ Back to Main Menu", callback_data="admin_back")],
    ])


# =========================
# COMMAND
# =========================
async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    if not is_admin(user.id):
        return

    await update.message.reply_text(
        "🛠 Admin Control Panel",
        reply_markup=admin_menu()
    )


# =========================
# CALLBACKS
# =========================
async def admin_callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = query.from_user.id
    if not is_admin(user_id):
        return

    data = query.data

    # -------- Broadcast --------
    if data == "admin_broadcast":
        ADMIN_STATE[user_id] = "broadcast"
        await query.edit_message_text(
            "📣 Send the message you want to broadcast to all users:"
        )

    # -------- Statistics --------
    elif data == "admin_stats":
        stats = get_stats()
        await query.edit_message_text(
            f"📊 Bot Statistics\n\n"
            f"👥 Users: {stats['users']}\n"
            f"📈 Trades: {stats['trades']}\n"
            f"💼 Investments: {stats['invests']}",
            reply_markup=admin_menu()
        )

    # -------- Back --------
    elif data == "admin_back":
        await query.edit_message_text(
            "Main Menu",
            reply_markup=None
        )


# =========================
# TEXT (Broadcast)
# =========================
async def admin_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if not is_admin(user_id):
        return

    if ADMIN_STATE.get(user_id) != "broadcast":
        return

    message = update.message.text
    users = get_users()

    sent = 0
    failed = 0

    for uid in users:
        try:
            await context.bot.send_message(uid, message)
            sent += 1
        except Exception:
            failed += 1

    ADMIN_STATE.pop(user_id, None)

    await update.message.reply_text(
        f"✅ Broadcast Completed\n\n"
        f"📤 Sent: {sent}\n"
        f"❌ Failed: {failed}",
        reply_markup=admin_menu()
    )


# =========================
# REGISTER
# =========================
def admin_handlers(app):
    app.add_handler(CommandHandler("admin", admin_command))
    app.add_handler(CallbackQueryHandler(admin_callbacks, pattern="^admin_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, admin_text_handler))
