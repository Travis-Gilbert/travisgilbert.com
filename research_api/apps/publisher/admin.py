from django.contrib import admin

from .models import PublishLog


@admin.register(PublishLog)
class PublishLogAdmin(admin.ModelAdmin):
    list_display = ['data_type', 'record_count', 'success', 'short_sha', 'created_at']
    list_filter = ['data_type', 'success', 'created_at']
    readonly_fields = [
        'data_type', 'record_count', 'commit_sha', 'commit_url',
        'success', 'error_message', 'created_at', 'updated_at',
    ]
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description='Commit')
    def short_sha(self, obj):
        if obj.commit_sha:
            return obj.commit_sha[:8]
        return ''
