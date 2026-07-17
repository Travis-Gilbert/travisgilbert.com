// SOURCING: none: pure logic, no upstream component applies
/**
 * GET /api/graph/path?from=X&to=Y: ordered depends_on edge chain.
 * No path is a 404, not an empty array: absence is an answer.
 */

import { atlasPath, loadAtlas } from '@/lib/workspace-graph';

export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) {
    return Response.json({ error: 'from and to are required' }, { status: 400 });
  }
  const path = atlasPath(await loadAtlas(), from, to);
  if (!path) {
    return Response.json({ error: `no path from ${from} to ${to}` }, { status: 404 });
  }
  return Response.json({ path });
}
