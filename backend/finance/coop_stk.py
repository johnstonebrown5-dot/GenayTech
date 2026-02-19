import os
import base64
import requests
from datetime import datetime

class CoopStkClient:
    """Co-op Bank STK Push helper (Safaricom Lipa Na M-Pesa via Co-op gateway).

    Required env vars (or pass explicitly):
    - COOP_CLIENT_ID
    - COOP_CLIENT_SECRET
    - COOP_BASE_URL (e.g. https://openapi-sandbox.co-opbank.co.ke/stkpush/safaricom/1.0.0)
    - COOP_TOKEN_URL (e.g. https://openapi-sandbox.co-opbank.co.ke/token)
    - COOP_SHORT_CODE
    - COOP_PASSKEY
    - COOP_CALLBACK_URL (public HTTPS)
    - COOP_STK_PATH (default: /processrequest)
    - COOP_ENV (sandbox|production) – informational only
    """

    def __init__(self, *, client_id: str | None = None, client_secret: str | None = None,
                 base_url: str | None = None, token_url: str | None = None,
                 short_code: str | None = None, passkey: str | None = None,
                 callback_url: str | None = None, stk_path: str | None = None):
        self.client_id = client_id or os.getenv('COOP_CLIENT_ID')
        self.client_secret = client_secret or os.getenv('COOP_CLIENT_SECRET')
        self.base_url = (base_url or os.getenv('COOP_BASE_URL', '')).rstrip('/')
        self.token_url = token_url or os.getenv('COOP_TOKEN_URL')
        self.short_code = short_code or os.getenv('COOP_SHORT_CODE')
        self.passkey = passkey or os.getenv('COOP_PASSKEY')
        self.callback = callback_url or os.getenv('COOP_CALLBACK_URL', 'https://example.com/finance/coop/mpesa/callback/')
        self.stk_path = stk_path or os.getenv('COOP_STK_PATH', '/processrequest')

    def _timestamp(self) -> str:
        return datetime.now().strftime('%Y%m%d%H%M%S')

    def _password(self, timestamp: str) -> str:
        raw = f"{self.short_code}{self.passkey}{timestamp}".encode('utf-8')
        return base64.b64encode(raw).decode('utf-8')

    def get_token(self) -> str:
        # If a pre-generated token is provided, use it directly
        pre = os.getenv('COOP_ACCESS_TOKEN')
        if pre:
            print(f"DEBUG: Using COOP_ACCESS_TOKEN from env: {pre[:10]}...")
            return pre

        # Require basic credentials to attempt token fetch
        if not self.client_id or not self.client_secret or not self.token_url:
            raise ValueError('Missing required Co-op credentials: COOP_CLIENT_ID, COOP_CLIENT_SECRET, or COOP_TOKEN_URL.')

        print(f"DEBUG: Fetching token from {self.token_url}")
        # Otherwise use OAuth2 client_credentials with Basic auth header
        auth = (self.client_id, self.client_secret)
        data = { 'grant_type': 'client_credentials' }
        # Some gateways require scope; allow optional COOP_SCOPE
        scope = os.getenv('COOP_SCOPE')
        if scope:
            data['scope'] = scope
        
        try:
            response = requests.post(
                self.token_url,
                data=data,
                auth=auth,
                timeout=60
            )
            print(f"DEBUG: Token response status: {response.status_code}")
            response.raise_for_status()
            res_json = response.json()
            token = res_json.get('access_token') or res_json
            if isinstance(token, dict):
                 # handle cases where the whole json is returned as token
                 token = token.get('access_token')
            return token
        except Exception as e:
            print(f"DEBUG: Token fetch failed: {str(e)}")
            raise e

    def stk_push(self, phone: str, amount: float, account_ref: str = 'GENAYTECH', tx_desc: str = 'Fee Payment'):
        # Basic validation for STK push
        if not self.short_code or not self.passkey:
            raise ValueError('Missing required STK config: COOP_SHORT_CODE or COOP_PASSKEY.')
        if not self.base_url:
            raise ValueError('Missing COOP_BASE_URL.')

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
            "AccountReference": (account_ref or 'GENAYTECH')[:12],
            "TransactionDesc": (tx_desc or 'Fees')[:12],
        }
        # Correctly join URL and path
        path = self.stk_path if self.stk_path.startswith('/') else f'/{self.stk_path}'
        url = f"{self.base_url}{path}"
        
        print(f"DEBUG: Sending STK Push to {url}")
        print(f"DEBUG: Payload: {payload}")
        
        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=60
            )
            print(f"DEBUG: STK Push response status: {response.status_code}")
            print(f"DEBUG: Response Body: {response.text}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"DEBUG: STK Push failed: {str(e)}")
            raise e
