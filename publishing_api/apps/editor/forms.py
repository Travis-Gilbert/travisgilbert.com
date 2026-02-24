from django import forms

from apps.content.models import Essay, FieldNote, NowPage, Project, ShelfEntry
from apps.editor.widgets import (
    JsonObjectListWidget,
    SlugListWidget,
    TagsWidget,
)


class EssayForm(forms.ModelForm):
    class Meta:
        model = Essay
        fields = [
            "title",
            "slug",
            "date",
            "summary",
            "body",
            "youtube_id",
            "thumbnail",
            "image",
            "tags",
            "sources",
            "related",
            "draft",
            "callout",
            "callouts",
            "stage",
            "annotations",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "class": "field-title",
                "placeholder": "Essay title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "date": forms.DateInput(attrs={
                "type": "date",
                "class": "field-date",
            }),
            "summary": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "maxlength": 200,
                "placeholder": "A brief summary (max 200 chars)...",
            }),
            "body": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "placeholder": "Start writing...",
            }),
            "youtube_id": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "YouTube video ID",
            }),
            "thumbnail": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "/collage/thumbnail.png",
            }),
            "image": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "/collage/image.png",
            }),
            "callout": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            "stage": forms.Select(attrs={"class": "field-meta"}),
            # JSON fields with custom widgets
            "tags": TagsWidget(),
            "sources": JsonObjectListWidget(
                placeholder_hint='[\n  {"title": "Source Name", "url": "https://..."}\n]',
            ),
            "related": SlugListWidget(attrs={
                "placeholder": "essay-slug-1, essay-slug-2",
            }),
            "callouts": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='[\n  {"text": "Callout text", "side": "right"}\n]',
            ),
            "annotations": JsonObjectListWidget(
                placeholder_hint='[\n  {"paragraph": 1, "text": "Margin note text"}\n]',
            ),
        }


class FieldNoteForm(forms.ModelForm):
    class Meta:
        model = FieldNote
        fields = [
            "title",
            "slug",
            "date",
            "body",
            "tags",
            "excerpt",
            "draft",
            "callout",
            "callouts",
            "status",
            "featured",
            "connected_to",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "class": "field-title",
                "placeholder": "Note title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "date": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "body": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "placeholder": "Start writing...",
            }),
            "excerpt": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "maxlength": 300,
                "placeholder": "Brief excerpt (max 300 chars)...",
            }),
            "status": forms.Select(attrs={"class": "field-meta"}),
            "connected_to": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Parent essay slug",
            }),
            "callout": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            # JSON fields with custom widgets
            "tags": TagsWidget(),
            "callouts": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='[\n  {"text": "Callout text", "side": "right"}\n]',
            ),
        }


class ShelfEntryForm(forms.ModelForm):
    class Meta:
        model = ShelfEntry
        fields = [
            "title",
            "slug",
            "creator",
            "type",
            "annotation",
            "url",
            "date",
            "tags",
            "connected_essay",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "class": "field-title",
                "placeholder": "Title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "creator": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Author / creator",
            }),
            "type": forms.Select(attrs={"class": "field-meta"}),
            "annotation": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "rows": 6,
                "placeholder": "Your annotation...",
            }),
            "url": forms.URLInput(attrs={
                "class": "field-meta",
                "placeholder": "https://...",
            }),
            "date": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "connected_essay": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Related essay slug",
            }),
            # JSON fields with custom widgets
            "tags": TagsWidget(),
        }


class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = [
            "title",
            "slug",
            "role",
            "description",
            "year",
            "date",
            "organization",
            "urls",
            "tags",
            "featured",
            "draft",
            "order",
            "callout",
            "body",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "class": "field-title",
                "placeholder": "Project title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "role": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Your role (e.g. Built & Designed)",
            }),
            "description": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "maxlength": 300,
                "placeholder": "Brief description (max 300 chars)...",
            }),
            "year": forms.NumberInput(attrs={"class": "field-meta"}),
            "date": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "organization": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Organization name",
            }),
            "body": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "placeholder": "Project details...",
            }),
            "callout": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            "order": forms.NumberInput(attrs={
                "class": "field-meta",
                "placeholder": "Sort order (0 = default)",
            }),
            # JSON fields with custom widgets
            "tags": TagsWidget(),
            "urls": JsonObjectListWidget(
                placeholder_hint='[\n  {"label": "Live Site", "url": "https://..."}\n]',
            ),
        }


class NowPageForm(forms.ModelForm):
    class Meta:
        model = NowPage
        fields = [
            "updated",
            "researching",
            "researching_context",
            "reading",
            "reading_context",
            "building",
            "building_context",
            "listening",
            "listening_context",
            "thinking",
        ]
        widgets = {
            "updated": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "researching": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently researching...",
            }),
            "researching_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "reading": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently reading...",
            }),
            "reading_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "building": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently building...",
            }),
            "building_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "listening": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently listening to...",
            }),
            "listening_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "thinking": forms.Textarea(attrs={
                "class": "field-body",
                "rows": 4,
                "placeholder": "What you're thinking about...",
            }),
        }
