"""
Custom form widgets for the editor.

These widgets bridge Django's JSONField with user-friendly HTML inputs.
The key pattern: each widget handles serialization (Python value to HTML)
via format_value() and deserialization (POST data to Python) via value_from_datadict().
"""

import json

from django import forms


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
    A future iteration could replace this with a dynamic row-based UI.
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
