from django.core.mail import send_mail, EmailMessage, EmailMultiAlternatives
from django.conf import settings
import logging
from datetime import datetime
from django.db import transaction
import threading
import json
import requests
import os
import mimetypes
from requests.adapters import HTTPAdapter
from urllib3.util import ssl_  # type: ignore
from urllib3.util.retry import Retry  # type: ignore
import ssl as pyssl
from django.utils import timezone
import phonenumbers
from django.template.loader import render_to_string
from django.core.files.storage import default_storage
from email.mime.image import MIMEImage

logger = logging.getLogger(__name__)


def _get_school_integration_settings(school_id: int | None):
    if not school_id:
        return None
    try:
        from accounts.models import SchoolIntegrationSettings
        return SchoolIntegrationSettings.objects.filter(school_id=school_id).first()
    except Exception:
        return None


def _resolve_school_email_context(school_id: int | None) -> dict:
    ctx: dict = {
        'school_name': 'Genay Technologies',
        'school_address': '',
        'school_phone': '',
        'school_email': '',
        'school_website': '',
        'logo_url': '',
        'logo_cid': '',
    }
    if not school_id:
        return ctx
    try:
        from accounts.models import School
        school = School.objects.filter(id=school_id).first()
    except Exception:
        school = None
    if not school:
        return ctx

    ctx['school_name'] = getattr(school, 'name', '') or ctx['school_name']
    ctx['school_address'] = getattr(school, 'address', '') or ''

    homepage = getattr(school, 'homepage', None) or {}
    social = getattr(school, 'social_links', None) or {}
    contact = homepage.get('contact') if isinstance(homepage, dict) else None
    if not isinstance(contact, dict):
        contact = {}

    def _first_nonempty(*vals):
        for v in vals:
            try:
                s = str(v or '').strip()
            except Exception:
                s = ''
            if s:
                return s
        return ''

    ctx['school_phone'] = _first_nonempty(
        contact.get('phone'),
        contact.get('tel'),
        contact.get('telephone'),
        homepage.get('phone') if isinstance(homepage, dict) else None,
        social.get('phone') if isinstance(social, dict) else None,
    )
    ctx['school_email'] = _first_nonempty(
        contact.get('email'),
        homepage.get('email') if isinstance(homepage, dict) else None,
        social.get('email') if isinstance(social, dict) else None,
    )
    ctx['school_website'] = _first_nonempty(
        contact.get('website'),
        homepage.get('website') if isinstance(homepage, dict) else None,
        social.get('website') if isinstance(social, dict) else None,
    )

    logo_url = ''
    try:
        if getattr(school, 'logo', None):
            logo_url = getattr(school.logo, 'url', '') or ''
    except Exception:
        logo_url = ''
    if logo_url and (logo_url.startswith('http://') or logo_url.startswith('https://')):
        ctx['logo_url'] = logo_url
    return ctx


def _try_attach_logo(email: EmailMultiAlternatives, *, school_id: int | None, cid: str = 'school_logo') -> dict:
    if not school_id:
        return {'logo_cid': ''}
    try:
        from accounts.models import School
        school = School.objects.filter(id=school_id).only('id', 'logo').first()
    except Exception:
        school = None
    if not school or not getattr(school, 'logo', None):
        return {'logo_cid': ''}
    try:
        name = getattr(getattr(school, 'logo', None), 'name', '') or ''
        if not name:
            return {'logo_cid': ''}
        with default_storage.open(name, 'rb') as f:
            data = f.read()
        if not data:
            return {'logo_cid': ''}
        mime, _ = mimetypes.guess_type(name)
        mime = mime or 'image/png'
        if not mime.startswith('image/'):
            return {'logo_cid': ''}
        subtype = mime.split('/', 1)[1]
        img = MIMEImage(data, _subtype=subtype)
        img.add_header('Content-ID', f'<{cid}>')
        img.add_header('Content-Disposition', 'inline', filename=os.path.basename(name) or 'logo')
        email.attach(img)
        return {'logo_cid': cid}
    except Exception:
        return {'logo_cid': ''}


def _append_contact_to_text(text_message: str, ctx: dict) -> str:
    msg = text_message or ''
    school_name = str(ctx.get('school_name') or '').strip()
    school_address = str(ctx.get('school_address') or '').strip()
    school_phone = str(ctx.get('school_phone') or '').strip()
    school_email = str(ctx.get('school_email') or '').strip()
    school_website = str(ctx.get('school_website') or '').strip()
    parts = [p for p in [school_address, school_phone, school_email, school_website] if p]
    if school_name or parts:
        msg = (msg.rstrip() + "\n\n---\n").rstrip() + "\n"
        if school_name:
            msg += f"{school_name}\n"
        if parts:
            msg += " • ".join(parts) + "\n"
    return msg


def log_delivery(*, school_id: int | None, channel: str, recipient: str, ok: bool, message: str = '', context: str = '', error: str = '') -> None:
    """Persist a lightweight delivery log. Never raises."""
    try:
        # Local import to avoid circulars
        from .models import DeliveryLog
        snippet = (message or '')[:300]
        err = (str(error or '')[:1000]) if error is not None else ''
        DeliveryLog.objects.create(
            school_id=school_id,
            channel=channel,
            recipient=str(recipient)[:255],
            ok=bool(ok),
            message_snippet=snippet,
            error=err,
            context=(context or '')[:100],
        )
    except Exception:
        # Swallow any logging persistence issues
        logger.debug("DeliveryLog persist failed", exc_info=True)


