import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border-light py-8 px-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-mono text-ink-light">
        <p className="m-0" style={{ fontSize: 12 }}>
          &copy; {currentYear}{' '}
          <span
            className="text-ink-muted"
            style={{ fontFamily: 'var(--font-name)', fontWeight: 400 }}
          >
            Travis Gilbert
          </span>
        </p>
        <nav aria-label="Footer navigation" className="flex items-center gap-4">
          <a
            href="/rss.xml"
            aria-label="RSS Feed"
            className="text-ink-light hover:text-terracotta no-underline"
            style={{ fontSize: 11 }}
          >
            RSS
          </a>
          <span className="text-border-light">|</span>
          <Link
            href="/colophon"
            className="text-terracotta hover:text-terracotta-hover no-underline"
            style={{ fontSize: 11 }}
          >
            How this site was built &rarr;
          </Link>
        </nav>
      </div>
    </footer>
  );
}
