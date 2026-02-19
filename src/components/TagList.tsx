import Link from 'next/link';
import { slugifyTag } from '@/lib/slugify';

type TagTint = 'terracotta' | 'teal' | 'gold' | 'neutral';

interface TagListProps {
  tags: string[];
  /** Content-type color tint for tags */
  tint?: TagTint;
  /** When true, renders light tags for dark backgrounds (hero zone) */
  inverted?: boolean;
}

const tintStyles: Record<TagTint, string> = {
  neutral: 'border-border text-ink-faint hover:border-terracotta hover:text-terracotta',
  terracotta:
    'border-terracotta/15 text-ink-faint bg-terracotta/[0.04] hover:border-terracotta hover:text-terracotta',
  teal:
    'border-teal/15 text-ink-faint bg-teal/[0.04] hover:border-teal hover:text-teal',
  gold:
    'border-gold/15 text-ink-faint bg-gold/[0.04] hover:border-gold hover:text-gold',
};

const invertedTintStyles: Record<TagTint, string> = {
  neutral: 'border-white/20 text-white/60 hover:border-white/40 hover:text-white/80',
  terracotta:
    'border-terracotta-light/30 text-white/60 bg-terracotta/[0.15] hover:border-terracotta-light/50 hover:text-white/90',
  teal:
    'border-teal-light/30 text-white/60 bg-teal/[0.15] hover:border-teal-light/50 hover:text-white/90',
  gold:
    'border-gold-light/30 text-white/60 bg-gold/[0.15] hover:border-gold-light/50 hover:text-white/90',
};

export default function TagList({ tags, tint = 'neutral', inverted = false }: TagListProps) {
  if (tags.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/tags/${slugifyTag(tag)}`}
            className={`inline-flex items-center font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded transition-colors no-underline ${inverted ? invertedTintStyles[tint] : tintStyles[tint]}`}
          >
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