class TLSv1_2HttpAdapter(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        ctx = ssl_.create_urllib3_context()
        try:
            ctx.minimum_version = pyssl.TLSVersion.TLSv1_2
        except Exception:
            pass
        pool_kwargs["ssl_context"] = ctx
        return super().init_poolmanager(connections, maxsize, block, **pool_kwargs)

    def proxy_manager_for(self, proxy, **proxy_kwargs):
        ctx = ssl_.create_urllib3_context()
        try:
            ctx.minimum_version = pyssl.TLSVersion.TLSv1_2
        except Exception:
            pass
        proxy_kwargs["ssl_context"] = ctx
        return super().proxy_manager_for(proxy, **proxy_kwargs)


def render_template(template: str, context: dict) -> str:
    msg = template or ''
    # Very simple placeholder replacement
    for key, val in (context or {}).items():
        msg = msg.replace(f'{{{key}}}', str(val))
    return msg


def _send_sms_via_textwave_rest(*, base_url: str, api_key: str, phone: str, message: str, sender: str | None, school_id: int | None = None) -> bool:
    try:
        base_url = str(base_url or '').strip().rstrip('/')
        if not base_url:
            logger.warning("TextWave base url missing; skipping SMS to %s", phone)
            return False

        path = str(getattr(settings, 'TEXTWAVE_SEND_PATH', '/sms/send') or '/sms/send').strip()
        if not path.startswith('/'):
            path = '/' + path
        url = base_url + path

        headers: dict = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'edutrack/1.0 (+requests)',
        }

        raw_headers = getattr(settings, 'TEXTWAVE_HEADERS_JSON', '') or ''
        if raw_headers:
            try:
                parsed_headers = json.loads(raw_headers)
                if isinstance(parsed_headers, dict):
                    for hk, hv in parsed_headers.items():
                        if isinstance(hv, str):
                            parsed_headers[hk] = hv.replace('${TEXTWAVE_API_KEY}', str(api_key))
                    headers.update(parsed_headers)
            except Exception:
                logger.warning("Invalid TEXTWAVE_HEADERS_JSON; ignoring")

        if not any(k.lower() in ('authorization', 'x-api-key', 'apikey', 'api-key') for k in headers.keys()):
            headers['Authorization'] = f"Bearer {api_key}"

        to_key = str(getattr(settings, 'TEXTWAVE_TO_KEY', 'to') or 'to')
        msg_key = str(getattr(settings, 'TEXTWAVE_MESSAGE_KEY', 'message') or 'message')
        sender_key = str(getattr(settings, 'TEXTWAVE_FROM_KEY', 'senderId') or 'senderId')

        payload: dict = {
            to_key: phone,
            msg_key: message,
        }
        if sender:
            payload[sender_key] = sender

        retries = Retry(total=2, backoff_factor=0.5, status_forcelist=(429, 500, 502, 503, 504))
        with requests.Session() as s:
            s.mount('https://', TLSv1_2HttpAdapter(max_retries=retries))

            # Try common auth formats in sequence (providers vary)
            attempts: list[tuple[str, dict]] = []
            attempts.append(('bearer_or_configured', dict(headers)))

            h_x = dict(headers)
            h_x.pop('Authorization', None)
            h_x['X-API-KEY'] = str(api_key)
            attempts.append(('x_api_key', h_x))

            h_x2 = dict(headers)
            h_x2.pop('Authorization', None)
            h_x2['x-api-key'] = str(api_key)
            attempts.append(('x-api-key', h_x2))

            h_ak = dict(headers)
            h_ak['Authorization'] = f"ApiKey {api_key}"
            attempts.append(('authorization_apikey', h_ak))

            h_tok = dict(headers)
            h_tok['Authorization'] = f"Token {api_key}"
            attempts.append(('authorization_token', h_tok))

            h_raw = dict(headers)
            h_raw['Authorization'] = str(api_key)
            attempts.append(('authorization_raw', h_raw))

            resp = None
            last_401_details: list[tuple[str, str]] = []
            for name, h in attempts:
                resp = s.post(url, json=payload, headers=h, timeout=20)
                if resp.status_code != 401:
                    break
                try:
                    last_401_details.append((name, (resp.text or '')[:300]))
                except Exception:
                    last_401_details.append((name, '<no body>'))

            if resp is not None and resp.status_code == 401 and last_401_details:
                try:
                    logger.warning("TextWave 401 auth attempts: %s", last_401_details)
                except Exception:
                    pass

            if resp is None:
                logger.warning("TextWave SMS send failed: no response")
                return False

        if resp.status_code >= 400:
            logger.warning("TextWave SMS send failed (%s): %s", resp.status_code, (resp.text or '')[:500])
            # Check for insufficient balance and notify superusers
            if resp.status_code == 402 and 'INSUFFICIENT_BALANCE' in (resp.text or ''):
                try:
                    # Throttle "Insufficient Balance" alerts to once per school every 12 hours
                    # to avoid spamming admins during bulk SMS failures.
                    cache_key = f"sms_balance_alert_sent_{school_id or 'system'}"
                    if not cache.get(cache_key):
                        from accounts.models import User
                        from .models import Notification
                        superusers = User.objects.filter(is_superuser=True)
                        msg = f"SMS balance is insufficient for school_id={school_id}. Please top up your TextWave account."
                        for user in superusers:
                            Notification.objects.create(user=user, message=msg, type='in_app')
                            if user.email:
                                send_email_safe("SMS Balance Low", msg, user.email, school_id=school_id)
                        # Set cache flag for 12 hours (43200 seconds)
                        cache.set(cache_key, True, 43200)
                except Exception as e:
                    logger.exception("Failed to send balance low notifications: %s", e)
            return False

        try:
            data = resp.json() if resp.headers.get('Content-Type', '').startswith('application/json') else None
        except Exception:
            data = None
        if not isinstance(data, dict):
            return 200 <= int(resp.status_code) < 400

        if data.get('status') == 'complete':
            total_failed = data.get('data', {}).get('totalFailed', 0)
            return int(total_failed or 0) == 0

        logger.warning("TextWave response indicates failure: %s", data)
        return False
    except Exception:
        logger.exception("Failed to send SMS via TextWave to %s", phone)
        return False


