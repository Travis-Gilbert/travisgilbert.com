import Link from 'next/link';
import { slugifyTag } from '@/lib/slugify';

interface TagListProps {
  tags: string[];
}

export default function TagList({ tags }: TagListProps) {
  if (tags.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/tags/${slugifyTag(tag)}`}
            className="inline-flex items-center font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-border text-ink-faint rounded hover:border-terracotta hover:text-terracotta transition-colors no-underline"
          >
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
