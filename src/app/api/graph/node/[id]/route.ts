// SOURCING: none: pure logic, no upstream component applies
/**
 * GET /api/graph/node/:id: one object with its transitive neighborhood,
 * current heat, and commit events.
 */

import { atlasHeat, atlasNeighborhood, loadAtlas } from '@/lib/workspace-graph';

export const revalidate = 3600;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const atlas = await loadAtlas();
  const object = atlas.objects.find((o) => o.id === id);
  if (!object) {
    return Response.json({ error: `no object with id ${id}` }, { status: 404 });
  }
  const { ancestors, descendants } = atlasNeighborhood(atlas, id);
  return Response.json({
    object,
    ancestors,
    descendants,
    heat: atlasHeat(atlas, new Date()).get(id) ?? 0,
    events: atlas.events.filter((e) => e.object === id),
  });
}
