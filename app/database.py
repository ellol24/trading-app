import sqlite3

conn = sqlite3.connect("bot.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT
)
""")

conn.commit()


def add_user(user_id: int):
    cur.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (user_id,))
    conn.commit()


def get_users():
    cur.execute("SELECT user_id FROM users")
    return [row[0] for row in cur.fetchall()]


def log_action(user_id: int, action: str):
    cur.execute(
        "INSERT INTO logs (user_id, action) VALUES (?, ?)",
        (user_id, action)
    )
    conn.commit()


def stats():
    cur.execute("SELECT COUNT(*) FROM users")
    users = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM logs")
    actions = cur.fetchone()[0]

    return users, actions