def send_sms(phone: str, message: str, school_id: int | None = None, max_len: int | None = None) -> bool:
    """
    Send SMS via configured provider. Returns True if accepted for delivery.
    """
    if not phone or not message:
        return False
    # Immediate loopback: if SMS_LOOPBACK is enabled, do not attempt any network calls
    if getattr(settings, 'SMS_LOOPBACK', False):
        logger.info("SMS_LOOPBACK enabled: simulating SMS send to %s", phone)
        return True

    integ = _get_school_integration_settings(school_id)

    # Prepend school name to message if school_id provided
    if school_id:
        try:
            from accounts.models import School
            school = School.objects.get(pk=school_id)
            school_name = getattr(school, 'name', 'School')
            message = f"From : {school_name}\n\n{message}\nTHANKYOU"
        except Exception:
            pass

    # Enforce max length (applies to the final text that will be sent)
    try:
        if max_len is not None:
            ml = int(max_len)
            if ml > 0 and isinstance(message, str) and len(message) > ml:
                if ml <= 3:
                    message = message[:ml]
                else:
                    message = message[: ml - 3] + '...'
    except Exception:
        pass

    provider = 'textwave'
    # Normalize phone into E.164 if possible (defaults to KE)
    # Normalize and validate phone (default region KE)
    valid_number = False
    try:
        region = 'KE'
        parsed = phonenumbers.parse(phone, region) if (phone and not phone.startswith('+')) else phonenumbers.parse(phone)
        if phonenumbers.is_valid_number(parsed):
            phone = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            valid_number = True
    except Exception:
        valid_number = False
    if not valid_number:
        # If loopback is enabled, simulate success to avoid blocking user flows in dev/demo
        if getattr(settings, 'SMS_LOOPBACK', False):
            logger.info("SMS_LOOPBACK enabled: accepting invalid phone '%s' as sent", phone)
            return True
        logger.warning("SMS not sent: invalid phone '%s' and SMS_LOOPBACK is disabled", phone)
        return False

    # TextWave expects recipient numbers in the format 2547XXXXXXXX (no leading '+')
    try:
        if phone.startswith('+'):
            phone = phone[1:]
    except Exception:
        pass

    base_url = getattr(settings, 'TEXTWAVE_BASE_URL', '') or ''
    api_key = getattr(settings, 'TEXTWAVE_API_KEY', '') or ''
    sender = getattr(settings, 'TEXTWAVE_SENDER_ID', '') or None
    if integ is not None:
        try:
            if getattr(integ, 'textwave_base_url', None):
                base_url = getattr(integ, 'textwave_base_url', '') or base_url
            if getattr(integ, 'textwave_api_key', None):
                api_key = getattr(integ, 'textwave_api_key', '') or api_key
            if getattr(integ, 'textwave_sender_id', None):
                sender = getattr(integ, 'textwave_sender_id', '') or sender
        except Exception:
            pass
    if not api_key or not base_url:
        logger.warning("TextWave credentials missing; skipping SMS to %s (school_id=%s)", phone, school_id)
        return False
    ok = _send_sms_via_textwave_rest(base_url=base_url, api_key=api_key, phone=phone, message=message, sender=sender, school_id=school_id)
    return bool(ok)


