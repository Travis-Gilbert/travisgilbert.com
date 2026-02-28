'use client';

/**
 * DocumentStamp: circular stamp button for essay utility actions.
 *
 * Fixed bottom-right corner. SVG circle with textPath rim text
 * (essay title). Expands on click to reveal three actions:
 *   1. Print (window.print)
 *   2. Share (navigator.share with clipboard fallback)
 *   3. Copy Link (navigator.clipboard)
 *
 * Hidden below md breakpoint (essays rarely printed on mobile).
 * Respects prefers-reduced-motion (skip rotation animation).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface DocumentStampProps {
  title: string;
}

export default function DocumentStamp({ title }: DocumentStampProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Truncate title for rim text (~40 chars)
  const rimText = title.length > 40
    ? title.slice(0, 38) + '\u2026'
    : title;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
  }, []);

  // Auto-collapse after 4 seconds of no interaction
  const resetCollapseTimer = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  const handleToggle = () => {
    setExpanded((prev) => {
      if (!prev) resetCollapseTimer();
      return !prev;
    });
  };

  const handlePrint = () => {
    window.print();
    setExpanded(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled share sheet
    }
    setExpanded(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
    setExpanded(false);
  };

  // Circle geometry
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const r = 28;

  return (
    <div
      ref={containerRef}
      className="document-stamp hidden md:block"
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 40,
      }}
    >
      {/* Main stamp button */}
      <button
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Close actions' : 'Open essay actions'}
        className="document-stamp-button"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--color-paper)',
          cursor: 'pointer',
          position: 'relative',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'box-shadow 200ms ease',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            animation: prefersReduced ? 'none' : 'stamp-rotate 30s linear infinite',
          }}
        >
          {/* Outer circle with rough-style dasharray */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={1.2}
            strokeDasharray="4 2"
            opacity={0.4}
          />

          {/* Rim text path */}
          <defs>
            <path
              id="stamp-text-path"
              d={`M ${cx},${cy} m -${r - 2},0 a ${r - 2},${r - 2} 0 1,1 ${(r - 2) * 2},0 a ${r - 2},${r - 2} 0 1,1 -${(r - 2) * 2},0`}
            />
          </defs>
          <text
            fill="var(--color-ink-muted)"
            style={{
              fontSize: 6,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            <textPath href="#stamp-text-path" startOffset="0%">
              {rimText}
            </textPath>
          </text>
        </svg>

        {/* Center dot */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'var(--color-terracotta)',
            transition: 'transform 200ms ease',
            ...(expanded ? { transform: 'translate(-50%, -50%) rotate(45deg)', borderRadius: 1, width: 10, height: 2 } : {}),
          }}
        />
      </button>

      {/* Action buttons (revealed on expand) */}
      <div
        style={{
          position: 'absolute',
          bottom: size + 8,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-end',
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 200ms ease, transform 200ms ease',
          pointerEvents: expanded ? 'auto' : 'none',
        }}
      >
        <StampAction label="Print" onClick={handlePrint} icon="print" />
        <StampAction label="Share" onClick={handleShare} icon="share" />
        <StampAction
          label={copied ? 'Copied!' : 'Copy link'}
          onClick={handleCopy}
          icon="link"
        />
      </div>
    </div>
  );
}

/** Individual action button with icon and label */
function StampAction({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: 'print' | 'share' | 'link';
}) {
  return (
    <button
      onClick={onClick}
      className="stamp-action"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px 6px 8px',
        borderRadius: 20,
        border: '1px solid var(--color-border)',
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
    >
      <StampIcon type={icon} />
      {label}
    </button>
  );
}

/** Minimal SVG icons for stamp actions */
function StampIcon({ type }: { type: 'print' | 'share' | 'link' }) {
  const size = 14;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (type === 'print') {
    return (
      <svg {...common}>
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    );
  }

  if (type === 'share') {
    return (
      <svg {...common}>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    );
  }

  // link
  return (
    <svg {...common}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}
