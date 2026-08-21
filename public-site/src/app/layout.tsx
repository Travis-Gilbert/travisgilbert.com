import type { Metadata } from 'next';
import { fontVariableClasses } from './fonts';
import DotGrid from '@/components/DotGrid';
import Terminal from '@/components/Terminal';
import TopNav from '@/components/TopNav';
import Footer from '@/components/Footer';
import ConsoleEasterEgg from '@/components/ConsoleEasterEgg';
import ThemeProvider from '@/components/ThemeProvider';
import { PersonJsonLd, WebSiteJsonLd } from '@/components/JsonLd';
import { getCollection } from '@/lib/content';
import { getVisibleNav, getSiteConfig } from '@/lib/siteConfig';
import type { Essay, FieldNote, Project } from '@/lib/content';
import './globals.css';
import '../styles/print.css';

const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);
const projects = getCollection<Project>('projects').filter((p) => !p.data.draft);

const latestEssay = essays.sort(
  (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
)[0];

const visibleNav = getVisibleNav();
const config = getSiteConfig();

export const metadata: Metadata = {
  title: {
    default: 'Travis Gilbert',
    template: config.seo.titleTemplate || '%s | Travis Gilbert',
  },
  description:
    config.seo.description ||
    'Exploring how design decisions shape human outcomes. Essays, field notes, and projects on design, policy, and the built environment.',
  metadataBase: new URL('https://travisgilbert.me'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Travis Gilbert',
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeScript = [
    '(function(){',
    "var t=localStorage.getItem('theme');",
    "if(!t){t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}",
    "document.documentElement.setAttribute('data-theme',t)",
    '})()',
  ].join('');

  return (
    <html lang="en" className={fontVariableClasses} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className="min-h-screen flex flex-col overflow-x-clip"
        style={{ isolation: 'isolate' }}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <PersonJsonLd />
          <WebSiteJsonLd />
          <DotGrid />
          <Terminal />
          <a href="#main-content" className="skip-to-content">
            Skip to content
          </a>
          <TopNav navItems={visibleNav} />
          <main
            id="main-content"
            className="main-content flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-8"
          >
            {children}
          </main>
          <Footer />
          <ConsoleEasterEgg
            essayCount={essays.length}
            fieldNoteCount={fieldNotes.length}
            projectCount={projects.length}
            latestEssayTitle={latestEssay?.data.title ?? ''}
            latestEssaySlug={latestEssay?.slug ?? ''}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
