'use client';

/**
 * C9's capability badge.
 *
 * The rule C9 sets is that the badge is truthful and that it never claims a
 * residency receipt it does not hold. The honest thing to render on the server
 * is therefore the tree's own value, which says a static projection and claims
 * nothing, because at render time no browser has been asked anything.
 *
 * On mount this asks the actual browser and replaces the text with the answer.
 * That is a report, not a switch: there is nothing here to turn a surface on or
 * off, only a line that says what this machine can do and what it is looking at.
 * When D4's field lands, the second sentence becomes what painted rather than
 * what did not, and the probe below is unchanged.
 */

import { useEffect, useState } from 'react';

export type FieldBackend = 'webgpu' | 'webgl2' | 'none';

/** What the visitor's browser offers, in the order the field would prefer it. */
export function detectBackend(): FieldBackend {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) return 'webgpu';

  if (typeof document !== 'undefined') {
    const probe = document.createElement('canvas');
    // `failIfMajorPerformanceCaveat` keeps a software rasteriser from reporting
    // as a GPU, which would make the badge technically true and practically a lie.
    const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return 'webgl2';
    }
  }

  return 'none';
}

const BACKEND_PHRASE: Record<FieldBackend, string> = {
  webgpu: 'This browser has WebGPU.',
  webgl2: 'This browser has WebGL2 and no WebGPU.',
  none: 'This browser has no GPU renderer.',
};

export default function CapabilityBadge({
  ident,
  initial,
}: {
  ident: string;
  initial: string;
}) {
  const [backend, setBackend] = useState<FieldBackend | null>(null);

  useEffect(() => {
    setBackend(detectBackend());
  }, []);

  const text =
    backend === null
      ? initial
      : `${BACKEND_PHRASE[backend]} Showing the static projection, and claiming no residency.`;

  return (
    <p
      className="font-mono text-[11px] text-ink-light m-0"
      data-ident={ident}
      data-backend={backend ?? 'none'}
      data-residency="false"
    >
      {text}
    </p>
  );
}
