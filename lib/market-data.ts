// Real-time market data simulation
export interface MarketData {
  symbol: string
  price: number
  change: number
  changePercent: number
  trend: 'up' | 'down'
  volume: number
  high24h: number
  low24h: number
  lastUpdate: Date
}

export interface CandlestickData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

class MarketDataService {
  private subscribers: Map<string, ((data: MarketData) => void)[]> = new Map()
  private marketData: Map<string, MarketData> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.initializeMarketData()
    this.startRealTimeUpdates()
  }

  private initializeMarketData() {
    const initialData: MarketData[] = [
      // Majors
      { symbol: 'EUR/USD', price: 1.0845, change: 0.0012, changePercent: 0.11, trend: 'up', volume: 1250000, high24h: 1.0890, low24h: 1.0820, lastUpdate: new Date() },
      { symbol: 'GBP/USD', price: 1.2634, change: -0.0023, changePercent: -0.18, trend: 'down', volume: 980000, high24h: 1.2680, low24h: 1.2610, lastUpdate: new Date() },
      { symbol: 'USD/JPY', price: 149.85, change: 0.45, changePercent: 0.30, trend: 'up', volume: 1100000, high24h: 150.20, low24h: 149.10, lastUpdate: new Date() },
      { symbol: 'USD/CAD', price: 1.3475, change: 0.0009, changePercent: 0.07, trend: 'up', volume: 840000, high24h: 1.3512, low24h: 1.3440, lastUpdate: new Date() },
      { symbol: 'USD/CHF', price: 0.8872, change: -0.0011, changePercent: -0.12, trend: 'down', volume: 730000, high24h: 0.8910, low24h: 0.8850, lastUpdate: new Date() },
      { symbol: 'AUD/USD', price: 0.6542, change: -0.0015, changePercent: -0.23, trend: 'down', volume: 750000, high24h: 0.6580, low24h: 0.6520, lastUpdate: new Date() },
      { symbol: 'NZD/USD', price: 0.6075, change: 0.0006, changePercent: 0.10, trend: 'up', volume: 520000, high24h: 0.6102, low24h: 0.6050, lastUpdate: new Date() },
      // Crosses
      { symbol: 'EUR/JPY', price: 162.35, change: 0.22, changePercent: 0.14, trend: 'up', volume: 610000, high24h: 163.10, low24h: 161.80, lastUpdate: new Date() },
      { symbol: 'GBP/JPY', price: 189.20, change: -0.35, changePercent: -0.18, trend: 'down', volume: 580000, high24h: 190.10, low24h: 188.80, lastUpdate: new Date() },
      // Metals
      { symbol: 'XAU/USD', price: 2320.5, change: 5.2, changePercent: 0.22, trend: 'up', volume: 890000, high24h: 2335.0, low24h: 2308.0, lastUpdate: new Date() },
      { symbol: 'XAG/USD', price: 28.45, change: -0.12, changePercent: -0.42, trend: 'down', volume: 420000, high24h: 28.90, low24h: 28.10, lastUpdate: new Date() },
      // Crypto
      { symbol: 'BTC/USD', price: 43250, change: 1250, changePercent: 2.98, trend: 'up', volume: 2500000, high24h: 44100, low24h: 42800, lastUpdate: new Date() },
      { symbol: 'ETH/USD', price: 2680, change: 85, changePercent: 3.27, trend: 'up', volume: 1800000, high24h: 2720, low24h: 2590, lastUpdate: new Date() },
      { symbol: 'BNB/USD', price: 590, change: 8, changePercent: 1.37, trend: 'up', volume: 620000, high24h: 602, low24h: 575, lastUpdate: new Date() },
      { symbol: 'SOL/USD', price: 145, change: -2.5, changePercent: -1.69, trend: 'down', volume: 540000, high24h: 151, low24h: 143, lastUpdate: new Date() },
    ]

    initialData.forEach(data => {
      this.marketData.set(data.symbol, data)
    })
  }

  private startRealTimeUpdates() {
    this.marketData.forEach((data, symbol) => {
      const interval = setInterval(() => {
        this.updateMarketData(symbol)
      }, 2000 + Math.random() * 3000) // Random interval between 2-5 seconds
      this.intervals.set(symbol, interval)
    })
  }

  private updateMarketData(symbol: string) {
    const currentData = this.marketData.get(symbol)
    if (!currentData) return

    // Simulate realistic price movements
    const volatility = this.getVolatility(symbol)
    const changePercent = (Math.random() - 0.5) * volatility
    const newPrice = currentData.price * (1 + changePercent / 100)
    const change = newPrice - currentData.price
    
    const dp = symbol.includes('JPY') ? 2 : symbol.includes('XAU') ? 1 : symbol.includes('XAG') ? 2 : (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('BNB') || symbol.includes('SOL')) ? 0 : 4

    const updatedData: MarketData = {
      ...currentData,
      price: Number(newPrice.toFixed(dp)),
      change: Number(change.toFixed(dp)),
      changePercent: Number(changePercent.toFixed(2)),
      trend: change >= 0 ? 'up' : 'down',
      volume: currentData.volume + Math.floor(Math.random() * 10000),
      lastUpdate: new Date()
    }

    if (updatedData.price > updatedData.high24h) {
      updatedData.high24h = updatedData.price
    }
    if (updatedData.price < updatedData.low24h) {
      updatedData.low24h = updatedData.price
    }

    this.marketData.set(symbol, updatedData)
    this.notifySubscribers(symbol, updatedData)
  }

  private getVolatility(symbol: string): number {
    const vol: Record<string, number> = {
      'EUR/USD': 0.5, 'GBP/USD': 0.7, 'USD/JPY': 0.6, 'AUD/USD': 0.8, 'NZD/USD': 0.8,
      'USD/CAD': 0.7, 'USD/CHF': 0.7, 'EUR/JPY': 0.9, 'GBP/JPY': 1.1,
      'XAU/USD': 1.2, 'XAG/USD': 1.4,
      'BTC/USD': 3.0, 'ETH/USD': 4.0, 'BNB/USD': 2.5, 'SOL/USD': 3.5
    }
    return vol[symbol] || 0.5
  }

  private notifySubscribers(symbol: string, data: MarketData) {
    const subscribers = this.subscribers.get(symbol) || []
    subscribers.forEach(callback => callback(data))
  }

  subscribe(symbol: string, callback: (data: MarketData) => void) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, [])
    }
    this.subscribers.get(symbol)!.push(callback)

    const currentData = this.marketData.get(symbol)
    if (currentData) {
      callback(currentData)
    }

    return () => {
      const subscribers = this.subscribers.get(symbol) || []
      const index = subscribers.indexOf(callback)
      if (index > -1) {
        subscribers.splice(index, 1)
      }
    }
  }

  getAllMarketData(): MarketData[] {
    return Array.from(this.marketData.values())
  }

  getMarketData(symbol: string): MarketData | undefined {
    return this.marketData.get(symbol)
  }

  generateCandlestickData(symbol: string, intervals: number = 50): CandlestickData[] {
    const currentData = this.marketData.get(symbol)
    if (!currentData) return []

    const data: CandlestickData[] = []
    const now = Date.now()
    let basePrice = currentData.price * 0.98 // Start slightly lower

    const dp = symbol.includes('JPY') ? 2 : symbol.includes('XAU') ? 1 : symbol.includes('XAG') ? 2 : (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('BNB') || symbol.includes('SOL')) ? 0 : 4
    const round = (v: number) => Number(v.toFixed(dp))

    for (let i = intervals; i >= 0; i--) {
      const timestamp = now - i * 60000 // 1 min candles for seed
      const volatility = this.getVolatility(symbol) / 100
      const open = basePrice
      const changePercent = (Math.random() - 0.5) * volatility
      const close = open * (1 + changePercent)
      const high = Math.max(open, close) * (1 + Math.random() * volatility / 2)
      const low = Math.min(open, close) * (1 - Math.random() * volatility / 2)

      data.push({
        timestamp,
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close),
        volume: Math.floor(Math.random() * 100000),
      })
      basePrice = close
    }

    return data
  }

  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals.clear()
    this.subscribers.clear()
  }
}

export const marketDataService = new MarketDataService()
