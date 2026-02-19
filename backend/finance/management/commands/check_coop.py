import os
import socket
import requests
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Check Co-op OpenAPI credentials/env loading and basic connectivity (token endpoint).'

    def add_arguments(self, parser):
        parser.add_argument('--timeout', type=int, default=15)
        parser.add_argument('--skip-http', action='store_true', help='Only do DNS/TCP checks, skip HTTP requests')

    def _mask(self, v: str, keep: int = 6) -> str:
        if not v:
            return ''
        v = str(v)
        if len(v) <= keep:
            return '*' * len(v)
        return v[:keep] + '...' + ('*' * 6)

    def handle(self, *args, **options):
        timeout = int(options.get('timeout') or 15)
        skip_http = bool(options.get('skip_http'))

        enable = str(os.getenv('ENABLE_COOP_STK', '') or '').lower() in ('1', 'true', 'yes')
        self.stdout.write(self.style.HTTP_INFO(f'ENABLE_COOP_STK: {enable}'))

        required = [
            'COOP_CLIENT_ID',
            'COOP_CLIENT_SECRET',
            'COOP_TOKEN_URL',
        ]
        stk_required = [
            'COOP_BASE_URL',
            'COOP_SHORT_CODE',
            'COOP_PASSKEY',
            'COOP_CALLBACK_URL',
        ]
        statement_required = [
            'COOP_OPENAPI_BASE',
        ]

        def check_vars(keys, title):
            self.stdout.write(self.style.MIGRATE_HEADING(title))
            missing = []
            for k in keys:
                v = os.getenv(k)
                if not v:
                    missing.append(k)
                masked = self._mask(v)
                self.stdout.write(f'- {k}={masked}')
            if missing:
                self.stdout.write(self.style.ERROR(f'Missing: {", ".join(missing)}'))
                return False
            self.stdout.write(self.style.SUCCESS('OK'))
            return True

        ok_core = check_vars(required, 'Core OAuth env vars')
        ok_stk = check_vars(stk_required, 'STK env vars (only needed for STK push)')
        ok_stmt = check_vars(statement_required, 'Statement env vars (only needed for statement endpoints)')

        token_url = os.getenv('COOP_TOKEN_URL') or ''
        base_host = None
        try:
            from urllib.parse import urlparse
            base_host = urlparse(token_url).hostname
        except Exception:
            base_host = None

        if base_host:
            self.stdout.write(self.style.MIGRATE_HEADING('Connectivity checks'))
            try:
                addrs = socket.getaddrinfo(base_host, 443, proto=socket.IPPROTO_TCP)
                ips = sorted({a[4][0] for a in addrs})
                self.stdout.write(self.style.SUCCESS(f'DNS OK: {base_host} -> {", ".join(ips[:5])}{" ..." if len(ips) > 5 else ""}'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'DNS FAILED for {base_host}: {e}'))

            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(timeout)
                res = s.connect_ex((base_host, 443))
                try:
                    s.close()
                except Exception:
                    pass
                if res == 0:
                    self.stdout.write(self.style.SUCCESS(f'TCP OK: {base_host}:443 reachable'))
                else:
                    self.stdout.write(self.style.ERROR(f'TCP FAILED: connect_ex={res}'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'TCP FAILED: {e}'))

        if skip_http:
            return

        if not ok_core:
            self.stdout.write(self.style.ERROR('Skipping HTTP token request because required env vars are missing.'))
            return

        self.stdout.write(self.style.MIGRATE_HEADING('HTTP token request (client_credentials)'))
        client_id = os.getenv('COOP_CLIENT_ID')
        client_secret = os.getenv('COOP_CLIENT_SECRET')
        scope = os.getenv('COOP_SCOPE')
        data = {'grant_type': 'client_credentials'}
        if scope:
            data['scope'] = scope

        try:
            resp = requests.post(token_url, data=data, auth=(client_id, client_secret), timeout=timeout)
            self.stdout.write(f'Status: {resp.status_code}')
            text = (resp.text or '')
            self.stdout.write(f'Body (first 500 chars): {text[:500]}')
            if resp.ok:
                try:
                    j = resp.json()
                    tok = j.get('access_token') or j.get('accessToken') or j.get('token') or j.get('id_token')
                    if tok:
                        self.stdout.write(self.style.SUCCESS(f'Token OK (masked): {self._mask(tok, keep=10)}'))
                    else:
                        self.stdout.write(self.style.WARNING('Token response OK, but no access token field found.'))
                except Exception:
                    self.stdout.write(self.style.WARNING('Token response OK, but could not parse JSON.'))
            else:
                self.stdout.write(self.style.ERROR('Token request failed (non-2xx).'))
        except requests.exceptions.ReadTimeout:
            self.stdout.write(self.style.ERROR(f'Timeout: no HTTP response within {timeout}s. (This matches your sandbox issue)'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'HTTP request failed: {e}'))
