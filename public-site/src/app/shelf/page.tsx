import type { Metadata } from 'next';
import { getShelf } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Shelf',
  description: 'Books, videos, tools, and other things worth recommending.',
};

export default function ShelfPage() {
  const items = getShelf();

  return (
    <>
      <p className="kicker gold">Reference</p>
      <h1>Shelf</h1>
      <p className="lede">Books, tools, and other things worth keeping nearby.</p>
      {items.length === 0 ? (
        <p className="empty">Nothing on the shelf yet.</p>
      ) : (
        items.map((item) => (
          <article key={item.slug} className="shelf-item">
            <p className="shelf-type">{item.data.type}</p>
            <h2>
              {item.data.url ? (
                <a href={item.data.url} rel="noreferrer">
                  {item.data.title}
                </a>
              ) : (
                item.data.title
              )}
            </h2>
            <p className="meta">{item.data.creator}</p>
            <p>{item.data.annotation}</p>
          </article>
        ))
      )}
    </>
  );
}