def _resolve_smtp_config(*, school_id: int | None):
    """Return SMTP config, preferring per-school SchoolIntegrationSettings when present.
    Coalesces blank/invalid values to safe defaults.
    """
    integ = _get_school_integration_settings(school_id)

    def _clean_host(v: str | None) -> str:
        h = str(v or '').strip()
        # Common UI mistake: saving an email address into host
        if not h or ('@' in h):
            return ''
        return h

    if integ is not None:
        host_user = str(getattr(integ, 'smtp_username', '') or '').strip()
        host_pass = str(getattr(integ, 'smtp_password', '') or '').strip()
        if not (host_user and host_pass):
            return None

        host = _clean_host(getattr(integ, 'smtp_host', None))
        if not host:
            host = str(getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com') or 'smtp.gmail.com').strip()

        try:
            port = int(getattr(integ, 'smtp_port', None) or 0)
        except Exception:
            port = 0
        if port <= 0:
            port = int(getattr(settings, 'EMAIL_PORT', 587) or 587)

        use_ssl = bool(getattr(integ, 'smtp_use_ssl', False))
        use_tls = bool(getattr(integ, 'smtp_use_tls', True)) and (not use_ssl)

        base_from = str(getattr(integ, 'smtp_from_email', '') or '').strip()
        if not base_from:
            base_from = str(getattr(settings, 'DEFAULT_FROM_EMAIL', host_user or 'no-reply@example.com') or (host_user or 'no-reply@example.com')).strip()
        return {
            'source': 'integration',
            'host': host,
            'port': port,
            'use_tls': use_tls,
            'use_ssl': use_ssl,
            'username': host_user,
            'password': host_pass,
            'base_from': base_from,
        }

    host = str(getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com') or 'smtp.gmail.com').strip()
    port = int(getattr(settings, 'EMAIL_PORT', 587) or 587)
    use_tls = bool(getattr(settings, 'EMAIL_USE_TLS', True))
    use_ssl = bool(getattr(settings, 'EMAIL_USE_SSL', False))
    host_user = str(getattr(settings, 'EMAIL_HOST_USER', '') or '').strip()
    host_pass = str(getattr(settings, 'EMAIL_HOST_PASSWORD', '') or '').strip()
    base_from = str(getattr(settings, 'DEFAULT_FROM_EMAIL', host_user or 'no-reply@example.com') or (host_user or 'no-reply@example.com')).strip()
    if not (host_user and host_pass):
        return None
    return {
        'source': 'global',
        'host': host,
        'port': port,
        'use_tls': bool(use_tls) and (not bool(use_ssl)),
        'use_ssl': bool(use_ssl),
        'username': host_user,
        'password': host_pass,
        'base_from': base_from,
    }


def send_email_safe(subject: str, message: str, recipient: str, reply_to: list[str] | None = None, from_name: str | None = None, school_id: int | None = None) -> bool:
    if not recipient:
        return False
    # In local/dev, allow skipping real SMTP to avoid timeouts
    try:
        if getattr(settings, 'EMAIL_LOOPBACK', False):
            logger.info("EMAIL_LOOPBACK enabled; pretending to send email to %s (subject=%r)", recipient, subject)
            return True
    except Exception:
        pass
    cfg = _resolve_smtp_config(school_id=school_id)
    if not cfg:
        logger.warning("School/global email channel not configured; skipping email to %s (school_id=%s)", recipient, school_id)
        return False

    host = cfg['host']
    port = int(cfg['port'] or 587)
    use_tls = bool(cfg['use_tls'])
    use_ssl = bool(cfg['use_ssl'])
    host_user = cfg['username']
    host_pass = cfg['password']
    base_from = cfg['base_from']

    from_email = base_from
    try:
        if from_name:
            from_email = f"{from_name} <{base_from}>"
    except Exception:
        from_email = base_from

    ctx = _resolve_school_email_context(school_id)
    text_message = _append_contact_to_text(message or '', ctx)

    def _build_email(connection=None):
        email = EmailMultiAlternatives(subject or 'Notification', text_message or '', from_email, [recipient], connection=connection)
        if reply_to:
            try:
                email.reply_to = reply_to
            except Exception:
                pass
        logo_meta = _try_attach_logo(email, school_id=school_id)
        wrapped_html = render_to_string(
            'email_text_wrapper.html',
            {**ctx, 'subject': subject or 'Notification', 'text_message': message or '', 'logo_cid': logo_meta.get('logo_cid') or ''},
        )
        if wrapped_html:
            email.attach_alternative(wrapped_html, 'text/html')
        return email

    try_ports: list[tuple[int, bool, bool]] = [(port, use_tls, use_ssl)]
    # If school integration config is present, do not override with hardcoded ports.
    if cfg.get('source') != 'integration':
        try_ports += [(587, True, False), (465, False, True)]

    last_err = None
    for p, tls_flag, ssl_flag in try_ports:
        try:
            from django.core.mail import get_connection
            conn = get_connection(
                host=host,
                port=int(p or 587),
                username=host_user,
                password=host_pass,
                use_tls=bool(tls_flag) and not bool(ssl_flag),
                use_ssl=bool(ssl_flag),
                timeout=20,
            )
            conn.open()
            try:
                email = _build_email(connection=conn)
                email.send(fail_silently=False)
                return True
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
        except Exception as e:
            last_err = e
            logger.warning("SMTP send failed (host=%s port=%s tls=%s ssl=%s): %s", host, p, tls_flag, ssl_flag, e)

    logger.exception("All SMTP attempts failed for %s: %s", recipient, last_err)
    return False


def send_email_safe_html(
     subject: str,
     text_message: str,
     html_message: str,
     recipient: str,
     reply_to: list[str] | None = None,
     from_name: str | None = None,
     school_id: int | None = None,
 ) -> bool:
     if not recipient:
         return False
     try:
         if getattr(settings, 'EMAIL_LOOPBACK', False):
             logger.info("EMAIL_LOOPBACK enabled; pretending to send email to %s (subject=%r)", recipient, subject)
             return True
     except Exception:
         pass

     cfg = _resolve_smtp_config(school_id=school_id)
     if not cfg:
         logger.warning("School/global email channel not configured; skipping email to %s (school_id=%s)", recipient, school_id)
         return False

     host = cfg['host']
     port = int(cfg['port'] or 587)
     use_tls = bool(cfg['use_tls'])
     use_ssl = bool(cfg['use_ssl'])
     host_user = cfg['username']
     host_pass = cfg['password']
     base_from = cfg['base_from']
     from_email = base_from
     try:
         if from_name:
             from_email = f"{from_name} <{base_from}>"
     except Exception:
         from_email = base_from

     ctx = _resolve_school_email_context(school_id)
     final_text = _append_contact_to_text(text_message or '', ctx)
     wrapped_html = render_to_string(
         'email_html_wrapper.html',
         {**ctx, 'subject': subject or 'Notification', 'inner_html': html_message or ''},
     )

     def _build_email(connection=None):
         email = EmailMultiAlternatives(
             subject or 'Notification',
             final_text or '',
             from_email,
             [recipient],
             connection=connection,
         )
         if reply_to:
             try:
                 email.reply_to = reply_to
             except Exception:
                 pass
         if wrapped_html:
             email.attach_alternative(wrapped_html, 'text/html')
         logo_meta = _try_attach_logo(email, school_id=school_id)
         if logo_meta.get('logo_cid'):
             wrapped_html2 = render_to_string(
                 'email_html_wrapper.html',
                 {**ctx, 'subject': subject or 'Notification', 'inner_html': html_message or '', 'logo_cid': logo_meta.get('logo_cid')},
             )
             email.alternatives = [(wrapped_html2, 'text/html')]
         return email

     try_ports: list[tuple[int, bool, bool]] = [(port, use_tls, use_ssl)]
     if cfg.get('source') != 'integration':
         try_ports += [(587, True, False), (465, False, True)]

     last_err = None
     for p, tls_flag, ssl_flag in try_ports:
         try:
             from django.core.mail import get_connection
             conn = get_connection(
                 host=host,
                 port=int(p or 587),
                 username=host_user,
                 password=host_pass,
                 use_tls=bool(tls_flag) and not bool(ssl_flag),
                 use_ssl=bool(ssl_flag),
                 timeout=20,
             )
             conn.open()
             try:
                 email = _build_email(connection=conn)
                 email.send(fail_silently=False)
                 return True
             finally:
                 try:
                     conn.close()
                 except Exception:
                     pass
         except Exception as e:
             last_err = e
             logger.warning("SMTP send failed (HTML) (host=%s port=%s tls=%s ssl=%s): %s", host, p, tls_flag, ssl_flag, e)

     logger.exception("All SMTP attempts failed (HTML) for %s: %s", recipient, last_err)
     return False


def send_email_with_attachment(subject: str, message: str, recipient: str, filename: str, content: bytes, mimetype: str = 'application/pdf', school_id: int | None = None) -> bool:
    """Send an email with a single attachment. Returns False on error."""
    if not recipient:
        return False
    try:
        cfg = _resolve_smtp_config(school_id=school_id)
        if not cfg:
            logger.warning("School/global email channel not configured; skipping email to %s (school_id=%s)", recipient, school_id)
            return False

        host = cfg['host']
        port = int(cfg['port'] or 587)
        use_tls = bool(cfg['use_tls'])
        use_ssl = bool(cfg['use_ssl'])
        host_user = cfg['username']
        host_pass = cfg['password']
        base_from = cfg['base_from']
        from_email = base_from
        ctx = _resolve_school_email_context(school_id)
        final_text = _append_contact_to_text(message or '', ctx)

        conn = None
        try:
            from django.core.mail import get_connection
            conn = get_connection(
                host=host,
                port=int(port or 587),
                username=host_user,
                password=host_pass,
                use_tls=bool(use_tls) and not bool(use_ssl),
                use_ssl=bool(use_ssl),
                timeout=20,
            )
        except Exception:
            conn = None

        email = EmailMultiAlternatives(subject or 'Notification', final_text or '', from_email, [recipient], connection=conn)
        logo_meta = _try_attach_logo(email, school_id=school_id)
        wrapped_html = render_to_string(
            'email_text_wrapper.html',
            {**ctx, 'subject': subject or 'Notification', 'text_message': message or '', 'logo_cid': logo_meta.get('logo_cid') or ''},
        )
        if wrapped_html:
            email.attach_alternative(wrapped_html, 'text/html')
        if content is not None:
            email.attach(filename or 'attachment.pdf', content, mimetype or 'application/octet-stream')
        email.send(fail_silently=True)
        return True
    except Exception as e:
        logger.exception("Failed to send email with attachment to %s: %s", recipient, e)
        return False
def process_arrears_campaign(campaign_id: int):
    """Background task: processes an arrears campaign by sending messages via selected channels.
    Updates campaign status, timestamps, counts, and error message on failure.
    """
    from django.db.models import Sum, F, Value, DecimalField
    from django.db.models.functions import Coalesce
    from .models import ArrearsMessageCampaign, Notification
    from academics.models import Student
    try:
        # Mark campaign as running
        with transaction.atomic():
            campaign = ArrearsMessageCampaign.objects.select_for_update().get(pk=campaign_id)
            campaign.status = ArrearsMessageCampaign.Status.RUNNING
            campaign.started_at = timezone.now()
            campaign.error_message = ''
            campaign.sent_count = 0
            campaign.save(update_fields=['status', 'started_at', 'error_message', 'sent_count'])

        students = Student.objects.filter(klass__school_id=campaign.school_id, is_active=True)
        if campaign.klass_id:
            students = students.filter(klass_id=campaign.klass_id)

        # Compute balances per student using Subqueries to avoid join multiplication between invoices and payments
        from django.db.models import OuterRef, Subquery
        from finance.models import Invoice, Payment
        billed_sq = (
            Invoice.objects
            .filter(student_id=OuterRef('pk'))
            .values('student_id')
            .annotate(s=Sum('amount'))
            .values('s')[:1]
        )
        paid_sq = (
            Payment.objects
            .filter(invoice__student_id=OuterRef('pk'))
            .values('invoice__student_id')
            .annotate(s=Sum('amount'))
            .values('s')[:1]
        )
        students = students.annotate(
            billed=Coalesce(Subquery(billed_sq), Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))),
            paid=Coalesce(Subquery(paid_sq), Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))),
        ).annotate(balance=F('billed') - F('paid'))
        # Enforce strictly positive balances: do not notify 0 or negative
        try:
            threshold = float(getattr(campaign, 'min_balance', 0) or 0)
        except Exception:
            threshold = 0.0
        if threshold < 0:
            threshold = 0.0
        students = students.filter(balance__gt=threshold)

        notifications = []
        # Prepare personalized chat messages only if in-app is selected
        personalized_pairs = [] if campaign.send_in_app else None
        count = 0
        sms_sent = 0
        sms_failed = 0
        email_sent = 0
        email_failed = 0
        for stu in students.select_related('user', 'klass'):
            # Check for cancellation between recipients
            try:
                campaign.refresh_from_db(fields=['cancel_requested'])
                if campaign.cancel_requested:
                    logger.info("Arrears campaign %s cancelled during processing", campaign_id)
                    break
            except Exception:
                pass

            klass_name = getattr(getattr(stu, 'klass', None), 'name', '')
            currency = getattr(settings, 'CURRENCY', 'KES')
            try:
                balance_val = float(getattr(stu, 'balance', 0) or 0)
            except Exception:
                balance_val = 0.0
            balance_str = f"{balance_val:,.2f}"
            admission_no = getattr(stu, 'admission_no', '')
            context = {
                'student_name': getattr(stu, 'name', ''),
                'admission_no': admission_no,
                'class': klass_name,
                'balance': balance_str,
                'balance_formatted': f"{currency} {balance_str}",
                'currency': currency,
            }
            msg = render_template(campaign.message, context)
            tpl = campaign.message or ''
            if ('{balance' not in tpl) and ('{balance_formatted' not in tpl):
                msg = f"{msg} Outstanding balance: {currency} {balance_str}."

            # Automatically prepend student name and admission number if they aren't explicitly in the template
            if '{student_name}' not in tpl and '{admission_no}' not in tpl:
                msg = f"Student: {context['student_name']} ({admission_no}) Class: {klass_name}. {msg}"
            elif '{admission_no}' not in tpl:
                # If name is there but admission no isn't, inject it
                msg = msg.replace(context['student_name'], f"{context['student_name']} ({admission_no})")

            # In-app
            # Queue in-app notification if enabled
            if campaign.send_in_app and getattr(stu, 'user_id', None):
                notifications.append(Notification(user_id=stu.user_id, message=msg, type='in_app'))
                count += 1

            # Mirror to chat only when in-app selected, so it shows in Messages UI
            if campaign.send_in_app and getattr(stu, 'user_id', None) and personalized_pairs is not None:
                personalized_pairs.append((stu.user_id, msg))

            # SMS: send ONLY to guardian phone
            if campaign.send_sms:
                phone = getattr(stu, 'guardian_id', None)
                if phone:
                    ok = False
                    try:
                        ok = send_sms(phone, msg, school_id=getattr(campaign, 'school_id', None))
                    except Exception:
                        logger.exception("send_sms crashed for %s", phone)
                        ok = False
                    if ok:
                        sms_sent += 1
                        count += 1
                    else:
                        sms_failed += 1
                    # Log attempt
                    try:
                        log_delivery(
                            school_id=getattr(campaign, 'school_id', None),
                            channel='sms',
                            recipient=str(phone),
                            ok=bool(ok),
                            message=msg,
                            context=f"campaign:{campaign.id};student:{getattr(stu,'id',None)}",
                        )
                    except Exception:
                        pass

            # Email
            if campaign.send_email:
                recipient = getattr(stu, 'email', None) or getattr(getattr(stu, 'user', None), 'email', None)
                if recipient:
                    ok = False
                    try:
                        ok = send_email_safe(campaign.email_subject or 'School Fees Arrears', msg, recipient, school_id=getattr(campaign, 'school_id', None))
                    except Exception:
                        logger.exception("send_email_safe crashed for %s", recipient)
                        ok = False
                    if ok:
                        email_sent += 1
                        count += 1
                    else:
                        email_failed += 1
                    # Log attempt
                    try:
                        log_delivery(
                            school_id=getattr(campaign, 'school_id', None),
                            channel='email',
                            recipient=str(recipient),
                            ok=bool(ok),
                            message=msg,
                            context=f"campaign:{campaign.id};student:{getattr(stu,'id',None)}",
                        )
                    except Exception:
                        pass

        if notifications:
            Notification.objects.bulk_create(notifications)

        # Also create chat messages (personalized per recipient) so these announcements appear in the unified Messages UI
        try:
            if personalized_pairs:
                # Resolve a valid sender id (fallback to any admin in school if created_by is missing)
                sender_id = getattr(campaign.created_by, 'id', None) or resolve_default_sender_id(campaign.school_id)
                if sender_id:
                    create_personalized_messages_for_users(
                        school_id=campaign.school_id,
                        sender_id=sender_id,
                        user_body_pairs=personalized_pairs,
                        system_tag='arrears',
                        queue_delivery=False,  # do not trigger email/SMS from chat mirror; channels are independent
                    )
        except Exception:
            logger.exception("Failed to mirror arrears campaign to chat messages")

        # Mark as completed
        with transaction.atomic():
            campaign = ArrearsMessageCampaign.objects.select_for_update().get(pk=campaign_id)
            campaign.sent_count = count
            campaign.sms_sent = sms_sent
            campaign.sms_failed = sms_failed
            campaign.email_sent = email_sent
            campaign.email_failed = email_failed
            campaign.status = ArrearsMessageCampaign.Status.COMPLETED
            campaign.finished_at = timezone.now()
            campaign.save(update_fields=['sent_count', 'sms_sent', 'sms_failed', 'email_sent', 'email_failed', 'status', 'finished_at'])
    except Exception as e:
        logger.exception("Arrears campaign %s failed", campaign_id)
        try:
            # Update failure status
            campaign = ArrearsMessageCampaign.objects.get(pk=campaign_id)
            campaign.status = ArrearsMessageCampaign.Status.FAILED
            campaign.error_message = str(e)
            campaign.finished_at = timezone.now()
            campaign.save(update_fields=['status', 'error_message', 'finished_at'])
        except Exception:
            pass


