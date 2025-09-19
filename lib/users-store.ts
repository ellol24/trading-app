import { getSettings } from "./settings-store"

export type LoginEntry = {
  ip: string
  at: string // ISO timestamp
  userAgent?: string
}

export type UserRecord = {
  id: string
  email: string
  username: string
  password: string // Plain text per user request (DANGEROUS in production)
  role: "user" | "admin"
  isVerified: boolean
  balance: number
  demoBalance: number
  registrationAt: string
  registrationIP?: string
  country?: string
  phone?: string
  loginHistory: LoginEntry[]
}

const STORAGE_KEY = "usersDB_v1"

// Simple pub/sub so admin and user pages stay in sync.
type Subscriber = () => void
const subscribers = new Set<Subscriber>()
function notifySubs() {
  subscribers.forEach((fn) => {
    try {
      fn()
    } catch (e) {
      console.error("users-store subscriber failed", e)
    }
  })
}

export function subscribeUsers(callback: Subscriber) {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

function readDB(): UserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

function writeDB(db: UserRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  notifySubs()
}

export function listUsers(): UserRecord[] {
  return readDB()
}

export function getUserByEmail(email: string): UserRecord | undefined {
  const db = readDB()
  return db.find((u) => u.email.toLowerCase() === email.toLowerCase())
}

export function getUserById(id: string): UserRecord | undefined {
  const db = readDB()
  return db.find((u) => u.id === id)
}

export function upsertUser(user: UserRecord) {
  const db = readDB()
  const idx = db.findIndex((u) => u.id === user.id)
  if (idx === -1) db.push(user)
  else db[idx] = user
  writeDB(db)
}

export function createUser(data: {
  email: string
  username: string
  password: string
  role?: "user" | "admin"
  isVerified?: boolean
  balance?: number
  demoBalance?: number
  registrationIP?: string
  country?: string
  phone?: string
}): UserRecord {
  const now = new Date().toISOString()

  // Apply Welcome Bonus at account creation if enabled
  const settings = getSettings()
  const baseBalance = Number(data.balance ?? 0)
  const bonus = settings.welcomeBonusEnabled ? Number(settings.welcomeBonusAmount || 0) : 0
  const initialBalance = baseBalance + (Number.isFinite(bonus) ? bonus : 0)

  const user: UserRecord = {
    id: crypto.randomUUID(),
    email: data.email,
    username: data.username,
    password: data.password, // WARNING: plain text (requested)
    role: data.role ?? "user",
    isVerified: data.isVerified ?? false,
    balance: initialBalance,
    demoBalance: data.demoBalance ?? 50000,
    registrationAt: now,
    registrationIP: data.registrationIP,
    country: data.country,
    phone: data.phone,
    loginHistory: [],
  }
  const db = readDB()
  db.push(user)
  writeDB(db)
  return user
}

export function recordLogin(email: string, entry: LoginEntry) {
  const db = readDB()
  const idx = db.findIndex((u) => u.email.toLowerCase() === email.toLowerCase())
  if (idx === -1) return
  db[idx].loginHistory = db[idx].loginHistory || []
  db[idx].loginHistory.unshift(entry)
  // keep most recent 50
  db[idx].loginHistory = db[idx].loginHistory.slice(0, 50)
  writeDB(db)
}

export function updateUser(id: string, patch: Partial<UserRecord>) {
  const db = readDB()
  const idx = db.findIndex((u) => u.id === id)
  if (idx === -1) return
  db[idx] = { ...db[idx], ...patch }
  writeDB(db)
}

// Client IP helper (ipify)
export async function getClientIP(): Promise<string | undefined> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return undefined
    const data = (await res.json()) as { ip?: string }
    return data.ip
  } catch {
    return undefined
  }
}
