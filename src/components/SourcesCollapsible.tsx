'use client';

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { CaretDown } from '@phosphor-icons/react';

interface Source {
  title: string;
  url: string;
}

interface SourcesCollapsibleProps {
  sources: Source[];
}

export default function SourcesCollapsible({ sources }: SourcesCollapsibleProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="py-6">
      <Collapsible.Trigger className="group flex w-full items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-left font-title text-xl font-bold text-ink hover:text-terracotta transition-colors">
        <span>Sources &amp; Further Reading</span>
        <span className="font-mono text-xs text-ink-muted font-normal">({sources.length})</span>
        <CaretDown
          size={16}
          weight="bold"
          className="text-ink-muted flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-[slideDown_200ms_ease-out] data-[state=closed]:animate-[slideUp_200ms_ease-out]">
        <ul className="list-none p-0 space-y-2 mt-4">
          {sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm hover:text-terracotta-hover"
              >
                {source.title}{' '}
                <span className="text-xs">&#8599;</span>
              </a>
            </li>
          ))}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
