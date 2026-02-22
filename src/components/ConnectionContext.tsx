'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ConnectionContextValue {
  highlightedId: string | null;
  setHighlightedId: (id: string | null) => void;
  toggleHighlight: (id: string) => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  highlightedId: null,
  setHighlightedId: () => {},
  toggleHighlight: () => {},
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const toggleHighlight = useCallback((id: string) => {
    setHighlightedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <ConnectionContext.Provider value={{ highlightedId, setHighlightedId, toggleHighlight }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnectionHighlight() {
  return useContext(ConnectionContext);
}
