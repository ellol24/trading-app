# ==========================================
# Storage Layer (Users / Trades / Invests)
# ==========================================

import json
import os

DATA_FILE = "data.json"

# ------------------------------------------
# Internal helpers
# ------------------------------------------

def _load():
    if not os.path.exists(DATA_FILE):
        return {
            "users": [],
            "trades": {},
            "invests": {},
        }
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# ------------------------------------------
# Users
# ------------------------------------------

def add_user(user_id: int):
    data = _load()
    uid = str(user_id)

    if user_id not in data["users"]:
        data["users"].append(user_id)
        data["trades"][uid] = 0
        data["invests"][uid] = 0
        _save(data)

def get_users():
    data = _load()
    return data["users"]

# ------------------------------------------
# Trades / Invests
# ------------------------------------------

def log_trade(user_id: int):
    data = _load()
    uid = str(user_id)
    data["trades"][uid] = data["trades"].get(uid, 0) + 1
    _save(data)

def log_invest(user_id: int):
    data = _load()
    uid = str(user_id)
    data["invests"][uid] = data["invests"].get(uid, 0) + 1
    _save(data)

def get_user_stats(user_id: int):
    data = _load()
    uid = str(user_id)
    return {
        "trades": data["trades"].get(uid, 0),
        "invests": data["invests"].get(uid, 0),
    }

# ------------------------------------------
# Admin global stats
# ------------------------------------------

def get_stats():
    data = _load()
    return {
        "users": len(data["users"]),
        "trades": sum(data["trades"].values()),
        "invests": sum(data["invests"].values()),
    }
