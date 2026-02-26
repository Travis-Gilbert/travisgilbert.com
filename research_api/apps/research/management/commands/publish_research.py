"""
Management command to publish research data to the Next.js repo.

Usage:
    python manage.py publish_research                  # Full publish
    python manage.py publish_research --dry-run        # Preview without committing
    python manage.py publish_research --only sources   # Single data type
    python manage.py publish_research --trail housing   # Single trail file
"""

from django.core.management.base import BaseCommand

from apps.mentions.models import Mention
from apps.publisher.publish import publish_all, publish_only, publish_trail
from apps.research.models import ResearchThread, Source, SourceLink


VALID_ONLY_KINDS = ('sources', 'threads', 'mentions')


class Command(BaseCommand):
    help = 'Publish research data as static JSON to the Next.js GitHub repo.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be published without committing.',
        )
        parser.add_argument(
            '--only',
            choices=VALID_ONLY_KINDS,
            help='Publish a single data type instead of everything.',
        )
        parser.add_argument(
            '--trail',
            metavar='SLUG',
            help='Publish a single trail file for the given content slug.',
        )

    def handle(self, *args, **options):
        # Show current counts regardless of mode
        sources = Source.objects.public().count()
        links = SourceLink.objects.filter(source__public=True).count()
        threads = ResearchThread.objects.public().count()
        mentions = Mention.objects.public().count()

        self.stdout.write(
            f'Found {sources} public sources, {links} links, '
            f'{threads} public threads, {mentions} public mentions.'
        )

        if options['dry_run']:
            if options['only']:
                self.stdout.write(self.style.WARNING(
                    f'Dry run: would publish {options["only"]} only.'
                ))
            elif options['trail']:
                self.stdout.write(self.style.WARNING(
                    f'Dry run: would publish trail for "{options["trail"]}".'
                ))
            else:
                self.stdout.write(self.style.WARNING(
                    'Dry run: would publish all data (sources, threads, '
                    'mentions, backlinks, graph).'
                ))
            return

        # Dispatch to the right publish function
        if options['trail']:
            slug = options['trail']
            self.stdout.write(f'Publishing trail for "{slug}"...')
            result = publish_trail(slug)
        elif options['only']:
            kind = options['only']
            self.stdout.write(f'Publishing {kind} only...')
            result = publish_only(kind)
        else:
            self.stdout.write('Publishing all research data...')
            result = publish_all()

        # Report result
        if result['success']:
            self.stdout.write(self.style.SUCCESS(
                f'Published successfully. Commit: {result["commit_sha"][:8]}'
            ))
        else:
            self.stdout.write(self.style.ERROR(
                f'Publish failed: {result["error"]}'
            ))
