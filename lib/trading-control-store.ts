export type ForcedOutcome = "win" | "loss" | "draw"

export type AdminDeal = {
  id: string
  symbol: string
  startTime: number // epoch ms
  durationSec: number
  payoutPercent: number // e.g. 80 for 80%
  forcedOutcome: ForcedOutcome
  entryWindowSec: number // allowed seconds distance from start to enter
  status: "scheduled" | "active" | "completed" | "canceled"
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = "admin_deals_v1"

type Listener = (deals: AdminDeal[]) => void

function read(): AdminDeal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as AdminDeal[]
    return list.map((d) => ({ ...d }))
  } catch {
    return []
  }
}

function write(deals: AdminDeal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals))
  window.dispatchEvent(new CustomEvent("admin:deals:update"))
}

export const tradingControlStore = {
  getAll(): AdminDeal[] {
    return read()
  },

  upsert(deal: AdminDeal) {
    const list = read()
    const idx = list.findIndex((d) => d.id === deal.id)
    if (idx === -1) list.push(deal)
    else list[idx] = { ...deal, updatedAt: Date.now() }
    write(list)
  },

  setStatus(id: string, status: AdminDeal["status"]) {
    const list = read()
    const idx = list.findIndex((d) => d.id === id)
    if (idx > -1) {
      list[idx].status = status
      list[idx].updatedAt = Date.now()
      write(list)
    }
  },

  delete(id: string) {
    write(read().filter((d) => d.id !== id))
  },

  clearAll() {
    write([])
  },

  // Returns the deal considered "active" now (time window and status)
  getActive(now: number = Date.now()): AdminDeal | null {
    const list = read().sort((a, b) => a.startTime - b.startTime)
    for (const d of list) {
      if (d.status === "canceled") continue
      const end = d.startTime + d.durationSec * 1000
      if (now >= d.startTime && now <= end) {
        return { ...d, status: "active" }
      }
    }
    return null
  },

  // Returns the next upcoming scheduled deal
  getNext(now: number = Date.now()): AdminDeal | null {
    const list = read()
      .filter((d) => d.status !== "canceled" && d.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)
    return list.length ? list[0] : null
  },

  subscribe(fn: Listener) {
    const handler = () => fn(read())
    window.addEventListener("admin:deals:update", handler)
    // Fire immediately
    fn(read())
    return () => window.removeEventListener("admin:deals:update", handler)
  },
}

// Helpers used by UI
export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`
}

export function secondsUntil(targetMs: number, now: number = Date.now()) {
  return Math.max(0, Math.floor((targetMs - now) / 1000))
}
