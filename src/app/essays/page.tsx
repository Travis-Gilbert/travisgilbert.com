import type { Metadata } from 'next';
import { getCollection } from '@/lib/content';
import type { Essay } from '@/lib/content';
import EssayCard from '@/components/EssayCard';
import SectionLabel from '@/components/SectionLabel';
import SketchIcon from '@/components/rough/SketchIcon';

export const metadata: Metadata = {
  title: 'Essays on ...',
  description:
    'Video essays exploring how design decisions shape human outcomes.',
};

export default function EssaysPage() {
  const essays = getCollection<Essay>('essays')
    .filter((i) => !i.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return (
    <>
      <section className="py-8">
        <SectionLabel color="terracotta">Essays</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <SketchIcon name="file-text" size={32} color="var(--color-terracotta)" />
          Essays on ...
        </h1>
        <p className="text-ink-secondary mb-8">
          Video essays exploring design decisions and their consequences.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {essays.map((essay) => (
          <EssayCard
            key={essay.slug}
            title={essay.data.title}
            summary={essay.data.summary}
            date={essay.data.date}
            youtubeId={essay.data.youtubeId}
            tags={essay.data.tags}
            href={`/essays/${essay.slug}`}
            stage={essay.data.stage}
            slug={essay.slug}
          />
        ))}
      </div>

      {essays.length === 0 && (
        <p className="text-ink-secondary py-12 text-center">
          No essays yet. Check back soon.
        </p>
      )}
    </>
  );
}
