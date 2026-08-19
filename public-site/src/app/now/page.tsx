import type { Metadata } from 'next';
import { formatDate, getNowData } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Now',
  description: 'What I am currently researching, reading, building, and listening to.',
};

const fields = [
  {
    key: 'researching' as const,
    contextKey: 'researching_context' as const,
    label: 'Researching',
    hint: 'The questions I keep returning to.',
  },
  {
    key: 'reading' as const,
    contextKey: 'reading_context' as const,
    label: 'Reading',
    hint: 'What is on the nightstand right now.',
  },
  {
    key: 'building' as const,
    contextKey: 'building_context' as const,
    label: 'Building',
    hint: 'Active projects.',
  },
  {
    key: 'listening' as const,
    contextKey: 'listening_context' as const,
    label: 'Listening to',
    hint: 'Podcasts, albums, and conversations.',
  },
];

export default function NowPage() {
  const data = getNowData();
  if (!data) {
    return (
      <>
        <h1>Now</h1>
        <p className="empty">No now snapshot yet.</p>
      </>
    );
  }

  return (
    <>
      <p className="kicker terracotta">Snapshot</p>
      <h1>Now</h1>
      <p className="lede">A snapshot of where my attention is right now.</p>
      <p className="meta">Updated {formatDate(new Date(data.updated))}</p>
      <dl className="now-fields">
        {fields.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>
              {data[field.key]}
              {data[field.contextKey] && (
                <span className="context">{data[field.contextKey]}</span>
              )}
              <span className="context">{field.hint}</span>
            </dd>
          </div>
        ))}
      </dl>
      {data.thinking && (
        <aside className="now-panel" style={{ marginTop: '2rem' }}>
          <p className="kicker terracotta">Thinking about</p>
          <p style={{ margin: 0 }}>{data.thinking}</p>
        </aside>
      )}
      <p className="lede" style={{ marginTop: '2rem' }}>
        Inspired by{' '}
        <a href="https://nownownow.com/about" rel="noreferrer">
          the /now page movement
        </a>
        . This page is updated manually whenever something shifts.
      </p>
    </>
  );
}
