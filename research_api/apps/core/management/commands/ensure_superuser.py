"""
Create a superuser from environment variables if one does not already exist.

Reads DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL, and
DJANGO_SUPERUSER_PASSWORD from the environment. Skips silently
if any are missing or the username already exists.

Safe to run on every deploy (idempotent).
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = 'Create superuser from env vars if none exists (idempotent).'

    def handle(self, *args, **options):
        username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
        email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

        if not all([username, email, password]):
            self.stdout.write(
                'Superuser env vars not set, skipping.'
            )
            return

        if User.objects.filter(username=username).exists():
            self.stdout.write(
                f'Superuser "{username}" already exists, skipping.'
            )
            return

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(
            f'Superuser "{username}" created successfully.'
        ))
