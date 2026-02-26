from django.contrib import admin

from .models import ResearchThread, Source, SourceLink, ThreadEntry


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------

class SourceLinkInline(admin.StackedInline):
    model = SourceLink
    extra = 1
    fields = [
        'content_type', 'content_slug', 'content_title',
        'role', 'key_quote', 'date_linked', 'notes',
    ]


class ThreadEntryInline(admin.TabularInline):
    model = ThreadEntry
    extra = 1
    fields = ['order', 'entry_type', 'date', 'title', 'description', 'source', 'field_note_slug']
    ordering = ['order', '-date']
    raw_id_fields = ['source']


# ---------------------------------------------------------------------------
# Model Admins
# ---------------------------------------------------------------------------

@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ['title', 'source_type', 'creator', 'public', 'link_count', 'created_at']
    list_filter = ['source_type', 'public', 'created_at']
    search_fields = ['title', 'creator', 'publication', 'tags']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']
    list_editable = ['public']
    inlines = [SourceLinkInline]

    fieldsets = [
        (None, {
            'fields': ['title', 'slug', 'creator', 'source_type'],
        }),
        ('Publication', {
            'fields': ['url', 'publication', 'date_published', 'date_encountered'],
        }),
        ('Annotations', {
            'fields': ['public_annotation', 'private_annotation', 'key_findings'],
        }),
        ('Categorization', {
            'fields': ['tags', 'public'],
        }),
        ('Location', {
            'fields': ['location_name', 'latitude', 'longitude'],
            'classes': ['collapse'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    @admin.display(description='Links')
    def link_count(self, obj):
        return obj.link_count


@admin.register(SourceLink)
class SourceLinkAdmin(admin.ModelAdmin):
    list_display = ['source', 'content_type', 'content_slug', 'role', 'content_title']
    list_filter = ['content_type', 'role']
    search_fields = ['source__title', 'content_slug', 'content_title']
    raw_id_fields = ['source']


@admin.register(ResearchThread)
class ResearchThreadAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'public', 'started_date', 'entry_count', 'created_at']
    list_filter = ['status', 'public']
    search_fields = ['title', 'description']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']
    list_editable = ['public']
    inlines = [ThreadEntryInline]

    fieldsets = [
        (None, {
            'fields': ['title', 'slug', 'description', 'status', 'public'],
        }),
        ('Timeline', {
            'fields': ['started_date', 'completed_date', 'resulting_essay_slug'],
        }),
        ('Tags', {
            'fields': ['tags'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]


@admin.register(ThreadEntry)
class ThreadEntryAdmin(admin.ModelAdmin):
    list_display = ['title', 'thread', 'entry_type', 'date', 'order']
    list_filter = ['entry_type', 'thread']
    search_fields = ['title', 'description']
    raw_id_fields = ['thread', 'source']