def process_message_delivery(message_id: int):
    """Background task: forwards a Message to all recipients via SMS and Email.
    Uses user.phone and user.email if available. Errors are logged and do not stop delivery to others.
    """
    from .models import Message, MessageRecipient
    from academics.models import Student
    try:
        msg = Message.objects.select_related('sender', 'school').get(pk=message_id)
        sender_id = getattr(msg, 'sender_id', None)
        send_sms_enabled = bool(getattr(msg, 'send_sms', True))
        send_email_enabled = bool(getattr(msg, 'send_email', True))
        # Iterate recipients
        recipients = (
            MessageRecipient.objects
            .filter(message_id=msg.id)
            .select_related('user')
        )
        sent_sms = 0
        sent_email = 0
        subject = f"New message from {getattr(msg.sender, 'username', 'user')}"
        for r in recipients:
            u = r.user
            if not u or (hasattr(u, 'is_active') and not u.is_active):
                continue
            # If the sender was included as a recipient (to show the message in their inbox),
            # do not forward SMS/Email back to the sender.
            try:
                if sender_id is not None and getattr(u, 'id', None) == sender_id:
                    continue
            except Exception:
                pass
            # Resolve student record (for guardian phone / student email fallbacks)
            stu = None
            try:
                if getattr(u, 'role', None) == 'student':
                    stu = Student.objects.filter(user_id=getattr(u, 'id', None), is_active=True).only('id', 'guardian_id', 'email').first()
            except Exception:
                stu = None
            # SMS
            phone = (getattr(u, 'phone', '') or '').strip()
            if (not phone) and stu is not None:
                phone = (getattr(stu, 'guardian_id', '') or '').strip()
            if phone and send_sms_enabled:
                ok_sms = False
                try:
                    ok_sms = send_sms(phone, msg.body, school_id=getattr(msg, 'school_id', None))
                    if ok_sms:
                        sent_sms += 1
                except Exception:
                    logger.exception("Failed to SMS user %s", getattr(u, 'id', ''))
                finally:
                    try:
                        log_delivery(
                            school_id=getattr(msg, 'school_id', None),
                            channel='sms',
                            recipient=str(phone),
                            ok=bool(ok_sms),
                            message=msg.body,
                            context=f"message:{message_id};user:{getattr(u,'id',None)}",
                        )
                    except Exception:
                        pass
            # Email
            email = (getattr(u, 'email', '') or '').strip()
            if (not email) and stu is not None:
                email = (getattr(stu, 'email', '') or '').strip()
            if email and send_email_enabled:
                ok_email = False
                err_txt = ''
                try:
                    ok_email = send_email_safe(subject, msg.body, email, school_id=getattr(msg, 'school_id', None))
                    if ok_email:
                        sent_email += 1
                except Exception as e:
                    err_txt = str(e)
                    logger.exception("Failed to email user %s", getattr(u, 'id', ''))
                finally:
                    try:
                        log_delivery(
                            school_id=getattr(msg, 'school_id', None),
                            channel='email',
                            recipient=str(email),
                            ok=bool(ok_email),
                            message=msg.body,
                            context=f"message:{message_id};user:{getattr(u,'id',None)}",
                            error=err_txt,
                        )
                    except Exception:
                        pass
        logger.info("Message %s delivery complete: email=%s sms=%s", message_id, sent_email, sent_sms)
    except Exception:
        logger.exception("Message delivery %s failed", message_id)


