'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  /** IntersectionObserver threshold (0–1). Default 0.1 */
  threshold?: number;
  /** Delay before animation starts (ms). Use for stagger: index * 80 */
  delay?: number;
  /** Slide-in direction */
  direction?: 'up' | 'left' | 'right' | 'none';
  /** Additional className on the wrapper */
  className?: string;
}

export default function ScrollReveal({
  children,
  threshold = 0.1,
  delay = 0,
  direction = 'up',
  className = '',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion preference — show immediately
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const translate =
    direction === 'up'
      ? 'translateY(24px)'
      : direction === 'left'
        ? 'translateX(-16px)'
        : direction === 'right'
          ? 'translateX(16px)'
          : 'none';

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : translate,
        transition: `opacity 500ms ease-out, transform 500ms ease-out`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
