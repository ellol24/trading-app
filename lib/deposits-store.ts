// Shared client-side store for deposit requests (frontend-only)
// Uses localStorage so Admin and User pages stay in sync without a backend.

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type NetworkId = "USDT_TRC20" | "USDT_BEB20"

export type NetworkInfo = {
  id: NetworkId
  label: string
  chain: string
  // Replace these with your real platform wallet addresses.
  address: string
}

export const NETWORKS: NetworkInfo[] = [
  {
    id: "USDT_TRC20",
    label: "USDT (TRC20)",
    chain: "TRON",
    address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5oREqjK",
  },
  {
    id: "USDT_BEB20",
    label: "USDT (BEB20)",
    chain: "BNB Smart Chain",
    address: "0x742d35Cc6634C0532925a3b8D4C9db96590b4c5d",
  },
]

export type DepositStatus = "pending" | "confirmed" | "rejected"

export interface DepositRequest {
  id: string
  userId?: string
  username?: string
  email?: string
  networkId: NetworkId
  networkLabel: string
  address: string
  amount: number
  status: DepositStatus
  createdAt: string
  txId?: string
  rejectionReason?: string
  // Base64 data URL of the uploaded screenshot for admin preview
  proofDataUrl?: string
}

type DepositsState = {
  items: DepositRequest[]
  addDeposit: (dep: DepositRequest) => void
  updateDeposit: (id: string, patch: Partial<DepositRequest>) => void
  clearAll: () => void
}

export const useDepositsStore = create<DepositsState>()(
  persist(
    (set) => ({
      items: [],
      addDeposit: (dep) =>
        set((state) => ({
          items: [dep, ...state.items],
        })),
      updateDeposit: (id, patch) =>
        set((state) => ({
          items: state.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        })),
      clearAll: () => set({ items: [] }),
    }),
    { name: "deposits-store" }
  )
)