def queue_message_delivery(message_id: int):
    """Spawn a daemon thread to process message delivery asynchronously."""
    t = threading.Thread(target=process_message_delivery, args=(message_id,), daemon=True)
    t.start()


def deliver_message_collect(message_id: int) -> dict:
    """Synchronously deliver a message via SMS and Email and return per-channel results.
    Returns dict like:
    {
      'message_id': int,
      'in_app': {'created': True},
      'sms': [{'user_id': int, 'phone': str, 'ok': bool}],
      'email': [{'user_id': int, 'email': str, 'ok': bool}],
    }
    Does not raise; logs errors and marks ok=False when applicable.
    """
    from .models import Message, MessageRecipient
    from academics.models import Student
    results = {
        'message_id': message_id,
        'in_app': {'created': False},
        'sms': [],
        'email': [],
    }
    try:
        msg = Message.objects.select_related('sender', 'school').get(pk=message_id)
        sender_id = getattr(msg, 'sender_id', None)
        send_sms_enabled = bool(getattr(msg, 'send_sms', True))
        send_email_enabled = bool(getattr(msg, 'send_email', True))
        # If recipients exist, we consider in-app as created (Message + MessageRecipient rows)
        has_recipients = MessageRecipient.objects.filter(message_id=msg.id).exists()
        results['in_app']['created'] = has_recipients

        # Iterate recipients and attempt channel deliveries, collecting outcome
        recipients = (
            MessageRecipient.objects
            .filter(message_id=msg.id)
            .select_related('user')
        )
        subject = f"New message from {getattr(msg.sender, 'username', 'user')}"
        for r in recipients:
            u = r.user
            if not u:
                continue
            # Do not forward SMS/Email back to sender when sender is included as a recipient
            try:
                if sender_id is not None and getattr(u, 'id', None) == sender_id:
                    continue
            except Exception:
                pass
            stu = None
            try:
                if getattr(u, 'role', None) == 'student':
                    stu = Student.objects.filter(user_id=getattr(u, 'id', None), is_active=True).only('id', 'guardian_id', 'email').first()
            except Exception:
                stu = None
            # SMS
            phone = (getattr(u, 'phone', '') or '').strip()
            if (not phone) and stu is not None:
                phone = (getattr(stu, 'guardian_id', '') or '').strip()
            if phone and send_sms_enabled:
                ok_sms = False
                try:
                    ok_sms = send_sms(phone, msg.body, school_id=getattr(msg, 'school_id', None))
                except Exception:
                    logger.exception("Failed to SMS user %s", getattr(u, 'id', ''))
                    ok_sms = False
                results['sms'].append({'user_id': getattr(u, 'id', None), 'phone': phone, 'ok': bool(ok_sms)})
                try:
                    log_delivery(
                        school_id=getattr(msg, 'school_id', None),
                        channel='sms',
                        recipient=str(phone),
                        ok=bool(ok_sms),
                        message=msg.body,
                        context=f"message:{message_id};user:{getattr(u,'id',None)}",
                    )
                except Exception:
                    pass

            # Email
            email = (getattr(u, 'email', '') or '').strip()
            if (not email) and stu is not None:
                email = (getattr(stu, 'email', '') or '').strip()
            if email and send_email_enabled:
                ok_email = False
                err_txt = ''
                try:
                    ok_email = send_email_safe(subject, msg.body, email, school_id=getattr(msg, 'school_id', None))
                except Exception as e:
                    err_txt = str(e)
                    logger.exception("Failed to email user %s", getattr(u, 'id', ''))
                    ok_email = False
                results['email'].append({'user_id': getattr(u, 'id', None), 'email': email, 'ok': bool(ok_email)})
                try:
                    log_delivery(
                        school_id=getattr(msg, 'school_id', None),
                        channel='email',
                        recipient=str(email),
                        ok=bool(ok_email),
                        message=msg.body,
                        context=f"message:{message_id};user:{getattr(u,'id',None)}",
                        error=err_txt,
                    )
                except Exception:
                    pass
    except Exception:
        logger.exception("deliver_message_collect failed for message %s", message_id)
    return results


