from django.core.management.base import BaseCommand
from finance.mpesa import MpesaClient
from finance.models import MpesaConfig
import os

class Command(BaseCommand):
    help = 'Simulate a C2B payment in M-Pesa Sandbox'

    def add_arguments(self, parser):
        parser.add_argument('--amount', type=int, default=1000, help='Amount to simulate')
        parser.add_argument('--phone', type=str, default='254700000000', help='Phone number (2547...)')
        parser.add_argument('--ref', type=str, default='STU001', help='Bill Reference (Admission No)')
        parser.add_argument('--school_id', type=int, help='School ID for config lookup')

    def handle(self, *args, **options):
        school_id = options.get('school_id')
        config = None
        if school_id:
            config = MpesaConfig.objects.filter(school_id=school_id).first()
        
        try:
            if config:
                client = MpesaClient(
                    consumer_key=config.consumer_key,
                    consumer_secret=config.consumer_secret,
                    short_code=config.short_code,
                    passkey=config.passkey,
                    callback_url=config.callback_url,
                    environment=config.environment
                )
            else:
                client = MpesaClient()
            
            self.stdout.write(f"Simulating payment of KES {options['amount']} for {options['ref']}...")
            resp = client.c2b_simulate(
                amount=options['amount'],
                phone=options['phone'],
                bill_ref=options['ref']
            )
            self.stdout.write(self.style.SUCCESS(f"Response: {resp}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
