"""
Custom form widgets for the editor.

These widgets bridge Django's JSONField with user-friendly HTML inputs.
The key pattern: each widget handles serialization (Python value to HTML)
via format_value() and deserialization (POST data to Python) via value_from_datadict().

StructuredListWidget renders row-based UIs for JSON arrays of objects,
replacing the raw JSON textarea for structured fields like sources,
annotations, urls, and callouts.
"""

import json

from django import forms
from django.utils.html import escape
from django.utils.safestring import mark_safe


class TagsWidget(forms.TextInput):
    """
    Renders a JSON array of strings as a comma-separated text input.

    Stores: ["urban design", "zoning", "equity"]
    Displays: urban design, zoning, equity

    On submit, converts the comma-separated string back to a JSON array.
    """

    def __init__(self, attrs=None):
        defaults = {
            "class": "field-tags",
            "placeholder": "tag1, tag2, tag3",
        }
        if attrs:
            defaults.update(attrs)
        super().__init__(attrs=defaults)

    def format_value(self, value):
        """Convert JSON array to comma-separated string for display."""
        if value is None:
            return ""
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        if isinstance(value, list):
            return ", ".join(str(item) for item in value)
        return str(value)

    def value_from_datadict(self, data, files, name):
        """Convert comma-separated string back to JSON array string."""
        raw = super().value_from_datadict(data, files, name)
        if not raw or not raw.strip():
            return "[]"
        tags = [tag.strip() for tag in raw.split(",") if tag.strip()]
        return json.dumps(tags)


class SlugListWidget(forms.TextInput):
    """
    Renders a JSON array of slugs as a comma-separated text input.

    Like TagsWidget but for slug references (related essays, etc.).
    """

    def __init__(self, attrs=None):
        defaults = {
            "class": "field-meta",
            "placeholder": "slug-one, slug-two",
        }
        if attrs:
            defaults.update(attrs)
        super().__init__(attrs=defaults)

    def format_value(self, value):
        if value is None:
            return ""
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        if isinstance(value, list):
            return ", ".join(str(item) for item in value)
        return str(value)

    def value_from_datadict(self, data, files, name):
        raw = super().value_from_datadict(data, files, name)
        if not raw or not raw.strip():
            return "[]"
        slugs = [s.strip() for s in raw.split(",") if s.strip()]
        return json.dumps(slugs)


class JsonObjectListWidget(forms.Textarea):
    """
    Renders a JSON array of objects as pretty-printed JSON in a textarea.

    Used for complex structured fields like sources [{title, url}],
    annotations [{paragraph, text}], urls [{label, url}], and
    callouts [{text, side}].

    The textarea shows formatted JSON that the user can edit directly.
    Kept as a fallback; prefer StructuredListWidget for known schemas.
    """

    def __init__(self, attrs=None, placeholder_hint=""):
        defaults = {
            "class": "field-json",
            "rows": 4,
            "placeholder": placeholder_hint or '[\n  {"key": "value"}\n]',
            "spellcheck": "false",
        }
        if attrs:
            defaults.update(attrs)
        super().__init__(attrs=defaults)

    def format_value(self, value):
        """Convert Python list/dict to pretty-printed JSON string."""
        if value is None:
            return "[]"
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return json.dumps(parsed, indent=2, ensure_ascii=False)
            except (json.JSONDecodeError, TypeError):
                return value
        if isinstance(value, (list, dict)):
            return json.dumps(value, indent=2, ensure_ascii=False)
        return str(value)

    def value_from_datadict(self, data, files, name):
        """Validate and return JSON string from the textarea."""
        raw = super().value_from_datadict(data, files, name)
        if not raw or not raw.strip():
            return "[]"
        # Validate it parses as JSON; if not, return raw and let
        # the form's clean method handle the error
        try:
            json.loads(raw)
        except json.JSONDecodeError:
            pass
        return raw


# ---------------------------------------------------------------------------
# StructuredListWidget: row-based UI for JSON arrays of objects
# ---------------------------------------------------------------------------

# Pre-defined schemas for common JSON field types
SOURCES_SCHEMA = [
    {"name": "title", "type": "text", "label": "Title", "placeholder": "Source name"},
    {"name": "url", "type": "text", "label": "URL", "placeholder": "https://..."},
]

ANNOTATIONS_SCHEMA = [
    {"name": "paragraph", "type": "number", "label": "Paragraph #", "placeholder": "1"},
    {"name": "text", "type": "textarea", "label": "Note", "placeholder": "Margin annotation text..."},
]

URLS_SCHEMA = [
    {"name": "label", "type": "text", "label": "Label", "placeholder": "Live Site"},
    {"name": "url", "type": "text", "label": "URL", "placeholder": "https://..."},
]

CALLOUTS_SCHEMA = [
    {"name": "text", "type": "text", "label": "Text", "placeholder": "Callout text..."},
    {
        "name": "side",
        "type": "select",
        "label": "Side",
        "options": [("right", "Right"), ("left", "Left")],
    },
]

