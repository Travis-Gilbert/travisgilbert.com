// SOURCING: none: pure logic, no upstream component applies
/**
 * GET /api/graph: the full workspace graph artifact.
 * Live upstream when a harness URL is configured, committed fallback
 * otherwise. Same shape either way.
 */

import { loadAtlas } from '@/lib/workspace-graph';

export const revalidate = 3600;

export async function GET() {
  return Response.json(await loadAtlas());
}
