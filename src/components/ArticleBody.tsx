'use client';

/**
 * ArticleBody: thin Client Component wrapper for article prose.
 *
 * Exists solely to hold a ref to the prose container. Server Components
 * cannot hold refs (they are DOM-only), so this is the minimal client
 * boundary needed to make paragraph position measurement possible.
 *
 * The prose HTML is sourced from local .md files validated by Zod.
 * dangerouslySetInnerHTML here is equivalent to the same usage in page.tsx.
 */

import { useRef, useCallback, useEffect, useState, type RefObject } from 'react';
import ArticleComments from '@/components/ArticleComments';
import ConnectionDots from '@/components/ConnectionDots';
import type { ContentType } from '@/lib/comments';
import type { PositionedConnection } from '@/lib/connectionEngine';

interface ArticleBodyProps {
  html: string;
  className?: string;
  contentType: ContentType;
  articleSlug: string;
  /** Serializable connection data (computed at build time in the Server Component) */
  positionedConnections?: PositionedConnection[];
  /** When true, ConnectionDots are not rendered (caller handles them externally) */
  hideConnectionDots?: boolean;
  /** Optional external ref for the prose container (shared with AnnotatedArticle) */
  externalProseRef?: RefObject<HTMLDivElement | null>;
}

export default function ArticleBody({
  html,
  className = 'prose',
  contentType,
  articleSlug,
  positionedConnections,
  hideConnectionDots = false,
  externalProseRef,
}: ArticleBodyProps) {
  const internalProseRef = useRef<HTMLDivElement>(null);
  const proseRef = externalProseRef ?? internalProseRef;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const hasHover = window.matchMedia('(hover: hover)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setCanHover(hasHover && !prefersReduced);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!lineRef.current || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    lineRef.current.style.top = `${e.clientY - rect.top}px`;
    lineRef.current.style.opacity = '1';
  }, []);

  const onMouseLeave = useCallback(() => {
    if (!lineRef.current) return;
    lineRef.current.style.opacity = '0';
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="article-body-wrapper"
      style={{ position: 'relative' }}
      onMouseMove={canHover ? onMouseMove : undefined}
      onMouseLeave={canHover ? onMouseLeave : undefined}
    >
      {canHover && (
        <div
          ref={lineRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            height: 1,
            background: 'var(--color-ink-muted)',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 200ms ease',
            zIndex: 5,
          }}
        />
      )}
      <div
        id="article-prose"
        ref={proseRef}
        className={className}
        // Content from trusted local .md files validated by Zod
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {!hideConnectionDots && positionedConnections && positionedConnections.length > 0 && (
        <ConnectionDots
          connections={positionedConnections}
          proseRef={proseRef}
        />
      )}
      <ArticleComments
        proseRef={proseRef as RefObject<HTMLDivElement>}
        contentType={contentType}
        articleSlug={articleSlug}
      />
    </div>
  );
}
