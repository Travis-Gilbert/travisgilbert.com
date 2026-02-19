'use client';

/**
 * CollageHero: Full-bleed dark ground with layered collage fragments
 * and large editorial typography. Used on the homepage.
 *
 * Fragments are photographed desk objects (PNGs with transparency) positioned
 * via CSS absolute positioning + transforms. The component reports its rendered
 * height to --hero-height on <html> so DotGrid can render cream dots over this zone.
 *
 * Initially works without any fragment images (just the dark ground + typography).
 * Add images to public/collage/ and define them in the FRAGMENTS array below.
 */

import { useRef, useEffect } from 'react';
import Image from 'next/image';

interface CollageFragment {
  /** Path relative to public/, e.g. '/collage/hamming-book.png' */
  src: string;
  alt: string;
  /** CSS positioning from left edge (percentage or px) */
  left: string;
  /** CSS positioning from top edge (percentage or px) */
  top: string;
  /** Width in px */
  width: number;
  /** Rotation in degrees */
  rotate?: number;
  /** z-index layer (higher = on top) */
  z?: number;
  /** Opacity (0 to 1) */
  opacity?: number;
}

// Define your collage fragments here. Add items as you photograph them.
// Positions are relative to the hero container.
const FRAGMENTS: CollageFragment[] = [
  // Example (uncomment and adjust when you have the photo):
  // {
  //   src: '/collage/hamming-book.png',
  //   alt: 'The Art of Doing Science and Engineering by Richard Hamming',
  //   left: '60%',
  //   top: '10%',
  //   width: 200,
  //   rotate: -3,
  //   z: 2,
  // },
];

interface CollageHeroProps {
  name: string;
  /** Content counters line, e.g. "4 essays · 12 projects · 8 field notes" */
  countersLabel: string;
  /** Slot for CyclingTagline component */
  tagline: React.ReactNode;
  /** Slot for NowPreviewCompact component */
  nowPreview: React.ReactNode;
}

export default function CollageHero({
  name,
  countersLabel,
  tagline,
  nowPreview,
}: CollageHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  // Report hero height to CSS custom property for DotGrid zone awareness
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    function updateHeight() {
      const height = el!.offsetHeight;
      document.documentElement.style.setProperty('--hero-height', `${height}`);
    }

    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--hero-height');
    };
  }, []);

  return (
    <div
      ref={heroRef}
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--color-hero-ground)',
        // Negative margins: left/right break out of max-w-4xl, top pulls
        // into main's py-6 padding so the dark ground meets the nav edge
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        marginTop: 'calc(-1 * var(--main-pad-y, 1.5rem))',
        width: '100vw',
      }}
    >
      {/* Top edge vignette: darkens toward the top to blend into nav */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: 60,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)',
        }}
      />

      {/* Subtle paper grain on the dark ground */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.03,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Collage fragments layer */}
      {FRAGMENTS.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {FRAGMENTS.map((frag, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: frag.left,
                top: frag.top,
                width: frag.width,
                transform: frag.rotate ? `rotate(${frag.rotate}deg)` : undefined,
                zIndex: frag.z ?? 1,
                opacity: frag.opacity ?? 0.85,
                filter: 'drop-shadow(2px 4px 8px rgba(0,0,0,0.3))',
              }}
            >
              <Image
                src={frag.src}
                alt={frag.alt}
                width={frag.width}
                height={Math.round(frag.width * 1.4)}
                className="w-full h-auto"
                priority
              />
            </div>
          ))}
        </div>
      )}

      {/* Typography layer: sits on top of fragments */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="flex flex-col lg:grid lg:items-end py-12 md:py-16 lg:py-20"
          style={{ gridTemplateColumns: '1fr 118px 1fr' }}
        >
          {/* Left: identity */}
          <div className="flex flex-col justify-end lg:pl-[128px]">
            <h1
              className="text-[2.5rem] sm:text-[3.5rem] md:text-[4rem] lg:text-[4.5rem] m-0"
              style={{
                fontFamily: 'var(--font-name)',
                fontWeight: 400,
                lineHeight: 1.0,
                color: 'var(--color-hero-text)',
              }}
            >
              {name}
            </h1>

            <div className="mt-2">{tagline}</div>

            <p
              className="font-mono mt-4 mb-0"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-hero-text-muted)',
              }}
            >
              {countersLabel}
            </p>
          </div>

          {/* Center spacer: matches the "Essays on ..." label width */}
          <div className="hidden lg:block" aria-hidden="true" />

          {/* Right: /now snapshot */}
          <div className="flex flex-col justify-end mt-6 lg:mt-0">
            {nowPreview}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade to parchment: multi-stop for smoother dissolve */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 120,
          background: `linear-gradient(
            to bottom,
            transparent 0%,
            color-mix(in srgb, var(--color-paper) 15%, transparent) 30%,
            color-mix(in srgb, var(--color-paper) 50%, transparent) 55%,
            color-mix(in srgb, var(--color-paper) 80%, transparent) 75%,
            var(--color-paper) 100%
          )`,
        }}
      />
    </div>
  );
}
