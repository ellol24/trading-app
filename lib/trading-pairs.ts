// lib/trading-pairs.ts
// Single source of truth for supported trading pairs across User Dashboard and Admin Controls

export const TRADING_PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "USD/CAD",
  "AUD/USD",
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",
  "XAU/USD",
] as const;

export type TradingPair = (typeof TRADING_PAIRS)[number];
