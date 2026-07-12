import type { Metadata } from 'next';
import OpenWithReader from '@/components/commonplace/reader/OpenWithReader';
import '@travis-gilbert/markdown-theory/css';

export const metadata: Metadata = {
  title: 'CommonPlace Reader',
  description: 'Read and keep Markdown documents opened with CommonPlace.',
};

export default function ReaderPage() {
  return <OpenWithReader />;
}
