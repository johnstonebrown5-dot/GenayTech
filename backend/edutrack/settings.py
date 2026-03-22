import os
from pathlib import Path
from datetime import timedelta
try:
    from dotenv import load_dotenv
except ImportError:
    # If using the 'dotenv' package instead of 'python-dotenv'
    from dotenv import read_dotenv
    def load_dotenv(dotenv_path=None, **kwargs):
        return read_dotenv(dotenv_path)
from corsheaders.defaults import default_headers
import dj_database_url
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent

# Ensure .env takes precedence over any pre-set OS environment variables
# Explicitly load the .env located in the project base directory (backend/)
load_dotenv(dotenv_path=BASE_DIR / '.env', override=True)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret-key-change-me')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

TENANT_BASE_DOMAIN = os.getenv('TENANT_BASE_DOMAIN', 'edutrack.local').strip().lower().lstrip('.')

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
CSRF_TRUSTED_ORIGINS = [h for h in os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost').split(',') if h]

if TENANT_BASE_DOMAIN and (f".{TENANT_BASE_DOMAIN}" not in ALLOWED_HOSTS):
    ALLOWED_HOSTS.append(f".{TENANT_BASE_DOMAIN}")

if DEBUG:
    if '.localhost' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append('.localhost')
    if '.lvh.me' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append('.lvh.me')

# Render deployments expose a hostname in RENDER_EXTERNAL_HOSTNAME.
RENDER_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if RENDER_HOSTNAME and RENDER_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_HOSTNAME)

# Also allow generic Render subdomains unless explicitly overridden
if '.onrender.com' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('.onrender.com')

# Add ngrok domain(s) for temporary public exposure
# Prefer env-provided host/url to avoid code edits each time the tunnel changes
NGROK_HOST = os.getenv('NGROK_HOST', '').strip()
NGROK_ORIGIN = ''
NGROK_ORIGIN_HTTP = ''
if not NGROK_HOST:
    # Allow passing full URL via NGROK_URL, e.g. https://1234.ngrok-free.app
    ngrok_url = os.getenv('NGROK_URL', '').strip().rstrip('/')
    if ngrok_url.startswith('http://') or ngrok_url.startswith('https://'):
        NGROK_HOST = ngrok_url.split('://', 1)[1]

if NGROK_HOST:
    if NGROK_HOST not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(NGROK_HOST)
    NGROK_ORIGIN = f"https://{NGROK_HOST}"
    if NGROK_ORIGIN not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(NGROK_ORIGIN)
    # Also include HTTP in case the tunnel is accessed via http
    NGROK_ORIGIN_HTTP = f"http://{NGROK_HOST}"
    if NGROK_ORIGIN_HTTP not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(NGROK_ORIGIN_HTTP)

# When in DEBUG, allow any ngrok-free subdomain for convenience
if DEBUG:
    if '.ngrok-free.app' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append('.ngrok-free.app')
    # CSRF_TRUSTED_ORIGINS supports wildcard patterns (Django >=4.1)
    for pattern in ['https://*.ngrok-free.app', 'http://*.ngrok-free.app']:
        if pattern not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(pattern)

# Build CSRF trusted origins from ALLOWED_HOSTS (https first, then http)
for host in ALLOWED_HOSTS:
    host = host.strip()
    if not host:
        continue
    # skip if entry already looks like a scheme URL
    if host.startswith('http://') or host.startswith('https://'):
        origin = host
        if origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(origin)
        continue
    # handle wildcard/domain entries
    https_origin = f"https://{host.lstrip('.')}"
    http_origin = f"http://{host.lstrip('.')}"
    if https_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(https_origin)
    if http_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(http_origin)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework.authtoken',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'django_filters',
    'corsheaders',
    'storages',

    'accounts',
    'academics',
    'finance',
    'communications',
    'reports',
    'webpush',
]

# Webpush Settings
WEBPUSH_SETTINGS = {
    "VAPID_PUBLIC_KEY": os.getenv("VAPID_PUBLIC_KEY"),
    "VAPID_PRIVATE_KEY": os.getenv("VAPID_PRIVATE_KEY"),
    "VAPID_ADMIN_EMAIL": os.getenv("SUPPORT_EMAIL", "edutrack46@gmail.com")
}

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'accounts.middleware.SchoolDomainMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'edutrack.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'edutrack.wsgi.application'

