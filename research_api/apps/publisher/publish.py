"""
Publish orchestrator for research data.

Collects all research data, serializes it, and commits the JSON files
to the Next.js repo. Designed to be called from a management command
or admin action.
"""

import logging

from django.db.models import Count

from apps.research.models import ResearchThread, Source, SourceLink
from apps.research.services import get_all_backlinks

from . import serializers
from .github import publish_files
from .models import PublishLog

logger = logging.getLogger(__name__)

# Paths in the Next.js repo where research data lives
DATA_PREFIX = 'src/data/research'


def publish_all():
    """
    Publish all research data as static JSON to the Next.js repo.

    Creates/updates these files:
        src/data/research/sources.json
        src/data/research/links.json
        src/data/research/threads.json
        src/data/research/backlinks.json

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    logger.info('Starting research data publish...')

    # Gather data (only public records)
    sources = list(
        Source.objects.public()
        .annotate(link_count=Count('links'))
        .order_by('title')
    )
    links = list(
        SourceLink.objects.select_related('source')
        .filter(source__public=True)
        .order_by('content_type', 'content_slug')
    )
    threads = list(
        ResearchThread.objects.public()
        .prefetch_related('entries', 'entries__source')
        .order_by('-started_date')
    )
    backlink_graph = get_all_backlinks()

    # Serialize
    sources_json = serializers.to_json([
        serializers.serialize_source(s) for s in sources
    ])
    links_json = serializers.to_json([
        serializers.serialize_link(lnk) for lnk in links
    ])
    threads_json = serializers.to_json([
        serializers.serialize_thread(t) for t in threads
    ])
    backlinks_json = serializers.to_json(
        serializers.serialize_backlinks(backlink_graph)
    )

    # Build file operations
    file_ops = [
        {'path': f'{DATA_PREFIX}/sources.json', 'content': sources_json},
        {'path': f'{DATA_PREFIX}/links.json', 'content': links_json},
        {'path': f'{DATA_PREFIX}/threads.json', 'content': threads_json},
        {'path': f'{DATA_PREFIX}/backlinks.json', 'content': backlinks_json},
    ]

    # Commit atomically
    result = publish_files(
        file_ops,
        commit_message=f'data(research): publish {len(sources)} sources, {len(threads)} threads',
    )

    # Write audit log
    total_records = len(sources) + len(links) + len(threads)
    PublishLog.objects.create(
        data_type='full',
        record_count=total_records,
        commit_sha=result.get('commit_sha', ''),
        commit_url=result.get('commit_url', ''),
        success=result['success'],
        error_message=result.get('error', ''),
    )

    if result['success']:
        logger.info(
            'Research data published: %s sources, %s links, %s threads. Commit: %s',
            len(sources), len(links), len(threads), result['commit_sha'][:8],
        )
    else:
        logger.error('Research data publish failed: %s', result['error'])

    return result
