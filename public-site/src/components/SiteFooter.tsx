import Link from 'next/link';
import { profile } from '@/lib/profile';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <p className="footer-tagline">{profile.tagline}</p>
      <p>
        &copy; {year} {profile.name}
        <span className="footer-sep" aria-hidden="true">
          {' '}
          ·{' '}
        </span>
        <a href={`mailto:${profile.email}`}>{profile.email}</a>
        <span className="footer-sep" aria-hidden="true">
          {' '}
          ·{' '}
        </span>
        <Link href="/now">Now</Link>
      </p>
    </footer>
  );
}
