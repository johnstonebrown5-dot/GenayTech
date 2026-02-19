from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Process queued communications DeliveryJob records (durable message delivery).'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=50)

    def handle(self, *args, **options):
        from communications.models import DeliveryJob
        from communications.utils import process_message_delivery

        now = timezone.now()
        limit = int(options.get('limit') or 50)
        limit = max(1, min(limit, 500))

        processed = 0
        completed = 0
        failed = 0
        skipped = 0

        while processed < limit:
            job = None
            try:
                with transaction.atomic():
                    qs = DeliveryJob.objects.select_for_update()
                    try:
                        qs = qs.select_for_update(skip_locked=True)
                    except Exception:
                        qs = qs.select_for_update()

                    job = (
                        qs.filter(status__in=[DeliveryJob.Status.PENDING, DeliveryJob.Status.FAILED])
                        .filter(next_run_at__isnull=False, next_run_at__lte=now)
                        .order_by('next_run_at', 'id')
                        .first()
                    )
                    if not job:
                        break
                    if job.status == DeliveryJob.Status.RUNNING:
                        skipped += 1
                        processed += 1
                        continue
                    job.status = DeliveryJob.Status.RUNNING
                    job.locked_at = now
                    job.attempts = int(job.attempts or 0) + 1
                    job.last_error = ''
                    job.save(update_fields=['status', 'locked_at', 'attempts', 'last_error', 'updated_at'])
            except Exception:
                break

            processed += 1

            try:
                process_message_delivery(job.message_id)
                try:
                    DeliveryJob.objects.filter(id=job.id).update(
                        status=DeliveryJob.Status.COMPLETED,
                        next_run_at=None,
                        locked_at=None,
                        last_error='',
                        updated_at=timezone.now(),
                    )
                except Exception:
                    pass
                completed += 1
            except Exception as e:
                err = str(e)
                try:
                    fresh = DeliveryJob.objects.filter(id=job.id).first()
                    if fresh is None:
                        raise
                    attempts = int(fresh.attempts or 0)
                    max_attempts = int(fresh.max_attempts or 10)
                    if attempts >= max_attempts:
                        DeliveryJob.objects.filter(id=job.id).update(
                            status=DeliveryJob.Status.FAILED,
                            next_run_at=None,
                            locked_at=None,
                            last_error=err[:2000],
                            updated_at=timezone.now(),
                        )
                    else:
                        delay = min(3600, (2 ** max(0, attempts - 1)) * 30)
                        DeliveryJob.objects.filter(id=job.id).update(
                            status=DeliveryJob.Status.FAILED,
                            next_run_at=timezone.now() + timedelta(seconds=delay),
                            locked_at=None,
                            last_error=err[:2000],
                            updated_at=timezone.now(),
                        )
                except Exception:
                    pass
                failed += 1

        self.stdout.write(self.style.SUCCESS(
            f'Processed {processed} jobs. Completed {completed}. Failed {failed}. Skipped {skipped}.'
        ))
