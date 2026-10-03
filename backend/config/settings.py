import os
from pathlib import Path
from urllib.parse import urlsplit

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
local_env_file = BASE_DIR / ".env"
load_dotenv(local_env_file)

DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false.")
    SECRET_KEY = "development-only-insecure-key"
CAMERA_URL_ENCRYPTION_KEY = os.environ.get("CAMERA_URL_ENCRYPTION_KEY", "")
if not CAMERA_URL_ENCRYPTION_KEY:
    if not DEBUG:
        raise RuntimeError("CAMERA_URL_ENCRYPTION_KEY must be set when DJANGO_DEBUG is false.")
    CAMERA_URL_ENCRYPTION_KEY = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "daphne",
    "channels",
    "corsheaders",
    "accounts.apps.AccountsConfig",
    "streams.apps.StreamsConfig",
]

AUTH_USER_MODEL = "accounts.User"
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL must be set to a PostgreSQL connection URL.")
if urlsplit(database_url).scheme not in {"postgres", "postgresql", "postgresql+psycopg"}:
    raise RuntimeError("Only PostgreSQL connection URLs are supported.")
DATABASES = {
    "default": dj_database_url.parse(
        database_url,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

cors_allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if DEBUG and not cors_allowed_origins.strip():
    cors_allowed_origins = ",".join(
        f"http://{host}:{port}"
        for host in ("localhost", "127.0.0.1")
        for port in (5173, 5174)
    )
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in cors_allowed_origins.split(",")
    if origin.strip()
]
production_frontend_origin = "https://rtsp-stream-viewer-roan.vercel.app"
if not DEBUG and production_frontend_origin not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(production_frontend_origin)
FRONTEND_URL = os.environ.get("FRONTEND_URL", production_frontend_origin).rstrip("/")
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "false").lower() == "true"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)
EMAIL_TIMEOUT = 10
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.environ.get(
    "DJANGO_SECURE_SSL_REDIRECT", "false"
).lower() == "true"
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
}

FFMPEG_BINARY = os.environ.get("FFMPEG_BINARY", "ffmpeg")
RTSP_MAX_CONCURRENT_STREAMS = max(
    1,
    int(os.environ.get("RTSP_MAX_CONCURRENT_STREAMS", "4")),
)
