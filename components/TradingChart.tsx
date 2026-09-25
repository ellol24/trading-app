"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi } from "lightweight-charts";

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  symbol?: string;
  data?: CandleData[];
}

export default function TradingChart({ symbol = "EUR/USD", data = [] }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#0f172a" }, textColor: "#fff" },
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: { timeVisible: true },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      borderUpColor: "#10b981",
      wickUpColor: "#10b981",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      wickDownColor: "#ef4444",
    });

    if (data && data.length > 0) {
      candleSeries.setData(data);
    }

    return () => chart.remove();
  }, [data]);

  return <div ref={containerRef} style={{ width: "100%", height: "400px" }} />;
}
