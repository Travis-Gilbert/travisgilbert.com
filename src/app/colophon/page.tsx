import type { Metadata } from 'next';
import RoughLine from '@/components/rough/RoughLine';
import RoughBox from '@/components/rough/RoughBox';
import SketchIcon from '@/components/rough/SketchIcon';

export const metadata: Metadata = {
  title: 'Colophon',
  description: 'About this site: design decisions, tech stack, and philosophy.',
};

export default function ColophonPage() {
  return (
    <>
      <section className="py-8">
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <SketchIcon name="info" size={32} color="var(--color-terracotta)" />
          Colophon
        </h1>
        <p className="text-ink-secondary mb-8">
          About this site and the thinking behind it.
        </p>
      </section>

      <div className="space-y-8 max-w-2xl">
        <section>
          <h2 className="font-title text-xl font-bold mb-3">
            Why It Looks This Way
          </h2>
          <p className="leading-relaxed">
            This site is designed to feel like a patent drawing come to life
            : warm parchment, india ink, and the careful precision of
            technical documentation. The dot-grid background, hand-drawn accent,
            and editorial typography are deliberate. They signal that this is a
            working space for someone who reads footnotes and visits primary
            sources.
          </p>
          <p className="leading-relaxed">
            The aesthetic borrows from engineering notebooks, architectural
            blueprints, and field journals. If the site feels like something
            you&apos;d find on a drafting table rather than in a boardroom,
            that&apos;s the intention.
          </p>
        </section>

        <RoughLine />

        <section>
          <h2 className="font-title text-xl font-bold mb-3">Tech Stack</h2>
          <RoughBox padding={20} tint="teal">
            <ul className="space-y-2 list-none p-0 m-0 font-mono text-sm">
              <li>
                <strong>Framework:</strong> Next.js 15 (static site generation)
              </li>
              <li>
                <strong>Styling:</strong> Tailwind CSS v4 + CSS custom properties
              </li>
              <li>
                <strong>Hand-drawn elements:</strong> rough.js + rough-notation
                (sparingly)
              </li>
              <li>
                <strong>Interactive components:</strong> React 19
              </li>
              <li>
                <strong>Fonts:</strong> Vollkorn, Cabin, Ysabeau, IBM Plex Sans,
                Courier Prime, Space Mono
              </li>
              <li>
                <strong>Icons:</strong> Phosphor
              </li>
              <li>
                <strong>Hosting:</strong> Vercel
              </li>
              <li>
                <strong>Content:</strong> Markdown files, no CMS
              </li>
            </ul>
          </RoughBox>
        </section>

        <section>
          <h2 className="font-title text-xl font-bold mb-3">Typography</h2>
          <p className="leading-relaxed">
            The site uses three typography systems that shift by context.{' '}
            <strong className="font-title">Vollkorn</strong> carries editorial
            weight in headings: a sturdy, old-style serif that grounds
            every page title. <strong>Cabin</strong> handles most body text as a
            humanist sans that shows the calligrapher&apos;s hand without
            shouting about it.
          </p>
          <p className="leading-relaxed">
            For investigations and technical pages,{' '}
            <strong>IBM Plex Sans</strong> steps in as the body face,
            more clinical, more precise. Labels and metadata are always set in{' '}
            <span className="font-mono text-sm">Courier Prime</span>:
            uppercase, tracked, monospaced, evoking typewritten case
            files and document stamps.
          </p>
          <p className="leading-relaxed">
            The toolkit pages use{' '}
            <strong className="font-title-alt">Ysabeau</strong>, a glyphic
            humanist sans that suggests letters chiseled into stone. It gives
            those pages an architectural, structural feel distinct from the
            editorial warmth elsewhere.
          </p>
        </section>

        <section>
          <h2 className="font-title text-xl font-bold mb-3">
            Design Philosophy
          </h2>
          <p className="leading-relaxed">
            Every design decision on this site was made with the same question
            in mind: does this serve the content, or does it serve the ego of
            the designer? Ornament for its own sake is out. Warmth and texture
            that invite you to read are in.
          </p>
          <p className="leading-relaxed">
            The hand-drawn underline on the homepage is the only rough.js
            element that&apos;s truly decorative, and it&apos;s a
            statement. It says: this work is in progress. The ideas are real,
            but they&apos;re still being shaped. Nothing here pretends to be
            final.
          </p>
        </section>

        <section>
          <h2 className="font-title text-xl font-bold mb-3">Credits</h2>
          <p className="leading-relaxed">
            Built with{' '}
            <a href="https://nextjs.org">Next.js</a>, styled
            with <a href="https://tailwindcss.com">Tailwind CSS</a>, illustrated
            with <a href="https://roughjs.com">rough.js</a> by Preet Shihn.
            Fonts self-hosted via next/font. Hosting by Vercel.
          </p>
          <p className="leading-relaxed">
            The site was largely built with Claude Code, which means an
            AI wrote most of the markup, but a human made all the design
            decisions. That distinction matters.
          </p>
        </section>
      </div>
    </>
  );
}
