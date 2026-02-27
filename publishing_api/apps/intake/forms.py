from django import forms

from apps.intake.models import RawSource


class SourceboxAddForm(forms.Form):
    """Simple URL input for adding a source to the Sourcebox."""

    url = forms.URLField(
        max_length=2000,
        widget=forms.URLInput(attrs={
            "placeholder": "Paste a URL to add to the Sourcebox...",
            "class": (
                "w-full bg-cream border border-border rounded-brand"
                " px-4 py-[10px] text-ink text-[15px]"
                " font-body"
                " placeholder:text-ink-muted placeholder:font-body"
                " shadow-warm-sm"
                " outline-none transition-all duration-200"
                " focus:border-terracotta focus:shadow-[0_0_0_3px_rgba(180,90,45,0.12)]"
            ),
            "autofocus": True,
        }),
    )


class TriageForm(forms.Form):
    """Accept/reject/defer a RawSource with an optional note."""

    decision = forms.ChoiceField(choices=RawSource.Decision.choices)
    decision_note = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 2,
            "placeholder": "Optional note...",
            "class": (
                "w-full bg-cream border border-border rounded-brand"
                " px-3 py-2 text-ink text-sm"
                " font-body"
                " placeholder:text-ink-muted placeholder:font-body"
                " shadow-warm-sm"
                " outline-none transition-all duration-200"
                " focus:border-terracotta focus:shadow-[0_0_0_3px_rgba(180,90,45,0.12)]"
            ),
        }),
    )
