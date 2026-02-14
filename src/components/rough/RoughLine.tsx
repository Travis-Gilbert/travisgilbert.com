import { useRef, useEffect } from 'preact/hooks';
import rough from 'roughjs';

interface Props {
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  seed?: number;
  class?: string;
}

export default function RoughLine({
  roughness = 1.5,
  strokeWidth = 1.5,
  stroke = '#3A3632',
  seed,
  class: className,
}: Props) {
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

  return (
    <div ref={wrapperRef} class={`w-full my-4 ${className || ''}`}>
      <canvas ref={canvasRef} aria-hidden="true" class="block" />
    </div>
  );
}
