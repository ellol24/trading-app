export type PlatformSettings = {
  tradingEnabled: boolean
  withdrawalsEnabled: boolean
  depositsEnabled: boolean
  registrationsEnabled: boolean
  maintenanceMode: boolean
  broadcastMessage: string
  kycRequired: boolean

  // 🎁 Welcome Bonus controls
  welcomeBonusEnabled: boolean
  welcomeBonusAmount: number

  // 🟢 Referral Commission Levels
  referralLevel1Commission: number // نسبة العمولة للمستوى الأول
  referralLevel2Commission: number // نسبة العمولة للمستوى الثاني
  referralLevel3Commission: number // نسبة العمولة للمستوى الثالث
}

const STORAGE_KEY = "platform_settings_v1"

type Subscriber = () => void
const subs = new Set<Subscriber>()
function notify() {
  subs.forEach((fn) => {
    try {
      fn()
    } catch (e) {
      console.error("settings-store subscriber failed", e)
    }
  })
}

export function subscribeSettings(cb: Subscriber) {
  subs.add(cb)
  return () => subs.delete(cb)
}

const defaultSettings: PlatformSettings = {
  tradingEnabled: true,
  withdrawalsEnabled: true,
  depositsEnabled: true,
  registrationsEnabled: true,
  maintenanceMode: false,
  broadcastMessage: "Welcome to Xspy-trader! We are constantly improving our platform.",
  kycRequired: false,

  // Defaults for welcome bonus
  welcomeBonusEnabled: false,
  welcomeBonusAmount: 50, // USD equivalent (adjust as needed)

  // Defaults for referral commissions
  referralLevel1Commission: 7, // 7%
  referralLevel2Commission: 4,  // 4%
  referralLevel3Commission: 2,  // 2%
}

function safeNumber(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n)
  return Number.isFinite(v) ? v : fallback
}

function read(): PlatformSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)

    return {
      ...defaultSettings,
      ...(parsed || {}),

      // تأكد من تحويل القيم الرقمية
      welcomeBonusAmount: safeNumber(parsed?.welcomeBonusAmount, defaultSettings.welcomeBonusAmount),
      referralLevel1Commission: safeNumber(parsed?.referralLevel1Commission, defaultSettings.referralLevel1Commission),
      referralLevel2Commission: safeNumber(parsed?.referralLevel2Commission, defaultSettings.referralLevel2Commission),
      referralLevel3Commission: safeNumber(parsed?.referralLevel3Commission, defaultSettings.referralLevel3Commission),
    }
  } catch {
    return defaultSettings
  }
}

function write(settings: PlatformSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  notify()
}

export function getSettings(): PlatformSettings {
  return read()
}

export function updateSetting<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
  const current = read()
  const next = { ...current, [key]: value }
  write(next)
  return next
}

export function setBroadcastMessage(message: string) {
  const current = read()
  write({ ...current, broadcastMessage: message })
}
