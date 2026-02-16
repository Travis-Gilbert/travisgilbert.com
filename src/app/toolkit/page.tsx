import type { Metadata } from 'next';
import { getCollection, renderMarkdown } from '@/lib/content';
import type { ToolkitEntry } from '@/lib/content';
import SectionLabel from '@/components/SectionLabel';
import ToolkitAccordion from '@/components/ToolkitAccordion';
import SketchIcon from '@/components/rough/SketchIcon';

export const metadata: Metadata = {
  title: 'Toolkit',
  description: 'How I work: tools, processes, and philosophy.',
};

const categories = [
  { key: 'production', label: 'Production Workflow' },
  { key: 'tools', label: 'Tools I Use' },
  { key: 'philosophy', label: 'How I Think About Design' },
  { key: 'automation', label: 'AI & Automation' },
] as const;

export default async function ToolkitPage() {
  const toolkitItems = getCollection<ToolkitEntry>('toolkit').sort(
    (a, b) => a.data.order - b.data.order
  );

  // Pre-render all markdown content
  const renderedItems = await Promise.all(
    toolkitItems.map(async (item) => ({
      slug: item.slug,
      title: item.data.title,
      category: item.data.category,
      html: await renderMarkdown(item.body),
    }))
  );

  return (
    <>
      <section className="py-8">
        <SectionLabel color="terracotta">Workshop Tools</SectionLabel>
        <h1 className="font-title-alt text-3xl md:text-4xl font-semibold mb-2 flex items-center gap-3">
          <SketchIcon name="wrench" size={32} color="var(--color-terracotta)" />
          Toolkit
        </h1>
        <p className="text-ink-secondary mb-8">
          How I work: tools, processes, and philosophy.
        </p>
      </section>

      {categories.map((cat) => {
        const items = renderedItems.filter(
          (item) => item.category === cat.key
        );
        if (items.length === 0) return null;

        return (
          <section key={cat.key} className="mb-12">
            <h2 className="font-title-alt text-2xl font-semibold mb-6">
              {cat.label}
            </h2>
            <ToolkitAccordion items={items} />
          </section>
        );
      })}
    </>
  );
}