FOOTER_LINKS_SCHEMA = [
    {"name": "label", "type": "text", "label": "Label", "placeholder": "Link text"},
    {"name": "url", "type": "text", "label": "URL", "placeholder": "https://..."},
]


class StructuredListWidget(forms.Widget):
    """
    Renders a JSON array of objects as a dynamic row-based form UI.

    Each row shows labeled inputs for the object's fields, with + Add
    and x Remove buttons. The JS in studio.js handles add/remove
    by cloning the <template> row and re-indexing on remove.

    Constructor takes a fields_schema: list of dicts, each with:
        name:        field key in the JSON object
        type:        'text' | 'number' | 'textarea' | 'select'
        label:       display label
        placeholder: (optional) placeholder text
        options:     (optional, for select) list of (value, label) tuples
    """

    def __init__(self, fields_schema, attrs=None):
        self.fields_schema = fields_schema
        super().__init__(attrs=attrs or {})

    def render(self, name, value, attrs=None, renderer=None):
        items = self._parse_value(value)
        widget_id = attrs.get("id", name) if attrs else name

        parts = [
            f'<div class="structured-list" data-field="{escape(name)}" '
            f'data-schema-count="{len(self.fields_schema)}">',
            f'<div class="structured-rows" id="{escape(widget_id)}-rows">',
        ]

        for i, item in enumerate(items):
            parts.append(self._render_row(name, i, item))

        parts.append("</div>")

        # Add row button
        parts.append(
            f'<button type="button" class="btn-add-row" '
            f'data-field="{escape(name)}">+ Add</button>'
        )

        # Hidden template for JS row cloning (index placeholder: __INDEX__)
        parts.append(f'<template id="{escape(widget_id)}-template">')
        parts.append(self._render_row(name, "__INDEX__", {}))
        parts.append("</template>")

        parts.append("</div>")
        return mark_safe("\n".join(parts))

    def _render_row(self, name, index, item):
        parts = [f'<div class="structured-row" data-index="{index}">']

        for field_def in self.fields_schema:
            field_name = field_def["name"]
            field_type = field_def.get("type", "text")
            label = field_def.get("label", field_name.title())
            placeholder = field_def.get("placeholder", "")
            raw_value = item.get(field_name, "") if isinstance(item, dict) else ""
            input_name = f"{name}__{index}__{field_name}"

            parts.append('<div class="structured-field">')
            parts.append(f"<label>{escape(label)}</label>")

            if field_type == "textarea":
                parts.append(
                    f'<textarea name="{escape(input_name)}" '
                    f'placeholder="{escape(placeholder)}" rows="2">'
                    f"{escape(str(raw_value))}</textarea>"
                )
            elif field_type == "number":
                parts.append(
                    f'<input type="number" name="{escape(input_name)}" '
                    f'value="{escape(str(raw_value))}" '
                    f'placeholder="{escape(placeholder)}">'
                )
            elif field_type == "select":
                options = field_def.get("options", [])
                opts_html = []
                for opt_val, opt_label in options:
                    selected = " selected" if str(raw_value) == str(opt_val) else ""
                    opts_html.append(
                        f'<option value="{escape(str(opt_val))}"{selected}>'
                        f"{escape(opt_label)}</option>"
                    )
                parts.append(
                    f'<select name="{escape(input_name)}">'
                    f'{"".join(opts_html)}</select>'
                )
            else:
                parts.append(
                    f'<input type="text" name="{escape(input_name)}" '
                    f'value="{escape(str(raw_value))}" '
                    f'placeholder="{escape(placeholder)}">'
                )

            parts.append("</div>")

        parts.append(
            '<button type="button" class="btn-remove-row" '
            'title="Remove">&times;</button>'
        )
        parts.append("</div>")
        return "\n".join(parts)

    def _parse_value(self, value):
        if value is None:
            return []
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else []
            except (json.JSONDecodeError, TypeError):
                return []
        if isinstance(value, list):
            return value
        return []

    def value_from_datadict(self, data, files, name):
        """Collect indexed fields from POST data, assemble into JSON array."""
        items = []
        index = 0

        # Walk sequential indices; JS re-numbers rows on remove
        first_field_name = self.fields_schema[0]["name"]
        while True:
            probe_key = f"{name}__{index}__{first_field_name}"
            if probe_key not in data:
                break

            item = {}
            for field_def in self.fields_schema:
                field_name = field_def["name"]
                field_key = f"{name}__{index}__{field_name}"
                val = data.get(field_key, "")

                # Coerce number fields
                if field_def.get("type") == "number" and val:
                    try:
                        val = int(val)
                    except ValueError:
                        try:
                            val = float(val)
                        except ValueError:
                            pass

                item[field_name] = val

            # Skip fully empty rows
            if any(str(v).strip() for v in item.values()):
                items.append(item)

            index += 1

        return json.dumps(items)
