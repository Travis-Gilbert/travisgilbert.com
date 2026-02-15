import { useRef, useEffect, type ComponentChildren } from 'preact/hooks';
import { annotate } from 'rough-notation';

interface Props {
  children: ComponentChildren;
  type?: 'underline' | 'highlight' | 'circle' | 'box' | 'strike-through';
  color?: string;
  animate?: boolean;
  animationDuration?: number;
  strokeWidth?: number;
  show?: boolean;
}

export default function RoughUnderline({
  children,
  type = 'underline',
  color = '#B45A2D',
  animate = true,
  animationDuration = 400,
  strokeWidth = 1.5,
  show = true,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const annotation = annotate(el, {
      type,
      color,
      animate,
      animationDuration,
      strokeWidth,
    });

    if (show) {
      annotation.show();
    }

    return () => annotation.remove();
  }, [type, color, animate, animationDuration, strokeWidth, show]);

  return (
    <span ref={ref} class="inline">
      {children}
    </span>
  );
}
