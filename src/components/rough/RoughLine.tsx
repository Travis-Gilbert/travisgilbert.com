'use client';

import { useRef, useEffect, useCallback } from 'react';
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

/**
 * Draw a single rough.js horizontal line onto the given canvas,
 * fitting the width of the wrapper element.
 */
function drawSegment(
  canvas: HTMLCanvasElement,
  wrapper: HTMLElement,
  options: { roughness: number; strokeWidth: number; stroke: string; seed?: number },
) {
  const rect = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = 8;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const rc = rough.canvas(canvas);
  rc.line(0, h / 2, w, h / 2, {
    roughness: options.roughness,
    strokeWidth: options.strokeWidth,
    stroke: options.stroke,
    bowing: 1,
    seed: options.seed,
  });
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
  // Refs for the unlabeled (single line) variant
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Refs for the labeled (two segment) variant
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const leftWrapperRef = useRef<HTMLDivElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightWrapperRef = useRef<HTMLDivElement>(null);

  const drawOpts = { roughness, strokeWidth, stroke, seed };

  // Draw both segments for the labeled variant
  const drawLabeled = useCallback(() => {
    if (leftCanvasRef.current && leftWrapperRef.current) {
      drawSegment(leftCanvasRef.current, leftWrapperRef.current, drawOpts);
    }
    if (rightCanvasRef.current && rightWrapperRef.current) {
      // Offset seed so the two halves look like different hand strokes
      drawSegment(rightCanvasRef.current, rightWrapperRef.current, {
        ...drawOpts,
        seed: drawOpts.seed != null ? drawOpts.seed + 7 : undefined,
      });
    }
  }, [roughness, strokeWidth, stroke, seed]);

  // Draw the single line for the unlabeled variant
  const drawSingle = useCallback(() => {
    if (canvasRef.current && wrapperRef.current) {
      drawSegment(canvasRef.current, wrapperRef.current, drawOpts);
    }
  }, [roughness, strokeWidth, stroke, seed]);

  // Effect: labeled variant
  useEffect(() => {
    if (!label) return;
    drawLabeled();

    const observer = new ResizeObserver(() => drawLabeled());
    if (leftWrapperRef.current) observer.observe(leftWrapperRef.current);
    if (rightWrapperRef.current) observer.observe(rightWrapperRef.current);

    return () => observer.disconnect();
  }, [label, drawLabeled]);

  // Effect: unlabeled variant
  useEffect(() => {
    if (label) return;
    drawSingle();

    const observer = new ResizeObserver(() => drawSingle());
    if (wrapperRef.current) observer.observe(wrapperRef.current);

    return () => observer.disconnect();
  }, [label, drawSingle]);

  if (label) {
    return (
      <div className={`w-full my-8 ${className || ''}`}>
        <div className="relative flex items-center">
          {/* Left line segment: rough.js canvas */}
          <div ref={leftWrapperRef} className="flex-1">
            <canvas ref={leftCanvasRef} aria-hidden="true" className="block" />
          </div>
          {/* Center label */}
          <span
            className="px-3 font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap select-none"
            style={{ color: labelColor || 'var(--color-ink-light)' }}
          >
            {label}
          </span>
          {/* Right line segment: rough.js canvas (matching left) */}
          <div ref={rightWrapperRef} className="flex-1">
            <canvas ref={rightCanvasRef} aria-hidden="true" className="block" />
          </div>
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
