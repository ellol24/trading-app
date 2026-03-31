export type KYCStatus = "not_submitted" | "pending" | "approved" | "rejected"

export type KycRecord = {
  id: string
  userId: string
  email?: string
  firstName: string
  lastName: string
  dob: string // YYYY-MM-DD
  addressLine: string
  country: string
  documentType: "passport" | "id_card" | "driver_license"
  documentNumber: string
  frontImage?: string // data URL
  backImage?: string
  selfieImage?: string
  proofOfAddressImage?: string
  status: KYCStatus
  submittedAt?: string
  reviewedAt?: string
  reviewer?: string
  notes?: string
}

const STORAGE_KEY = "kycDB_v1"

type Subscriber = () => void
const subs = new Set<Subscriber>()
function notify() {
  subs.forEach((fn) => {
    try {
      fn()
    } catch (e) {
      console.error("kyc-store subscriber failed", e)
    }
  })
}

export function subscribeKyc(cb: Subscriber) {
  subs.add(cb)
  return () => subs.delete(cb)
}

function readDB(): KycRecord[] {
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

function writeDB(db: KycRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  notify()
}

export function listKyc(): KycRecord[] {
  return readDB()
}

export function getKycByUserId(userId: string): KycRecord | undefined {
  return readDB().find((k) => k.userId === userId)
}

export function upsertKyc(record: KycRecord) {
  const db = readDB()
  const idx = db.findIndex((k) => k.id === record.id)
  if (idx === -1) db.push(record)
  else db[idx] = record
  writeDB(db)
}

export function submitKyc(input: Omit<KycRecord, "id" | "status" | "submittedAt" | "reviewedAt">) {
  const existing = getKycByUserId(input.userId)
  const now = new Date().toISOString()
  const rec: KycRecord = existing
    ? {
        ...existing,
        ...input,
        status: "pending",
        submittedAt: now,
        reviewedAt: undefined,
        notes: undefined,
        reviewer: undefined,
      }
    : {
        ...input,
        id: crypto.randomUUID(),
        status: "pending",
        submittedAt: now,
      }
  upsertKyc(rec)
  return rec
}

export function reviewKyc(id: string, status: Exclude<KYCStatus, "not_submitted" | "pending">, notes?: string, reviewer?: string) {
  const db = readDB()
  const idx = db.findIndex((k) => k.id === id)
  if (idx === -1) return
  db[idx] = {
    ...db[idx],
    status,
    notes,
    reviewer,
    reviewedAt: new Date().toISOString(),
  }
  writeDB(db)
}