def create_messages_for_users(school_id: int, sender_id: int, body: str, recipient_user_ids: list[int], system_tag: str | None = None, *, queue_delivery: bool = True):
    """Create Message rows (one per recipient) and associated MessageRecipient rows.
    Mirrors notifications into the chat so they appear in the Messages UI.
    When queue_delivery is True (default), also queue email/SMS delivery for each created message.
    """
    from .models import Message, MessageRecipient
    if not recipient_user_ids:
        return 0
    created = 0
    for uid in recipient_user_ids:
        try:
            msg = Message.objects.create(
                school_id=school_id,
                sender_id=sender_id,
                body=body,
                audience=Message.Audience.USERS,
                system_tag=system_tag,
            )
            MessageRecipient.objects.create(message=msg, user_id=uid)
            if queue_delivery:
                try:
                    queue_message_delivery(msg.id)
                except Exception:
                    pass
            created += 1
        except Exception:
            logger.exception("Failed to create chat message for user %s", uid)
    return created


def create_personalized_messages_for_users(school_id: int, sender_id: int, user_body_pairs: list[tuple[int, str]], system_tag: str | None = None, *, queue_delivery: bool = True):
    """Create per-user Message with its own body. user_body_pairs: [(user_id, body), ...].
    When queue_delivery is True (default), queues email/SMS delivery for each created message.
    """
    from .models import Message, MessageRecipient
    created = 0
    for uid, body in user_body_pairs:
        try:
            msg = Message.objects.create(
                school_id=school_id,
                sender_id=sender_id,
                body=body,
                audience=Message.Audience.USERS,
            )
            MessageRecipient.objects.create(message=msg, user_id=uid)
            if queue_delivery:
                try:
                    queue_message_delivery(msg.id)
                except Exception:
                    pass
            created += 1
        except Exception:
            logger.exception("Failed to create personalized chat message for user %s", uid)
    return created


def create_message_for_role(school_id: int, sender_id: int, body: str, role: str):
    """Create a single Message targeted to a role and materialize recipients.
    Returns the created Message id or None.
    """
    from django.contrib.auth import get_user_model
    from .models import Message, MessageRecipient
    User = get_user_model()
    # Create a role-audience message (will be materialized here too)
    msg = Message.objects.create(
        school_id=school_id,
        sender_id=sender_id,
        body=body,
        audience=Message.Audience.ROLE,
        recipient_role=role,
    )
    # Materialize recipients (same-school, same role)
    recipients_qs = User.objects.filter(school_id=school_id, role=role, is_active=True)
    recs = [MessageRecipient(message=msg, user=u) for u in recipients_qs]
    if recs:
        MessageRecipient.objects.bulk_create(recs, ignore_conflicts=True)
    if queue_delivery:
        try:
            queue_message_delivery(msg.id)
        except Exception:
            pass
    return msg.id


