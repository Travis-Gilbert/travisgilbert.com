"""
Backlink computation service.

Backlinks are computed, not stored. Two content pieces are backlinked
when they share at least one Source via SourceLink. This avoids
synchronization overhead for a small-scale personal site.
"""

from collections import defaultdict

from .models import SourceLink


def get_backlinks(content_type, content_slug):
    """
    Find all content pieces that share sources with the given content.

    Returns a list of dicts:
        [
            {
                "content_type": "field_note",
                "content_slug": "walkability-audit",
                "content_title": "Walkability Audit",
                "shared_sources": [
                    {"source_id": 1, "source_title": "The Death and Life..."}
                ],
            },
            ...
        ]
    """
    # Step 1: Find all source IDs linked to this content
    my_source_ids = set(
        SourceLink.objects.filter(
            content_type=content_type,
            content_slug=content_slug,
        ).values_list('source_id', flat=True)
    )

    if not my_source_ids:
        return []

    # Step 2: Find other SourceLinks that share those sources,
    # excluding the content piece itself
    shared_links = (
        SourceLink.objects
        .filter(source_id__in=my_source_ids)
        .exclude(content_type=content_type, content_slug=content_slug)
        .select_related('source')
    )

    # Step 3: Group by target content piece, collecting shared sources
    backlinks = defaultdict(lambda: {
        'content_type': '',
        'content_slug': '',
        'content_title': '',
        'shared_sources': [],
    })

    for link in shared_links:
        key = (link.content_type, link.content_slug)
        entry = backlinks[key]
        entry['content_type'] = link.content_type
        entry['content_slug'] = link.content_slug
        entry['content_title'] = link.content_title
        entry['shared_sources'].append({
            'source_id': link.source_id,
            'source_title': link.source.title,
        })

    return list(backlinks.values())


def get_all_backlinks():
    """
    Compute the full backlink graph for publishing to static JSON.

    Returns a dict keyed by "content_type:content_slug":
        {
            "essay:housing-crisis": [
                {"content_type": "field_note", "content_slug": "walkability", ...}
            ],
            ...
        }
    """
    # Get all source links with their sources in two queries
    all_links = list(
        SourceLink.objects
        .select_related('source')
        .order_by('content_type', 'content_slug')
    )

    # Build a mapping: source_id -> list of content pieces linking it
    source_to_content = defaultdict(list)
    for link in all_links:
        source_to_content[link.source_id].append(link)

    # For each content piece, find all other content pieces sharing sources
    graph = defaultdict(lambda: defaultdict(list))

    for source_id, links in source_to_content.items():
        if len(links) < 2:
            continue
        # Every pair of links sharing this source creates a bidirectional backlink
        for i, link_a in enumerate(links):
            for link_b in links[i + 1:]:
                key_a = f'{link_a.content_type}:{link_a.content_slug}'
                key_b = f'{link_b.content_type}:{link_b.content_slug}'
                source_info = {
                    'source_id': source_id,
                    'source_title': link_a.source.title,
                }
                graph[key_a][(link_b.content_type, link_b.content_slug)].append(source_info)
                graph[key_b][(link_a.content_type, link_a.content_slug)].append(source_info)

    # Flatten into the output format
    result = {}
    for content_key, linked in graph.items():
        result[content_key] = [
            {
                'content_type': ct,
                'content_slug': cs,
                'shared_sources': sources,
            }
            for (ct, cs), sources in linked.items()
        ]

    return result
