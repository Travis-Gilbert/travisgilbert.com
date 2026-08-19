import type { Metadata } from 'next';
import Prose from '@/components/Prose';
import { getToolkit, renderMarkdown } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Toolkit',
  description: 'How I work: tools, processes, and philosophy.',
};

const categoryLabels: Record<string, string> = {
  production: 'Production',
  tools: 'Tools',
  philosophy: 'Philosophy',
  automation: 'AI and automation',
};

export default async function ToolkitPage() {
  const items = getToolkit();
  const rendered = await Promise.all(
    items.map(async (item) => ({
      ...item,
      html: await renderMarkdown(item.body),
    })),
  );

  return (
    <>
      <p className="kicker terracotta">Workshop</p>
      <h1>Toolkit</h1>
      <p className="lede">How I work: tools, processes, and philosophy.</p>
      {rendered.length === 0 ? (
        <p className="empty">No toolkit notes yet.</p>
      ) : (
        rendered.map((item) => (
          <article key={item.slug} className="toolkit-item">
            <p className="kicker terracotta">
              {categoryLabels[item.data.category] ?? item.data.category}
            </p>
            <h2>{item.data.title}</h2>
            <Prose html={item.html} />
          </article>
        ))
      )}
    </>
  );
}
