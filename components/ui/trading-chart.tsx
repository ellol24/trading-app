"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";

type Props = {
  from: string; // مثل: "EUR"
  to: string;   // مثل: "USD"
  interval?: "1min" | "5min" | "15min" | "30min" | "1h"; // ✅統一نا على 1h
};

export default function ForexChart({ from, to, interval = "5min" }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: "#0f172a" },
        textColor: "#e2e8f0",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#10b981",
      wickDownColor: "#ef4444",
      wickUpColor: "#10b981",
    });

    chartInstance.current = chart;
    seriesRef.current = series;

    async function loadData() {
      try {
        const apiKey = "7b09c7d862664d38aa07623ef4999974";
        const symbol = `${from}/${to}`;
        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&apikey=${apiKey}&outputsize=100`;

        const res = await fetch(url);
        const data = await res.json();

        if (!data.values) {
          console.error("Twelve Data API error:", data);
          return;
        }

        const candles = data.values.map((item: any) => ({
          time: Math.floor(new Date(item.datetime).getTime() / 1000),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
        }));

        series.setData(candles.reverse());
      } catch (err) {
        console.error("Error fetching forex data:", err);
      }
    }

    loadData();

    const handleResize = () => {
      chart.applyOptions({ width: chartRef.current?.clientWidth || 600 });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [from, to, interval]);

  return <div ref={chartRef} className="w-full h-[400px]" />;
}
