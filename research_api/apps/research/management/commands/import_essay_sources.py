"""
Management command to import sources from essay markdown frontmatter.

Reads .md files from the Next.js content/essays/ directory, extracts
the `sources: [{title, url}]` array from YAML frontmatter, and creates
Source + SourceLink records in the research database.

Idempotent: matches on URL first, then title slug. Safe to run repeatedly.

Usage:
    python manage.py import_essay_sources                        # Import all
    python manage.py import_essay_sources --dry-run              # Preview only
    python manage.py import_essay_sources --content-dir /path    # Custom dir
"""

from pathlib import Path

import frontmatter
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from django.utils.text import slugify

from apps.research.models import (
    ContentType,
    LinkRole,
    Source,
    SourceLink,
    SourceType,
)


# Relative to research_api/manage.py
DEFAULT_CONTENT_DIR = Path(__file__).resolve().parents[4] / 'src' / 'content' / 'essays'


def _guess_source_type(url: str) -> str:
    """Infer SourceType from URL patterns. Falls back to 'article'."""
    url_lower = url.lower()
    if any(kw in url_lower for kw in ('youtube.com', 'vimeo.com', '/video')):
        return SourceType.VIDEO
    if any(kw in url_lower for kw in ('.pdf', 'arxiv.org', 'doi.org', 'jstor.org')):
        return SourceType.PAPER
    if any(kw in url_lower for kw in ('podcast', 'spotify.com/show', 'apple.com/podcast')):
        return SourceType.PODCAST
    if any(kw in url_lower for kw in ('routledge.com', 'press.', 'penguin.', 'amazon.com', 'henrygrabar.com')):
        return SourceType.BOOK
    return SourceType.ARTICLE


class Command(BaseCommand):
    help = 'Import sources from essay markdown frontmatter into research database.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would be created without writing to the database.',
        )
        parser.add_argument(
            '--content-dir',
            type=str,
            default=str(DEFAULT_CONTENT_DIR),
            help='Path to the essays content directory (default: src/content/essays/).',
        )

    def handle(self, *args, **options):
        content_dir = Path(options['content_dir'])
        dry_run = options['dry_run']

        if not content_dir.exists():
            self.stderr.write(self.style.ERROR(
                f'Content directory not found: {content_dir}'
            ))
            return

        md_files = sorted(content_dir.glob('*.md'))
        if not md_files:
            self.stderr.write(self.style.WARNING(
                f'No .md files found in {content_dir}'
            ))
            return

        self.stdout.write(f'Found {len(md_files)} essay file(s) in {content_dir}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN: no database writes'))

        sources_created = 0
        sources_existing = 0
        links_created = 0
        links_existing = 0

        for md_path in md_files:
            essay_slug = md_path.stem
            post = frontmatter.load(str(md_path))
            essay_title = post.metadata.get('title', essay_slug)
            sources = post.metadata.get('sources', [])

            if not sources:
                self.stdout.write(f'  {essay_slug}: no sources, skipping')
                continue

            self.stdout.write(f'  {essay_slug}: {len(sources)} source(s)')

            for src_data in sources:
                title = src_data.get('title', '')
                url = src_data.get('url', '')

                if not title:
                    continue

                # Find or create Source (match by URL first, then slug)
                source = None
                created = False

                if url:
                    source = Source.objects.filter(url=url).first()

                if not source:
                    title_slug = slugify(title)[:500]
                    source = Source.objects.filter(slug=title_slug).first()

                if source:
                    sources_existing += 1
                    action = 'exists'
                else:
                    if dry_run:
                        sources_created += 1
                        self.stdout.write(
                            f'    + Source: "{title}" ({_guess_source_type(url)})'
                        )
                        # Skip link creation in dry run since we have no PK
                        links_created += 1
                        self.stdout.write(
                            f'      + Link: {essay_slug} (reference)'
                        )
                        continue

                    source = Source.objects.create(
                        title=title,
                        url=url,
                        source_type=_guess_source_type(url),
                        public=True,
                    )
                    sources_created += 1
                    created = True
                    action = 'created'

                self.stdout.write(
                    f'    {"+" if created else "="} Source: "{title}" ({action})'
                )

                if dry_run:
                    # Check if link would exist
                    link_exists = SourceLink.objects.filter(
                        source=source,
                        content_type=ContentType.ESSAY,
                        content_slug=essay_slug,
                    ).exists()
                    if link_exists:
                        links_existing += 1
                        self.stdout.write(f'      = Link: {essay_slug} (exists)')
                    else:
                        links_created += 1
                        self.stdout.write(f'      + Link: {essay_slug} (reference)')
                    continue

                # Create SourceLink (idempotent via unique constraint)
                try:
                    SourceLink.objects.create(
                        source=source,
                        content_type=ContentType.ESSAY,
                        content_slug=essay_slug,
                        content_title=essay_title,
                        role=LinkRole.REFERENCE,
                    )
                    links_created += 1
                    self.stdout.write(f'      + Link: {essay_slug} (created)')
                except IntegrityError:
                    links_existing += 1
                    self.stdout.write(f'      = Link: {essay_slug} (exists)')

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Sources: {sources_created} created, {sources_existing} existing'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'Links:   {links_created} created, {links_existing} existing'
        ))
