"use client";

import { useEffect, type RefObject } from "react";

/** Draw a 240-bin loudness waveform on a canvas, handling DPI and resize. */
export function useWaveform(ref: RefObject<HTMLCanvasElement>, values: number[] | null): void {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const bins = values ?? placeholder();
      const count = bins.length;
      const barWidth = rect.width / count;
      const mid = rect.height / 2;
      ctx.fillStyle = values ? "rgba(242,242,242,0.55)" : "rgba(242,242,242,0.14)";
      for (let i = 0; i < count; i += 1) {
        const value = Math.max(0, Math.min(1, bins[i] ?? 0));
        const h = Math.max(2, value * (rect.height - 14));
        ctx.fillRect(i * barWidth + 0.5, mid - h / 2, Math.max(1, barWidth - 1.5), h);
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [ref, values]);
}

function placeholder(): number[] {
  const out: number[] = [];
  let v = 0.3;
  for (let i = 0; i < 240; i += 1) {
    v += ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.18;
    v = Math.min(0.85, Math.max(0.12, v * 0.94));
    out.push(v);
  }
  return out;
}
