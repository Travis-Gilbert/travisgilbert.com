'use client';

// DotGrid.tsx: Interactive dot grid with radial edge vignette
// React client component · ~2.5 kB gzipped
// Ported from Preact island (preact/hooks to react)
//
// Zone-aware: reads --hero-height CSS custom property from <html> to render
// cream dots over the dark hero ground and dark dots over the parchment below.
// A 50px crossfade band smoothly blends between the two color zones.

import { useEffect, useRef, useCallback } from 'react';

interface DotGridProps {
  dotRadius?: number;
  spacing?: number;
  dotColor?: [number, number, number];
  dotOpacity?: number;
  /** Where the edge fade begins (0 = center, 1 = edge) */
  fadeStart?: number;
  /** Where the fade reaches full transparency */
  fadeEnd?: number;
  stiffness?: number;
  damping?: number;
  influenceRadius?: number;
  repulsionStrength?: number;
}

// Hero zone dot color: cream to match --color-hero-text (#F0EBE4)
const HERO_DOT_COLOR: [number, number, number] = [240, 235, 228];
const HERO_DOT_OPACITY = 0.35;

// Crossfade band height in px: dots within this range blend between zones
const CROSSFADE_BAND = 50;

export default function DotGrid({
  dotRadius = 0.75,
  spacing = 20,
  dotColor = [160, 154, 144],
  dotOpacity = 0.5,
  fadeStart = 0.55,
  fadeEnd = 0.90,
  stiffness = 0.15,
  damping = 0.75,
  influenceRadius = 200,
  repulsionStrength = 15,
}: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const heroHeightRef = useRef<number>(0);

  // Dot state in typed arrays for performance
  const dotsRef = useRef<{
    gx: Float32Array; gy: Float32Array;
    ox: Float32Array; oy: Float32Array;
    vx: Float32Array; vy: Float32Array;
    fade: Float32Array;
    count: number;
  } | null>(null);

  // Read hero height from CSS custom property
  const readHeroHeight = useCallback(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--hero-height')
      .trim();
    heroHeightRef.current = raw ? parseFloat(raw) : 0;
  }, []);

  // Pre-compute elliptical radial fade per dot
  const computeFade = useCallback((
    gx: Float32Array, gy: Float32Array, fade: Float32Array,
    count: number, w: number, h: number,
  ) => {
    const cx = w / 2;
    const cy = h / 2;

    for (let i = 0; i < count; i++) {
      const dx = (gx[i] - cx) / cx;
      const dy = (gy[i] - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= fadeStart) {
        fade[i] = 1;
      } else if (dist >= fadeEnd) {
        fade[i] = 0;
      } else {
        const t = (dist - fadeStart) / (fadeEnd - fadeStart);
        fade[i] = 1 - (t * t * (3 - 2 * t)); // Hermite smoothstep
      }
    }
  }, [fadeStart, fadeEnd]);

  const initDots = useCallback((w: number, h: number) => {
    const cols = Math.ceil(w / spacing) + 1;
    const rows = Math.ceil(h / spacing) + 1;
    const count = cols * rows;

    const gx = new Float32Array(count);
    const gy = new Float32Array(count);

    let idx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        gx[idx] = col * spacing;
        gy[idx] = row * spacing;
        idx++;
      }
    }

    const fade = new Float32Array(count);
    computeFade(gx, gy, fade, count, w, h);

    dotsRef.current = {
      gx, gy,
      ox: new Float32Array(count),
      oy: new Float32Array(count),
      vx: new Float32Array(count),
      vy: new Float32Array(count),
      fade,
      count,
    };
  }, [spacing, computeFade]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let idleFrames = 0;
    let animating = false;

    const isTouchOnly =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initDots(w, h);
      readHeroHeight();
      drawStatic();
    }

    // Compute dot color based on its y position relative to hero zone
    function getDotColor(y: number): { r: number; g: number; b: number; opacity: number } {
      const hh = heroHeightRef.current;
      if (hh <= 0) {
        // No hero zone: use default color
        return { r: dotColor[0], g: dotColor[1], b: dotColor[2], opacity: dotOpacity };
      }

      // DotGrid is position: fixed, so dot y is in viewport space.
      // Hero height is the element's page height. Account for scroll:
      // if hero is 500px tall, after scrolling 300px, the hero boundary
      // in viewport space is at 500 - 300 = 200px.
      const heroBoundary = hh - window.scrollY;

      if (heroBoundary <= 0) {
        // Hero fully scrolled off screen: all dots are parchment zone
        return { r: dotColor[0], g: dotColor[1], b: dotColor[2], opacity: dotOpacity };
      }

      if (y < heroBoundary - CROSSFADE_BAND) {
        // Fully in hero zone
        return {
          r: HERO_DOT_COLOR[0],
          g: HERO_DOT_COLOR[1],
          b: HERO_DOT_COLOR[2],
          opacity: HERO_DOT_OPACITY,
        };
      }

      if (y > heroBoundary + CROSSFADE_BAND) {
        // Fully in parchment zone
        return { r: dotColor[0], g: dotColor[1], b: dotColor[2], opacity: dotOpacity };
      }

      // In crossfade band: linearly interpolate
      const t = (y - (heroBoundary - CROSSFADE_BAND)) / (CROSSFADE_BAND * 2);
      return {
        r: Math.round(HERO_DOT_COLOR[0] + (dotColor[0] - HERO_DOT_COLOR[0]) * t),
        g: Math.round(HERO_DOT_COLOR[1] + (dotColor[1] - HERO_DOT_COLOR[1]) * t),
        b: Math.round(HERO_DOT_COLOR[2] + (dotColor[2] - HERO_DOT_COLOR[2]) * t),
        opacity: HERO_DOT_OPACITY + (dotOpacity - HERO_DOT_OPACITY) * t,
      };
    }

    function drawStatic() {
      const dots = dotsRef.current;
      if (!dots) return;
      ctx!.clearRect(0, 0, w, h);

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const { r, g, b, opacity } = getDotColor(dots.gy[i]);
        const alpha = opacity * dots.fade[i];
        ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx!.beginPath();
        ctx!.arc(dots.gx[i], dots.gy[i], dotRadius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function tick() {
      const dots = dotsRef.current;
      if (!dots) { animRef.current = requestAnimationFrame(tick); return; }

      ctx!.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isActive = mouseRef.current.active;
      const ir2 = influenceRadius * influenceRadius;
      let anyDisplaced = false;

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;

        const baseX = dots.gx[i];
        const baseY = dots.gy[i];

        // Mouse repulsion
        if (isActive) {
          const ddx = (baseX + dots.ox[i]) - mx;
          const ddy = (baseY + dots.oy[i]) - my;
          const d2 = ddx * ddx + ddy * ddy;

          if (d2 < ir2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / influenceRadius) * repulsionStrength;
            dots.vx[i] += (ddx / d) * force * 0.1;
            dots.vy[i] += (ddy / d) * force * 0.1;
          }
        }

        // Spring back + damping
        dots.vx[i] += -dots.ox[i] * stiffness;
        dots.vy[i] += -dots.oy[i] * stiffness;
        dots.vx[i] *= damping;
        dots.vy[i] *= damping;
        dots.ox[i] += dots.vx[i];
        dots.oy[i] += dots.vy[i];

        if (dots.ox[i] * dots.ox[i] + dots.oy[i] * dots.oy[i] > 0.01) {
          anyDisplaced = true;
        }

        // Draw with per-dot zone-aware color + fade alpha
        const drawY = baseY + dots.oy[i];
        const { r, g, b, opacity } = getDotColor(drawY);
        const alpha = opacity * dots.fade[i];
        ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx!.beginPath();
        ctx!.arc(baseX + dots.ox[i], drawY, dotRadius, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!anyDisplaced) {
        idleFrames++;
        if (idleFrames > 60) { animating = false; return; }
      } else {
        idleFrames = 0;
      }

      animRef.current = requestAnimationFrame(tick);
    }

    function startAnimation() {
      if (animating) return;
      animating = true;
      idleFrames = 0;
      animRef.current = requestAnimationFrame(tick);
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
      startAnimation();
    }

    function onMouseLeave() {
      mouseRef.current.active = false;
    }

    // Redraw on scroll so hero zone color boundary updates
    function onScroll() {
      if (!animating) {
        drawStatic();
      }
    }

    // Initialize
    resize();

    if (!isTouchOnly) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (!isTouchOnly) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [dotRadius, spacing, dotColor, dotOpacity, stiffness, damping, influenceRadius, repulsionStrength, initDots, readHeroHeight]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
