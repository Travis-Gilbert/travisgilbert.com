'use client';

import { useRef, useEffect } from 'react';
import rough from 'roughjs';

interface RoughLineProps {
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  seed?: number;
  className?: string;
  /** Architectural label centered on the line */
  label?: string;
  /** Color for the label text (CSS value) */
  labelColor?: string;
}

export default function RoughLine({
  roughness = 1,
  strokeWidth = 1,
  stroke = '#3A3632',
  seed,
  className,
  label,
  labelColor,
}: RoughLineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    function draw() {
      const rect = wrapper!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = 8;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas!);
      rc.line(0, h / 2, w, h / 2, {
        roughness,
        strokeWidth,
        stroke,
        bowing: 1,
        seed,
      });
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [roughness, strokeWidth, stroke, seed]);

  if (label) {
    return (
      <div className={`w-full my-8 ${className || ''}`}>
        <div className="relative flex items-center">
          {/* Left line segment */}
          <div ref={wrapperRef} className="flex-1">
            <canvas ref={canvasRef} aria-hidden="true" className="block" />
          </div>
          {/* Center label */}
          <span
            className="px-3 font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap select-none"
            style={{ color: labelColor || 'var(--color-ink-light)' }}
          >
            {label}
          </span>
          {/* Right line segment — visual only, the canvas stretches via flex */}
          <div
            className="flex-1 h-[1px]"
            style={{ backgroundColor: stroke, opacity: 0.3 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`w-full my-4 ${className || ''}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block" />
    </div>
  );
}
