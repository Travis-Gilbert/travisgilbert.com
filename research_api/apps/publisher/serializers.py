"""
JSON serializers for publishing research data to the Next.js repo.

These produce the JSON structures consumed by the Next.js site.
Field names use camelCase to match JavaScript conventions.
"""

import json


def serialize_source(source):
    """Serialize a Source instance for static JSON."""
    data = {
        'id': source.id,
        'title': source.title,
        'slug': source.slug,
        'creator': source.creator,
        'sourceType': source.source_type,
        'url': source.url,
        'publication': source.publication,
        'datePublished': (
            source.date_published.isoformat()
            if source.date_published else None
        ),
        'dateEncountered': (
            source.date_encountered.isoformat()
            if source.date_encountered else None
        ),
        'publicAnnotation': source.public_annotation,
        'keyFindings': source.key_findings or [],
        'tags': source.tags or [],
        'linkCount': source.link_count if hasattr(source, 'link_count') else 0,
    }
    # Include location only when present
    if source.location_name:
        data['locationName'] = source.location_name
        data['latitude'] = float(source.latitude) if source.latitude else None
        data['longitude'] = float(source.longitude) if source.longitude else None
    return data


def serialize_link(link):
    """Serialize a SourceLink for static JSON."""
    return {
        'sourceId': link.source_id,
        'sourceTitle': link.source.title if link.source_id else '',
        'sourceSlug': link.source.slug if link.source_id else '',
        'contentType': link.content_type,
        'contentSlug': link.content_slug,
        'contentTitle': link.content_title,
        'role': link.role,
        'keyQuote': link.key_quote,
        'dateLinked': (
            link.date_linked.isoformat() if link.date_linked else None
        ),
    }


def serialize_thread(thread, include_entries=True):
    """Serialize a ResearchThread for static JSON."""
    data = {
        'id': thread.id,
        'title': thread.title,
        'slug': thread.slug,
        'description': thread.description,
        'status': thread.status,
        'startedDate': (
            thread.started_date.isoformat()
            if thread.started_date else None
        ),
        'completedDate': (
            thread.completed_date.isoformat()
            if thread.completed_date else None
        ),
        'resultingEssaySlug': thread.resulting_essay_slug,
        'tags': thread.tags or [],
    }
    if include_entries:
        data['entries'] = [
            {
                'entryType': entry.entry_type,
                'date': entry.date.isoformat(),
                'order': entry.order,
                'title': entry.title,
                'description': entry.description,
                'sourceId': entry.source_id,
                'fieldNoteSlug': entry.field_note_slug,
            }
            for entry in thread.entries.all()
        ]
    return data


def serialize_backlinks(backlink_graph):
    """
    Serialize the backlink graph for static JSON.

    Input is the output of get_all_backlinks().
    """
    return {
        key: [
            {
                'contentType': link['content_type'],
                'contentSlug': link['content_slug'],
                'sharedSources': [
                    {
                        'sourceId': s['source_id'],
                        'sourceTitle': s['source_title'],
                    }
                    for s in link['shared_sources']
                ],
            }
            for link in links
        ]
        for key, links in backlink_graph.items()
    }


def to_json(data):
    """Serialize to formatted JSON string."""
    return json.dumps(data, indent=2, ensure_ascii=False) + '\n'
