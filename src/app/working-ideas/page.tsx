import type { Metadata } from 'next';
import Link from 'next/link';
import { getCollection } from '@/lib/content';
import type { WorkingIdea } from '@/lib/content';
import SectionLabel from '@/components/SectionLabel';
import SketchIcon from '@/components/rough/SketchIcon';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughBox from '@/components/rough/RoughBox';
import ScrollReveal from '@/components/ScrollReveal';

export const metadata: Metadata = {
  title: 'Working Ideas',
  description:
    'Draft essays, half-formed arguments, and ideas still finding their shape.',
};

const STATUS_LABELS: Record<string, string> = {
  seed: 'Seed',
  growing: 'Growing',
  pruning: 'Pruning',
};

export default function WorkingIdeasPage() {
  const ideas = getCollection<WorkingIdea>('working-ideas')
    .filter((i) => !i.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return (
    <>
      <section className="py-8">
        <SectionLabel color="terracotta">Workshop</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <SketchIcon name="gears" size={32} color="var(--color-terracotta)" />
          Working Ideas
        </h1>
        <p className="text-ink-secondary mb-8">
          Draft essays, half-formed arguments, and ideas still finding their shape.
        </p>
      </section>

      <div className="space-y-5">
        {ideas.map((idea) => (
          <ScrollReveal key={idea.slug}>
            <RoughBox padding={20} hover tint="terracotta">
              <Link
                href={`/working-ideas/${idea.slug}`}
                className="block no-underline text-ink hover:text-ink group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-terracotta font-bold">
                    {STATUS_LABELS[idea.data.status] ?? idea.data.status}
                  </span>
                  <span className="text-ink-faint">·</span>
                  <DateStamp date={idea.data.date} />
                </div>
                <h2 className="text-lg font-title font-bold m-0 group-hover:text-terracotta transition-colors">
                  {idea.data.title}
                </h2>
                {idea.data.summary && (
                  <p className="text-sm text-ink-secondary mt-1 mb-0 line-clamp-2">
                    {idea.data.summary}
                  </p>
                )}
              </Link>
              {idea.data.tags.length > 0 && (
                <div className="pt-3 relative z-10">
                  <TagList tags={idea.data.tags} tint="terracotta" />
                </div>
              )}
            </RoughBox>
          </ScrollReveal>
        ))}
      </div>

      {ideas.length === 0 && (
        <p className="text-ink-secondary py-12 text-center">
          No working ideas yet. Check back soon.
        </p>
      )}
    </>
  );
}
