'use client';

/**
 * EssayHero: Full-bleed editorial header for essay detail pages.
 *
 * Renders a full viewport-width hero with either a YouTube thumbnail or
 * PatternImage as the background, overlaid with a warm dark wash and large
 * cream-colored typography. Mirrors the CollageHero's editorial aesthetic.
 *
 * Reports its height to --hero-height so DotGrid renders cream dots over
 * the dark zone.
 */

import { useRef, useEffect } from 'react';
import PatternImage from '@/components/PatternImage';

interface EssayHeroProps {
  title: string;
  date: Date;
  readingTime: number;
  slug: string;
  youtubeId?: string;
  /** ProgressTracker component passed as a slot */
  progressTracker?: React.ReactNode;
  /** TagList component passed as a slot */
  tags?: React.ReactNode;
  summary?: string;
}

export default function EssayHero({
  title,
  date,
  readingTime,
  slug,
  youtubeId,
  progressTracker,
  tags,
  summary,
}: EssayHeroProps) {
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

  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      ref={heroRef}
      className="relative overflow-hidden"
      style={{
        // Break out of max-w-4xl parent to span full viewport
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        marginTop: 'calc(-1 * var(--main-pad-y, 1.5rem))',
        width: '100vw',
      }}
    >
      {/* Background layer: YouTube thumbnail or PatternImage */}
      <div className="absolute inset-0">
        {youtubeId ? (
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
            alt=""
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
        ) : (
          <div className="w-full h-full">
            <PatternImage
              seed={slug}
              height={400}
              color="var(--color-terracotta)"
              className="!h-full"
            />
          </div>
        )}
      </div>

      {/* Dark overlay for text legibility */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'var(--color-hero-overlay)' }}
      />

      {/* Subtle paper grain on the dark overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.03,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Typography layer */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-16 md:pt-24 pb-10 md:pb-14">
        {/* Date + reading time */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-hero-text-muted)',
            }}
          >
            {formattedDate}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-hero-text-muted)',
            }}
          >
            &middot; {readingTime} min read
          </span>
        </div>

        {/* Title: large, editorial, uncontained */}
        <h1
          className="font-title text-3xl sm:text-4xl md:text-[3.25rem] lg:text-[3.75rem] font-bold leading-[1.1] mb-4"
          style={{ color: 'var(--color-hero-text)' }}
        >
          {title}
        </h1>

        {/* Summary */}
        {summary && (
          <p
            className="text-lg md:text-xl max-w-prose leading-relaxed mb-5"
            style={{ color: 'var(--color-hero-text-muted)' }}
          >
            {summary}
          </p>
        )}

        {/* Tags */}
        {tags && <div className="mb-4">{tags}</div>}

        {/* Progress tracker */}
        {progressTracker && <div>{progressTracker}</div>}
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
