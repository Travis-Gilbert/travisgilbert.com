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
  /** Intrinsic width in px */
  width: number;
  /** Intrinsic height in px */
  height: number;
  /** Rotation in degrees */
  rotate?: number;
  /** z-index layer (higher = on top) */
  z?: number;
  /** Opacity (0 to 1) */
  opacity?: number;
  /** Optional CSS filter override (default: drop-shadow) */
  filter?: string;
  /** Hide on mobile (screens below lg breakpoint) */
  hideOnMobile?: boolean;
}

// Collage fragments: layered visual references on the dark hero ground.
// Cutout images (transparent bg) feel like objects on a desk.
// Rectangle images feel like prints or clippings laid flat.
//
// Layout zones (desktop, max-w-6xl = 1152px centered):
//   Left edge (0..10%): bleeds off left, partially visible
//   Left content (10..42%): name + tagline area, fragments go BEHIND text (z < 10)
//   Center gap (42..52%): 118px spacer
//   Right content (52..90%): NowPreview area
//   Right edge (90..100%): bleeds off right
//   Top/bottom edges: fragments can peek above/below the content zone
const FRAGMENTS: CollageFragment[] = [
  // Architectural watercolor: large rectangle, upper-right, slight tilt.
  // Sits behind the NowPreview text as a background texture.
  {
    src: '/collage/architectural-watercolor.png',
    alt: 'Watercolor rendering of arched architectural corridors',
    left: '68%',
    top: '3%',
    width: 350,
    height: 350,
    rotate: 2.5,
    z: 1,
    opacity: 0.25,
    hideOnMobile: true,
  },
  // Urban design diagram: medium rectangle, lower-left, tucked under name area.
  {
    src: '/collage/urban-design-diagram.png',
    alt: 'Street design diagram showing curb extensions and bike lanes',
    left: '2%',
    top: '38%',
    width: 260,
    height: 234,
    rotate: -3,
    z: 2,
    opacity: 0.3,
    hideOnMobile: true,
  },
  // Raspberry Pi: cutout, right side, mid-height. Tech object floating free.
  {
    src: '/collage/raspberry-pi.png',
    alt: 'Raspberry Pi single-board computer with cables',
    left: '78%',
    top: '58%',
    width: 220,
    height: 108,
    rotate: -5,
    z: 4,
    opacity: 0.7,
    hideOnMobile: true,
  },
  // Dragon illustration: tall cutout, far left edge, partially off-screen.
  // Creates depth by bleeding past the boundary.
  {
    src: '/collage/dragon-illustration.png',
    alt: 'Ink and gold leaf dragon illustration by Alvia Alcedo',
    left: '-3%',
    top: '8%',
    width: 160,
    height: 234,
    rotate: 4,
    z: 3,
    opacity: 0.45,
    hideOnMobile: true,
  },
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
              className={`absolute ${frag.hideOnMobile ? 'hidden lg:block' : ''}`}
              style={{
                left: frag.left,
                top: frag.top,
                width: frag.width,
                transform: frag.rotate ? `rotate(${frag.rotate}deg)` : undefined,
                zIndex: frag.z ?? 1,
                opacity: frag.opacity ?? 0.85,
                filter: frag.filter ?? 'drop-shadow(2px 4px 8px rgba(0,0,0,0.3))',
              }}
            >
              <Image
                src={frag.src}
                alt={frag.alt}
                width={frag.width}
                height={frag.height}
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
                fontFamily: 'var(--font-title)',
                fontWeight: 700,
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
