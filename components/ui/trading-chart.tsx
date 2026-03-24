"use client";

import { useEffect, useRef, memo } from "react";

type Props = {
  from: string; // e.g. "EUR"
  to: string;   // e.g. "USD"
  interval?: "1min" | "5min" | "15min" | "30min" | "1h";
};

const intervalMap: Record<string, string> = {
  "1min": "1",
  "5min": "5",
  "15min": "15",
  "30min": "30",
  "1h": "60",
};

function ForexChart({ from, to, interval = "5min" }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    
    // Clear previous chart on symbol/interval change to prevent duplicates
    container.current.innerHTML = "";

    const symbol = `FX:${from}${to}`;
    const tvInterval = intervalMap[interval] || "5";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: tvInterval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      backgroundColor: "rgba(15, 23, 42, 1)",
      gridColor: "rgba(30, 41, 59, 1)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: true,
      support_host: "https://www.tradingview.com"
    });

    container.current.appendChild(script);

    return () => {
      // Cleanup on unmount or prop change
      if (container.current) {
        container.current.innerHTML = "";
      }
    };
  }, [from, to, interval]);

  // Give the container a defined height
  return (
    <div className="w-full h-[450px]">
      <div 
        ref={container} 
        className="tradingview-widget-container" 
        style={{ height: "100%", width: "100%" }} 
      />
    </div>
  );
}

// Wrap in memo to prevent unnecessary re-renders when parent state (like balance) changes
export default memo(ForexChart);
