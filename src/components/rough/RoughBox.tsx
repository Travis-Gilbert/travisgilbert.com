import { useRef, useEffect, type ComponentChildren } from 'preact/hooks';
import rough from 'roughjs';

interface Props {
  children: ComponentChildren;
  padding?: number;
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  seed?: number;
}

export default function RoughBox({
  children,
  padding = 16,
  roughness = 1.2,
  strokeWidth = 1,
  stroke = '#3A3632',
  seed,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function draw() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas!);
      rc.rectangle(2, 2, w - 4, h - 4, {
        roughness,
        strokeWidth,
        stroke,
        bowing: 1,
        seed,
      });
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    observer.observe(container);

    return () => observer.disconnect();
  }, [roughness, strokeWidth, stroke, seed]);

  return (
    <div ref={containerRef} class="relative" style={{ padding: `${padding}px` }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        class="absolute inset-0 pointer-events-none"
      />
      <div class="relative z-10">{children}</div>
    </div>
  );
}
