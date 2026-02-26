"""
Server-side reCAPTCHA v3 verification.

Same pattern as the comments_api. The secret key stays server-side,
tokens are generated in the browser and sent with each submission.
"""

import requests
from django.conf import settings


VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'


def verify_token(token: str) -> bool:
    """
    Send the token to Google for verification.
    Returns True if the score is above the configured minimum.
    Returns True without checking if no secret key is configured
    (allows local development without reCAPTCHA keys).
    """
    secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', '')
    if not secret or not token:
        return True

    try:
        response = requests.post(
            VERIFY_URL,
            data={'secret': secret, 'response': token},
            timeout=5,
        )
        result = response.json()
        score = result.get('score', 0.0)
        min_score = getattr(settings, 'RECAPTCHA_MIN_SCORE', 0.5)
        return result.get('success', False) and score >= min_score
    except Exception:
        # Network failure: fail open
        return True


def get_recaptcha_score(token: str) -> float:
    """
    Return the raw reCAPTCHA score (0.0 to 1.0) for logging purposes.

    Low scores (below 0.3) flag submissions as likely spam without
    blocking them outright. This lets you review borderline cases
    in the admin rather than losing legitimate contributions.
    """
    secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', '')
    if not secret or not token:
        return 1.0

    try:
        response = requests.post(
            VERIFY_URL,
            data={'secret': secret, 'response': token},
            timeout=5,
        )
        result = response.json()
        if result.get('success', False):
            return result.get('score', 0.0)
        return 0.0
    except Exception:
        return 1.0
