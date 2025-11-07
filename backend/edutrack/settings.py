import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent

# Ensure .env takes precedence over any pre-set OS environment variables
# Explicitly load the .env located in the project base directory (backend/)
load_dotenv(dotenv_path=BASE_DIR / '.env', override=True)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret-key-change-me')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
CSRF_TRUSTED_ORIGINS = [h for h in os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost').split(',') if h]

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
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
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

# Database configuration
# Allow a lightweight SQLite fallback for local development when USE_SQLITE=True
USE_SQLITE = os.getenv('USE_SQLITE', 'False') == 'True'
if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB', ''),
            'USER': os.getenv('POSTGRES_USER', ''),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', ''),
            'HOST': os.getenv('POSTGRES_HOST', ''),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
            'OPTIONS': {'sslmode': 'require'},
            'CONN_MAX_AGE': 600,
        }
    }

# Prefer DATABASE_URL if provided (Render / 12-factor style)
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    if DATABASE_URL.startswith('sqlite'):
        DATABASES['default'] = dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=False)
    else:
        DATABASES['default'] = dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=True)

AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # Pagination: allow clients to request larger page sizes while defaulting to 50
    'DEFAULT_PAGINATION_CLASS': 'edutrack.pagination.CustomPageNumberPagination',
    'PAGE_SIZE': 50,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'EDU-TRACK API',
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

CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True') == 'True'
CORS_ALLOWED_ORIGINS = [o for o in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o]

# Ensure ngrok origin is allowed for CORS when not fully open
if not CORS_ALLOW_ALL_ORIGINS:
    if NGROK_ORIGIN and NGROK_ORIGIN not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(NGROK_ORIGIN)
    if NGROK_ORIGIN_HTTP and NGROK_ORIGIN_HTTP not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(NGROK_ORIGIN_HTTP)

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
FRONTEND_URL = os.getenv('FRONTEND_URL', os.getenv('VITE_API_BASE_URL', 'http://localhost:5173'))

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

# Control whether creating chat messages queues email/SMS delivery
MESSAGES_QUEUE_DELIVERY = os.getenv('MESSAGES_QUEUE_DELIVERY', 'True') == 'True'

# Temporarily disable messaging on account creation/enrollment
DISABLE_ACCOUNT_MESSAGING = True
