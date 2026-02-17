'use client';

/**
 * DrawOnIcon: Animated variant of SketchIcon that draws its stroke on scroll.
 *
 * Uses the pathLength="1" technique to normalize stroke length, then transitions
 * stroke-dashoffset from 1 (hidden) to 0 (fully drawn) when the icon enters
 * the viewport via IntersectionObserver.
 *
 * Designed for section header icons (size=32). Nav icons should continue using
 * SketchIcon (always visible, no animation needed).
 *
 * Respects prefers-reduced-motion: shows the icon immediately without animation.
 */

import { useRef, useEffect, useState } from 'react';
import { ICON_PATHS } from './SketchIcon';
import type { IconName } from './SketchIcon';

interface DrawOnIconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  /** Duration of the stroke draw animation in ms */
  duration?: number;
  /** Delay before animation starts in ms (useful for stagger) */
  delay?: number;
}

export default function DrawOnIcon({
  name,
  size = 32,
  color = 'currentColor',
  className = '',
  duration = 800,
  delay = 0,
}: DrawOnIconProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    // Respect reduced motion: show immediately
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      setSkipAnimation(true);
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d={ICON_PATHS[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={drawn ? 0 : 1}
        style={
          skipAnimation
            ? undefined
            : {
                transition: `stroke-dashoffset ${duration}ms ease-out ${delay}ms`,
              }
        }
      />
    </svg>
  );
}
