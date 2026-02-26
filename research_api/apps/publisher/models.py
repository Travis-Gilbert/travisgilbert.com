from django.db import models

from apps.core.models import TimeStampedModel


class PublishDataType(models.TextChoices):
    """What kind of data was published in this commit."""
    SOURCES = 'sources', 'Sources'
    LINKS = 'links', 'Source Links'
    THREADS = 'threads', 'Threads'
    MENTIONS = 'mentions', 'Mentions'
    FULL = 'full', 'Full Publish'


class PublishLog(TimeStampedModel):
    """Audit trail for GitHub publish commits.

    Each time the publish orchestrator commits data to the Next.js repo,
    a log entry is created with the commit details and outcome.
    """

    data_type = models.CharField(
        max_length=20,
        choices=PublishDataType.choices,
        db_index=True,
    )
    record_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of records included in this publish.',
    )
    commit_sha = models.CharField(
        max_length=40,
        blank=True,
        help_text='Git commit SHA from the GitHub API.',
    )
    commit_url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='URL to the commit on GitHub.',
    )
    success = models.BooleanField(
        default=False,
        db_index=True,
    )
    error_message = models.TextField(
        blank=True,
        help_text='Error details if the publish failed.',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'publish log'
        verbose_name_plural = 'publish logs'
        indexes = [
            models.Index(
                fields=['success', '-created_at'],
                name='idx_publog_success_date',
            ),
        ]

    def __str__(self):
        status = 'OK' if self.success else 'FAIL'
        return f'[{status}] {self.data_type} ({self.record_count} records) {self.created_at:%Y-%m-%d %H:%M}'
