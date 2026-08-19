import Link from 'next/link';
import { nav, profile } from '@/lib/profile';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="site-header-inner">
        <Link href="/" className="wordmark">
          {profile.name}
        </Link>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