def notify_enrollment(student) -> bool:
    """Send notifications after successful enrollment (Student creation).
    Attempts SMS, email, in-app Notification, and mirrors to chat Messages if a linked user exists.
    """
    try:
        from .models import Notification
        # Build context
        student_name = getattr(student, 'name', 'Student')
        klass_name = getattr(getattr(student, 'klass', None), 'name', '')
        school = getattr(getattr(student, 'klass', None), 'school', None)
        school_id = getattr(school, 'id', None)
        body = f"Welcome {student_name}! You have been enrolled{(' to ' + klass_name) if klass_name else ''}."
        # Do not notify inactive students
        if not getattr(student, 'is_active', True):
            return True

        # In-app notification
        if getattr(student, 'user_id', None):
            try:
                Notification.objects.create(user_id=student.user_id, message=body, type='in_app')
            except Exception:
                pass

        # Mirror to chat
        sender_id = resolve_default_sender_id(school_id) if school_id else None
        if sender_id and getattr(student, 'user_id', None):
            try:
                create_messages_for_users(
                    school_id=school_id,
                    sender_id=sender_id,
                    body=body,
                    recipient_user_ids=[student.user_id],
                    system_tag='enrollment',
                )
            except Exception:
                pass

        # SMS -> guardian phone only
        phone = getattr(student, 'guardian_id', None)
        if phone:
            try:
                ok = send_sms(phone, body, school_id=school_id)
            except Exception:
                ok = False
            try:
                log_delivery(
                    school_id=getattr(getattr(student, 'klass', None), 'school_id', None),
                    channel='sms',
                    recipient=str(phone),
                    ok=bool(ok),
                    message=body,
                    context=f"enrollment;student:{getattr(student,'id',None)}",
                )
            except Exception:
                pass

        # Email
        recipient = getattr(student, 'email', None) or getattr(getattr(student, 'user', None), 'email', None)
        if recipient:
            try:
                subj = f"Enrollment Confirmation{(' - ' + getattr(school,'name','')) if school else ''}"
                ok = send_email_safe(subj, body, recipient, school_id=school_id)
            except Exception:
                ok = False
            try:
                log_delivery(
                    school_id=getattr(school, 'id', None),
                    channel='email',
                    recipient=str(recipient),
                    ok=bool(ok),
                    message=body,
                    context=f"enrollment;student:{getattr(student,'id',None)}",
                )
            except Exception:
                pass
        return True
    except Exception:
        logger.exception("notify_enrollment failed for student %s", getattr(student, 'id', None))
        return False


def notify_payment_received(invoice, payment) -> bool:
    """Notify student on payment received and updated balance.
    Sends SMS, Email, in-app Notification and chat mirror where possible.
    """
    try:
        from django.db.models import Sum
        from .models import Notification
        student = getattr(invoice, 'student', None)
        if not student:
            return False
        if not getattr(student, 'is_active', True):
            return True
        if bool(getattr(student, 'is_transferred', False)):
            return True
        school = getattr(getattr(student, 'klass', None), 'school', None)
        school_id = getattr(school, 'id', None)
        # Compute updated totals
        totals = invoice.payments.aggregate(s=Sum('amount'))
        total_paid = float(totals.get('s') or 0)
        total_billed = float(getattr(invoice, 'amount', 0) or 0)
        balance = round(total_billed - total_paid, 2)

        amt = float(getattr(payment, 'amount', 0) or 0)
        method = getattr(payment, 'method', 'payment')
        ref = getattr(payment, 'reference', '')
        student_name = getattr(student, 'name', 'Student')
        admission_no = getattr(student, 'admission_no', '')
        klass_name = getattr(getattr(student, 'klass', None), 'name', '')

        body = (
            f"Payment received for {student_name} ({admission_no}) Class: {klass_name}. "
            f"Amount: {amt:.2f} via {method}" + (f" (Ref: {ref})" if ref else "") +
            f". Invoice #{invoice.id}. New balance: {balance:.2f}."
        )

        # In-app notification
        if getattr(student, 'user_id', None):
            try:
                Notification.objects.create(user_id=student.user_id, message=body, type='in_app')
            except Exception:
                pass

        # Preferred: queue in-app + SMS + Email via the unified Messages delivery pipeline.
        # This ensures delivery logs are created and sending happens asynchronously.
        sender_id = resolve_default_sender_id(school_id) if school_id else None
        queued_via_messages = False
        if sender_id and getattr(student, 'user_id', None):
            try:
                create_messages_for_users(
                    school_id=school_id,
                    sender_id=sender_id,
                    body=body,
                    recipient_user_ids=[student.user_id],
                    system_tag='payment',
                    queue_delivery=True,
                )
                queued_via_messages = True
            except Exception:
                queued_via_messages = False

        # Fallback: if the student has no linked user (or sender not resolvable), send directly.
        if not queued_via_messages:
            # SMS -> guardian phone only
            phone = getattr(student, 'guardian_id', None)
            if phone:
                try:
                    send_sms(phone, body, school_id=school_id)
                except Exception:
                    pass

            # Email
            recipient = getattr(student, 'email', None) or getattr(getattr(student, 'user', None), 'email', None)
            if recipient:
                try:
                    subj = f"Fee payment received - Invoice {invoice.id}"
                    send_email_safe(subj, body, recipient, school_id=school_id)
                except Exception:
                    pass
        return True
    except Exception:
        logger.exception("notify_payment_received failed for invoice %s payment %s", getattr(invoice, 'id', None), getattr(payment, 'id', None))
        return False


def resolve_default_sender_id(school_id: int):
    """Return a valid sender user id from the given school (admin/staff preferred)."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    u = (User.objects.filter(school_id=school_id, role='admin').first()
         or User.objects.filter(school_id=school_id, is_staff=True).first()
         or User.objects.filter(school_id=school_id).first())
    return getattr(u, 'id', None)


def create_broadcast_message(school_id: int, sender_id: int, body: str, *, queue_delivery: bool = True):
    """Create a broadcast message to everyone in the school and materialize recipients."""
    from django.contrib.auth import get_user_model
    from .models import Message, MessageRecipient
    User = get_user_model()
    msg = Message.objects.create(
        school_id=school_id,
        sender_id=sender_id,
        body=body,
        audience=Message.Audience.ALL,
        send_sms=True,
        send_email=True,
        is_broadcast=True,
        system_tag='Alert'
    )
    recipients_qs = User.objects.filter(school_id=school_id)
    recs = [MessageRecipient(message=msg, user=u) for u in recipients_qs]
    if recs:
        MessageRecipient.objects.bulk_create(recs, ignore_conflicts=True)
    try:
        queue_message_delivery(msg.id)
    except Exception:
        pass
    return msg.id
