'use client';

import { useCallback, useEffect, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Galley } from '@travis-gilbert/markdown-theory/react';
import { parchment } from '@travis-gilbert/markdown-theory/tokens';
import {
  isTauri,
  keepDocument,
  readDocument,
  readerReady,
  type KeepDocumentReceipt,
  type ReadDocumentResult,
} from '@/lib/desktop';
import styles from './OpenWithReader.module.css';

const REGISTER = parchment();
let pendingReaderReady: Promise<string[]> | undefined;

interface DocumentState {
  path: string;
  document: ReadDocumentResult | null;
  error: string | null;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? path;
}

function drainReaderQueue(): Promise<string[]> {
  pendingReaderReady ??= readerReady().finally(() => {
    window.setTimeout(() => {
      pendingReaderReady = undefined;
    }, 0);
  });
  return pendingReaderReady;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function OpenWithReader() {
  const [paths, setPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [documentState, setDocumentState] = useState<DocumentState | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [keepError, setKeepError] = useState<{ path: string; message: string } | null>(
    null,
  );
  const [kept, setKept] = useState<{
    path: string;
    receipt: KeepDocumentReceipt;
  } | null>(null);
  const [isKeeping, setIsKeeping] = useState(false);

  const activeDocument =
    documentState?.path === activePath ? documentState.document : null;
  const readError = documentState?.path === activePath ? documentState.error : null;
  const activeKeepError = keepError?.path === activePath ? keepError.message : null;
  const error = readError ?? activeKeepError;
  const keptReceipt = kept?.path === activePath ? kept.receipt : null;
  const isLoading = activePath !== null && documentState?.path !== activePath;

  const addPaths = useCallback((incoming: readonly string[]): void => {
    const validPaths = incoming.filter(Boolean);
    if (validPaths.length === 0) return;

    setPaths((current) => [
      ...current,
      ...validPaths.filter((path) => !current.includes(path)),
    ]);
    setActivePath((current) => current ?? validPaths[0] ?? null);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    let stopListening: UnlistenFn | undefined;

    async function initialize(): Promise<void> {
      try {
        stopListening = await listen<string[]>('file-opened', (event) => {
          addPaths(event.payload ?? []);
        });
        if (cancelled) {
          stopListening();
          return;
        }

        const initialPaths = await drainReaderQueue();
        if (!cancelled) addPaths(initialPaths);
      } catch (initializationError) {
        if (!cancelled) setInitializationError(errorMessage(initializationError));
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      stopListening?.();
    };
  }, [addPaths]);

  useEffect(() => {
    if (!activePath) return;

    let cancelled = false;

    void readDocument(activePath)
      .then((result) => {
        if (!cancelled) {
          setDocumentState({ path: activePath, document: result, error: null });
        }
      })
      .catch((readError: unknown) => {
        if (!cancelled) {
          setDocumentState({
            path: activePath,
            document: null,
            error: errorMessage(readError),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePath]);

  async function handleKeep(): Promise<void> {
    if (!activeDocument) return;

    setIsKeeping(true);
    setKeepError(null);
    try {
      const receipt = await keepDocument({
        path: activeDocument.path,
        content: activeDocument.content,
        relevance: 'memory',
        title: basename(activeDocument.path),
      });
      setKept({ path: activeDocument.path, receipt });
    } catch (keepError) {
      setKeepError({ path: activeDocument.path, message: errorMessage(keepError) });
    } finally {
      setIsKeeping(false);
    }
  }

  if (paths.length === 0) {
    return (
      <main className={styles.empty}>
        <h1 className={styles.emptyTitle}>CommonPlace Reader</h1>
        <p className={styles.emptyBody}>
          Open a Markdown file with CommonPlace to read it here. Its frontmatter
          selects the typesetting recipe; keep it to fold it into memory.
        </p>
        {!isTauri() && (
          <p className={styles.emptyHint}>
            Open-With is available in the CommonPlace desktop app.
          </p>
        )}
        {initializationError && (
          <p className={`${styles.status} ${styles.error}`} role="alert">
            {initializationError}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className={styles.reader}>
      {paths.length > 1 && (
        <nav className={styles.tabs} aria-label="Open documents">
          {paths.map((path) => (
            <button
              key={path}
              type="button"
              className={`${styles.tab} ${path === activePath ? styles.activeTab : ''}`}
              onClick={() => setActivePath(path)}
              title={path}
            >
              {basename(path)}
            </button>
          ))}
        </nav>
      )}

      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.filename}>
            {activePath ? basename(activePath) : ''}
          </span>
          {activeDocument?.okfBundleCandidate && (
            <span className={styles.badge}>OKF bundle</span>
          )}
          {activeDocument?.insideWorkspace && (
            <span className={`${styles.badge} ${styles.quietBadge}`}>workspace</span>
          )}
        </div>
        {keptReceipt ? (
          <span className={styles.kept}>
            Kept as {keptReceipt.kind} ({keptReceipt.docId})
          </span>
        ) : (
          <button
            type="button"
            className={styles.keepButton}
            onClick={() => void handleKeep()}
            disabled={isKeeping || !activeDocument || activeDocument.isDir}
          >
            {isKeeping ? 'Keeping…' : 'Keep in memory'}
          </button>
        )}
      </header>

      <section className={styles.body} aria-live="polite">
        {isLoading && <p className={styles.status}>Reading…</p>}
        {error && (
          <p className={`${styles.status} ${styles.error}`} role="alert">
            {error}
          </p>
        )}
        {activeDocument &&
          !isLoading &&
          !error &&
          (activeDocument.isDir ? (
            <div className={styles.notice}>
              <p>
                This is an OKF bundle
                {activeDocument.okfBundleCandidate ? ' candidate' : ''}. Bundle import
                runs through the OKF bridge; the reader shows single documents.
              </p>
              <p className={styles.path}>{activeDocument.path}</p>
            </div>
          ) : activeDocument.content.trim() ? (
            <article className={styles.sheet}>
              <Galley doc={activeDocument.content} register={REGISTER} />
            </article>
          ) : (
            <p className={styles.status}>This document is empty.</p>
          ))}
      </section>
    </main>
  );
}
