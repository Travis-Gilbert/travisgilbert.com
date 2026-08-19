import type { Metadata } from 'next';
import { Cabin, IBM_Plex_Mono, Vollkorn } from 'next/font/google';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { profile } from '@/lib/profile';
import './globals.css';

const vollkorn = Vollkorn({
  subsets: ['latin'],
  variable: '--font-title',
  display: 'swap',
});

const cabin = Cabin({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: profile.name,
    template: `%s | ${profile.name}`,
  },
  description: profile.blurb,
  metadataBase: new URL(profile.siteUrl),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${vollkorn.variable} ${cabin.variable} ${plexMono.variable}`}>
      <body>
        <div className="site-shell">
          <SiteHeader />
          <main id="main-content" className="site-main">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