# Database configuration – default to SQLite, optionally use MySQL on PythonAnywhere
def _env_bool(name: str, default: str = 'False') -> bool:
    return str(os.getenv(name, default)).strip().lower() in ('1', 'true', 'yes', 'on')

USE_MYSQL = _env_bool('USE_MYSQL', 'False')
# Auto-enable MySQL if core creds are present even when USE_MYSQL is omitted
_has_mysql_creds = bool(os.getenv('MYSQL_DB') and os.getenv('MYSQL_USER') and os.getenv('MYSQL_PASSWORD'))
if USE_MYSQL or _has_mysql_creds:
    # Expected environment variables on PythonAnywhere:
    #   MYSQL_DB (e.g., 'yourusername$yourdb')
    #   MYSQL_USER (e.g., 'yourusername')
    #   MYSQL_PASSWORD
    # Optional overrides:
    #   MYSQL_HOST (default 'mysql.server'), MYSQL_PORT (default '3306')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.getenv('MYSQL_DB', ''),
            'USER': os.getenv('MYSQL_USER', ''),
            'PASSWORD': os.getenv('MYSQL_PASSWORD', ''),
            'HOST': os.getenv('MYSQL_HOST', os.getenv('PA_MYSQL_HOST', 'mysql.server')),
            'PORT': os.getenv('MYSQL_PORT', '3306'),
            # Keep connections open for reuse; safe on PA shared MySQL
            'CONN_MAX_AGE': int(os.getenv('MYSQL_CONN_MAX_AGE', '60')),
            'OPTIONS': {
                # Strict mode for better integrity; adjust if needed
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
                'charset': 'utf8mb4',
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'OPTIONS': {
                'timeout': int(os.getenv('SQLITE_TIMEOUT', '30')),
            },
        }
    }

AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.getenv('DRF_THROTTLE_ANON', '60/min'),
        'user': os.getenv('DRF_THROTTLE_USER', '600/min'),
        'login': os.getenv('DRF_THROTTLE_LOGIN', '10/min'),
        'password_reset': os.getenv('DRF_THROTTLE_PASSWORD_RESET', '5/min'),
        'public': os.getenv('DRF_THROTTLE_PUBLIC', '30/min'),
    },
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # Pagination: allow clients to request larger page sizes while defaulting to 50
    'DEFAULT_PAGINATION_CLASS': 'edutrack.pagination.CustomPageNumberPagination',
    'PAGE_SIZE': 50,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Genay Technologies API',
    'DESCRIPTION': 'CBC-ready School Management System API',
    'VERSION': '1.0.0',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('TIME_ZONE', 'Africa/Nairobi')
USE_I18N = True
USE_TZ = True

# Respect HTTPS scheme when behind a proxy/load balancer (e.g., Render)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# S3 storage (DigitalOcean Spaces or AWS S3)
USE_S3 = os.getenv('USE_S3', 'False') == 'True'
if USE_S3:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL', None)  # For DO Spaces
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    # Derive a public custom domain for the bucket, supporting both S3 and DO Spaces
    AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN', '').strip()
    if not AWS_S3_CUSTOM_DOMAIN:
        if AWS_S3_ENDPOINT_URL:
            parsed = urlparse(AWS_S3_ENDPOINT_URL)
            host = parsed.netloc
            AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.{host}"
        else:
            region = AWS_S3_REGION_NAME or 'us-east-1'
            AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.{region}.amazonaws.com"

    # Serve static and media from separate folders within the same bucket
    STATIC_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/static/"
    MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/media/"

    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
            'OPTIONS': { 'location': 'media' },
        },
        'staticfiles': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
            'OPTIONS': { 'location': 'static' },
        },
    }
else:
    STATIC_URL = '/static/'
    STATIC_ROOT = BASE_DIR / 'staticfiles'
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'

    # When not using S3, serve static files with WhiteNoise's manifest storage
    if not os.getenv('USE_S3', 'False') == 'True':
        STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

CORS_ALLOW_ALL_ORIGINS = (os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True') == 'True') if DEBUG else (os.getenv('CORS_ALLOW_ALL_ORIGINS', 'False') == 'True')
CORS_ALLOWED_ORIGINS = [o for o in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o]

# Allow frontend to send host hint for multi-tenant resolution
CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-forwarded-host',
]

