import os
import shutil
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from google.cloud import storage


class Command(BaseCommand):
    help = "Create a timestamped backup of the SQLite database."

    def handle(self, *args, **options):
        db_config = settings.DATABASES.get("default")
        engine = db_config.get("ENGINE")

        if engine != "django.db.backends.sqlite3":
            raise CommandError(
                f"This backup command currently supports only SQLite. Found ENGINE={engine!r}."
            )

        db_path = db_config.get("NAME")
        if not db_path:
            raise CommandError("DATABASES['default']['NAME'] is not set.")

        # Resolve to absolute path in case NAME is relative
        if not os.path.isabs(db_path):
            db_path = os.path.join(settings.BASE_DIR, db_path)

        if not os.path.exists(db_path):
            raise CommandError(f"Database file not found at: {db_path}")

        backups_root = os.path.join(settings.BASE_DIR, "backups")
        os.makedirs(backups_root, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.basename(db_path)
        name_without_ext, ext = os.path.splitext(base_name)
        backup_filename = f"{name_without_ext}_{timestamp}{ext or '.sqlite3'}"
        backup_path = os.path.join(backups_root, backup_filename)

        shutil.copy2(db_path, backup_path)

        self.stdout.write(self.style.SUCCESS(f"Database backup created: {backup_path}"))

        # Upload to Google Cloud Storage
        bucket_name = os.getenv("GCS_BACKUP_BUCKET")
        if not bucket_name:
            raise CommandError(
                "GCS_BACKUP_BUCKET environment variable is not set. "
                "Set it to the name of the Google Cloud Storage bucket for backups."
            )

        # Optional prefix inside the bucket (e.g. "edutrack/db_backups/")
        prefix = os.getenv("GCS_BACKUP_PREFIX", "")
        if prefix and not prefix.endswith("/"):
            prefix = prefix + "/"

        destination_blob_name = f"{prefix}{backup_filename}"

        # The Google Cloud client will use GOOGLE_APPLICATION_CREDENTIALS or other default creds
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(backup_path)

        self.stdout.write(
            self.style.SUCCESS(
                f"Database backup uploaded to GCS: gs://{bucket_name}/{destination_blob_name}"
            )
        )
