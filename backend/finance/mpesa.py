import os
import base64
import requests
from datetime import datetime


class MpesaClient:
    """Lightweight MPesa Daraja helper for STK Push.

    Env vars required:
    - MPESA_CONSUMER_KEY
    - MPESA_CONSUMER_SECRET
    - MPESA_SHORT_CODE (till/paybill number)
    - MPESA_PASSKEY (Lipa Na Mpesa Online passkey)
    - MPESA_ENV (sandbox|production), default sandbox
    - MPESA_CALLBACK_URL (public HTTPS callback)
    """

    def __init__(self, *, consumer_key: str | None = None, consumer_secret: str | None = None,
                 short_code: str | None = None, passkey: str | None = None,
                 callback_url: str | None = None, environment: str | None = None):
        # Allow explicit overrides (per-school), otherwise fall back to env vars
        self.consumer_key = str(consumer_key or os.getenv('MPESA_CONSUMER_KEY') or '').strip()
        self.consumer_secret = str(consumer_secret or os.getenv('MPESA_CONSUMER_SECRET') or '').strip()
        self.short_code = str(short_code or os.getenv('MPESA_SHORT_CODE') or '').strip()
        self.passkey = str(passkey or os.getenv('MPESA_PASSKEY') or '').strip()
        self.callback = callback_url or os.getenv('MPESA_CALLBACK_URL', 'https://example.com/mpesa/callback')
        env = (environment or os.getenv('MPESA_ENV', 'sandbox')).lower()
        self.base = 'https://sandbox.safaricom.co.ke' if env != 'production' else 'https://api.safaricom.co.ke'

    def get_token(self):
        url = f"{self.base}/oauth/v1/generate?grant_type=client_credentials"
        if not self.consumer_key or not self.consumer_secret:
            raise ValueError('Missing MPESA_CONSUMER_KEY/MPESA_CONSUMER_SECRET (or per-school MpesaConfig).')
        resp = requests.get(url, auth=(self.consumer_key, self.consumer_secret), timeout=15)
        try:
            resp.raise_for_status()
        except requests.exceptions.HTTPError as e:
            import logging
            logging.getLogger(__name__).error(f"Mpesa OAuth Error: {resp.status_code} {resp.text}")
            raise RuntimeError(f"Daraja OAuth failed: {resp.status_code} {resp.text}") from e
        try:
            j = resp.json()
        except Exception as e:
            raise RuntimeError(f"Daraja OAuth returned non-JSON: {resp.status_code} {resp.text}") from e
        tok = j.get('access_token')
        if not tok:
            raise RuntimeError(f"Daraja OAuth missing access_token: {resp.status_code} {resp.text}")
        return tok

    def _timestamp(self):
        return datetime.now().strftime('%Y%m%d%H%M%S')

    def _password(self, timestamp):
        raw = f"{self.short_code}{self.passkey}{timestamp}".encode('utf-8')
        return base64.b64encode(raw).decode('utf-8')

    def stk_push(self, phone: str, amount: float, account_ref: str = 'EDU-TRACK', tx_desc: str = 'Fee Payment'):
        # Basic pre-validation to avoid opaque Daraja 400 errors
        if not self.short_code or not str(self.short_code).strip().isdigit() or len(str(self.short_code).strip()) < 5:
            raise ValueError('Invalid MPESA_SHORT_CODE. For sandbox STK, commonly use 174379. Ensure it is numeric and at least 5 digits.')
        if not self.passkey or len(str(self.passkey).strip()) < 10:
            raise ValueError('Invalid MPESA_PASSKEY. Set the Lipa Na M-Pesa Online passkey from Daraja portal.')
        if not self.callback or not str(self.callback).strip().lower().startswith('https://'):
            raise ValueError('Invalid MPESA_CALLBACK_URL. Daraja requires a publicly accessible HTTPS callback URL.')
        raw_phone = str(phone or '').strip()
        if not raw_phone.isdigit() or len(raw_phone) != 12 or not raw_phone.startswith('254'):
            raise ValueError('Invalid phone format. Expected 2547XXXXXXXX (12 digits).')
        if float(amount or 0) <= 0:
            raise ValueError('Invalid amount. Must be greater than 0.')
        ts = self._timestamp()
        password = self._password(ts)
        token = self.get_token()
        headers = { 'Authorization': f'Bearer {token}', 'Content-Type': 'application/json' }
        payload = {
            "BusinessShortCode": int(self.short_code),
            "Password": password,
            "Timestamp": ts,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(round(float(amount))),
            "PartyA": phone,
            "PartyB": int(self.short_code),
            "PhoneNumber": phone,
            "CallBackURL": self.callback,
            "AccountReference": account_ref[:12] or 'EDU-TRACK',
            "TransactionDesc": tx_desc[:12] or 'Fees',
        }
        url = f"{self.base}/mpesa/stkpush/v1/processrequest"
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        try:
            resp.raise_for_status()
        except requests.exceptions.HTTPError as e:
            import logging
            logging.getLogger(__name__).error(f"Mpesa STK Push Error: {resp.status_code} {resp.text}")
            raise RuntimeError(f"Daraja STK push failed: {resp.status_code} {resp.text}") from e
        return resp.json()

    def register_urls(self):
        """Register C2B Confirmation and Validation URLs."""
        token = self.get_token()
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        payload = {
            "ShortCode": self.short_code,
            "ResponseType": "Completed",
            "ConfirmationURL": self.callback,
            "ValidationURL": self.callback
        }
        url = f"{self.base}/mpesa/c2b/v1/registerurl"
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        return resp.json()

    def c2b_simulate(self, amount: int, phone: str, bill_ref: str):
        """Simulate a C2B payment in Sandbox. First ensures URLs are registered."""
        try:
            self.register_urls()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"C2B Register URL failed (might already be registered): {e}")

        token = self.get_token()
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        payload = {
            "ShortCode": str(self.short_code),
            "CommandID": "CustomerPayBillOnline",
            "Amount": str(amount),
            "Msisdn": str(phone),
            "BillRefNumber": str(bill_ref)
        }
        url = f"{self.base}/mpesa/c2b/v1/simulate"
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        try:
            resp.raise_for_status()
        except requests.exceptions.HTTPError as e:
            import logging
            logging.getLogger(__name__).error(f"Mpesa C2B Simulation Error: {resp.text}")
            raise e
        return resp.json()