# Ensure ngrok origin is allowed for CORS when not fully open
if not CORS_ALLOW_ALL_ORIGINS:
    if NGROK_ORIGIN and NGROK_ORIGIN not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(NGROK_ORIGIN)
    if NGROK_ORIGIN_HTTP and NGROK_ORIGIN_HTTP not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(NGROK_ORIGIN_HTTP)

CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = os.getenv('CSRF_COOKIE_SAMESITE', 'Lax')
SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
CSRF_COOKIE_HTTPONLY = not DEBUG

# Email configuration (use environment variables; defaults are Gmail-friendly)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
SERVER_EMAIL = os.getenv('SERVER_EMAIL', DEFAULT_FROM_EMAIL)
SUPPORT_EMAIL = os.getenv('SUPPORT_EMAIL', 'edutrack46@gmail.com')
# When True, skip real SMTP and pretend emails were sent successfully (for local dev/tests)
EMAIL_LOOPBACK = os.getenv('EMAIL_LOOPBACK', 'False') == 'True'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Frontend base URL for welcome page login button
if DEBUG:
    FRONTEND_URL = os.getenv('FRONTEND_URL', os.getenv('VITE_API_BASE_URL', 'http://localhost:5173'))
else:
    FRONTEND_URL = os.getenv('FRONTEND_URL', '')

# Africa's Talking (SMS) configuration
AT_USERNAME = os.getenv('AT_USERNAME', 'sandbox')
AT_API_KEY = os.getenv('AT_API_KEY', '')
# Optional sender id or short code (leave empty for sandbox default)
AT_SENDER_ID = os.getenv('AT_SENDER_ID', '')
# When on sandbox, we typically use REST to avoid SDK WhatsApp sandbox issues.
AT_USE_REST_FOR_SANDBOX = os.getenv('AT_USE_REST_FOR_SANDBOX', 'True') == 'True'
# Optional: simulate SMS success in development when delivery fails (for demos/tests)
SMS_LOOPBACK = os.getenv('SMS_LOOPBACK', 'False') == 'True'
# Optional: path to a custom CA bundle (PEM). If set, requests will verify TLS using this bundle.
AT_CA_BUNDLE = os.getenv('AT_CA_BUNDLE', '')
# Optional: whether to trust environment proxy settings (HTTP(S)_PROXY). Default False to avoid TLS downgrades.
AT_TRUST_ENV = os.getenv('AT_TRUST_ENV', 'False') == 'True'

# TextWave (SMS) configuration
TEXTWAVE_BASE_URL = os.getenv('TEXTWAVE_BASE_URL', 'https://api.textwave.co.ke/v1')
TEXTWAVE_API_KEY = os.getenv('TEXTWAVE_API_KEY', '')
TEXTWAVE_SENDER_ID = os.getenv('TEXTWAVE_SENDER_ID', '')

# Optional: override the send endpoint path if it differs (will be joined to TEXTWAVE_BASE_URL)
TEXTWAVE_SEND_PATH = os.getenv('TEXTWAVE_SEND_PATH', '/sms/send')

# Optional: if set, will be used as-is (JSON object) to build request headers.
# Example: {"Authorization": "Bearer ${TEXTWAVE_API_KEY}", "Content-Type": "application/json"}
TEXTWAVE_HEADERS_JSON = os.getenv('TEXTWAVE_HEADERS_JSON', '{"Authorization":"Bearer ${TEXTWAVE_API_KEY}","Content-Type":"application/json"}')

# Optional: payload key overrides
TEXTWAVE_TO_KEY = os.getenv('TEXTWAVE_TO_KEY', 'to')
TEXTWAVE_MESSAGE_KEY = os.getenv('TEXTWAVE_MESSAGE_KEY', 'message')
TEXTWAVE_FROM_KEY = os.getenv('TEXTWAVE_FROM_KEY', 'senderId')

# Default provider when school integration settings are not configured
SMS_PROVIDER_DEFAULT = os.getenv('SMS_PROVIDER_DEFAULT', 'textwave')

# Control whether creating chat messages queues email/SMS delivery
MESSAGES_QUEUE_DELIVERY = os.getenv('MESSAGES_QUEUE_DELIVERY', 'True') == 'True'

# Temporarily disable messaging on account creation/enrollment
DISABLE_ACCOUNT_MESSAGING = True
