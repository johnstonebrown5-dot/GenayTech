import os
import requests


class CoopApiClient:
    def __init__(self, *, client_id: str | None = None, client_secret: str | None = None,
                 token_url: str | None = None, base_url: str | None = None,
                 statement_path: str | None = None):
        self.client_id = client_id or os.getenv('COOP_CLIENT_ID')
        self.client_secret = client_secret or os.getenv('COOP_CLIENT_SECRET')
        self.token_url = token_url or os.getenv('COOP_TOKEN_URL')
        self.base_url = (base_url or os.getenv('COOP_OPENAPI_BASE', '')).rstrip('/')
        self.statement_path = statement_path or os.getenv('COOP_STATEMENT_PATH', '/Enquiry/Account/transactions/1.0.0')

    def get_token(self) -> str:
        pre = os.getenv('COOP_ACCESS_TOKEN')
        if pre:
            return pre
        auth = (self.client_id, self.client_secret)
        data = {'grant_type': 'client_credentials'}
        scope = os.getenv('COOP_SCOPE')
        if scope:
            data['scope'] = scope
        resp = requests.post(self.token_url, data=data, auth=auth, timeout=20)
        resp.raise_for_status()
        j = resp.json()
        return j.get('access_token') or j.get('accessToken') or j.get('token')

    def get_transactions(self, account_number: str, date_from: str, date_to: str, **kwargs):
        token = self.get_token()
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        url = f"{self.base_url}{self.statement_path}"
        params = {
            "accountNumber": account_number,
            "dateFrom": date_from,
            "dateTo": date_to,
        }
        params.update({k: v for k, v in kwargs.items() if v is not None})
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict):
            items = data.get('transactions') or data.get('Transactions') or data.get('items') or []
        else:
            items = data
        return items
