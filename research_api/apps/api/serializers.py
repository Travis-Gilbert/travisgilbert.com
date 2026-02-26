"""
DRF serializers for the read-only research API.

All serializers are read-only. The API never writes data; that happens
through the Django admin or management commands.
"""

from rest_framework import serializers

from apps.mentions.models import Mention, MentionSource
from apps.research.models import (
    ResearchThread,
    Source,
    SourceLink,
    ThreadEntry,
)


# ---------------------------------------------------------------------------
# Source serializers
# ---------------------------------------------------------------------------

class SourceListSerializer(serializers.ModelSerializer):
    """Compact source representation for list views."""
    link_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Source
        fields = [
            'id', 'title', 'slug', 'creator', 'source_type',
            'url', 'publication', 'date_published', 'date_encountered',
            'public_annotation', 'tags',
            'link_count', 'created_at',
        ]


class SourceLinkSerializer(serializers.ModelSerializer):
    """Source link with denormalized source metadata."""
    source_title = serializers.CharField(source='source.title', read_only=True)
    source_slug = serializers.CharField(source='source.slug', read_only=True)
    source_type = serializers.CharField(source='source.source_type', read_only=True)

    class Meta:
        model = SourceLink
        fields = [
            'id', 'source', 'source_title', 'source_slug', 'source_type',
            'content_type', 'content_slug', 'content_title',
            'role', 'key_quote', 'date_linked',
        ]


class SourceDetailSerializer(serializers.ModelSerializer):
    """Full source with nested links."""
    links = SourceLinkSerializer(many=True, read_only=True)
    link_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Source
        fields = [
            'id', 'title', 'slug', 'creator', 'source_type',
            'url', 'publication', 'date_published', 'date_encountered',
            'public_annotation', 'key_findings', 'tags',
            'location_name', 'latitude', 'longitude',
            'link_count', 'links',
            'created_at', 'updated_at',
        ]


# ---------------------------------------------------------------------------
# Thread serializers
# ---------------------------------------------------------------------------

class ThreadEntrySerializer(serializers.ModelSerializer):
    source_title = serializers.CharField(
        source='source.title', read_only=True, default='',
    )
    source_slug = serializers.CharField(
        source='source.slug', read_only=True, default='',
    )

    class Meta:
        model = ThreadEntry
        fields = [
            'id', 'entry_type', 'date', 'order',
            'title', 'description',
            'source', 'source_title', 'source_slug',
            'field_note_slug',
        ]


class ThreadListSerializer(serializers.ModelSerializer):
    """Compact thread for list views (no nested entries)."""
    entry_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ResearchThread
        fields = [
            'id', 'title', 'slug', 'description',
            'status', 'started_date', 'tags',
            'entry_count', 'created_at',
        ]


class ThreadDetailSerializer(serializers.ModelSerializer):
    """Full thread with all entries."""
    entries = ThreadEntrySerializer(many=True, read_only=True)
    entry_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ResearchThread
        fields = [
            'id', 'title', 'slug', 'description',
            'status', 'started_date', 'completed_date',
            'resulting_essay_slug', 'tags',
            'entry_count', 'entries',
            'created_at', 'updated_at',
        ]


# ---------------------------------------------------------------------------
# Mention serializers
# ---------------------------------------------------------------------------

class MentionSourceSerializer(serializers.ModelSerializer):
    mention_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = MentionSource
        fields = [
            'id', 'name', 'slug', 'domain', 'url',
            'description', 'avatar_url', 'trusted',
            'mention_count',
        ]


class MentionSerializer(serializers.ModelSerializer):
    mention_source_name = serializers.CharField(
        source='mention_source.name', read_only=True, default='',
    )
    mention_source_avatar = serializers.CharField(
        source='mention_source.avatar_url', read_only=True, default='',
    )

    class Meta:
        model = Mention
        fields = [
            'id', 'source_url', 'source_title', 'source_excerpt',
            'source_author', 'source_author_url', 'source_published',
            'target_content_type', 'target_slug',
            'mention_type', 'featured',
            'mention_source', 'mention_source_name', 'mention_source_avatar',
            'created_at',
        ]
