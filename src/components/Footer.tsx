export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-mono text-ink-secondary">
        <p className="m-0">
          &copy; {currentYear}{' '}
          <span style={{ fontFamily: 'var(--font-name)', fontWeight: 400 }}>
            Travis Gilbert
          </span>
        </p>
        <nav className="flex items-center gap-4">
          <a href="/rss.xml" className="hover:text-terracotta">
            RSS
          </a>
          <span className="text-border">|</span>
          <span>Built with Next.js &amp; too much coffee</span>
        </nav>
      </div>
    </footer>
  );
}
